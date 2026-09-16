import { z } from 'zod';
import { adminHash, ClubError, cookie, database, digest, passwordHash, rateLimit, sessionToken, userFor, verifyPassword } from '@/lib/club';
const str = (max: number) => z.string().trim().min(1).max(max);
const id = str(100);
const actions = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('login'), username: str(60), password: z.string().min(1).max(128)
    }),
    z.object({
        action: z.literal('logout')
    }),
    z.object({
        action: z.literal('book'), slotId: id, studentName: str(100), email: z.string().trim().email().max(254), grade: z.enum(['6', '7', '8']), subject: str(200)
    }),
    z.object({
        action: z.literal('savePost'), id: id.optional(), type: z.enum(['meeting', 'competition', 'problem']), title: str(160), body: str(10000), date: z.string().max(40), answer: z.string().max(5000).optional().default('')
    }),
    z.object({
        action: z.literal('deletePost'), id
    }),
    z.object({
        action: z.literal('createVolunteer'), username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,40}$/), password: z.string().min(8).max(128), name: str(100), bio: z.string().trim().max(1000), subjects: z.array(str(80)).min(1).max(12)
    }),
    z.object({
        action: z.literal('deactivateVolunteer'), id
    }),
    z.object({
        action: z.literal('createSlot'), volunteerId: id, startsAt: z.string().datetime({
            offset: true
        }), joinUrl: z.string().url().max(2048).refine(v => new URL(v).protocol === 'https:' && !new URL(v).username && !new URL(v).password, 'Use an HTTPS lesson link.')
    }),
    z.object({
        action: z.literal('deleteSlot'), id
    }),
]);
function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
    return Response.json(data, {
        status, headers: {
            'Cache-Control': 'no-store', ...headers
        }
    });
}
function failure(error: unknown) {
    if (error instanceof ClubError)
        return json({
            error: error.message
        }, error.status);
    if (error instanceof z.ZodError)
        return json({
            error: error.issues[0]?.message || 'Please check the form fields.'
        }, 400);
    console.error('Club API failed', error instanceof Error ? error.message : 'Unknown error');
    return json({
        error: 'We could not complete that request. Please try again.'
    }, 500);
}
export async function GET(request: Request) {
    try {
        const db = database(), user = await userFor(request, db);
        const volunteers = (await db.prepare('SELECT id, name, bio, subjects FROM volunteers WHERE active = 1 ORDER BY name').all<{
            id: string;
            name: string;
            bio: string;
            subjects: string;
        }>()).results.map(v => ({
            ...v, subjects: JSON.parse(v.subjects)
        }));
        const posts = (await db.prepare('SELECT id, type, title, body, date, answer FROM posts ORDER BY date ASC').all()).results;
        const slots = (await db.prepare('SELECT s.id, s.volunteer_id AS volunteerId, s.starts_at AS startsAt FROM slots s JOIN volunteers v ON v.id = s.volunteer_id LEFT JOIN bookings b ON b.slot_id = s.id WHERE v.active = 1 AND b.id IS NULL AND s.starts_at > ? ORDER BY s.starts_at').bind(new Date().toISOString()).all()).results;
        const bookings = user ? (await db.prepare('SELECT b.id, b.student_name AS studentName, b.email, b.grade, b.subject, s.starts_at AS startsAt, v.name AS volunteerName, s.join_url AS joinUrl FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN volunteers v ON v.id = s.volunteer_id WHERE (? = 1 OR v.id = ?) ORDER BY s.starts_at').bind(user.role === 'admin' ? 1 : 0, user.id).all()).results : [];
        const extra = user?.role === 'admin' ? {
            users: (await db.prepare('SELECT id, username, name, bio, subjects, active FROM volunteers ORDER BY name').all<{
                id: string;
                subjects: string;
            }>()).results.map(v => ({
                ...v, subjects: JSON.parse(v.subjects)
            })), allSlots: (await db.prepare('SELECT s.id, s.volunteer_id AS volunteerId, s.starts_at AS startsAt, s.join_url AS joinUrl, b.id AS bookingId FROM slots s LEFT JOIN bookings b ON b.slot_id = s.id ORDER BY s.starts_at').all()).results
        } : {};
        return json({
            user, volunteers, posts, slots, bookings, ...extra
        });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) {
    try {
        if (request.headers.get('origin') !== new URL(request.url).origin)
            throw new ClubError('Please submit this request from the club website.', 403);
        if (!request.headers.get('content-type')?.includes('application/json'))
            throw new ClubError('Send a JSON request.', 415);
        if (Number(request.headers.get('content-length') || 0) > 20000)
            throw new ClubError('Request too large.', 413);
        const reader = request.body?.getReader();
        if (!reader)
            throw new ClubError('Request body is required.');
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            length += value.length;
            if (length > 20000) {
                await reader.cancel();
                throw new ClubError('Request too large.', 413);
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(new TextDecoder().decode(bytes));
        }
        catch {
            throw new ClubError('Invalid JSON request.');
        }
        const data = actions.parse(parsed), db = database();
        if (data.action === 'login') {
            await rateLimit(db, request, 'login', 10, 15 * 60 * 1000);
            let userId: string | null = null;
            if (data.username === 'mathLeader') {
                const hash = adminHash();
                if (!hash)
                    throw new ClubError('Administrator sign-in is not configured yet.', 503);
                if (await verifyPassword(data.password, hash))
                    userId = 'admin';
            }
            else {
                const row = await db.prepare('SELECT id, password_hash FROM volunteers WHERE username = ? AND active = 1').bind(data.username.toLowerCase()).first<{
                    id: string;
                    password_hash: string;
                }>();
                if (row && await verifyPassword(data.password, row.password_hash))
                    userId = row.id;
            }
            if (!userId)
                throw new ClubError('The username or password is incorrect.', 401);
            const token = crypto.randomUUID() + crypto.randomUUID();
            await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token), userId, Date.now() + 12 * 60 * 60 * 1000).run();
            return json({
                ok: true
            }, 200, {
                'Set-Cookie': cookie(request, token, 12 * 60 * 60)
            });
        }
        if (data.action === 'logout') {
            const token = sessionToken(request);
            if (token)
                await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();
            return json({
                ok: true
            }, 200, {
                'Set-Cookie': cookie(request, '', 0)
            });
        }
        if (data.action === 'book') {
            await rateLimit(db, request, 'book', 10, 60 * 60 * 1000);
            const slot = await db.prepare('SELECT s.starts_at AS startsAt, s.join_url AS joinUrl, v.name AS volunteerName FROM slots s JOIN volunteers v ON v.id = s.volunteer_id WHERE s.id = ? AND v.active = 1 AND s.starts_at > ?').bind(data.slotId, new Date().toISOString()).first<{
                startsAt: string;
                joinUrl: string;
                volunteerName: string;
            }>();
            if (!slot)
                throw new ClubError('That lesson is no longer available. Please choose another time.', 409);
            const bookingId = crypto.randomUUID();
            const result = await db.prepare('INSERT INTO bookings (id, slot_id, student_name, email, grade, subject) SELECT ?, s.id, ?, ?, ?, ? FROM slots s JOIN volunteers v ON v.id = s.volunteer_id WHERE s.id = ? AND v.active = 1 AND s.starts_at > ? ON CONFLICT(slot_id) DO NOTHING').bind(bookingId, data.studentName, data.email.toLowerCase(), data.grade, data.subject, data.slotId, new Date().toISOString()).run();
            if (!result.meta.changes)
                throw new ClubError('That lesson was just booked. Please choose another time.', 409);
            return json({
                ok: true, booking: {
                    id: bookingId, ...slot
                }
            });
        }
        const user = await userFor(request, db);
        if (user?.role !== 'admin')
            throw new ClubError('Administrator sign-in is required.', 403);
        if (data.action === 'savePost') {
            if (data.date && !Number.isFinite(Date.parse(data.date)))
                throw new ClubError('Please enter a valid date.');
            const postId = data.id || crypto.randomUUID();
            if (data.id) {
                const result = await db.prepare('UPDATE posts SET type = ?, title = ?, body = ?, date = ?, answer = ? WHERE id = ?').bind(data.type, data.title, data.body, data.date, data.answer, postId).run();
                if (!result.meta.changes)
                    throw new ClubError('That post no longer exists.', 404);
            }
            else
                await db.prepare('INSERT INTO posts (id,type,title,body,date,answer) VALUES (?,?,?,?,?,?)').bind(postId, data.type, data.title, data.body, data.date, data.answer).run();
            return json({
                ok: true, id: postId
            });
        }
        if (data.action === 'deletePost') {
            await db.prepare('DELETE FROM posts WHERE id = ?').bind(data.id).run();
            return json({
                ok: true
            });
        }
        if (data.action === 'createVolunteer') {
            const username = data.username.toLowerCase();
            if (username === 'mathleader')
                throw new ClubError('That username is reserved.');
            const volunteerId = crypto.randomUUID();
            const result = await db.prepare('INSERT INTO volunteers (id,username,password_hash,name,bio,subjects,active) VALUES (?,?,?,?,?,?,1) ON CONFLICT(username) DO NOTHING').bind(volunteerId, username, await passwordHash(data.password), data.name, data.bio, JSON.stringify(data.subjects)).run();
            if (!result.meta.changes)
                throw new ClubError('That username is already in use.', 409);
            return json({
                ok: true, id: volunteerId
            });
        }
        if (data.action === 'deactivateVolunteer') {
            await db.batch([db.prepare('UPDATE volunteers SET active = 0 WHERE id = ?').bind(data.id), db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(data.id)]);
            return json({
                ok: true
            });
        }
        if (data.action === 'createSlot') {
            if (Date.parse(data.startsAt) <= Date.now())
                throw new ClubError('Choose a future lesson time.');
            const slotId = crypto.randomUUID();
            const result = await db.prepare('INSERT INTO slots (id,volunteer_id,starts_at,join_url) SELECT ?, id, ?, ? FROM volunteers WHERE id = ? AND active = 1 ON CONFLICT(volunteer_id, starts_at) DO NOTHING').bind(slotId, new Date(data.startsAt).toISOString(), data.joinUrl, data.volunteerId).run();
            if (!result.meta.changes)
                throw new ClubError('Choose an active volunteer and a time that is not already scheduled.');
            return json({
                ok: true, id: slotId
            });
        }
        if (data.action === 'deleteSlot') {
            const result = await db.prepare('DELETE FROM slots WHERE id = ? AND NOT EXISTS (SELECT 1 FROM bookings WHERE slot_id = slots.id)').bind(data.id).run();
            if (!result.meta.changes)
                throw new ClubError('Booked lessons cannot be removed, or this lesson no longer exists.', 409);
            return json({
                ok: true
            });
        }
        throw new ClubError('Unknown action.');
    }
    catch (error) {
        return failure(error);
    }
}

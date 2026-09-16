import { env } from 'cloudflare:workers';
export class ClubError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
    }
}
export function database() {
    const db = (env as unknown as {
        DB?: D1Database;
    }).DB;
    if (!db)
        throw new ClubError('The club database is not configured yet. Please try again later.', 503);
    return db;
}
export function adminHash() {
    return (env as unknown as {
        ADMIN_PASSWORD_HASH?: string;
    }).ADMIN_PASSWORD_HASH;
}
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer) {
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function digest(value: string) {
    return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function passwordHash(password: string, salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const saltBytes = Uint8Array.from(salt.match(/.{2}/g) || [], x => parseInt(x, 16));
    return `${salt}:${hex(await crypto.subtle.deriveBits({
        name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256'
    }, key, 256))}`;
}
export async function verifyPassword(password: string, stored: string) {
    const [salt, expected] = stored.split(':');
    if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64}$/.test(expected || ''))
        return false;
    const calculated = (await passwordHash(password, salt)).split(':')[1];
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++)
        mismatch |= expected.charCodeAt(i) ^ calculated.charCodeAt(i);
    return mismatch === 0;
}
export type User = {
    id: string;
    name: string;
    role: 'admin' | 'volunteer';
};
export function sessionToken(request: Request) {
    return /(?:^|;\s*)club_session=([^;]*)/.exec(request.headers.get('cookie') || '')?.[1];
}
export async function userFor(request: Request, db: D1Database): Promise<User | null> {
    const token = sessionToken(request);
    if (!token)
        return null;
    const session = await db.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token), Date.now()).first<{
        user_id: string;
    }>();
    if (!session)
        return null;
    if (session.user_id === 'admin')
        return {
            id: 'admin', name: 'Math Leader', role: 'admin'
        };
    const volunteer = await db.prepare('SELECT id, name FROM volunteers WHERE id = ? AND active = 1').bind(session.user_id).first<{
        id: string;
        name: string;
    }>();
    return volunteer ? {
        ...volunteer, role: 'volunteer'
    } : null;
}
export function cookie(request: Request, token: string, maxAge: number) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
    return `club_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local ? '' : '; Secure'}`;
}
export async function rateLimit(db: D1Database, request: Request, kind: string, max: number, interval: number) {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const key = await digest(`${kind}:${ip}`);
    const now = Date.now();
    const result = await db.prepare('INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END RETURNING count').bind(key, now + interval, now, now, now + interval).first<{
        count: number;
    }>();
    if (result && result.count > max)
        throw new ClubError('Too many attempts. Please try again later.', 429);
}

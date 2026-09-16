"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Clock3, GraduationCap, HeartHandshake, Lightbulb, LogOut, Plus, ShieldCheck, Sigma, Trophy, Users, Video, X } from "lucide-react";
type User = {
    id: string;
    name: string;
    role: string;
    username?: string;
    active?: boolean | number;
};
type Volunteer = User & {
    subjects: string[] | string;
    bio: string;
};
type Slot = {
    id: string;
    volunteerId: string;
    startsAt: string;
    joinUrl?: string;
    bookingId?: string | null;
};
type Post = {
    id: string;
    type: "meeting" | "competition" | "problem";
    title: string;
    body: string;
    date: string;
    answer?: string;
};
type Booking = {
    id: string;
    studentName: string;
    email: string;
    grade: string;
    subject: string;
    startsAt: string;
    volunteerName: string;
    joinUrl: string;
};
type Club = {
    user: User | null;
    volunteers: Volunteer[];
    slots: Slot[];
    posts: Post[];
    bookings: Booking[];
    users?: Volunteer[];
    allSlots?: Slot[];
};
const empty: Club = { user: null, volunteers: [], slots: [], posts: [], bookings: [] };
const when = (value: string) => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const subjects = ["Fractions & decimals", "Ratios & proportions", "Pre-algebra", "Algebra", "Geometry", "Statistics & probability", "Homework help"];
function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty"><CalendarDays size={25}/><p>{children}</p></div>; }
export default function Home() {
    const [tab, setTab] = useState("hub"), [data, setData] = useState<Club>(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [tutor, setTutor] = useState(""), [receipt, setReceipt] = useState<Booking | null>(null), [answer, setAnswer] = useState(false), [editor, setEditor] = useState<Post | null>(null), [filter, setFilter] = useState("all");
    async function refresh() { const r = await fetch("/api/club"); const d = await r.json() as Club & {
        error?: string;
    }; if (!r.ok)
        throw new Error(d.error || "Unable to load the club. Please try again."); setData({ ...empty, ...d }); }
    useEffect(() => {
        const controller = new AbortController();
        async function loadClub() {
            try {
                const response = await fetch("/api/club", { signal: controller.signal });
                const club = await response.json() as Club & { error?: string };
                if (!response.ok)
                    throw new Error(club.error || "Unable to load the club. Please try again.");
                setData({ ...empty, ...club });
            }
            catch (loadError) {
                if (!controller.signal.aborted)
                    setError(loadError instanceof Error ? loadError.message : "Unable to load the club. Please try again.");
            }
            finally {
                if (!controller.signal.aborted)
                    setLoading(false);
            }
        }
        void loadClub();
        return () => controller.abort();
    }, []);
    useEffect(() => { const controller = new AbortController(); const mc = (document as Document & {
        modelContext?: {
            registerTool: (t: unknown, options: {
                signal: AbortSignal;
            }) => void | Promise<void>;
        };
    }).modelContext; if (mc) {
        try {
            Promise.resolve(mc.registerTool({ name: "start_tutoring_request", description: "Open the NHRHS Math Club tutor booking form. Optionally select an available volunteer by their ID.", inputSchema: { type: "object", properties: { volunteerId: { type: "string" } }, additionalProperties: false }, execute: async (input: unknown) => { if (controller.signal.aborted)
                    return { error: "Page closed" }; if (!input || typeof input !== "object")
                    return { error: "Expected an object" }; const { volunteerId } = input as {
                    volunteerId?: unknown;
                }; if (volunteerId !== undefined && (typeof volunteerId !== "string" || !data.volunteers.some(v => v.id === volunteerId)))
                    return { error: "Choose a valid available volunteer ID" }; setTab("tutors"); if (typeof volunteerId === "string")
                    setTutor(volunteerId); return { content: [{ type: "text", text: "Tutoring form opened. The student must enter their details and confirm the booking." }] }; } }, { signal: controller.signal })).catch(() => { });
        }
        catch { /* Optional browser capability; normal navigation remains available. */ }
    } return () => controller.abort(); }, [data.volunteers]);
    function navigate(next: string) { setTab(next); setError(""); setNotice(""); setReceipt(null); }
    async function action(payload: Record<string, unknown>, success?: string) { setBusy(true); setError(""); setNotice(""); try {
        const r = await fetch("/api/club", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = await r.json() as {
            ok?: boolean;
            error?: string;
            booking?: Booking;
        };
        if (!r.ok || result.error)
            throw new Error(result.error || "Something went wrong. Please try again.");
        await refresh();
        if (success)
            setNotice(success);
        return result;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Please try again.");
        return null;
    }
    finally {
        setBusy(false);
    } }
    async function submit(e: FormEvent<HTMLFormElement>, name: string, extra: Record<string, unknown> = {}, success?: string) { e.preventDefault(); const form = e.currentTarget; const values: Record<string, unknown> = Object.fromEntries(new FormData(form)); if (name === "createSlot")
        values.startsAt = new Date(values.startsAt as string).toISOString(); if (name === "createVolunteer")
        values.subjects = (values.subjects as string).split(",").map(s => s.trim()).filter(Boolean); const result = await action({ action: name, ...values, ...extra }, success); if (result) {
        if (name === "book" && result.booking)
            setReceipt(result.booking);
        if (name !== "login")
            form.reset();
        if (name === "savePost")
            setEditor(null);
    } return result; }
    const today = new Date().toLocaleDateString("en-CA");
    const events = data.posts.filter(p => p.type !== "problem" && (!p.date || p.date.slice(0, 10) >= today) && (filter === "all" || p.type === filter));
    const problem = data.posts.filter(p => p.type === "problem" && (!p.date || p.date.slice(0, 10) <= today)).sort((a, b) => b.date.localeCompare(a.date))[0];
    const isAdmin = data.user?.role === "admin";
    return <div className="site-shell">
  <header className="site-header"><button className="brand" onClick={() => navigate("hub")} aria-label="NHRHS Math Club home"><span className="brand-mark"><Sigma size={26}/></span><span>NHRHS <b>Math Club</b><small>NORTHERN HIGHLANDS REGIONAL HIGH SCHOOL</small></span></button><nav aria-label="Main navigation">{[["hub", "Club hub"], ["tutors", "Find a tutor"], ["volunteer", "Volunteer portal"]].map(([id, label]) => <button key={id} className={tab === id ? "nav-active" : ""} onClick={() => navigate(id)}>{label}</button>)}</nav><button className="admin-nav" onClick={() => navigate("admin")}><ShieldCheck size={16}/>{isAdmin ? "Dashboard" : "Admin sign in"}<ArrowUpRight size={15}/></button></header>
  <main>
  {error && <div className="banner error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={17}/></button></div>}{notice && <div className="banner success" role="status"><Check size={18}/>{notice}</div>}
  {tab === "hub" && <>
   <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="tiny-dot"/> THE NHRHS MATH COMMUNITY</span><h1>Great minds.<br />Even better <em>together.</em></h1><p>A place to ask questions, tackle challenges, and help each other grow. There’s a place for you in the equation.</p><div className="hero-actions"><button className="primary" onClick={() => navigate("tutors")}>Find your math tutor <ArrowUpRight size={18}/></button><a className="text-link" href="#club-board">Explore the club <ArrowRight size={17}/></a></div><div className="hero-caption"><span className="mini-icon"><Users size={17}/></span> Student-led. Curiosity-driven. Open to possibility.</div></div><div className="math-art" aria-label="Geometric illustration of a circle and a parabola"><div className="art-grid"/><span className="art-label">A LITTLE CURIOSITY GOES A LONG WAY.</span><span className="formula formula-one">x² + y² = r²</span><span className="formula formula-two">∞ possibilities</span><svg viewBox="0 0 430 290" role="img" aria-label="Coordinate geometry"><line x1="20" y1="210" x2="411" y2="210"/><line x1="205" y1="25" x2="205" y2="276"/><circle cx="205" cy="144" r="98"/><path d="M 57 50 Q 205 376 352 50"/><path className="triangle" d="M 205 46 L 292 189 L 118 189 Z"/><circle className="point" cx="205" cy="46" r="5"/><circle className="point" cx="292" cy="189" r="5"/><circle className="point" cx="118" cy="189" r="5"/></svg><span className="art-bottom">THINK BIG. START WITH WHY.<ArrowUpRight size={18}/></span></div></section>
   <section className="path-strip" aria-label="Club opportunities"><button onClick={() => document.getElementById("club-board")?.scrollIntoView({ behavior: "smooth" })}><span className="path-icon"><Trophy size={22}/></span><span><b>Challenge yourself</b><small>Competitions & club meetings</small></span><ArrowUpRight size={19}/></button><button onClick={() => navigate("tutors")}><span className="path-icon"><BookOpen size={22}/></span><span><b>A little help. A big difference.</b><small>Free tutoring for grades 6–8</small></span><ArrowUpRight size={19}/></button><button onClick={() => navigate("volunteer")}><span className="path-icon"><HeartHandshake size={22}/></span><span><b>Pass your knowledge on</b><small>Your volunteer lesson hub</small></span><ArrowUpRight size={19}/></button></section>
   <section className="board" id="club-board"><div className="section-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h2>Your club, at a glance.</h2></div><span className="quiet-pill"><span className="tiny-dot"/> THE CLUB BOARD</span></div><div className="board-grid"><div className="events-panel"><div className="panel-heading"><h3><CalendarDays size={19}/> Coming up next</h3><span>{events.length} {events.length === 1 ? "event" : "events"}</span></div><div className="filters">{[["all", "All events"], ["meeting", "Meetings"], ["competition", "Competitions"]].map(([id, label]) => <button key={id} className={filter === id ? "selected" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div>{loading ? <Empty>Loading the club board…</Empty> : events.length ? events.map(p => <article className="event" key={p.id}><div className="date-block">{p.date ? <><span>{new Date(p.date + (!p.date.includes("T") ? "T12:00:00" : "")).toLocaleDateString(undefined, { month: "short" })}</span><b>{new Date(p.date + (!p.date.includes("T") ? "T12:00:00" : "")).getDate()}</b></> : <CalendarDays />}</div><div><span className="tag">{p.type}</span><h4>{p.title}</h4><p>{p.body}</p></div></article>) : <Empty>Good things are on the way.<br />Meeting and competition dates will appear here when your club leader posts them.</Empty>}</div><article className="problem-card"><div className="problem-top"><span><Lightbulb size={17}/> {problem ? "PROBLEM OF THE DAY" : "A LITTLE BRAIN WARM-UP"}</span><span className="practice-tag">{problem ? "Club challenge" : "Practice"}</span></div><h3>{problem?.title || "Think outside the square."}</h3><p>{problem?.body || "A rectangle has a perimeter of 30 units. Its length is twice its width. What is its area?"}</p>{!problem && <div className="problem-figure"><div><span>2x</span><b>x</b></div></div>}<button className="answer-button" onClick={() => setAnswer(!answer)}>{answer ? "Hide solution" : "Give it a try. Then check."}<ChevronRight size={17}/></button>{answer && <div className="solution">{problem?.answer || (!problem ? "2(2x + x) = 30, so x = 5. The length is 10 and the area is 10 × 5 = 50 square units." : "Your club leader has not posted a solution yet.")}</div>}</article></div></section>
   <section className="tutor-callout"><div className="callout-icon"><GraduationCap size={31}/></div><div><span className="eyebrow">FOR OUR MIDDLE SCHOOL COMMUNITY</span><h2>Big questions deserve a helping hand.</h2><p>Connect with a high school volunteer for free, one-on-one math support.</p></div><button className="primary" onClick={() => navigate("tutors")}>Meet your tutor <ArrowUpRight size={18}/></button></section>
  </>}
  {tab === "tutors" && <><div className="page-intro"><span className="eyebrow">FREE PEER TUTORING · GRADES 6–8</span><h1>A fresh perspective.<br /><em>A little more confidence.</em></h1><p>Choose a volunteer, pick a time, and bring your questions. We’ll work through them together.</p></div><div className="workspace-grid"><section><div className="section-heading"><h2>Find your person.</h2><span className="muted">{data.volunteers.length} volunteers</span></div>{data.volunteers.length ? <div className="tutor-grid">{data.volunteers.map((v, i) => <button className={`tutor-card ${tutor === v.id ? "chosen" : ""}`} key={v.id} onClick={() => { setTutor(v.id); setReceipt(null); }}><div className="tutor-card-top"><span className={`avatar avatar-${i % 3}`}>{v.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><span className="selection-dot">{tutor === v.id && <Check size={14}/>}</span></div><h3>{v.name}</h3><span className="muted">NHRHS peer volunteer</span><p>{v.bio || "Let’s build your math confidence, one question at a time."}</p><div className="tags">{(Array.isArray(v.subjects) ? v.subjects : v.subjects.split(",")).map(s => <span key={s}>{s}</span>)}</div><div className="tutor-bottom">{data.slots.filter(s => s.volunteerId === v.id).length} available times <ArrowUpRight size={17}/></div></button>)}</div> : <Empty>{loading ? "Loading volunteers…" : "Our tutoring roster is getting ready. Check back for volunteers and available lesson times."}</Empty>}<div className="help-note"><ShieldCheck size={21}/><p><b>A thoughtful space to learn.</b><br />Your contact details are only shared with your tutor and club administrators. Use a parent-approved email address.</p></div></section><aside className="form-panel booking-panel"><span className="eyebrow">YOUR NEXT STEP</span><h2>Let’s make it click.</h2>{receipt ? <div className="receipt"><span className="receipt-check"><Check size={28}/></span><h3>You’re on the calendar!</h3><p>Your lesson with {receipt.volunteerName} is scheduled for <b>{when(receipt.startsAt)}</b>.</p><p>Save this lesson link now. An email confirmation is not sent.</p><a className="primary" href={receipt.joinUrl} target="_blank" rel="noreferrer">Open lesson link <Video size={17}/></a><button className="secondary" onClick={() => setReceipt(null)}>Book another lesson</button></div> : <form onSubmit={e => submit(e, "book")}><Field label="01 / Your volunteer"><select required value={tutor} onChange={e => setTutor(e.target.value)}><option value="">Choose a volunteer</option>{data.volunteers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field><Field label="02 / Lesson time"><select name="slotId" required key={tutor} defaultValue=""><option value="">{tutor ? "Choose an available time" : "Select a volunteer first"}</option>{data.slots.filter(s => s.volunteerId === tutor).map(s => <option key={s.id} value={s.id}>{when(s.startsAt)}</option>)}</select></Field>{tutor && !data.slots.some(s => s.volunteerId === tutor) && <p className="muted">This volunteer has no open times yet.</p>}<div className="form-row"><Field label="03 / Grade"><select name="grade" required defaultValue=""><option value="">Your grade</option>{[6, 7, 8].map(g => <option key={g} value={g}>Grade {g}</option>)}</select></Field><Field label="04 / Subject"><select name="subject" required defaultValue=""><option value="">What’s on your mind?</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></Field></div><Field label="Student name"><input name="studentName" placeholder="First and last name" autoComplete="name" required maxLength={100}/></Field><Field label="Contact email"><input name="email" placeholder="you@example.com" type="email" autoComplete="email" required/></Field><p className="form-footnote"><Clock3 size={14}/> Times are shown in your device’s local time zone.</p><button className="primary full" disabled={busy || !tutor || !data.slots.some(s => s.volunteerId === tutor)}>{busy ? "Booking your lesson…" : "Book a free lesson"}<ArrowRight size={17}/></button></form>}</aside></div></>}
  {(tab === "admin" || tab === "volunteer") && <><div className="page-intro"><span className="eyebrow">{tab === "admin" ? "CLUB LEADERSHIP" : "GIVE A LITTLE. MAKE A DIFFERENCE."}</span><h1>{tab === "admin" ? "Behind the good things." : "Your time. Their next aha."}</h1><p>{tab === "admin" ? "Keep the club connected. Manage announcements, volunteers, and lesson times." : "Your students, your schedule, and every lesson link in one place."}</p></div>{!data.user ? <div className="login-layout"><div className="login-message"><span className="large-symbol">{tab === "admin" ? <ShieldCheck size={42}/> : <HeartHandshake size={42}/>}</span><h2>{tab === "admin" ? "A well-run club starts here." : "Welcome back, difference-maker."}</h2><p>{tab === "admin" ? "Sign in with your club leadership account to update the board and manage the tutoring program." : "Volunteer accounts are created by the club administrator. Ask your club leader for your sign-in details."}</p><div className="login-perks"><span><Check size={16}/> One place for every lesson</span><span><Check size={16}/> More time for meaningful math</span></div></div><section className="form-panel login-form"><h2>{tab === "admin" ? "Admin sign in" : "Volunteer sign in"}</h2><p className="muted">Good to see you again.</p><form onSubmit={e => submit(e, "login")}><Field label="Username"><input name="username" autoComplete="username" required placeholder="Your username"/></Field><Field label={tab === "admin" ? "Access code" : "Password"}><input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password"/></Field><button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={17}/></button></form></section></div> : <><div className="account-bar"><span><span className="online-dot"/> Signed in as <b>{data.user.name}</b> · {data.user.role}</span><button className="text-link" disabled={busy} onClick={() => action({ action: "logout" })}>Sign out <LogOut size={16}/></button></div>{tab === "admin" && !isAdmin ? <Empty>This area is for club administrators. Your lessons are in the Volunteer portal.</Empty> : <>{tab === "admin" && <div className="admin-grid"><section className="form-panel"><h2><BookOpen size={21}/> {editor ? "Edit club update" : "Publish a club update"}</h2><form key={editor?.id || "new"} onSubmit={e => submit(e, "savePost", editor ? { id: editor.id } : {}, "Club board updated.")}><Field label="Update type"><select name="type" defaultValue={editor?.type || "meeting"}><option value="meeting">Meeting</option><option value="competition">Competition</option><option value="problem">Problem of the day</option></select></Field><Field label="Title"><input name="title" required defaultValue={editor?.title} maxLength={150}/></Field><Field label="Details / problem"><textarea name="body" required defaultValue={editor?.body} rows={3}/></Field><Field label="Date"><input name="date" type="date" defaultValue={editor?.date?.slice(0, 10)}/></Field><Field label="Solution (for math problems)"><textarea name="answer" defaultValue={editor?.answer} rows={2}/></Field><div className="inline-actions"><button className="primary" disabled={busy}>{editor ? "Save changes" : "Publish update"}<Plus size={16}/></button>{editor && <button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button>}</div></form><div className="management-list">{data.posts.map(p => <div key={p.id}><span><small>{p.type}</small><b>{p.title}</b></span><button onClick={() => setEditor(p)}>Edit</button><button className="danger" disabled={busy} onClick={() => action({ action: "deletePost", id: p.id }, "Update removed.")}>Delete</button></div>)}</div></section><section className="form-panel"><h2><Users size={21}/> Add a volunteer</h2><form onSubmit={e => submit(e, "createVolunteer", {}, "Volunteer account created. Share their credentials privately.")}><Field label="Full name"><input name="name" required maxLength={100}/></Field><div className="form-row"><Field label="Username"><input name="username" autoComplete="off" required/></Field><Field label="Initial password"><input name="password" type="password" autoComplete="new-password" minLength={8} required/></Field></div><Field label="Subjects (separate with commas)"><input name="subjects" placeholder="Algebra, Geometry, Pre-algebra" required/></Field><Field label="Short introduction"><textarea name="bio" rows={3} required/></Field><button className="primary" disabled={busy}>Create volunteer <Plus size={16}/></button></form><div className="management-list">{(data.users || data.volunteers).filter(v => v.role !== "admin").map(v => <div key={v.id}><span><b>{v.name}</b><small>{!v.active ? "Inactive" : "Volunteer"}</small></span>{!!v.active && <button className="danger" disabled={busy} onClick={() => action({ action: "deactivateVolunteer", id: v.id }, "Volunteer deactivated.")}>Deactivate</button>}</div>)}</div></section><section className="form-panel"><h2><CalendarDays size={21}/> Add a lesson time</h2><form onSubmit={e => submit(e, "createSlot", {}, "Lesson time added.")}><Field label="Volunteer"><select name="volunteerId" required defaultValue=""><option value="">Choose a volunteer</option>{data.volunteers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field><Field label="Date and time (your local time)"><input name="startsAt" type="datetime-local" required/></Field><Field label="Video lesson link"><input name="joinUrl" type="url" placeholder="https://meet.google.com/…" pattern="https://.*" required/></Field><button className="primary" disabled={busy}>Add available time <Plus size={16}/></button></form><div className="management-list">{(data.allSlots || data.slots).map(s => <div key={s.id}><span><b>{(data.users || data.volunteers).find(v => v.id === s.volunteerId)?.name || "Volunteer"}</b><small>{when(s.startsAt)}</small></span><button className="danger" disabled={busy || !!s.bookingId} onClick={() => action({ action: "deleteSlot", id: s.id }, "Time removed.")}>{s.bookingId ? "Booked" : "Remove"}</button></div>)}</div></section></div>}<section className="lessons"><div className="section-heading"><h2>{isAdmin ? "Scheduled lessons" : "Your scheduled lessons"}</h2><span className="quiet-pill"><Video size={14}/> {data.bookings.length} lessons</span></div>{data.bookings.length ? <div className="lesson-grid">{data.bookings.map(b => <article className="lesson-card" key={b.id}><span className="tag">Grade {b.grade} · {b.subject}</span><h3>{b.studentName}</h3><p><CalendarDays size={16}/>{when(b.startsAt)}</p><p><Users size={16}/>{b.volunteerName}</p><a className="student-email" href={`mailto:${b.email}`}>{b.email}</a><a className="primary" href={b.joinUrl} target="_blank" rel="noreferrer">Join lesson <Video size={16}/></a></article>)}</div> : <Empty>No lessons scheduled yet. Bookings will appear here when students reserve a time.</Empty>}</section></>}</>}</>}
  </main><footer><div className="footer-brand"><Sigma size={20}/><b>NHRHS Math Club</b><span>A community that adds up.</span></div><p>Made for curious minds. <span>Powered by each other.</span></p><button onClick={() => navigate("admin")}>Club leadership <ArrowUpRight size={13}/></button></footer>
 </div>;
}

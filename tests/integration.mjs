import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const base = new URL(process.env.TEST_BASE_URL || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  || !["http:", "https:"].includes(base.protocol)
  || base.username || base.password) {
  throw new Error("Integration tests modify data and only permit literal loopback targets.");
}
const adminPassword = process.env.ADMIN_TEST_PASSWORD;
assert.ok(adminPassword, "Set ADMIN_TEST_PASSWORD to the local administrator code.");
const marker = `test_${Date.now()}_${randomBytes(3).toString("hex")}`;
const volunteerPassword = randomBytes(16).toString("hex");
let assertions = 0;

function client() {
  let cookie = "";
  return async (path, { method = "GET", body } = {}) => {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: "error",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: base.origin,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`${method} ${path} returned non-JSON (${response.status}): ${raw.slice(0, 200)}`); }
    return { status: response.status, data };
  };
}

function expectStatus(result, expected, label) {
  assert.ok([expected].flat().includes(result.status), `${label}: expected ${expected}, got ${result.status}: ${JSON.stringify(result.data)}`);
  assertions++;
  console.log(`PASS ${label}`);
  return result.data;
}

const admin = client();
const anonymous = client();
const tutor = client();
const otherTutor = client();
const post = (request, action, fields = {}) => request("/api/club", { method: "POST", body: { action, ...fields } });
const read = async (request) => expectStatus(await request("/api/club"), 200, "read club data");
const volunteerIds = [];
let slotId;
let postId;
let bookingId;
const extraSlots = [];

try {
  expectStatus(await post(anonymous, "savePost", { type: "meeting", title: marker, body: "unauthorized", date: "" }), [401, 403], "anonymous cannot edit bulletin");
  expectStatus(await post(anonymous, "createVolunteer", { username: marker, password: volunteerPassword, name: marker, bio: "", subjects: ["Algebra"] }), [401, 403], "anonymous cannot create volunteer");
  expectStatus(await post(admin, "login", { username: "mathLeader", password: adminPassword }), 200, "administrator login");
  const crossOrigin = await fetch(new URL('/api/club', base), {method:'POST', redirect:'error', headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({action:'logout'})});
  assert.equal(crossOrigin.status, 403, 'Cross-origin mutations are rejected');

  for (const suffix of ["a", "b"]) {
    expectStatus(await post(admin, "createVolunteer", {
      username: `${marker}_${suffix}`, password: volunteerPassword,
      name: `${marker}_${suffix}`, bio: "Local integration test", subjects: ["Fractions", "Algebra"],
    }), [200, 201], `create volunteer ${suffix}`);
    const state = await read(admin);
    const created = state.users.find((u) => u.name === `${marker}_${suffix}`);
    assert.ok(created, "Created account persists in subsequent GET");
    volunteerIds.push(created.id);
  }

  const startsAt = new Date(Date.now() + 7 * 86400000).toISOString();
  expectStatus(await post(admin, "createSlot", { volunteerId: volunteerIds[0], startsAt, joinUrl: "https://example.com/local-test-lesson" }), [200, 201], "create future lesson");
  slotId = (await read(admin)).allSlots.find((s) => s.volunteerId === volunteerIds[0] && s.startsAt === startsAt)?.id;
  assert.ok(slotId, "New lesson persists");
  expectStatus(await post(admin, 'createSlot', {volunteerId:volunteerIds[0],startsAt,joinUrl:'https://example.com/local-test-lesson'}), [400,409], 'duplicate volunteer time rejected');
  expectStatus(await post(admin, 'createSlot', {volunteerId:volunteerIds[0],startsAt:new Date(0).toISOString(),joinUrl:'https://example.com/lesson'}), 400, 'past lesson rejected');
  expectStatus(await post(admin, 'createSlot', {volunteerId:volunteerIds[0],startsAt,joinUrl:'http://example.com/lesson'}), 400, 'insecure lesson link rejected');
  const publicBefore = await read(anonymous);
  assert.ok(publicBefore.slots.some((s) => s.id === slotId), "Future lesson is available publicly");
  assert.ok(!JSON.stringify(publicBefore).includes("local-test-lesson"), "Public data hides lesson join URLs");

  const fields = { slotId, studentName: `${marker}_student`, email: `${marker}@example.com`, grade: "7", subject: "Ratios and proportions" };
  expectStatus(await post(anonymous, 'book', {...fields,grade:'9'}), 400, 'grade outside 6–8 rejected');
  const booked = expectStatus(await post(anonymous, "book", fields), [200, 201], "student books lesson");
  bookingId = booked.booking?.id;
  assert.ok(bookingId, "Booking confirmation includes ID");
  expectStatus(await post(anonymous, "book", fields), [400, 409], "duplicate lesson booking rejected");
  expectStatus(await post(admin, 'deleteSlot', {id:slotId}), 409, 'booked lesson cannot be removed');
  const raceSlot = expectStatus(await post(admin, 'createSlot', {volunteerId:volunteerIds[0],startsAt:new Date(Date.parse(startsAt)+3600000).toISOString(),joinUrl:'https://example.com/local-test-race'}), 200, 'create race test lesson').id;
  extraSlots.push(raceSlot);
  const race = await Promise.all([post(client(),'book',{...fields,slotId:raceSlot}),post(client(),'book',{...fields,slotId:raceSlot})]);
  assert.deepEqual(race.map(r=>r.status).sort(), [200,409], 'Exactly one concurrent booking wins');
  console.log('PASS concurrent bookings reserve only one place');
  const inactiveSlot = expectStatus(await post(admin, 'createSlot', {volunteerId:volunteerIds[0],startsAt:new Date(Date.parse(startsAt)+7200000).toISOString(),joinUrl:'https://example.com/local-test-inactive'}), 200, 'create later lesson').id;
  extraSlots.push(inactiveSlot);
  const publicAfter = await read(anonymous);
  assert.ok(!JSON.stringify(publicAfter).includes(fields.email), "Student email is not public");
  assert.ok(!publicAfter.slots.some((s) => s.id === slotId), "Booked lesson no longer appears available");

  expectStatus(await post(tutor, "login", { username: `${marker}_a`, password: volunteerPassword }), 200, "assigned volunteer login");
  expectStatus(await post(otherTutor, "login", { username: `${marker}_b`, password: volunteerPassword }), 200, "other volunteer login");
  const own = await read(tutor);
  assert.ok(own.bookings.some((b) => b.id === bookingId && b.email === fields.email && b.joinUrl === "https://example.com/local-test-lesson"), "Assigned volunteer sees booking and join link");
  const unrelated = await read(otherTutor);
  assert.ok(!unrelated.bookings.some((b) => b.id === bookingId), "Other volunteer cannot see assigned booking");
  expectStatus(await post(tutor, "createVolunteer", { username: `${marker}_forbidden`, password: volunteerPassword, name: marker, bio: "", subjects: ["Algebra"] }), [401, 403], "volunteer cannot create accounts");

  expectStatus(await post(admin, "savePost", { type: "problem", title: marker, body: "What is 6 × 7?", date: "2026-10-01", answer: "42" }), [200, 201], "create bulletin problem");
  postId = (await read(admin)).posts.find((p) => p.title === marker)?.id;
  assert.ok(postId, "Created post persists");
  expectStatus(await post(admin, "savePost", { id: postId, type: "problem", title: `${marker}_edited`, body: "What is 7 × 6?", date: "2026-10-02", answer: "42" }), [200, 201], "edit bulletin problem");
  assert.ok((await read(anonymous)).posts.some((p) => p.id === postId && p.title === `${marker}_edited`), "Edited post persists publicly");
  expectStatus(await post(admin, "deletePost", { id: postId }), 200, "delete bulletin problem");
  assert.ok(!(await read(anonymous)).posts.some((p) => p.id === postId), "Deleted post stays deleted");
  postId = undefined;

  expectStatus(await post(admin, "deactivateVolunteer", { id: volunteerIds[0] }), 200, "deactivate volunteer");
  const revoked = await read(tutor);
  assert.ok(!(await read(anonymous)).slots.some(s=>s.id===inactiveSlot), 'Inactive tutor time disappears');
  expectStatus(await post(anonymous,'book',{...fields,slotId:inactiveSlot}),409,'stale inactive lesson cannot be booked');
  assert.ok(!revoked.user && !(revoked.bookings || []).length, "Existing volunteer session loses access immediately");
  expectStatus(await post(client(), "login", { username: `${marker}_a`, password: volunteerPassword }), [401, 403], "deactivated account cannot sign in");
  console.log(`PASS all workflow assertions (${assertions} successful response checks)`);
} finally {
  if (postId) await post(admin, "deletePost", { id: postId });
  if (slotId) {
    const result = await post(admin, "deleteSlot", { id: slotId });
    console.log(`Local lesson cleanup status: ${result.status}`);
  }
  for (const id of extraSlots) await post(admin, 'deleteSlot', {id});
  for (const id of volunteerIds) await post(admin, "deactivateVolunteer", { id });
  await post(admin, "logout");
  console.log(`Local-only test marker: ${marker}. Accounts are deactivated; booking records may remain for history (booking ${bookingId || "not created"}).`);
}


import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const volunteers = sqliteTable('volunteers', {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    bio: text('bio').notNull(),
    subjects: text('subjects').notNull(),
    active: integer('active').notNull().default(1),
});
export const sessions = sqliteTable('sessions', {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id').notNull(),
    expiresAt: integer('expires_at').notNull()
}, table => [index('sessions_user_idx').on(table.userId)]);
export const slots = sqliteTable('slots', {
    id: text('id').primaryKey(),
    volunteerId: text('volunteer_id').notNull().references(() => volunteers.id),
    startsAt: text('starts_at').notNull(),
    joinUrl: text('join_url').notNull()
}, table => [uniqueIndex('slots_volunteer_time_idx').on(table.volunteerId, table.startsAt)]);
export const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    slotId: text('slot_id').notNull().unique().references(() => slots.id),
    studentName: text('student_name').notNull(),
    email: text('email').notNull(),
    grade: text('grade').notNull(),
    subject: text('subject').notNull()
});
export const posts = sqliteTable('posts', {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    date: text('date').notNull(),
    answer: text('answer').notNull().default('')
});
export const rateLimits = sqliteTable('rate_limits', {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: integer('expires_at').notNull()
});


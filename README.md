# NHRHS Math Club

A responsive club website with a member bulletin and free peer tutoring for grades 6–8. Built with React, TypeScript, Vinext/Vite, and Cloudflare D1.

## What the site does

- Students choose a volunteer and an available lesson, then enter their name, email, grade, and math topic.
- Volunteers sign in to see their own scheduled students and open lesson links.
- The administrator signs in as `mathLeader`, manages volunteer accounts and availability, and publishes competition dates, meetings, and problems of the day.
- Server-side sessions and authorization protect account management and student booking details. Data lives in D1 rather than browser storage.

Email addresses are collected for coordination; the application does **not** send confirmation emails or reminders. Lessons use an external meeting URL supplied through the administrator interface; video calling is not built into this project.

## Local development

Use Node.js 22.13 or newer. Install the locked dependencies with `npm ci`, apply the local database migration with `npm run db:migrate:local`, then start the private local preview with `npm run dev`. The default address is `http://localhost:5173`.

Configure the administrator credential locally before signing in. The requested access code is deliberately absent from tracked source files; secrets and local databases must not be committed. See the credential configuration below.

`npm run build` creates the production output. `npm run start` serves that output using the local Cloudflare runtime. `npm run lint` checks source formatting and rules.

### Administrator credential

1. Run `node scripts/hash-password.mjs` and enter the chosen administrator code. The terminal input is visible.
2. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD_HASH` to the generated value. Keep `.env` private.
3. Restart the development server and sign in with username `mathLeader` and the code you chose.

The stored value has the form `salt:hash`: a 16-byte random salt encoded as hexadecimal, followed by a 32-byte PBKDF2-SHA256 hash encoded as hexadecimal, using 100,000 iterations. The password itself is never stored in the repository. Production must receive `ADMIN_PASSWORD_HASH` through its hosting secret configuration.

### Integration checks

With the local server running, set `ADMIN_TEST_PASSWORD` in your terminal environment to the locally configured administrator code, then run `node tests/integration.mjs`. Optionally set `TEST_BASE_URL` to another local port. The script refuses nonloopback hosts and redirects, uses uniquely named test records, and checks booking conflicts, authorization, volunteer isolation, account deactivation, and bulletin edits.

The test deactivates its two volunteer accounts and deletes its bulletin post. Booked lessons cannot be deleted through the API, so two test bookings and their lessons remain in the **local** database as history. The script prints a unique marker to identify its records. Avoid repeated runs within 15 minutes: local login requests share the application rate-limit bucket.

## Storage and deployment

The application requires a Cloudflare D1 binding named `DB`. Local D1 state is retained under the ignored `.wrangler/` directory; deleting local state deletes local accounts and bookings. A production deployment needs its own persistent D1 database and administrator secret. A GitHub commit by itself does not deploy a working database or site.

Review and apply the checked-in `drizzle/` database migration to the selected database before using the application. `npm run db:migrate:local` targets only local state; production needs a separate migration against its configured D1 database. Never run local integration tests against a production database. The integration script rejects nonlocal URLs.

## Design reference

The supplied `awesome-vibe-coding-main.zip` was reviewed as reference material. It contains a directory of development tools and resources, rather than a visual website template. Its embedded instructions were not treated as user commands, and dependencies were not downloaded from those instructions. The interface uses a custom school-club design.

## Repository and preview

Requested repository: [FuzzyAges14/Math-Club-Rando-Website](https://github.com/FuzzyAges14/Math-Club-Rando-Website).

The development preview is local/private. Publishing requires a configured hosting environment, a persistent database, and a separately provisioned administrator credential.

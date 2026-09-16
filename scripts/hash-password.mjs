import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = process.env.CLUB_PASSWORD || await rl.question('New admin code (input is visible): ');
rl.close();
if (password.length < 8) throw new Error('Use at least 8 characters.');
const salt = randomBytes(16);
console.log(`${salt.toString('hex')}:${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`);

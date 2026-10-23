import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:')) throw new Error('Set DATABASE_URL to a SQLite file in .env first.');
const name = url.slice(5).split('?')[0];
const file = path.isAbsolute(name) ? name : path.resolve('prisma', name);
if (fs.existsSync(file) && fs.statSync(file).size > 0) throw new Error('Database already exists. db:init only initializes empty databases; back up existing data and review migrations instead.');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.closeSync(fs.openSync(file, 'a'));
const cli = path.resolve('node_modules/prisma/build/index.js');
// Apply the migration history (not `db push`) so later schema changes can ship as ordinary migrations.
const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;

/**
 * .env.local の内容を env.js に書き出す（GitHub Pages / index 直開き用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localPath = path.join(root, '.env.local');
const outPath = path.join(root, 'env.js');

if (!fs.existsSync(localPath)) {
  console.error(`\n[エラー] .env.local がありません: ${localPath}\n`);
  process.exit(1);
}

const buf = fs.readFileSync(localPath);
let text = buf.toString('utf8');
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

const env = {};
for (const line of text.split(/\n/)) {
  const s = line.trim();
  if (!s || s.startsWith('#')) continue;
  const eq = s.indexOf('=');
  if (eq === -1) continue;
  env[s.slice(0, eq).trim()] = s.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}

const url = String(env.VITE_SUPABASE_URL || '').trim();
const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
if (!url || !key) {
  console.error('\n[エラー] .env.local に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY がありません。\n');
  process.exit(1);
}

const content =
  `export const VITE_SUPABASE_URL=${JSON.stringify(url)};\n` +
  `export const VITE_SUPABASE_ANON_KEY=${JSON.stringify(key)};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`\n  OK: env.js を作成しました\n  ${outPath}\n`);
console.log('  次: git add env.js → commit → push → GitHub Pages を有効化\n');

/**
 * 起動前チェック: .env.local の有無・形式を確認
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localPath = path.join(root, '.env.local');

function fail(msg) {
  console.error(`\n[エラー] ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  OK: ${msg}`);
}

if (!fs.existsSync(localPath)) {
  fail(
    `.env.local がありません。\n` +
      `  場所: ${localPath}\n` +
      `  .env.example をコピーして .env.local を作り、Supabase の URL と anon key を入れてください。`
  );
}

const buf = fs.readFileSync(localPath);
if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
  fail('.env.local が UTF-16 で保存されています。メモ帳で「UTF-8」にして保存し直してください。');
}

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

const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';

if (!url) fail('.env.local に VITE_SUPABASE_URL=... がありません（行頭にスペースを入れない）');
if (!key) fail('.env.local に VITE_SUPABASE_ANON_KEY=... がありません');
if (!url.includes('supabase.co')) {
  console.warn('  注意: URL が supabase.co を含みません。Dashboard の Project URL をコピーしましたか？');
}
if (url.includes('YOUR_PROJECT') || key.includes('your-anon')) {
  fail('.env.local がサンプルのままです。Supabase Dashboard の実際の値に置き換えてください。');
}

console.log(`\n環境チェック（フォルダ: ${root}）`);
ok(`VITE_SUPABASE_URL（${url.length} 文字）`);
ok(`VITE_SUPABASE_ANON_KEY（${key.length} 文字）`);
console.log('');

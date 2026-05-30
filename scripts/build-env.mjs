/**
 * Netlify 等の静的ホスティング用: 環境変数から env.js を生成
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = String(process.env.VITE_SUPABASE_URL || '').trim();
const key = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!url || !key) {
  console.error(
    '\n[エラー] VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY が必要です。\n' +
      '  Netlify: Site configuration → Environment variables に追加してください。\n'
  );
  process.exit(1);
}

const content =
  `export const VITE_SUPABASE_URL=${JSON.stringify(url)};\n` +
  `export const VITE_SUPABASE_ANON_KEY=${JSON.stringify(key)};\n`;

fs.writeFileSync(path.join(root, 'env.js'), content, 'utf8');
console.log('  OK: env.js を生成しました');

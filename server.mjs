/**
 * .env または .env.local を読み、静的ファイルを配信
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5174);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le');
  }
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function parseEnv(filePath) {
  const env = {};
  const raw = readEnvFile(filePath);
  if (!raw) return env;
  for (const line of raw.split(/\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq === -1) continue;
    const k = s.slice(0, eq).trim();
    let v = s.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function loadEnv() {
  const base = path.join(__dirname, '.env');
  const local = path.join(__dirname, '.env.local');
  return { ...parseEnv(base), ...parseEnv(local) };
}

function safeResolve(root, reqPath) {
  const decoded = decodeURIComponent((reqPath || '/').split('?')[0]);
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '');
  const joined = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(path.join(root, joined));
  const rootResolved = path.resolve(root);
  if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) return null;
  return full;
}

function getSupabaseEnv() {
  const envVars = loadEnv();
  return {
    url: String(envVars.VITE_SUPABASE_URL ?? '').trim(),
    key: String(envVars.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  };
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function proxySupabase(req, res) {
  const { url: supabaseUrl } = getSupabaseEnv();
  if (!supabaseUrl) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Supabase URL not configured');
    return;
  }
  const reqUrl = req.url || '/';
  const subPath = reqUrl.replace(/^\/sb/, '') || '/';
  const targetUrl = supabaseUrl.replace(/\/$/, '') + subPath;
  try {
    const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readRequestBody(req);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (key === 'host' || key === 'connection' || key === 'content-length') continue;
      if (v !== undefined) headers[k] = v;
    }
    const upstream = await fetch(targetUrl, { method: req.method, headers, body });
    const outHeaders = {};
    upstream.headers.forEach((v, k) => {
      const key = k.toLowerCase();
      if (key === 'transfer-encoding') return;
      outHeaders[k] = v;
    });
    res.writeHead(upstream.status, outHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error('Supabase proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Proxy error: ${err.message}`);
  }
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/env.js') {
    const { url, key } = getSupabaseEnv();
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(
      `export const VITE_SUPABASE_URL=${JSON.stringify(url)};\n` +
        `export const VITE_SUPABASE_ANON_KEY=${JSON.stringify(key)};\n`
    );
    return;
  }

  if (urlPath === '/api/health') {
    const { url, key } = getSupabaseEnv();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        ok: !!(url && key),
        folder: __dirname,
        supabaseConfigured: !!(url && key),
      })
    );
    return;
  }

  if (urlPath.startsWith('/sb/') || urlPath === '/sb') {
    proxySupabase(req, res);
    return;
  }

  let filePath = safeResolve(__dirname, urlPath);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404).end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nポート ${PORT} が使用中です。別の窓で node を止めるか:\n  set PORT=5175\n  node server.mjs\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const { url, key } = getSupabaseEnv();
  console.log(`\nbrain-dump-app: http://127.0.0.1:${PORT}/\n`);
  console.log(`  フォルダ: ${__dirname}`);
  console.log('  ブラウザで上の URL を開いてください\n');
  if (!url || !key) {
    console.warn('  警告: .env.local が読めていません。');
    console.warn(`  次のファイルを確認: ${path.join(__dirname, '.env.local')}`);
    console.warn('  起動.bat は必ずこのフォルダのものを使ってください。\n');
  } else {
    console.log('  Supabase: 設定 OK\n');
  }
});

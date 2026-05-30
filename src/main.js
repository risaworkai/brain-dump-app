const THEME_STORAGE_KEY = 'brain-dump-theme';

function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
}

function initTheme() {
  const select = document.getElementById('theme-select');
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = stored === 'light' ? 'light' : 'dark';
  applyTheme(theme);
  if (!select) return;
  select.value = theme;
  select.addEventListener('change', () => applyTheme(select.value));
}

initTheme();

const RECORD_LABELS = {
  idea: '思いつき',
  ai_consult: 'AI相談',
  prompt: 'プロンプト',
  learning: '学習メモ',
};

function isViteEnv() {
  try {
    const e = import.meta?.env;
    return !!(e && ('DEV' in e || 'PROD' in e));
  } catch {
    return false;
  }
}

async function loadCreateClient() {
  if (isViteEnv()) {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient;
  }
  const sources = [
    'https://esm.sh/@supabase/supabase-js@2.49.1',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm',
  ];
  let lastErr;
  for (const src of sources) {
    try {
      const { createClient } = await import(/* @vite-ignore */ src);
      return createClient;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Supabase クライアントの読み込みに失敗しました（CDN を確認）');
}

async function getSupabaseCredentials() {
  const e = import.meta?.env;
  if (isViteEnv()) {
    const u = String(e?.VITE_SUPABASE_URL || '').trim();
    const k = String(e?.VITE_SUPABASE_ANON_KEY || '').trim();
    if (u && k) return { url: u, key: k };
  }
  try {
    const m = await import('/env.js');
    return {
      url: String(m.VITE_SUPABASE_URL || '').trim(),
      key: String(m.VITE_SUPABASE_ANON_KEY || '').trim(),
    };
  } catch {
    return { url: '', key: '' };
  }
}

let url = '';
let key = '';
let createClient = null;

const envWarning = document.getElementById('env-warning');
const toastEl = document.getElementById('toast');
const form = document.getElementById('entry-form');
const editIdInput = document.getElementById('edit-id');
const editSourceInput = document.getElementById('edit-source');
const recordTypeEl = document.getElementById('record-type');
const titleEl = document.getElementById('title');
const dueDateEl = document.getElementById('due-date');
const categoryFieldEl = document.getElementById('category-field');
const categoryEl = document.getElementById('category-id');
const contentEl = document.getElementById('content');
const tagsEl = document.getElementById('tags');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const refreshBtn = document.getElementById('refresh-btn');
const filterTypeEl = document.getElementById('filter-type');
const filterQEl = document.getElementById('filter-q');
const listStatus = document.getElementById('list-status');
const entryList = document.getElementById('entry-list');

let supabase = null;
let entriesCache = [];
let supportsIsDone = true;
let categoriesCache = [];
let categoryById = new Map();

const CATEGORY_MIGRATION_HINT =
  ' Supabase で docs/20260530_01_categories.sql を実行してください。';

function showToast(message, variant = 'ok') {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'toast--ok', 'toast--err');
  toastEl.classList.add(variant === 'err' ? 'toast--err' : 'toast--ok');
  clearTimeout(showToast._t);
  const ms = variant === 'err' ? 12000 : 4200;
  showToast._t = setTimeout(() => toastEl.classList.add('hidden'), ms);
}

function parseTags(raw) {
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

function parseDueDate(value) {
  const v = (value || '').trim();
  return v || null;
}

function parseCategoryId(value) {
  const v = (value || '').trim();
  return v || null;
}

function getCategoryName(row) {
  if (row?.category_name) return row.category_name;
  const id = row?.category_id;
  if (!id) return null;
  return categoryById.get(id) || null;
}

function populateCategorySelect(selectedId = '') {
  if (!categoryEl) return;
  categoryEl.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '（未選択）';
  categoryEl.append(empty);
  for (const c of categoriesCache) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    categoryEl.append(opt);
  }
  categoryEl.value = selectedId && categoryById.has(selectedId) ? selectedId : '';
}

function setCategoryFieldVisible(visible) {
  if (!categoryFieldEl) return;
  categoryFieldEl.classList.toggle('hidden', !visible);
}

async function loadCategories() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    categoriesCache = [];
    categoryById = new Map();
    populateCategorySelect();
    if (/categories|category|relation|does not exist/i.test(error.message)) {
      showToast(`カテゴリ取得に失敗: ${error.message}${CATEGORY_MIGRATION_HINT}`, 'err');
    } else {
      showToast(`カテゴリ取得に失敗: ${error.message}`, 'err');
    }
    return;
  }
  categoriesCache = Array.isArray(data) ? data : [];
  categoryById = new Map(categoriesCache.map((c) => [c.id, c.name]));
  const current = categoryEl?.value || '';
  populateCategorySelect(current);
}

/** DB から返る締切日（due_date / due_at など）を YYYY-MM-DD に正規化 */
function getRowDueDate(row) {
  const raw = row?.due_date ?? row?.due_at ?? row?.deadline ?? row?.deadline_date ?? null;
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (!s || s === 'null') return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function formatDueDate(isoDate) {
  const normalized = getRowDueDate({ due_date: isoDate });
  if (!normalized) return '';
  const [y, m, d] = normalized.split('-').map(Number);
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
}

function isDuePast(isoDate) {
  const normalized = getRowDueDate({ due_date: isoDate });
  if (!normalized) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = normalized.split('-').map(Number);
  return new Date(y, m - 1, d) < today;
}

function previewText(text, max = 160) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function entryTable(row) {
  return row?._source === 'brain_dumps' ? 'brain_dumps' : 'thought_entries';
}

function normalizeLegacyRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    title: row.title ?? '',
    content: row.content ?? '',
    record_type: 'idea',
    tags: [],
    due_date: getRowDueDate(row),
    category_id: null,
    category_name: null,
    is_done: !!row.is_done,
    _source: 'brain_dumps',
  };
}

function setEditingMode(editing, source = '') {
  if (editing) {
    submitBtn.textContent = '更新する';
    cancelEditBtn.classList.remove('hidden');
    setCategoryFieldVisible(source !== 'brain_dumps');
  } else {
    editIdInput.value = '';
    editSourceInput.value = '';
    submitBtn.textContent = '保存（新規）';
    cancelEditBtn.classList.add('hidden');
    setCategoryFieldVisible(true);
    populateCategorySelect('');
  }
}

function resetForm() {
  form.reset();
  editIdInput.value = '';
  editSourceInput.value = '';
  setEditingMode(false);
  populateCategorySelect('');
}

function applyFilters(rows) {
  const type = filterTypeEl.value;
  const q = filterQEl.value.trim().toLowerCase();
  return rows.filter((r) => {
    if (type && r.record_type !== type) return false;
    if (!q) return true;
    return `${r.title || ''} ${r.content || ''}`.toLowerCase().includes(q);
  });
}

function sortForDisplay(rows) {
  const active = [];
  const done = [];
  for (const r of rows) {
    (r.is_done ? done : active).push(r);
  }
  const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  active.sort(byNewest);
  done.sort(byNewest);
  return [...active, ...done];
}

async function toggleDone(row, checked, checkboxEl) {
  if (!supabase || !supportsIsDone) {
    checkboxEl.checked = !checked;
    return;
  }
  checkboxEl.disabled = true;
  const table = entryTable(row);
  const patch =
    table === 'thought_entries'
      ? { is_done: checked, updated_at: new Date().toISOString() }
      : { is_done: checked };
  const { error } = await supabase.from(table).update(patch).eq('id', row.id);
  checkboxEl.disabled = false;
  if (error) {
    checkboxEl.checked = !checked;
    const hint =
      table === 'brain_dumps' && /is_done|column/i.test(error.message)
        ? ' Supabase で docs/add_is_done_brain_dumps.sql を実行してください。'
        : '';
    showToast(`更新に失敗: ${error.message}${hint}`, 'err');
    return;
  }
  row.is_done = checked;
  const idx = entriesCache.findIndex((e) => e.id === row.id);
  if (idx !== -1) entriesCache[idx] = { ...entriesCache[idx], is_done: checked };
  renderList(entriesCache);
  showToast(checked ? '完了にしました（一覧の下へ移動）' : '未完了に戻しました');
}

function normalizeRow(row) {
  const category_name =
    row.categories?.name ?? (row.category_id ? categoryById.get(row.category_id) : null) ?? null;
  return {
    ...row,
    is_done: !!row.is_done,
    _source: row._source || 'thought_entries',
    category_name: category_name || null,
  };
}

function renderList(rows) {
  const filtered = sortForDisplay(applyFilters(rows.map(normalizeRow)));
  entryList.innerHTML = '';
  if (filtered.length === 0) {
    listStatus.textContent = rows.length === 0 ? 'まだデータがありません。' : '条件に一致する行がありません。';
    return;
  }
  const legacyN = rows.filter((r) => r._source === 'brain_dumps').length;
  const legacyNote = legacyN ? `・旧 brain_dumps ${legacyN} 件` : '';
  listStatus.textContent = `${filtered.length} 件表示（全 ${rows.length} 件${legacyNote}）`;
  const frag = document.createDocumentFragment();
  let prevWasDone = false;
  for (const row of filtered) {
    if (row.is_done && !prevWasDone && filtered.some((r) => !r.is_done)) {
      const sep = document.createElement('li');
      sep.className = 'entry-list__separator';
      sep.textContent = '完了';
      frag.appendChild(sep);
    }
    prevWasDone = !!row.is_done;
    const li = document.createElement('li');
    li.className = 'entry-card' + (row.is_done ? ' entry-card--done' : '');
    const head = document.createElement('div');
    head.className = 'entry-card__head';
    const body = document.createElement('div');
    body.className = 'entry-card__body';
    if (supportsIsDone) {
      const checkLabel = document.createElement('label');
      checkLabel.className = 'entry-card__check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!row.is_done;
      checkbox.addEventListener('change', () => toggleDone(row, checkbox.checked, checkbox));
      checkLabel.append(checkbox, document.createTextNode('完了'));
      head.append(checkLabel);
    }
    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = RECORD_LABELS[row.record_type] || row.record_type;
    if (entryTable(row) === 'brain_dumps') {
      const legacy = document.createElement('span');
      legacy.className = 'badge badge--legacy';
      legacy.textContent = '旧データ';
      meta.append(legacy);
    }
    const when = document.createElement('span');
    when.className = 'badge';
    when.textContent = `登録: ${formatDate(row.created_at)}`;
    meta.append(badge, when);
    const due = getRowDueDate(row);
    if (due) {
      const dueBadge = document.createElement('span');
      dueBadge.className = 'badge badge--due' + (isDuePast(due) ? ' badge--due-past' : '');
      dueBadge.textContent = `期限: ${formatDueDate(due)}`;
      meta.append(dueBadge);
    }
    const categoryName = getCategoryName(row);
    if (categoryName && entryTable(row) === 'thought_entries') {
      const catBadge = document.createElement('span');
      catBadge.className = 'badge badge--category';
      catBadge.textContent = `カテゴリ: ${categoryName}`;
      meta.append(catBadge);
    }
    const h3 = document.createElement('h3');
    h3.className = 'entry-card__title';
    h3.textContent = row.title?.trim() || '（タイトルなし）';
    const p = document.createElement('p');
    p.className = 'entry-card__preview';
    p.textContent = previewText(row.content);
    body.append(meta, h3, p);
    if (row.tags?.length) {
      const tagsP = document.createElement('p');
      tagsP.className = 'entry-card__tags';
      tagsP.textContent = `タグ: ${row.tags.join(', ')}`;
      body.append(tagsP);
    }
    head.append(body);
    li.append(head);
    const actions = document.createElement('div');
    actions.className = 'entry-card__actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--ghost';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => {
      editIdInput.value = row.id;
      editSourceInput.value = entryTable(row);
      recordTypeEl.value = row.record_type;
      titleEl.value = row.title || '';
      dueDateEl.value = getRowDueDate(row) || '';
      contentEl.value = row.content || '';
      tagsEl.value = (row.tags || []).join(', ');
      const src = entryTable(row);
      populateCategorySelect(src === 'thought_entries' ? row.category_id || '' : '');
      setEditingMode(true, src);
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('削除しますか？')) return;
      const { error } = await supabase.from(entryTable(row)).delete().eq('id', row.id);
      if (error) showToast(`削除に失敗: ${error.message}`, 'err');
      else await loadEntries();
    });
    actions.append(editBtn, delBtn);
    li.append(actions);
    frag.appendChild(li);
  }
  entryList.appendChild(frag);
}

async function loadEntries() {
  if (!supabase) return;
  listStatus.textContent = '読み込み中…';
  const [teRes, bdRes] = await Promise.all([
    supabase.from('thought_entries').select('*').order('created_at', { ascending: false }),
    supabase.from('brain_dumps').select('*').order('created_at', { ascending: false }),
  ]);
  if (teRes.error) {
    listStatus.textContent = `一覧取得に失敗: ${teRes.error.message}`;
    showToast(`一覧取得に失敗: ${teRes.error.message}`, 'err');
    return;
  }
  const thoughtRows = (Array.isArray(teRes.data) ? teRes.data : []).map(normalizeRow);
  const legacyRows =
    bdRes.error || !Array.isArray(bdRes.data) ? [] : bdRes.data.map(normalizeLegacyRow);
  supportsIsDone = true;
  entriesCache = [...thoughtRows, ...legacyRows].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  renderList(entriesCache);
}

async function reloadData() {
  await loadCategories();
  await loadEntries();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!supabase) return;
  const payload = {
    record_type: recordTypeEl.value,
    title: titleEl.value.trim() || null,
    content: contentEl.value.trim(),
    tags: parseTags(tagsEl.value),
    due_date: parseDueDate(dueDateEl.value),
    category_id: parseCategoryId(categoryEl?.value),
  };
  if (!payload.content) {
    showToast('本文を入力してください。', 'err');
    return;
  }
  submitBtn.disabled = true;
  const id = editIdInput.value.trim();
  const source = editSourceInput.value.trim() || 'thought_entries';
  let error;
  if (id && source === 'brain_dumps') {
    ({ error } = await supabase
      .from('brain_dumps')
      .update({ title: payload.title || '（タイトルなし）', content: payload.content })
      .eq('id', id));
  } else if (id) {
    const { category_id, ...rest } = payload;
    ({ error } = await supabase
      .from('thought_entries')
      .update({ ...rest, category_id, updated_at: new Date().toISOString() })
      .eq('id', id));
  } else {
    ({ error } = await supabase.from('thought_entries').insert(payload));
  }
  submitBtn.disabled = false;
  if (error) {
    let hint = '';
    if (/due_date|due_at/i.test(error.message) && !/category/i.test(error.message)) {
      hint = ' Supabase で docs/add_due_date_thought_entries.sql を実行してください。';
    } else if (/category_id|categories|category/i.test(error.message)) {
      hint = CATEGORY_MIGRATION_HINT;
    }
    showToast(`保存に失敗: ${error.message}${hint}`, 'err');
  }
  else {
    showToast(id ? '更新しました。' : '保存しました。');
    resetForm();
    await reloadData();
  }
});

cancelEditBtn.addEventListener('click', resetForm);
refreshBtn.addEventListener('click', () => reloadData());
filterTypeEl.addEventListener('change', () => renderList(entriesCache));
filterQEl.addEventListener('input', () => renderList(entriesCache));

function init() {
  if (!url || !key) {
    envWarning.classList.remove('hidden');
    envWarning.innerHTML =
      '<strong>Supabase の設定がありません。</strong><br>' +
      '① <code>.env.local</code> を <strong>起動.bat と同じフォルダ</strong> に置く<br>' +
      '② そのフォルダの <code>起動.bat</code> を実行し、黒い窓に <strong>Supabase: 設定 OK</strong> と出るか確認<br>' +
      '③ ブラウザで <code>http://127.0.0.1:5174/</code> を開き <kbd>Ctrl+Shift+R</kbd> で再読み込み<br>' +
      '<small>index.html のダブルクリック（file://）では動きません。</small>';
    listStatus.textContent = 'Supabase に接続できません。';
    return;
  }
  envWarning.classList.add('hidden');
  supabase = createClient(url, key);
  reloadData();
}

function warnIfOpenedAsFile() {
  if (location.protocol !== 'file:') return;
  envWarning.classList.remove('hidden');
  envWarning.innerHTML =
    '<strong>file:// では使えません。</strong> 起動.bat を実行し、http://127.0.0.1:5174/ を開いてください。';
  listStatus.textContent = '接続できません（file://）';
}

async function boot() {
  warnIfOpenedAsFile();
  if (location.protocol === 'file:') return;
  try {
    const [{ url: u, key: k }, clientFactory] = await Promise.all([
      getSupabaseCredentials(),
      loadCreateClient(),
    ]);
    url = u;
    key = k;
    createClient = clientFactory;
    init();
  } catch (err) {
    console.error(err);
    envWarning.classList.remove('hidden');
    envWarning.textContent = '初期化に失敗しました。Console を確認してください。';
  }
}

boot();

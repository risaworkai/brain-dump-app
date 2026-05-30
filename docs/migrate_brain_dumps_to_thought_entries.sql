-- 旧 brain_dumps のデータを thought_entries にコピー（Supabase SQL Editor で実行）
-- 実行後も brain_dumps は残ります。不要なら手動で delete してください。

insert into public.thought_entries (
  id,
  created_at,
  updated_at,
  record_type,
  title,
  content,
  tags,
  due_date,
  is_done
)
select
  id,
  created_at,
  created_at,
  'idea',
  nullif(trim(title), ''),
  content,
  '{}'::text[],
  null,
  false
from public.brain_dumps b
where not exists (
  select 1 from public.thought_entries t where t.id = b.id
);

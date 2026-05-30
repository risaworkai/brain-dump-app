-- 既存の brain_dumps に is_done 列がないときだけ実行
-- （create_brain_dumps.sql の新しい版では最初から is_done が含まれます）

alter table public.brain_dumps
  add column if not exists is_done boolean not null default false;

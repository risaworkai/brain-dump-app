-- thought_entries テーブル作成（新規プロジェクト用）
-- Supabase SQL Editor で実行してください。

create extension if not exists "pgcrypto";

create table if not exists public.thought_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record_type text not null check (record_type in ('idea', 'ai_consult', 'prompt', 'learning')),
  title text,
  content text not null,
  tags text[] not null default '{}'::text[],
  due_date date,
  is_done boolean not null default false,
  derivatives jsonb
);

alter table public.thought_entries disable row level security;

grant select, insert, update, delete on table public.thought_entries to anon, authenticated;

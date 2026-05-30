-- user_id が NULL のメモを自分のアカウントに紐付ける（表示されない行の復旧用）
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する。

update public.thought_entries
set user_id = '1efbf1dc-1df6-4bdc-95ff-5d0fb7e91bf5'::uuid
where user_id is null;

# ブレインダンプアプリ RLS 仕様書

## 1. 目的

ログイン済みユーザーが **自分が作成したデータのみ** 参照・追加・更新・削除できるよう、Supabase PostgreSQL の **Row Level Security（RLS）** で DB レベルのアクセス制御を行う。

| 項目 | 内容 |
|---|---|
| 参照要求 | `docs/01_要求仕様書.md` §4.11 |
| 参照 DB 定義 | `docs/02_DB仕様書.md` |
| SQL 生成・適用 | **本ドキュメントの対象外**（別タスクで実施） |

---

## 2. 適用範囲

### 2.1 RLS を有効にするテーブル

| テーブル | 理由 |
|---|---|
| **`brain_dumps`** | 旧メモデータ。ユーザー別に分離済み（`user_id` 列あり） |
| **`categories`** | カテゴリマスタ。参照は認証済み全員、更新は所有者のみ |
| **`thought_entries`** | 新規メモの正。`user_id` でユーザー別に分離 |

### 2.2 本仕様の対象外

| テーブル | 方針 |
|---|---|
| **`auth.users`** 等 | Supabase Auth 管理。本アプリではポリシー定義しない |

---

## 3. 前提条件（RLS 適用前に満たすこと）

### 3.1 認証

| 項目 | 内容 |
|---|---|
| 認証方式 | Supabase Auth（メール＋パスワード） |
| ポリシーで使う関数 | `auth.uid()` … ログイン中ユーザーの UUID。未ログイン時は `NULL` |
| ロール | `authenticated`（ログイン済み）、`anon`（未ログイン） |

### 3.2 カラム要件

| テーブル | 列 | 状態 | 備考 |
|---|---|---|---|
| `brain_dumps` | `user_id uuid` | **既存** | FK → `auth.users(id)`。NULL 可（移行前旧行） |
| `categories` | `user_id uuid` | **要追加**（RLS 適用前） | FK → `auth.users(id)`。NOT NULL 推奨（新規行） |
| `thought_entries` | `user_id uuid` | **既存** | FK → `auth.users(id)`。NULL 可（移行前旧行） |

`categories` について:

- 現行 DDL には `user_id` が無いため、RLS 適用前に列追加および既存データの移行が必要（SQL は別タスク）。
- グローバル UNIQUE 制約 `categories_name_key`（`name` のみ）は、ユーザー別所有に合わせ **`(user_id, name)` の複合一意** へ変更することを推奨する。
- 移行前の共有カテゴリ（仮データ 5 件）は、各ユーザーへのコピー、またはログインユーザーへの `user_id` 設定など、移行方針を SQL タスクで定める。

### 3.3 RLS の有効化

各対象テーブルで:

```sql
alter table public.<table_name> enable row level security;
```

（実際の適用 SQL は別タスク）

---

## 4. 共通ルール

### 4.1 基本方針

| ルール | 内容 |
|---|---|
| 所有者判定 | **`auth.uid() = user_id`** の行のみ、当該ユーザーが操作可能 |
| 未ログイン | **`anon` ロールは全操作拒否**（SELECT / INSERT / UPDATE / DELETE いずれも不可） |
| `user_id` が NULL の行 | **`brain_dumps`**: どのユーザーも参照・更新・削除不可（移行完了までの一時状態）。**`categories`**: 移行後は NULL 行を作らない想定 |
| INSERT 時 | **`user_id` は必ず `auth.uid()` と一致** させる（`WITH CHECK` で強制） |
| UPDATE 時 | **変更前・変更後とも** `user_id = auth.uid()`（`USING` + `WITH CHECK`） |
| 他ユーザーの `user_id` への書き換え | **禁止**（`WITH CHECK (user_id = auth.uid())` で防止） |

### 4.2 ロール別サマリ

| 操作 | `anon` | `authenticated`（条件） |
|---|---|---|
| SELECT | 拒否 | `brain_dumps`: 自分の行のみ / `categories`: **認証済み全員** |
| INSERT | 拒否 | `user_id = auth.uid()` を満たす行のみ |
| UPDATE | 拒否 | 対象行が `user_id = auth.uid()`、かつ更新後も同条件 |
| DELETE | 拒否 | `user_id = auth.uid()` の行のみ |

### 4.3 GRANT との関係

- RLS 有効化後も、`authenticated` ロールにテーブル権限（`SELECT`, `INSERT`, `UPDATE`, `DELETE`）が付与されている必要がある。
- 実際に通過する行は **RLS ポリシー** でさらに絞り込まれる（GRANT だけでは不十分）。

---

## 5. テーブル別ポリシー

ポリシー名は実装時の目安。SQL 生成タスクで確定してよい。

### 5.1 `brain_dumps`

| No | 操作 | ポリシー名（案） | 対象ロール | USING（行を見られる／触れる条件） | WITH CHECK（書き込み許可条件） |
|---|---|---|---|---|---|
| BD-01 | SELECT | `brain_dumps_select_own` | `authenticated` | `user_id = auth.uid()` | — |
| BD-02 | INSERT | `brain_dumps_insert_own` | `authenticated` | — | `user_id = auth.uid()` |
| BD-03 | UPDATE | `brain_dumps_update_own` | `authenticated` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| BD-04 | DELETE | `brain_dumps_delete_own` | `authenticated` | `user_id = auth.uid()` | — |

**アプリ上の補足**

- 新規メモの insert 先は **`thought_entries`** のみ。`brain_dumps` への INSERT は現行 UI では行わないが、ポリシー BD-02 は将来・直接 API 利用に備え定義する。
- 旧データ互換の **編集・削除・完了切替** は BD-03 / BD-04 / BD-01 が適用される。

### 5.2 `categories`

| No | 操作 | ポリシー名（案） | 対象ロール | USING | WITH CHECK |
|---|---|---|---|---|---|
| CT-01 | SELECT | `categories_select_authenticated` | `authenticated` | `true`（認証済み全員） | — |
| CT-02 | INSERT | `categories_insert_own` | `authenticated` | — | `user_id = auth.uid()` |
| CT-03 | UPDATE | `categories_update_own` | `authenticated` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| CT-04 | DELETE | `categories_delete_own` | `authenticated` | `user_id = auth.uid()` | — |

**アプリ上の補足**

- 現行 UI は **SELECT のみ**（ドロップダウン構築）。INSERT / UPDATE / DELETE ポリシーは、将来のカテゴリ管理機能および直接 API 利用に備え定義する。
- **SELECT は認証済みユーザー全員** が全カテゴリ行を参照できる。INSERT / UPDATE / DELETE は **自分の `user_id` の行のみ**。

### 5.3 `thought_entries`

| No | 操作 | ポリシー名（案） | 対象ロール | USING | WITH CHECK |
|---|---|---|---|---|---|
| TE-01 | SELECT | `thought_entries_select_own` | `authenticated` | `user_id = auth.uid()` | — |
| TE-02 | INSERT | `thought_entries_insert_own` | `authenticated` | — | `user_id = auth.uid()` |
| TE-03 | UPDATE | `thought_entries_update_own` | `authenticated` | `user_id = auth.uid()` | — |
| TE-04 | DELETE | `thought_entries_delete_own` | `authenticated` | `user_id = auth.uid()` | — |

**アプリ上の補足**

- 新規メモの insert 先。**保存時に `user_id: session.user.id` を付与** する（RLS の WITH CHECK と一致させる）。
- `user_id IS NULL` の行は **どのユーザーも参照・更新・削除不可**。

---

## 6. 操作 × テーブル マトリクス（要求仕様との対応）

| 操作 | `brain_dumps` | `categories` | 許可条件 |
|---|---|---|---|
| 一覧・参照（SELECT） | ○ | ○ | ログイン済み かつ `user_id = auth.uid()` |
| 新規追加（INSERT） | △※ | ○ | ログイン済み かつ insert 行の `user_id = auth.uid()` |
| 更新（UPDATE） | ○ | ○ | ログイン済み かつ 対象行の `user_id = auth.uid()` |
| 削除（DELETE） | ○ | ○ | ログイン済み かつ 対象行の `user_id = auth.uid()` |

※ `brain_dumps` への INSERT は現行アプリでは未使用。ポリシーは定義するが UI からは呼ばれない。

---

## 7. 想定される拒否パターン

| シナリオ | 期待結果 |
|---|---|
| 未ログインで SELECT | 0 件（または PostgREST エラー）。メモ UI は非表示 |
| ユーザー A がユーザー B の `brain_dumps` を UPDATE | 0 行更新（RLS で拒否） |
| ユーザー A が `user_id` に B の UUID を指定して INSERT | 拒否（WITH CHECK 不一致） |
| ユーザー A が `user_id IS NULL` の `brain_dumps` を SELECT | 0 件（一覧に出ない） |
| ユーザー A がユーザー B の `categories` を SELECT | 0 件。ドロップダウンに B のカテゴリは出ない |

---

## 8. カテゴリ FK との整合

| 項目 | 内容 |
|---|---|
| カテゴリ FK | `thought_entries.category_id` は `categories.id` を参照。categories の SELECT は認証済み全員可のため、他ユーザーのカテゴリ ID も参照可能 |
| 推奨 | アプリは **自分が設定した category_id** のみ使用する |

---

## 9. 適用手順（概要・SQL は別タスク）

1. `docs/20260530_03_categories_user_id.sql` … `categories.user_id` 列追加・既存データ移行・UNIQUE 制約見直し
2. `docs/20260530_04_rls_brain_dumps_categories.sql` … `brain_dumps` / `categories` の RLS
3. `docs/20260530_05_rls_thought_entries.sql` … `thought_entries` の RLS
4. `authenticated` / `anon` の GRANT を確認
5. Supabase Table Editor または REST API で、ユーザー A / B を使った拒否・許可を検証
6. アプリ（`src/main.js`）で `user_id` フィルタが冗長になっても問題ない（RLS が最終防衛線）

---

## 10. 受け入れ条件

- `brain_dumps`・`categories`・`thought_entries` で RLS が **有効** になっている。
- ログイン済みユーザーは、**自分の `user_id` の行だけ** SELECT / INSERT / UPDATE / DELETE できる。
- **未ログイン** では、両テーブルへの **いずれの操作も成功しない**。
- ユーザー A でログイン中、ユーザー B の行を UPDATE / DELETE しても **0 行** が変更される。
- ユーザー A のドロップダウンに、ユーザー B の **categories が表示されない**。
- `user_id IS NULL` の `brain_dumps` 行は、**いずれのログインユーザーからも参照できない**。

---

## 11. 関連ファイル

| ファイル | 内容 |
|---|---|
| `docs/01_要求仕様書.md` | §4.11 RLS 要件 |
| `docs/02_DB仕様書.md` | テーブル・カラム定義 |
| `docs/04_機能仕様書.md` | アプリ側 CRUD・認証フロー |
| `docs/20260530_03_categories_user_id.sql` | `categories.user_id` 追加・既存データ紐付け |
| `docs/20260530_04_rls_brain_dumps_categories.sql` | RLS 有効化 + ポリシー適用 |
| `docs/20260530_05_rls_thought_entries.sql` | `thought_entries` RLS 有効化 + ポリシー適用 |
| `docs/20260530_05_rls_実行手順.md` | `thought_entries` RLS — SQL Editor 実行手順 |

---

## 12. 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-05-30 | 初版。`brain_dumps`・`categories` の RLS ポリシー仕様を定義 |
| 2026-05-30 | 適用 SQL（`20260530_03` / `20260530_04`）を追加 |
| 2026-05-30 | `thought_entries` RLS（`20260530_05`）を追加 |

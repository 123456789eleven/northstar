-- Northstar encrypted vault. The server stores only ciphertext produced on the person's devices.
-- What the server can see: the account email (auth.users), table names, opaque record ids, row counts,
-- timestamps and ciphertext sizes. It never sees keys, passphrases or plaintext.
-- Access: authenticated users can touch only their own rows (RLS). The anon role gets nothing.

-- ---------------------------------------------------------------- vault_meta
create table if not exists public.vault_meta (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  version integer not null default 1,
  kdf text not null default 'PBKDF2-SHA256' check (kdf = 'PBKDF2-SHA256'),
  kdf_iterations integer not null check (kdf_iterations >= 600000),
  salt text not null check (char_length(salt) between 16 and 64),
  wrapped_key text not null check (char_length(wrapped_key) between 40 and 128),
  recovery_salt text not null check (char_length(recovery_salt) between 16 and 64),
  wrapped_key_recovery text not null check (char_length(wrapped_key_recovery) between 40 and 128),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- vault_records
create sequence if not exists public.vault_records_seq as bigint;

create table if not exists public.vault_records (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  table_name text not null check (table_name ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'),
  record_id text not null check (char_length(record_id) between 1 and 64),
  ciphertext text not null check (char_length(ciphertext) <= 2000000),
  nonce text not null check (char_length(nonce) between 8 and 32),
  deleted boolean not null default false,
  client_updated_at timestamptz not null,
  seq bigint not null, -- always assigned by the trigger below
  server_updated_at timestamptz not null default now(),
  primary key (user_id, table_name, record_id)
);

create index if not exists vault_records_user_seq on public.vault_records (user_id, seq);

-- Every insert/update gets a fresh, increasing seq (the pull cursor). A per-user advisory lock serialises one
-- user's writes so seq order equals commit order and a pulling device can never skip a row.
-- Last-writer-wins: an update carrying an older client_updated_at than the stored row is dropped.
create or replace function public.vault_records_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'UPDATE' then
    if new.client_updated_at < old.client_updated_at then
      return null; -- keep the newer stored version
    end if;
    new.user_id := old.user_id;
    new.table_name := old.table_name;
    new.record_id := old.record_id;
  end if;
  new.seq := nextval('public.vault_records_seq');
  new.server_updated_at := now();
  return new;
end;
$$;

revoke all on function public.vault_records_stamp() from public, anon, authenticated;

drop trigger if exists vault_records_stamp on public.vault_records;
create trigger vault_records_stamp
  before insert or update on public.vault_records
  for each row execute function public.vault_records_stamp();

-- ---------------------------------------------------------------- privileges + RLS
revoke all on table public.vault_meta, public.vault_records from anon;
revoke all on table public.vault_meta, public.vault_records from authenticated;
grant select, insert, update, delete on table public.vault_meta, public.vault_records to authenticated;
revoke all on sequence public.vault_records_seq from anon, authenticated;

alter table public.vault_meta enable row level security;
alter table public.vault_meta force row level security;
alter table public.vault_records enable row level security;
alter table public.vault_records force row level security;

create policy vault_meta_select on public.vault_meta for select to authenticated using ((select auth.uid()) = user_id);
create policy vault_meta_insert on public.vault_meta for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vault_meta_update on public.vault_meta for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy vault_meta_delete on public.vault_meta for delete to authenticated using ((select auth.uid()) = user_id);

create policy vault_records_select on public.vault_records for select to authenticated using ((select auth.uid()) = user_id);
create policy vault_records_insert on public.vault_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vault_records_update on public.vault_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy vault_records_delete on public.vault_records for delete to authenticated using ((select auth.uid()) = user_id);

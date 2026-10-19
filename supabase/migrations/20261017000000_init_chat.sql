-- Pebble chat schema: conversations, messages, private image bucket, RLS.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (char_length(content) <= 40000),
  image_path text,
  image_mime text,
  created_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

create policy "conversations_select_own" on public.conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "conversations_insert_own" on public.conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "conversations_update_own" on public.conversations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "conversations_delete_own" on public.conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Messages: owner only, and the conversation must also belong to the caller.
create policy "messages_select_own" on public.messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "messages_insert_own" on public.messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy "messages_delete_own" on public.messages
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Private image bucket (5 MB, images only). Files live under <user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

create policy "chat_images_select_own" on storage.objects
  for select to authenticated using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "chat_images_insert_own" on storage.objects
  for insert to authenticated with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "chat_images_delete_own" on storage.objects
  for delete to authenticated using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

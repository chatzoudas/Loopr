create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  tech_stack text[],
  public_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.loops (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

create table public.likes (
  user_id uuid references public.profiles(id) on delete cascade not null,
  loop_id uuid references public.loops(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, loop_id)
);

create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  loop_id uuid references public.loops(id) on delete cascade not null,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.comment_likes (
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, comment_id)
);

create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  image_url text,
  recipient_encrypted text,
  recipient_nonce text,
  sender_encrypted text,
  sender_nonce text,
  sender_public_key text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.key_backups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  encrypted_key text not null,
  salt text not null,
  iv text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.bookmarks (
  user_id uuid references public.profiles(id) on delete cascade not null,
  loop_id uuid references public.loops(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, loop_id)
);

create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('like', 'comment', 'follow', 'comment_like', 'mention')),
  loop_id uuid references public.loops(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;
alter table public.loops enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.messages enable row level security;
alter table public.key_backups enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

create policy "Loops are viewable by everyone"
  on public.loops for select
  using ( true );

create policy "Users can insert their own loops"
  on public.loops for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own loops"
  on public.loops for delete
  using ( auth.uid() = user_id );

create policy "Follows are viewable by everyone"
  on public.follows for select
  using ( true );

create policy "Users can insert their own follows"
  on public.follows for insert
  with check ( auth.uid() = follower_id );

create policy "Users can delete their own follows"
  on public.follows for delete
  using ( auth.uid() = follower_id );

create policy "Likes are viewable by everyone"
  on public.likes for select
  using ( true );

create policy "Users can insert their own likes"
  on public.likes for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own likes"
  on public.likes for delete
  using ( auth.uid() = user_id );

create policy "Comments are viewable by everyone"
  on public.comments for select
  using ( true );

create policy "Users can insert their own comments"
  on public.comments for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own comments"
  on public.comments for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own comments"
  on public.comments for delete
  using ( auth.uid() = user_id );

create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select
  using ( true );

create policy "Users can insert their own comment likes"
  on public.comment_likes for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own comment likes"
  on public.comment_likes for delete
  using ( auth.uid() = user_id );

create policy "Messages are viewable by sender or receiver"
  on public.messages for select
  using ( auth.uid() = sender_id or auth.uid() = receiver_id );

create policy "Users can insert messages they send"
  on public.messages for insert
  with check ( auth.uid() = sender_id );

create policy "Users can update messages they receive"
  on public.messages for update
  using ( auth.uid() = receiver_id );

create policy "Users can delete their own messages"
  on public.messages for delete
  using ( auth.uid() = sender_id );

create policy "Users can manage their own key backup"
  on public.key_backups for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

create policy "Bookmarks are private to the user"
  on public.bookmarks for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own bookmarks"
  on public.bookmarks for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own bookmarks"
  on public.bookmarks for delete
  using ( auth.uid() = user_id );

create policy "Users can view their own notifications"
  on public.notifications for select
  using ( auth.uid() = recipient_id );

create policy "Users can insert notifications where they are the actor"
  on public.notifications for insert
  with check ( auth.uid() = actor_id );

create policy "Users can update their own notifications"
  on public.notifications for update
  using ( auth.uid() = recipient_id );

create policy "Users can delete their notifications"
  on public.notifications for delete
  using ( auth.uid() = recipient_id or auth.uid() = actor_id );

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- buckets have to exist first or the policies below fail silently
insert into storage.buckets (id, name, public) values ('posts', 'posts', true);
insert into storage.buckets (id, name, public) values ('chat_images', 'chat_images', true);

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Anyone can upload an avatar"
  on storage.objects for insert
  with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using ( bucket_id = 'avatars' and owner = auth.uid() );

create policy "Post images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'posts' );

create policy "Anyone can upload a post image"
  on storage.objects for insert
  with check ( bucket_id = 'posts' and auth.role() = 'authenticated' );

create policy "Users can delete their own post images"
  on storage.objects for delete
  using ( bucket_id = 'posts' and owner = auth.uid() );

create policy "Chat images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'chat_images' );

create policy "Anyone can upload a chat image"
  on storage.objects for insert
  with check ( bucket_id = 'chat_images' and auth.role() = 'authenticated' );

create policy "Users can delete their own chat images"
  on storage.objects for delete
  using ( bucket_id = 'chat_images' and owner = auth.uid() );

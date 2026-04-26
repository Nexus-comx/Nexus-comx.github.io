
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles viewable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1) || '_' || substr(new.id::text,1,4)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- friendships
create type public.friendship_status as enum ('pending','accepted');
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
alter table public.friendships enable row level security;

create policy "view own friendships" on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "send friend request" on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);
create policy "update own friendship" on public.friendships for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "delete own friendship" on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- messages (DM)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "view own messages" on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "send messages" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);
create index on public.messages (sender_id, recipient_id, created_at);
alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;

-- games (tic tac toe)
create table public.games (
  id uuid primary key default gen_random_uuid(),
  player_x uuid not null references auth.users(id) on delete cascade,
  player_o uuid references auth.users(id) on delete cascade,
  board text[] not null default array['','','','','','','','',''],
  current_turn text not null default 'X',
  status text not null default 'waiting', -- waiting | active | finished
  winner text, -- 'X' | 'O' | 'draw'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.games enable row level security;

create policy "view games" on public.games for select to authenticated using (true);
create policy "create game as X" on public.games for insert to authenticated
  with check (auth.uid() = player_x);
create policy "players update game" on public.games for update to authenticated
  using (auth.uid() = player_x or auth.uid() = player_o or (player_o is null and status = 'waiting'));

alter publication supabase_realtime add table public.games;
alter table public.games replica identity full;

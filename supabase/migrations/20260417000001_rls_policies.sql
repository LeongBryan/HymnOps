-- HymnOps v2 Row Level Security policies
--
-- Design:
--   - All tables: public SELECT (songs/services are browse-friendly)
--   - INSERT / UPDATE / DELETE: authenticated users only
--   - No public signup is provided in the UI; only invited editors can write

-- ─────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────
alter table public.songs            enable row level security;
alter table public.song_aliases     enable row level security;
alter table public.song_writers     enable row level security;
alter table public.song_themes      enable row level security;
alter table public.song_scriptures  enable row level security;
alter table public.series           enable row level security;
alter table public.services         enable row level security;
alter table public.service_songs    enable row level security;

-- ─────────────────────────────────────────────
-- songs
-- ─────────────────────────────────────────────
create policy "songs: public read"
  on public.songs for select
  using (true);

create policy "songs: auth insert"
  on public.songs for insert
  with check (auth.role() = 'authenticated');

create policy "songs: auth update"
  on public.songs for update
  using (auth.role() = 'authenticated');

create policy "songs: auth delete"
  on public.songs for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- song_aliases
-- ─────────────────────────────────────────────
create policy "song_aliases: public read"
  on public.song_aliases for select
  using (true);

create policy "song_aliases: auth insert"
  on public.song_aliases for insert
  with check (auth.role() = 'authenticated');

create policy "song_aliases: auth update"
  on public.song_aliases for update
  using (auth.role() = 'authenticated');

create policy "song_aliases: auth delete"
  on public.song_aliases for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- song_writers
-- ─────────────────────────────────────────────
create policy "song_writers: public read"
  on public.song_writers for select
  using (true);

create policy "song_writers: auth insert"
  on public.song_writers for insert
  with check (auth.role() = 'authenticated');

create policy "song_writers: auth update"
  on public.song_writers for update
  using (auth.role() = 'authenticated');

create policy "song_writers: auth delete"
  on public.song_writers for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- song_themes
-- ─────────────────────────────────────────────
create policy "song_themes: public read"
  on public.song_themes for select
  using (true);

create policy "song_themes: auth insert"
  on public.song_themes for insert
  with check (auth.role() = 'authenticated');

create policy "song_themes: auth update"
  on public.song_themes for update
  using (auth.role() = 'authenticated');

create policy "song_themes: auth delete"
  on public.song_themes for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- song_scriptures
-- ─────────────────────────────────────────────
create policy "song_scriptures: public read"
  on public.song_scriptures for select
  using (true);

create policy "song_scriptures: auth insert"
  on public.song_scriptures for insert
  with check (auth.role() = 'authenticated');

create policy "song_scriptures: auth update"
  on public.song_scriptures for update
  using (auth.role() = 'authenticated');

create policy "song_scriptures: auth delete"
  on public.song_scriptures for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- series
-- ─────────────────────────────────────────────
create policy "series: public read"
  on public.series for select
  using (true);

create policy "series: auth insert"
  on public.series for insert
  with check (auth.role() = 'authenticated');

create policy "series: auth update"
  on public.series for update
  using (auth.role() = 'authenticated');

create policy "series: auth delete"
  on public.series for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- services
-- ─────────────────────────────────────────────
create policy "services: public read"
  on public.services for select
  using (true);

create policy "services: auth insert"
  on public.services for insert
  with check (auth.role() = 'authenticated');

create policy "services: auth update"
  on public.services for update
  using (auth.role() = 'authenticated');

create policy "services: auth delete"
  on public.services for delete
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- service_songs
-- ─────────────────────────────────────────────
create policy "service_songs: public read"
  on public.service_songs for select
  using (true);

create policy "service_songs: auth insert"
  on public.service_songs for insert
  with check (auth.role() = 'authenticated');

create policy "service_songs: auth update"
  on public.service_songs for update
  using (auth.role() = 'authenticated');

create policy "service_songs: auth delete"
  on public.service_songs for delete
  using (auth.role() = 'authenticated');

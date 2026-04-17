-- HymnOps v2 initial schema
-- Run via: supabase db push  OR  supabase migration up

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- songs
-- ─────────────────────────────────────────────
create table public.songs (
  id                  uuid        primary key default gen_random_uuid(),
  slug                text        unique not null,
  title               text        not null,
  ccli_number         text        null,
  songselect_url      text        null,
  original_artist_name text       null,
  theological_summary text        not null default '',
  congregational_fit  int         null check (congregational_fit between 1 and 5),
  tempo_bpm           int         null,
  default_key         text        null,
  status              text        not null default 'active' check (status in ('active', 'archive')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger songs_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- song_aliases
-- ─────────────────────────────────────────────
create table public.song_aliases (
  id      uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  alias   text not null,
  unique (song_id, alias)
);

-- ─────────────────────────────────────────────
-- song_writers
-- ─────────────────────────────────────────────
create table public.song_writers (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs(id) on delete cascade,
  writer_name text not null
);

-- ─────────────────────────────────────────────
-- song_themes
-- ─────────────────────────────────────────────
create table public.song_themes (
  id      uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  theme   text not null
);

-- ─────────────────────────────────────────────
-- song_scriptures
-- ─────────────────────────────────────────────
create table public.song_scriptures (
  id             uuid primary key default gen_random_uuid(),
  song_id        uuid not null references public.songs(id) on delete cascade,
  scripture_ref  text not null
);

-- ─────────────────────────────────────────────
-- series
-- ─────────────────────────────────────────────
create table public.series (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        unique not null,
  title       text        not null,
  description text        null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger series_updated_at
  before update on public.series
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- services
-- ─────────────────────────────────────────────
create table public.services (
  id                   uuid        primary key default gen_random_uuid(),
  service_date         date        not null unique,
  series_id            uuid        null references public.series(id) on delete set null,
  sermon_title         text        null,
  speaker              text        null,
  sermon_scripture_ref text        null,
  sermon_notes         text        null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- service_songs
-- ─────────────────────────────────────────────
create table public.service_songs (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services(id) on delete cascade,
  song_id      uuid not null references public.songs(id) on delete restrict,
  position     int  not null,
  usage        text null,
  key_override text null,
  notes        text null,
  unique (service_id, position)
);

-- ─────────────────────────────────────────────
-- Indexes for common query patterns
-- ─────────────────────────────────────────────
create index songs_status_idx          on public.songs(status);
create index song_aliases_song_id_idx  on public.song_aliases(song_id);
create index song_writers_song_id_idx  on public.song_writers(song_id);
create index song_themes_song_id_idx   on public.song_themes(song_id);
create index song_scriptures_song_id_idx on public.song_scriptures(song_id);
create index services_date_idx         on public.services(service_date desc);
create index services_series_id_idx    on public.services(series_id);
create index service_songs_service_id_idx on public.service_songs(service_id);
create index service_songs_song_id_idx    on public.service_songs(song_id);

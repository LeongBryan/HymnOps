import { supabase } from "../../lib/supabase";
import type { SongRow, ServiceRow, ServiceSongRow, SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement } from "../../utils";
import { Chart } from "../../components/Chart";
import { Table } from "../../components/Table";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SongUsage {
  slug: string;
  title: string;
  count: number;
  lastDate: string | null;
  weeksAgo: number | null;
}

interface WriterCount   { writer: string; count: number }
interface ArtistCount   { original_artist: string; count: number }

// ─── Helpers ──────────────────────────────────────────────────────────────

function weeksAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

// ─── Build analytics snapshot ─────────────────────────────────────────────

interface Snapshot {
  topSongs:      SongUsage[];
  topWriters:    WriterCount[];
  topArtists:    ArtistCount[];
  notSung4w:     SongUsage[];
  notSung8w:     SongUsage[];
  notSung12w:    SongUsage[];
  recentServices: Array<{ date: string; title: string | null; speaker: string | null; count: number }>;
}

function buildSnapshot(
  songs: SongRow[],
  services: ServiceRow[],
  serviceSongs: ServiceSongRow[],
  _series: SeriesRow[],
  writersMap: Map<string, string[]>
): Snapshot {
  const songById    = new Map(songs.map((s) => [s.id, s]));
  const usageCount  = new Map<string, number>();
  const lastSungMap = new Map<string, string>();
  const writerCount = new Map<string, number>();
  const artistCount = new Map<string, number>();

  for (const ss of serviceSongs) {
    const song = songById.get(ss.song_id);
    if (!song) continue;

    incrementMap(usageCount, ss.song_id);

    // Track last service date per song
    const svc = services.find((sv) => sv.id === ss.service_id);
    if (svc) {
      const cur = lastSungMap.get(ss.song_id);
      if (!cur || svc.service_date > cur) lastSungMap.set(ss.song_id, svc.service_date);
    }

    // Writers
    const writers = writersMap.get(ss.song_id) ?? [];
    for (const w of writers) incrementMap(writerCount, w);

    // Artist
    if (song.original_artist_name) incrementMap(artistCount, song.original_artist_name);
  }

  const songUsages: SongUsage[] = songs.map((s) => ({
    slug:     s.slug,
    title:    s.title,
    count:    usageCount.get(s.id) ?? 0,
    lastDate: lastSungMap.get(s.id) ?? null,
    weeksAgo: weeksAgo(lastSungMap.get(s.id) ?? null)
  }));

  const topSongs = [...songUsages].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const topWriters: WriterCount[] = [...writerCount.entries()]
    .map(([writer, count]) => ({ writer, count }))
    .sort((a, b) => b.count - a.count || a.writer.localeCompare(b.writer));

  const topArtists: ArtistCount[] = [...artistCount.entries()]
    .map(([original_artist, count]) => ({ original_artist, count }))
    .sort((a, b) => b.count - a.count || a.original_artist.localeCompare(b.original_artist));

  // Rotation gaps (active songs only)
  const activeSongs = songUsages.filter((s) => songs.find((x) => x.slug === s.slug)?.status === "active");
  const notSung = (weeks: number) =>
    activeSongs.filter((s) => s.weeksAgo === null || s.weeksAgo >= weeks)
               .sort((a, b) => (b.weeksAgo ?? 9999) - (a.weeksAgo ?? 9999) || a.title.localeCompare(b.title));

  // Recent services (last 10)
  const svcByDate = [...services].sort((a, b) => b.service_date.localeCompare(a.service_date)).slice(0, 10);
  const recentServices = svcByDate.map((sv) => ({
    date:    sv.service_date,
    title:   sv.sermon_title,
    speaker: sv.speaker,
    count:   serviceSongs.filter((ss) => ss.service_id === sv.id).length
  }));

  return { topSongs, topWriters, topArtists, notSung4w: notSung(4), notSung8w: notSung(8), notSung12w: notSung(12), recentServices };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function V2AnalyticsPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page analytics-page");
  page.appendChild(createElement("h1", undefined, "Analytics (v2)"));

  const content = createElement("div");
  content.appendChild(createElement("p", "empty-state", "Loading…"));
  page.appendChild(content);

  withAuth(page, navigate, async () => {
    const [songsRes, servicesRes, serviceSongsRes, seriesRes, writersRes] = await Promise.all([
      supabase.from("songs").select("*"),
      supabase.from("services").select("*"),
      supabase.from("service_songs").select("*"),
      supabase.from("series").select("*"),
      supabase.from("song_writers").select("*")
    ]);

    if (songsRes.error) throw songsRes.error;
    if (servicesRes.error) throw servicesRes.error;

    const songs        = songsRes.data ?? [];
    const services     = servicesRes.data ?? [];
    const serviceSongs = serviceSongsRes.data ?? [];
    const series       = seriesRes.data ?? [];

    // Build writers map: songId -> writer_name[]
    const writersMap = new Map<string, string[]>();
    for (const w of writersRes.data ?? []) {
      const list = writersMap.get(w.song_id) ?? [];
      list.push(w.writer_name);
      writersMap.set(w.song_id, list);
    }

    const snap = buildSnapshot(songs, services, serviceSongs, series, writersMap);

    content.innerHTML = "";

    // ── Recent services ────────────────────────────────────────────────────
    const recentBlock = createElement("section", "detail-block");
    recentBlock.appendChild(createElement("h2", undefined, "Recent Services"));
    recentBlock.appendChild(
      Table(
        [
          { key: "date",    label: "Date" },
          { key: "title",   label: "Sermon" },
          { key: "speaker", label: "Speaker" },
          { key: "count",   label: "Songs" }
        ],
        snap.recentServices
      )
    );
    content.appendChild(recentBlock);

    // ── Top songs / writers / artists ──────────────────────────────────────
    const topGrid = createElement("section", "analytics-grid");

    const topSongsBlock = createElement("article", "detail-block");
    topSongsBlock.appendChild(createElement("h2", undefined, "Top Songs (all-time)"));
    topSongsBlock.appendChild(
      Table(
        [{ key: "title", label: "Song" }, { key: "count", label: "Times" }],
        snap.topSongs.slice(0, 15)
      )
    );
    topGrid.appendChild(topSongsBlock);

    const topWritersBlock = createElement("article", "detail-block");
    topWritersBlock.appendChild(createElement("h2", undefined, "Top Writers"));
    topWritersBlock.appendChild(
      Table(
        [{ key: "writer", label: "Writer" }, { key: "count", label: "Count" }],
        snap.topWriters.slice(0, 12)
      )
    );
    topGrid.appendChild(topWritersBlock);

    const topArtistsBlock = createElement("article", "detail-block");
    topArtistsBlock.appendChild(createElement("h2", undefined, "Top Original Artists"));
    topArtistsBlock.appendChild(
      Table(
        [{ key: "original_artist", label: "Artist" }, { key: "count", label: "Count" }],
        snap.topArtists.slice(0, 12)
      )
    );
    topGrid.appendChild(topArtistsBlock);
    content.appendChild(topGrid);

    // ── Rotation gaps ─────────────────────────────────────────────────────
    const rotBlock = createElement("section", "detail-block");
    rotBlock.appendChild(createElement("h2", undefined, "Rotation Gaps"));
    [
      { label: "Not sung in 4+ weeks",  list: snap.notSung4w  },
      { label: "Not sung in 8+ weeks",  list: snap.notSung8w  },
      { label: "Not sung in 12+ weeks", list: snap.notSung12w }
    ].forEach(({ label, list }) => {
      const sub = createElement("h3", undefined, `${label} (${list.length})`);
      rotBlock.appendChild(sub);
      if (list.length > 0) {
        rotBlock.appendChild(
          Table(
            [
              { key: "title",    label: "Song" },
              { key: "weeksAgo", label: "Weeks ago" },
              { key: "lastDate", label: "Last sung" }
            ],
            list.slice(0, 10).map((s) => ({
              title:    s.title,
              weeksAgo: s.weeksAgo != null ? String(s.weeksAgo) : "never",
              lastDate: s.lastDate ?? "—"
            }))
          )
        );
      } else {
        rotBlock.appendChild(createElement("p", "empty-state", "No songs in this bucket."));
      }
    });
    content.appendChild(rotBlock);

    // ── Chart: top songs bar ──────────────────────────────────────────────
    content.appendChild(
      Chart({
        title: "Top 12 Songs",
        data:  snap.topSongs.slice(0, 12).map((s) => ({ label: s.title, value: s.count }))
      })
    );
  });

  return page;
}

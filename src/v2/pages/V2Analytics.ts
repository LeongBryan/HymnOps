import { supabase } from "../../lib/supabase";
import type { SongRow, ServiceRow, ServiceSongRow, SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement, formatDate } from "../../utils";
import { Chart } from "../../components/Chart";
import { Table } from "../../components/Table";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SongUsage {
  slug: string;
  title: string;
  count: number;
  lastDate: string | null;
}

interface WriterCount  { writer: string; count: number }
interface ArtistCount  { original_artist: string; count: number }

interface Snapshot {
  topSongs:       SongUsage[];
  topWriters:     WriterCount[];
  topArtists:     ArtistCount[];
  recentServices: Array<{ date: string; title: string | null; speaker: string | null; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function buildSnapshot(
  songs: SongRow[],
  services: ServiceRow[],
  serviceSongs: ServiceSongRow[],
  writersMap: Map<string, string[]>
): Snapshot {
  const songById    = new Map(songs.map((s) => [s.id, s]));
  const usageCount  = new Map<string, number>();
  const lastSungMap = new Map<string, string>();
  const writerCount = new Map<string, number>();
  const artistCount = new Map<string, number>();
  const serviceById = new Map(services.map((s) => [s.id, s]));

  for (const ss of serviceSongs) {
    const song = songById.get(ss.song_id);
    if (!song) continue;

    incrementMap(usageCount, ss.song_id);

    const svc = serviceById.get(ss.service_id);
    if (svc) {
      const cur = lastSungMap.get(ss.song_id);
      if (!cur || svc.service_date > cur) lastSungMap.set(ss.song_id, svc.service_date);
    }

    const writers = writersMap.get(ss.song_id) ?? [];
    for (const w of writers) incrementMap(writerCount, w);

    if (song.original_artist_name) incrementMap(artistCount, song.original_artist_name);
  }

  const topSongs: SongUsage[] = songs
    .map((s) => ({
      slug:     s.slug,
      title:    s.title,
      count:    usageCount.get(s.id) ?? 0,
      lastDate: lastSungMap.get(s.id) ?? null
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const topWriters: WriterCount[] = [...writerCount.entries()]
    .map(([writer, count]) => ({ writer, count }))
    .sort((a, b) => b.count - a.count || a.writer.localeCompare(b.writer));

  const topArtists: ArtistCount[] = [...artistCount.entries()]
    .map(([original_artist, count]) => ({ original_artist, count }))
    .sort((a, b) => b.count - a.count || a.original_artist.localeCompare(b.original_artist));

  const recentServices = [...services]
    .sort((a, b) => b.service_date.localeCompare(a.service_date))
    .slice(0, 10)
    .map((sv) => ({
      date:    formatDate(sv.service_date),
      title:   sv.sermon_title,
      speaker: sv.speaker,
      count:   serviceSongs.filter((ss) => ss.service_id === sv.id).length
    }));

  return { topSongs, topWriters, topArtists, recentServices };
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function V2AnalyticsPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page analytics-page");
  page.appendChild(createElement("h1", undefined, "Analytics"));

  const content = createElement("div");
  content.appendChild(createElement("p", "empty-state", "Loading…"));
  page.appendChild(content);

  withAuth(page, navigate, async () => {
    const [songsRes, servicesRes, serviceSongsRes, writersRes] = await Promise.all([
      supabase.from("songs").select("*"),
      supabase.from("services").select("*").order("service_date", { ascending: false }),
      supabase.from("service_songs").select("*"),
      supabase.from("song_writers").select("*")
    ]);

    if (songsRes.error) throw songsRes.error;
    if (servicesRes.error) throw servicesRes.error;

    const songs        = songsRes.data ?? [];
    const allServices  = servicesRes.data ?? [];
    const allSvcSongs  = serviceSongsRes.data ?? [];

    const writersMap = new Map<string, string[]>();
    for (const w of writersRes.data ?? []) {
      const list = writersMap.get(w.song_id) ?? [];
      list.push(w.writer_name);
      writersMap.set(w.song_id, list);
    }

    // ── Year filter ──────────────────────────────────────────────────────────
    const years = [...new Set(allServices.map((sv) => sv.service_date.slice(0, 4)))].sort().reverse();
    let selectedYear = "";

    const filterBar = createElement("div", "v2-analytics-filter");
    filterBar.appendChild(createElement("label", "v2-form-label", "Year"));
    const yearSelect = document.createElement("select");
    yearSelect.className = "filter-input";
    const allOpt = document.createElement("option");
    allOpt.value = ""; allOpt.textContent = "All years";
    yearSelect.appendChild(allOpt);
    for (const y of years) {
      const opt = document.createElement("option");
      opt.value = y; opt.textContent = y;
      yearSelect.appendChild(opt);
    }

    const renderContent = () => {
      const services = selectedYear
        ? allServices.filter((sv) => sv.service_date.startsWith(selectedYear))
        : allServices;
      const svcIds = new Set(services.map((sv) => sv.id));
      const serviceSongs = allSvcSongs.filter((ss) => svcIds.has(ss.service_id));

      const snap = buildSnapshot(songs, services, serviceSongs, writersMap);

      content.innerHTML = "";
      content.appendChild(filterBar);

      // Recent services
      const recentBlock = createElement("section", "detail-block");
      recentBlock.appendChild(createElement("h2", undefined, "Recent Services"));
      recentBlock.appendChild(
        Table(
          [
            { key: "date",    label: "Date"    },
            { key: "title",   label: "Sermon"  },
            { key: "speaker", label: "Speaker" },
            { key: "count",   label: "Songs"   }
          ],
          snap.recentServices
        )
      );
      content.appendChild(recentBlock);

      // Top songs / writers / artists
      const topGrid = createElement("div", "analytics-grid");

      const topSongsBlock = createElement("article", "detail-block");
      topSongsBlock.appendChild(createElement("h2", undefined, `Top Songs${selectedYear ? ` (${selectedYear})` : " (all-time)"}`));
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

      // Chart
      content.appendChild(
        Chart({
          title: `Top 12 Songs${selectedYear ? ` (${selectedYear})` : ""}`,
          data:  snap.topSongs.slice(0, 12).map((s) => ({ label: s.title, value: s.count }))
        })
      );
    };

    yearSelect.addEventListener("change", () => {
      selectedYear = yearSelect.value;
      renderContent();
    });
    filterBar.appendChild(yearSelect);

    renderContent();
  });

  return page;
}

import MarkdownIt from "markdown-it";

export interface SongHistoryEntry {
  date: string;
  series_slug: string | null;
  usage: string[];
  key: string | null;
}

export interface Song {
  title: string;
  slug: string;
  aka: string[];
  ccli_number: string | null;
  songselect_url: string | null;
  lyrics_source: "SongSelect" | "Other" | "Unknown";
  lyrics_hint?: string | null;
  original_artist: string | null;
  writers: string[];
  publisher: string | null;
  year: number | null;
  tempo_bpm: number | null;
  key: string | null;
  time_signature: string | null;
  congregational_fit: number | null;
  vocal_range: string | null;
  dominant_themes: string[];
  doctrinal_categories: string[];
  emotional_tone: string[];
  scriptural_anchors: string[];
  theological_summary: string;
  arrangement_notes: string | null;
  slides_path: string | null;
  tags: string[];
  last_sung_override: string | null;
  status: "active" | "archive";
  licensing_notes?: string | null;
  language?: string | null;
  meter?: string | null;
  notes_markdown: string | null;
  pastoral_use_markdown: string | null;
  lyric_warning_reasons: string[];
  times_sung: number;
  last_sung_computed: string | null;
  history: SongHistoryEntry[];
  writers_normalized: string[];
  original_artist_normalized: string | null;
}

export interface ServiceSongRef {
  slug: string;
  usage: string[];
  key: string | null;
  notes: string | null;
}

export interface Service {
  date: string;
  series_slug: string | null;
  sermon_title: string | null;
  sermon_text: string | null;
  preacher: string | null;
  songs: ServiceSongRef[];
  notes_markdown: string | null;
}

export interface Series {
  title: string;
  slug: string;
  date_range: [string | null, string | null];
  description: string | null;
  recommended: string[];
  notes_markdown: string | null;
}

export interface DerivedData {
  generated_at: string;
  rotation_health: Record<string, { slug: string; title: string; weeks_since_last_sung: number | null }[]>;
  top_songs: { slug: string; title: string; count: number }[];
  top_writers: { writer: string; count: number }[];
  top_original_artists: { original_artist: string; count: number }[];
  theme_coverage_last_12_weeks: { theme: string; count: number }[];
  doctrinal_coverage_last_12_weeks: { doctrine: string; count: number }[];
  theme_gaps_last_12_weeks: string[];
  over_reliance: {
    top_10_usage_count: number;
    total_usage_count: number;
    top_10_share: number;
  };
  recently_sung_services: Array<{
    date: string;
    series_slug: string | null;
    song_slugs: string[];
  }>;
}

export interface AppData {
  songs: Song[];
  services: Service[];
  series: Series[];
  derived: DerivedData;
}

export interface PlannerSongItem {
  slug: string;
  usage: string[];
  key: string | null;
  notes: string | null;
}

export interface PlannerState {
  date: string;
  series_slug: string | null;
  sermon_title: string | null;
  sermon_text: string | null;
  preacher: string | null;
  songs: PlannerSongItem[];
}

export interface PageContext {
  data: AppData;
  markdown: MarkdownIt;
  planner: PlannerState;
  setPlanner: (next: PlannerState) => void;
  navigate: (pathWithQuery: string) => void;
  rerender: () => void;
}

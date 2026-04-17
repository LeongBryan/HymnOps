import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// ─── Convenience re-exports ───────────────────────────────────────────────────

export type { Database };

// Row types (read from DB)
export type SongRow         = Database["public"]["Tables"]["songs"]["Row"];
export type SongAliasRow    = Database["public"]["Tables"]["song_aliases"]["Row"];
export type SongWriterRow   = Database["public"]["Tables"]["song_writers"]["Row"];
export type SongThemeRow    = Database["public"]["Tables"]["song_themes"]["Row"];
export type SongScriptureRow = Database["public"]["Tables"]["song_scriptures"]["Row"];
export type SeriesRow       = Database["public"]["Tables"]["series"]["Row"];
export type ServiceRow      = Database["public"]["Tables"]["services"]["Row"];
export type ServiceSongRow  = Database["public"]["Tables"]["service_songs"]["Row"];

// Insert types (write to DB)
export type SongInsert        = Database["public"]["Tables"]["songs"]["Insert"];
export type SeriesInsert      = Database["public"]["Tables"]["series"]["Insert"];
export type ServiceInsert     = Database["public"]["Tables"]["services"]["Insert"];
export type ServiceSongInsert = Database["public"]["Tables"]["service_songs"]["Insert"];

// ─── Enriched composite types used across v2 UI ──────────────────────────────

export interface SongFull extends SongRow {
  aliases:    SongAliasRow[];
  writers:    SongWriterRow[];
  themes:     SongThemeRow[];
  scriptures: SongScriptureRow[];
}

export interface ServiceFull extends ServiceRow {
  series: SeriesRow | null;
  songs:  Array<ServiceSongRow & { song: SongRow }>;
}

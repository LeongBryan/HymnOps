// ─────────────────────────────────────────────────────────────────────────────
// Auto-generate this file with:
//   npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
// OR against the local stack:
//   npx supabase gen types typescript --local > src/lib/database.types.ts
//
// The hand-written version below must match supabase/migrations/*.sql exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      songs: {
        Row: {
          id:                   string;
          slug:                 string;
          title:                string;
          ccli_number:          string | null;
          songselect_url:       string | null;
          original_artist_name: string | null;
          theological_summary:  string;
          congregational_fit:   number | null;
          tempo_bpm:            number | null;
          default_key:          string | null;
          status:               string;
          created_at:           string;
          updated_at:           string;
        };
        Insert: {
          id?:                   string;
          slug:                  string;
          title:                 string;
          ccli_number?:          string | null;
          songselect_url?:       string | null;
          original_artist_name?: string | null;
          theological_summary?:  string;
          congregational_fit?:   number | null;
          tempo_bpm?:            number | null;
          default_key?:          string | null;
          status?:               string;
          created_at?:           string;
          updated_at?:           string;
        };
        Update: {
          id?:                   string;
          slug?:                 string;
          title?:                string;
          ccli_number?:          string | null;
          songselect_url?:       string | null;
          original_artist_name?: string | null;
          theological_summary?:  string;
          congregational_fit?:   number | null;
          tempo_bpm?:            number | null;
          default_key?:          string | null;
          status?:               string;
          created_at?:           string;
          updated_at?:           string;
        };
        Relationships: [];
      };

      song_aliases: {
        Row: {
          id:      string;
          song_id: string;
          alias:   string;
        };
        Insert: {
          id?:     string;
          song_id: string;
          alias:   string;
        };
        Update: {
          id?:      string;
          song_id?: string;
          alias?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "song_aliases_song_id_fkey";
            columns: ["song_id"];
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };

      song_writers: {
        Row: {
          id:          string;
          song_id:     string;
          writer_name: string;
        };
        Insert: {
          id?:          string;
          song_id:      string;
          writer_name:  string;
        };
        Update: {
          id?:          string;
          song_id?:     string;
          writer_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_writers_song_id_fkey";
            columns: ["song_id"];
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };

      song_themes: {
        Row: {
          id:      string;
          song_id: string;
          theme:   string;
        };
        Insert: {
          id?:     string;
          song_id: string;
          theme:   string;
        };
        Update: {
          id?:      string;
          song_id?: string;
          theme?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "song_themes_song_id_fkey";
            columns: ["song_id"];
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };

      song_scriptures: {
        Row: {
          id:            string;
          song_id:       string;
          scripture_ref: string;
        };
        Insert: {
          id?:            string;
          song_id:        string;
          scripture_ref:  string;
        };
        Update: {
          id?:            string;
          song_id?:       string;
          scripture_ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_scriptures_song_id_fkey";
            columns: ["song_id"];
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };

      series: {
        Row: {
          id:          string;
          slug:        string;
          title:       string;
          description: string | null;
          created_at:  string;
          updated_at:  string;
        };
        Insert: {
          id?:          string;
          slug:         string;
          title:        string;
          description?: string | null;
          created_at?:  string;
          updated_at?:  string;
        };
        Update: {
          id?:          string;
          slug?:        string;
          title?:       string;
          description?: string | null;
          created_at?:  string;
          updated_at?:  string;
        };
        Relationships: [];
      };

      services: {
        Row: {
          id:                   string;
          service_date:         string;
          series_id:            string | null;
          sermon_title:         string | null;
          speaker:              string | null;
          sermon_scripture_ref: string | null;
          sermon_notes:         string | null;
          created_at:           string;
          updated_at:           string;
        };
        Insert: {
          id?:                   string;
          service_date:          string;
          series_id?:            string | null;
          sermon_title?:         string | null;
          speaker?:              string | null;
          sermon_scripture_ref?: string | null;
          sermon_notes?:         string | null;
          created_at?:           string;
          updated_at?:           string;
        };
        Update: {
          id?:                   string;
          service_date?:         string;
          series_id?:            string | null;
          sermon_title?:         string | null;
          speaker?:              string | null;
          sermon_scripture_ref?: string | null;
          sermon_notes?:         string | null;
          created_at?:           string;
          updated_at?:           string;
        };
        Relationships: [
          {
            foreignKeyName: "services_series_id_fkey";
            columns: ["series_id"];
            referencedRelation: "series";
            referencedColumns: ["id"];
          }
        ];
      };

      service_songs: {
        Row: {
          id:           string;
          service_id:   string;
          song_id:      string;
          position:     number;
          usage:        string | null;
          key_override: string | null;
          notes:        string | null;
        };
        Insert: {
          id?:           string;
          service_id:    string;
          song_id:       string;
          position:      number;
          usage?:        string | null;
          key_override?: string | null;
          notes?:        string | null;
        };
        Update: {
          id?:           string;
          service_id?:   string;
          song_id?:      string;
          position?:     number;
          usage?:        string | null;
          key_override?: string | null;
          notes?:        string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_songs_service_id_fkey";
            columns: ["service_id"];
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_songs_song_id_fkey";
            columns: ["song_id"];
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

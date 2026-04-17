import Fuse from "fuse.js";
import { supabase } from "../../lib/supabase";
import type { SongRow, SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement } from "../../utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetlistEntry {
  song: SongRow;
  keyOverride: string;
  usage: string;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

// ─── Song Typeahead ───────────────────────────────────────────────────────────

function buildTypeahead(
  songs: SongRow[],
  onSelect: (song: SongRow) => void
): HTMLElement {
  const fuse = new Fuse(songs, {
    keys: ["title", "original_artist_name", "default_key", "ccli_number"],
    threshold: 0.35
  });

  const wrap = createElement("div", "v2-typeahead-wrap");
  wrap.appendChild(createElement("label", "v2-form-label", "Add song"));

  const input = document.createElement("input");
  input.type = "search";
  input.className = "search-input";
  input.placeholder = "Search by title, artist, key…";
  input.autocomplete = "off";

  const dropdown = createElement("ul", "v2-typeahead-dropdown");
  dropdown.style.display = "none";

  const closeDropdown = () => { dropdown.style.display = "none"; dropdown.innerHTML = ""; };

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (q.length < 1) { closeDropdown(); return; }

    const results = fuse.search(q).slice(0, 8);
    dropdown.innerHTML = "";
    if (results.length === 0) {
      const li = createElement("li", "v2-typeahead-item v2-typeahead-empty", "No matches");
      dropdown.appendChild(li);
    } else {
      for (const { item } of results) {
        const li = createElement("li", "v2-typeahead-item");
        const title = createElement("span", "list-primary", item.title);
        const meta = createElement("span", "list-secondary", [
          item.original_artist_name,
          item.default_key ? `key: ${item.default_key}` : null
        ].filter(Boolean).join(" · ") || "");
        li.append(title, meta);
        li.addEventListener("mousedown", (e) => {
          e.preventDefault(); // keep focus on input
          onSelect(item);
          input.value = "";
          closeDropdown();
        });
        dropdown.appendChild(li);
      }
    }
    dropdown.style.display = "";
  });

  input.addEventListener("blur", () => setTimeout(closeDropdown, 150));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdown(); });

  wrap.append(input, dropdown);
  return wrap;
}

// ─── Setlist row ─────────────────────────────────────────────────────────────

function buildSetlistItem(
  entry: SetlistEntry,
  index: number,
  total: number,
  onMove: (from: number, to: number) => void,
  onRemove: (index: number) => void,
  onChange: () => void
): HTMLElement {
  const item = createElement("li", "planner-item v2-setlist-item");
  item.dataset.index = String(index);

  const top = createElement("div", "planner-item-top");

  const orderBtns = createElement("div", "v2-order-btns");
  const upBtn = createElement("button", "button-secondary v2-order-btn", "↑") as HTMLButtonElement;
  upBtn.type = "button"; upBtn.title = "Move up";
  upBtn.disabled = index === 0;
  upBtn.addEventListener("click", () => onMove(index, index - 1));

  const downBtn = createElement("button", "button-secondary v2-order-btn", "↓") as HTMLButtonElement;
  downBtn.type = "button"; downBtn.title = "Move down";
  downBtn.disabled = index === total - 1;
  downBtn.addEventListener("click", () => onMove(index, index + 1));

  orderBtns.append(upBtn, downBtn);

  const titleEl = createElement("span", "list-primary v2-setlist-title", entry.song.title);
  if (entry.song.original_artist_name) {
    const meta = createElement("span", "list-secondary v2-setlist-artist", entry.song.original_artist_name);
    titleEl.appendChild(meta);
  }

  const removeBtn = createElement("button", "button-link v2-setlist-remove", "Remove") as HTMLButtonElement;
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => onRemove(index));

  top.append(orderBtns, titleEl, removeBtn);

  // Key field
  const fields = createElement("div", "v2-setlist-fields");

  const keyInput = document.createElement("input");
  keyInput.type = "text"; keyInput.className = "search-input v2-setlist-key";
  keyInput.placeholder = entry.song.default_key ? `default: ${entry.song.default_key}` : "key";
  keyInput.value = entry.keyOverride;
  keyInput.addEventListener("input", () => { entry.keyOverride = keyInput.value.trim(); onChange(); });

  const usageSelect = document.createElement("select");
  usageSelect.className = "filter-input v2-setlist-usage";
  [["", "usage…"], ["kid-friendly", "Kid-friendly"], ["main", "Main"], ["response", "Response"]].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = label;
    if (entry.usage === val) opt.selected = true;
    usageSelect.appendChild(opt);
  });
  usageSelect.addEventListener("change", () => { entry.usage = usageSelect.value; onChange(); });

  const notesInput = document.createElement("input");
  notesInput.type = "text"; notesInput.className = "search-input v2-setlist-notes";
  notesInput.placeholder = "Notes (optional)";
  notesInput.value = entry.notes;
  notesInput.addEventListener("input", () => { entry.notes = notesInput.value.trim(); onChange(); });

  const keyLabel = createElement("label", "v2-form-label", "Key");
  const usageLabel = createElement("label", "v2-form-label", "Usage");
  const notesLabel = createElement("label", "v2-form-label", "Notes");

  const keyWrap = createElement("div", "v2-setlist-field");
  keyWrap.append(keyLabel, keyInput);
  const usageWrap = createElement("div", "v2-setlist-field");
  usageWrap.append(usageLabel, usageSelect);
  const notesWrap = createElement("div", "v2-setlist-field v2-setlist-field-wide");
  notesWrap.append(notesLabel, notesInput);

  fields.append(keyWrap, usageWrap, notesWrap);
  item.append(top, fields);
  return item;
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * /v2/log             → log a new service
 * /v2/log?date=YYYY-MM-DD → pre-fill date (e.g. for editing today)
 */
export function ServiceLoggerPage(
  navigate: (path: string) => void,
  query: URLSearchParams
): HTMLElement {
  const page = createElement("div", "page");
  page.appendChild(createElement("h1", undefined, "Log a Service"));

  const errorEl = createElement("p", "empty-state v2-logger-error");
  const formWrap = createElement("div");
  formWrap.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, formWrap);

  const prefillDate = query.get("date") ?? todayISO();

  withAuth(page, navigate, async () => {
    // Load songs, series, and any existing service for this date in parallel
    const [songsRes, seriesRes, existingRes] = await Promise.all([
      supabase.from("songs").select("*").eq("status", "active").order("title"),
      supabase.from("series").select("*").order("title"),
      supabase.from("services").select("*").eq("service_date", prefillDate).maybeSingle()
    ]);
    if (songsRes.error) throw songsRes.error;

    const allSongs   = songsRes.data ?? [];
    const allSeries  = seriesRes.data ?? [];
    const existing   = existingRes.data ?? null;

    // If editing an existing service, load its songs too
    let existingSongs: Array<{ song_id: string; position: number; key_override: string | null; usage: string | null; notes: string | null }> = [];
    if (existing) {
      const { data } = await supabase.from("service_songs").select("*").eq("service_id", existing.id).order("position");
      existingSongs = data ?? [];
      page.querySelector("h1")!.textContent = "Edit Service";
    }

    // ── State ───────────────────────────────────────────────────────────────
    const songById = new Map(allSongs.map((s) => [s.id, s]));
    const setlist: SetlistEntry[] = existingSongs
      .map((ss) => {
        const song = songById.get(ss.song_id);
        if (!song) return null;
        return { song, keyOverride: ss.key_override ?? "", usage: ss.usage ?? "", notes: ss.notes ?? "" };
      })
      .filter((x): x is SetlistEntry => x !== null);

    formWrap.innerHTML = "";

    // ── Sermon meta grid ────────────────────────────────────────────────────
    const metaGrid = createElement("div", "v2-form-grid planner-meta");

    // Date
    const dateInput = document.createElement("input");
    dateInput.type = "date"; dateInput.className = "search-input";
    dateInput.value = prefillDate; dateInput.required = true;
    const dateWrap = createElement("div", "v2-form-field");
    dateWrap.append(createElement("label", "v2-form-label", "Service date *"), dateInput);

    // Series select + quick-create
    const seriesSelect = document.createElement("select");
    seriesSelect.className = "filter-input";
    const populateSeries = (extra?: SeriesRow) => {
      seriesSelect.innerHTML = "";
      const blank = document.createElement("option");
      blank.value = ""; blank.textContent = "— no series —";
      seriesSelect.appendChild(blank);
      const list = extra ? [extra, ...allSeries.filter((s) => s.id !== extra.id)] : allSeries;
      list.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id; opt.textContent = s.title;
        seriesSelect.appendChild(opt);
      });
      if (extra) seriesSelect.value = extra.id;
    };
    populateSeries();
    if (existing?.series_id) seriesSelect.value = existing.series_id;

    const seriesNewInput = document.createElement("input");
    seriesNewInput.type = "text"; seriesNewInput.className = "search-input";
    seriesNewInput.placeholder = "Quick-create series title…";
    seriesNewInput.style.display = "none";

    const toggleNewSeries = createElement("button", "button-link", "+ new series") as HTMLButtonElement;
    toggleNewSeries.type = "button";
    toggleNewSeries.addEventListener("click", () => {
      const showing = seriesNewInput.style.display !== "none";
      seriesNewInput.style.display = showing ? "none" : "";
      toggleNewSeries.textContent = showing ? "+ new series" : "← pick existing";
      if (!showing) seriesNewInput.focus();
    });

    const seriesWrap = createElement("div", "v2-form-field");
    seriesWrap.append(createElement("label", "v2-form-label", "Series"), seriesSelect, toggleNewSeries, seriesNewInput);

    // Speaker
    const speakerInput = document.createElement("input");
    speakerInput.type = "text"; speakerInput.className = "search-input";
    speakerInput.placeholder = "Speaker name";
    speakerInput.value = existing?.speaker ?? "";
    const speakerWrap = createElement("div", "v2-form-field");
    speakerWrap.append(createElement("label", "v2-form-label", "Speaker"), speakerInput);

    // Sermon title
    const sermonTitleInput = document.createElement("input");
    sermonTitleInput.type = "text"; sermonTitleInput.className = "search-input";
    sermonTitleInput.placeholder = "Sermon title";
    sermonTitleInput.value = existing?.sermon_title ?? "";
    const sermonTitleWrap = createElement("div", "v2-form-field");
    sermonTitleWrap.append(createElement("label", "v2-form-label", "Sermon title"), sermonTitleInput);

    // Scripture
    const scriptureInput = document.createElement("input");
    scriptureInput.type = "text"; scriptureInput.className = "search-input";
    scriptureInput.placeholder = "e.g. Romans 8:1–11";
    scriptureInput.value = existing?.sermon_scripture_ref ?? "";
    const scriptureWrap = createElement("div", "v2-form-field");
    scriptureWrap.append(createElement("label", "v2-form-label", "Scripture ref"), scriptureInput);

    // Notes
    const notesTextarea = document.createElement("textarea");
    notesTextarea.className = "search-input"; notesTextarea.rows = 2;
    notesTextarea.placeholder = "Service notes (optional)";
    notesTextarea.value = existing?.sermon_notes ?? "";
    const notesWrap = createElement("div", "v2-form-field v2-form-field-full");
    notesWrap.append(createElement("label", "v2-form-label", "Sermon notes"), notesTextarea);

    metaGrid.append(dateWrap, seriesWrap, speakerWrap, sermonTitleWrap, scriptureWrap, notesWrap);
    formWrap.appendChild(metaGrid);

    // ── Setlist section ──────────────────────────────────────────────────────
    const setlistSection = createElement("div", "detail-block v2-setlist-section");
    setlistSection.appendChild(createElement("h2", undefined, "Setlist"));

    const setlistEl = createElement("ol", "planner-list v2-setlist");
    const emptyMsg  = createElement("p", "empty-state", "No songs added yet.");
    setlistEl.appendChild(emptyMsg);

    const renderSetlist = () => {
      setlistEl.innerHTML = "";
      if (setlist.length === 0) {
        setlistEl.appendChild(emptyMsg);
        return;
      }
      setlist.forEach((entry, idx) => {
        setlistEl.appendChild(
          buildSetlistItem(
            entry, idx, setlist.length,
            (from, to) => {
              const [removed] = setlist.splice(from, 1);
              setlist.splice(to, 0, removed);
              renderSetlist();
            },
            (removeIdx) => {
              setlist.splice(removeIdx, 1);
              renderSetlist();
            },
            () => { /* onChange — nothing extra needed */ }
          )
        );
      });
    };

    const typeahead = buildTypeahead(allSongs, (song) => {
      if (setlist.some((e) => e.song.id === song.id)) return; // no duplicates
      setlist.push({ song, keyOverride: "", usage: "", notes: "" });
      renderSetlist();
    });

    setlistSection.append(typeahead, setlistEl);
    formWrap.appendChild(setlistSection);

    // ── Save ─────────────────────────────────────────────────────────────────
    const actions = createElement("div", "planner-actions");
    const saveBtn = createElement("button", "button-primary", "Save service") as HTMLButtonElement;
    saveBtn.type = "button";
    const cancelBtn = createElement("button", "button-secondary", "Cancel") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => navigate("/v2"));
    actions.append(saveBtn, cancelBtn);
    formWrap.appendChild(actions);

    saveBtn.addEventListener("click", async () => {
      errorEl.textContent = "";
      const serviceDate = dateInput.value;
      if (!serviceDate) { errorEl.textContent = "Service date is required."; return; }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        // Maybe create a new series first
        let seriesId: string | null = seriesSelect.value || null;
        const newSeriesTitle = seriesNewInput.value.trim();
        if (seriesNewInput.style.display !== "none" && newSeriesTitle) {
          const newSlug = slugify(newSeriesTitle);
          const { data: newSeries, error: seriesErr } = await supabase
            .from("series")
            .upsert({ slug: newSlug, title: newSeriesTitle }, { onConflict: "slug" })
            .select("id")
            .single();
          if (seriesErr) throw seriesErr;
          seriesId = newSeries.id;
        }

        // Upsert the service (unique on service_date)
        const { data: service, error: svcErr } = await supabase
          .from("services")
          .upsert(
            {
              service_date:         serviceDate,
              series_id:            seriesId,
              sermon_title:         sermonTitleInput.value.trim() || null,
              speaker:              speakerInput.value.trim() || null,
              sermon_scripture_ref: scriptureInput.value.trim() || null,
              sermon_notes:         notesTextarea.value.trim() || null
            },
            { onConflict: "service_date" }
          )
          .select("id")
          .single();
        if (svcErr) throw svcErr;

        const serviceId = service.id;

        // Replace service_songs
        const { error: delErr } = await supabase.from("service_songs").delete().eq("service_id", serviceId);
        if (delErr) throw delErr;

        if (setlist.length > 0) {
          const { error: insertErr } = await supabase.from("service_songs").insert(
            setlist.map((entry, idx) => ({
              service_id:   serviceId,
              song_id:      entry.song.id,
              position:     idx + 1,
              usage:        entry.usage || null,
              key_override: entry.keyOverride || null,
              notes:        entry.notes || null
            }))
          );
          if (insertErr) throw insertErr;
        }

        navigate("/v2");
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "Save failed.";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save service";
      }
    });
  });

  return page;
}

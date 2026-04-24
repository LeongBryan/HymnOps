import Fuse from "fuse.js";
import { supabase } from "../../lib/supabase";
import type { SongRow, SeriesRow } from "../../lib/supabase";
import { withPublicPage } from "../auth";
import { createElement, formatDate } from "../../utils";
import {
  buildServiceWhatsappMessage,
  openServiceWhatsappModal
} from "../serviceWhatsapp";

// ─── Local types (not in auto-generated schema) ───────────────────────────────

interface PlanRow {
  id: string;
  plan_name: string;
  service_date: string | null;
  series_id: string | null;
  speaker: string | null;
  sermon_title: string | null;
  scripture_ref: string | null;
  notes: string | null;
  selected_themes: string[] | null;
  created_at: string;
  updated_at: string;
}

interface PlanSongRow {
  id: string;
  plan_id: string;
  song_id: string;
  position: number;
  key_override: string | null;
  usage: string | null;
  notes: string | null;
}

interface SetlistEntry {
  song: SongRow;
  keyOverride: string;
  usage: string;
  notes: string;
}

interface SongUsageInfo {
  lastDate: string | null;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function computePlanName(date: string, sermonTitle: string): string {
  if (date && sermonTitle.trim()) return `${date} — ${sermonTitle.trim()}`;
  if (date) return `Service Plan — ${formatDate(date)}`;
  if (sermonTitle.trim()) return `Plan: ${sermonTitle.trim()}`;
  return "New Service Plan";
}

function weeksAgo(dateStr: string): number {
  const then = new Date(dateStr + "T00:00:00").getTime();
  return Math.floor((Date.now() - then) / (7 * 24 * 60 * 60 * 1000));
}

function usageBadgeClass(lastDate: string | null): string {
  if (!lastDate) return "usage-never";
  const w = weeksAgo(lastDate);
  if (w < 4)  return "usage-recent";
  if (w < 12) return "usage-moderate";
  return "usage-old";
}

function usageBadgeLabel(lastDate: string | null, count: number): string {
  const countSuffix = count > 1 ? ` · ${count}×` : "";
  if (!lastDate) return count > 0 ? `${count}×` : "Never used";
  const w = weeksAgo(lastDate);
  if (w === 0) return `This week${countSuffix}`;
  if (w === 1) return `1 wk ago${countSuffix}`;
  return `${w} wks ago${countSuffix}`;
}

// ─── Typeahead with usage badge ───────────────────────────────────────────────

function buildTypeahead(
  songs: SongRow[],
  songUsage: Map<string, SongUsageInfo>,
  onSelect: (song: SongRow) => void
): HTMLElement {
  const fuse = new Fuse(songs, {
    keys: ["title", "original_artist_name", "default_key", "ccli_number"],
    threshold: 0.35
  });

  const wrap = createElement("div", "v2-typeahead-wrap");
  wrap.appendChild(createElement("label", "v2-form-label", "Add song to setlist"));

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
      dropdown.appendChild(createElement("li", "v2-typeahead-item v2-typeahead-empty", "No matches"));
    } else {
      for (const { item } of results) {
        const li = createElement("li", "v2-typeahead-item");
        const topRow = createElement("div", "v2-typeahead-item-top");
        const title = createElement("span", "list-primary", item.title);
        const usage = songUsage.get(item.id);
        const badge = createElement(
          "span",
          `usage-badge ${usageBadgeClass(usage?.lastDate ?? null)}`,
          usageBadgeLabel(usage?.lastDate ?? null, usage?.count ?? 0)
        );
        topRow.append(title, badge);
        const meta = createElement("span", "list-secondary", [
          item.original_artist_name,
          item.default_key ? `key: ${item.default_key}` : null
        ].filter(Boolean).join(" · ") || "");
        li.append(topRow, meta);
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
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

// ─── Setlist item ─────────────────────────────────────────────────────────────

function buildSetlistItem(
  entry: SetlistEntry,
  index: number,
  total: number,
  onMove: (from: number, to: number) => void,
  onRemove: (index: number) => void,
  songUsage: Map<string, SongUsageInfo>
): HTMLElement {
  const item = createElement("li", "planner-item v2-setlist-item");

  const top = createElement("div", "planner-item-top");

  const orderBtns = createElement("div", "v2-order-btns");
  const upBtn = createElement("button", "button-secondary v2-order-btn", "↑") as HTMLButtonElement;
  upBtn.type = "button"; upBtn.title = "Move up"; upBtn.disabled = index === 0;
  upBtn.addEventListener("click", () => onMove(index, index - 1));
  const downBtn = createElement("button", "button-secondary v2-order-btn", "↓") as HTMLButtonElement;
  downBtn.type = "button"; downBtn.title = "Move down"; downBtn.disabled = index === total - 1;
  downBtn.addEventListener("click", () => onMove(index, index + 1));
  orderBtns.append(upBtn, downBtn);

  const titleEl = createElement("span", "list-primary v2-setlist-title", entry.song.title);
  if (entry.song.original_artist_name) {
    titleEl.appendChild(createElement("span", "list-secondary v2-setlist-artist", entry.song.original_artist_name));
  }

  const usage = songUsage.get(entry.song.id);
  const badge = createElement(
    "span",
    `usage-badge ${usageBadgeClass(usage?.lastDate ?? null)}`,
    usageBadgeLabel(usage?.lastDate ?? null, usage?.count ?? 0)
  );

  const removeBtn = createElement("button", "button-link v2-setlist-remove", "Remove") as HTMLButtonElement;
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => onRemove(index));

  top.append(orderBtns, titleEl, badge, removeBtn);

  const fields = createElement("div", "v2-setlist-fields");

  const keyInput = document.createElement("input");
  keyInput.type = "text"; keyInput.className = "search-input v2-setlist-key";
  keyInput.placeholder = entry.song.default_key ? `default: ${entry.song.default_key}` : "key";
  keyInput.value = entry.keyOverride;
  keyInput.addEventListener("input", () => { entry.keyOverride = keyInput.value.trim(); });

  const usageSelect = document.createElement("select");
  usageSelect.className = "filter-input v2-setlist-usage";
  [
    ["",             "usage…"],
    ["opening",      "Opening"],
    ["kid-friendly", "Kid-friendly"],
    ["main",         "Main"],
    ["response",     "Response"],
    ["closing",      "Closing"]
  ].forEach(([val, label]) => {
    const opt = document.createElement("option");
    opt.value = val; opt.textContent = label;
    if (entry.usage === val) opt.selected = true;
    usageSelect.appendChild(opt);
  });
  usageSelect.addEventListener("change", () => { entry.usage = usageSelect.value; });

  const notesInput = document.createElement("input");
  notesInput.type = "text"; notesInput.className = "search-input v2-setlist-notes";
  notesInput.placeholder = "Notes (optional)";
  notesInput.value = entry.notes;
  notesInput.addEventListener("input", () => { entry.notes = notesInput.value.trim(); });

  const keyWrap = createElement("div", "v2-setlist-field");
  keyWrap.append(createElement("label", "v2-form-label", "Key"), keyInput);
  const usageWrap = createElement("div", "v2-setlist-field");
  usageWrap.append(createElement("label", "v2-form-label", "Usage"), usageSelect);
  const notesWrap = createElement("div", "v2-setlist-field v2-setlist-field-wide");
  notesWrap.append(createElement("label", "v2-form-label", "Notes"), notesInput);

  fields.append(keyWrap, usageWrap, notesWrap);
  item.append(top, fields);
  return item;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ServicePlannerPage(
  navigate: (path: string) => void,
  query: URLSearchParams
): HTMLElement {
  const page = createElement("div", "page");
  page.appendChild(createElement("h1", undefined, "Service Planner"));

  const formWrap = createElement("div");
  formWrap.appendChild(createElement("p", "empty-state", "Loading…"));
  page.appendChild(formWrap);

  const prefillPlanId = query.get("id") ?? null;

  withPublicPage(page, async (isAuthenticated) => {
    // ── Load data ────────────────────────────────────────────────────────────
    const [songsRes, seriesRes, themesRes, serviceSongsRes, servicesRes] = await Promise.all([
      supabase.from("songs").select("*").eq("status", "active").order("title"),
      supabase.from("series").select("*").order("title"),
      supabase.from("song_themes").select("*"),
      supabase.from("service_songs").select("song_id, service_id"),
      supabase.from("services").select("id, service_date")
    ]);

    const allSongs   = songsRes.data ?? [];
    const allSeries  = seriesRes.data ?? [];
    const allThemes  = themesRes.data ?? [];

    // Build song usage map from historical service data
    const serviceDateById = new Map((servicesRes.data ?? []).map((s) => [s.id, s.service_date]));
    const songUsage = new Map<string, SongUsageInfo>();
    for (const row of (serviceSongsRes.data ?? [])) {
      const date = serviceDateById.get(row.service_id) ?? null;
      const info = songUsage.get(row.song_id) ?? { lastDate: null, count: 0 };
      info.count++;
      if (date && (!info.lastDate || date > info.lastDate)) info.lastDate = date;
      songUsage.set(row.song_id, info);
    }

    // Build maps for theme lookups
    const songThemeMap = new Map<string, string[]>();
    for (const row of allThemes) {
      const existing = songThemeMap.get(row.song_id) ?? [];
      existing.push(row.theme);
      songThemeMap.set(row.song_id, existing);
    }
    const uniqueThemes = [...new Set(allThemes.map((t) => t.theme))].sort();

    // Load existing plan if editing
    let existingPlan: PlanRow | null = null;
    let existingPlanSongs: PlanSongRow[] = [];
    if (prefillPlanId) {
      try {
        const planRes = await (supabase as any).from("plans").select("*").eq("id", prefillPlanId).maybeSingle();
        existingPlan = planRes.data ?? null;
        if (existingPlan) {
          const psRes = await (supabase as any).from("plan_songs").select("*").eq("plan_id", prefillPlanId).order("position");
          existingPlanSongs = psRes.data ?? [];
        }
      } catch { /* plans table may not exist yet */ }
    }

    // Load saved plans list (auth only)
    let savedPlans: PlanRow[] = [];
    if (isAuthenticated) {
      try {
        const plansRes = await (supabase as any).from("plans").select("*").order("updated_at", { ascending: false }).limit(30);
        if (!plansRes.error) savedPlans = plansRes.data ?? [];
      } catch { /* plans table may not exist yet */ }
    }

    // ── State ────────────────────────────────────────────────────────────────
    const songById = new Map(allSongs.map((s) => [s.id, s]));
    const setlist: SetlistEntry[] = existingPlanSongs
      .map((ps) => {
        const song = songById.get(ps.song_id);
        if (!song) return null;
        return { song, keyOverride: ps.key_override ?? "", usage: ps.usage ?? "", notes: ps.notes ?? "" };
      })
      .filter((x): x is SetlistEntry => x !== null);

    const selectedThemes = new Set<string>(existingPlan?.selected_themes ?? []);
    let planNameManuallyEdited = !!existingPlan;

    formWrap.innerHTML = "";

    // ── Plan name bar ────────────────────────────────────────────────────────
    const planNameBar = createElement("div", "planner-plan-name-bar");
    const planNameInput = document.createElement("input");
    planNameInput.type = "text";
    planNameInput.className = "search-input planner-plan-name-input";
    planNameInput.placeholder = "Plan name (auto-generated from date + sermon title)";
    planNameInput.value = existingPlan?.plan_name ?? "";
    planNameInput.addEventListener("input", () => { planNameManuallyEdited = true; });
    planNameBar.append(createElement("label", "v2-form-label", "Plan name"), planNameInput);
    formWrap.appendChild(planNameBar);

    // updatePlanName is called after dateInput and sermonTitleInput are defined
    const updatePlanName = () => {
      if (!planNameManuallyEdited) {
        planNameInput.value = computePlanName(dateInput.value, sermonTitleInput.value);
      }
    };

    // ── Saved plans section ──────────────────────────────────────────────────
    if (isAuthenticated) {
      const savedSection = createElement("div", "detail-block planner-saved-section");
      const savedHeader = createElement("div", "planner-saved-header");
      const savedTitle = createElement("h3", undefined,
        savedPlans.length > 0 ? `Saved Plans (${savedPlans.length})` : "Saved Plans"
      );
      const newPlanBtn = createElement("button", "button-secondary", "+ New plan") as HTMLButtonElement;
      newPlanBtn.type = "button";
      newPlanBtn.addEventListener("click", () => navigate("/planner"));
      const toggleBtn = createElement("button", "button-secondary", savedPlans.length > 0 ? "Show" : "") as HTMLButtonElement;
      toggleBtn.type = "button";
      toggleBtn.style.display = savedPlans.length > 0 ? "" : "none";

      savedHeader.append(savedTitle, newPlanBtn, toggleBtn);

      const savedList = createElement("div", "planner-saved-list");
      savedList.style.display = "none";

      if (savedPlans.length === 0) {
        savedList.appendChild(createElement("p", "empty-state", "No plans saved yet."));
        savedList.style.display = "";
      }

      let expanded = false;
      toggleBtn.addEventListener("click", () => {
        expanded = !expanded;
        savedList.style.display = expanded ? "" : "none";
        toggleBtn.textContent = expanded ? "Hide" : "Show";
      });

      for (const plan of savedPlans) {
        const row = createElement("div", "planner-saved-row");
        const isCurrentPlan = plan.id === prefillPlanId;

        const info = createElement("div", "planner-saved-info");
        const nameEl = createElement("span", `list-primary${isCurrentPlan ? " planner-current-plan" : ""}`, plan.plan_name);
        const metaParts = [
          plan.service_date ? formatDate(plan.service_date) : null,
          plan.sermon_title ?? null,
          plan.speaker ?? null
        ].filter(Boolean);
        const metaEl = createElement("span", "list-secondary", metaParts.join(" · ") || "No details");
        info.append(nameEl, metaEl);

        const rowActions = createElement("div", "v2-item-actions");
        if (!isCurrentPlan) {
          const loadBtn = createElement("button", "button-secondary", "Load") as HTMLButtonElement;
          loadBtn.type = "button";
          loadBtn.addEventListener("click", () => navigate(`/planner?id=${plan.id}`));
          rowActions.appendChild(loadBtn);
        } else {
          rowActions.appendChild(createElement("span", "chip", "Current"));
        }
        const deleteBtn = createElement("button", "button-link v2-delete-btn", "Delete") as HTMLButtonElement;
        deleteBtn.type = "button";
        deleteBtn.addEventListener("click", async () => {
          if (!confirm(`Delete "${plan.plan_name}"?`)) return;
          await (supabase as any).from("plans").delete().eq("id", plan.id);
          row.remove();
          if (savedPlans.length === 1) {
            savedTitle.textContent = "Saved Plans";
            toggleBtn.style.display = "none";
            savedList.appendChild(createElement("p", "empty-state", "No plans saved yet."));
            savedList.style.display = "";
          }
        });
        rowActions.appendChild(deleteBtn);

        row.append(info, rowActions);
        savedList.appendChild(row);
      }

      savedSection.append(savedHeader, savedList);
      formWrap.appendChild(savedSection);
    }

    // ── Sermon metadata ──────────────────────────────────────────────────────
    formWrap.appendChild(createElement("h2", "planner-section-heading", "Service Details"));
    const metaGrid = createElement("div", "v2-form-grid planner-meta");

    const dateInput = document.createElement("input");
    dateInput.type = "date"; dateInput.className = "search-input";
    dateInput.value = existingPlan?.service_date ?? "";
    dateInput.addEventListener("input", updatePlanName);
    const dateWrap = createElement("div", "v2-form-field");
    dateWrap.append(createElement("label", "v2-form-label", "Service date"), dateInput);

    // Series with quick-create
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
    if (existingPlan?.series_id) seriesSelect.value = existingPlan.series_id;

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

    const speakerInput = document.createElement("input");
    speakerInput.type = "text"; speakerInput.className = "search-input";
    speakerInput.placeholder = "Speaker name";
    speakerInput.value = existingPlan?.speaker ?? "";
    const speakerWrap = createElement("div", "v2-form-field");
    speakerWrap.append(createElement("label", "v2-form-label", "Speaker"), speakerInput);

    const sermonTitleInput = document.createElement("input");
    sermonTitleInput.type = "text"; sermonTitleInput.className = "search-input";
    sermonTitleInput.placeholder = "Sermon title";
    sermonTitleInput.value = existingPlan?.sermon_title ?? "";
    sermonTitleInput.addEventListener("input", updatePlanName);
    const sermonTitleWrap = createElement("div", "v2-form-field");
    sermonTitleWrap.append(createElement("label", "v2-form-label", "Sermon title"), sermonTitleInput);

    const scriptureInput = document.createElement("input");
    scriptureInput.type = "text"; scriptureInput.className = "search-input";
    scriptureInput.placeholder = "e.g. Romans 8:1–11";
    scriptureInput.value = existingPlan?.scripture_ref ?? "";
    const scriptureWrap = createElement("div", "v2-form-field");
    scriptureWrap.append(createElement("label", "v2-form-label", "Scripture ref"), scriptureInput);

    const notesTextarea = document.createElement("textarea");
    notesTextarea.className = "search-input"; notesTextarea.rows = 2;
    notesTextarea.placeholder = "Planning notes — internal, not exported";
    notesTextarea.value = existingPlan?.notes ?? "";
    const notesWrap = createElement("div", "v2-form-field v2-form-field-full");
    notesWrap.append(createElement("label", "v2-form-label", "Notes"), notesTextarea);

    metaGrid.append(dateWrap, seriesWrap, speakerWrap, sermonTitleWrap, scriptureWrap, notesWrap);
    formWrap.appendChild(metaGrid);

    // Initialise plan name now that inputs exist
    updatePlanName();

    // ── Theme selector ───────────────────────────────────────────────────────
    const themeSection = createElement("div", "detail-block planner-theme-section");
    const themeHeadRow = createElement("div", "planner-saved-header");
    themeHeadRow.append(createElement("h2", undefined, "Themes"));
    if (selectedThemes.size > 0) {
      const clearThemes = createElement("button", "button-link", "Clear all") as HTMLButtonElement;
      clearThemes.type = "button";
      clearThemes.addEventListener("click", () => {
        selectedThemes.clear();
        renderThemeChips();
        renderSuggestions();
      });
      themeHeadRow.appendChild(clearThemes);
    }
    themeSection.appendChild(themeHeadRow);
    themeSection.appendChild(
      createElement("p", "list-secondary", "Select one or more themes to see matching song suggestions below.")
    );
    const themeChipRow = createElement("div", "planner-theme-row");

    const renderThemeChips = () => {
      themeChipRow.innerHTML = "";
      if (uniqueThemes.length === 0) {
        themeChipRow.appendChild(createElement("span", "empty-state", "No themes in song library."));
        return;
      }
      for (const theme of uniqueThemes) {
        const chip = createElement(
          "button",
          `planner-theme-toggle${selectedThemes.has(theme) ? " is-active" : ""}`,
          theme
        ) as HTMLButtonElement;
        chip.type = "button";
        chip.addEventListener("click", () => {
          if (selectedThemes.has(theme)) selectedThemes.delete(theme);
          else selectedThemes.add(theme);
          renderThemeChips();
          renderSuggestions();
        });
        themeChipRow.appendChild(chip);
      }
    };

    themeSection.appendChild(themeChipRow);
    formWrap.appendChild(themeSection);

    // ── Suggestions ──────────────────────────────────────────────────────────
    const suggestionsSection = createElement("div", "detail-block planner-suggestions-section");
    const suggestHeaderRow = createElement("div", "planner-saved-header");
    suggestHeaderRow.appendChild(createElement("h2", undefined, "Suggestions"));
    const suggestCountEl = createElement("span", "list-secondary planner-suggest-count");
    suggestHeaderRow.appendChild(suggestCountEl);
    suggestionsSection.appendChild(suggestHeaderRow);

    const legendRow = createElement("div", "planner-usage-legend");
    [
      ["usage-old",      "≥ 12 wks ago"],
      ["usage-moderate", "4–11 wks ago"],
      ["usage-recent",   "< 4 wks ago"],
      ["usage-never",    "Never / count only"]
    ].forEach(([cls, label]) => {
      const item = createElement("span", "planner-legend-item");
      item.appendChild(createElement("span", `usage-badge ${cls}`, "●"));
      item.appendChild(document.createTextNode(` ${label}`));
      legendRow.appendChild(item);
    });
    suggestionsSection.appendChild(legendRow);

    const suggestionsContainer = createElement("div", "planner-suggestions-list");
    suggestionsSection.appendChild(suggestionsContainer);
    formWrap.appendChild(suggestionsSection);

    const renderSuggestions = () => {
      suggestionsContainer.innerHTML = "";

      if (selectedThemes.size === 0) {
        suggestCountEl.textContent = "";
        suggestionsContainer.appendChild(
          createElement("p", "empty-state", "Select themes above to see matching song suggestions.")
        );
        return;
      }

      const setlistIds = new Set(setlist.map((e) => e.song.id));
      const matched = allSongs.filter((song) => {
        if (setlistIds.has(song.id)) return false;
        const themes = songThemeMap.get(song.id) ?? [];
        return themes.some((t) => selectedThemes.has(t));
      });

      suggestCountEl.textContent = matched.length > 0 ? `${matched.length} match${matched.length === 1 ? "" : "es"}` : "";

      if (matched.length === 0) {
        suggestionsContainer.appendChild(
          createElement("p", "empty-state", "No songs found for these themes. Try selecting different themes.")
        );
        return;
      }

      // Sort: longest-not-used first (best to revisit), never-used last
      matched.sort((a, b) => {
        const au = songUsage.get(a.id);
        const bu = songUsage.get(b.id);
        if (!au?.lastDate && !bu?.lastDate) return a.title.localeCompare(b.title);
        if (!au?.lastDate) return 1;
        if (!bu?.lastDate) return -1;
        return au.lastDate < bu.lastDate ? -1 : au.lastDate > bu.lastDate ? 1 : 0;
      });

      const shown = matched.slice(0, 30);
      for (const song of shown) {
        const usage = songUsage.get(song.id);
        const badgeClass = usageBadgeClass(usage?.lastDate ?? null);
        const badgeLabel = usageBadgeLabel(usage?.lastDate ?? null, usage?.count ?? 0);
        const themes = songThemeMap.get(song.id) ?? [];

        const row = createElement("div", "planner-suggestion-item");

        const info = createElement("div", "planner-suggestion-info");
        const topRow = createElement("div", "planner-suggestion-top");
        topRow.append(
          createElement("span", "list-primary", song.title),
          createElement("span", `usage-badge ${badgeClass}`, badgeLabel)
        );
        const metaParts = [
          song.original_artist_name ?? null,
          song.default_key ? `key: ${song.default_key}` : null
        ].filter(Boolean);
        const meta = createElement("p", "list-secondary", metaParts.join(" · ") || "");

        const themeChips = createElement("div", "chip-row planner-suggestion-themes");
        themes.forEach((t) => {
          const cls = selectedThemes.has(t) ? "chip chip-match" : "chip";
          themeChips.appendChild(createElement("span", cls, t));
        });

        info.append(topRow, meta, themeChips);

        const addBtn = createElement("button", "button-secondary suggest-add-btn", "+ Add") as HTMLButtonElement;
        addBtn.type = "button";
        addBtn.addEventListener("click", () => {
          if (setlist.some((e) => e.song.id === song.id)) return;
          setlist.push({ song, keyOverride: "", usage: "", notes: "" });
          renderSetlist();
          renderSuggestions();
        });

        row.append(info, addBtn);
        suggestionsContainer.appendChild(row);
      }

      if (matched.length > 30) {
        suggestionsContainer.appendChild(
          createElement("p", "list-secondary", `…and ${matched.length - 30} more. Refine themes or use search below.`)
        );
      }
    };

    // ── Setlist ──────────────────────────────────────────────────────────────
    const setlistSection = createElement("div", "detail-block v2-setlist-section");
    const setlistHeaderRow = createElement("div", "planner-setlist-header");
    setlistHeaderRow.appendChild(createElement("h2", undefined, "Setlist"));
    const setlistCountEl = createElement("span", "list-secondary");
    const clearAllBtn = createElement("button", "button-link", "Clear all") as HTMLButtonElement;
    clearAllBtn.type = "button";
    clearAllBtn.addEventListener("click", () => {
      if (setlist.length === 0) return;
      if (!confirm("Remove all songs from the setlist?")) return;
      setlist.length = 0;
      renderSetlist();
      renderSuggestions();
    });
    setlistHeaderRow.append(setlistCountEl, clearAllBtn);
    setlistSection.appendChild(setlistHeaderRow);

    const setlistEl = createElement("ol", "planner-list v2-setlist");

    const exportBtn = createElement("button", "button-secondary", "Export for WhatsApp") as HTMLButtonElement;
    exportBtn.type = "button";
    exportBtn.addEventListener("click", () => {
      const planName = planNameInput.value || computePlanName(dateInput.value, sermonTitleInput.value);
      const headerLines: string[] = [];
      if (dateInput.value) headerLines.push(`Date: ${formatDate(dateInput.value)}`);
      if (sermonTitleInput.value.trim()) headerLines.push(`Sermon: ${sermonTitleInput.value.trim()}`);
      if (speakerInput.value.trim()) headerLines.push(`Speaker: ${speakerInput.value.trim()}`);
      if (scriptureInput.value.trim()) headerLines.push(`Scripture: ${scriptureInput.value.trim()}`);
      const header = headerLines.join("\n");
      const songLines = buildServiceWhatsappMessage(
        setlist.map((entry) => ({
          title: entry.song.title,
          key: entry.keyOverride || entry.song.default_key
        }))
      );
      const message = header ? `${header}\n\n${songLines}` : songLines;
      openServiceWhatsappModal(planName, message);
    });

    const renderSetlist = () => {
      setlistEl.innerHTML = "";
      const count = setlist.length;
      setlistCountEl.textContent = `${count} song${count === 1 ? "" : "s"}`;
      exportBtn.disabled = count === 0;
      clearAllBtn.disabled = count === 0;

      if (count === 0) {
        setlistEl.appendChild(createElement("p", "empty-state", "No songs added yet. Use suggestions or the search below."));
        return;
      }
      setlist.forEach((entry, idx) => {
        setlistEl.appendChild(
          buildSetlistItem(
            entry, idx, count,
            (from, to) => {
              const [removed] = setlist.splice(from, 1);
              setlist.splice(to, 0, removed);
              renderSetlist();
            },
            (removeIdx) => {
              setlist.splice(removeIdx, 1);
              renderSetlist();
              renderSuggestions();
            },
            songUsage
          )
        );
      });
    };

    const typeahead = buildTypeahead(allSongs, songUsage, (song) => {
      if (setlist.some((e) => e.song.id === song.id)) return;
      setlist.push({ song, keyOverride: "", usage: "", notes: "" });
      renderSetlist();
      renderSuggestions();
    });

    setlistSection.append(typeahead, setlistEl);
    formWrap.appendChild(setlistSection);

    // ── Actions ──────────────────────────────────────────────────────────────
    const errorEl = createElement("p", "empty-state v2-logger-error");
    const actions = createElement("div", "planner-actions");

    const saveBtn = createElement(
      "button",
      "button-primary",
      isAuthenticated ? (prefillPlanId ? "Update plan" : "Save plan") : "Sign in to save"
    ) as HTMLButtonElement;
    saveBtn.type = "button";
    saveBtn.disabled = !isAuthenticated;
    saveBtn.title = !isAuthenticated ? "Sign in to save plans" : "";

    actions.append(exportBtn, saveBtn);
    formWrap.append(errorEl, actions);

    // ── Initial render ───────────────────────────────────────────────────────
    renderThemeChips();
    renderSuggestions();
    renderSetlist();

    if (!isAuthenticated) return;

    saveBtn.addEventListener("click", async () => {
      errorEl.textContent = "";
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
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
          populateSeries({ id: newSeries.id, slug: newSlug, title: newSeriesTitle, description: null, created_at: "", updated_at: "" });
        }

        const planName = planNameInput.value.trim() || computePlanName(dateInput.value, sermonTitleInput.value);

        const planPayload = {
          plan_name:       planName,
          service_date:    dateInput.value || null,
          series_id:       seriesId,
          speaker:         speakerInput.value.trim() || null,
          sermon_title:    sermonTitleInput.value.trim() || null,
          scripture_ref:   scriptureInput.value.trim() || null,
          notes:           notesTextarea.value.trim() || null,
          selected_themes: [...selectedThemes],
          updated_at:      new Date().toISOString()
        };

        let planId: string;
        if (prefillPlanId) {
          const { error } = await (supabase as any).from("plans").update(planPayload).eq("id", prefillPlanId);
          if (error) throw error;
          planId = prefillPlanId;
        } else {
          const { data: newPlan, error } = await (supabase as any)
            .from("plans").insert(planPayload).select("id").single();
          if (error) throw error;
          planId = newPlan.id;
        }

        // Replace plan songs
        await (supabase as any).from("plan_songs").delete().eq("plan_id", planId);
        if (setlist.length > 0) {
          const { error: insertErr } = await (supabase as any).from("plan_songs").insert(
            setlist.map((entry, idx) => ({
              plan_id:      planId,
              song_id:      entry.song.id,
              position:     idx + 1,
              usage:        entry.usage || null,
              key_override: entry.keyOverride || null,
              notes:        entry.notes || null
            }))
          );
          if (insertErr) throw insertErr;
        }

        navigate(`/planner?id=${planId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Save failed.";
        const isNoTable = msg.includes("relation") && msg.includes("does not exist");
        errorEl.textContent = isNoTable
          ? "Plans table not found — run the DB migration first (see docs)."
          : msg;
        saveBtn.disabled = false;
        saveBtn.textContent = prefillPlanId ? "Update plan" : "Save plan";
      }
    });
  });

  return page;
}

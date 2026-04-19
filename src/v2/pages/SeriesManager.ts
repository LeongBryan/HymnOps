import { supabase } from "../../lib/supabase";
import type { SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement, formatDate } from "../../utils";

// Slugs (or title keywords) that belong in "Special Services"
const SPECIAL_SLUGS = new Set([
  "new-year-sermon",
  "good-friday",
  "christmas-carols",
  "missions-month",
  "open-ministry"
]);
const SPECIAL_TITLE_KEYWORDS = ["easter", "christmas", "good friday", "new year", "missions", "open ministry"];

function isSpecial(s: SeriesRow): boolean {
  if (SPECIAL_SLUGS.has(s.slug)) return true;
  const lower = s.title.toLowerCase();
  return SPECIAL_TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

function shortDate(iso: string): string {
  // "2025-04-06" → "Apr 2025"
  const [year, month] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(month) - 1]} ${year}`;
}

function dateRange(first: string | undefined, last: string | undefined): string {
  if (!first) return "";
  if (!last || first === last) return shortDate(first);
  const fy = first.slice(0, 4), ly = last.slice(0, 4);
  // Same year: "Apr – Oct 2024"
  if (fy === ly) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const fm = months[Number(first.split("-")[1]) - 1];
    const lm = months[Number(last.split("-")[1]) - 1];
    return fm === lm ? `${fm} ${fy}` : `${fm} – ${lm} ${fy}`;
  }
  return `${shortDate(first)} – ${shortDate(last)}`;
}

export function SeriesManagerPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page");

  const headerRow = createElement("div", "v2-page-header");
  headerRow.appendChild(createElement("h1", undefined, "Series"));
  const addBtn = createElement("button", "button-primary", "+ Add series") as HTMLButtonElement;
  addBtn.type = "button";
  headerRow.appendChild(addBtn);
  page.appendChild(headerRow);

  const errorEl = createElement("p", "v2-logger-error");
  const listWrap = createElement("div");
  listWrap.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, listWrap);

  let allSeries: SeriesRow[] = [];
  // most-recent service date per series id
  let latestDate = new Map<string, string>();
  let firstDate  = new Map<string, string>();

  const buildSeriesItem = (s: SeriesRow) => {
    const li = createElement("li", "v2-song-item");
    const top = createElement("div", "v2-song-item-top");

    const titleLink = createElement("a", "list-primary", s.title) as HTMLAnchorElement;
    titleLink.href = `#/series/${s.slug}`;
    titleLink.addEventListener("click", (e) => { e.preventDefault(); navigate(`/series/${s.slug}`); });
    top.appendChild(titleLink);

    const range = dateRange(firstDate.get(s.id), latestDate.get(s.id));
    const meta = createElement("span", "list-secondary");
    const metaParts: string[] = [];
    if (range) metaParts.push(range);
    if (s.description) metaParts.push(s.description);
    meta.textContent = metaParts.join(" · ");
    top.appendChild(meta);

    const editBtn = createElement("button", "button-secondary", "Edit") as HTMLButtonElement;
    editBtn.type = "button";
    editBtn.addEventListener("click", () => openForm(s));

    const delBtn = createElement("button", "button-secondary v2-delete-btn", "Delete") as HTMLButtonElement;
    delBtn.type = "button";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete series "${s.title}"?\n\nServices linked to it will lose the series link. This cannot be undone.`)) return;
      delBtn.disabled = true;
      const { error } = await supabase.from("series").delete().eq("id", s.id);
      if (error) { errorEl.textContent = error.message; delBtn.disabled = false; return; }
      allSeries = allSeries.filter((x) => x.id !== s.id);
      renderList();
    });

    const actions = createElement("div", "v2-item-actions");
    actions.append(editBtn, delBtn);
    top.appendChild(actions);
    li.appendChild(top);
    return li;
  };

  type Tab = "regular" | "special";
  let activeTab: Tab = "regular";

  const renderList = () => {
    listWrap.innerHTML = "";

    // ── Tab toggle ─────────────────────────────────────────────────────────
    const tabs = createElement("div", "v2-tab-bar");
    (["regular", "special"] as Tab[]).forEach((tab) => {
      const label = tab === "regular" ? "Sermon Series" : "Special Services";
      const btn = createElement("button",
        `v2-tab-btn${tab === activeTab ? " is-active" : ""}`, label) as HTMLButtonElement;
      btn.type = "button";
      btn.addEventListener("click", () => { activeTab = tab; renderList(); });
      tabs.appendChild(btn);
    });
    listWrap.appendChild(tabs);

    if (allSeries.length === 0) {
      listWrap.appendChild(createElement("p", "empty-state", "No series yet."));
      return;
    }

    const byDate = (a: SeriesRow, b: SeriesRow) => {
      const da = latestDate.get(a.id) ?? "";
      const db = latestDate.get(b.id) ?? "";
      return db.localeCompare(da) || a.title.localeCompare(b.title);
    };

    const visible = allSeries
      .filter((s) => activeTab === "special" ? isSpecial(s) : !isSpecial(s))
      .sort(byDate);

    if (visible.length === 0) {
      listWrap.appendChild(createElement("p", "empty-state", "Nothing here yet."));
      return;
    }

    const ul = createElement("ul", "v2-song-list");
    for (const s of visible) ul.appendChild(buildSeriesItem(s));
    listWrap.appendChild(ul);
  };

  // ── Inline form ──────────────────────────────────────────────────────────────
  const formOverlay = createElement("div", "v2-inline-form-overlay");
  formOverlay.style.display = "none";
  page.appendChild(formOverlay);

  const openForm = (existing?: SeriesRow) => {
    formOverlay.innerHTML = "";
    formOverlay.style.display = "";

    const card = createElement("div", "detail-block v2-inline-form-card");
    card.appendChild(createElement("h2", undefined, existing ? "Edit Series" : "Add Series"));

    const titleInput = document.createElement("input");
    titleInput.type = "text"; titleInput.className = "search-input";
    titleInput.placeholder = "Series title"; titleInput.value = existing?.title ?? "";

    const slugInput = document.createElement("input");
    slugInput.type = "text"; slugInput.className = "search-input";
    slugInput.placeholder = "slug (auto)"; slugInput.value = existing?.slug ?? "";

    const descInput = document.createElement("textarea");
    descInput.className = "search-input"; descInput.rows = 2;
    descInput.placeholder = "Description (optional)"; descInput.value = existing?.description ?? "";

    titleInput.addEventListener("input", () => {
      if (!existing && !slugInput.dataset.manual) slugInput.value = slugify(titleInput.value);
    });
    slugInput.addEventListener("input", () => { slugInput.dataset.manual = "1"; });

    const formErr = createElement("p", "v2-logger-error");

    const saveBtn = createElement("button", "button-primary", "Save") as HTMLButtonElement;
    saveBtn.type = "button";
    const cancelBtn = createElement("button", "button-secondary", "Cancel") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => { formOverlay.style.display = "none"; });

    saveBtn.addEventListener("click", async () => {
      formErr.textContent = "";
      const title = titleInput.value.trim();
      const slug  = slugInput.value.trim();
      if (!title || !slug) { formErr.textContent = "Title and slug are required."; return; }
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";

      const payload = { slug, title, description: descInput.value.trim() || null };
      let error;
      let result: SeriesRow | null = null;

      if (existing) {
        const res = await supabase.from("series").update(payload).eq("id", existing.id).select().single();
        error = res.error; result = res.data;
      } else {
        const res = await supabase.from("series").insert(payload).select().single();
        error = res.error; result = res.data;
      }

      if (error || !result) {
        formErr.textContent = error?.message ?? "Save failed.";
        saveBtn.disabled = false; saveBtn.textContent = "Save";
        return;
      }

      if (existing) {
        allSeries = allSeries.map((x) => x.id === result!.id ? result! : x);
      } else {
        allSeries = [...allSeries, result];
      }
      renderList();
      formOverlay.style.display = "none";
    });

    const actions = createElement("div", "planner-actions");
    actions.append(saveBtn, cancelBtn);

    const titleWrap = createElement("div", "v2-form-field");
    titleWrap.append(createElement("label", "v2-form-label", "Title *"), titleInput);
    const slugWrap = createElement("div", "v2-form-field");
    slugWrap.append(createElement("label", "v2-form-label", "Slug *"), slugInput);
    const descWrap = createElement("div", "v2-form-field");
    descWrap.append(createElement("label", "v2-form-label", "Description"), descInput);

    card.append(titleWrap, slugWrap, descWrap, formErr, actions);
    formOverlay.appendChild(card);
  };

  addBtn.addEventListener("click", () => openForm());

  withAuth(page, navigate, async () => {
    const [seriesRes, servicesRes] = await Promise.all([
      supabase.from("series").select("*"),
      supabase.from("services").select("series_id, service_date").not("series_id", "is", null)
    ]);
    if (seriesRes.error) throw seriesRes.error;

    allSeries = seriesRes.data ?? [];

    // Build first/last date maps per series
    for (const sv of servicesRes.data ?? []) {
      if (!sv.series_id) continue;
      const cur = latestDate.get(sv.series_id);
      if (!cur || sv.service_date > cur) latestDate.set(sv.series_id, sv.service_date);
      const curFirst = firstDate.get(sv.series_id);
      if (!curFirst || sv.service_date < curFirst) firstDate.set(sv.series_id, sv.service_date);
    }

    renderList();
  });

  return page;
}

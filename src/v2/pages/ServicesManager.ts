import { supabase } from "../../lib/supabase";
import type { ServiceRow, SeriesRow } from "../../lib/supabase";
import { withPublicPage } from "../auth";
import { createElement, formatDate } from "../../utils";

export function ServicesManagerPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page");

  const headerRow = createElement("div", "v2-page-header");
  headerRow.appendChild(createElement("h1", undefined, "Services"));
  page.appendChild(headerRow);

  const errorEl = createElement("p", "v2-logger-error");
  const listWrap = createElement("div");
  listWrap.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, listWrap);

  withPublicPage(page, async (isAuthenticated) => {
    if (isAuthenticated) {
      const addBtn = createElement("button", "button-primary", "+ Log service") as HTMLButtonElement;
      addBtn.type = "button";
      addBtn.addEventListener("click", () => navigate("/log"));
      headerRow.appendChild(addBtn);
    }
    const [svcRes, seriesRes, ssRes] = await Promise.all([
      supabase.from("services").select("*").order("service_date", { ascending: false }),
      supabase.from("series").select("id, slug, title"),
      supabase.from("service_songs").select("service_id")
    ]);
    if (svcRes.error) throw svcRes.error;

    let allServices = svcRes.data ?? [];
    const seriesById = new Map((seriesRes.data ?? []).map((s) => [s.id, s as SeriesRow]));
    const songCountByService = new Map<string, number>();
    for (const ss of ssRes.data ?? []) {
      songCountByService.set(ss.service_id, (songCountByService.get(ss.service_id) ?? 0) + 1);
    }

    // ── Filter state ─────────────────────────────────────────────────────────
    let filterYear    = "";
    let filterSpeaker = "";

    // Derive filter options from data
    const years    = [...new Set(allServices.map((sv) => sv.service_date.slice(0, 4)))].sort().reverse();
    const speakers = [...new Set(allServices.map((sv) => sv.speaker).filter(Boolean) as string[])].sort();

    // ── Filter bar ───────────────────────────────────────────────────────────
    const filterBar = createElement("div", "v2-filter-bar");

    const yearSelect = document.createElement("select");
    yearSelect.className = "filter-input";
    [["", "All years"], ...years.map((y) => [y, y])].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      yearSelect.appendChild(opt);
    });
    yearSelect.addEventListener("change", () => { filterYear = yearSelect.value; render(); });

    const speakerSelect = document.createElement("select");
    speakerSelect.className = "filter-input";
    [["", "All speakers"], ...speakers.map((sp) => [sp, sp])].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      speakerSelect.appendChild(opt);
    });
    speakerSelect.addEventListener("change", () => { filterSpeaker = speakerSelect.value; render(); });

    const yearWrap = createElement("label", "v2-filter-field");
    yearWrap.append(createElement("span", "filter-label", "Year"), yearSelect);
    const speakerWrap = createElement("label", "v2-filter-field");
    speakerWrap.append(createElement("span", "filter-label", "Speaker"), speakerSelect);
    filterBar.append(yearWrap, speakerWrap);
    page.insertBefore(filterBar, listWrap);

    // ── Render ────────────────────────────────────────────────────────────────
    const render = () => {
      const filtered = allServices.filter((sv) => {
        if (filterYear    && !sv.service_date.startsWith(filterYear)) return false;
        if (filterSpeaker && sv.speaker !== filterSpeaker)            return false;
        return true;
      });

      listWrap.innerHTML = "";
      if (filtered.length === 0) {
        listWrap.appendChild(createElement("p", "empty-state", "No services match this filter."));
        return;
      }

      const ul = createElement("ul", "v2-song-list");
      for (const svc of filtered) {
        ul.appendChild(buildItem(svc));
      }
      listWrap.appendChild(ul);
    };

    const buildItem = (svc: ServiceRow) => {
      const li  = createElement("li",  "v2-song-item");
      const top = createElement("div", "v2-song-item-top");

      const dateLink = createElement("a", "list-primary", formatDate(svc.service_date)) as HTMLAnchorElement;
      dateLink.href = `#/services/${svc.service_date}`;
      dateLink.addEventListener("click", (e) => { e.preventDefault(); navigate(`/services/${svc.service_date}`); });

      const meta = createElement("span", "list-secondary");
      const parts: string[] = [];
      if (svc.sermon_title) parts.push(svc.sermon_title);
      if (svc.speaker)      parts.push(svc.speaker);
      const series = svc.series_id ? seriesById.get(svc.series_id) : null;
      if (series) parts.push(series.title);
      const count = songCountByService.get(svc.id) ?? 0;
      parts.push(`${count} song${count === 1 ? "" : "s"}`);
      meta.textContent = parts.join(" · ");

      top.append(dateLink, meta);

      if (isAuthenticated) {
        const editBtn = createElement("button", "button-secondary", "Edit") as HTMLButtonElement;
        editBtn.type = "button";
        editBtn.addEventListener("click", () => navigate(`/log?date=${svc.service_date}`));

        const delBtn = createElement("button", "button-secondary v2-delete-btn", "Delete") as HTMLButtonElement;
        delBtn.type = "button";
        delBtn.addEventListener("click", async () => {
          if (!confirm(`Delete service on ${formatDate(svc.service_date)}?\n\nThis will also remove all songs logged for that service.`)) return;
          delBtn.disabled = true;
          const { error } = await supabase.from("services").delete().eq("id", svc.id);
          if (error) { errorEl.textContent = error.message; delBtn.disabled = false; return; }
          allServices = allServices.filter((x) => x.id !== svc.id);
          render();
        });

        const actions = createElement("div", "v2-item-actions");
        actions.append(editBtn, delBtn);
        top.appendChild(actions);
      }

      li.appendChild(top);
      return li;
    };

    render();
  });

  return page;
}

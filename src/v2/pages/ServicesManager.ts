import { supabase } from "../../lib/supabase";
import type { SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement, formatDate } from "../../utils";

export function ServicesManagerPage(navigate: (path: string) => void): HTMLElement {
  const page = createElement("div", "page");

  const headerRow = createElement("div", "v2-page-header");
  headerRow.appendChild(createElement("h1", undefined, "Services"));
  const addBtn = createElement("button", "button-primary", "+ Log service") as HTMLButtonElement;
  addBtn.type = "button";
  addBtn.addEventListener("click", () => navigate("/log"));
  headerRow.appendChild(addBtn);
  page.appendChild(headerRow);

  const errorEl = createElement("p", "v2-logger-error");
  const listWrap = createElement("div");
  listWrap.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, listWrap);

  withAuth(page, navigate, async () => {
    const [svcRes, seriesRes, ssRes] = await Promise.all([
      supabase.from("services").select("*").order("service_date", { ascending: false }),
      supabase.from("series").select("id, slug, title"),
      supabase.from("service_songs").select("service_id")
    ]);
    if (svcRes.error) throw svcRes.error;

    let services = svcRes.data ?? [];
    const seriesById = new Map((seriesRes.data ?? []).map((s) => [s.id, s as SeriesRow]));
    const songCountByService = new Map<string, number>();
    for (const ss of ssRes.data ?? []) {
      songCountByService.set(ss.service_id, (songCountByService.get(ss.service_id) ?? 0) + 1);
    }

    const render = () => {
      listWrap.innerHTML = "";
      if (services.length === 0) {
        listWrap.appendChild(createElement("p", "empty-state", "No services logged yet."));
        return;
      }
      const ul = createElement("ul", "v2-song-list");
      for (const svc of services) {
        const li = createElement("li", "v2-song-item");
        const top = createElement("div", "v2-song-item-top");

        const dateEl = createElement("span", "list-primary", formatDate(svc.service_date));
        const meta = createElement("span", "list-secondary");
        const parts: string[] = [];
        if (svc.sermon_title) parts.push(svc.sermon_title);
        if (svc.speaker) parts.push(svc.speaker);
        const series = svc.series_id ? seriesById.get(svc.series_id) : null;
        if (series) parts.push(series.title);
        const count = songCountByService.get(svc.id) ?? 0;
        parts.push(`${count} song${count === 1 ? "" : "s"}`);
        meta.textContent = parts.join(" · ");

        const editBtn = createElement("button", "button-secondary", "Edit") as HTMLButtonElement;
        editBtn.type = "button";
        editBtn.addEventListener("click", () => navigate(`/log?date=${svc.service_date}`));

        const delBtn = createElement("button", "button-secondary v2-delete-btn", "Delete") as HTMLButtonElement;
        delBtn.type = "button";
        delBtn.addEventListener("click", async () => {
          if (!confirm(`Delete service on ${formatDate(svc.service_date)}?`)) return;
          delBtn.disabled = true;
          const { error } = await supabase.from("services").delete().eq("id", svc.id);
          if (error) { errorEl.textContent = error.message; delBtn.disabled = false; return; }
          services = services.filter((x) => x.id !== svc.id);
          render();
        });

        top.append(dateEl, meta, editBtn, delBtn);
        li.appendChild(top);
        ul.appendChild(li);
      }
      listWrap.appendChild(ul);
    };

    render();
  });

  return page;
}

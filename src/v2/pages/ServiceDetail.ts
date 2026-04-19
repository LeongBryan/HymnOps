import { supabase } from "../../lib/supabase";
import { withPublicPage } from "../auth";
import { createElement, formatDate } from "../../utils";
import { toAppHref } from "../../router";

export function ServiceDetailPage(
  navigate: (path: string) => void,
  date: string
): HTMLElement {
  const page = createElement("div", "page");

  const errorEl = createElement("p", "v2-logger-error");
  const content = createElement("div");
  content.appendChild(createElement("p", "empty-state", "Loading…"));
  page.append(errorEl, content);

  withPublicPage(page, async () => {
    const [svcRes, allSeriesRes] = await Promise.all([
      supabase.from("services").select("*").eq("service_date", date).maybeSingle(),
      supabase.from("series").select("id, slug, title")
    ]);

    if (svcRes.error) throw svcRes.error;
    const service = svcRes.data;

    if (!service) {
      content.innerHTML = "";
      content.appendChild(createElement("h1", undefined, "Service not found"));
      content.appendChild(createElement("p", "empty-state", `No service on ${formatDate(date)}.`));
      const back = createElement("button", "button-secondary", "← Services") as HTMLButtonElement;
      back.addEventListener("click", () => navigate("/services"));
      content.appendChild(back);
      return;
    }

    const seriesById = new Map((allSeriesRes.data ?? []).map((s) => [s.id, s]));
    const series = service.series_id ? seriesById.get(service.series_id) : null;

    // Load setlist
    const { data: ssRows } = await supabase
      .from("service_songs")
      .select("*, songs(*)")
      .eq("service_id", service.id)
      .order("position");

    content.innerHTML = "";

    // ── Header ───────────────────────────────────────────────────────────────
    const headerRow = createElement("div", "v2-page-header");
    headerRow.appendChild(createElement("h1", undefined, `Service: ${formatDate(service.service_date)}`));
    const editBtn = createElement("button", "button-secondary", "Edit") as HTMLButtonElement;
    editBtn.addEventListener("click", () => navigate(`/log?date=${service.service_date}`));
    headerRow.appendChild(editBtn);
    content.appendChild(headerRow);

    // ── Sermon block ─────────────────────────────────────────────────────────
    const sermonBlock = createElement("section", "detail-block");
    sermonBlock.appendChild(createElement("h2", undefined, "Sermon"));

    const metaRows: Array<{ label: string; value: string | HTMLElement }> = [
      {
        label: "Series",
        value: series
          ? (() => {
              const a = createElement("a", undefined, series.title) as HTMLAnchorElement;
              a.href = toAppHref(`/series/${series.slug}`);
              a.addEventListener("click", (e) => { e.preventDefault(); navigate(`/series/${series.slug}`); });
              return a;
            })()
          : "—"
      },
      { label: "Sermon title",  value: service.sermon_title ?? "—" },
      { label: "Speaker",       value: service.speaker ?? "—"       },
      { label: "Scripture",     value: service.sermon_scripture_ref ?? "—" },
      { label: "Notes",         value: service.sermon_notes ?? "—"  }
    ];

    const dl = createElement("dl", "v2-detail-list");
    for (const { label, value } of metaRows) {
      const dt = createElement("dt", "v2-detail-label", label);
      const dd = createElement("dd", "v2-detail-value");
      if (typeof value === "string") {
        dd.textContent = value;
      } else {
        dd.appendChild(value);
      }
      dl.append(dt, dd);
    }
    sermonBlock.appendChild(dl);
    content.appendChild(sermonBlock);

    // ── Setlist ───────────────────────────────────────────────────────────────
    const setlistBlock = createElement("section", "detail-block");
    setlistBlock.appendChild(createElement("h2", undefined, "Setlist"));

    const rows = ssRows ?? [];
    if (rows.length === 0) {
      setlistBlock.appendChild(createElement("p", "empty-state", "No songs recorded."));
    } else {
      const table = createElement("table", "data-table");
      table.innerHTML = "<thead><tr><th>#</th><th>Song</th><th>Key</th><th>Usage</th><th>Notes</th></tr></thead>";
      const tbody = createElement("tbody");
      rows.forEach((ss, i) => {
        const song = (ss as unknown as { songs: { title: string; slug: string } | null }).songs;
        const tr = createElement("tr");
        const numTd = createElement("td", undefined, String(i + 1));

        const songTd = createElement("td");
        if (song) {
          const a = createElement("a", "list-primary", song.title) as HTMLAnchorElement;
          a.href = toAppHref(`/songs/${song.slug}/edit`);
          a.addEventListener("click", (e) => { e.preventDefault(); navigate(`/songs/${song.slug}/edit`); });
          songTd.appendChild(a);
        } else {
          songTd.textContent = "Unknown song";
        }

        const keyTd  = createElement("td", undefined, ss.key_override ?? "—");
        const usageTd = createElement("td", undefined, ss.usage ?? "—");
        const notesTd = createElement("td", undefined, ss.notes ?? "—");
        tr.append(numTd, songTd, keyTd, usageTd, notesTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      setlistBlock.appendChild(table);
    }
    content.appendChild(setlistBlock);

    // ── Back ──────────────────────────────────────────────────────────────────
    const backBtn = createElement("button", "button-secondary", "← All Services") as HTMLButtonElement;
    backBtn.addEventListener("click", () => navigate("/services"));
    content.appendChild(backBtn);
  });

  return page;
}

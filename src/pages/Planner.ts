import { ExportModal } from "../components/ExportModal";
import type { PageContext, PlannerSongItem, Song } from "../types";
import { createElement } from "../utils";

const USAGE_OPTIONS = [
  "opening",
  "praise",
  "response",
  "confession",
  "assurance",
  "communion",
  "reflection",
  "offering",
  "sending",
  "closing"
];

function ymdToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findSongsByText(songs: Song[], input: string): Song[] {
  const needle = input.trim().toLowerCase();
  if (!needle) return [];
  return songs
    .filter((song) => {
      const hay = [
        song.title,
        ...song.aka,
        ...(song.ccli_number ? [song.ccli_number] : []),
        ...song.writers,
        ...(song.original_artist ? [song.original_artist] : [])
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, 8);
}

function songItemToYaml(item: PlannerSongItem): string {
  const usage = item.usage.map((entry) => `"${entry}"`).join(", ");
  return [
    `  - slug: "${item.slug}"`,
    `    usage: [${usage}]`,
    `    key: ${item.key ? `"${item.key}"` : "null"}`,
    `    notes: ${item.notes ? `"${item.notes.replaceAll('"', '\\"')}"` : "null"}`
  ].join("\n");
}

function exportMarkdown(ctx: PageContext): string {
  const planner = ctx.planner;
  const songsYaml = planner.songs.length > 0 ? `\n${planner.songs.map((item) => songItemToYaml(item)).join("\n")}` : " []";
  return `---
date: "${planner.date}"
series_slug: ${planner.series_slug ? `"${planner.series_slug}"` : "null"}
sermon_title: ${planner.sermon_title ? `"${planner.sermon_title.replaceAll('"', '\\"')}"` : "null"}
sermon_text: ${planner.sermon_text ? `"${planner.sermon_text.replaceAll('"', '\\"')}"` : "null"}
preacher: ${planner.preacher ? `"${planner.preacher.replaceAll('"', '\\"')}"` : "null"}
songs:${songsYaml}
---

## Service Notes

Add transitions, prayer cues, and team reminders.
`;
}

export function PlannerPage(ctx: PageContext, query: URLSearchParams): HTMLElement {
  let planner = ctx.planner;
  if (!planner.date) {
    planner = { ...planner, date: ymdToday() };
  }
  const seriesFromQuery = query.get("series");
  if (seriesFromQuery && seriesFromQuery !== planner.series_slug) {
    planner = { ...planner, series_slug: seriesFromQuery };
  }
  if (planner !== ctx.planner) {
    ctx.setPlanner(planner);
  }

  const page = createElement("div", "page planner-page");
  page.appendChild(createElement("h1", undefined, "Planner"));
  page.appendChild(createElement("p", "page-intro", "Draft a service setlist and export markdown for `services/YYYY-MM-DD.md`."));

  const form = createElement("section", "planner-meta");

  const mkField = (labelText: string, value: string, onInput: (next: string) => void, type: "text" | "date" = "text") => {
    const label = createElement("label", "filter-field");
    label.appendChild(createElement("span", "filter-label", labelText));
    const input = createElement("input", "filter-input") as HTMLInputElement;
    input.type = type;
    input.value = value;
    input.addEventListener("input", () => onInput(input.value));
    label.appendChild(input);
    return label;
  };

  form.appendChild(
    mkField("Service date", planner.date, (next) => ctx.setPlanner({ ...ctx.planner, date: next }), "date")
  );

  const seriesField = createElement("label", "filter-field");
  seriesField.appendChild(createElement("span", "filter-label", "Series"));
  const seriesSelect = createElement("select", "filter-input") as HTMLSelectElement;
  const noSeriesOption = createElement("option") as HTMLOptionElement;
  noSeriesOption.value = "";
  noSeriesOption.textContent = "(none)";
  noSeriesOption.selected = !planner.series_slug;
  seriesSelect.appendChild(noSeriesOption);
  for (const series of ctx.data.series) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = series.slug;
    option.textContent = series.title;
    option.selected = planner.series_slug === series.slug;
    seriesSelect.appendChild(option);
  }
  seriesSelect.addEventListener("change", () => {
    ctx.setPlanner({ ...ctx.planner, series_slug: seriesSelect.value || null });
    ctx.rerender();
  });
  seriesField.appendChild(seriesSelect);
  form.appendChild(seriesField);

  form.appendChild(
    mkField("Sermon title", planner.sermon_title ?? "", (next) => ctx.setPlanner({ ...ctx.planner, sermon_title: next || null }))
  );
  form.appendChild(
    mkField("Sermon text", planner.sermon_text ?? "", (next) => ctx.setPlanner({ ...ctx.planner, sermon_text: next || null }))
  );
  form.appendChild(
    mkField("Preacher", planner.preacher ?? "", (next) => ctx.setPlanner({ ...ctx.planner, preacher: next || null }))
  );

  page.appendChild(form);

  const addSection = createElement("section", "detail-block");
  addSection.appendChild(createElement("h2", undefined, "Add Songs"));
  const search = createElement("input", "filter-input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search by title, AKA, writer, artist, CCLI...";
  addSection.appendChild(search);
  const searchResults = createElement("div", "planner-search-results");
  addSection.appendChild(searchResults);
  page.appendChild(addSection);

  const planSection = createElement("section", "detail-block");
  planSection.appendChild(createElement("h2", undefined, "Setlist (drag to reorder)"));
  const list = createElement("ul", "planner-list");
  planSection.appendChild(list);
  page.appendChild(planSection);

  const actionSection = createElement("section", "planner-actions");
  const exportButton = createElement("button", "button-primary", "Export Service Markdown") as HTMLButtonElement;
  const clearButton = createElement("button", "button-secondary", "Clear Plan") as HTMLButtonElement;
  actionSection.append(exportButton, clearButton);
  page.appendChild(actionSection);

  let modalEl: HTMLElement | null = null;
  const closeModal = () => {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  };

  const rerenderList = () => {
    list.innerHTML = "";

    if (ctx.planner.songs.length === 0) {
      list.appendChild(createElement("li", "empty-state", "No songs added yet."));
      return;
    }

    ctx.planner.songs.forEach((item, index) => {
      const li = createElement("li", "planner-item");
      li.draggable = true;
      li.dataset.index = String(index);

      li.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", String(index));
      });
      li.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      li.addEventListener("drop", (event) => {
        event.preventDefault();
        const sourceIndexRaw = event.dataTransfer?.getData("text/plain");
        const sourceIndex = sourceIndexRaw ? Number(sourceIndexRaw) : Number.NaN;
        if (!Number.isFinite(sourceIndex)) return;
        const nextSongs = [...ctx.planner.songs];
        const [moved] = nextSongs.splice(sourceIndex, 1);
        nextSongs.splice(index, 0, moved);
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
        ctx.rerender();
      });

      const song = ctx.data.songs.find((candidate) => candidate.slug === item.slug);
      const topLine = createElement("div", "planner-item-top");
      topLine.appendChild(createElement("strong", undefined, song?.title ?? item.slug));
      const removeBtn = createElement("button", "button-link", "Remove") as HTMLButtonElement;
      removeBtn.addEventListener("click", () => {
        const nextSongs = ctx.planner.songs.filter((_, i) => i !== index);
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
        ctx.rerender();
      });
      topLine.appendChild(removeBtn);
      li.appendChild(topLine);

      const usageField = createElement("label", "filter-field");
      usageField.appendChild(createElement("span", "filter-label", "Usage tags"));
      const usageSelect = createElement("select", "filter-multi") as HTMLSelectElement;
      usageSelect.multiple = true;
      usageSelect.size = 4;
      for (const usage of USAGE_OPTIONS) {
        const option = createElement("option") as HTMLOptionElement;
        option.value = usage;
        option.textContent = usage;
        option.selected = item.usage.includes(usage);
        usageSelect.appendChild(option);
      }
      usageSelect.addEventListener("change", () => {
        const usage = [...usageSelect.selectedOptions].map((opt) => opt.value);
        const nextSongs = [...ctx.planner.songs];
        nextSongs[index] = { ...nextSongs[index], usage };
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
      });
      usageField.appendChild(usageSelect);
      li.appendChild(usageField);

      const keyField = createElement("label", "filter-field");
      keyField.appendChild(createElement("span", "filter-label", "Service key override"));
      const keyInput = createElement("input", "filter-input") as HTMLInputElement;
      keyInput.type = "text";
      keyInput.value = item.key ?? "";
      keyInput.placeholder = "e.g. G";
      keyInput.addEventListener("input", () => {
        const nextSongs = [...ctx.planner.songs];
        nextSongs[index] = { ...nextSongs[index], key: keyInput.value.trim() || null };
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
      });
      keyField.appendChild(keyInput);
      li.appendChild(keyField);

      const notesField = createElement("label", "filter-field");
      notesField.appendChild(createElement("span", "filter-label", "Transition notes"));
      const notesInput = createElement("input", "filter-input") as HTMLInputElement;
      notesInput.type = "text";
      notesInput.value = item.notes ?? "";
      notesInput.placeholder = "Optional";
      notesInput.addEventListener("input", () => {
        const nextSongs = [...ctx.planner.songs];
        nextSongs[index] = { ...nextSongs[index], notes: notesInput.value.trim() || null };
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
      });
      notesField.appendChild(notesInput);
      li.appendChild(notesField);

      list.appendChild(li);
    });
  };

  const rerenderSearch = () => {
    searchResults.innerHTML = "";
    const matches = findSongsByText(
      ctx.data.songs.filter((song) => song.status === "active"),
      search.value
    );
    for (const match of matches) {
      const row = createElement("div", "planner-search-row");
      row.appendChild(createElement("span", undefined, match.title));
      const addBtn = createElement("button", "button-secondary", "Add") as HTMLButtonElement;
      addBtn.addEventListener("click", () => {
        if (ctx.planner.songs.some((item) => item.slug === match.slug)) {
          return;
        }
        const nextSongs = [...ctx.planner.songs, { slug: match.slug, usage: ["response"], key: null, notes: null }];
        ctx.setPlanner({ ...ctx.planner, songs: nextSongs });
        search.value = "";
        rerenderSearch();
        rerenderList();
      });
      row.appendChild(addBtn);
      searchResults.appendChild(row);
    }
    if (matches.length === 0 && search.value.trim().length > 0) {
      searchResults.appendChild(createElement("p", "empty-state", "No matching songs."));
    }
  };

  search.addEventListener("input", rerenderSearch);
  rerenderList();

  exportButton.addEventListener("click", () => {
    closeModal();
    modalEl = ExportModal({
      title: "Service Markdown",
      markdown: exportMarkdown(ctx),
      onClose: closeModal
    });
    document.body.appendChild(modalEl);
  });

  clearButton.addEventListener("click", () => {
    ctx.setPlanner({
      date: ymdToday(),
      series_slug: null,
      sermon_title: null,
      sermon_text: null,
      preacher: null,
      songs: []
    });
    ctx.rerender();
  });

  return page;
}

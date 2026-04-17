import { supabase } from "../../lib/supabase";
import type { SeriesRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement } from "../../utils";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
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

  const renderList = () => {
    listWrap.innerHTML = "";
    if (allSeries.length === 0) {
      listWrap.appendChild(createElement("p", "empty-state", "No series yet."));
      return;
    }
    const ul = createElement("ul", "v2-song-list");
    for (const s of allSeries) {
      const li = createElement("li", "v2-song-item");
      const top = createElement("div", "v2-song-item-top");
      top.appendChild(createElement("span", "list-primary", s.title));
      if (s.description) top.appendChild(createElement("span", "list-secondary", s.description));

      const editBtn = createElement("button", "button-secondary", "Edit") as HTMLButtonElement;
      editBtn.type = "button";
      editBtn.addEventListener("click", () => openForm(s));

      const delBtn = createElement("button", "button-secondary v2-delete-btn", "Delete") as HTMLButtonElement;
      delBtn.type = "button";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete series "${s.title}"? Services linked to it will lose the series link.`)) return;
        delBtn.disabled = true;
        const { error } = await supabase.from("series").delete().eq("id", s.id);
        if (error) { errorEl.textContent = error.message; delBtn.disabled = false; return; }
        allSeries = allSeries.filter((x) => x.id !== s.id);
        renderList();
      });

      top.append(editBtn, delBtn);
      li.appendChild(top);
      ul.appendChild(li);
    }
    listWrap.appendChild(ul);
  };

  // ── Inline form ────────────────────────────────────────────────────────────
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
    const { data, error } = await supabase.from("series").select("*").order("title");
    if (error) throw error;
    allSeries = data ?? [];
    renderList();
  });

  return page;
}

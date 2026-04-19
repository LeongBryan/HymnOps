import { supabase } from "../../lib/supabase";
import type { SongRow } from "../../lib/supabase";
import { withAuth } from "../auth";
import { createElement } from "../../utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function tagInput(
  labelText: string,
  placeholder: string,
  initialValues: string[]
): { wrap: HTMLElement; getValues: () => string[] } {
  const values = [...initialValues];

  const wrap = createElement("div", "v2-tag-input");
  wrap.appendChild(createElement("label", "v2-form-label", labelText));

  const chipsRow = createElement("div", "chip-row v2-tag-chips");
  const renderChips = () => {
    chipsRow.innerHTML = "";
    values.forEach((val, idx) => {
      const chip = createElement("span", "chip v2-tag-chip");
      chip.textContent = val;
      const removeBtn = createElement("button", "v2-tag-remove", "×") as HTMLButtonElement;
      removeBtn.type = "button";
      removeBtn.title = `Remove ${val}`;
      removeBtn.addEventListener("click", () => {
        values.splice(idx, 1);
        renderChips();
      });
      chip.appendChild(removeBtn);
      chipsRow.appendChild(chip);
    });
  };
  renderChips();

  const inputRow = createElement("div", "v2-tag-input-row");
  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "search-input v2-tag-text";
  textInput.placeholder = placeholder;

  const addBtn = createElement("button", "button-secondary", "Add") as HTMLButtonElement;
  addBtn.type = "button";

  const doAdd = () => {
    const v = textInput.value.trim();
    if (v && !values.includes(v)) {
      values.push(v);
      renderChips();
    }
    textInput.value = "";
    textInput.focus();
  };

  addBtn.addEventListener("click", doAdd);
  textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } });

  inputRow.append(textInput, addBtn);
  wrap.append(chipsRow, inputRow);

  return { wrap, getValues: () => [...values] };
}

function formField(
  id: string,
  labelText: string,
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): HTMLElement {
  const wrap = createElement("div", "v2-form-field");
  const label = createElement("label", "v2-form-label", labelText);
  label.setAttribute("for", id);
  input.id = id;
  wrap.append(label, input);
  return wrap;
}

function textInput(id: string, labelText: string, value = "", placeholder = ""): { wrap: HTMLElement; el: HTMLInputElement } {
  const el = document.createElement("input");
  el.type = "text";
  el.className = "search-input";
  el.value = value;
  el.placeholder = placeholder;
  return { wrap: formField(id, labelText, el), el };
}

function textArea(id: string, labelText: string, value = "", rows = 3): { wrap: HTMLElement; el: HTMLTextAreaElement } {
  const el = document.createElement("textarea");
  el.className = "search-input";
  el.value = value;
  el.rows = rows;
  return { wrap: formField(id, labelText, el), el };
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * /songs/new          → add a new song
 * /songs/:slug/edit   → edit existing song
 */
export function SongFormPage(navigate: (path: string) => void, slug?: string): HTMLElement {
  const isEdit = Boolean(slug);
  const page = createElement("div", "page");
  page.appendChild(createElement("h1", undefined, isEdit ? "Edit Song" : "Add Song"));

  const statusEl = createElement("p", "empty-state");
  const formWrap = createElement("div");
  formWrap.appendChild(createElement("p", "empty-state", isEdit ? "Loading…" : ""));
  page.append(statusEl, formWrap);

  withAuth(page, navigate, async () => {
    let existing: SongRow | null = null;
    let aliasValues: string[] = [];
    let writerValues: string[] = [];
    let themeValues: string[] = [];
    let scriptureValues: string[] = [];

    if (isEdit && slug) {
      const songRes = await supabase.from("songs").select("*").eq("slug", slug).single();

      if (songRes.error || !songRes.data) {
        formWrap.innerHTML = "";
        formWrap.appendChild(createElement("p", "empty-state", `Song "${slug}" not found.`));
        return;
      }
      existing = songRes.data;

      const sid = existing.id;
      const [ar, wr, tr, sr] = await Promise.all([
        supabase.from("song_aliases").select("*").eq("song_id", sid),
        supabase.from("song_writers").select("*").eq("song_id", sid),
        supabase.from("song_themes").select("*").eq("song_id", sid),
        supabase.from("song_scriptures").select("*").eq("song_id", sid)
      ]);
      aliasValues    = (ar.data ?? []).map((r) => r.alias);
      writerValues   = (wr.data ?? []).map((r) => r.writer_name);
      themeValues    = (tr.data ?? []).map((r) => r.theme);
      scriptureValues = (sr.data ?? []).map((r) => r.scripture_ref);
    }

    formWrap.innerHTML = "";

    const s = existing;
    const { wrap: titleWrap, el: titleEl }   = textInput("sf-title",   "Title *",           s?.title ?? "");
    const { wrap: slugWrap,  el: slugEl }    = textInput("sf-slug",    "Slug *",            s?.slug ?? "", "auto-generated");
    const { wrap: ccliWrap,  el: ccliEl }    = textInput("sf-ccli",    "CCLI Number",       s?.ccli_number ?? "");
    const { wrap: urlWrap,   el: urlEl }     = textInput("sf-url",     "SongSelect URL",    s?.songselect_url ?? "");
    const { wrap: artistWrap,el: artistEl }  = textInput("sf-artist",  "Original Artist",   s?.original_artist_name ?? "");
    const { wrap: keyWrap,   el: keyEl }     = textInput("sf-key",     "Default Key",       s?.default_key ?? "", "e.g. G");
    const { wrap: bpmWrap,   el: bpmEl }     = textInput("sf-bpm",     "Tempo (BPM)",       s?.tempo_bpm != null ? String(s.tempo_bpm) : "");
    bpmEl.type = "number";
    bpmEl.min = "40"; bpmEl.max = "220";

    const { wrap: summaryWrap, el: summaryEl } = textArea("sf-summary", "Theological Summary", s?.theological_summary ?? "", 4);

    // Congregational fit select
    const fitSelect = document.createElement("select");
    fitSelect.className = "filter-input";
    fitSelect.id = "sf-fit";
    [["", "—"], ["1","1"], ["2","2"], ["3","3"], ["4","4"], ["5","5"]].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      if (s?.congregational_fit != null && String(s.congregational_fit) === val) opt.selected = true;
      fitSelect.appendChild(opt);
    });
    const fitWrap = formField("sf-fit", "Congregational Fit (1–5)", fitSelect);

    // Status select
    const statusSelect = document.createElement("select");
    statusSelect.className = "filter-input";
    statusSelect.id = "sf-status";
    [["active", "Active"], ["archive", "Archive"]].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val; opt.textContent = label;
      if ((s?.status ?? "active") === val) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    const statusWrap2 = formField("sf-status", "Status", statusSelect);

    const aliases    = tagInput("Aliases (AKA)",       "Add alias…",    aliasValues);
    const writers    = tagInput("Writers / Composers", "Add writer…",   writerValues);
    const themes     = tagInput("Themes",               "Add theme…",    themeValues);
    const scriptures = tagInput("Scripture References", "e.g. John 3:16", scriptureValues);

    // Auto-slug from title
    titleEl.addEventListener("input", () => {
      if (!isEdit && !slugEl.dataset.manuallyEdited) {
        slugEl.value = slugify(titleEl.value);
      }
    });
    slugEl.addEventListener("input", () => { slugEl.dataset.manuallyEdited = "1"; });

    const form = createElement("div", "v2-song-form");

    const grid2 = createElement("div", "v2-form-grid");
    grid2.append(titleWrap, slugWrap, ccliWrap, urlWrap, artistWrap, keyWrap, bpmWrap, fitWrap, statusWrap2);

    form.append(
      grid2,
      summaryWrap,
      aliases.wrap, writers.wrap, themes.wrap, scriptures.wrap
    );

    const actions = createElement("div", "planner-actions");
    const saveBtn = createElement("button", "button-primary", isEdit ? "Save changes" : "Create song") as HTMLButtonElement;
    saveBtn.type = "button";
    const cancelBtn = createElement("button", "button-secondary", "Cancel") as HTMLButtonElement;
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", () => navigate("/songs"));

    if (isEdit && existing) {
      const deleteBtn = createElement("button", "button-secondary v2-delete-btn", "Delete song") as HTMLButtonElement;
      deleteBtn.type = "button";
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Delete "${existing!.title}"? This cannot be undone.`)) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = "Deleting…";
        const { error } = await supabase.from("songs").delete().eq("id", existing!.id);
        if (error) { statusEl.textContent = error.message; deleteBtn.disabled = false; deleteBtn.textContent = "Delete song"; return; }
        navigate("/songs");
      });
      actions.append(saveBtn, cancelBtn, deleteBtn);
    } else {
      actions.append(saveBtn, cancelBtn);
    }

    form.appendChild(actions);
    formWrap.appendChild(form);

    saveBtn.addEventListener("click", async () => {
      statusEl.textContent = "";
      const title = titleEl.value.trim();
      const newSlug = slugEl.value.trim();
      if (!title || !newSlug) {
        statusEl.textContent = "Title and slug are required.";
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";

      try {
        const payload = {
          slug: newSlug,
          title,
          ccli_number:          ccliEl.value.trim() || null,
          songselect_url:       urlEl.value.trim() || null,
          original_artist_name: artistEl.value.trim() || null,
          theological_summary:  summaryEl.value.trim(),
          congregational_fit:   fitSelect.value ? Number(fitSelect.value) : null,
          tempo_bpm:            bpmEl.value ? Number(bpmEl.value) : null,
          default_key:          keyEl.value.trim() || null,
          status:               statusSelect.value
        };

        let songId: string;

        if (isEdit && existing) {
          const { error } = await supabase.from("songs").update(payload).eq("id", existing.id);
          if (error) throw error;
          songId = existing.id;
        } else {
          const { data, error } = await supabase.from("songs").insert(payload).select("id").single();
          if (error) throw error;
          songId = data.id;
        }

        // Replace related rows (delete + reinsert)
        await supabase.from("song_aliases").delete().eq("song_id", songId);
        await supabase.from("song_writers").delete().eq("song_id", songId);
        await supabase.from("song_themes").delete().eq("song_id", songId);
        await supabase.from("song_scriptures").delete().eq("song_id", songId);

        const aliasArr = aliases.getValues();
        if (aliasArr.length > 0) {
          const { error: e } = await supabase.from("song_aliases").insert(aliasArr.map((alias) => ({ song_id: songId, alias })));
          if (e) throw e;
        }
        const writerArr = writers.getValues();
        if (writerArr.length > 0) {
          const { error: e } = await supabase.from("song_writers").insert(writerArr.map((writer_name) => ({ song_id: songId, writer_name })));
          if (e) throw e;
        }
        const themeArr = themes.getValues();
        if (themeArr.length > 0) {
          const { error: e } = await supabase.from("song_themes").insert(themeArr.map((theme) => ({ song_id: songId, theme })));
          if (e) throw e;
        }
        const scriptureArr = scriptures.getValues();
        if (scriptureArr.length > 0) {
          const { error: e } = await supabase.from("song_scriptures").insert(scriptureArr.map((scripture_ref) => ({ song_id: songId, scripture_ref })));
          if (e) throw e;
        }

        navigate("/songs");
      } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : "Save failed.";
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? "Save changes" : "Create song";
      }
    });
  });

  return page;
}

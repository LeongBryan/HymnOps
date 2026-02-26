import { createElement } from "../utils";

export interface SongFilters {
  themes: string[];
  doctrines: string[];
  tones: string[];
  serviceYears: number[];
  serviceYearMode: "any" | "all";
  scriptureText: string;
  keyText: string;
  fitMin: number;
  tempoMin: number | null;
  tempoMax: number | null;
  status: "all" | "active" | "archive";
  notSungWeeks: 0 | 4 | 8 | 12 | 24;
}

export interface FilterPanelOptions {
  themes: string[];
  doctrines: string[];
  tones: string[];
  serviceYears: number[];
  value: SongFilters;
  onChange: (next: SongFilters) => void;
}

export function defaultSongFilters(): SongFilters {
  return {
    themes: [],
    doctrines: [],
    tones: [],
    serviceYears: [],
    serviceYearMode: "any",
    scriptureText: "",
    keyText: "",
    fitMin: 0,
    tempoMin: null,
    tempoMax: null,
    status: "active",
    notSungWeeks: 0
  };
}

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((option) => option.value);
}

function createMultiSelect(label: string, options: string[], selected: string[], onInput: (values: string[]) => void): HTMLElement {
  const wrapper = createElement("label", "filter-field");
  const text = createElement("span", "filter-label", label);
  const select = createElement("select", "filter-multi") as HTMLSelectElement;
  select.multiple = true;
  select.size = 5;
  for (const optionValue of options) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = selected.includes(optionValue);
    select.appendChild(option);
  }
  select.addEventListener("change", () => onInput(selectedValues(select)));
  wrapper.append(text, select);
  return wrapper;
}

export function FilterPanel(options: FilterPanelOptions): HTMLElement {
  const panel = createElement("section", "filter-panel");
  const title = createElement("h3", "filter-title", "Filters");
  panel.appendChild(title);

  const state = options.value;
  const emit = (patch: Partial<SongFilters>) => options.onChange({ ...state, ...patch });

  panel.appendChild(
    createMultiSelect("Themes", options.themes, state.themes, (values) => {
      emit({ themes: values });
    })
  );
  panel.appendChild(
    createMultiSelect("Doctrine", options.doctrines, state.doctrines, (values) => {
      emit({ doctrines: values });
    })
  );
  panel.appendChild(
    createMultiSelect("Tone", options.tones, state.tones, (values) => {
      emit({ tones: values });
    })
  );
  panel.appendChild(
    createMultiSelect(
      "Sung in years",
      options.serviceYears.map((year) => String(year)),
      state.serviceYears.map((year) => String(year)),
      (values) => {
        emit({
          serviceYears: values
            .map((value) => Number.parseInt(value, 10))
            .filter((year) => Number.isFinite(year))
        });
      }
    )
  );

  const yearModeField = createElement("label", "filter-field");
  const yearModeLabel = createElement("span", "filter-label", "Year match");
  const yearModeSelect = createElement("select", "filter-input") as HTMLSelectElement;
  const yearModes: Array<SongFilters["serviceYearMode"]> = ["any", "all"];
  for (const yearMode of yearModes) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = yearMode;
    option.textContent = yearMode === "any" ? "Any selected year" : "All selected years";
    option.selected = yearMode === state.serviceYearMode;
    yearModeSelect.appendChild(option);
  }
  yearModeSelect.addEventListener("change", () => {
    const next = yearModeSelect.value as SongFilters["serviceYearMode"];
    emit({ serviceYearMode: next });
  });
  yearModeField.append(yearModeLabel, yearModeSelect);
  panel.appendChild(yearModeField);

  const scripture = createElement("label", "filter-field");
  const scriptureLabel = createElement("span", "filter-label", "Scripture contains");
  const scriptureInput = createElement("input", "filter-input") as HTMLInputElement;
  scriptureInput.type = "text";
  scriptureInput.value = state.scriptureText;
  scriptureInput.placeholder = "e.g. Colossians";
  scriptureInput.addEventListener("input", () => emit({ scriptureText: scriptureInput.value }));
  scripture.append(scriptureLabel, scriptureInput);
  panel.appendChild(scripture);

  const keyField = createElement("label", "filter-field");
  const keyLabel = createElement("span", "filter-label", "Key contains");
  const keyInput = createElement("input", "filter-input") as HTMLInputElement;
  keyInput.type = "text";
  keyInput.value = state.keyText;
  keyInput.placeholder = "e.g. G, D, Bb";
  keyInput.addEventListener("input", () => emit({ keyText: keyInput.value }));
  keyField.append(keyLabel, keyInput);
  panel.appendChild(keyField);

  const fit = createElement("label", "filter-field");
  const fitLabel = createElement("span", "filter-label", "Minimum congregational fit");
  const fitInput = createElement("input", "filter-input") as HTMLInputElement;
  fitInput.type = "number";
  fitInput.min = "0";
  fitInput.max = "5";
  fitInput.value = state.fitMin.toString();
  fitInput.addEventListener("input", () => {
    const parsed = Number(fitInput.value);
    emit({ fitMin: Number.isFinite(parsed) ? parsed : 0 });
  });
  fit.append(fitLabel, fitInput);
  panel.appendChild(fit);

  const tempoMinField = createElement("label", "filter-field");
  const tempoMinLabel = createElement("span", "filter-label", "Tempo min");
  const tempoMinInput = createElement("input", "filter-input") as HTMLInputElement;
  tempoMinInput.type = "number";
  tempoMinInput.value = state.tempoMin === null ? "" : state.tempoMin.toString();
  tempoMinInput.addEventListener("input", () => {
    const parsed = Number(tempoMinInput.value);
    emit({ tempoMin: Number.isFinite(parsed) ? parsed : null });
  });
  tempoMinField.append(tempoMinLabel, tempoMinInput);
  panel.appendChild(tempoMinField);

  const tempoMaxField = createElement("label", "filter-field");
  const tempoMaxLabel = createElement("span", "filter-label", "Tempo max");
  const tempoMaxInput = createElement("input", "filter-input") as HTMLInputElement;
  tempoMaxInput.type = "number";
  tempoMaxInput.value = state.tempoMax === null ? "" : state.tempoMax.toString();
  tempoMaxInput.addEventListener("input", () => {
    const parsed = Number(tempoMaxInput.value);
    emit({ tempoMax: Number.isFinite(parsed) ? parsed : null });
  });
  tempoMaxField.append(tempoMaxLabel, tempoMaxInput);
  panel.appendChild(tempoMaxField);

  const statusField = createElement("label", "filter-field");
  const statusLabel = createElement("span", "filter-label", "Status");
  const statusSelect = createElement("select", "filter-input") as HTMLSelectElement;
  const statusOptions: Array<SongFilters["status"]> = ["active", "archive", "all"];
  for (const status of statusOptions) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = status;
    option.textContent = status;
    option.selected = status === state.status;
    statusSelect.appendChild(option);
  }
  statusSelect.addEventListener("change", () => {
    const next = statusSelect.value as SongFilters["status"];
    emit({ status: next });
  });
  statusField.append(statusLabel, statusSelect);
  panel.appendChild(statusField);

  const notSungField = createElement("label", "filter-field");
  const notSungLabel = createElement("span", "filter-label", "Not sung in X weeks");
  const notSungSelect = createElement("select", "filter-input") as HTMLSelectElement;
  const weekOptions: SongFilters["notSungWeeks"][] = [0, 4, 8, 12, 24];
  for (const week of weekOptions) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = String(week);
    option.textContent = week === 0 ? "Any" : String(week);
    option.selected = week === state.notSungWeeks;
    notSungSelect.appendChild(option);
  }
  notSungSelect.addEventListener("change", () => {
    const parsed = Number(notSungSelect.value);
    if ([0, 4, 8, 12, 24].includes(parsed)) {
      emit({ notSungWeeks: parsed as SongFilters["notSungWeeks"] });
    }
  });
  notSungField.append(notSungLabel, notSungSelect);
  panel.appendChild(notSungField);

  return panel;
}

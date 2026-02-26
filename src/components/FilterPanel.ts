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

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameNumberArray(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isDefaultFilterState(value: SongFilters): boolean {
  const defaults = defaultSongFilters();
  return (
    sameStringArray(value.themes, defaults.themes) &&
    sameStringArray(value.doctrines, defaults.doctrines) &&
    sameStringArray(value.tones, defaults.tones) &&
    sameNumberArray(value.serviceYears, defaults.serviceYears) &&
    value.serviceYearMode === defaults.serviceYearMode &&
    value.scriptureText === defaults.scriptureText &&
    value.keyText === defaults.keyText &&
    value.fitMin === defaults.fitMin &&
    value.tempoMin === defaults.tempoMin &&
    value.tempoMax === defaults.tempoMax &&
    value.status === defaults.status &&
    value.notSungWeeks === defaults.notSungWeeks
  );
}

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((option) => option.value);
}

interface FilterFieldOptions {
  label: string;
  control: HTMLElement;
  canClear: boolean;
  onClear: () => void;
}

function createFilterField(options: FilterFieldOptions): HTMLElement {
  const wrapper = createElement("div", "filter-field");
  const header = createElement("div", "filter-field-header");
  const label = createElement("span", "filter-label", options.label);
  const clear = createElement("button", "button-link filter-clear", "Clear") as HTMLButtonElement;
  clear.type = "button";
  clear.disabled = !options.canClear;
  clear.setAttribute("aria-label", `Clear ${options.label} filter`);
  clear.addEventListener("click", () => options.onClear());
  header.append(label, clear);
  wrapper.append(header, options.control);
  return wrapper;
}

function createMultiSelect(label: string, options: string[], selected: string[], onInput: (values: string[]) => void, onClear: () => void): HTMLElement {
  const select = createElement("select", "filter-multi") as HTMLSelectElement;
  select.multiple = true;
  select.size = 5;
  select.setAttribute("aria-label", label);
  for (const optionValue of options) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = selected.includes(optionValue);
    select.appendChild(option);
  }
  select.addEventListener("change", () => onInput(selectedValues(select)));
  return createFilterField({
    label,
    control: select,
    canClear: selected.length > 0,
    onClear
  });
}

export function FilterPanel(options: FilterPanelOptions): HTMLElement {
  const panel = createElement("section", "filter-panel");
  const panelHeader = createElement("div", "filter-panel-header");
  const title = createElement("h3", "filter-title", "Filters");
  const clearAll = createElement("button", "button-secondary filter-clear-all", "Clear all") as HTMLButtonElement;
  clearAll.type = "button";
  clearAll.disabled = isDefaultFilterState(options.value);
  clearAll.addEventListener("click", () => {
    options.onChange(defaultSongFilters());
  });
  panelHeader.append(title, clearAll);
  panel.appendChild(panelHeader);

  const state = options.value;
  const emit = (patch: Partial<SongFilters>) => options.onChange({ ...state, ...patch });

  panel.appendChild(
    createMultiSelect(
      "Themes",
      options.themes,
      state.themes,
      (values) => {
        emit({ themes: values });
      },
      () => emit({ themes: [] })
    )
  );
  panel.appendChild(
    createMultiSelect(
      "Doctrine",
      options.doctrines,
      state.doctrines,
      (values) => {
        emit({ doctrines: values });
      },
      () => emit({ doctrines: [] })
    )
  );
  panel.appendChild(
    createMultiSelect(
      "Tone",
      options.tones,
      state.tones,
      (values) => {
        emit({ tones: values });
      },
      () => emit({ tones: [] })
    )
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
      },
      () => emit({ serviceYears: [] })
    )
  );

  const yearModeSelect = createElement("select", "filter-input") as HTMLSelectElement;
  yearModeSelect.setAttribute("aria-label", "Year match");
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
  panel.appendChild(
    createFilterField({
      label: "Year match",
      control: yearModeSelect,
      canClear: state.serviceYearMode !== "any",
      onClear: () => emit({ serviceYearMode: "any" })
    })
  );

  const scriptureInput = createElement("input", "filter-input") as HTMLInputElement;
  scriptureInput.type = "text";
  scriptureInput.setAttribute("aria-label", "Scripture contains");
  scriptureInput.value = state.scriptureText;
  scriptureInput.placeholder = "e.g. Colossians";
  scriptureInput.addEventListener("input", () => emit({ scriptureText: scriptureInput.value }));
  panel.appendChild(
    createFilterField({
      label: "Scripture contains",
      control: scriptureInput,
      canClear: state.scriptureText.trim().length > 0,
      onClear: () => emit({ scriptureText: "" })
    })
  );

  const keyInput = createElement("input", "filter-input") as HTMLInputElement;
  keyInput.type = "text";
  keyInput.setAttribute("aria-label", "Key contains");
  keyInput.value = state.keyText;
  keyInput.placeholder = "e.g. G, D, Bb";
  keyInput.addEventListener("input", () => emit({ keyText: keyInput.value }));
  panel.appendChild(
    createFilterField({
      label: "Key contains",
      control: keyInput,
      canClear: state.keyText.trim().length > 0,
      onClear: () => emit({ keyText: "" })
    })
  );

  const fitInput = createElement("input", "filter-input") as HTMLInputElement;
  fitInput.type = "number";
  fitInput.min = "0";
  fitInput.max = "5";
  fitInput.setAttribute("aria-label", "Minimum congregational fit");
  fitInput.value = state.fitMin.toString();
  fitInput.addEventListener("input", () => {
    const parsed = Number(fitInput.value);
    emit({ fitMin: Number.isFinite(parsed) ? parsed : 0 });
  });
  panel.appendChild(
    createFilterField({
      label: "Minimum congregational fit",
      control: fitInput,
      canClear: state.fitMin !== 0,
      onClear: () => emit({ fitMin: 0 })
    })
  );

  const tempoMinInput = createElement("input", "filter-input") as HTMLInputElement;
  tempoMinInput.type = "number";
  tempoMinInput.setAttribute("aria-label", "Tempo min");
  tempoMinInput.value = state.tempoMin === null ? "" : state.tempoMin.toString();
  tempoMinInput.addEventListener("input", () => {
    const parsed = Number(tempoMinInput.value);
    emit({ tempoMin: Number.isFinite(parsed) ? parsed : null });
  });
  panel.appendChild(
    createFilterField({
      label: "Tempo min",
      control: tempoMinInput,
      canClear: state.tempoMin !== null,
      onClear: () => emit({ tempoMin: null })
    })
  );

  const tempoMaxInput = createElement("input", "filter-input") as HTMLInputElement;
  tempoMaxInput.type = "number";
  tempoMaxInput.setAttribute("aria-label", "Tempo max");
  tempoMaxInput.value = state.tempoMax === null ? "" : state.tempoMax.toString();
  tempoMaxInput.addEventListener("input", () => {
    const parsed = Number(tempoMaxInput.value);
    emit({ tempoMax: Number.isFinite(parsed) ? parsed : null });
  });
  panel.appendChild(
    createFilterField({
      label: "Tempo max",
      control: tempoMaxInput,
      canClear: state.tempoMax !== null,
      onClear: () => emit({ tempoMax: null })
    })
  );

  const statusSelect = createElement("select", "filter-input") as HTMLSelectElement;
  statusSelect.setAttribute("aria-label", "Status");
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
  panel.appendChild(
    createFilterField({
      label: "Status",
      control: statusSelect,
      canClear: state.status !== "active",
      onClear: () => emit({ status: "active" })
    })
  );

  const notSungSelect = createElement("select", "filter-input") as HTMLSelectElement;
  notSungSelect.setAttribute("aria-label", "Not sung in X weeks");
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
  panel.appendChild(
    createFilterField({
      label: "Not sung in X weeks",
      control: notSungSelect,
      canClear: state.notSungWeeks !== 0,
      onClear: () => emit({ notSungWeeks: 0 })
    })
  );

  return panel;
}

import { createElement } from "../utils";

interface SearchBarOptions {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar(options: SearchBarOptions): HTMLElement {
  const wrapper = createElement("label", "search-bar");
  const span = createElement("span", "search-bar-label", "Search");
  const input = createElement("input", "search-input") as HTMLInputElement;
  input.type = "search";
  input.placeholder = options.placeholder;
  input.value = options.value;
  input.addEventListener("input", () => {
    options.onChange(input.value);
  });

  wrapper.append(span, input);
  return wrapper;
}

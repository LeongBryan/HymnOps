import { createElement } from "../utils";

interface ExportModalOptions {
  title: string;
  markdown: string;
  copyLabel?: string;
  autoCopy?: boolean;
  onClose: () => void;
}

export function ExportModal(options: ExportModalOptions): HTMLElement {
  const overlay = createElement("div", "modal-overlay");
  const modal = createElement("div", "modal");
  const header = createElement("div", "modal-header");
  const title = createElement("h3", undefined, options.title);

  const closeButton = createElement("button", "button-secondary", "Close") as HTMLButtonElement;
  closeButton.addEventListener("click", options.onClose);

  header.append(title, closeButton);

  const textarea = createElement("textarea", "export-area") as HTMLTextAreaElement;
  textarea.value = options.markdown;
  textarea.readOnly = true;

  const actions = createElement("div", "modal-actions");
  const copyButton = createElement("button", "button-primary", options.copyLabel ?? "Copy Markdown") as HTMLButtonElement;
  const status = createElement("span", "copy-status", "");
  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(options.markdown);
      status.textContent = "Copied.";
    } catch {
      status.textContent = "Clipboard unavailable.";
    }
  };
  copyButton.addEventListener("click", () => {
    void copyContent();
  });
  actions.append(copyButton, status);

  modal.append(header, textarea, actions);
  overlay.appendChild(modal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      options.onClose();
    }
  });

  if (options.autoCopy) {
    void copyContent();
  }

  return overlay;
}

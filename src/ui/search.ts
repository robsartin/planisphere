/* SPDX-License-Identifier: Apache-2.0 */
import type { SearchResult } from "../astro/search";
import type { UIIntent } from "./index";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  star: "star",
  constellation: "constellation",
  body: "planet",
  satellite: "satellite",
};

/**
 * Create a search box element for the control panel.
 *
 * @param search - Pure function that returns matching results for a query string
 * @param dispatch - UIIntent dispatcher
 */
export function createSearch(
  search: (query: string) => SearchResult[],
  dispatch: (intent: UIIntent) => void,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;margin-bottom:8px";

  // Input
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Search stars, planets, satellites...";
  input.dataset.testid = "search-input";
  input.style.cssText =
    "width:100%;box-sizing:border-box;background:rgba(255,255,255,0.1);" +
    "border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;" +
    "font-size:12px;padding:6px 8px;font-family:sans-serif;outline:none";
  wrapper.appendChild(input);

  // Dropdown
  const dropdown = document.createElement("div");
  dropdown.dataset.testid = "search-dropdown";
  dropdown.style.cssText =
    "position:absolute;top:100%;left:0;right:0;background:rgba(10,10,20,0.97);" +
    "border:1px solid rgba(255,255,255,0.2);border-radius:0 0 4px 4px;" +
    "z-index:2000;max-height:220px;overflow-y:auto;display:none";
  wrapper.appendChild(dropdown);

  function hideDropdown(): void {
    dropdown.style.display = "none";
    dropdown.replaceChildren();
  }

  function showResults(results: SearchResult[]): void {
    dropdown.replaceChildren();

    if (results.length === 0) {
      const noResult = document.createElement("div");
      noResult.textContent = "No results";
      noResult.style.cssText =
        "padding:8px 10px;color:rgba(255,255,255,0.4);font-size:12px;font-family:sans-serif";
      dropdown.appendChild(noResult);
      dropdown.style.display = "block";
      return;
    }

    for (const result of results) {
      const item = document.createElement("div");
      item.dataset.testid = "search-result-item";
      item.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;" +
        "padding:7px 10px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.07)";

      // Left: name + below-horizon indicator
      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:6px;flex:1;min-width:0";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = result.name;
      nameSpan.style.cssText =
        "color:#fff;font-size:12px;font-family:sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      left.appendChild(nameSpan);

      if (result.belowHorizon) {
        const belowSpan = document.createElement("span");
        belowSpan.textContent = "(below horizon)";
        belowSpan.style.cssText =
          "color:rgba(255,255,255,0.38);font-size:10px;font-family:sans-serif;white-space:nowrap";
        left.appendChild(belowSpan);
      }

      // Right: type label
      const typeLabel = document.createElement("span");
      typeLabel.textContent = TYPE_LABELS[result.type];
      typeLabel.style.cssText =
        "color:rgba(100,200,255,0.7);font-size:10px;font-family:sans-serif;" +
        "margin-left:8px;white-space:nowrap;flex-shrink:0";

      item.appendChild(left);
      item.appendChild(typeLabel);

      // Hover effects
      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(255,255,255,0.08)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "";
      });

      // Click: dispatch set-view and close
      item.addEventListener("click", () => {
        dispatch({ type: "set-view", az: result.az, alt: result.alt });
        input.value = "";
        hideDropdown();
      });

      dropdown.appendChild(item);
    }

    dropdown.style.display = "block";
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    if (query.length < 2) {
      hideDropdown();
      return;
    }
    const results = search(query);
    showResults(results);
  });

  // Close dropdown when focus leaves the wrapper
  document.addEventListener(
    "click",
    (e) => {
      if (!wrapper.contains(e.target as Node)) {
        hideDropdown();
      }
    },
    true,
  );

  return wrapper;
}

/* SPDX-License-Identifier: Apache-2.0 */
import { el } from "./dom";
import type { SearchResult } from "../astro/search";
import type { UIIntent } from "./index";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  star: "star",
  constellation: "constellation",
  body: "planet",
  satellite: "satellite",
};

const INPUT_STYLE: Partial<CSSStyleDeclaration> = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "12px",
  padding: "6px 8px",
  fontFamily: "sans-serif",
  outline: "none",
};

const DROPDOWN_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "100%",
  left: "0",
  right: "0",
  background: "rgba(10,10,20,0.97)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "0 0 4px 4px",
  zIndex: "2000",
  maxHeight: "220px",
  overflowY: "auto",
  display: "none",
};

const NO_RESULT_STYLE: Partial<CSSStyleDeclaration> = {
  padding: "8px 10px",
  color: "rgba(255,255,255,0.4)",
  fontSize: "12px",
  fontFamily: "sans-serif",
};

const ITEM_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 10px",
  cursor: "pointer",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const LEFT_STYLE: Partial<CSSStyleDeclaration> = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flex: "1",
  minWidth: "0",
};

const NAME_STYLE: Partial<CSSStyleDeclaration> = {
  color: "#fff",
  fontSize: "12px",
  fontFamily: "sans-serif",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const BELOW_HORIZON_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.38)",
  fontSize: "10px",
  fontFamily: "sans-serif",
  whiteSpace: "nowrap",
};

const TYPE_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  color: "rgba(100,200,255,0.7)",
  fontSize: "10px",
  fontFamily: "sans-serif",
  marginLeft: "8px",
  whiteSpace: "nowrap",
  flexShrink: "0",
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
  const input = el("input", {
    testid: "search-input",
    type: "text",
    placeholder: "Search stars, planets, satellites...",
    style: INPUT_STYLE,
  });

  const dropdown = el("div", { testid: "search-dropdown", style: DROPDOWN_STYLE });

  const wrapper = el("div", {
    style: { position: "relative", marginBottom: "8px" },
    children: [input, dropdown],
  });

  function hideDropdown(): void {
    dropdown.style.display = "none";
    dropdown.replaceChildren();
  }

  function buildItem(result: SearchResult): HTMLElement {
    const left = el("div", {
      style: LEFT_STYLE,
      children: [
        el("span", { text: result.name, style: NAME_STYLE }),
        result.belowHorizon
          ? el("span", { text: "(below horizon)", style: BELOW_HORIZON_STYLE })
          : null,
      ],
    });

    const typeLabel = el("span", {
      text: TYPE_LABELS[result.type],
      style: TYPE_LABEL_STYLE,
    });

    const item = el("div", {
      testid: "search-result-item",
      style: ITEM_STYLE,
      children: [left, typeLabel],
    });

    item.addEventListener("mouseenter", () => {
      item.style.background = "rgba(255,255,255,0.08)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "";
    });
    item.addEventListener("click", () => {
      dispatch({ type: "set-view", az: result.az, alt: result.alt });
      input.value = "";
      hideDropdown();
    });

    return item;
  }

  function showResults(results: SearchResult[]): void {
    if (results.length === 0) {
      dropdown.replaceChildren(el("div", { text: "No results", style: NO_RESULT_STYLE }));
      dropdown.style.display = "block";
      return;
    }
    dropdown.replaceChildren(...results.map(buildItem));
    dropdown.style.display = "block";
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    if (query.length < 2) {
      hideDropdown();
      return;
    }
    showResults(search(query));
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

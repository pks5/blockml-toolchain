import { escapeHtml, relativePath } from "./fqn-path.js";
export const TOOLBAR_CSS = `
header.toolbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #111;
  color: #fff;
  padding: 0.45rem 1rem;
}
header.toolbar .toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  white-space: nowrap;
}
header.toolbar .brand { font-weight: 650; letter-spacing: 0.02em; }
header.toolbar a { color: #fff; text-decoration: none; }
header.toolbar a:hover { text-decoration: underline; }
header.toolbar .toolbar-right {
  position: relative;
  min-width: 12rem;
  max-width: 22rem;
  flex: 1;
  display: flex;
  justify-content: flex-end;
}
header.toolbar .search { position: relative; width: 100%; max-width: 22rem; }
header.toolbar input[type=search] {
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  font: inherit;
}
header.toolbar .search-results {
  position: absolute;
  right: 0;
  left: 0;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0;
  list-style: none;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  max-height: 20rem;
  overflow: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
header.toolbar .search-results[hidden] { display: none; }
header.toolbar .search-results button {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: #fff;
  padding: 0.4rem 0.7rem;
  font: inherit;
  cursor: pointer;
}
header.toolbar .search-results li.active button,
header.toolbar .search-results button:hover { background: #333; }
header.toolbar .search-name { display: block; }
header.toolbar .search-meta { display: block; font-size: 0.75rem; color: #bbb; }
`.trim();
export const PAGE_SHELL_CSS = `
body { font-family: system-ui, sans-serif; margin: 0; line-height: 1.5; }
.page { margin: 2rem auto; max-width: 960px; padding: 0 2rem 2rem; }
${TOOLBAR_CSS}
`.trim();
export function renderToolbar(pagePath, rootIndexPath) {
    const indexHref = relativePath(pagePath, rootIndexPath);
    return `<header class="toolbar">
  <div class="toolbar-left">
    <span class="brand">BlockDoc</span>
    <a href="${indexHref}">Index</a>
  </div>
  <div class="toolbar-right">
    <div class="search">
      <input type="search" placeholder="Search blocks…" autocomplete="off" aria-label="Search blocks">
      <ul class="search-results" hidden></ul>
    </div>
  </div>
</header>`;
}
export function wrapHtmlDocument(title, pagePath, rootIndexPath, css, bodyInner) {
    const searchSrc = relativePath(pagePath, "search.js");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  ${renderToolbar(pagePath, rootIndexPath)}
  <div class="page">
  ${bodyInner}
  </div>
  <script src="${searchSrc}"></script>
</body>
</html>`;
}
const SEARCH_CLIENT_JS = `
(function () {
  "use strict";
  var INDEX = __INDEX__;
  var scriptEl = document.currentScript;
  var rootUrl = new URL("./", scriptEl.src);

  function matches(entry, tokens) {
    var keys = entry.keywords;
    for (var t = 0; t < tokens.length; t++) {
      var token = tokens[t];
      var found = false;
      for (var k = 0; k < keys.length; k++) {
        if (String(keys[k]).toLowerCase().indexOf(token) !== -1) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  function rank(query, entry) {
    var q = query.toLowerCase();
    var name = String(entry.name).toLowerCase();
    if (name === q) return 0;
    if (name.indexOf(q) === 0) return 1;
    return 2;
  }

  function search(query) {
    var trimmed = String(query).trim();
    if (!trimmed) return [];
    var tokens = trimmed.toLowerCase().split(/\\s+/);
    var hits = [];
    for (var i = 0; i < INDEX.length; i++) {
      if (matches(INDEX[i], tokens)) hits.push(INDEX[i]);
    }
    hits.sort(function (a, b) {
      var d = rank(trimmed, a) - rank(trimmed, b);
      if (d !== 0) return d;
      return String(a.name).localeCompare(String(b.name));
    });
    return hits.slice(0, 12);
  }

  function navigate(href) {
    window.location.href = new URL(href, rootUrl).href;
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderResults(list, hits, active) {
    if (!hits.length) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    var html = "";
    for (var i = 0; i < hits.length; i++) {
      var entry = hits[i];
      var meta = entry.is || entry.type;
      var cls = i === active ? ' class="active"' : "";
      html += "<li" + cls + '><button type="button" data-href="' +
        escapeText(entry.href) + '"><span class="search-name">' +
        escapeText(entry.name) + '</span><span class="search-meta">' +
        escapeText(meta) + "</span></button></li>";
    }
    list.innerHTML = html;
    list.hidden = false;
  }

  function init() {
    var toolbar = document.querySelector("header.toolbar");
    if (!toolbar) return;
    var input = toolbar.querySelector("input[type=search]");
    var list = toolbar.querySelector(".search-results");
    if (!input || !list) return;
    var hits = [];
    var active = 0;

    function update() {
      hits = search(input.value);
      active = 0;
      renderResults(list, hits, active);
    }

    input.addEventListener("input", update);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (hits.length) {
          active = (active + 1) % hits.length;
          renderResults(list, hits, active);
        }
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (hits.length) {
          active = (active - 1 + hits.length) % hits.length;
          renderResults(list, hits, active);
        }
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (hits[active]) navigate(hits[active].href);
      } else if (ev.key === "Escape") {
        list.hidden = true;
        input.blur();
      }
    });
    list.addEventListener("click", function (ev) {
      var target = ev.target;
      if (target.nodeType !== 1) target = target.parentElement;
      if (!target) return;
      var btn = target.closest("button[data-href]");
      if (btn) navigate(btn.getAttribute("data-href"));
    });
    document.addEventListener("click", function (ev) {
      if (!toolbar.contains(ev.target)) list.hidden = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`.trim();
export function renderSearchScript(entries) {
    const payload = JSON.stringify(entries).replace(/</g, "\\u003c");
    return `${SEARCH_CLIENT_JS.replace("__INDEX__", payload)}\n`;
}
//# sourceMappingURL=toolbar.js.map
let ALL = [];
let PAGES = null;
let _sugActive = -1;

let state = {
  q: "",
  systems: new Set(),
  types: new Set(),
  sort: "relevance",
  lang: "en",
  showAll: { system: false, type: false },
  facetSearch: { system: "", type: "" },
  showZero: { system: false, type: false },
};

const elQ = document.getElementById("q");
const elClear = document.getElementById("clearBtn");
const elReset = document.getElementById("resetBtn");
const elFacetSystem = document.getElementById("facetSystem");
const elFacetType = document.getElementById("facetType");
const elMoreSystem = document.getElementById("moreSystem");
const elMoreType = document.getElementById("moreType");
const elFacetSystemSearch = document.getElementById("facetSystemSearch");
const elFacetTypeSearch = document.getElementById("facetTypeSearch");
const elFacetSystemShow0 = document.getElementById("facetSystemShow0");
const elFacetTypeShow0 = document.getElementById("facetTypeShow0");
const elFacetSystemSearchClear = document.querySelector("#facetSystemSearch")?.parentElement?.querySelector(".facet-search-clear");
const elFacetTypeSearchClear = document.querySelector("#facetTypeSearch")?.parentElement?.querySelector(".facet-search-clear");

const elResults = document.getElementById("resultsList");
const elCount = document.getElementById("count");
const elSort = document.getElementById("sort");
const elLang = document.getElementById("langSelect");
const elPillbar = document.getElementById("pillbar");
const elLoading = document.getElementById("loadingIndicator");
const elLoadingText = elLoading ? elLoading.querySelector(".loading-text") : null;
const elResultsSection = document.querySelector(".results");

const elFiltersTitle = document.getElementById("filtersTitle");
const elFacetSystemTitle = document.getElementById("facetSystemTitle");
const elFacetTypeTitle = document.getElementById("facetTypeTitle");

// accordion elements + header badges
const accSystem = document.getElementById("accSystem");
const accType = document.getElementById("accType");
const elFacetSystemSelected = document.getElementById("facetSystemSelected");
const elFacetTypeSelected = document.getElementById("facetTypeSelected");
const elFacetSystemTotal = document.getElementById("facetSystemTotal");
const elFacetTypeTotal = document.getElementById("facetTypeTotal");

const STORAGE_KEY = "sportcare_search_v4";

const I18N = {
  en: {
    searchPlaceholder: "Type to search (e.g., bullet, cannula, 1055…)",
    clear: "Clear",
    filters: "Filters",
    reset: "Reset",
    system: "System",
    type: "Type",
    sortRelevance: "Sort: Relevance",
    sortAZ: "Sort: A → Z",
    sortRef: "Sort: Ref. Num.",
    noResults: "No results. Try a different term.",
    resultCount: (n) => `${n} result${n === 1 ? "" : "s"}`,
    metaRef: "Ref",
    showMore: "Show more",
    showLess: "Show less",
    clearAll: "Clear all filters",
    searchPill: (q) => `Search: “${q}”`,
    remove: "Remove",
    hint: "Start typing in the search bar to see results.",
    selectedN: (n) => (n > 0 ? `(${n})` : ""),
  },
  es: {
    searchPlaceholder: "Escribe para buscar (ej.: bullet, cannula, 1055…)",
    clear: "Limpiar",
    filters: "Filtros",
    reset: "Restablecer",
    system: "Sistema",
    type: "Tipo",
    sortRelevance: "Orden: Relevancia",
    sortAZ: "Orden: A → Z",
    sortRef: "Orden: Núm. Ref.",
    noResults: "Sin resultados. Prueba otro término.",
    resultCount: (n) => `${n} resultado${n === 1 ? "" : "s"}`,
    metaRef: "Ref",
    showMore: "Mostrar más",
    showLess: "Mostrar menos",
    clearAll: "Quitar filtros",
    searchPill: (q) => `Búsqueda: “${q}”`,
    remove: "Quitar",
    hint: "Empieza a escribir en la barra de búsqueda para ver resultados.",
    selectedN: (n) => (n > 0 ? `(${n})` : ""),
  },
};

const TYPE_TRANSLATIONS = {
  Guide: { es: "Guía", en: "Guide" },
  Cannula: { es: "Cánula", en: "Cannula" },
  Sleeve: { es: "Manga", en: "Sleeve" },
  Hook: { es: "Gancho", en: "Hook" },
  Driver: { es: "Destornillador", en: "Driver" },
  Handle: { es: "Mango", en: "Handle" },
  Drill: { es: "Broca", en: "Drill" },
  Tap: { es: "Macho", en: "Tap" },
  Screw: { es: "Tornillo", en: "Screw" },
  Probe: { es: "Sonda", en: "Probe" },
  Sizer: { es: "Medidor", en: "Sizer" },
  Curette: { es: "Cureta", en: "Curette" },
  Punch: { es: "Punzón", en: "Punch" },
  Awl: { es: "Lezna", en: "Awl" },
  Clamp: { es: "Pinza", en: "Clamp" },
  Cutter: { es: "Cortador", en: "Cutter" },
  Bullet: { es: "Bullet", en: "Bullet" },
  Other: { es: "Otro", en: "Other" },
};

function t(key, ...args) {
  const dict = I18N[state.lang] || I18N.en;
  const val = dict[key];
  return typeof val === "function" ? val(...args) : val ?? key;
}

function trType(typeVal) {
  const row = TYPE_TRANSLATIONS[typeVal];
  if (!row) return typeVal;
  return row[state.lang] || typeVal;
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightText(label, query){
  if (!query) return escapeHtml(label);
  const q = String(query).trim();
  if (!q) return escapeHtml(label);
  const lower = String(label).toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return escapeHtml(label);
  const before = escapeHtml(label.slice(0, idx));
  const mid = escapeHtml(label.slice(idx, idx + q.length));
  const after = escapeHtml(label.slice(idx + q.length));
  return `${before}<mark>${mid}</mark>${after}`;
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function scoreItem(item, qNorm) {
  if (!qNorm) return 0;
  const text = item._searchNorm;
  if (text.includes(qNorm)) return 100;
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const tok of tokens) if (text.includes(tok)) score += 20;
  return score;
}

function applyFilters() {
  // IMPORTANT: don't show results until user searches
  const qNorm = normalize(state.q.trim());
  if (!qNorm) return [];

  let items = ALL;

  if (state.systems.size) items = items.filter((x) => state.systems.has(x.system));
  if (state.types.size) items = items.filter((x) => state.types.has(x.type));

  items = items
    .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
    .filter((x) => x._score > 0);

  if (state.sort === "az") items.sort((a, b) => a.description.localeCompare(b.description));
  else if (state.sort === "ref") items.sort((a, b) => String(a.ref_num).localeCompare(String(b.ref_num)));
  else items.sort((a, b) => (b._score - a._score) || a.description.localeCompare(b.description));

  return items;
}

function facetCounts(baseItems) {
  const sys = new Map();
  const typ = new Map();
  for (const it of baseItems) {
    sys.set(it.system, (sys.get(it.system) || 0) + 1);
    typ.set(it.type, (typ.get(it.type) || 0) + 1);
  }
  return {
    systems: [...sys.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    types: [...typ.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}


function filterBySearch(items) {
  const qNorm = normalize(state.q.trim());
  if (!qNorm) return items;
  return items
    .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
    .filter((x) => x._score > 0);
}

function uniqueValues(items, key) {
  const set = new Set();
  for (const it of items) set.add(it[key]);
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * Returns entries [value, count] for a facet with "dynamic" counts:
 * - counts reflect current selections in OTHER facets (and search term if present)
 * - options with 0 can be included (or hidden) via state.showZero[facetKey]
 * - selected values are always included
 */
function computeFacetEntries(facetKey, universeOnly = false) {
  // Universe: values that exist under current SEARCH only (so irrelevant values don't show up)
  let universeBase = filterBySearch(ALL);
  const universeVals = uniqueValues(universeBase, facetKey);

  // Base for counts: apply OTHER facet selections (excluding this facet's own selection)
  let base = universeBase;
  if (facetKey === "system") {
    if (state.types.size) base = base.filter((x) => state.types.has(x.type));
  } else if (facetKey === "type") {
    if (state.systems.size) base = base.filter((x) => state.systems.has(x.system));
  }

  const counts = new Map();
  for (const v of universeVals) counts.set(v, 0);
  for (const it of base) {
    const v = it[facetKey];
    counts.set(v, (counts.get(v) || 0) + 1);
  }

  let entries = universeVals.map((v) => [v, counts.get(v) || 0]);

  if (universeOnly) return entries;

  // Apply "search within facet"
  const q = normalize(state.facetSearch?.[facetKey] || "");
  if (q) {
    entries = entries.filter(([v]) => {
      const raw = normalize(String(v));
      if (raw.includes(q)) return true;
      if (facetKey === "type") {
        const tr = normalize(String(trType(v)));
        return tr.includes(q);
      }
      return false;
    });
  }

  // Hide 0-count options unless toggled on (selected values always stay visible)
  const show0 = !!state.showZero?.[facetKey];
  if (!show0) {
    entries = entries.filter(([v, c]) => {
      if (c > 0) return true;
      return facetKey === "system" ? state.systems.has(v) : state.types.has(v);
    });
  }

  return entries;
}

function renderCheckboxFacet(container, entries, selectedSet, onToggle, labelFn, opts) {
  const { limit = 6, showAll = false } = opts || {};
  container.innerHTML = "";

  // Pin selected values to the top (while keeping stable ordering for the rest)
  const selectedEntries = [];
  const unselectedEntries = [];
  for (const e of entries) {
    const value = e[0];
    if (selectedSet.has(value)) selectedEntries.push(e);
    else unselectedEntries.push(e);
  }
  const ordered = selectedEntries.concat(unselectedEntries);

  // When collapsed, always show ALL selected + as many unselected as fit in the limit
  const visible = showAll
    ? ordered
    : selectedEntries.concat(unselectedEntries.slice(0, Math.max(0, limit - selectedEntries.length)));

  const total = ordered.length;

  for (const [value, count] of visible) {
    const id = `cb_${container.id}_${value}`.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    const row = document.createElement("label");
    row.className = "facet-row";
    row.setAttribute("for", id);

    const left = document.createElement("div");
    left.className = "facet-left";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;

    const isSelected = selectedSet.has(value);
    cb.checked = isSelected;

    // Disable options with 0 results (but keep selected ones clickable so user can remove)
    const isDisabled = (count === 0 && !isSelected);
    cb.disabled = isDisabled;
    if (isDisabled) { row.classList.add("facet-row--disabled"); row.setAttribute("aria-disabled","true"); }

    cb.addEventListener("change", () => onToggle(value, cb.checked));

    const name = document.createElement("span");
    name.className = "facet-name";
    const rawLabel = labelFn ? labelFn(value) : value;
    const facetKey = container.id === "facetSystem" ? "system" : (container.id === "facetType" ? "type" : "");
    const q = facetKey ? (state.facetSearch?.[facetKey] || "") : "";
    name.innerHTML = highlightText(String(rawLabel), q);

    const badge = document.createElement("span");
    badge.className = "facet-badge";
    badge.textContent = `${count}`;

    left.appendChild(cb);
    left.appendChild(name);

    row.appendChild(left);
    row.appendChild(badge);

    container.appendChild(row);
  }

  return { total, shownCount: visible.length };
}

function setupFacetKeyboardNav(container){
  if (!container) return;
  container.addEventListener("keydown", (e) => {
    const keys = ["ArrowDown","ArrowUp","Home","End"];
    if (!keys.includes(e.key)) return;

    const active = document.activeElement;
    if (!active || active.tagName !== "INPUT" || active.type !== "checkbox") return;
    if (!container.contains(active)) return;

    const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      .filter(cb => !cb.disabled);

    if (!boxes.length) return;

    const idx = boxes.indexOf(active);
    let next = idx;

    if (e.key === "ArrowDown") next = Math.min(boxes.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = boxes.length - 1;

    if (next !== idx) {
      e.preventDefault();
      boxes[next].focus();
    }
  });
}


function renderPillbar() {
  elPillbar.innerHTML = "";

  const pills = [];

  if (state.q.trim()) {
    pills.push({
      label: t("searchPill", state.q.trim()),
      clear: () => { state.q = ""; elQ.value = ""; },
    });
  }

  for (const sys of [...state.systems]) {
    pills.push({ label: `${t("system")}: ${sys}`, clear: () => state.systems.delete(sys) });
  }

  for (const typ of [...state.types]) {
    pills.push({ label: `${t("type")}: ${trType(typ)}`, clear: () => state.types.delete(typ) });
  }

  if (pills.length) {
    const clearAll = document.createElement("div");
    clearAll.className = "pill primary";
    clearAll.innerHTML = `<span>${t("clearAll")}</span>`;
    const btn = document.createElement("button");
    btn.className = "x";
    btn.setAttribute("aria-label", t("clearAll"));
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      state.q = ""; elQ.value = "";
      state.systems = new Set();
      state.types = new Set();
      syncUrl();
      scheduleRender();
});
    clearAll.appendChild(btn);
    elPillbar.appendChild(clearAll);
  }

  for (const p of pills) {
    const div = document.createElement("div");
    div.className = "pill";
    div.innerHTML = `<span>${p.label}</span>`;
    const x = document.createElement("button");
    x.className = "x";
    x.setAttribute("aria-label", t("remove"));
    x.textContent = "×";
    x.addEventListener("click", () => {
      p.clear();
      syncUrl();
      scheduleRender();
});
    div.appendChild(x);
    elPillbar.appendChild(div);
  }
}

function renderResults(items) {
  if (!state.q.trim()) {
    elCount.textContent = "";
    elResults.innerHTML = `<div class="hint">${t("hint")}</div>`;
    return;
  }

  elCount.textContent = t("resultCount", items.length);

  elResults.innerHTML = "";
  if (!items.length) {
    elResults.innerHTML = `<div class="result">${t("noResults")}</div>`;
    return;
  }

  for (const it of items) {
    const row = document.createElement("article");
    row.className = "result";
    row.innerHTML = `
      <a class="result-title" href="#" onclick="return false;">${it.description}</a>
      <div class="result-meta">
        <span class="kv"><strong>${t("metaRef")}:</strong> ${it.ref_num}</span>
        <span class="kv"><strong>${t("system")}:</strong> ${it.system}</span>
        <span class="kv"><strong>${t("type")}:</strong> ${trType(it.type)}</span>
      </div>
    `;
    elResults.appendChild(row);
  }
}

function applyI18nToUI() {
  elQ.placeholder = t("searchPlaceholder");
  elClear.textContent = t("clear");
  elFiltersTitle.textContent = t("filters");
  elReset.textContent = t("reset");
  elFacetSystemTitle.textContent = t("system");
  elFacetTypeTitle.textContent = t("type");

  elSort.querySelector('option[value="relevance"]').textContent = t("sortRelevance");
  elSort.querySelector('option[value="az"]').textContent = t("sortAZ");
  elSort.querySelector('option[value="ref"]').textContent = t("sortRef");

  if (elFacetSystemSearch) elFacetSystemSearch.placeholder = t("facetSearchPlaceholder");
  if (elFacetTypeSearch) elFacetTypeSearch.placeholder = t("facetSearchPlaceholder");
  const sysTextEl = elFacetSystemShow0 ? elFacetSystemShow0.parentElement?.querySelector(".facet-toggle-text") : null;
  const typeTextEl = elFacetTypeShow0 ? elFacetTypeShow0.parentElement?.querySelector(".facet-toggle-text") : null;
  if (sysTextEl) sysTextEl.textContent = t("showUnavailable");
  if (typeTextEl) typeTextEl.textContent = t("showUnavailable");
}

function persistAccordions() {
  try {
    const payload = JSON.stringify({
      openSystem: accSystem?.open ?? true,
      openType: accType?.open ?? true,
    });
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (_) {}
}

function loadAccordionState(params) {
  // priority: URL params -> localStorage -> default open
  const urlSys = params.get("openSystem");
  const urlType = params.get("openType");

  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (_) {}

  const openSystem = urlSys !== null ? urlSys === "1" : (stored?.openSystem ?? true);
  const openType = urlType !== null ? urlType === "1" : (stored?.openType ?? true);

  if (accSystem) accSystem.open = openSystem;
  if (accType) accType.open = openType;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.systems.size) params.set("system", [...state.systems].join("|"));
  if (state.types.size) params.set("type", [...state.types].join("|"));
  if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);
  if (state.lang && state.lang !== "en") params.set("lang", state.lang);

  // accordion state
  if (accSystem) params.set("openSystem", accSystem.open ? "1" : "0");
  if (accType) params.set("openType", accType.open ? "1" : "0");

  const qs = params.toString();
  const newUrl = qs ? `${location.pathname}?${qs}` : `${location.pathname}`;
  history.replaceState(null, "", newUrl);
}

function setupMoreButton(btn, total, shown, key) {
  if (!btn) return;
  if (total <= 6) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "inline-block";
  btn.textContent = state.showAll[key] ? t("showLess") : t("showMore");
  btn.onclick = () => {
    state.showAll[key] = !state.showAll[key];
    scheduleRender();
};
}

function updateAccordionHeaderBadges(sysEntries, typeEntries, sysUniverse, typeUniverse) {
  elFacetSystemSelected.textContent = t("selectedN", state.systems.size);
  elFacetTypeSelected.textContent = t("selectedN", state.types.size);

  // Show available / total like (4 / 12)
  elFacetSystemTotal.textContent = `${sysEntries} / ${sysUniverse}`;
  elFacetTypeTotal.textContent = `${typeEntries} / ${typeUniverse}`;
}

function rerender() {
  renderPillbar();

  // Facets: dynamic counts based on search + current selections (other facets)

  const sysMeta = renderCheckboxFacet(
    elFacetSystem,
    computeFacetEntries("system"),
    state.systems,
    (value, checked) => {
      if (checked) state.systems.add(value);
      else state.systems.delete(value);
      syncUrl();
      scheduleRender();
},
    (v) => v,
    { limit: 6, showAll: state.showAll.system }
  );

  const typMeta = renderCheckboxFacet(
    elFacetType,
    computeFacetEntries("type"),
    state.types,
    (value, checked) => {
      if (checked) state.types.add(value);
      else state.types.delete(value);
      syncUrl();
      scheduleRender();
},
    (v) => trType(v),
    { limit: 6, showAll: state.showAll.type }
  );

  setupMoreButton(elMoreSystem, sysMeta.total, sysMeta.shownCount, "system");
  setupMoreButton(elMoreType, typMeta.total, typMeta.shownCount, "type");

  updateAccordionHeaderBadges(sysMeta.total, typMeta.total);

  const items = applyFilters();
  renderResults(items);

  renderPillbar();
}


let _renderTimer = null;
let _loadingOffTimer = null;

function setLoading(isLoading){
  if (!elLoading || !elResultsSection) return;
  if (isLoading){
    elLoading.hidden = false;
    if (elLoadingText) elLoadingText.textContent = t("loadingText");
    elResultsSection.classList.add("is-loading");
  } else {
    elLoading.hidden = true;
    elResultsSection.classList.remove("is-loading");
  }
}

// Debounced, server-like render.
// - Shows loading immediately
// - Waits a short delay to simulate server response
function scheduleRender(delayMs = 220){
  if (_renderTimer) clearTimeout(_renderTimer);
  if (_loadingOffTimer) clearTimeout(_loadingOffTimer);

  setLoading(true);

  _renderTimer = setTimeout(() => {
    rerender();
    // keep spinner visible for a tiny moment so it feels like a real fetch
    _loadingOffTimer = setTimeout(() => setLoading(false), 120);
  }, delayMs);
}


function debounce(fn, ms = 150) {
  let tmr;
  return (...args) => {
    clearTimeout(tmr);
    tmr = setTimeout(() => fn(...args), ms);
  };
}

function parseMulti(paramVal) {
  if (!paramVal) return [];
  return String(paramVal).split("|").map((s) => s.trim()).filter(Boolean);
}

async function init() {
  const res = await fetch("./data/products.json");
  ALL = await res.json();
  ALL = ALL.map((x) => ({ ...x, _searchNorm: normalize(`${x._search}`) }));

  const params = new URLSearchParams(location.search);

  // accordion open/close state
  loadAccordionState(params);

  state.q = params.get("q") || "";
  state.sort = params.get("sort") || "relevance";
  state.lang = (params.get("lang") || "en").toLowerCase();
  if (!I18N[state.lang]) state.lang = "en";

  state.systems = new Set(parseMulti(params.get("system")));
  state.types = new Set(parseMulti(params.get("type")));

  // facet controls
  state.showZero.system = (params.get("show0System") || "0") === "1";
  state.showZero.type = (params.get("show0Type") || "0") === "1";


  elQ.value = state.q;
  elSort.value = state.sort;
  elLang.value = state.lang;

  if (elFacetSystemShow0) elFacetSystemShow0.checked = state.showZero.system;
  if (elFacetTypeShow0) elFacetTypeShow0.checked = state.showZero.type;
  if (elFacetSystemSearch) elFacetSystemSearch.value = state.facetSearch.system;
  if (elFacetTypeSearch) elFacetTypeSearch.value = state.facetSearch.type;


  applyI18nToUI();
  setupFacetKeyboardNav(elFacetSystem);
  setupFacetKeyboardNav(elFacetType);
  scheduleRender();
// persist accordion state on toggle
  if (accSystem) accSystem.addEventListener("toggle", () => { persistAccordions(); syncUrl(); });
  if (accType) accType.addEventListener("toggle", () => { persistAccordions(); syncUrl(); });
}

elQ.addEventListener("input", debounce(async () => {
  state.q = elQ.value || "";
  syncUrl();

  const pages = await loadPages();
  const q = (state.q || "").trim();
  const filtered = pages.filter(p => normalize(p.title).includes(normalize(q)) || normalize(p.url).includes(normalize(q)));
  renderSuggestions(filtered, q);

  // Only render product results when user searches (existing behavior). Keep debounced server-like feel.
  scheduleRender();
}, 220));


elQ.addEventListener("keydown", async (e) => {
  if (!elSuggestions || elSuggestions.hidden) return;

  const pages = await loadPages();
  const q = (state.q || "").trim();
  const filtered = pages.filter(p => normalize(p.title).includes(normalize(q)) || normalize(p.url).includes(normalize(q)));

  const itemsCount = Math.min(filtered.length, 8);
  if (!itemsCount) return;

  if (e.key === "ArrowDown"){
    e.preventDefault();
    const next = _sugActive < 0 ? 0 : Math.min(itemsCount - 1, _sugActive + 1);
    setActiveSuggestion(next);
  } else if (e.key === "ArrowUp"){
    e.preventDefault();
    const prev = _sugActive <= 0 ? (itemsCount - 1) : (_sugActive - 1);
    setActiveSuggestion(prev);
  } else if (e.key === "Enter"){
    if (_sugActive >= 0){
      e.preventDefault();
      openSuggestion(filtered, _sugActive);
    }
  } else if (e.key === "Escape"){
    elSuggestions.hidden = true;
  }
});
  scheduleRender();
}, 180));

elClear.addEventListener("click", () => {
  elQ.value = "";
  state.q = "";
  syncUrl();
  scheduleRender();
});

elReset.addEventListener("click", () => {
  state.systems = new Set();
  state.types = new Set();
  state.q = "";
  elQ.value = "";
  syncUrl();
  scheduleRender();
});

elSort.addEventListener("change", () => {
  state.sort = elSort.value;
  syncUrl();
  scheduleRender();
});

if (elFacetSystemSearch) {
  elFacetSystemSearch.addEventListener("input", debounce(() => {
    state.facetSearch.system = elFacetSystemSearch.value || "";
    scheduleRender();
}, 120));
}
if (elFacetTypeSearch) {
  elFacetTypeSearch.addEventListener("input", debounce(() => {
    state.facetSearch.type = elFacetTypeSearch.value || "";
    scheduleRender();
}, 120));
}
if (elFacetSystemShow0) {
  elFacetSystemShow0.addEventListener("change", () => {
    state.showZero.system = !!elFacetSystemShow0.checked;
    syncUrl();
    scheduleRender();
});
}
if (elFacetTypeShow0) {
  elFacetTypeShow0.addEventListener("change", () => {
    state.showZero.type = !!elFacetTypeShow0.checked;
    syncUrl();
    scheduleRender();
});
}

elLang.addEventListener("change", () => {
  state.lang = elLang.value;
  applyI18nToUI();
  syncUrl();
  scheduleRender();
});



if (elSuggestions){
  elSuggestions.addEventListener("click", async (e) => {
    const itemEl = e.target.closest(".sug-item");
    if (!itemEl) return;
    const idx = parseInt(itemEl.getAttribute("data-idx") || "-1", 10);
    if (idx < 0) return;

    const pages = await loadPages();
    const q = (state.q || "").trim();
    const filtered = pages.filter(p => normalize(p.title).includes(normalize(q)) || normalize(p.url).includes(normalize(q)));
    openSuggestion(filtered, idx);
  });

  document.addEventListener("click", (e) => {
    if (e.target === elQ || elSuggestions.contains(e.target)) return;
    elSuggestions.hidden = true;
  });
}

init();

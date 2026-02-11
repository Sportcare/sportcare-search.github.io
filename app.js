let ALL = [];
let state = {
  q: "",
  systems: new Set(),
  types: new Set(),
  sort: "relevance",
  lang: "en",
  showAll: { system: false, type: false },
};

const elQ = document.getElementById("q");
const elClear = document.getElementById("clearBtn");
const elReset = document.getElementById("resetBtn");
const elFacetSystem = document.getElementById("facetSystem");
const elFacetType = document.getElementById("facetType");
const elMoreSystem = document.getElementById("moreSystem");
const elMoreType = document.getElementById("moreType");
const elResults = document.getElementById("resultsList");
const elCount = document.getElementById("count");
const elSort = document.getElementById("sort");
const elLang = document.getElementById("langSelect");
const elPillbar = document.getElementById("pillbar");

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
    searchPlaceholder: "Type to search (e.g., SKU, retroknife, canulla, 1055...)",
    clear: "Clear",
    filters: "Filter by:",
    mobileFilters: "Filters",
    mobileDone: "Done",
    mobileClose: "Close",
    mobileClear: "Clear",
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
    filters: "Filtrar por:",
    mobileFilters: "Filtros",
    mobileDone: "Listo",
    mobileClose: "Cerrar",
    mobileClear: "Quitar",
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
    name.textContent = labelFn ? labelFn(value) : value;

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
      rerender();
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
      rerender();
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
      <div class="result-thumb" aria-hidden="true"><span class="thumb-text">Pending image</span></div>
      <div class="result-body">
        <a class="result-title" href="#" onclick="return false;">${it.description}</a>
        <div class="result-meta">
          <span class="kv"><strong>${t("metaRef")}:</strong> ${it.ref_num}</span>
          <span class="kv"><strong>${t("system")}:</strong> ${it.system}</span>
          <span class="kv"><strong>${t("type")}:</strong> ${trType(it.type)}</span>
        </div>
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
    rerender();
  };
}

function updateAccordionHeaderBadges(facetSystemsTotal, facetTypesTotal) {
  // "Type (2)" and total options badge
  elFacetSystemSelected.textContent = t("selectedN", state.systems.size);
  elFacetTypeSelected.textContent = t("selectedN", state.types.size);

  elFacetSystemTotal.textContent = String(facetSystemsTotal);
  elFacetTypeTotal.textContent = String(facetTypesTotal);
}

function rerender() {
  renderPillbar();

  // Facets: counts based on search-only base. If no search, show counts from ALL.
  const qNorm = normalize(state.q.trim());
  let base = ALL;

  if (qNorm) {
    base = base
      .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
      .filter((x) => x._score > 0);
  }

  const facets = facetCounts(base);

  const sysMeta = renderCheckboxFacet(
    elFacetSystem,
    facets.systems,
    state.systems,
    (value, checked) => {
      if (checked) state.systems.add(value);
      else state.systems.delete(value);
      syncUrl();
      rerender();
    },
    (v) => v,
    { limit: 6, showAll: state.showAll.system }
  );

  const typMeta = renderCheckboxFacet(
    elFacetType,
    facets.types,
    state.types,
    (value, checked) => {
      if (checked) state.types.add(value);
      else state.types.delete(value);
      syncUrl();
      rerender();
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
  updateMobileFiltersBadge();
}


function debounce(fn, ms = 150) {
  let tmr;
  return (...args) => {
    clearTimeout(tmr);
    tmr = setTimeout(() => fn(...args), ms);
  };
}

function isMobileDrawerViewport(){
  return window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
}

let _filtersPlaceholder = null;

function updateMobileFiltersBadge(){
  const fab = document.getElementById("mobileFiltersFab");
  const countEl = document.getElementById("mobileFiltersCount");
  const labelEl = document.querySelector("#mobileFiltersFab .mobile-fab-label");
  if (!fab) return;

  const n = (state.systems?.size || 0) + (state.types?.size || 0);
  if (countEl){
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
  }
  if (labelEl){
    labelEl.textContent = t("mobileFilters");
  }
}

function openMobileFilters(){
  const drawer = document.getElementById("mobileFiltersDrawer");
  const overlay = document.getElementById("mobileFiltersOverlay");
  if (drawer) drawer.hidden = false;
  if (overlay) overlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeMobileFilters(){
  const drawer = document.getElementById("mobileFiltersDrawer");
  const overlay = document.getElementById("mobileFiltersOverlay");
  if (drawer) drawer.hidden = true;
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = "";
}

function applyMobileFiltersDrawer(){
  const isMob = isMobileDrawerViewport();

  const fab = document.getElementById("mobileFiltersFab");
  const drawer = document.getElementById("mobileFiltersDrawer");
  const overlay = document.getElementById("mobileFiltersOverlay");
  const mount = document.getElementById("mobileFiltersMount");
  const sortMount = document.getElementById("mobileFiltersSortMount");
  const filters = document.querySelector("aside.filters");
  const closeBtn = document.getElementById("mobileFiltersClose");
  const doneBtn = document.getElementById("mobileFiltersApply");
  const clearBtn = document.getElementById("mobileFiltersClear");

  if (!filters || !mount || !fab || !drawer) return;

  if (isMob){
    // create placeholder at original location once
    if (!_filtersPlaceholder){
      _filtersPlaceholder = document.createElement("div");
      _filtersPlaceholder.id = "filtersPlaceholder";
      filters.parentElement.insertBefore(_filtersPlaceholder, filters);
    }

    if (!mount.contains(filters)){
      mount.appendChild(filters);
    }

    fab.hidden = false;

    // Place Filters button next to Sort on mobile
    if (sortMount && !sortMount.contains(fab)){
      sortMount.appendChild(fab);
    }
    // labels
    const title = drawer.querySelector(".mobile-drawer-title");
    if (title) title.textContent = t("filters");
    if (closeBtn) closeBtn.textContent = t("mobileClose");
    if (doneBtn) doneBtn.textContent = t("mobileDone");
    if (clearBtn) clearBtn.textContent = t("mobileClear");

    // wire events (safe to re-assign)
    fab.onclick = openMobileFilters;

    if (overlay){
      overlay.onclick = closeMobileFilters;
    }
    if (closeBtn){
      closeBtn.onclick = closeMobileFilters;
    }
    if (doneBtn){
      doneBtn.onclick = closeMobileFilters;
    }
    if (clearBtn){
      clearBtn.onclick = () => {
        state.systems.clear();
        state.types.clear();
        syncUrl();
        rerender();
        closeMobileFilters();
      };
    }

    // keep drawer closed by default

    closeMobileFilters();
  } else {
    // restore filters to original spot
    if (_filtersPlaceholder && _filtersPlaceholder.parentElement){
      _filtersPlaceholder.parentElement.insertBefore(filters, _filtersPlaceholder);
      _filtersPlaceholder.remove();
      _filtersPlaceholder = null;
    }

    if (fab){
      fab.hidden = true;
      if (!document.body.contains(fab)) document.body.appendChild(fab);
    }
    closeMobileFilters();
  }
}


// --- Mobile-only: move searchbox out of navbar into main layout ---
function isMobileViewport(){
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

let _searchboxPlaceholder = null;
let _searchboxOriginalParent = null;


function applyMobileSearchPlacement(){
  const mount = document.getElementById("mobileSearchMount");
  const searchbox = document.querySelector(".searchbox");
  if (!mount || !searchbox) return;

  const mobile = isMobileViewport();

  if (mobile){
    // Create placeholder only when we actually move (keeps desktop flex clean)
    if (!_searchboxPlaceholder){
      _searchboxPlaceholder = document.createElement("div");
      _searchboxPlaceholder.id = "searchboxPlaceholder";
      _searchboxPlaceholder.style.display = "none";
      _searchboxOriginalParent = searchbox.parentElement;
      _searchboxOriginalParent.insertBefore(_searchboxPlaceholder, searchbox);
    }
    if (!mount.contains(searchbox)){
      mount.appendChild(searchbox);
    }
  } else {
    // Restore only if placeholder exists (meaning we moved at least once)
    if (_searchboxPlaceholder && _searchboxPlaceholder.parentElement){
      _searchboxPlaceholder.parentElement.insertBefore(searchbox, _searchboxPlaceholder);
      _searchboxPlaceholder.remove();
      _searchboxPlaceholder = null;
    }
  }
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

  elQ.value = state.q;
  elSort.value = state.sort;
  elLang.value = state.lang;

  applyI18nToUI();
  applyMobileFiltersDrawer();
  window.addEventListener('resize', debounce(applyMobileFiltersDrawer, 150));
  applyMobileSearchPlacement();
  window.addEventListener('resize', debounce(applyMobileSearchPlacement, 150));
  rerender();

  // persist accordion state on toggle
  if (accSystem) accSystem.addEventListener("toggle", () => { persistAccordions(); syncUrl(); });
  if (accType) accType.addEventListener("toggle", () => { persistAccordions(); syncUrl(); });
}

elQ.addEventListener("input", debounce(() => {
  state.q = elQ.value;
  syncUrl();
  rerender();
}, 180));

elClear.addEventListener("click", () => {
  elQ.value = "";
  state.q = "";
  syncUrl();
  rerender();
});

elReset.addEventListener("click", () => {
  state.systems = new Set();
  state.types = new Set();
  state.q = "";
  elQ.value = "";
  syncUrl();
  rerender();
});

elSort.addEventListener("change", () => {
  state.sort = elSort.value;
  syncUrl();
  rerender();
});

elLang.addEventListener("change", () => {
  state.lang = elLang.value;
  applyI18nToUI();
  applyMobileFiltersDrawer();
  window.addEventListener('resize', debounce(applyMobileFiltersDrawer, 150));
  applyMobileSearchPlacement();
  window.addEventListener('resize', debounce(applyMobileSearchPlacement, 150));
  syncUrl();
  rerender();
});

init();

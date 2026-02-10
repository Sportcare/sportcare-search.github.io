let ALL = [];
let state = {
  q: "",
  systems: new Set(),   // multi-select
  types: new Set(),     // multi-select
  sort: "relevance",
  lang: "en",
};

const elQ = document.getElementById("q");
const elClear = document.getElementById("clearBtn");
const elReset = document.getElementById("resetBtn");
const elFacetSystem = document.getElementById("facetSystem");
const elFacetType = document.getElementById("facetType");
const elResults = document.getElementById("resultsList");
const elCount = document.getElementById("count");
const elSort = document.getElementById("sort");
const elLang = document.getElementById("langSelect");

const elFiltersTitle = document.getElementById("filtersTitle");
const elFacetSystemTitle = document.getElementById("facetSystemTitle");
const elFacetTypeTitle = document.getElementById("facetTypeTitle");

const I18N = {
  en: {
    searchPlaceholder: "Search (e.g., bullet, cannula, 1055…)",
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
  },
  es: {
    searchPlaceholder: "Buscar (ej.: bullet, cannula, 1055…)",
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
  },
};

// translate facet values (type)
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
  for (const tok of tokens) {
    if (text.includes(tok)) score += 20;
  }
  return score;
}

function applyFilters() {
  const qNorm = normalize(state.q.trim());
  let items = ALL;

  if (state.systems.size) {
    items = items.filter((x) => state.systems.has(x.system));
  }
  if (state.types.size) {
    items = items.filter((x) => state.types.has(x.type));
  }

  if (qNorm) {
    items = items
      .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
      .filter((x) => x._score > 0);
  } else {
    items = items.map((x) => ({ ...x, _score: 0 }));
  }

  if (state.sort === "az") {
    items.sort((a, b) => a.description.localeCompare(b.description));
  } else if (state.sort === "ref") {
    items.sort((a, b) => String(a.ref_num).localeCompare(String(b.ref_num)));
  } else {
    items.sort((a, b) => (b._score - a._score) || a.description.localeCompare(b.description));
  }

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
    systems: [...sys.entries()].sort((a,b)=>a[0].localeCompare(b[0])),
    types: [...typ.entries()].sort((a,b)=>a[0].localeCompare(b[0])),
  };
}

function renderCheckboxFacet(container, entries, selectedSet, onToggle, labelFn) {
  container.innerHTML = "";
  for (const [value, count] of entries) {
    const id = `cb_${container.id}_${value}`.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"");
    const row = document.createElement("label");
    row.className = "facet-row";
    row.setAttribute("for", id);

    const left = document.createElement("div");
    left.className = "facet-left";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.checked = selectedSet.has(value);
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
}

function renderResults(items) {
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
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.systems.size) params.set("system", [...state.systems].join("|"));
  if (state.types.size) params.set("type", [...state.types].join("|"));
  if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);
  if (state.lang && state.lang !== "en") params.set("lang", state.lang);

  const qs = params.toString();
  const newUrl = qs ? `${location.pathname}?${qs}` : `${location.pathname}`;
  history.replaceState(null, "", newUrl);
}

function rerender() {
  // Facet counts based on search-only base (keeps counts intuitive)
  const qNorm = normalize(state.q.trim());
  let base = ALL;

  if (qNorm) {
    base = base
      .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
      .filter((x) => x._score > 0);
  }

  const facets = facetCounts(base);

  renderCheckboxFacet(
    elFacetSystem,
    facets.systems,
    state.systems,
    (value, checked) => {
      if (checked) state.systems.add(value);
      else state.systems.delete(value);
      syncUrl();
      rerender();
    }
  );

  renderCheckboxFacet(
    elFacetType,
    facets.types,
    state.types,
    (value, checked) => {
      if (checked) state.types.add(value);
      else state.types.delete(value);
      syncUrl();
      rerender();
    },
    (v) => trType(v)
  );

  const items = applyFilters();
  renderResults(items);
}

function debounce(fn, ms=150){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

function parseMulti(paramVal) {
  if (!paramVal) return [];
  return String(paramVal).split("|").map(s=>s.trim()).filter(Boolean);
}

async function init() {
  const res = await fetch("./data/products.json");
  ALL = await res.json();
  ALL = ALL.map((x) => ({ ...x, _searchNorm: normalize(`${x._search}`) }));

  const params = new URLSearchParams(location.search);
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
  rerender();
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
  syncUrl();
  rerender();
});

init();

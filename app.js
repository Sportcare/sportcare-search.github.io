let ALL = [];
let state = {
  q: "",
  system: null,
  type: null,
  sort: "relevance",
};

const elQ = document.getElementById("q");
const elClear = document.getElementById("clearBtn");
const elReset = document.getElementById("resetBtn");
const elFacetSystem = document.getElementById("facetSystem");
const elFacetType = document.getElementById("facetType");
const elResults = document.getElementById("resultsList");
const elCount = document.getElementById("count");
const elSort = document.getElementById("sort");

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
  for (const t of tokens) {
    if (text.includes(t)) score += 20;
  }
  return score;
}

function getFacets(items) {
  const systems = new Map();
  const types = new Map();
  for (const it of items) {
    systems.set(it.system, (systems.get(it.system) || 0) + 1);
    types.set(it.type, (types.get(it.type) || 0) + 1);
  }
  return {
    systems: [...systems.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    types: [...types.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

function renderFacet(container, entries, activeValue, onPick) {
  container.innerHTML = "";
  for (const [name, count] of entries) {
    const div = document.createElement("div");
    div.className = "facet-item" + (name === activeValue ? " active" : "");
    div.innerHTML = `
      <span class="name">${name}</span>
      <span class="badge">${count}</span>
    `;
    div.addEventListener("click", () => onPick(name === activeValue ? null : name));
    container.appendChild(div);
  }
}

function applyFilters() {
  const qNorm = normalize(state.q.trim());
  let items = ALL;

  if (state.system) items = items.filter((x) => x.system === state.system);
  if (state.type) items = items.filter((x) => x.type === state.type);

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

function renderResults(items) {
  elCount.textContent = `${items.length} result${items.length === 1 ? "" : "s"}`;

  elResults.innerHTML = "";
  if (!items.length) {
    elResults.innerHTML = `<div class="result">No results. Try a different term.</div>`;
    return;
  }

  for (const it of items) {
    const row = document.createElement("article");
    row.className = "result";
    row.innerHTML = `
      <a class="result-title" href="#" onclick="return false;">${it.description}</a>
      <div class="result-meta">
        <span class="kv"><strong>Ref:</strong> ${it.ref_num}</span>
        <span class="kv"><strong>System:</strong> ${it.system}</span>
        <span class="kv"><strong>Type:</strong> ${it.type}</span>
      </div>
    `;
    elResults.appendChild(row);
  }
}

function rerender() {
  const qNorm = normalize(state.q.trim());
  let base = ALL;

  if (qNorm) {
    base = base
      .map((x) => ({ ...x, _score: scoreItem(x, qNorm) }))
      .filter((x) => x._score > 0);
  }

  const facets = getFacets(base);
  renderFacet(elFacetSystem, facets.systems, state.system, (v) => { state.system = v; syncUrl(); rerender(); });
  renderFacet(elFacetType, facets.types, state.type, (v) => { state.type = v; syncUrl(); rerender(); });

  const items = applyFilters();
  renderResults(items);
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.system) params.set("system", state.system);
  if (state.type) params.set("type", state.type);
  if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);
  const qs = params.toString();
  const newUrl = qs ? `${location.pathname}?${qs}` : `${location.pathname}`;
  history.replaceState(null, "", newUrl);
}

function debounce(fn, ms=150){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), ms);
  };
}

async function init() {
  const res = await fetch("./data/products.json");
  ALL = await res.json();
  ALL = ALL.map((x) => ({ ...x, _searchNorm: normalize(`${x._search}`) }));

  const params = new URLSearchParams(location.search);
  state.q = params.get("q") || "";
  state.system = params.get("system");
  state.type = params.get("type");
  state.sort = params.get("sort") || "relevance";

  elQ.value = state.q;
  elSort.value = state.sort;

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
  state.system = null;
  state.type = null;
  syncUrl();
  rerender();
});

elSort.addEventListener("change", () => {
  state.sort = elSort.value;
  syncUrl();
  rerender();
});

init();

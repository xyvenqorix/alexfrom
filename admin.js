const $ = id => document.getElementById(id);
let adminKey = "";
let titles = [];
let editingId = "";

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function setStatus(id, message, isError = false) {
  const target = $(id);
  target.textContent = message;
  target.classList.toggle("error", isError);
}
async function request(path, options = {}, admin = false) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (admin) headers["x-admin-key"] = adminKey;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error en la solicitud.");
  return data;
}
function resetTitleForm() {
  editingId = "";
  $("titleForm").reset();
  $("titleType").value = "series";
  $("titleFormHeading").textContent = "Añadir título";
  $("cancelEdit").classList.add("hidden");
  $("movieUrlField").classList.add("hidden");
}
function updateTypeFields() {
  const isMovie = $("titleType").value === "movie";
  $("movieUrlField").classList.toggle("hidden", !isMovie);
  $("titleVideo").required = isMovie;
}
async function refreshTitles() {
  titles = await request("/api/titles");
  if (!Array.isArray(titles)) titles = [];
  renderTitles();
  fillSeriesSelects();
}
function fillSeriesSelects() {
  for (const id of ["episodeSeries", "manageSeries"]) {
    const select = $(id);
    const old = select.value;
    select.replaceChildren(node("option", "", id === "episodeSeries" ? "Elige una serie" : "Elige una serie"));
    select.options[0].value = "";
    titles.filter(t => t.type === "series").forEach(t => {
      const option = node("option", "", t.name);
      option.value = t._id;
      select.append(option);
    });
    if ([...select.options].some(o => o.value === old)) select.value = old;
  }
}
function renderTitles() {
  const list = $("adminTitleList");
  list.replaceChildren();
  if (!titles.length) { list.append(node("p", "muted", "Todavía no hay títulos publicados.")); return; }
  titles.forEach(item => {
    const row = node("div", "admin-row");
    const img = node("img", "admin-thumb");
    img.src = item.imageUrl || "";
    img.alt = "";
    img.onerror = () => { img.onerror = null; img.src = "https://placehold.co/100x140/111722/a6ff68?text=N"; };
    const main = node("div", "admin-row-main");
    main.append(node("strong", "", item.name));
    main.append(node("small", "", item.type === "series" ? "Serie" : "Película"));
    const actions = node("div", "row-actions");
    const edit = node("button", "secondary-btn", "Editar");
    edit.type = "button";
    edit.addEventListener("click", () => editTitle(item));
    const del = node("button", "secondary-btn", "Eliminar");
    del.type = "button";
    del.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${item.name}"${item.type === "series" ? " y todos sus capítulos" : ""}?`)) return;
      try {
        await request(`/api/titles?id=${encodeURIComponent(item._id)}`, { method: "DELETE" }, true);
        await refreshTitles();
        setStatus("titleStatus", "Título eliminado.");
      } catch (e) { setStatus("titleStatus", e.message, true); }
    });
    actions.append(edit, del);
    row.append(img, main, actions);
    list.append(row);
  });
}
function editTitle(item) {
  editingId = item._id;
  $("titleName").value = item.name || "";
  $("titleType").value = item.type || "series";
  $("titleImage").value = item.imageUrl || "";
  $("titleDescription").value = item.description || "";
  $("titleYear").value = item.year || "";
  $("titleGenres").value = (item.genres || []).join(", ");
  $("titleVideo").value = item.videoUrl || "";
  $("titleFormHeading").textContent = `Editar: ${item.name}`;
  $("cancelEdit").classList.remove("hidden");
  updateTypeFields();
  $("titleForm").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("titleType").addEventListener("change", updateTypeFields);
$("cancelEdit").addEventListener("click", resetTitleForm);
$("keyForm").addEventListener("submit", async e => {
  e.preventDefault();
  adminKey = $("adminKey").value.trim();
  try {
    await request("/api/titles");
    await refreshTitles();
    $("keyCard").classList.add("hidden");
    $("adminWorkspace").classList.remove("hidden");
    $("adminKey").value = "";
    setStatus("keyStatus", "");
  } catch (err) {
    setStatus("keyStatus", err.message, true);
  }
});
$("logoutBtn").addEventListener("click", () => {
  adminKey = "";
  titles = [];
  $("adminWorkspace").classList.add("hidden");
  $("keyCard").classList.remove("hidden");
  $("adminTitleList").replaceChildren();
  $("adminEpisodeList").replaceChildren(node("p", "muted", "Bloqueado."));
  setStatus("keyStatus", "Panel bloqueado.");
});
$("titleForm").addEventListener("submit", async e => {
  e.preventDefault();
  const type = $("titleType").value;
  const body = {
    name: $("titleName").value.trim(),
    type,
    imageUrl: $("titleImage").value.trim(),
    description: $("titleDescription").value.trim(),
    year: $("titleYear").value ? Number($("titleYear").value) : null,
    genres: $("titleGenres").value.split(",").map(x => x.trim()).filter(Boolean),
    videoUrl: type === "movie" ? $("titleVideo").value.trim() : ""
  };
  try {
    if (editingId) {
      await request(`/api/titles?id=${encodeURIComponent(editingId)}`, { method: "PATCH", body: JSON.stringify(body) }, true);
      setStatus("titleStatus", "Cambios guardados.");
    } else {
      await request("/api/titles", { method: "POST", body: JSON.stringify(body) }, true);
      setStatus("titleStatus", "Título publicado.");
    }
    resetTitleForm();
    await refreshTitles();
  } catch (err) { setStatus("titleStatus", err.message, true); }
});
$("episodeForm").addEventListener("submit", async e => {
  e.preventDefault();
  const body = {
    titleId: $("episodeSeries").value,
    seasonNumber: Number($("seasonNumber").value),
    episodeNumber: Number($("episodeNumber").value),
    name: $("episodeName").value.trim(),
    videoUrl: $("episodeVideo").value.trim(),
    posterUrl: $("episodePoster").value.trim(),
    description: $("episodeDescription").value.trim()
  };
  try {
    await request("/api/episodes", { method: "POST", body: JSON.stringify(body) }, true);
    setStatus("episodeStatus", "Capítulo guardado y ordenado en su temporada.");
    $("episodeName").value = "";
    $("episodeVideo").value = "";
    $("episodePoster").value = "";
    $("episodeDescription").value = "";
    $("manageSeries").value = body.titleId;
    await loadEpisodes();
  } catch (err) { setStatus("episodeStatus", err.message, true); }
});
async function loadEpisodes() {
  const titleId = $("manageSeries").value;
  const list = $("adminEpisodeList");
  list.replaceChildren();
  if (!titleId) { list.append(node("p", "muted", "Elige una serie para ver sus capítulos.")); return; }
  try {
    const episodes = await request(`/api/episodes?titleId=${encodeURIComponent(titleId)}`);
    if (!episodes.length) { list.append(node("p", "muted", "Esta serie todavía no tiene capítulos.")); return; }
    episodes.forEach(ep => {
      const row = node("div", "admin-row");
      const main = node("div", "admin-row-main");
      main.append(node("strong", "", `T${ep.seasonNumber} · E${ep.episodeNumber} — ${ep.name}`));
      main.append(node("small", "", ep.videoUrl));
      const actions = node("div", "row-actions");
      const del = node("button", "secondary-btn", "Eliminar");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (!confirm(`¿Eliminar el capítulo "${ep.name}"?`)) return;
        try {
          await request(`/api/episodes?id=${encodeURIComponent(ep._id)}`, { method: "DELETE" }, true);
          await loadEpisodes();
          setStatus("episodeStatus", "Capítulo eliminado.");
        } catch (e) { setStatus("episodeStatus", e.message, true); }
      });
      actions.append(del);
      row.append(main, actions);
      list.append(row);
    });
  } catch (e) { list.append(node("p", "status error", e.message)); }
}
$("manageSeries").addEventListener("change", loadEpisodes);
$("refreshBtn").addEventListener("click", async () => {
  try { await refreshTitles(); await loadEpisodes(); setStatus("titleStatus", "Catálogo actualizado."); }
  catch (e) { setStatus("titleStatus", e.message, true); }
});
updateTypeFields();
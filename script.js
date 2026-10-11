const grid = document.getElementById("catalogGrid");
const search = document.getElementById("search");
const filters = [...document.querySelectorAll(".filter")];
const detailsModal = document.getElementById("detailsModal");
const playerModal = document.getElementById("playerModal");
const state = { titles: [], type: "all", activeTitle: null, episodes: [] };
document.getElementById("year").textContent = new Date().getFullYear();

const fallbackPoster = "https://placehold.co/600x900/111722/a6ff68?text=NEXORA+PLAY";
const safeUrl = value => {
  try {
    const u = new URL(value, location.origin);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch { return ""; }
};
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
async function api(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}
function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const items = state.titles.filter(item =>
    (state.type === "all" || item.type === state.type) &&
    String(item.name || "").toLocaleLowerCase().includes(query)
  );
  grid.replaceChildren();
  if (!items.length) {
    grid.append(el("div", "notice", state.titles.length ? "No hay resultados para esa búsqueda." : "Todavía no hay títulos publicados."));
    return;
  }
  for (const item of items) {
    const card = el("article", "title-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Ver detalles de ${item.name || "título"}`);
    const image = el("img", "poster");
    image.src = safeUrl(item.imageUrl) || fallbackPoster;
    image.alt = item.name || "Portada";
    image.loading = "lazy";
    image.onerror = () => { image.onerror = null; image.src = fallbackPoster; };
    const info = el("div", "card-info");
    info.append(el("span", "type-label", item.type === "series" ? "Serie" : "Película"));
    info.append(el("h3", "", item.name || "Sin título"));
    const meta = [item.year, ...(Array.isArray(item.genres) ? item.genres.slice(0, 2) : [])].filter(Boolean).join(" · ");
    info.append(el("div", "card-meta", meta || "NEXORA Play"));
    card.append(image, info);
    card.addEventListener("click", () => openDetails(item));
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(item); } });
    grid.append(card);
  }
}
async function openDetails(item) {
  state.activeTitle = item;
  document.getElementById("detailImage").src = safeUrl(item.imageUrl) || fallbackPoster;
  document.getElementById("detailImage").alt = item.name || "";
  document.getElementById("detailType").textContent = item.type === "series" ? "SERIE" : "PELÍCULA";
  document.getElementById("detailName").textContent = item.name || "Sin título";
  document.getElementById("detailMeta").textContent = [item.year, ...(item.genres || [])].filter(Boolean).join(" · ");
  document.getElementById("detailDescription").textContent = item.description || "";
  document.getElementById("movieAction").replaceChildren();
  document.getElementById("seriesEpisodes").replaceChildren();
  detailsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  if (item.type === "movie") {
    const btn = el("button", "watch-btn", "▶ Reproducir película");
    btn.addEventListener("click", () => openPlayer(item.name, item.videoUrl));
    if (safeUrl(item.videoUrl)) document.getElementById("movieAction").append(btn);
    else document.getElementById("movieAction").append(el("p", "muted", "Esta película todavía no tiene un enlace de reproducción."));
    return;
  }

  const area = document.getElementById("seriesEpisodes");
  area.append(el("p", "eyebrow", "EPISODIOS"));
  const loading = el("p", "muted", "Cargando episodios…");
  area.append(loading);
  try {
    const episodes = await api(`/api/episodes?titleId=${encodeURIComponent(item._id)}`);
    if (state.activeTitle?._id !== item._id) return;
    state.episodes = episodes;
    loading.remove();
    if (!episodes.length) {
      area.append(el("p", "muted", "Todavía no se han añadido capítulos."));
      return;
    }
    const seasons = [...new Set(episodes.map(ep => Number(ep.seasonNumber)).filter(n => n > 0))].sort((a,b) => a-b);
    const seasonRow = el("div", "season-row");
    seasonRow.append(el("h3", "", "Temporadas"));
    const select = el("select", "season-select");
    select.setAttribute("aria-label", "Elegir temporada");
    for (const n of seasons) {
      const option = el("option", "", `Temporada ${n}`);
      option.value = String(n);
      select.append(option);
    }
    seasonRow.append(select);
    const list = el("div", "episode-list");
    area.append(seasonRow, list);
    const drawSeason = () => {
      list.replaceChildren();
      episodes.filter(ep => Number(ep.seasonNumber) === Number(select.value))
        .sort((a,b) => Number(a.episodeNumber)-Number(b.episodeNumber))
        .forEach(ep => {
          const row = el("article", "episode-item");
          const img = el("img", "episode-thumb");
          img.src = safeUrl(ep.posterUrl) || safeUrl(item.imageUrl) || fallbackPoster;
          img.alt = "";
          img.onerror = () => { img.onerror = null; img.src = fallbackPoster; };
          const txt = el("div", "episode-text");
          txt.append(el("strong", "", `${ep.episodeNumber}. ${ep.name || "Capítulo"}`));
          txt.append(el("small", "", `Temporada ${ep.seasonNumber} · Episodio ${ep.episodeNumber}`));
          const play = el("button", "episode-play", "▶ Ver");
          play.addEventListener("click", () => openPlayer(`${item.name} — T${ep.seasonNumber} E${ep.episodeNumber}: ${ep.name}`, ep.videoUrl));
          row.append(img, txt, play);
          list.append(row);
        });
    };
    select.addEventListener("change", drawSeason);
    drawSeason();
  } catch (error) {
    loading.textContent = error.message;
    loading.classList.add("error");
  }
}
function openPlayer(title, videoUrl) {
  const url = safeUrl(videoUrl);
  if (!url) { alert("Este título no tiene una URL de reproducción válida."); return; }
  document.getElementById("playerTitle").textContent = title || "Reproduciendo";
  const wrap = document.getElementById("playerFrameWrap");
  wrap.replaceChildren();
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = title || "Reproductor de vídeo";
  iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  wrap.append(iframe);
  playerModal.classList.remove("hidden");
  detailsModal.classList.add("hidden");
}
function closeDetails() {
  detailsModal.classList.add("hidden");
  if (playerModal.classList.contains("hidden")) document.body.style.overflow = "";
}
function closePlayer() {
  playerModal.classList.add("hidden");
  document.getElementById("playerFrameWrap").replaceChildren();
  document.body.style.overflow = "";
}
document.querySelectorAll("[data-close]").forEach(node => node.addEventListener("click", closeDetails));
document.querySelectorAll("[data-player-close]").forEach(node => node.addEventListener("click", closePlayer));
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!playerModal.classList.contains("hidden")) closePlayer();
    else if (!detailsModal.classList.contains("hidden")) closeDetails();
  }
});
search.addEventListener("input", render);
filters.forEach(btn => btn.addEventListener("click", () => {
  state.type = btn.dataset.type;
  filters.forEach(x => x.classList.toggle("active", x === btn));
  render();
}));
async function loadCatalog() {
  try {
    state.titles = await api("/api/titles");
    if (!Array.isArray(state.titles)) state.titles = [];
    render();
  } catch (error) {
    grid.replaceChildren(el("div", "notice error", `No se pudo cargar el catálogo: ${error.message}`));
  }
}
loadCatalog();
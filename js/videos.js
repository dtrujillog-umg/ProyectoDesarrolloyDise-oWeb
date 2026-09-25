/**
 * videos.js — catalogo de videos: descarga, filtra y dibuja las cards.
 */

class Videos {
  constructor() {
    this.lista = [];
    this.filtrados = [];
    this.categoriaActual = "todas";
    this.textoActual = "";
  }

  /** GET /api/videos */
  async obtenerTodos() {
    this.lista = await Api.get("/api/videos");
    if (!Array.isArray(this.lista)) this.lista = [];
    this.aplicarFiltros();
    return this.lista;
  }

  /** GET /api/videos/{id}. Trae likes, usuariosLikes y el arbol de comentarios. */
  async obtenerPorId(id) {
    return await Api.get(`/api/videos/${encodeURIComponent(id)}`);
  }

  /** GET /api/videos/categorias */
  async obtenerCategorias() {
    const categorias = await Api.get("/api/videos/categorias");
    return Array.isArray(categorias) ? categorias : [];
  }

  /**
   * Aplica categoria + texto en una sola pasada. Es el unico punto donde se
   * recalcula `filtrados`, de modo que los dos filtros nunca se pisan entre si.
   */
  aplicarFiltros() {
    const texto = this.textoActual.toLowerCase().trim();
    const categoria = this.categoriaActual;

    this.filtrados = this.lista.filter((video) => {
      const coincideCategoria =
        categoria === "todas" || video.categoria === categoria;
      const coincideTexto =
        texto === "" || String(video.titulo ?? "").toLowerCase().includes(texto);
      return coincideCategoria && coincideTexto;
    });

    return this.filtrados;
  }

  filtrarPorCategoria(nombre) {
    this.categoriaActual = nombre || "todas";
    return this.aplicarFiltros();
  }

  buscar(texto) {
    this.textoActual = texto || "";
    return this.aplicarFiltros();
  }

  limpiarFiltros() {
    this.categoriaActual = "todas";
    this.textoActual = "";
    return this.aplicarFiltros();
  }

  /** True si este usuario ya dio like: `usuariosLikes` es la lista de carnes. */
  dioLike(video, carne) {
    if (!video || !carne) return false;
    return Array.isArray(video.usuariosLikes)
      ? video.usuariosLikes.includes(carne)
      : false;
  }

  /** Dibuja las cards. El click se delega a la App mediante `data-id`. */
  renderizar(contenedor) {
    if (!contenedor) return;

    if (!Array.isArray(this.filtrados) || this.filtrados.length === 0) {
      contenedor.innerHTML = `
        <div class="col-12">
          <div class="text-center text-muted py-5">
            <div class="display-6 mb-2">&#128269;</div>
            <p class="mb-0">No se encontraron videos con los filtros aplicados.</p>
          </div>
        </div>`;
      return;
    }

    contenedor.innerHTML = this.filtrados
      .map((video) => {
        const poster = urlSegura(video.poster);
        const img = poster
          ? `<img src="${escaparHtml(poster)}" class="card-img-top object-fit-cover" alt="${escaparHtml(video.titulo)}" loading="lazy">`
          : `<div class="card-img-top d-flex align-items-center justify-content-center bg-secondary-subtle text-secondary" style="height:180px">
               <span class="fs-1">&#127916;</span>
             </div>`;

        return `
        <div class="col-sm-6 col-lg-4 mb-4">
          <div class="card h-100 shadow-sm video-card" role="button" tabindex="0"
               data-id="${escaparHtml(video.id)}"
               aria-label="Reproducir ${escaparHtml(video.titulo)}">
            ${img}
            <div class="card-body d-flex flex-column">
              <span class="badge text-bg-primary mb-2 align-self-start">
                ${escaparHtml(video.categoria)}
              </span>
              <h5 class="card-title">${escaparHtml(video.titulo)}</h5>
              <p class="card-text small text-muted flex-grow-1">
                ${escaparHtml(video.descripcion)}
              </p>
              <div class="mt-auto d-flex justify-content-between align-items-center pt-2">
                <small class="text-muted">&#9201; ${escaparHtml(video.duracion)}</small>
                <small class="text-danger">&#10084; ${escaparHtml(video.likes ?? 0)}</small>
              </div>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  /** Rellena el <select> de categorias con "todas" como opcion inicial. */
  renderizarCategorias(select, categorias) {
    if (!select) return;
    select.innerHTML =
      `<option value="todas">Todas las categorias</option>` +
      categorias
        .map((c) => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`)
        .join("");
  }
}

/**
 * app.js — clase App.
 *
 * Orquesta el resto y es la unica que conoce el flujo completo: navbar,
 * catalogo, filtros, apertura de un video y el refresco tras cada mutacion.
 * El detalle de cada pieza vive en Videos, Interacciones, Modales y Comentarios.
 */

class App {
  constructor() {
    this.usuario = new Usuario();
    this.videos = new Videos();
    this.interacciones = new Interacciones(this.usuario);
    this.modales = new Modales(this);
    this.comentarios = new Comentarios(this);

    this.videoActual = null;  // detalle del video abierto en el modal
    this.el = {};             // referencias al DOM, llenas en cachearElementos()
  }

  /* ---------------- arranque ---------------- */

  async init() {
    this.cachearElementos();
    this.modales.crear();
    this.actualizarNavbar();
    this.bindEventos();
    await this.cargarCatalogo();
  }

  cachearElementos() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      catalogo: $("catalogo"),
      busqueda: $("busqueda"),
      categoria: $("filtroCategoria"),
      btnLimpiar: $("btnLimpiarFiltros"),
      zonaCarga: $("zonaCarga"),
      alertaCatalogo: $("alertaCatalogo"),

      userLabel: $("userLabel"),
      btnLogin: $("btnLogin"),
      btnLogout: $("btnLogout"),

      modalVideo: $("modalVideo"),
      reproductor: $("reproductor"),
      titulo: $("tituloVideo"),
      badge: $("badgeCategoria"),
      descripcion: $("descripcionVideo"),
      meta: $("metaVideo"),

      btnLike: $("btnLike"),
      iconoLike: $("iconoLike"),
      contadorLikes: $("contadorLikes"),

      totalComentarios: $("totalComentarios"),
      avisoLogin: $("avisoLogin"),
      inputComentario: $("inputComentario"),
      btnComentar: $("btnComentar"),
      listaComentarios: $("listaComentarios"),

      modalResponder: $("modalResponder"),
      textoResponder: $("textoResponder"),
      autorResponder: $("autorResponder"),
      btnResponder: $("btnEnviarRespuesta"),

      modalEliminar: $("modalEliminar"),
      autorEliminar: $("autorEliminar"),
      btnEliminar: $("btnConfirmarEliminar"),

      toasts: $("toastContenedor"),
    };
  }

  async cargarCatalogo() {
    this.el.zonaCarga.classList.remove("d-none");
    this.el.catalogo.classList.add("d-none");
    this.el.alertaCatalogo.classList.add("d-none");

    try {
      const [, categorias] = await Promise.all([
        this.videos.obtenerTodos(),
        this.videos.obtenerCategorias(),
      ]);
      this.videos.renderizarCategorias(this.el.categoria, categorias);
      this.videos.renderizar(this.el.catalogo);
    } catch (error) {
      this.renderizarErrorCatalogo(error);
    } finally {
      this.el.zonaCarga.classList.add("d-none");
      this.el.catalogo.classList.remove("d-none");
    }
  }

  /* ---------------- eventos ---------------- */

  bindEventos() {
    const { busqueda, categoria, btnLimpiar, catalogo, btnLike } = this.el;

    // Cada filtro solo cambia el estado de Videos; el pintado es el mismo.
    const repintar = () => this.videos.renderizar(catalogo);

    busqueda?.addEventListener("input", (e) => {
      this.videos.buscar(e.target.value);
      repintar();
    });

    categoria?.addEventListener("change", (e) => {
      this.videos.filtrarPorCategoria(e.target.value);
      repintar();
    });

    btnLimpiar?.addEventListener("click", () => {
      if (busqueda) busqueda.value = "";
      if (categoria) categoria.value = "todas";
      this.videos.limpiarFiltros();
      repintar();
    });

    this.el.btnLogout?.addEventListener("click", () => {
      this.usuario.cerrarSesion();
      window.location.reload();
    });

    // Delegacion: un solo handler para click y teclado, sin onclick inline.
    const abrirCard = (e) => {
      const card = e.target.closest(".video-card");
      if (!card) return;
      if (e.type === "keydown") {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
      }
      this.abrirVideo(card.dataset.id);
    };
    catalogo?.addEventListener("click", abrirCard);
    catalogo?.addEventListener("keydown", abrirCard);

    btnLike?.addEventListener("click", () => this.alternarLike());

    this.comentarios.bindEventos();
  }

  /* ---------------- navbar, acceso y like ---------------- */

  actualizarNavbar() {
    const { userLabel, btnLogin, btnLogout } = this.el;
    const logueado = this.usuario.estaLogueado();

    if (userLabel) userLabel.textContent = logueado ? this.usuario.getNombre() : "";
    btnLogin?.classList.toggle("d-none", logueado);
    btnLogout?.classList.toggle("d-none", !logueado);
  }

  /** Aplica el estado logueado/visitante a todo el modal. */
  aplicarControlAcceso(video = null) {
    const logueado = this.usuario.estaLogueado();

    if (this.el.btnLike) {
      this.el.btnLike.disabled = !logueado;
      this.el.btnLike.title = logueado
        ? "Dar o quitar me gusta"
        : "Inicia sesion para dar me gusta";
    }

    this.comentarios.aplicarAcceso();
    if (video) this.pintarLike(video);
  }

  /** Pinta el boton de like segun el contador y si el usuario actual ya lo dio. */
  pintarLike(video) {
    const { btnLike, iconoLike, contadorLikes } = this.el;
    const activo = this.videos.dioLike(video, this.usuario.getCarne());

    if (contadorLikes) contadorLikes.textContent = video.likes ?? 0;
    if (iconoLike) iconoLike.textContent = activo ? "❤" : "♡";
    if (btnLike) {
      btnLike.classList.toggle("btn-danger", activo);
      btnLike.classList.toggle("btn-outline-danger", !activo);
      btnLike.setAttribute("aria-pressed", String(activo));
    }
  }

  /**
   * Toggle de like. El backend alterna por carne y devuelve el estado
   * resultante, de modo que no hay que adivinarlo.
   */
  async alternarLike() {
    if (!this.videoActual) return;

    const id = this.videoActual.id;
    this.el.btnLike.disabled = true; // evita doble clic mientras responde la API

    try {
      await this.mutarYRefrescar(
        () => this.interacciones.alternarLike(id),
        (r) => (r?.dioLike ? "Gracias por tu me gusta." : "Se quito tu me gusta.")
      );
    } catch (error) {
      this.notificar(error.message, "danger");
    } finally {
      this.el.btnLike.disabled = !this.usuario.estaLogueado();
    }
  }

  /* ---------------- flujo del video ---------------- */

  /** Carga el detalle y abre el modal con todo pintado. */
  async abrirVideo(id) {
    this.comentarios.cargando();

    try {
      const video = await this.videos.obtenerPorId(id);
      this.videoActual = video;

      this.modales.pintarVideo(video);
      this.comentarios.pintar(video);
      this.aplicarControlAcceso(video);
      this.modales.mostrarVideo();
    } catch (error) {
      this.comentarios.vacia();
      this.notificar(error.message, "danger");
    }
  }

  /**
   * Aplica una mutacion y despues repinta. Un fallo al refrescar no se reporta
   * como error de la accion: la mutacion ya quedo guardada en el servidor.
   *
   * @param {Function} mutacion  Promesa con la peticion de escritura.
   * @param {string|Function} mensaje  Texto, o funcion que recibe la respuesta.
   * @param {Function} [alGuardar]  Efecto colateral al cerrar (p. ej. un modal).
   */
  async mutarYRefrescar(mutacion, mensaje, alGuardar = null) {
    const respuesta = await mutacion();
    if (alGuardar) alGuardar();

    this.notificar(
      typeof mensaje === "function" ? mensaje(respuesta) : mensaje,
      "success"
    );

    try {
      await this.refrescarVideo();
    } catch {
      this.notificar(
        "Se guardo el cambio, pero no se pudo actualizar la vista.",
        "warning"
      );
    }
  }

  /** Vuelve a pedir el detalle del video abierto y repinta modal y card. */
  async refrescarVideo() {
    if (!this.videoActual) return;

    const id = this.videoActual.id;
    const video = await this.videos.obtenerPorId(id);
    this.videoActual = video;

    // Se actualiza la copia cacheada para que la card no quede vieja.
    const indice = this.videos.lista.findIndex((v) => String(v.id) === String(id));
    if (indice !== -1) this.videos.lista[indice] = video;
    this.videos.aplicarFiltros();
    this.videos.renderizar(this.el.catalogo);

    this.comentarios.pintar(video);
    this.pintarLike(video);
  }

  /* ---------------- errores y avisos ---------------- */

  /** Si el catalogo no carga, el grid se sustituye por un aviso con reintento. */
  renderizarErrorCatalogo(error) {
    this.el.catalogo.innerHTML = "";
    this.el.alertaCatalogo.innerHTML = `
      <div class="alert alert-danger">
        <strong>No pudimos cargar el catalogo de videos.</strong>
        <div>${escaparHtml(error.message)}</div>
        <button class="btn btn-sm btn-outline-danger mt-2" data-reintentar>Reintentar</button>
      </div>`;
    this.el.alertaCatalogo.classList.remove("d-none");
    this.el.alertaCatalogo
      .querySelector("[data-reintentar]")
      ?.addEventListener("click", () => this.cargarCatalogo());
  }

  /** Notificacion efimera (Bootstrap toast) sin escribir HTML dinamico. */
  notificar(mensaje, tipo = "info") {
    if (!this.el.toasts) return window.alert(mensaje);

    const colores = {
      success: "text-bg-success",
      danger: "text-bg-danger",
      warning: "text-bg-warning",
      info: "text-bg-primary",
    };

    const toast = document.createElement("div");
    toast.className = `toast align-items-center border-0 ${colores[tipo] || colores.info}`;
    toast.setAttribute("role", "alert");

    const cuerpo = document.createElement("div");
    cuerpo.className = "d-flex";

    // textContent evita inyectar HTML en un mensaje que viene de la API.
    const texto = document.createElement("div");
    texto.className = "toast-body";
    texto.textContent = mensaje;
    cuerpo.appendChild(texto);

    const cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "btn-close btn-close-white me-2 m-auto";
    cerrar.setAttribute("data-bs-dismiss", "toast");
    cerrar.setAttribute("aria-label", "Cerrar");
    cuerpo.appendChild(cerrar);

    toast.appendChild(cuerpo);
    this.el.toasts.appendChild(toast);

    new bootstrap.Toast(toast, { delay: 3500 }).show();
    toast.addEventListener("hidden.bs.toast", () => toast.remove());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
  app.init();
});

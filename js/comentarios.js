/**
 * comentarios.js — clase Comentarios.
 *
 * Dueña del area de comentarios del modal de video: el input, el arbol de
 * nivel 1 con sus respuestas, y los modales de responder y eliminar.
 * No pide datos a la API: delega en Interacciones y se repinta cuando App
 * confirma que el servidor ya cambio.
 */

class Comentarios {
  constructor(app) {
    this.app = app;
    this.objetivoRespuesta = null;  // { comentarioId, autor }
    this.objetivoBorrado = null;    // { comentarioId, autor }
  }

  /* ---------------- eventos ---------------- */

  bindEventos() {
    const { btnComentar, inputComentario, listaComentarios, btnResponder, btnEliminar } =
      this.app.el;

    btnComentar?.addEventListener("click", () => this.publicar());
    inputComentario?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.publicar();
    });

    // Delegacion: los botones se redibujan en cada refresco del arbol.
    listaComentarios?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-responder], [data-eliminar]");
      if (!btn) return;

      const id = Number(btn.dataset.responder ?? btn.dataset.eliminar);
      const autor = btn.dataset.autor;

      if (btn.dataset.responder !== undefined) this.abrirResponder(id, autor);
      else this.abrirEliminar(id, autor);
    });

    btnResponder?.addEventListener("click", () => this.enviarRespuesta());
    btnEliminar?.addEventListener("click", () => this.confirmarEliminar());
  }

  /* ---------------- control de acceso ---------------- */

  /** Habilita o deshabilita el area de comentarios segun haya sesion. */
  aplicarAcceso() {
    const { avisoLogin, inputComentario, btnComentar } = this.app.el;
    const logueado = this.app.usuario.estaLogueado();

    if (inputComentario) {
      inputComentario.disabled = !logueado;
      inputComentario.placeholder = logueado
        ? "Escribe un comentario..."
        : "Inicia sesion para comentar";
    }
    if (btnComentar) btnComentar.disabled = !logueado;

    if (avisoLogin) {
      avisoLogin.classList.toggle("d-none", logueado);
      avisoLogin.innerHTML = logueado
        ? ""
        : `<div class="alert alert-warning py-2 mb-3">Debes
             <a href="login.html" class="alert-link fw-semibold">iniciar sesion</a>
             para dar like, comentar o responder.</div>`;
    }
  }

  /* ---------------- pintado ---------------- */

  cargando() {
    this.app.el.listaComentarios.innerHTML =
      '<div class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando comentarios...</div>';
    this.app.el.totalComentarios.textContent = "";
  }

  /** Dibuja los comentarios y, bajo cada uno, sus respuestas directas. */
  pintar(video) {
    const comentarios = Array.isArray(video.comentarios) ? video.comentarios : [];

    if (this.app.el.totalComentarios) {
      this.app.el.totalComentarios.textContent = comentarios.length;
    }
    if (comentarios.length === 0) {
      return this.vacia("Todavia no hay comentarios. Se el primero.");
    }

    // No se recursiona: la API solo admite un nivel, sin subnivel.
    this.app.el.listaComentarios.innerHTML = comentarios
      .map((comentario) => {
        const respuestas = Array.isArray(comentario.respuestas) ? comentario.respuestas : [];
        const anidadas = respuestas.length
          ? `<div class="ms-4 ps-3 border-start border-3 mt-2">${respuestas
              .map((r) => `<div class="py-2">${this.bloque(r, true)}</div>`)
              .join("")}</div>`
          : "";
        return `<div class="card mb-2"><div class="card-body py-3">${this.bloque(comentario, false)}${anidadas}</div></div>`;
      })
      .join("");
  }

  /** Un comentario o respuesta: autor, fecha, texto y botones. */
  bloque(item, esRespuesta) {
    const miCarne = this.app.usuario.getCarne();
    const soyAutor = miCarne && item.carne === miCarne;

    return `
      <div class="d-flex gap-3">
        <div class="flex-grow-1">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="fw-semibold ${esRespuesta ? "small" : ""}">${escaparHtml(item.estudiante)}</span>
            ${soyAutor ? '<span class="badge text-bg-info">Tu comentario</span>' : ""}
            <small class="text-muted">${escaparHtml(formatearFecha(item.fecha))}</small>
          </div>
          <p class="mb-0 ${esRespuesta ? "small" : "mt-1"}">${escaparHtml(item.texto)}</p>
        </div>
        ${this.botonesDeAccion(item, soyAutor, esRespuesta)}
      </div>`;
  }

  /** El boton de borrar solo se pinta para el autor. */
  botonesDeAccion(item, soyAutor, esRespuesta) {
    const sinSesion = this.app.usuario.estaLogueado() ? "" : "disabled";

    const responder = esRespuesta
      ? ""
      : `<button class="btn btn-sm btn-outline-secondary" data-responder="${escaparHtml(item.id)}" data-autor="${escaparHtml(item.estudiante)}" ${sinSesion}>Responder</button>`;

    const eliminar = soyAutor
      ? `<button class="btn btn-sm btn-outline-danger" data-eliminar="${escaparHtml(item.id)}" data-autor="${escaparHtml(item.estudiante)}">Eliminar</button>`
      : "";

    return `<div class="d-flex flex-column gap-1 align-items-end">${responder}${eliminar}</div>`;
  }

  vacia(mensaje = "No hay comentarios para mostrar.") {
    this.app.el.listaComentarios.innerHTML =
      `<p class="text-center text-muted py-4 mb-0">${escaparHtml(mensaje)}</p>`;
  }

  /* ---------------- acciones ---------------- */

  async publicar() {
    if (!this.app.videoActual) return;

    const texto = this.app.el.inputComentario.value.trim();
    if (texto === "") {
      return this.app.notificar("El comentario no puede estar vacio.", "warning");
    }

    const id = this.app.videoActual.id;
    this.app.el.btnComentar.disabled = true;
    try {
      await this.app.mutarYRefrescar(
        () => this.app.interacciones.comentar(id, texto),
        "Comentario publicado.",
        () => { this.app.el.inputComentario.value = ""; }
      );
    } catch (error) {
      this.app.notificar(error.message, "danger");
    } finally {
      this.app.el.btnComentar.disabled = !this.app.usuario.estaLogueado();
    }
  }

  /** Abre el modal de respuesta recordando a quien se responde. */
  abrirResponder(comentarioId, autor) {
    if (!this.app.usuario.estaLogueado()) {
      return this.app.notificar("Debes iniciar sesion para responder.", "warning");
    }

    this.objetivoRespuesta = { comentarioId, autor };
    this.app.el.autorResponder.textContent = autor ?? "";
    this.app.el.textoResponder.value = "";
    this.app.el.btnResponder.disabled = false;

    this.app.modales.mostrarAuxiliar("responder");
  }

  async enviarRespuesta() {
    if (!this.objetivoRespuesta) return;

    const texto = this.app.el.textoResponder.value.trim();
    if (texto === "") {
      return this.app.notificar("La respuesta no puede estar vacia.", "warning");
    }

    const id = this.objetivoRespuesta.comentarioId;
    this.app.el.btnResponder.disabled = true;
    try {
      await this.app.mutarYRefrescar(
        () => this.app.interacciones.responder(id, texto),
        "Respuesta publicada.",
        () => this.app.modales.ocultarAuxiliar("responder")
      );
    } catch (error) {
      this.app.notificar(error.message, "danger");
      this.app.el.btnResponder.disabled = false;
    } finally {
      this.objetivoRespuesta = null;
    }
  }

  /** Abre el modal de confirmacion antes de borrar un comentario propio. */
  abrirEliminar(comentarioId, autor) {
    this.objetivoBorrado = { comentarioId, autor };
    this.app.el.autorEliminar.textContent = autor ?? "";
    this.app.modales.mostrarAuxiliar("eliminar");
  }

  async confirmarEliminar() {
    if (!this.objetivoBorrado) return;

    const id = this.objetivoBorrado.comentarioId;
    this.app.el.btnEliminar.disabled = true;
    try {
      await this.app.mutarYRefrescar(
        () => this.app.interacciones.eliminar(id),
        "Comentario eliminado.",
        () => this.app.modales.ocultarAuxiliar("eliminar")
      );
    } catch (error) {
      // El 403 ya viene traducido por Interacciones.eliminar.
      this.app.notificar(error.message, "danger");
      this.app.modales.ocultarAuxiliar("eliminar");
    } finally {
      this.app.el.btnEliminar.disabled = false;
      this.objetivoBorrado = null;
    }
  }
}

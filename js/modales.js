/**
 * modales.js — clase Modales.
 *
 * Envoltura de las tres ventanas de Bootstrap. No tiene logica de negocio:
 * solo pinta el reproductor y gestiona el `d-none` que evita que se apilen
 * tres backdrops cuando se abre un modal auxiliar.
 */

class Modales {
  constructor(app) {
    this.app = app;
  }

  crear() {
    const el = this.app.el;

    this.video = new bootstrap.Modal(el.modalVideo);
    this.responder = new bootstrap.Modal(el.modalResponder);
    this.eliminar = new bootstrap.Modal(el.modalEliminar);

    // Al cerrar un auxiliar hay que revertir el d-none del reproductor.
    const mostrar = () => el.modalVideo.classList.remove("d-none");
    el.modalResponder.addEventListener("hidden.bs.modal", mostrar);
    el.modalEliminar.addEventListener("hidden.bs.modal", mostrar);
  }

  /** Rellena el modal con los datos del video, sin abrirlo todavia. */
  pintarVideo(video) {
    const el = this.app.el;

    if (el.titulo) el.titulo.textContent = video.titulo ?? "Sin titulo";
    if (el.badge) el.badge.textContent = video.categoria ?? "";
    if (el.descripcion) el.descripcion.textContent = video.descripcion ?? "";
    if (el.meta) {
      const partes = [];
      if (video.duracion) partes.push(`Duracion: ${video.duracion}`);
      if (video.categoria) partes.push(video.categoria);
      el.meta.textContent = partes.join("  ·  ");
    }

    // El <video> se reutiliza entre aperturas, hay que recargar la fuente.
    if (el.reproductor) {
      const fuente = urlSegura(video.urlVideo);
      el.reproductor.pause();
      el.reproductor.removeAttribute("src");
      el.reproductor.querySelectorAll("source").forEach((s) => s.remove());
      el.reproductor.poster = urlSegura(video.poster);

      if (fuente) {
        const source = document.createElement("source");
        source.src = fuente;
        source.type = "video/mp4";
        el.reproductor.appendChild(source);
        el.reproductor.load();
      }
    }
  }

  mostrarVideo() {
    // Por si un auxiliar dejo el reproductor oculto con d-none antes.
    this.app.el.modalVideo.classList.remove("d-none");
    this.video.show();
  }

  /** Abre un auxiliar ocultando el reproductor, para no apilar backdrops. */
  mostrarAuxiliar(nombre) {
    this.app.el.modalVideo.classList.add("d-none");
    this[nombre].show();
  }

  ocultarAuxiliar(nombre) {
    this[nombre].hide();
  }
}

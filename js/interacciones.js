/**
 * interacciones.js — likes, comentarios y respuestas.
 * Todas exigen sesion activa: se comprueba aqui, y ademas App deshabilita los
 * controles para el visitante.
 */

class Interacciones {
  constructor(usuario) {
    this.usuario = usuario;
  }

  /** Devuelve el carne, o lanza para que la UI distinga el caso. */
  requiereSesion() {
    if (!this.usuario || !this.usuario.estaLogueado()) {
      throw new Error("Debes iniciar sesion para interactuar.");
    }
    return this.usuario.getCarne();
  }

  /**
   * POST /api/interaccionvideo/{videoId}/like
   * El backend alterna por carne: la primera llamada registra el like y la
   * siguiente lo quita. Responde { likesTotales, dioLike }.
   */
  async alternarLike(videoId) {
    const carne = this.requiereSesion();
    return await Api.post(`/api/interaccionvideo/${encodeURIComponent(videoId)}/like`, {
      carne,
    });
  }

  /** POST /api/interaccionvideo/{videoId}/comentario. Responde 201 con el comentario. */
  async comentar(videoId, texto) {
    const carne = this.requiereSesion();
    const limpio = String(texto ?? "").trim();
    if (limpio === "") throw new Error("El comentario no puede estar vacio.");

    return await Api.post(
      `/api/interaccionvideo/${encodeURIComponent(videoId)}/comentario`,
      { carne, texto: limpio }
    );
  }

  /**
   * POST /api/interaccionvideo/comentario/{comentarioId}/responder
   * Solo un nivel: el comentario al que se responde no admite respuestas.
   */
  async responder(comentarioId, texto) {
    const carne = this.requiereSesion();
    const limpio = String(texto ?? "").trim();
    if (limpio === "") throw new Error("La respuesta no puede estar vacia.");

    return await Api.post(
      `/api/interaccionvideo/comentario/${encodeURIComponent(comentarioId)}/responder`,
      { carne, texto: limpio }
    );
  }

  /**
   * DELETE /api/interaccionvideo/comentario/{comentarioId}?carne=...
   * El carne va en la query, no en el body. Si el comentario es de otro
   * estudiante la API responde 403, y se traduce al mensaje que pide la
   * especificacion para que la UI no muestre un error generico.
   */
  async eliminar(comentarioId) {
    const carne = this.requiereSesion();

    try {
      return await Api.del(
        `/api/interaccionvideo/comentario/${encodeURIComponent(comentarioId)}`,
        { carne }
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        throw new Error("No puedes eliminar comentarios de otros");
      }
      throw error;
    }
  }
}

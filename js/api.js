/**
 * api.js — acceso a la API y utilidades de presentacion.
 * Debe cargarse antes que los demas scripts: define lo que usan.
 */

const API_URL =
  "https://back-semprivado-umg-h6fkf2bng2avgrgw.westus3-01.azurewebsites.net";

const API_TIMEOUT_MS = 15000;

/** Error de negocio de la API: status >= 400, distinguible de un fallo de red. */
class ApiError extends Error {
  constructor(mensaje, status = 0) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

class Api {
  /**
   * Unico punto donde se hacen peticiones HTTP.
   * @param {string} ruta  Ruta relativa, ej. "/api/videos".
   * @param {object} opciones  { method, body, query }
   */
  static async request(ruta, opciones = {}) {
    const { method = "GET", body = null, query = null } = opciones;

    let url = `${API_URL}${ruta}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [clave, valor] of Object.entries(query)) {
        if (valor !== null && valor !== undefined && valor !== "") {
          params.append(clave, valor);
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    // AbortController evita que la UI quede colgada si la API no responde.
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), API_TIMEOUT_MS);

    const config = { method, signal: controlador.signal };
    if (body !== null) {
      config.headers = { "Content-Type": "application/json; charset=utf-8" };
      config.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, config);
    } catch (error) {
      if (error.name === "AbortError") {
        throw new ApiError("El servidor tardo demasiado en responder. Intenta de nuevo.");
      }
      throw new ApiError("No hay conexion con el servidor. Verifica tu red e intentalo otra vez.");
    } finally {
      clearTimeout(temporizador);
    }

    // 204 y 205 no traen cuerpo; el resto se intenta leer como JSON.
    let datos = null;
    if (res.status !== 204 && res.status !== 205) {
      const texto = await res.text();
      if (texto) {
        try {
          datos = JSON.parse(texto);
        } catch {
          datos = texto;
        }
      }
    }

    if (!res.ok) {
      throw new ApiError(Api.extraerMensaje(datos, res.status), res.status);
    }

    return datos;
  }

  /** Los errores de negocio traen { "mensaje" }; los 400 de validacion, `errors`. */
  static extraerMensaje(datos, status) {
    if (datos && typeof datos === "object") {
      if (typeof datos.mensaje === "string" && datos.mensaje) return datos.mensaje;
      if (datos.errors && typeof datos.errors === "object") {
        const detalles = Object.values(datos.errors).flat().filter(Boolean);
        if (detalles.length) return detalles.join(" ");
      }
      if (typeof datos.title === "string" && datos.title) return datos.title;
    }
    if (typeof datos === "string" && datos.trim()) return datos.trim();
    return `Error ${status}: no se pudo completar la operacion.`;
  }

  static get(ruta, query) {
    return Api.request(ruta, { method: "GET", query });
  }

  static post(ruta, body) {
    return Api.request(ruta, { method: "POST", body });
  }

  static del(ruta, query) {
    return Api.request(ruta, { method: "DELETE", query });
  }
}

/** Escapa texto antes de meterlo en innerHTML. */
function escaparHtml(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caracter]);
}

/** Solo deja pasar URLs http/https; bloquea "javascript:" y similares. */
function urlSegura(valor) {
  if (typeof valor !== "string" || valor.trim() === "") return "";
  try {
    const url = new URL(valor, window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    /* URL no interpretable: se descarta */
  }
  return "";
}

/** La API envia "2026-08-10 14:30:00"; se muestra como dd/mm/yyyy hh:mm. */
function formatearFecha(fecha) {
  if (!fecha) return "";
  const fechaLocal = new Date(String(fecha).replace(" ", "T"));
  if (Number.isNaN(fechaLocal.getTime())) return "";
  const dosDigitos = (n) => String(n).padStart(2, "0");
  return (
    `${dosDigitos(fechaLocal.getDate())}/${dosDigitos(fechaLocal.getMonth() + 1)}/${fechaLocal.getFullYear()} ` +
    `${dosDigitos(fechaLocal.getHours())}:${dosDigitos(fechaLocal.getMinutes())}`
  );
}

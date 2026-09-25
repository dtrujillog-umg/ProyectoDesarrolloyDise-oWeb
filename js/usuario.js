/**
 * usuario.js — identidad del visitante: validacion, registro, login y sesion.
 * No toca el DOM ni el catalogo: App y Login la reciben ya construida.
 */

// El ultimo grupo del carne admite de 3 a 5 digitos, no 5 fijos. Verificado
// contra la API: con 1, 2 o 6 digitos responde 400, y existen estudiantes
// reales con 4 (por ejemplo 1690-10-6666).
const REGEX_CARNE = /^\d{4}-\d{2}-\d{3,5}$/;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_PIN = /^\d+$/;

const CLAVE_SESION = "usuario";

class Usuario {
  constructor() {
    this.sesion = Usuario.leerSesionGuardada();
  }

  // El backend valida el formato igual, pero se replica aqui para responder al
  // instante. Cada una devuelve el primer error, o null si todo es valido.

  static validarCarne(carne) {
    if (!carne) return "El carne es obligatorio.";
    if (!REGEX_CARNE.test(carne)) {
      return "El carne debe tener el formato 9999-99-99999. Ejemplo: 1890-20-11489.";
    }
    return null;
  }

  static validarCorreo(correo) {
    if (!correo) return "El correo es obligatorio.";
    if (!REGEX_CORREO.test(correo)) {
      return "El correo no tiene un formato valido. Ejemplo: nombre@dominio.com.";
    }
    return null;
  }

  static validarPin(password) {
    if (!password) return "El PIN es obligatorio.";
    if (!REGEX_PIN.test(password)) {
      return "El PIN debe ser estrictamente numerico, sin letras ni espacios.";
    }
    return null;
  }

  static validarRegistro({ carne, estudiante, correo, password }) {
    return (
      Usuario.validarCarne(carne) ||
      Usuario.validarCorreo(correo) ||
      Usuario.validarPin(password) ||
      (estudiante && estudiante.trim().length < 3
        ? "El nombre completo debe tener al menos 3 caracteres."
        : null)
    );
  }

  /** El login acepta indistintamente carne o correo; la unicidad la ve el backend. */
  static validarLogin(usuario, password) {
    if (!usuario) return "El usuario es obligatorio.";
    if (!REGEX_CARNE.test(usuario) && !REGEX_CORREO.test(usuario)) {
      return "Ingresa tu carne (9999-99-99999) o tu correo.";
    }
    return Usuario.validarPin(password);
  }

  /** POST /api/estudiantes/registrar. Responde 400 si el carne o correo ya existen. */
  async registrar({ carne, estudiante, correo, password }) {
    const error = Usuario.validarRegistro({ carne, estudiante, correo, password });
    if (error) throw new Error(error);

    return await Api.post("/api/estudiantes/registrar", {
      carne: carne.trim(),
      estudiante: estudiante.trim(),
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
    });
  }

  /** POST /api/login. El campo "usuario" admite carne o correo. */
  async login(usuario, password) {
    const error = Usuario.validarLogin(usuario.trim(), password.trim());
    if (error) throw new Error(error);

    const datos = await Api.post("/api/login", {
      usuario: usuario.trim(),
      password: password.trim(),
    });

    this.guardarSesion(datos);
    return this.sesion;
  }

  /**
   * Normaliza la respuesta del login. El envoltorio se llama `estudiante`, pero
   * su interior usa `nombre`. Se exige un `carne` string no vacio: comprobar
   * solo que exista la clave haria que el propio envoltorio encajara en la
   * busqueda y el `carne` se leeria como indefinido.
   */
  normalizarSesion(datos) {
    if (!datos || typeof datos !== "object") return null;

    const candidatos = [datos, datos.estudiante, datos.usuario, datos.datos];

    const estudiante = candidatos.find(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof c.carne === "string" &&
        c.carne.trim() !== ""
    );
    if (!estudiante) return null;

    return {
      carne: estudiante.carne.trim(),
      // Acepta las dos grafias: `nombre` en el login, `estudiante` en comentarios.
      nombre: estudiante.nombre ?? estudiante.estudiante ?? null,
      correo: estudiante.correo ?? null,
    };
  }

  guardarSesion(datos) {
    this.sesion = this.normalizarSesion(datos);
    if (!this.sesion || !this.sesion.carne) {
      throw new Error("El servidor no devolvio una sesion valida.");
    }
    localStorage.setItem(CLAVE_SESION, JSON.stringify(this.sesion));
  }

  cerrarSesion() {
    this.sesion = null;
    localStorage.removeItem(CLAVE_SESION);
  }

  /** Lectura defensiva: un localStorage corrupto no debe romper la app. */
  static leerSesionGuardada() {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION);
      if (!crudo) return null;
      const datos = JSON.parse(crudo);
      return datos && datos.carne ? datos : null;
    } catch {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
  }

  estaLogueado() {
    return this.sesion !== null && Boolean(this.sesion.carne);
  }

  getCarne() {
    return this.estaLogueado() ? this.sesion.carne : null;
  }

  /** Cae a `estudiante` y luego a `carne` para no romper sesiones ya guardadas. */
  getNombre() {
    if (!this.estaLogueado()) return null;
    return this.sesion.nombre || this.sesion.estudiante || this.sesion.carne;
  }
}

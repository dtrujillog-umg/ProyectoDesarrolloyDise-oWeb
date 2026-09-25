/**
 * login.js — clase Login.
 *
 * Vista dedicada de acceso: login y registro en la misma tarjeta, alternadas sin
 * recargar. Usuario aporta la sesion y las validaciones; aqui solo se recoge el
 * formulario, se muestra el error y se navega al catalogo.
 */

class Login {
  constructor() {
    this.usuario = new Usuario();
    this.elementos = {};
  }

  init() {
    this.cachearElementos();
    this.bindEventos();

    // Si ya hay sesion activa no tiene sentido mostrar el formulario.
    if (this.usuario.estaLogueado()) {
      window.location.replace("index.html");
    }
  }

  cachearElementos() {
    const id = (nombre) => document.getElementById(nombre);
    this.elementos = {
      loginBox: id("formLoginBox"),
      registroBox: id("formRegistroBox"),
      alertaLogin: id("alertaLogin"),
      alertaRegistro: id("alertaRegistro"),
      formLogin: id("formLogin"),
      formRegistro: id("formRegistro"),
      btnEntrar: id("btnEntrar"),
      btnRegistrar: id("btnRegistrar"),
      btnVerPin: id("btnVerPin"),
      password: id("password"),
      irRegistro: id("irRegistro"),
      irLogin: id("irLogin"),
    };
  }

  bindEventos() {
    this.elementos.formLogin.addEventListener("submit", (e) => this.enviarLogin(e));
    this.elementos.formRegistro.addEventListener("submit", (e) => this.enviarRegistro(e));

    this.elementos.irRegistro.addEventListener("click", (e) => {
      e.preventDefault();
      this.mostrarVista("registro");
    });

    this.elementos.irLogin.addEventListener("click", (e) => {
      e.preventDefault();
      this.mostrarVista("login");
    });

    this.elementos.btnVerPin.addEventListener("click", () => {
      const esPassword = this.elementos.password.type === "password";
      this.elementos.password.type = esPassword ? "text" : "password";
      this.elementos.btnVerPin.textContent = esPassword ? "Ocultar" : "Ver";
    });
  }

  /* ---------------- vistas y alertas ---------------- */

  mostrarVista(vista) {
    const esRegistro = vista === "registro";
    this.elementos.loginBox.classList.toggle("d-none", esRegistro);
    this.elementos.registroBox.classList.toggle("d-none", !esRegistro);
    this.limpiarAlertas();
  }

  /**
   * @param {HTMLElement} elemento  Contenedor donde se pinta la alerta.
   * @param {string} mensaje        Texto a mostrar (puede venir de la API).
   * @param {"danger"|"success"|"warning"} tipo
   */
  mostrarAlerta(elemento, mensaje, tipo = "danger") {
    if (!elemento) return;

    // textContent, nunca innerHTML: el texto puede venir del backend.
    elemento.className = `alert alert-${tipo} py-2`;
    elemento.textContent = mensaje;
    elemento.classList.remove("d-none");
  }

  limpiarAlertas() {
    for (const clave of ["alertaLogin", "alertaRegistro"]) {
      const elemento = this.elementos[clave];
      if (elemento) {
        elemento.textContent = "";
        elemento.classList.add("d-none");
      }
    }
  }

  /** Bloquea el boton mientras viaja la peticion, para evitar envios duplicados. */
  establecerCargando(boton, cargando, texto) {
    boton.disabled = cargando;
    boton.textContent = cargando ? texto : boton.dataset.textoOriginal;
  }

  /* ---------------- envios ---------------- */

  /** POST /api/login. El campo "usuario" admite carne o correo. */
  async enviarLogin(evento) {
    evento.preventDefault();
    this.limpiarAlertas();

    const usuario = this.elementos.formLogin.querySelector("#usuario").value.trim();
    const password = this.elementos.password.value.trim();

    const error = Usuario.validarLogin(usuario, password);
    if (error) {
      this.mostrarAlerta(this.elementos.alertaLogin, error);
      return;
    }

    const boton = this.elementos.btnEntrar;
    boton.dataset.textoOriginal = boton.textContent;
    this.establecerCargando(boton, true, "Entrando...");

    try {
      await this.usuario.login(usuario, password);
      window.location.href = "index.html";
    } catch (error) {
      this.mostrarAlerta(this.elementos.alertaLogin, error.message);
      this.establecerCargando(boton, false);
      this.elementos.password.value = "";
      this.elementos.password.focus();
    }
  }

  /** POST /api/estudiantes/registrar. El 400 de carne o correo repetido se muestra tal cual. */
  async enviarRegistro(evento) {
    evento.preventDefault();
    this.limpiarAlertas();

    const form = this.elementos.formRegistro;
    const carne = form.querySelector("#regCarne").value.trim();
    const estudiante = form.querySelector("#regNombre").value.trim();
    const correo = form.querySelector("#regCorreo").value.trim();
    const password = form.querySelector("#regPassword").value.trim();

    const error = Usuario.validarRegistro({ carne, estudiante, correo, password });
    if (error) {
      this.mostrarAlerta(this.elementos.alertaRegistro, error);
      return;
    }

    const boton = this.elementos.btnRegistrar;
    boton.dataset.textoOriginal = boton.textContent;
    this.establecerCargando(boton, true, "Registrando...");

    try {
      await this.usuario.registrar({ carne, estudiante, correo, password });

      this.mostrarAlerta(
        this.elementos.alertaRegistro,
        "Registro exitoso. Ya puedes iniciar sesion.",
        "success"
      );
      form.reset();
      this.establecerCargando(boton, false);

      // Tras un momento se vuelve al login con el campo de usuario precargado.
      setTimeout(() => {
        this.mostrarVista("login");
        const campoUsuario = this.elementos.formLogin.querySelector("#usuario");
        campoUsuario.value = carne;
        campoUsuario.focus();
      }, 1400);
    } catch (error) {
      this.mostrarAlerta(this.elementos.alertaRegistro, error.message);
      this.establecerCargando(boton, false);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Login().init();
});

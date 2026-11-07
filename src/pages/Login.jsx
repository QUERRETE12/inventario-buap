import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import "./Login.css";

function IconoOjo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="login-icono-ojo-svg"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconoOjoOculto() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="login-icono-ojo-svg"
    >
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.7A3 3 0 0 0 13.3 13.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.2A11.2 11.2 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-4 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.3A18.2 18.2 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Login({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: correo.trim(),
          password
        });

      if (loginError) {
        throw loginError;
      }

      if (onLogin) {
        onLogin();
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setError("Correo o contraseña incorrectos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-fondo">
      <form className="login-tarjeta" onSubmit={iniciarSesion}>
        <div className="login-encabezado">
          <div className="login-logo">BUAP</div>
          <h1>Inventario BUAP</h1>
          <p>Acceso al sistema de cotejo patrimonial</p>
        </div>

        <div className="login-campo">
          <label htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>

        <div className="login-campo">
          <label htmlFor="password">Contraseña</label>

          <div className="login-password">
            <input
              id="password"
              type={mostrarPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />

            <button
              type="button"
              className="login-ver-password"
              onClick={() => setMostrarPassword(!mostrarPassword)}
              aria-label={
                mostrarPassword
                  ? "Ocultar contraseña"
                  : "Mostrar contraseña"
              }
              title={
                mostrarPassword
                  ? "Ocultar contraseña"
                  : "Mostrar contraseña"
              }
            >
              {mostrarPassword ? <IconoOjoOculto /> : <IconoOjo />}
            </button>
          </div>
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="login-boton"
          disabled={cargando}
        >
          {cargando ? "Ingresando..." : "Iniciar sesión"}
        </button>

        <p className="login-pie">
          Sistema de Control Patrimonial
        </p>
      </form>
    </div>
  );
}
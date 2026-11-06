
import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function Login({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: correo,
        password
      });

    if (loginError) {
      setError(loginError.message);
    } else {
      onLogin();
    }

    setCargando(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f3f6fa",
      padding: "20px"
    }}>
      <form
        onSubmit={iniciarSesion}
        style={{
          background: "white",
          padding: "35px",
          borderRadius: "15px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 5px 25px #00000012"
        }}
      >
        <h1 style={{ color: "#087e85" }}>
          Inventario BUAP
        </h1>

        <p>Acceso al sistema de cotejo</p>

        <label>Correo electrónico</label>
        <input
          type="email"
          value={correo}
          onChange={e => setCorreo(e.target.value)}
          required
          style={{ width: "100%", margin: "10px 0 20px" }}
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ width: "100%", margin: "10px 0 20px" }}
        />

        {error && (
          <p style={{ color: "#b91c1c" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: "100%",
            background: "#087e85",
            color: "white",
            border: "none",
            padding: "13px"
          }}
        >
          {cargando ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}

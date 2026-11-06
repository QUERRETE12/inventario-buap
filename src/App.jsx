
import { useEffect, useState } from "react";
import { supabase } from "./services/supabaseClient";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function App() {
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  // ==========================================
  // COMPROBAR SESIÓN DEL USUARIO
  // ==========================================

  useEffect(() => {
    let activo = true;

    async function comprobarSesion() {
      const { data, error: errorSesion } =
        await supabase.auth.getSession();

      if (!activo) return;

      if (errorSesion) {
        console.error("Error de sesión:", errorSesion);
      }

      setSesion(data?.session ?? null);
      setVerificando(false);
    }

    const { data: authListener } =
      supabase.auth.onAuthStateChange(
        (_evento, sesionActual) => {
          if (!activo) return;

          setSesion(sesionActual);
          setVerificando(false);
        }
      );

    comprobarSesion();

    return () => {
      activo = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // CERRAR SESIÓN
  // ==========================================

  async function cerrarSesion() {
    setCerrando(true);
    setError("");

    try {
      const { error: errorSalida } =
        await supabase.auth.signOut();

      if (errorSalida) {
        throw errorSalida;
      }

      setSesion(null);

    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      setError("No se pudo cerrar la sesión. Intenta nuevamente.");

    } finally {
      setCerrando(false);
    }
  }

  // ==========================================
  // PANTALLA DE CARGA
  // ==========================================

  if (verificando) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f3f6fa",
        color: "#163c53"
      }}>
        <h2>Cargando Inventario BUAP...</h2>
      </div>
    );
  }

  // ==========================================
  // LOGIN
  // ==========================================

  if (!sesion) {
    return <Login onLogin={() => {}} />;
  }

  // ==========================================
  // SISTEMA PRINCIPAL
  // ==========================================

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f3f6fa"
    }}>

      {/* BARRA DE USUARIO */}

      <div style={{
        background: "#ffffff",
        borderBottom: "1px solid #e3eaf0",
        padding: "12px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px"
      }}>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          minWidth: 0
        }}>
          <strong style={{
            color: "#163c53",
            fontSize: "14px"
          }}>
            Usuario conectado
          </strong>

          <span style={{
            color: "#64748b",
            fontSize: "13px",
            overflowWrap: "anywhere"
          }}>
            {sesion.user.email}
          </span>
        </div>

        {/* BOTÓN CERRAR SESIÓN */}

        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          style={{
            background: "#fff1f2",
            color: "#be123c",
            border: "1px solid #fecdd3",
            padding: "11px 18px",
            borderRadius: "9px",
            cursor: cerrando ? "not-allowed" : "pointer",
            fontWeight: "600"
          }}
        >
          {cerrando
            ? "Cerrando sesión..."
            : "Cerrar sesión"}
        </button>
      </div>

      {/* MENSAJE DE ERROR */}

      {error && (
        <div style={{
          background: "#fee2e2",
          color: "#b91c1c",
          padding: "12px 20px",
          margin: "15px 28px",
          borderRadius: "8px"
        }}>
          {error}
        </div>
      )}

      {/* DASHBOARD EXISTENTE */}

      <Dashboard />

    </div>
  );
}

export default App;

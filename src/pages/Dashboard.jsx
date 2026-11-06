
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { exportarInventarioExcel } from "../services/excelService";
import Cotejo from "./Cotejo";
import AgregarArticulo from "./AgregarArticulo";
import "./Dashboard.css";

export default function Dashboard() {
  // ==========================================
  // ESTADOS
  // ==========================================

  const [bienes, setBienes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [filtroOrigen, setFiltroOrigen] = useState("Todos");

  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  const [bienSeleccionado, setBienSeleccionado] = useState(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  const [conexionRealtime, setConexionRealtime] =
    useState("Conectando");

  const [ultimaActualizacion, setUltimaActualizacion] =
    useState(null);

  // Evita aplicar respuestas antiguas sobre consultas nuevas.
  const numeroConsulta = useRef(0);

  // ==========================================
  // CONSULTAR TODOS LOS BIENES
  // ==========================================

  async function consultarInventario() {
    const registros = [];
    const tamanoPagina = 500;
    let inicio = 0;

    while (true) {
      const { data, error: consultaError } = await supabase
        .from("bienes")
        .select("*")
        .order("numero_inventario", { ascending: true })
        .range(inicio, inicio + tamanoPagina - 1);

      if (consultaError) {
        throw consultaError;
      }

      registros.push(...(data || []));

      if (!data || data.length < tamanoPagina) {
        break;
      }

      inicio += tamanoPagina;
    }

    return registros;
  }

  // ==========================================
  // CARGAR INVENTARIO
  // ==========================================

  async function cargarBienes(silencioso = false) {
    const consultaActual = ++numeroConsulta.current;

    if (!silencioso) {
      setCargando(true);
    }

    setError("");

    try {
      const registros = await consultarInventario();

      if (consultaActual !== numeroConsulta.current) {
        return false;
      }

      setBienes(registros);
      setUltimaActualizacion(new Date());

      return true;

    } catch (err) {
      if (consultaActual === numeroConsulta.current) {
        console.error("Error al consultar bienes:", err);

        setError(
          err.message || "No se pudo cargar el inventario."
        );
      }

      return false;

    } finally {
      if (consultaActual === numeroConsulta.current) {
        setCargando(false);
      }
    }
  }

  // ==========================================
  // CARGA INICIAL
  // ==========================================

  useEffect(() => {
    cargarBienes();

    return () => {
      numeroConsulta.current++;
    };
  }, []);

  // ==========================================
  // SUPABASE REALTIME
  // ==========================================

  useEffect(() => {
    let activo = true;
    let temporizador = null;

    // Espera brevemente para agrupar eventos cercanos.
    function programarActualizacion() {
      if (!activo) return;

      if (temporizador) {
        clearTimeout(temporizador);
      }

      temporizador = setTimeout(() => {
        if (activo) {
          cargarBienes(true);
        }
      }, 350);
    }

    const canal = supabase
      .channel("inventario-buap-cambios")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bienes"
        },
        (payload) => {
          console.log(
            "Cambio detectado en inventario:",
            payload.eventType
          );

          // INSERT: un artículo nuevo
          // UPDATE: un cotejo modificado
          // DELETE: un artículo eliminado
          programarActualizacion();
        }
      )

      .subscribe((estado, detalle) => {
        if (!activo) return;

        console.log("Estado Realtime:", estado, detalle);

        if (estado === "SUBSCRIBED") {
          setConexionRealtime("Conectado");

          // Recuperar cambios realizados mientras
          // se establecía la conexión.
          programarActualizacion();

        } else if (
          estado === "CHANNEL_ERROR" ||
          estado === "TIMED_OUT" ||
          estado === "CLOSED"
        ) {
          setConexionRealtime("Desconectado");
        }
      });

    // Limpiar suscripción al cerrar sesión
    // o desmontar el Dashboard.
    return () => {
      activo = false;

      if (temporizador) {
        clearTimeout(temporizador);
      }

      supabase.removeChannel(canal);
    };
  }, []);

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================

  const estadisticas = useMemo(() => ({
    total: bienes.length,

    pendientes: bienes.filter(
      b => b.estado_cotejo === "Pendiente"
    ).length,

    revision: bienes.filter(
      b => b.estado_cotejo === "En revision"
    ).length,

    localizados: bienes.filter(
      b => b.estado_cotejo === "Localizado"
    ).length,

    noLocalizados: bienes.filter(
      b => b.estado_cotejo === "No localizado"
    ).length,

    diferencias: bienes.filter(
      b => b.estado_cotejo === "Con diferencias"
    ).length,

    adicionales: bienes.filter(
      b => b.origen_registro !== "Original"
    ).length

  }), [bienes]);

  // ==========================================
  // AVANCE DEL COTEJO
  // ==========================================

  const cotejosFinalizados =
    estadisticas.localizados +
    estadisticas.noLocalizados +
    estadisticas.diferencias;

  const porcentaje = estadisticas.total
    ? Math.round(
        (cotejosFinalizados / estadisticas.total) * 100
      )
    : 0;

  // ==========================================
  // BUSCADOR Y FILTROS
  // ==========================================

  const bienesFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    return bienes.filter(b => {
      const contenido = [
        b.numero_inventario,
        b.descripcion_original,
        b.descripcion_verificada,
        b.marca_original,
        b.marca_verificada,
        b.modelo_original,
        b.modelo_verificado,
        b.serie_original,
        b.serie_verificada,
        b.ubicacion_original,
        b.ubicacion_verificada,
        b.responsable
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = contenido.includes(texto);

      const coincideFiltro =
        filtro === "Todos" ||
        b.estado_cotejo === filtro;

      const coincideOrigen =
        filtroOrigen === "Todos" ||
        b.origen_registro === filtroOrigen;

      return (
        coincideBusqueda &&
        coincideFiltro &&
        coincideOrigen
      );
    });

  }, [bienes, busqueda, filtro, filtroOrigen]);

  // ==========================================
  // DESPUÉS DE GUARDAR COTEJO
  // ==========================================

  async function cotejoGuardado() {
    const actualizado = await cargarBienes(true);

    if (actualizado) {
      setBienSeleccionado(null);
    }
  }

  // ==========================================
  // DESPUÉS DE AGREGAR ARTÍCULO
  // ==========================================

  async function articuloGuardado() {
    const actualizado = await cargarBienes(true);

    if (actualizado) {
      setMostrarAgregar(false);
    }
  }

  // ==========================================
  // EXPORTAR EXCEL
  // ==========================================

  async function descargarExcel() {
    setExportando(true);
    setError("");

    try {
      const registros = await consultarInventario();

      await exportarInventarioExcel(registros);

    } catch (err) {
      console.error("Error exportando Excel:", err);

      setError(
        err.message || "No se pudo generar el Excel."
      );

    } finally {
      setExportando(false);
    }
  }

  // ==========================================
  // TARJETAS
  // ==========================================

  const tarjetas = [
    { titulo: "Total de bienes", valor: estadisticas.total },
    { titulo: "Pendientes", valor: estadisticas.pendientes },
    { titulo: "Localizados", valor: estadisticas.localizados },
    { titulo: "No localizados", valor: estadisticas.noLocalizados },
    { titulo: "Con diferencias", valor: estadisticas.diferencias },
    { titulo: "Adicionales", valor: estadisticas.adicionales }
  ];

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="dashboard">

      {/* ENCABEZADO */}

      <header className="encabezado">
        <div>
          <span className="subtitulo">
            Control patrimonial
          </span>

          <h1>Inventario BUAP</h1>

          <p>Panel de verificación de bienes</p>

          {/* INDICADOR REALTIME */}

          <div className="realtime-indicador">
            <span className={
              conexionRealtime === "Conectado"
                ? "realtime-punto conectado"
                : "realtime-punto desconectado"
            } />

            <span>
              Sincronización: {conexionRealtime}
            </span>
          </div>

          {ultimaActualizacion && (
            <p className="realtime-fecha">
              Última actualización:{" "}
              {ultimaActualizacion.toLocaleTimeString("es-MX")}
            </p>
          )}
        </div>

        <div className="acciones-encabezado">

          <button
            type="button"
            className="btn-secundario"
            onClick={() => setMostrarAgregar(true)}
          >
            + Agregar artículo
          </button>

          <button
            type="button"
            className="btn-exportar"
            onClick={descargarExcel}
            disabled={exportando || cargando}
          >
            {exportando
              ? "Generando Excel..."
              : "Exportar Excel"}
          </button>

          <button
            type="button"
            className="btn-secundario"
            onClick={() => cargarBienes()}
            disabled={cargando}
          >
            {cargando
              ? "Actualizando..."
              : "Actualizar"}
          </button>
        </div>
      </header>

      {/* ERROR */}

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}

      <section className="estadisticas">
        {tarjetas.map(tarjeta => (
          <div className="tarjeta" key={tarjeta.titulo}>
            <span>{tarjeta.titulo}</span>
            <strong>{tarjeta.valor}</strong>
          </div>
        ))}
      </section>

      {/* AVANCE DEL COTEJO */}

      <section className="panel">
        <div className="panel-titulo">
          <h2>Avance del cotejo</h2>
          <strong>{porcentaje}%</strong>
        </div>

        <div className="barra">
          <div style={{ width: `${porcentaje}%` }} />
        </div>

        <p>
          {cotejosFinalizados} de {estadisticas.total} bienes
          con cotejo finalizado.
        </p>

        <p>
          {estadisticas.revision} bienes en revisión.
        </p>
      </section>

      {/* LISTADO DE BIENES */}

      <section className="panel">

        <div className="panel-titulo">
          <h2>Listado de bienes</h2>
          <span>{bienesFiltrados.length} resultados</span>
        </div>

        {/* BUSCADOR Y FILTROS */}

        <div className="herramientas">

          <input
            type="search"
            placeholder="Buscar inventario, descripción, modelo o serie..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />

          <select
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          >
            <option value="Todos">Todos los estados</option>
            <option value="Pendiente">Pendientes</option>
            <option value="En revision">En revisión</option>
            <option value="Localizado">Localizados</option>
            <option value="No localizado">No localizados</option>
            <option value="Con diferencias">Con diferencias</option>
          </select>

          <select
            value={filtroOrigen}
            onChange={e => setFiltroOrigen(e.target.value)}
          >
            <option value="Todos">Todos los orígenes</option>
            <option value="Original">Inventario original</option>
            <option value="Encontrado adicional">
              Encontrados adicionales
            </option>
            <option value="Alta nueva">Altas nuevas</option>
          </select>

        </div>

        {/* TABLA */}

        {cargando ? (
          <p>Cargando inventario...</p>
        ) : (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>N.º de inventario</th>
                  <th>Descripción</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Serie</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {bienesFiltrados.map(b => (
                  <tr key={b.numero_inventario}>

                    <td>
                      <strong>{b.numero_inventario}</strong>
                    </td>

                    <td>
                      {b.descripcion_verificada ||
                        b.descripcion_original || "—"}
                    </td>

                    <td>
                      {b.marca_verificada ||
                        b.marca_original || "—"}
                    </td>

                    <td>
                      {b.modelo_verificado ||
                        b.modelo_original || "—"}
                    </td>

                    <td>
                      {b.serie_verificada ||
                        b.serie_original || "—"}
                    </td>

                    <td>
                      {b.ubicacion_verificada ||
                        b.ubicacion_original || "—"}
                    </td>

                    <td>
                      <span className="estado">
                        {b.estado_cotejo}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn-secundario"
                        onClick={() => setBienSeleccionado(b)}
                      >
                        Cotejar
                      </button>
                    </td>

                  </tr>
                ))}

                {bienesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="8">
                      No se encontraron bienes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* FORMULARIO DE COTEJO */}

      {bienSeleccionado && (
        <Cotejo
          key={bienSeleccionado.numero_inventario}
          bien={bienSeleccionado}
          onCerrar={() => setBienSeleccionado(null)}
          onGuardado={cotejoGuardado}
        />
      )}

      {/* AGREGAR ARTÍCULO */}

      {mostrarAgregar && (
        <AgregarArticulo
          onCerrar={() => setMostrarAgregar(false)}
          onGuardado={articuloGuardado}
        />
      )}

    </div>
  );
}

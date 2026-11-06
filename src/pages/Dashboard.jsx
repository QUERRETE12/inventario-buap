
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { exportarInventarioExcel } from "../services/excelService";
import Cotejo from "./Cotejo";
import AgregarArticulo from "./AgregarArticulo";
import "./Dashboard.css";

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function mostrarDato(valor) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ""
  ) {
    return "—";
  }

  return String(valor);
}

function datoPrincipal(verificado, original) {
  return mostrarDato(verificado || original);
}

function claseEstado(estado) {
  switch (estado) {
    case "Localizado":
      return "localizado";

    case "No localizado":
      return "no-localizado";

    case "Con diferencias":
      return "diferencias";

    case "En revision":
      return "revision";

    default:
      return "pendiente";
  }
}

function nombreEstado(estado) {
  if (estado === "En revision") return "En revisión";
  return estado || "Pendiente";
}

// ==========================================
// COMPONENTE DASHBOARD
// ==========================================

export default function Dashboard() {
  // ESTADOS PRINCIPALES

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

  // Evita que consultas anteriores reemplacen
  // resultados más recientes.
  const numeroConsulta = useRef(0);

  // ==========================================
  // CONSULTAR INVENTARIO COMPLETO
  // ==========================================

  const consultarInventario = useCallback(async () => {
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
  }, []);

  // ==========================================
  // CARGAR BIENES
  // ==========================================

  const cargarBienes = useCallback(
    async (silencioso = false) => {
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
          console.error("Error consultando inventario:", err);

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
    },
    [consultarInventario]
  );

  // ==========================================
  // CARGA INICIAL
  // ==========================================

  useEffect(() => {
    cargarBienes();

    return () => {
      numeroConsulta.current++;
    };
  }, [cargarBienes]);

  // ==========================================
  // SINCRONIZACIÓN SUPABASE REALTIME
  // ==========================================

  useEffect(() => {
    let activo = true;
    let temporizador = null;

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
            "Cambio recibido:",
            payload.eventType
          );

          programarActualizacion();
        }
      )
      .subscribe((estado, detalle) => {
        if (!activo) return;

        console.log("Realtime:", estado, detalle);

        if (estado === "SUBSCRIBED") {
          setConexionRealtime("Conectado");
          programarActualizacion();
        }

        if (
          estado === "CHANNEL_ERROR" ||
          estado === "TIMED_OUT" ||
          estado === "CLOSED"
        ) {
          setConexionRealtime("Desconectado");
        }
      });

    return () => {
      activo = false;

      if (temporizador) {
        clearTimeout(temporizador);
      }

      supabase.removeChannel(canal);
    };
  }, [cargarBienes]);

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================

  const estadisticas = useMemo(() => {
    return {
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
    };
  }, [bienes]);

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

      const coincideEstado =
        filtro === "Todos" ||
        b.estado_cotejo === filtro;

      const coincideOrigen =
        filtroOrigen === "Todos" ||
        b.origen_registro === filtroOrigen;

      return (
        coincideBusqueda &&
        coincideEstado &&
        coincideOrigen
      );
    });
  }, [bienes, busqueda, filtro, filtroOrigen]);

  // ==========================================
  // GUARDAR COTEJO
  // ==========================================

  async function cotejoGuardado() {
    const actualizado = await cargarBienes(true);

    if (actualizado) {
      setBienSeleccionado(null);
    }
  }

  // ==========================================
  // AGREGAR ARTÍCULO
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
  // TARJETAS DE ESTADÍSTICAS
  // ==========================================

  const tarjetas = [
    {
      titulo: "Total de bienes",
      valor: estadisticas.total,
      tipo: "total"
    },
    {
      titulo: "Pendientes",
      valor: estadisticas.pendientes,
      tipo: "pendientes"
    },
    {
      titulo: "Localizados",
      valor: estadisticas.localizados,
      tipo: "localizados"
    },
    {
      titulo: "No localizados",
      valor: estadisticas.noLocalizados,
      tipo: "no-localizados"
    },
    {
      titulo: "Con diferencias",
      valor: estadisticas.diferencias,
      tipo: "diferencias"
    },
    {
      titulo: "Adicionales",
      valor: estadisticas.adicionales,
      tipo: "adicionales"
    }
  ];

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <main className="dashboard">

      {/* ENCABEZADO */}

      <header className="encabezado">
        <div className="encabezado-informacion">

          <span className="subtitulo">
            Control patrimonial
          </span>

          <h1>Inventario BUAP</h1>

          <p>Panel de verificación de bienes</p>

          <div className="realtime-indicador">
            <span
              className={
                conexionRealtime === "Conectado"
                  ? "realtime-punto conectado"
                  : "realtime-punto desconectado"
              }
            />

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

        {/* BOTONES PRINCIPALES */}

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
            className="btn-actualizar"
            onClick={() => cargarBienes()}
            disabled={cargando}
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>

        </div>
      </header>

      {/* ERRORES */}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {/* ESTADÍSTICAS */}

      <section className="estadisticas">
        {tarjetas.map(tarjeta => (
          <div
            className={`tarjeta tarjeta-${tarjeta.tipo}`}
            key={tarjeta.titulo}
          >
            <span>{tarjeta.titulo}</span>
            <strong>{tarjeta.valor}</strong>
          </div>
        ))}
      </section>

      {/* BARRA DE PROGRESO */}

      <section className="panel">
        <div className="panel-titulo">
          <h2>Avance del cotejo</h2>
          <strong>{porcentaje}%</strong>
        </div>

        <div
          className="barra"
          role="progressbar"
          aria-label="Avance del cotejo"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            style={{
              width: `${porcentaje}%`
            }}
          />
        </div>

        <p>
          {cotejosFinalizados} de {estadisticas.total} bienes
          con cotejo finalizado.
        </p>

        <p>
          {estadisticas.revision} bienes en revisión.
        </p>
      </section>

      {/* LISTADO */}

      <section className="panel panel-inventario">

        <div className="panel-titulo">
          <h2>Listado de bienes</h2>

          <span className="contador-resultados">
            {bienesFiltrados.length} resultados
          </span>
        </div>

        {/* FILTROS */}

        <div className="herramientas">

          <input
            type="search"
            aria-label="Buscar artículos"
            placeholder="Buscar inventario, descripción, modelo o serie..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />

          <select
            aria-label="Filtrar por estado"
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
            aria-label="Filtrar por origen"
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

        {cargando ? (
          <p className="mensaje-carga">
            Cargando inventario...
          </p>
        ) : (
          <>
            {/* ================================
                VISTA DE COMPUTADORA
            ================================= */}

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
                        <strong>
                          {b.numero_inventario}
                        </strong>
                      </td>

                      <td>
                        {datoPrincipal(
                          b.descripcion_verificada,
                          b.descripcion_original
                        )}
                      </td>

                      <td>
                        {datoPrincipal(
                          b.marca_verificada,
                          b.marca_original
                        )}
                      </td>

                      <td>
                        {datoPrincipal(
                          b.modelo_verificado,
                          b.modelo_original
                        )}
                      </td>

                      <td>
                        {datoPrincipal(
                          b.serie_verificada,
                          b.serie_original
                        )}
                      </td>

                      <td>
                        {datoPrincipal(
                          b.ubicacion_verificada,
                          b.ubicacion_original
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            `estado estado-${claseEstado(
                              b.estado_cotejo
                            )}`
                          }
                        >
                          {nombreEstado(b.estado_cotejo)}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn-cotejar"
                          onClick={() => setBienSeleccionado(b)}
                        >
                          Cotejar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {bienesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="8" className="sin-resultados">
                        No se encontraron bienes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ================================
                VISTA MÓVIL CON TARJETAS
            ================================= */}

            <div className="inventario-movil">

              {bienesFiltrados.map(b => (
                <article
                  className="bien-tarjeta"
                  key={b.numero_inventario}
                >

                  {/* ENCABEZADO DE TARJETA */}

                  <div className="bien-tarjeta-encabezado">
                    <div className="bien-identificacion">
                      <span className="bien-etiqueta">
                        N.º DE INVENTARIO
                      </span>

                      <strong className="bien-numero">
                        {b.numero_inventario}
                      </strong>
                    </div>

                    <span
                      className={
                        `estado estado-${claseEstado(
                          b.estado_cotejo
                        )}`
                      }
                    >
                      {nombreEstado(b.estado_cotejo)}
                    </span>
                  </div>

                  {/* DESCRIPCIÓN */}

                  <div className="bien-tarjeta-cuerpo">
                    <h3>
                      {datoPrincipal(
                        b.descripcion_verificada,
                        b.descripcion_original
                      )}
                    </h3>

                    <div className="bien-datos">

                      <div className="bien-dato">
                        <span>Marca</span>
                        <strong>
                          {datoPrincipal(
                            b.marca_verificada,
                            b.marca_original
                          )}
                        </strong>
                      </div>

                      <div className="bien-dato">
                        <span>Modelo</span>
                        <strong>
                          {datoPrincipal(
                            b.modelo_verificado,
                            b.modelo_original
                          )}
                        </strong>
                      </div>

                      <div className="bien-dato">
                        <span>Número de serie</span>
                        <strong>
                          {datoPrincipal(
                            b.serie_verificada,
                            b.serie_original
                          )}
                        </strong>
                      </div>

                      <div className="bien-dato">
                        <span>Ubicación</span>
                        <strong>
                          {datoPrincipal(
                            b.ubicacion_verificada,
                            b.ubicacion_original
                          )}
                        </strong>
                      </div>

                    </div>
                  </div>

                  {/* INFORMACIÓN ADICIONAL */}

                  <div className="bien-tarjeta-pie">
                    <div className="bien-meta">
                      <span>
                        {b.origen_registro === "Original"
                          ? "Inventario original"
                          : b.origen_registro || "Adicional"}
                      </span>

                      <span>
                        {b.datos_completos
                          ? "Datos completos"
                          : "Datos por completar"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-cotejar btn-cotejar-movil"
                      onClick={() => setBienSeleccionado(b)}
                    >
                      Cotejar artículo
                    </button>
                  </div>

                </article>
              ))}

              {bienesFiltrados.length === 0 && (
                <div className="sin-resultados-movil">
                  No se encontraron artículos con esos filtros.
                </div>
              )}

            </div>
          </>
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

      {/* FORMULARIO AGREGAR ARTÍCULO */}

      {mostrarAgregar && (
        <AgregarArticulo
          onCerrar={() => setMostrarAgregar(false)}
          onGuardado={articuloGuardado}
        />
      )}

    </main>
  );
}

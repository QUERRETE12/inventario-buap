
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { supabase } from "../services/supabaseClient";
import { exportarInventarioExcel } from "../services/excelService";
import Cotejo from "./Cotejo";
import AgregarArticulo from "./AgregarArticulo";
import "./Dashboard.css";

// ========================================
// FUNCIONES AUXILIARES
// ========================================

function dato(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    return "—";
  }
  return String(valor);
}

function valorBien(verificado, original) {
  return dato(verificado || original);
}

function estadoNombre(estado) {
  return estado === "En revision" ? "En revisión" : (estado || "Pendiente");
}

function estadoClase(estado) {
  const clases = {
    Pendiente: "pendiente",
    "En revision": "revision",
    Localizado: "localizado",
    "No localizado": "no-localizado",
    "Con diferencias": "diferencias"
  };
  return clases[estado] || "pendiente";
}

const OPCIONES_PAGINA = [10, 20, 50];

// ========================================
// DASHBOARD PRINCIPAL
// ========================================

export default function Dashboard() {
  const [bienes, setBienes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [filtroOrigen, setFiltroOrigen] = useState("Todos");

  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  const [bienSeleccionado, setBienSeleccionado] = useState(null);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  const [conexionRealtime, setConexionRealtime] = useState("Conectando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const numeroConsulta = useRef(0);

  // ========================================
  // CONSULTAR INVENTARIO
  // ========================================

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

      if (consultaError) throw consultaError;

      registros.push(...(data || []));

      if (!data || data.length < tamanoPagina) break;
      inicio += tamanoPagina;
    }

    return registros;
  }, []);

  const cargarBienes = useCallback(
    async (silencioso = false) => {
      const consultaActual = ++numeroConsulta.current;

      if (!silencioso) setCargando(true);
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
          console.error("Error cargando inventario:", err);
          setError(err.message || "No se pudo cargar el inventario.");
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

  // ========================================
  // CARGA INICIAL
  // ========================================

  useEffect(() => {
    cargarBienes();

    return () => {
      numeroConsulta.current++;
    };
  }, [cargarBienes]);

  // ========================================
  // SUPABASE REALTIME
  // ========================================

  useEffect(() => {
    let activo = true;
    let temporizador = null;

    function actualizarDespuesDeEvento() {
      if (!activo) return;

      clearTimeout(temporizador);

      temporizador = setTimeout(() => {
        if (activo) cargarBienes(true);
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
        () => {
          actualizarDespuesDeEvento();
        }
      )
      .subscribe((estado) => {
        if (!activo) return;

        if (estado === "SUBSCRIBED") {
          setConexionRealtime("Conectado");
          actualizarDespuesDeEvento();
        }

        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(estado)) {
          setConexionRealtime("Desconectado");
        }
      });

    return () => {
      activo = false;
      clearTimeout(temporizador);
      supabase.removeChannel(canal);
    };
  }, [cargarBienes]);

  // ========================================
  // ESTADÍSTICAS
  // ========================================

  const estadisticas = useMemo(() => ({
    total: bienes.length,
    pendientes: bienes.filter(b => b.estado_cotejo === "Pendiente").length,
    revision: bienes.filter(b => b.estado_cotejo === "En revision").length,
    localizados: bienes.filter(b => b.estado_cotejo === "Localizado").length,
    noLocalizados: bienes.filter(b => b.estado_cotejo === "No localizado").length,
    diferencias: bienes.filter(b => b.estado_cotejo === "Con diferencias").length,
    adicionales: bienes.filter(b => b.origen_registro !== "Original").length
  }), [bienes]);

  const finalizados =
    estadisticas.localizados +
    estadisticas.noLocalizados +
    estadisticas.diferencias;

  const porcentaje = estadisticas.total
    ? Math.round((finalizados / estadisticas.total) * 100)
    : 0;

  const tarjetas = [
    ["Total de bienes", estadisticas.total, "total"],
    ["Pendientes", estadisticas.pendientes, "pendientes"],
    ["Localizados", estadisticas.localizados, "localizados"],
    ["No localizados", estadisticas.noLocalizados, "no-localizados"],
    ["Con diferencias", estadisticas.diferencias, "diferencias"],
    ["Adicionales", estadisticas.adicionales, "adicionales"]
  ];

  // ========================================
  // BUSCADOR Y FILTROS
  // ========================================

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

      return (
        contenido.includes(texto) &&
        (filtro === "Todos" || b.estado_cotejo === filtro) &&
        (filtroOrigen === "Todos" || b.origen_registro === filtroOrigen)
      );
    });
  }, [bienes, busqueda, filtro, filtroOrigen]);

  // ========================================
  // PAGINACIÓN
  // ========================================

  const totalPaginas = Math.max(
    1,
    Math.ceil(bienesFiltrados.length / porPagina)
  );

  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;

  const bienesPagina = bienesFiltrados.slice(inicio, inicio + porPagina);

  const primerRegistro = bienesFiltrados.length === 0 ? 0 : inicio + 1;
  const ultimoRegistro = Math.min(inicio + porPagina, bienesFiltrados.length);

  function cambiarFiltros(campo, valor) {
    setPagina(1);

    if (campo === "busqueda") setBusqueda(valor);
    if (campo === "estado") setFiltro(valor);
    if (campo === "origen") setFiltroOrigen(valor);
  }

  function renderPaginacion() {
    if (!bienesFiltrados.length) return null;

    return (
      <div className="paginacion">
        <div className="paginacion-info">
          <span>
            Mostrando {primerRegistro}–{ultimoRegistro} de{" "}
            {bienesFiltrados.length}
          </span>

          <label className="paginacion-tamano">
            Por página
            <select
              value={porPagina}
              onChange={(e) => {
                setPorPagina(Number(e.target.value));
                setPagina(1);
              }}
            >
              {OPCIONES_PAGINA.map(n => (
                <option value={n} key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <nav className="paginacion-controles" aria-label="Paginación">
          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => setPagina(1)}
            aria-label="Primera página"
          >
            «
          </button>

          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => setPagina(paginaActual - 1)}
            aria-label="Página anterior"
          >
            ‹
          </button>

          <span className="paginacion-indicador">
            {paginaActual} / {totalPaginas}
          </span>

          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => setPagina(paginaActual + 1)}
            aria-label="Página siguiente"
          >
            ›
          </button>

          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => setPagina(totalPaginas)}
            aria-label="Última página"
          >
            »
          </button>
        </nav>
      </div>
    );
  }

  // ========================================
  // GUARDADO Y EXPORTACIÓN
  // ========================================

  async function cotejoGuardado() {
    if (await cargarBienes(true)) {
      setBienSeleccionado(null);
    }
  }

  async function articuloGuardado() {
    if (await cargarBienes(true)) {
      setMostrarAgregar(false);
    }
  }

  async function descargarExcel() {
    setExportando(true);
    setError("");

    try {
      const registros = await consultarInventario();
      await exportarInventarioExcel(registros);
    } catch (err) {
      console.error("Error exportando:", err);
      setError(err.message || "No se pudo generar el Excel.");
    } finally {
      setExportando(false);
    }
  }

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <main className="dashboard">

      {/* ENCABEZADO */}

      <header className="encabezado">
        <div className="encabezado-informacion">
          <span className="subtitulo">CONTROL PATRIMONIAL</span>
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
            <span>Sincronización: {conexionRealtime}</span>
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
            disabled={exportando || cargando}
            onClick={descargarExcel}
          >
            {exportando ? "Generando Excel..." : "Exportar Excel"}
          </button>

          <button
            type="button"
            className="btn-actualizar"
            disabled={cargando}
            onClick={() => cargarBienes()}
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </header>

      {/* ERROR */}

      {error && <div className="error" role="alert">{error}</div>}

      {/* TARJETAS DE ESTADÍSTICAS */}

      <section className="estadisticas">
        {tarjetas.map(([titulo, valor, tipo]) => (
          <div key={tipo} className={`tarjeta tarjeta-${tipo}`}>
            <span>{titulo}</span>
            <strong>{valor}</strong>
          </div>
        ))}
      </section>

      {/* PROGRESO */}

      <section className="panel">
        <div className="panel-titulo">
          <h2>Avance del cotejo</h2>
          <strong>{porcentaje}%</strong>
        </div>

        <div
          className="barra"
          role="progressbar"
          aria-label="Avance del cotejo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
        >
          <div style={{ width: `${porcentaje}%` }} />
        </div>

        <p>{finalizados} de {estadisticas.total} bienes con cotejo finalizado.</p>
        <p>{estadisticas.revision} bienes en revisión.</p>
      </section>

      {/* INVENTARIO */}

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
            value={busqueda}
            onChange={e => cambiarFiltros("busqueda", e.target.value)}
            placeholder="Buscar inventario, descripción, modelo o serie..."
            aria-label="Buscar bienes"
          />

          <select
            value={filtro}
            onChange={e => cambiarFiltros("estado", e.target.value)}
            aria-label="Filtrar por estado"
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
            onChange={e => cambiarFiltros("origen", e.target.value)}
            aria-label="Filtrar por origen"
          >
            <option value="Todos">Todos los orígenes</option>
            <option value="Original">Inventario original</option>
            <option value="Encontrado adicional">Encontrados adicionales</option>
            <option value="Alta nueva">Altas nuevas</option>
          </select>
        </div>

        {cargando ? (
          <p className="mensaje-carga">Cargando inventario...</p>
        ) : (
          <>
            {renderPaginacion()}

            {/* TABLA PARA COMPUTADORAS */}

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
                    <th className="columna-acciones">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {bienesPagina.map(b => (
                    <tr key={b.numero_inventario}>
                      <td><strong>{b.numero_inventario}</strong></td>
                      <td>{valorBien(b.descripcion_verificada, b.descripcion_original)}</td>
                      <td>{valorBien(b.marca_verificada, b.marca_original)}</td>
                      <td>{valorBien(b.modelo_verificado, b.modelo_original)}</td>
                      <td>{valorBien(b.serie_verificada, b.serie_original)}</td>
                      <td>{valorBien(b.ubicacion_verificada, b.ubicacion_original)}</td>
                      <td>
                        <span className={`estado estado-${estadoClase(b.estado_cotejo)}`}>
                          {estadoNombre(b.estado_cotejo)}
                        </span>
                      </td>
                      <td className="columna-acciones">
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

                  {bienesPagina.length === 0 && (
                    <tr>
                      <td colSpan="8" className="sin-resultados">
                        No se encontraron bienes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* TARJETAS PARA CELULARES */}

            <div className="inventario-movil">
              {bienesPagina.map(b => (
                <article className="bien-tarjeta" key={b.numero_inventario}>
                  <div className="bien-tarjeta-encabezado">
                    <div className="bien-identificacion">
                      <span className="bien-etiqueta">N.º DE INVENTARIO</span>
                      <strong className="bien-numero">{b.numero_inventario}</strong>
                    </div>

                    <span className={`estado estado-${estadoClase(b.estado_cotejo)}`}>
                      {estadoNombre(b.estado_cotejo)}
                    </span>
                  </div>

                  <div className="bien-tarjeta-cuerpo">
                    <h3>{valorBien(b.descripcion_verificada, b.descripcion_original)}</h3>

                    <div className="bien-datos">
                      <div className="bien-dato">
                        <span>Marca</span>
                        <strong>{valorBien(b.marca_verificada, b.marca_original)}</strong>
                      </div>
                      <div className="bien-dato">
                        <span>Modelo</span>
                        <strong>{valorBien(b.modelo_verificado, b.modelo_original)}</strong>
                      </div>
                      <div className="bien-dato">
                        <span>Número de serie</span>
                        <strong>{valorBien(b.serie_verificada, b.serie_original)}</strong>
                      </div>
                      <div className="bien-dato">
                        <span>Ubicación</span>
                        <strong>{valorBien(b.ubicacion_verificada, b.ubicacion_original)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bien-tarjeta-pie">
                    <div className="bien-meta">
                      <span>
                        {b.origen_registro === "Original"
                          ? "Inventario original"
                          : b.origen_registro || "Adicional"}
                      </span>
                      <span>
                        {b.datos_completos ? "Datos completos" : "Datos por completar"}
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

              {bienesPagina.length === 0 && (
                <div className="sin-resultados-movil">
                  No se encontraron artículos.
                </div>
              )}
            </div>

            {renderPaginacion()}
          </>
        )}
      </section>

      {/* FORMULARIOS */}

      {bienSeleccionado && (
        <Cotejo
          key={bienSeleccionado.numero_inventario}
          bien={bienSeleccionado}
          onCerrar={() => setBienSeleccionado(null)}
          onGuardado={cotejoGuardado}
        />
      )}

      {mostrarAgregar && (
        <AgregarArticulo
          onCerrar={() => setMostrarAgregar(false)}
          onGuardado={articuloGuardado}
        />
      )}

    </main>
  );
}

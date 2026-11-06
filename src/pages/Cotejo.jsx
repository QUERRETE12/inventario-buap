
import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import "./Cotejo.css";

const texto = (valor) => valor ?? "";

export default function Cotejo({
  bien,
  onCerrar,
  onGuardado
}) {
  // ==========================================
  // INFORMACIÓN DEL FORMULARIO
  // ==========================================

  const [formulario, setFormulario] = useState({
    descripcion_verificada: texto(bien.descripcion_verificada),
    marca_verificada: texto(bien.marca_verificada),
    modelo_verificado: texto(bien.modelo_verificado),
    serie_verificada: texto(bien.serie_verificada),
    ubicacion_verificada: texto(bien.ubicacion_verificada),
    estado_fisico: texto(bien.estado_fisico),
    estado_cotejo: bien.estado_cotejo || "Pendiente",
    responsable: texto(bien.responsable),
    observaciones: texto(bien.observaciones),
    datos_completos: bien.datos_completos ?? false
  });

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [conflicto, setConflicto] = useState(false);

  // Versión del registro al abrir el formulario
  const versionOriginal = bien.actualizado_en;

  // ==========================================
  // MODIFICAR CAMPOS
  // ==========================================

  function cambiar(campo, valor) {
    setFormulario(anterior => ({
      ...anterior,
      [campo]: valor
    }));
  }

  function normalizar(valor) {
    return typeof valor === "string"
      ? valor.trim() || null
      : valor;
  }

  // ==========================================
  // GUARDAR COTEJO
  // ==========================================

  async function guardar(e) {
    e.preventDefault();

    setError("");

    if (conflicto) {
      setError(
        "Debes actualizar el artículo antes de guardar."
      );
      return;
    }

    if (!formulario.responsable.trim()) {
      setError("Indica quién realizó el cotejo.");
      return;
    }

    if (!versionOriginal) {
      setError(
        "No se encontró la versión del artículo. " +
        "Actualiza el inventario e inténtalo nuevamente."
      );
      return;
    }

    setGuardando(true);

    try {
      const ahora = new Date().toISOString();

      const datos = {
        descripcion_verificada: normalizar(
          formulario.descripcion_verificada
        ),
        marca_verificada: normalizar(
          formulario.marca_verificada
        ),
        modelo_verificado: normalizar(
          formulario.modelo_verificado
        ),
        serie_verificada: normalizar(
          formulario.serie_verificada
        ),
        ubicacion_verificada: normalizar(
          formulario.ubicacion_verificada
        ),
        estado_fisico: normalizar(
          formulario.estado_fisico
        ),
        estado_cotejo: formulario.estado_cotejo,
        responsable: formulario.responsable.trim(),
        observaciones: normalizar(
          formulario.observaciones
        ),
        datos_completos: formulario.datos_completos,
        fecha_cotejo: ahora,
        actualizado_en: ahora
      };

      // ======================================
      // CONTROL DE CONFLICTOS
      // ======================================
      // Solo actualizar si el artículo conserva
      // la versión con la que abrimos la ficha.

      const { data, error: errorGuardar } = await supabase
        .from("bienes")
        .update(datos)
        .eq("numero_inventario", bien.numero_inventario)
        .eq("actualizado_en", versionOriginal)
        .select("numero_inventario, actualizado_en");

      if (errorGuardar) {
        throw errorGuardar;
      }

      if (!data || data.length === 0) {
        setConflicto(true);

        setError(
          "Este artículo fue modificado por otro usuario " +
          "o ya no está disponible. Para evitar perder " +
          "información, no se guardaron tus cambios. " +
          "Cierra el formulario, presiona Actualizar " +
          "y vuelve a abrir el artículo."
        );

        return;
      }

      if (data.length !== 1) {
        throw new Error(
          "No se pudo confirmar una única actualización."
        );
      }

      // Actualizar Dashboard después del guardado
      await onGuardado();

    } catch (err) {
      console.error("Error al guardar cotejo:", err);

      setError(
        err.message || "No se pudo guardar el cotejo."
      );

    } finally {
      setGuardando(false);
    }
  }

  // ==========================================
  // CAMPOS PARA COMPARACIÓN
  // ==========================================

  const campos = [
    {
      nombre: "Descripción",
      campo: "descripcion_verificada",
      original: bien.descripcion_original
    },
    {
      nombre: "Marca",
      campo: "marca_verificada",
      original: bien.marca_original
    },
    {
      nombre: "Modelo",
      campo: "modelo_verificado",
      original: bien.modelo_original
    },
    {
      nombre: "Número de serie",
      campo: "serie_verificada",
      original: bien.serie_original
    },
    {
      nombre: "Ubicación",
      campo: "ubicacion_verificada",
      original: bien.ubicacion_original
    }
  ];

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="cotejo-fondo">
      <div className="cotejo-contenedor">

        {/* ENCABEZADO */}

        <div className="cotejo-encabezado">
          <div>
            <span>VERIFICACIÓN PATRIMONIAL</span>
            <h2>Ficha de cotejo</h2>
            <p>
              Inventario: {bien.numero_inventario}
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="cotejo-cerrar"
            disabled={guardando}
          >
            ✕
          </button>
        </div>

        <form onSubmit={guardar}>

          <h3>Comparación de información</h3>

          <div className="cotejo-columnas-titulo">
            <strong>Información original</strong>
            <strong>Información verificada</strong>
          </div>

          {/* CAMPOS DE INFORMACIÓN */}

          {campos.map(campo => (
            <div
              className="cotejo-campo"
              key={campo.campo}
            >
              <div className="cotejo-original">
                <label>{campo.nombre}</label>
                <p>
                  {campo.original || "Sin información"}
                </p>
              </div>

              <div className="cotejo-editable">
                <label>
                  {campo.nombre} verificado
                </label>

                <input
                  value={formulario[campo.campo]}
                  onChange={e =>
                    cambiar(campo.campo, e.target.value)
                  }
                  placeholder={
                    campo.original
                      ? `Original: ${campo.original}`
                      : "Capturar información"
                  }
                  disabled={guardando || conflicto}
                />
              </div>
            </div>
          ))}

          <h3>Resultado de la revisión</h3>

          <div className="cotejo-dos-columnas">

            {/* ESTADO DEL COTEJO */}

            <div>
              <label>Estado del cotejo</label>

              <select
                value={formulario.estado_cotejo}
                onChange={e =>
                  cambiar("estado_cotejo", e.target.value)
                }
                disabled={guardando || conflicto}
              >
                <option value="Pendiente">
                  Pendiente
                </option>
                <option value="En revision">
                  En revisión
                </option>
                <option value="Localizado">
                  Localizado
                </option>
                <option value="No localizado">
                  No localizado
                </option>
                <option value="Con diferencias">
                  Con diferencias
                </option>
              </select>
            </div>

            {/* ESTADO FÍSICO */}

            <div>
              <label>Estado físico</label>

              <select
                value={formulario.estado_fisico}
                onChange={e =>
                  cambiar("estado_fisico", e.target.value)
                }
                disabled={guardando || conflicto}
              >
                <option value="">Sin evaluar</option>
                <option value="Bueno">Bueno</option>
                <option value="Regular">Regular</option>
                <option value="Malo">Malo</option>
                <option value="No aplica">No aplica</option>
              </select>
            </div>
          </div>

          {/* RESPONSABLE */}

          <div className="cotejo-campo-simple">
            <label>Responsable del cotejo *</label>

            <input
              required
              value={formulario.responsable}
              onChange={e =>
                cambiar("responsable", e.target.value)
              }
              placeholder="Nombre del responsable"
              disabled={guardando || conflicto}
            />
          </div>

          {/* OBSERVACIONES */}

          <div className="cotejo-campo-simple">
            <label>Observaciones</label>

            <textarea
              rows={3}
              value={formulario.observaciones}
              onChange={e =>
                cambiar("observaciones", e.target.value)
              }
              placeholder="Daños, diferencias o información adicional..."
              disabled={guardando || conflicto}
            />
          </div>

          {/* DATOS COMPLETOS */}

          <label className="cotejo-checkbox">
            <input
              type="checkbox"
              checked={formulario.datos_completos}
              onChange={e =>
                cambiar("datos_completos", e.target.checked)
              }
              disabled={guardando || conflicto}
            />
            Confirmo que los datos necesarios están completos
          </label>

          {/* MENSAJES DE ERROR */}

          {error && (
            <div className="cotejo-error">
              {error}
            </div>
          )}

          {/* ACCIONES */}

          <div className="cotejo-acciones">

            <button
              type="button"
              className="cotejo-cancelar"
              onClick={onCerrar}
              disabled={guardando}
            >
              {conflicto ? "Cerrar y actualizar" : "Cancelar"}
            </button>

            <button
              type="submit"
              className="cotejo-guardar"
              disabled={guardando || conflicto}
            >
              {guardando
                ? "Guardando..."
                : "Guardar cotejo"}
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}

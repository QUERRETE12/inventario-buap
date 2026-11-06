
import { useState } from "react";
import { supabase } from "../services/supabaseClient";
import "./AgregarArticulo.css";

const formularioInicial = {
  numero_inventario: "",
  descripcion: "",
  cantidad: 1,
  marca: "",
  modelo: "",
  serie: "",
  ubicacion: "",
  estado_fisico: "",
  estado_cotejo: "Localizado",
  responsable: "",
  observaciones: "",
  origen_registro: "Encontrado adicional",
  datos_completos: false
};

export default function AgregarArticulo({
  onCerrar,
  onGuardado
}) {
  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function cambiar(campo, valor) {
    setFormulario(anterior => ({
      ...anterior,
      [campo]: valor
    }));
  }

  function limpiar(valor) {
    return valor.trim() || null;
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");

    if (!formulario.descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }

    if (!formulario.responsable.trim()) {
      setError("Indica quién registra el artículo.");
      return;
    }

    setGuardando(true);

    try {
      const numero = formulario.numero_inventario.trim();

      // Preparar los datos del artículo adicional
      const nuevoBien = {
        cantidad: Number(formulario.cantidad),
        descripcion_original: formulario.descripcion.trim(),

        // Los datos originales pertenecen al resguardo
        // oficial, por eso quedan sin información.
        marca_original: null,
        modelo_original: null,
        serie_original: null,
        ubicacion_original: null,

        // Información levantada físicamente
        descripcion_verificada: formulario.descripcion.trim(),
        marca_verificada: limpiar(formulario.marca),
        modelo_verificado: limpiar(formulario.modelo),
        serie_verificada: limpiar(formulario.serie),
        ubicacion_verificada: limpiar(formulario.ubicacion),

        estado_fisico: limpiar(formulario.estado_fisico),
        estado_cotejo: formulario.estado_cotejo,

        datos_completos: formulario.datos_completos,
        responsable: formulario.responsable.trim(),
        observaciones: limpiar(formulario.observaciones),
        origen_registro: formulario.origen_registro,

        fecha_cotejo: new Date().toISOString(),
        actualizado_en: new Date().toISOString()
      };

      // Cuando no existe número patrimonial,
      // Supabase utilizará el valor TEMP- generado
      // por el DEFAULT que configuramos anteriormente.
      if (numero) {
        nuevoBien.numero_inventario = numero;
      }

      const { data, error: insertarError } = await supabase
        .from("bienes")
        .insert(nuevoBien)
        .select("numero_inventario")
        .single();

      if (insertarError) {
        if (insertarError.code === "23505") {
          throw new Error(
            "Ya existe un artículo con ese número de inventario."
          );
        }

        throw insertarError;
      }

      if (!data?.numero_inventario) {
        throw new Error(
          "No se pudo confirmar el registro del artículo."
        );
      }

      // Actualizar la tabla del Dashboard
      await onGuardado();

    } catch (err) {
      console.error("Error al agregar artículo:", err);
      setError(err.message || "No se pudo guardar el artículo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="agregar-fondo">
      <div className="agregar-contenedor">

        <header className="agregar-encabezado">
          <div>
            <span>CONTROL PATRIMONIAL</span>
            <h2>Agregar artículo</h2>
            <p>
              Registrar un bien que no aparece en
              el inventario original.
            </p>
          </div>

          <button
            type="button"
            className="agregar-cerrar"
            onClick={onCerrar}
            disabled={guardando}
          >
            ✕
          </button>
        </header>

        <form onSubmit={guardar}>

          <div className="agregar-campo">
            <label>Tipo de registro</label>
            <select
              value={formulario.origen_registro}
              onChange={e =>
                cambiar("origen_registro", e.target.value)
              }
            >
              <option value="Encontrado adicional">
                Encontrado adicional
              </option>
              <option value="Alta nueva">
                Alta nueva
              </option>
            </select>
          </div>

          <div className="agregar-campo">
            <label>Número de inventario</label>
            <input
              value={formulario.numero_inventario}
              onChange={e =>
                cambiar("numero_inventario", e.target.value)
              }
              placeholder="Opcional si no tiene etiqueta"
            />
            <small>
              Si no tiene número patrimonial,
              se generará un identificador TEMP.
            </small>
          </div>

          <div className="agregar-campo">
            <label>Descripción del artículo *</label>
            <input
              required
              value={formulario.descripcion}
              onChange={e =>
                cambiar("descripcion", e.target.value)
              }
              placeholder="Ej. Monitor, computadora, silla..."
            />
          </div>

          <div className="agregar-grid">
            <div className="agregar-campo">
              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                required
                value={formulario.cantidad}
                onChange={e =>
                  cambiar("cantidad", e.target.value)
                }
              />
            </div>

            <div className="agregar-campo">
              <label>Marca</label>
              <input
                value={formulario.marca}
                onChange={e =>
                  cambiar("marca", e.target.value)
                }
                placeholder="Ej. HP"
              />
            </div>

            <div className="agregar-campo">
              <label>Modelo</label>
              <input
                value={formulario.modelo}
                onChange={e =>
                  cambiar("modelo", e.target.value)
                }
                placeholder="Modelo del equipo"
              />
            </div>

            <div className="agregar-campo">
              <label>Número de serie</label>
              <input
                value={formulario.serie}
                onChange={e =>
                  cambiar("serie", e.target.value)
                }
                placeholder="Serie física"
              />
            </div>
          </div>

          <div className="agregar-campo">
            <label>Ubicación actual</label>
            <input
              value={formulario.ubicacion}
              onChange={e =>
                cambiar("ubicacion", e.target.value)
              }
              placeholder="Ej. Laboratorio de cómputo"
            />
          </div>

          <div className="agregar-grid">
            <div className="agregar-campo">
              <label>Estado del cotejo</label>
              <select
                value={formulario.estado_cotejo}
                onChange={e =>
                  cambiar("estado_cotejo", e.target.value)
                }
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En revision">En revisión</option>
                <option value="Localizado">Localizado</option>
                <option value="No localizado">No localizado</option>
                <option value="Con diferencias">Con diferencias</option>
              </select>
            </div>

            <div className="agregar-campo">
              <label>Estado físico</label>
              <select
                value={formulario.estado_fisico}
                onChange={e =>
                  cambiar("estado_fisico", e.target.value)
                }
              >
                <option value="">Sin evaluar</option>
                <option value="Bueno">Bueno</option>
                <option value="Regular">Regular</option>
                <option value="Malo">Malo</option>
                <option value="No aplica">No aplica</option>
              </select>
            </div>
          </div>

          <div className="agregar-campo">
            <label>Responsable *</label>
            <input
              required
              value={formulario.responsable}
              onChange={e =>
                cambiar("responsable", e.target.value)
              }
              placeholder="Nombre de quien registra"
            />
          </div>

          <div className="agregar-campo">
            <label>Observaciones</label>
            <textarea
              rows="3"
              value={formulario.observaciones}
              onChange={e =>
                cambiar("observaciones", e.target.value)
              }
              placeholder="Información adicional..."
            />
          </div>

          <label className="agregar-check">
            <input
              type="checkbox"
              checked={formulario.datos_completos}
              onChange={e =>
                cambiar("datos_completos", e.target.checked)
              }
            />
            Confirmo que la información está completa
          </label>

          {error && (
            <div className="agregar-error">
              {error}
            </div>
          )}

          <div className="agregar-acciones">
            <button
              type="button"
              className="agregar-cancelar"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="agregar-guardar"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : "Guardar artículo"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

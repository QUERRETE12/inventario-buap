
import ExcelJS from "exceljs";

const COLUMNAS = [
  { header: "N.º inventario", key: "inventario", width: 22 },
  { header: "Cantidad", key: "cantidad", width: 12 },
  { header: "Origen", key: "origen", width: 23 },
  { header: "Descripción original", key: "descripcionOriginal", width: 35 },
  { header: "Descripción verificada", key: "descripcionVerificada", width: 35 },
  { header: "Marca original", key: "marcaOriginal", width: 22 },
  { header: "Marca verificada", key: "marcaVerificada", width: 22 },
  { header: "Modelo original", key: "modeloOriginal", width: 25 },
  { header: "Modelo verificado", key: "modeloVerificado", width: 25 },
  { header: "Serie original", key: "serieOriginal", width: 28 },
  { header: "Serie verificada", key: "serieVerificada", width: 28 },
  { header: "Ubicación original", key: "ubicacionOriginal", width: 35 },
  { header: "Ubicación verificada", key: "ubicacionVerificada", width: 35 },
  { header: "Estado original", key: "estadoOriginal", width: 20 },
  { header: "Estado físico", key: "estadoFisico", width: 20 },
  { header: "Estado cotejo", key: "estadoCotejo", width: 22 },
  { header: "Datos completos", key: "datosCompletos", width: 19 },
  { header: "Responsable", key: "responsable", width: 28 },
  { header: "Fecha cotejo", key: "fechaCotejo", width: 23 },
  { header: "Observaciones", key: "observaciones", width: 45 }
];

function convertirBien(bien) {
  return {
    inventario: bien.numero_inventario || "",
    cantidad: bien.cantidad ?? 1,
    origen: bien.origen_registro || "",
    descripcionOriginal: bien.descripcion_original || "",
    descripcionVerificada: bien.descripcion_verificada || "",
    marcaOriginal: bien.marca_original || "",
    marcaVerificada: bien.marca_verificada || "",
    modeloOriginal: bien.modelo_original || "",
    modeloVerificado: bien.modelo_verificado || "",
    serieOriginal: bien.serie_original || "",
    serieVerificada: bien.serie_verificada || "",
    ubicacionOriginal: bien.ubicacion_original || "",
    ubicacionVerificada: bien.ubicacion_verificada || "",
    estadoOriginal: bien.estado_original || "",
    estadoFisico: bien.estado_fisico || "",
    estadoCotejo: bien.estado_cotejo || "",
    datosCompletos: bien.datos_completos ? "Sí" : "No",
    responsable: bien.responsable || "",
    fechaCotejo: bien.fecha_cotejo
      ? new Date(bien.fecha_cotejo).toLocaleString("es-MX")
      : "",
    observaciones: bien.observaciones || ""
  };
}

function crearHoja(libro, nombre, bienes) {
  const hoja = libro.addWorksheet(nombre);

  hoja.columns = COLUMNAS;
  hoja.views = [
    { state: "frozen", ySplit: 1 }
  ];

  hoja.getRow(1).height = 30;

  hoja.getRow(1).eachCell(celda => {
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF087E85" }
    };

    celda.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11
    };

    celda.alignment = {
      vertical: "middle",
      wrapText: true
    };
  });

  bienes.forEach((bien, indice) => {
    const fila = hoja.addRow(convertirBien(bien));

    if (indice % 2 === 1) {
      fila.eachCell(celda => {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F6F8" }
        };
      });
    }
  });

  // Mantener los números patrimoniales como texto
  hoja.getColumn("inventario").numFmt = "@";

  // Agregar filtros a las columnas
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNAS.length }
  };

  return hoja;
}

export async function exportarInventarioExcel(bienes) {
  if (!bienes || bienes.length === 0) {
    throw new Error("No hay bienes para exportar.");
  }

  const libro = new ExcelJS.Workbook();

  libro.creator = "Sistema Inventario BUAP";
  libro.created = new Date();

  const originalesYAdicionales = [...bienes].sort(
    (a, b) => String(a.numero_inventario).localeCompare(
      String(b.numero_inventario),
      "es",
      { numeric: true }
    )
  );

  const adicionales = originalesYAdicionales.filter(
    b => b.origen_registro !== "Original"
  );

  const pendientes = originalesYAdicionales.filter(
    b => [
      "Pendiente",
      "En revision",
      "Con diferencias"
    ].includes(b.estado_cotejo)
  );

  crearHoja(libro, "Inventario general", originalesYAdicionales);
  crearHoja(libro, "Articulos adicionales", adicionales);
  crearHoja(libro, "Pendientes revision", pendientes);

  const buffer = await libro.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;

  const fecha = new Date().toLocaleDateString("en-CA");
  enlace.download = `Inventario_BUAP_${fecha}.xlsx`;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

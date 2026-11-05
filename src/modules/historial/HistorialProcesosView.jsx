import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Filter, MoreVertical, Edit3, Trash2,
  ChevronLeft, ChevronRight, ArrowLeft, Save, AlertTriangle, Plus, X, Check, Download, Eye, RefreshCw, Loader2, Menu
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import PlantillaInforme from './PlantillaInforme';
import FotografiasProceso from '../inspeccion/FotografiasProceso';
import { API_URL } from '../../config/api.js';
// Evita caracteres reservados en Windows/macOS, sin recurrir a guiones bajos.
const limpiarNombreArchivo = (valor) => String(valor ?? '')
  .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[. ]+$/g, '')
  .slice(0, 90) || 'Sin dato';
// Exportación XLSX sin dependencias adicionales. El archivo ZIP contiene OpenXML válido.
const excelXmlEscape = valor => String(valor ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const excelColumna = posicion => {
  let n = posicion;
  let columna = '';
  while (n > 0) {
    n -= 1;
    columna = String.fromCharCode(65 + (n % 26)) + columna;
    n = Math.floor(n / 26);
  }
  return columna;
};
const excelHojaXml = ({ encabezados, filas }) => {
  const totalColumnas = encabezados.length;
  const ultimaCelda = `${excelColumna(totalColumnas)}${filas.length + 1}`;
  const anchuras = encabezados.map((encabezado, indice) => {
    let ancho = Math.max(13, String(encabezado).length + 3);
    filas.slice(0, 250).forEach(fila => { ancho = Math.max(ancho, String(fila[indice] ?? '').length + 2); });
    return Math.min(48, ancho);
  });
  const columnasXml = anchuras.map((ancho, indice) =>
    `<col min="${indice + 1}" max="${indice + 1}" width="${ancho}" customWidth="1"/>`
  ).join('');
  const crearCelda = (valor, fila, columna, estilo) => {
    const referencia = `${excelColumna(columna + 1)}${fila}`;
    if (valor === null || valor === undefined || valor === '') return '';
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return `<c r="${referencia}" s="${estilo}"><v>${valor}</v></c>`;
    }
    return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t>${excelXmlEscape(valor)}</t></is></c>`;
  };
  const cabecera = `<row r="1" ht="29" customHeight="1">${encabezados.map((titulo, indice) => crearCelda(titulo, 1, indice, 1)).join('')}</row>`;
  const contenido = filas.map((fila, indice) => {
    const numeroFila = indice + 2;
    return `<row r="${numeroFila}">${fila.map((valor, columna) => crearCelda(valor, numeroFila, columna, indice % 2 === 0 ? 0 : 2)).join('')}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${ultimaCelda}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${columnasXml}</cols><sheetData>${cabecera}${contenido}</sheetData><autoFilter ref="A1:${ultimaCelda}"/></worksheet>`;
};
const excelStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const crearZipXlsx = entradas => {
  const encoder = new TextEncoder();
  const crcTabla = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let valor = i;
    for (let bit = 0; bit < 8; bit += 1) valor = (valor & 1) ? (0xEDB88320 ^ (valor >>> 1)) : (valor >>> 1);
    crcTabla[i] = valor >>> 0;
  }
  const crc32 = bytes => {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTabla[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  const locales = [];
  const centrales = [];
  let posicion = 0;
  entradas.forEach(([nombre, contenido]) => {
    const nombreBytes = encoder.encode(nombre);
    const datos = encoder.encode(contenido);
    const checksum = crc32(datos);
    const local = new Uint8Array(30 + nombreBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034B50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, datos.length, true);
    lv.setUint32(22, datos.length, true);
    lv.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);
    const central = new Uint8Array(46 + nombreBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, datos.length, true);
    cv.setUint32(24, datos.length, true);
    cv.setUint16(28, nombreBytes.length, true);
    cv.setUint32(42, posicion, true);
    central.set(nombreBytes, 46);
    locales.push(local, datos);
    centrales.push(central);
    posicion += local.length + datos.length;
  });
  const tamanoDirectorio = centrales.reduce((total, parte) => total + parte.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054B50, true);
  fv.setUint16(8, entradas.length, true);
  fv.setUint16(10, entradas.length, true);
  fv.setUint32(12, tamanoDirectorio, true);
  fv.setUint32(16, posicion, true);
  return new Blob([...locales, ...centrales, fin], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
const crearLibroExcelHistorial = hojas => {
  const workbookSheets = hojas.map((hoja, indice) =>
    `<sheet name="${excelXmlEscape(hoja.nombre)}" sheetId="${indice + 1}" r:id="rId${indice + 1}"/>`
  ).join('');
  const relaciones = hojas.map((_, indice) =>
    `<Relationship Id="rId${indice + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${indice + 1}.xml"/>`
  ).join('');
  const contenidoTipos = hojas.map((_, indice) =>
    `<Override PartName="/xl/worksheets/sheet${indice + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const entradas = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contenidoTipos}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relaciones}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', excelStylesXml],
    ...hojas.map((hoja, indice) => [`xl/worksheets/sheet${indice + 1}.xml`, excelHojaXml(hoja)]),
  ];
  return crearZipXlsx(entradas);
};
// Identidad para los informes: estas tablas NO seleccionan otra API.
// Todas las consultas usan exclusivamente API_URL de config/api.js.
const PLANTAS_INFORME = Object.freeze({ MAQ: 'Maquehua', ROS: 'Rosario' });
const PLANTA_INFORME_POR_HOST = Object.freeze({
  'evap.maq.goldanda.cl': 'MAQ',
  '192.168.0.10': 'MAQ',
  'evap.ros.goldanda.cl': 'ROS',
  '192.168.10.10': 'ROS',
});
async function consultarConfiguracionInforme(ruta) {
  const controller = new AbortController();
  let tiempoAgotado = false;
  const temporizador = setTimeout(() => {
    tiempoAgotado = true;
    controller.abort();
  }, 15000);
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`No se pudo consultar ${ruta} (HTTP ${respuesta.status}). Revisa el backend de esta planta.`);
    }
    const contenido = await respuesta.json();
    if (!contenido || typeof contenido !== 'object' || Array.isArray(contenido)) {
      throw new Error(`La respuesta de ${ruta} no tiene el formato esperado.`);
    }
    return contenido;
  } catch (error) {
    if (tiempoAgotado) {
      throw new Error(`El servidor no respondio a tiempo en ${ruta}. Reintenta sin cambiar de planta.`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`El servidor no devolvio JSON valido en ${ruta}. Revisa el proxy /api.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`No se pudo conectar con ${ruta}. Revisa la conexion con el backend de esta planta.`);
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}
async function obtenerPlantaInforme() {
  const datos = await consultarConfiguracionInforme('/api/planta');
  const plantaId = String(datos.plantaId || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(PLANTAS_INFORME, plantaId)) {
    throw new Error('El backend no informo una planta valida (MAQ o ROS). No se puede preparar el informe.');
  }
  const plantaNombre = PLANTAS_INFORME[plantaId];
  if (datos.plantaNombre != null && String(datos.plantaNombre).trim()
      && String(datos.plantaNombre).trim().toLowerCase() !== plantaNombre.toLowerCase()) {
    throw new Error('El identificador y el nombre de planta del backend no coinciden. Revisa /api/planta.');
  }
  // En localhost la identidad viene del backend, nunca de una suposicion.
  for (const valor of [window.location.hostname, new URL(API_URL).hostname]) {
    const host = String(valor || '').toLowerCase().replace(/\.$/, '');
    const esperada = Object.prototype.hasOwnProperty.call(PLANTA_INFORME_POR_HOST, host)
      ? PLANTA_INFORME_POR_HOST[host] : null;
    if (esperada && esperada !== plantaId) {
      throw new Error(`La direccion corresponde a ${PLANTAS_INFORME[esperada]}, pero el backend informa ${plantaNombre}. Revisa el proxy y PLANTA_ID antes de generar informes.`);
    }
  }
  return { plantaId, plantaNombre };
}
function validarPlantaDatosInforme(datos, planta) {
  // Si algun dato ya declara una planta, no se lo cambia silenciosamente.
  for (const valor of [datos.planta, datos.plantaNombre, datos.plantaId, datos.planta_id]) {
    if (valor == null || String(valor).trim() === '') continue;
    const texto = String(valor).trim().toLowerCase();
    if (texto !== planta.plantaId.toLowerCase() && texto !== planta.plantaNombre.toLowerCase()) {
      throw new Error(`El proceso declara la planta "${String(valor)}", pero el backend informa ${planta.plantaNombre}. Se detuvo el informe para no cambiar su identificacion.`);
    }
  }
}
async function obtenerParametrosInforme() {
  const parametros = await consultarConfiguracionInforme('/api/parametros');
  if (!Array.isArray(parametros.calidad) || !Array.isArray(parametros.condicion)
      || !parametros.calidad.some(p => p?.nombre === SUM_CALIDAD)
      || !parametros.condicion.some(p => p?.nombre === SUM_CONDICION)) {
    throw new Error('No hay parametros de calificacion completos para este informe. Revisa las dos sumatorias en Parametros de Calificacion.');
  }
  return { calidad: parametros.calidad, condicion: parametros.condicion };
}
const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
// Lectura compatible con registros anteriores que no tenían Temp pulpa.
const leerTempPulpa = valor => {
  if (valor == null || String(valor).trim() === '') return null;
  const texto = String(valor).trim().replace(',', '.');
  if (!/^-?\d{1,4}(?:\.\d{1,2})?$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};
// Helpers del catálogo común.
const crearMapaDefectos = nombres => Object.fromEntries(nombres.map(nombre => [nombre, 0]));
const completarMapa = (actual, nombres) => ({ ...crearMapaDefectos(nombres), ...(actual || {}) });
const numeroParametro = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const nivelPorLimite = (pct, lim1, lim2) => {
  if (lim1 === null || lim2 === null) return 1;
  return pct > lim2 ? 3 : pct > lim1 ? 2 : 1;
};
const nombreUsuarioCaja = caja => {
  const nombre = String(caja?.usuario || caja?.usuarioNombre || caja?.username || '').trim();
  return nombre && nombre.toLowerCase() !== 'usuario' ? nombre : 'Sin registro';
};
export default function HistorialProcesosView({ onVerResumen, onAbrirMenu = null, userRole, usuarioId, usuarioNombre, puedeEditar = false, puedeEliminar = false }) {
  const [procesos, setProcesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState(null);
  // Estados de Búsqueda y Filtros
  const [filtroNumProceso, setFiltroNumProceso] = useState('');
  const [filtroCsgHuerto, setFiltroCsgHuerto] = useState('');
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [filtroVariedad, setFiltroVariedad] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroCalificacion, setFiltroCalificacion] = useState('');
  const [filtroTemporada, setFiltroTemporada] = useState('');
  const esAdministrador = ['admin', 'administrador'].includes(String(userRole ?? '').trim().toLowerCase());
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [errorSincronizacion, setErrorSincronizacion] = useState('');
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null);
  // Listas maestras
  const [exportadoras, setExportadoras] = useState([]);
  const [variedades, setVariedades] = useState([]);
  const [huertos, setHuertos] = useState([]);
  const [parametrosActuales, setParametrosActuales] = useState({ calidad: [], condicion: [] });
  // Menús y modales
  const [menuProcesoAbiertoId, setMenuProcesoAbiertoId] = useState(null);
  const [menuEscritorioPosicion, setMenuEscritorioPosicion] = useState(null);
  const menuEscritorioRef = useRef(null);
  const botonMenuEscritorioRef = useRef(null);

  // Posiciona las opciones fuera del contenedor con overflow-x-auto de la tabla.
  const alternarMenuEscritorio = (evento, id) => {
    evento.stopPropagation();
    if (menuProcesoAbiertoId === id) {
      setMenuProcesoAbiertoId(null);
      setMenuEscritorioPosicion(null);
      return;
    }
    const rect = evento.currentTarget.getBoundingClientRect();
    const ancho = 256;
    const altoEstimado = (puedeEditar ? 56 : 0) + (puedeEliminar ? 56 : 0) + 62;
    const margen = 10;
    const izquierda = Math.max(margen, Math.min(rect.right - ancho, window.innerWidth - ancho - margen));
    const cabeAbajo = window.innerHeight - rect.bottom >= altoEstimado + margen;
    const arriba = rect.top >= altoEstimado + margen;
    const superior = cabeAbajo || !arriba
      ? Math.max(margen, Math.min(rect.bottom + 6, window.innerHeight - Math.min(altoEstimado, window.innerHeight - 2 * margen) - margen))
      : Math.max(margen, rect.top - altoEstimado - 6);
    botonMenuEscritorioRef.current = evento.currentTarget;
    setMenuEscritorioPosicion({ top: superior, left: izquierda });
    setMenuProcesoAbiertoId(id);
  };

  useEffect(() => {
    if (!menuEscritorioPosicion || menuProcesoAbiertoId == null) return;
    const cerrar = () => {
      setMenuProcesoAbiertoId(null);
      setMenuEscritorioPosicion(null);
    };
    const cerrarSiFuera = (evento) => {
      if (menuEscritorioRef.current?.contains(evento.target)) return;
      if (botonMenuEscritorioRef.current?.contains(evento.target)) return;
      cerrar();
    };
    document.addEventListener('pointerdown', cerrarSiFuera);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('pointerdown', cerrarSiFuera);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [menuProcesoAbiertoId, menuEscritorioPosicion]);
  const [procesoAEliminar, setProcesoAEliminar] = useState(null);
  // Paginación de lista
  const [paginaActual, setPaginaActual] = useState(1);
  const [busquedaMovil, setBusquedaMovil] = useState('');
  const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [confirmacionResumenMovilId, setConfirmacionResumenMovilId] = useState(null);
  const listaMovilRef = useRef(null);
  const procesosPorPagina = 15;
  // Vistas: 'lista' | 'editar'
  const [vistaActual, setVistaActual] = useState('lista');
  const [procesoEnEdicion, setProcesoEnEdicion] = useState(null);
  const [cajaIndexEditandoModal, setCajaIndexEditandoModal] = useState(null);
  const [tabDefectosModal, setTabDefectosModal] = useState('calidad');
  // ================= ESTADOS PARA REPORTE PDF Y VISTA PREVIA =================
  const [datosReporte, setDatosReporte] = useState(null);
  const [generandoReporteId, setGenerandoReporteId] = useState(null);
  const [datosVistaPrevia, setDatosVistaPrevia] = useState(null);
  const [fotosEdicion, setFotosEdicion] = useState({ procesoId: null, light: false, dark: false, cargando: false, error: '' });
  const [cargandoVistaPreviaId, setCargandoVistaPreviaId] = useState(null);
  const [zoomVistaPrevia, setZoomVistaPrevia] = useState(1);
  const reporteRef = useRef();
  const pinchDistanciaRef = useRef(null);
  const pinchZoomRef = useRef(1);
  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [inspRes, expRes, varRes, hueRes, paramRes] = await Promise.all([
        fetch(`${API_URL}/api/inspecciones`).catch(() => null),
        fetch(`${API_URL}/api/exportadoras`).catch(() => null),
        fetch(`${API_URL}/api/variedades`).catch(() => null),
        fetch(`${API_URL}/api/huertos`).catch(() => null),
        fetch(`${API_URL}/api/parametros`).catch(() => null)
      ]);
      if (!inspRes?.ok) throw new Error('No fue posible consultar el historial de inspecciones.');
      const data = await inspRes.json();
      if (!Array.isArray(data)) throw new Error('El servidor devolvió un historial con formato incorrecto.');
      setProcesos([...data].reverse());
      setUltimaSincronizacion(new Date());
      setErrorSincronizacion('');
      if (expRes && expRes.ok) {
        const dataExp = await expRes.json();
        setExportadoras(Array.isArray(dataExp) ? dataExp : []);
      }
      if (varRes && varRes.ok) {
        const dataVar = await varRes.json();
        setVariedades(Array.isArray(dataVar) ? dataVar : []);
      }
      if (hueRes && hueRes.ok) {
        const dataHue = await hueRes.json();
        setHuertos(Array.isArray(dataHue) ? dataHue : []);
      }
      if (paramRes && paramRes.ok) {
        const dataParam = await paramRes.json();
        setParametrosActuales({
          calidad: Array.isArray(dataParam?.calidad) ? dataParam.calidad : [],
          condicion: Array.isArray(dataParam?.condicion) ? dataParam.condicion : []
        });
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      setErrorSincronizacion(err.message || 'No se pudo sincronizar el historial.');
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargarDatos();
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const actualizar = () => setEsMovil(media.matches);
    actualizar();
    if (media.addEventListener) media.addEventListener('change', actualizar);
    else media.addListener(actualizar);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', actualizar);
      else media.removeListener(actualizar);
    };
  }, []);
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroNumProceso, filtroCsgHuerto, filtroVariedad, filtroFecha, filtroCalificacion, filtroTemporada, busquedaMovil, esMovil]);
  // ==========================================
  // FUNCIÓN INFALIBLE PARA ZONA HORARIA
  // ==========================================
  const obtenerFechaProceso = (proc) => {
    if (!proc) return { texto: 'Sin fecha', valorFiltro: '' };
    if (proc.fecha) {
      try {
        const f = new Date(proc.fecha);
        if (!isNaN(f.getTime())) {
          const dia = String(f.getUTCDate()).padStart(2, '0');
          const mes = String(f.getUTCMonth() + 1).padStart(2, '0');
          const anio = f.getUTCFullYear();
          return { texto: `${dia}-${mes}-${anio}`, valorFiltro: `${anio}-${mes}-${dia}` };
        }
      } catch(e) {}
    }
    const fallback = proc.horaInicio || proc.created_at || proc.createdAt || proc.fecha_creacion || proc.date;
    if (fallback) {
      try {
        const d = new Date(fallback);
        if (!isNaN(d.getTime())) {
          const texto = new Intl.DateTimeFormat('es-CL', {
            timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric'
          }).format(d).replace(/\//g, '-');
          const valorFiltro = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(d);
          return { texto, valorFiltro };
        }
      } catch(e) {}
    }
    return { texto: 'Sin fecha', valorFiltro: '' };
  };
  const obtenerParametrosProceso = proceso => {
    const snapshot = proceso?.parametrosSnapshot || proceso?.parametros_snapshot || {};
    return {
      calidad: Array.isArray(snapshot.calidad) && snapshot.calidad.length ? snapshot.calidad : parametrosActuales.calidad,
      condicion: Array.isArray(snapshot.condicion) && snapshot.condicion.length ? snapshot.condicion : parametrosActuales.condicion
    };
  };
  const obtenerCatalogoProceso = proceso => {
    const params = obtenerParametrosProceso(proceso);
    const calidad = params.calidad.filter(p => p?.nombre && p.nombre !== SUM_CALIDAD);
    const condicion = params.condicion.filter(p => p?.nombre && p.nombre !== SUM_CONDICION);
    const nombresCalidad = [...new Set([
      ...calidad.map(p => p.nombre),
      ...(proceso?.cajas || []).flatMap(c => Object.keys(c?.defCalidad || {}))
    ])];
    const nombresCondicion = [...new Set([
      ...condicion.map(p => p.nombre),
      ...(proceso?.cajas || []).flatMap(c => Object.keys(c?.defCondicion || {}))
    ])];
    return { params, calidad, condicion, nombresCalidad, nombresCondicion };
  };
  const calcularMetricas = proceso => {
    if (!proceso) return { pExp: '100,0', pExpNum: 100, pCal: '0.0', pCond: '0.0', nota: '-', estado: 'Aprobado', promLight: '0,0', promDark: '0,0', acumuladoFrutos: 0 };
    const { params, calidad, condicion } = obtenerCatalogoProceso(proceso);
    const cajas = Array.isArray(proceso.cajas) ? proceso.cajas : [];
    let totalFrutos = 0, totalCal = 0, totalCond = 0;
    let sumBrixLight = 0, countBrixLight = 0, sumBrixDark = 0, countBrixDark = 0;
    const agregadoCal = {}, agregadoCond = {};
    cajas.forEach(c => {
      if (!c) return;
      totalFrutos += parseInt(c.frutos) || 0;
      Object.entries(c.defCalidad || {}).forEach(([nombre, valor]) => {
        const v = parseInt(valor) || 0;
        totalCal += v;
        agregadoCal[nombre] = (agregadoCal[nombre] || 0) + v;
      });
      Object.entries(c.defCondicion || {}).forEach(([nombre, valor]) => {
        const v = parseInt(valor) || 0;
        totalCond += v;
        agregadoCond[nombre] = (agregadoCond[nombre] || 0) + v;
      });
      const brix = parseFloat(c.brix);
      if (brix > 0 && c.color === 'Light') { sumBrixLight += brix; countBrixLight++; }
      if (brix > 0 && c.color === 'Dark') { sumBrixDark += brix; countBrixDark++; }
    });
    const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
    const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
    const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;
    let nivelCalidad = 1, nivelCondicion = 1;
    const sumCal = params.calidad.find(p => p.nombre === SUM_CALIDAD);
    const sumCond = params.condicion.find(p => p.nombre === SUM_CONDICION);
    const tieneParametros = !!(sumCal && sumCond);
    if (totalFrutos > 0 && tieneParametros) {
      nivelCalidad = Math.max(nivelCalidad, nivelPorLimite(pCal, numeroParametro(sumCal.limAB), numeroParametro(sumCal.limBC)));
      calidad.forEach(p => {
        const pct = ((agregadoCal[p.nombre] || 0) / totalFrutos) * 100;
        nivelCalidad = Math.max(nivelCalidad, nivelPorLimite(pct, numeroParametro(p.limAB), numeroParametro(p.limBC)));
      });
      nivelCondicion = Math.max(nivelCondicion, nivelPorLimite(pCond, numeroParametro(sumCond.lim12), numeroParametro(sumCond.lim23)));
      condicion.forEach(p => {
        const pct = ((agregadoCond[p.nombre] || 0) / totalFrutos) * 100;
        nivelCondicion = Math.max(nivelCondicion, nivelPorLimite(pct, numeroParametro(p.lim12), numeroParametro(p.lim23)));
      });
    }
    const notaCalculada = totalFrutos && tieneParametros
      ? `${nivelCalidad === 3 ? 'C' : nivelCalidad === 2 ? 'B' : 'A'}${nivelCondicion}`
      : '-';
    const notaGuardada = /^[ABC][123]$/.test(String(proceso.estado || '')) ? proceso.estado : '-';
    const nota = notaCalculada !== '-' ? notaCalculada : notaGuardada;
    const objetado = nota !== '-' && (nota.startsWith('C') || nota.endsWith('3'));
    const estado = proceso.estado === 'En curso' ? 'En curso' : proceso.estado === 'Cancelado' ? 'Cancelado' : objetado ? 'Objetado' : 'Aprobado';
    return {
      pExp: pExp.toFixed(1).replace('.', ','), pExpNum: pExp,
      pCal: pCal.toFixed(1), pCond: pCond.toFixed(1), nota, estado,
      promLight: countBrixLight ? (sumBrixLight / countBrixLight).toFixed(1).replace('.', ',') : '0,0',
      promDark: countBrixDark ? (sumBrixDark / countBrixDark).toFixed(1).replace('.', ',') : '0,0',
      acumuladoFrutos: totalFrutos
    };
  };
  const calcularTotalesCaja = (caja) => {
    if (!caja) return { tCal: 0, tCond: 0, pCal: '0.0', pCond: '0.0', pExp: '100.0' };
    const tCal = Object.values(caja.defCalidad || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const tCond = Object.values(caja.defCondicion || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const f = parseInt(caja.frutos) || 0;
    const pCal = f ? ((tCal / f) * 100).toFixed(1) : '0.0';
    const pCond = f ? ((tCond / f) * 100).toFixed(1) : '0.0';
    const pExp = f ? Math.max(0, 100 - (tCal / f) * 100 - (tCond / f) * 100).toFixed(1) : '100.0';
    return { tCal, tCond, pCal, pCond, pExp };
  };
  // ================= FUNCIONES PARA INFORME PDF Y VISTA PREVIA =================
  const obtenerDatosInforme = async proceso => {
    if (!proceso) throw new Error('No se encontro el proceso para preparar el informe.');
    const id = proceso.id || proceso._id;
    // La identidad se resuelve ANTES de montar la vista previa o el PDF.
    const plantaInforme = await obtenerPlantaInforme();
    validarPlantaDatosInforme(proceso, plantaInforme);
    let datosCompletos = proceso;
    try {
      const res = await fetch(`${API_URL}/api/procesos/${id}/informe`, { cache: 'no-store', redirect: 'error' });
      if (res.ok) {
        const detalle = await res.json();
        datosCompletos = { ...proceso, ...detalle, id: proceso.id || detalle.proceso_id, fotoLight: detalle.fotoLight || null, fotoDark: detalle.fotoDark || null };
      }
    } catch (_) {
      // Se conserva el respaldo con los datos de la lista si falla el detalle.
    }
    validarPlantaDatosInforme(datosCompletos, plantaInforme);
    const snapshot = datosCompletos.parametrosSnapshot || datosCompletos.parametros_snapshot || null;
    // Mismo criterio que PlantillaInforme: no reemplazar el snapshot historico.
    const tieneSnapshot = !!(snapshot?.calidad?.length || snapshot?.condicion?.length);
    const parametrosInforme = tieneSnapshot ? null : await obtenerParametrosInforme();
    return {
      ...datosCompletos,
      planta: plantaInforme.plantaNombre,
      plantaId: plantaInforme.plantaId,
      plantaNombre: plantaInforme.plantaNombre,
      // Solo para renderizar este informe; no se guarda ni se envia a PostgreSQL.
      parametrosInforme,
    };
  };
  const abrirVistaPrevia = async (procesoId) => {
    setCargandoVistaPreviaId(procesoId);
    try {
      const procesoEncontrado = procesos.find(p => p.id === procesoId || p._id === procesoId);
      setZoomVistaPrevia(window.innerWidth < 640 ? Math.min(0.42, Math.max(0.28, (window.innerWidth - 38) / 816)) : 1);
      setDatosVistaPrevia(await obtenerDatosInforme(procesoEncontrado));
    } catch (error) {
      setDatosVistaPrevia(null);
      console.error('Error preparando la vista previa:', error);
      alert(`No se pudo abrir el informe: ${error.message}`);
    } finally { setCargandoVistaPreviaId(null); }
  };
  const distanciaDedos = touches => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX, dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const iniciarPinch = e => {
    if (e.touches?.length !== 2) return;
    pinchDistanciaRef.current = distanciaDedos(e.touches);
    pinchZoomRef.current = zoomVistaPrevia;
  };
  const moverPinch = e => {
    if (e.touches?.length !== 2 || !pinchDistanciaRef.current) return;
    e.preventDefault();
    const factor = distanciaDedos(e.touches) / pinchDistanciaRef.current;
    setZoomVistaPrevia(Math.min(1.8, Math.max(0.28, pinchZoomRef.current * factor)));
  };
  const terminarPinch = () => { pinchDistanciaRef.current = null; };
  const descargarPDF = async (procesoId) => {
    setGenerandoReporteId(procesoId);
    try {
      const procesoEncontrado = procesos.find(p => p.id === procesoId || p._id === procesoId);
      const datosCompletos = await obtenerDatosInforme(procesoEncontrado);
      setDatosReporte(datosCompletos);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!reporteRef.current) throw new Error("El componente PDF no se pudo montar.");
      if (document.fonts?.ready) await document.fonts.ready;
      const imagenes = Array.from(reporteRef.current.querySelectorAll('img'));
      await Promise.all(imagenes.map(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await html2canvas(reporteRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
        removeContainer: true,
        width: 816,
        height: 1056,
        windowWidth: 816,
        windowHeight: 1056
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter', compress: true, precision: 16 });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const margenX = pdfWidth * 0.04;
      const margenY = pdfPageHeight * 0.04;
      const anchoDisponible = pdfWidth - (margenX * 2);
      const altoDisponible = pdfPageHeight - (margenY * 2);
      const escala = Math.min(anchoDisponible / canvas.width, altoDisponible / canvas.height);
      const anchoInforme = canvas.width * escala;
      const altoInforme = canvas.height * escala;
      const posX = (pdfWidth - anchoInforme) / 2;
      const posY = (pdfPageHeight - altoInforme) / 2;
      pdf.addImage(imgData, 'PNG', posX, posY, anchoInforme, altoInforme);
      const nombreProceso = limpiarNombreArchivo(datosCompletos.numProceso || procesoEncontrado?.numProceso || procesoId);
      const nombreHuerto = limpiarNombreArchivo(datosCompletos.huerto || datosCompletos.productor || procesoEncontrado?.huerto || procesoEncontrado?.productor || 'Sin huerto');
      // '：' tiene aspecto de dos puntos, pero es válido como carácter de archivo en Windows.
      pdf.save(`Informe de calidad, proceso N°${nombreProceso}, Huerto：${nombreHuerto}.pdf`);
    } catch (error) {
      console.error("Error exacto al generar PDF:", error);
      alert(`Error técnico: ${error.message}`);
    } finally {
      setDatosReporte(null);
      setGenerandoReporteId(null);
      setMenuProcesoAbiertoId(null);
    }
  };
  const abrirEdicionProceso = (proceso) => {
    if (!proceso) return;
    const idFotos = proceso.id || proceso._id;
    // La lista /api/inspecciones no incluye las imágenes completas; consultamos
    // solo el estado al abrir edición para no descargar fotos de todos los procesos.
    setFotosEdicion({ procesoId: idFotos, light: false, dark: false, cargando: true, error: '' });
    fetch(`${API_URL}/api/procesos/${idFotos}/informe`, { cache: 'no-store' })
      .then(async respuesta => {
        if (!respuesta.ok) throw new Error(`No se pudieron consultar las fotografías (HTTP ${respuesta.status}).`);
        return respuesta.json();
      })
      .then(datos => setFotosEdicion(actual => actual.procesoId !== idFotos ? actual : {
        procesoId: idFotos, light: Boolean(datos.fotoLight), dark: Boolean(datos.fotoDark), cargando: false, error: ''
      }))
      .catch(error => setFotosEdicion(actual => actual.procesoId !== idFotos ? actual : {
        ...actual, cargando: false, error: error.message || 'No se pudo cargar el estado de las fotografías.'
      }));
    const listaCajas = Array.isArray(proceso.cajas) ? proceso.cajas : [];
    const { nombresCalidad, nombresCondicion } = obtenerCatalogoProceso(proceso);
    const cajasNormalizadas = listaCajas.map((c, i) => ({
      numCaja: i + 1,
      frutos: c?.frutos ?? '100', calibre: c?.calibre || '', tempPulpa: c?.tempPulpa ?? '', color: c?.color || '', brix: c?.brix ?? '', observacion: c?.observacion || '', usuarioId: c?.usuarioId || null, usuario: nombreUsuarioCaja(c),
      defCalidad: completarMapa(c?.defCalidad, nombresCalidad),
      defCondicion: completarMapa(c?.defCondicion, nombresCondicion)
    }));
    setProcesoEnEdicion({
      ...proceso,
      numProceso: proceso.numProceso || '',
      exportadora: proceso.exportadora || '',
      csg: proceso.csg || '',
      productor: proceso.productor || '',
      huerto: proceso.huerto || '',
      variedad: proceso.variedad || '',
      cajas: cajasNormalizadas.length ? cajasNormalizadas : [{
        numCaja: 1, esNuevaCaja: true, frutos: '100', calibre: '', tempPulpa: '', color: '', brix: '', observacion: '', usuarioId: usuarioId || null, usuario: usuarioNombre || 'Edición historial',
        defCalidad: crearMapaDefectos(nombresCalidad), defCondicion: crearMapaDefectos(nombresCondicion)
      }]
    });
    setVistaActual('editar');
    setMenuProcesoAbiertoId(null);
  };
  const cerrarEdicion = () => {
    setProcesoEnEdicion(null);
    setCajaIndexEditandoModal(null);
    setVistaActual('lista');
  };
  const guardarCambiosProceso = async () => {
    if (!procesoEnEdicion) return;
    const metricas = calcularMetricas(procesoEnEdicion);
    const invalida = (procesoEnEdicion.cajas || []).find(c => c.tempPulpa != null && String(c.tempPulpa).trim() !== '' && leerTempPulpa(c.tempPulpa) === null);
    if (invalida) return alert('Hay una Temp pulpa no válida. Utiliza números con hasta dos decimales.');
    const nuevaSinTemp = (procesoEnEdicion.cajas || []).some(c => c.esNuevaCaja && leerTempPulpa(c.tempPulpa) === null);
    if (nuevaSinTemp) return alert('Registra Temp pulpa (°C) en las cajas nuevas antes de guardar.');
    try {
      const payload = {
        numProceso: procesoEnEdicion.numProceso,
        exportadora: procesoEnEdicion.exportadora,
        csg: procesoEnEdicion.csg,
        variedad: procesoEnEdicion.variedad,
        estado: metricas.nota !== '-' ? metricas.nota : procesoEnEdicion.estado,
        cajas: (procesoEnEdicion.cajas || []).map(({ esNuevaCaja, ...c }) => c),
        productor: procesoEnEdicion.productor,
        huerto: procesoEnEdicion.huerto
      };
      const response = await fetch(`${API_URL}/api/inspecciones/${procesoEnEdicion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        alert("¡Proceso e inspecciones actualizados exitosamente!");
        cerrarEdicion();
        cargarDatos();
      } else {
        const data = await response.json().catch(() => ({}));
        alert("❌ Error al guardar: " + (data.error || "No se pudo actualizar el proceso."));
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error de conexión al servidor backend.");
    }
  };
  const handleCSGChange = (codigoCsg) => {
    const encontrado = huertos.find(h => h.csg === codigoCsg);
    setProcesoEnEdicion(prev => ({
      ...prev,
      csg: codigoCsg,
      productor: encontrado ? encontrado.productor : prev.productor,
      huerto: encontrado ? (encontrado.huerto || encontrado.nombre) : prev.huerto
    }));
  };
  const handleCajaCampoModalChange = (campo, valor) => {
    if (cajaIndexEditandoModal === null) return;
    setProcesoEnEdicion(prev => {
      const nuevasCajas = [...prev.cajas];
      nuevasCajas[cajaIndexEditandoModal] = {
        ...nuevasCajas[cajaIndexEditandoModal],
        [campo]: valor
      };
      return { ...prev, cajas: nuevasCajas };
    });
  };
  const handleDefectoModalChange = (tipoDef, defectoNombre, valor) => {
    if (cajaIndexEditandoModal === null) return;
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setProcesoEnEdicion(prev => {
      const nuevasCajas = [...prev.cajas];
      const caja = nuevasCajas[cajaIndexEditandoModal];
      nuevasCajas[cajaIndexEditandoModal] = {
        ...caja,
        [tipoDef]: {
          ...(caja[tipoDef] || {}),
          [defectoNombre]: val
        }
      };
      return { ...prev, cajas: nuevasCajas };
    });
  };
  const agregarNuevaCaja = () => {
    let nuevoIndex = 0;
    setProcesoEnEdicion(prev => {
      const listaPrev = Array.isArray(prev?.cajas) ? prev.cajas : [];
      const { nombresCalidad, nombresCondicion } = obtenerCatalogoProceso(prev);
      nuevoIndex = listaPrev.length;
      const nuevaCaja = {
        numCaja: listaPrev.length + 1, esNuevaCaja: true, frutos: '100', calibre: '', tempPulpa: '', color: '', brix: '', observacion: '', usuarioId: usuarioId || null, usuario: usuarioNombre || 'Edición historial',
        defCalidad: crearMapaDefectos(nombresCalidad), defCondicion: crearMapaDefectos(nombresCondicion)
      };
      return { ...prev, cajas: [...listaPrev, nuevaCaja] };
    });
    setCajaIndexEditandoModal(procesoEnEdicion?.cajas?.length || nuevoIndex);
    setTabDefectosModal('calidad');
  };
  const eliminarCaja = (index) => {
    const listaCajas = Array.isArray(procesoEnEdicion?.cajas) ? procesoEnEdicion.cajas : [];
    if (listaCajas.length <= 1) return alert("El proceso debe contener al menos una caja.");
    if (!window.confirm(`¿Eliminar Caja N° ${listaCajas[index]?.numCaja || index + 1}?`)) return;
    setProcesoEnEdicion(prev => {
      const filtradas = (prev.cajas || []).filter((_, i) => i !== index);
      const reordenadas = filtradas.map((c, i) => ({ ...c, numCaja: i + 1 }));
      return { ...prev, cajas: reordenadas };
    });
    if (cajaIndexEditandoModal === index) setCajaIndexEditandoModal(null);
  };
  const solicitarEliminarProceso = (proceso) => {
    if (!puedeEliminar) return;
    setProcesoAEliminar(proceso);
    setMenuProcesoAbiertoId(null);
  };
  const ejecutarEliminacionProceso = async () => {
    if (!procesoAEliminar || !puedeEliminar) return;
    const id = procesoAEliminar.id || procesoAEliminar._id;
    try {
      const response = await fetch(`${API_URL}/api/inspecciones/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioId }) });
      if (response.ok) {
        setProcesos(prev => prev.filter(p => (p.id || p._id) !== id));
        if (procesoSeleccionado?.id === id) setProcesoSeleccionado(null);
        setProcesoAEliminar(null);
      } else {
        const data = await response.json().catch(() => ({}));
        alert("❌ Error del servidor: " + (data.error || "No se pudo eliminar."));
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error de conexión al intentar eliminar el proceso.');
    }
  };
  // Exporta todos los procesos del servidor, incluidos los fuera de la página o filtros activos.
  // El backend de cada planta determina los datos: no se mezclan instalaciones.
  const exportarHistorialCompletoExcel = async () => {
    if (exportandoExcel) return;
    setExportandoExcel(true);
    try {
      const [respuesta, planta] = await Promise.all([
        fetch(`${API_URL}/api/inspecciones`, { cache: 'no-store' }),
        obtenerPlantaInforme(),
      ]);
      if (!respuesta.ok) throw new Error(`No se pudo obtener el historial completo (HTTP ${respuesta.status}).`);
      const lista = await respuesta.json();
      if (!Array.isArray(lista)) throw new Error('El servidor no devolvió una lista válida de procesos.');
      if (!lista.length) throw new Error('No existen procesos para exportar en esta planta.');
      lista.forEach(proceso => validarPlantaDatosInforme(proceso, planta));
      const procesosOrdenados = [...lista].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      const registrosProcesos = [];
      const registrosCajas = [];
      const registrosDefectos = [];
      const convertirNumero = valor => {
        const numero = Number(String(valor ?? '').replace(',', '.'));
        return Number.isFinite(numero) ? numero : null;
      };
      const contar = valores => Object.values(valores || {}).reduce((suma, cantidad) => suma + (parseInt(cantidad, 10) || 0), 0);
      const formatearHoraChile = valor => {
        if (!valor) return '';
        const fecha = new Date(valor);
        return Number.isNaN(fecha.getTime()) ? '' : new Intl.DateTimeFormat('es-CL', {
          timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(fecha);
      };
      procesosOrdenados.forEach(proceso => {
        const cajasProceso = Array.isArray(proceso.cajas) ? proceso.cajas : [];
        const fechaProceso = obtenerFechaProceso(proceso).texto;
        const metricas = calcularMetricas(proceso);
        const frutos = cajasProceso.reduce((suma, caja) => suma + (parseInt(caja?.frutos, 10) || 0), 0);
        const identificador = convertirNumero(proceso.numProceso) ?? String(proceso.numProceso || '');
        registrosProcesos.push([
          identificador, fechaProceso, metricas.estado, metricas.nota,
          proceso.exportadora || '', proceso.csg || '', proceso.productor || '', proceso.huerto || '',
          proceso.variedad || '', cajasProceso.length, frutos,
          convertirNumero(metricas.pExpNum), convertirNumero(metricas.pCal), convertirNumero(metricas.pCond),
          convertirNumero(metricas.promLight), convertirNumero(metricas.promDark),
          formatearHoraChile(proceso.horaInicio), formatearHoraChile(proceso.horaFin),
          convertirNumero(proceso.id) ?? '',
        ]);
        cajasProceso.forEach((caja, indice) => {
          const totalCalidad = contar(caja.defCalidad);
          const totalCondicion = contar(caja.defCondicion);
          const muestra = parseInt(caja.frutos, 10) || 0;
          const porcentajeExportable = muestra
            ? Math.max(0, 100 - (totalCalidad / muestra) * 100 - (totalCondicion / muestra) * 100)
            : null;
          const numeroCaja = Number(caja.numCaja) || indice + 1;
          registrosCajas.push([
            identificador, fechaProceso, numeroCaja, caja.usuario || caja.usuarioNombre || 'Sin registro',
            muestra, caja.calibre || '', caja.tempPulpa == null || String(caja.tempPulpa).trim() === '' ? '' : convertirNumero(caja.tempPulpa), caja.color || '', convertirNumero(caja.brix),
            totalCalidad, totalCondicion,
            porcentajeExportable === null ? null : Number(porcentajeExportable.toFixed(1)),
            String(caja.observacion || ''),
          ]);
          [['Calidad', caja.defCalidad], ['Condición', caja.defCondicion]].forEach(([tipo, defectos]) => {
            Object.entries(defectos || {}).forEach(([nombre, cantidadRaw]) => {
              if (nombre === SUM_CALIDAD || nombre === SUM_CONDICION) return;
              const cantidad = parseInt(cantidadRaw, 10) || 0;
              if (cantidad <= 0) return;
              registrosDefectos.push([
                identificador, fechaProceso, numeroCaja, tipo, nombre, cantidad,
                muestra ? Number(((cantidad / muestra) * 100).toFixed(2)) : null,
              ]);
            });
          });
        });
      });
      const libro = crearLibroExcelHistorial([
        {
          nombre: 'Procesos',
          encabezados: ['N° proceso', 'Fecha', 'Estado', 'Calificación', 'Exportadora', 'CSG', 'Productor', 'Huerto', 'Variedad', 'Cajas', 'Frutos evaluados', '% Exportable', '% Calidad', '% Condición', 'SS Light (°Bx)', 'SS Dark (°Bx)', 'Hora inicio', 'Hora fin', 'ID BD'],
          filas: registrosProcesos,
        },
        {
          nombre: 'Cajas',
          encabezados: ['N° proceso', 'Fecha', 'N° caja', 'Inspector', 'Frutos evaluados', 'Calibre', 'Temp pulpa (°C)', 'Embalaje', '°Brix', 'Def. calidad', 'Def. condición', '% Exportable', 'Observación'],
          filas: registrosCajas,
        },
        {
          nombre: 'Defectos',
          encabezados: ['N° proceso', 'Fecha', 'N° caja', 'Categoría', 'Defecto', 'Cantidad', '% Muestra caja'],
          filas: registrosDefectos,
        },
      ]);
      const hoy = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const nombre = `EVAP_Historial_Completo_${planta.plantaId}_${hoy}.xlsx`;
      const url = URL.createObjectURL(libro);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setProcesos([...lista].reverse());
      setUltimaSincronizacion(new Date());
      setErrorSincronizacion('');
    } catch (error) {
      console.error('No se pudo exportar el historial Excel:', error);
      alert(error.message || 'No fue posible generar el archivo Excel.');
    } finally {
      setExportandoExcel(false);
    }
  };
  const temporadasDisponibles = [...new Set(procesos.map(proceso => obtenerFechaProceso(proceso).valorFiltro.slice(0, 4)).filter(anio => /^\d{4}$/.test(anio)))].sort((a, b) => Number(b) - Number(a));
  const filtrados = procesos.filter(p => {
    if (!p) return false;
    if (esMovil) {
      const buscar = busquedaMovil.trim().toLocaleLowerCase('es-CL');
      if (buscar && ![p.numProceso, p.csg, p.huerto, p.productor, p.exportadora, p.variedad]
        .some(valor => String(valor ?? '').toLocaleLowerCase('es-CL').includes(buscar))) return false;
    } else {
      const numP = (p.numProceso || '').toString().toLowerCase();
      const queryNumP = filtroNumProceso.toLowerCase();
      if (queryNumP && !numP.includes(queryNumP)) return false;
      const csgStr = (p.csg || '').toLowerCase();
      const prodStr = (p.productor || '').toLowerCase();
      const huertoStr = (p.huerto || '').toLowerCase();
      const queryHuerto = filtroCsgHuerto.toLowerCase();
      if (queryHuerto && !csgStr.includes(queryHuerto) && !prodStr.includes(queryHuerto) && !huertoStr.includes(queryHuerto)) return false;
    }
    if (filtroVariedad && p.variedad !== filtroVariedad) return false;
    if (filtroTemporada && !obtenerFechaProceso(p).valorFiltro.startsWith(filtroTemporada)) return false;
    if (filtroFecha) {
      const fechaInfo = obtenerFechaProceso(p);
      if (fechaInfo.valorFiltro !== filtroFecha) return false;
    }
    if (filtroCalificacion) {
      const met = calcularMetricas(p);
      if (met.nota !== filtroCalificacion) return false;
    }
    return true;
  });
  const totalPaginas = Math.ceil(filtrados.length / procesosPorPagina) || 1;
  const procesosPaginados = filtrados.slice((paginaActual - 1) * procesosPorPagina, paginaActual * procesosPorPagina);
  const filasVaciasPagina = Math.max(0, procesosPorPagina - procesosPaginados.length);
  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas);
  }, [paginaActual, totalPaginas]);
  const estadoSincronizacionTexto = cargando ? 'Sincronizando...' : errorSincronizacion ? 'Error de sincronización' : 'Sincronizado';
  const horaUltimaSincronizacion = ultimaSincronizacion ? new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(ultimaSincronizacion) : null;
  const obtenerBadgeCalificacion = (nota, estado) => {
    if (estado === 'En curso' || estado === 'Cancelado' || !nota || nota === '-') {
      return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
    if (nota === 'A1') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if (nota === 'A2') return 'bg-sky-100 text-sky-700 border border-sky-200';
    if (nota === 'B1') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-red-100 text-red-700 border border-red-200';
  };
  const obtenerBadgeVariedad = variedad => {
    const valor = String(variedad || '').toLowerCase();
    if (valor === 'kordia') return 'bg-violet-50 text-violet-600 border border-violet-100';
    if (valor === 'lapins') return 'bg-pink-50 text-pink-700 border border-pink-100';
    if (valor === 'regina') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (valor === 'santina') return 'bg-sky-50 text-sky-600 border border-sky-100';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };
  const obtenerColorExportable = valor => {
    const numero = Number(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(numero)) return { barra: 'bg-slate-300', texto: 'text-slate-600' };
    if (numero >= 90) return { barra: 'bg-emerald-600', texto: 'text-slate-900' };
    if (numero >= 80) return { barra: 'bg-sky-600', texto: 'text-slate-900' };
    if (numero >= 65) return { barra: 'bg-amber-600', texto: 'text-slate-900' };
    return { barra: 'bg-red-600', texto: 'text-slate-900' };
  };
  const construirPaginas = (actual, total) => {
    if (total <= 1) return [1];
    const paginas = new Set([1, total, actual, actual - 1, actual + 1, 2, total - 1]);
    return Array.from(paginas).filter(n => n >= 1 && n <= total).sort((a, b) => a - b)
      .reduce((acc, n) => {
        if (acc.length && n - acc[acc.length - 1] > 1) acc.push('...');
        acc.push(n);
        return acc;
      }, []);
  };
  const paginasVisibles = construirPaginas(paginaActual, totalPaginas);
  const colorExportableMovil = valor => {
    if (valor < 80) return 'bg-red-500';
    if (valor <= 85) return 'bg-amber-500';
    return 'bg-emerald-500';
  };
  const horaProcesoMovil = valor => {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(fecha);
  };
  const hayFiltrosAvanzados = Boolean(filtroTemporada || filtroVariedad || filtroFecha || filtroCalificacion);
  const limpiarFiltrosMoviles = () => {
    setFiltroTemporada('');
    setFiltroVariedad('');
    setFiltroFecha('');
    setFiltroCalificacion('');
  };
  const cambiarPaginaMovil = pagina => {
    setPaginaActual(pagina);
    setMenuProcesoAbiertoId(null);
    setConfirmacionResumenMovilId(null);
    listaMovilRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // ================= VISTA 1: LISTA PRINCIPAL =================
  if (vistaActual === 'lista') {
    return (
      <div
        className="w-full h-full bg-[#f8faff] md:bg-slate-50 p-0 md:p-6 xl:p-8 overflow-y-auto animate-fade-in font-sans relative"
        onClick={() => { setMenuProcesoAbiertoId(null); setConfirmacionResumenMovilId(null); }}
      >
        <style>{`
          @keyframes evapFilaEntrada { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes evapBarraEntrada { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          .evap-historial-fila { animation: evapFilaEntrada 350ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .evap-historial-barra { transform-origin: left center; animation: evapBarraEntrada 800ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .evap-historial-fila > td { transition: background-color 160ms ease, box-shadow 160ms ease; }
          .evap-historial-fila:hover > td { background-color: #fff0d8; }
          .evap-historial-fila:hover > td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
          @keyframes evapTarjetaMovil { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes evapBarraMovil { from { transform: scaleX(0); } to { transform: scaleX(1); } }
          @keyframes evapRadarMovil { 75%, 100% { transform: scale(2); opacity: 0; } }
          .evap-tarjeta-movil { animation: evapTarjetaMovil 400ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .evap-barra-movil { transform-origin: left center; animation: evapBarraMovil 800ms cubic-bezier(0.4, 0, 0.2, 1) both; }
          .evap-radar-movil { animation: evapRadarMovil 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
          @media (prefers-reduced-motion: reduce) {
            .evap-historial-fila, .evap-historial-barra, .evap-tarjeta-movil, .evap-barra-movil, .evap-radar-movil { animation: none !important; transition: none !important; }
          }
        `}</style>
        {/* Vista móvil: independiente del diseño de escritorio, comparte sus datos y acciones. */}
        <div className="md:hidden mx-auto max-w-md min-h-full pb-8" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }} onClick={(e) => { e.stopPropagation(); setMenuProcesoAbiertoId(null); setConfirmacionResumenMovilId(null); }}>
          <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f8faff]/95 px-4 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAbrirMenu?.(); }}
                aria-label="Abrir menú lateral"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight text-slate-900">Historial de procesos</h1>
            </div>
          </header>

          <div className="space-y-3 px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busquedaMovil}
                onChange={e => setBusquedaMovil(e.target.value)}
                placeholder="Buscar N° proceso, huerto o productor..."
                aria-label="Buscar procesos"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-[13px] font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              {busquedaMovil && (
                <button
                  type="button"
                  onClick={() => setBusquedaMovil('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-start">
              <button
                type="button"
                onClick={() => { setMostrarFiltrosAvanzados(v => !v); setMenuProcesoAbiertoId(null); setConfirmacionResumenMovilId(null); }}
                aria-expanded={mostrarFiltrosAvanzados}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold shadow-sm transition-all active:scale-95 ${mostrarFiltrosAvanzados ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                Filtros
                <span className={`h-2 w-2 rounded-full ${hayFiltrosAvanzados ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'}`}></span>
              </button>
            </div>

            {mostrarFiltrosAvanzados && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xs font-bold text-slate-800">Filtrar historial</h2>
                  <button type="button" onClick={limpiarFiltrosMoviles} disabled={!hayFiltrosAvanzados} className="text-[11px] font-semibold text-amber-700 disabled:opacity-40">Limpiar filtros</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 text-[11px] font-semibold text-slate-500">
                    Temporada
                    <select value={filtroTemporada} onChange={e => setFiltroTemporada(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-amber-500">
                      <option value="">Todas las temporadas</option>
                      {temporadasDisponibles.map(anio => <option key={anio} value={anio}>Temporada {anio}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Variedad
                    <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="mt-1 block h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-amber-500">
                      <option value="">Todas</option>
                      {variedades.map((v, i) => <option key={v.id || i} value={v.nombre || v}>{v.nombre || v}</option>)}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-slate-500">
                    Calificación
                    <select value={filtroCalificacion} onChange={e => setFiltroCalificacion(e.target.value)} className="mt-1 block h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-amber-500">
                      <option value="">Todas</option>
                      {['A1','A2','A3','B1','B2','B3','C1','C2','C3'].map(nota => <option key={nota} value={nota}>{nota}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 text-[11px] font-semibold text-slate-500">
                    Fecha de proceso
                    <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-amber-500" />
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"></span>
                <span className="truncate">{filtrados.length} procesos registrados</span>
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={cargarDatos}
                  disabled={cargando}
                  className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                  aria-label="Actualizar historial"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-amber-400 transition-transform duration-500 ${cargando ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                  {cargando ? 'Cargando' : 'Actualizar'}
                  {!cargando && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>}
                </button>
                {esAdministrador && (
                  <button
                    type="button"
                    onClick={exportarHistorialCompletoExcel}
                    disabled={exportandoExcel}
                    aria-label="Exportar historial completo a Excel"
                    title="Exportar todos los procesos de la planta a Excel"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                  >
                    {exportandoExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            {errorSincronizacion && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorSincronizacion}</p>
            )}
          </div>

          <main ref={listaMovilRef} className="scroll-mt-[72px] space-y-2.5 px-4 pt-3">
            {cargando && procesos.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-9 text-center text-xs font-medium text-slate-500">Sincronizando procesos con PostgreSQL...</div>
            ) : procesosPaginados.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-9 text-center text-xs font-medium text-slate-500">No se encontraron procesos con esos filtros.</div>
            ) : procesosPaginados.map((proc, index) => {
              const id = proc.id || proc._id;
              const metricas = calcularMetricas(proc);
              const isEnCurso = metricas.estado === 'En curso';
              const isCancelado = metricas.estado === 'Cancelado';
              const notaVisible = isCancelado ? '—' : metricas.nota;
              const fechaData = obtenerFechaProceso(proc);
              const badgeNota = obtenerBadgeCalificacion(notaVisible, isEnCurso ? 'Aprobado' : metricas.estado);
              const badgeVariedad = obtenerBadgeVariedad(proc.variedad);
              const hora = horaProcesoMovil(proc.horaInicio || proc.created_at || proc.createdAt);
              const menuAbierto = menuProcesoAbiertoId === id;
              const confirmarAbierto = confirmacionResumenMovilId === id;
              return (
                <article
                  key={`movil-${paginaActual}-${id || proc.numProceso}`}
                  className={`evap-tarjeta-movil relative rounded-[14px] border p-2.5 shadow-sm transition-colors duration-200 ${isEnCurso ? 'border-emerald-300 bg-emerald-50/80' : 'border-slate-200 bg-white'} ${menuAbierto || confirmarAbierto ? 'z-40' : 'z-0'}`}
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-extrabold leading-5 text-slate-900">Proceso N°: {proc.numProceso}</span>
                        {isCancelado && <span className="rounded-md border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">Cancelado</span>}
                        {!isEnCurso && !isCancelado && <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{fechaData.texto}</span>}
                      </div>
                      {isEnCurso && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                            <span className="relative flex h-2 w-2">
                              <span className="evap-radar-movil absolute inset-0 rounded-full bg-emerald-500/80"></span>
                              <span className="relative h-2 w-2 rounded-full bg-emerald-600"></span>
                            </span>
                            Inspección en curso
                          </span>
                          <span className="rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{fechaData.texto}</span>
                        </div>
                      )}
                      {isCancelado && <span className="mt-1 block text-[10px] font-medium text-slate-400">{fechaData.texto}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {hora && <span className="text-[10px] font-medium text-slate-400">{hora} hrs</span>}
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Acciones del proceso ${proc.numProceso}`}
                          aria-expanded={menuAbierto}
                          onClick={(e) => { e.stopPropagation(); setMenuProcesoAbiertoId(menuAbierto ? null : id); setConfirmacionResumenMovilId(null); }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuAbierto && (
                          <div className="absolute right-0 top-8 z-50 w-56 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl" onClick={e => e.stopPropagation()}>
                            {puedeEditar && (
                              <button type="button" disabled={isEnCurso} onClick={() => abrirEdicionProceso(proc)} className="flex w-full items-center gap-2.5 px-3 py-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                                <Edit3 className="h-4 w-4 text-blue-600" /> Editar proceso {isEnCurso ? '(En curso)' : ''}
                              </button>
                            )}
                            <button type="button" disabled={isEnCurso || generandoReporteId === id} onClick={() => { setMenuProcesoAbiertoId(null); descargarPDF(id); }} className="flex w-full items-center gap-2.5 px-3 py-3 text-[12px] font-semibold text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40">
                              <Download className="h-4 w-4 text-emerald-600" /> {generandoReporteId === id ? 'Generando PDF...' : 'Descargar informe PDF'}
                            </button>
                            {puedeEliminar && (
                              <button type="button" disabled={isEnCurso} onClick={() => solicitarEliminarProceso(proc)} className="flex w-full items-center gap-2.5 px-3 py-3 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                                <Trash2 className="h-4 w-4" /> Eliminar proceso {isEnCurso ? '(En curso)' : ''}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`mt-2 flex items-center justify-between gap-2 border-t pt-2 ${isEnCurso ? 'border-emerald-200/80' : 'border-slate-100'}`}>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Huerto / Productor</span>
                      <p className="truncate text-[13px] font-extrabold uppercase leading-5 text-slate-900" title={proc.huerto || proc.productor || '-'}>{proc.huerto || proc.productor || '-'}</p>
                      <p className="truncate text-[11px] font-medium text-slate-500" title={proc.exportadora || 'Sin exportadora'}>Exportadora {proc.exportadora || '—'}</p>
                    </div>
                    <div className="flex max-w-[47%] shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeNota}`}>{notaVisible}</span>
                      <span className={`max-w-[92px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeVariedad}`}>{proc.variedad || '-'}</span>
                    </div>
                  </div>

                  <div className={`mt-2 flex items-center gap-3 border-t pt-2 ${isEnCurso ? 'border-emerald-200/80' : 'border-slate-100'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Exportable</span>
                        <span className="text-[12px] font-extrabold text-slate-900">{metricas.pExp}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                        <div className={`evap-barra-movil h-full rounded-full ${colorExportableMovil(metricas.pExpNum)}`} style={{ width: `${Math.max(0, Math.min(100, metricas.pExpNum || 0))}%`, animationDelay: `${index * 35 + 120}ms` }}></div>
                      </div>
                    </div>
                    <div className="min-w-[40px] text-center">
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Cajas</span>
                      <span className="block text-[14px] font-bold leading-5 text-slate-900">{Array.isArray(proc.cajas) ? proc.cajas.length : 0}</span>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmacionResumenMovilId(confirmarAbierto ? null : id); setMenuProcesoAbiertoId(null); }}
                        aria-label={`Ver informe resumen del proceso ${proc.numProceso}`}
                        aria-expanded={confirmarAbierto}
                        disabled={cargandoVistaPreviaId === id}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-sm transition-all hover:bg-[#1D4ED8] active:scale-95 disabled:cursor-wait disabled:opacity-60"
                      >
                        {cargandoVistaPreviaId === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {confirmarAbierto && (
                        <div
                          role="dialog"
                          aria-label={`Confirmar vista previa del proceso ${proc.numProceso}`}
                          className="absolute bottom-[46px] right-0 z-50 w-[240px] max-w-[calc(100vw-40px)] rounded-2xl border border-slate-200 bg-white p-3.5 text-left text-[12px] text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-start gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EA580C]">
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold leading-4 text-slate-800">
                                {isEnCurso ? 'Informe no disponible' : 'Ver resumen de inspección'}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                {isEnCurso ? 'Disponible cuando termine la inspección.' : '¿Deseas abrir el informe del proceso?'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmacionResumenMovilId(null)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cerrar
                            </button>
                            {!isEnCurso && (
                              <button
                                type="button"
                                onClick={() => { setConfirmacionResumenMovilId(null); abrirVistaPrevia(id); }}
                                className="rounded-lg bg-[#EA580C] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-[#C2410C]"
                              >
                                Ver informe
                              </button>
                            )}
                          </div>
                          <span className="pointer-events-none absolute -bottom-[5px] right-3 h-2.5 w-2.5 rotate-45 border-b border-r border-slate-200 bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </main>

          <footer className="space-y-2 px-4 pt-4">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="min-w-0 text-[11px] font-medium text-slate-500">
                Mostrando {filtrados.length ? (paginaActual - 1) * procesosPorPagina + 1 : 0}-{Math.min(paginaActual * procesosPorPagina, filtrados.length)} de {filtrados.length}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => cambiarPaginaMovil(Math.max(1, paginaActual - 1))} disabled={paginaActual === 1} aria-label="Página anterior" className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-white shadow-sm" aria-label={`Página ${paginaActual} de ${totalPaginas}`}>{paginaActual}</span>
                <button type="button" onClick={() => cambiarPaginaMovil(Math.min(totalPaginas, paginaActual + 1))} disabled={paginaActual === totalPaginas} aria-label="Página siguiente" className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:text-slate-300">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${errorSincronizacion ? 'bg-red-500' : cargando ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              {horaUltimaSincronizacion ? `Última sincronización: ${horaUltimaSincronizacion} hrs` : 'Esperando sincronización'}
            </p>
          </footer>
        </div>
        <div className="hidden md:flex max-w-7xl mx-auto flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-7 flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="w-1.5 h-8 rounded-full bg-amber-500 shrink-0"></div>
                  <h1 className="text-2xl md:text-[26px] font-extrabold tracking-tight text-slate-900">Historial de procesos finalizados</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${errorSincronizacion ? 'bg-red-50 text-red-700 border-red-200' : cargando ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${errorSincronizacion ? 'bg-red-500' : cargando ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                    {estadoSincronizacionTexto}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Módulo de gestión y revisión de procesos sincronizados</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                {esAdministrador && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exportarHistorialCompletoExcel(); }}
                    disabled={exportandoExcel}
                    className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                  >
                    {exportandoExcel ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <Download className="w-4 h-4 text-emerald-600 transition-transform duration-300 group-hover:translate-y-0.5" />}
                    {exportandoExcel ? 'Generando Excel...' : 'Exportar Planilla'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cargarDatos(); }}
                  disabled={cargando}
                  className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-md active:scale-[0.96] disabled:cursor-wait disabled:opacity-70"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-400 transition-transform duration-500 ${cargando ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                  {cargando ? 'Sincronizando...' : 'Sincronizar ahora'}
                </button>
              </div>
            </div>
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="relative xl:w-64 shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar N° proceso..."
                  value={filtroNumProceso}
                  onChange={(e) => setFiltroNumProceso(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar Huerto, CSG o Productor..."
                  value={filtroCsgHuerto}
                  onChange={(e) => setFiltroCsgHuerto(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <select
                value={filtroTemporada}
                onChange={e => setFiltroTemporada(e.target.value)}
                aria-label="Filtrar por año de temporada"
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Todas las temporadas</option>
                {temporadasDisponibles.map(anio => <option key={anio} value={anio}>Temporada {anio}</option>)}
              </select>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados); }}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all ${mostrarFiltrosAvanzados ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {(filtroVariedad || filtroFecha || filtroCalificacion) && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
              </button>
            </div>
            {mostrarFiltrosAvanzados && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 animate-fade-in">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Variedad</label>
                  <select value={filtroVariedad} onChange={e => setFiltroVariedad(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                    <option value="">Todas las variedades</option>
                    {variedades.map((v, i) => <option key={v.id || i} value={v.nombre || v}>{v.nombre || v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fecha de proceso</label>
                  <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Calificación</label>
                  <select value={filtroCalificacion} onChange={e => setFiltroCalificacion(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20">
                    <option value="">Todas las calificaciones</option>
                    {['A1','A2','A3','B1','B2','B3','C1','C2','C3'].map(nota => <option key={nota} value={nota}>{nota}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1280px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {['RESUMEN','FECHA','N° PROCESO','HUERTO','EXPORTADORA','CALIFICACIÓN','VARIEDAD','% EXPORTABLE','CAJAS','ACCIONES'].map((item) => (
                      <th key={item} className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700">
                  {cargando ? (
                    <tr>
                      <td colSpan="10" className="py-14 text-center text-sm font-medium text-slate-400">Sincronizando procesos con PostgreSQL...</td>
                    </tr>
                  ) : procesosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-14 text-center text-sm font-medium text-slate-400">No se encontraron procesos registrados con esos filtros.</td>
                    </tr>
                  ) : (
                    <>
                      {procesosPaginados.map((proc, index) => {
                        const metricas = calcularMetricas(proc);
                        const isSelected = procesoSeleccionado?.id === proc.id;
                        const fechaData = obtenerFechaProceso(proc);
                        const isEnCurso = metricas.estado === 'En curso';
                        const isCancelado = metricas.estado === 'Cancelado';
                        const badgeNota = obtenerBadgeCalificacion(metricas.nota, metricas.estado);
                        const badgeVariedad = obtenerBadgeVariedad(proc.variedad);
                        const colorExp = obtenerColorExportable(metricas.pExpNum);
                        const resumenNota = isEnCurso || isCancelado ? '—' : metricas.nota;
                        return (
                          <tr
                            key={`${paginaActual}-${proc.id || proc.numProceso}`}
                            onClick={() => setProcesoSeleccionado(proc)}
                            className={`evap-historial-fila group border-b border-slate-100 transition-colors duration-150 ${isSelected ? 'bg-amber-50/50' : 'bg-white'}`}
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            <td className="px-4 py-3 text-center align-middle">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isEnCurso) abrirVistaPrevia(proc.id);
                                }}
                                disabled={cargandoVistaPreviaId === proc.id || isEnCurso}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${isEnCurso ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300' : 'border-slate-200 bg-white text-slate-400 hover:scale-[1.08] hover:bg-slate-100 hover:text-slate-700'}`}
                                title={isEnCurso ? 'No disponible (En curso)' : 'Ver resumen'}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                {fechaData.texto}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[15px] font-bold text-slate-900">{proc.numProceso}</span>
                                {isCancelado && (
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">Cancelado</span>
                                )}
                                {isEnCurso && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    En curso
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <span className="text-[13px] font-bold uppercase tracking-tight text-slate-900">{proc.huerto || proc.productor || '-'}</span>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <span className="text-[12px] font-semibold uppercase text-slate-700">{proc.exportadora || '-'}</span>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${badgeNota}`}>
                                {resumenNota}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeVariedad}`}>
                                {proc.variedad || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center align-middle">
                              <div className="mx-auto flex w-20 flex-col items-center">
                                <span className={`text-[13px] font-bold ${colorExp.texto}`}>{metricas.pExp}%</span>
                                <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                  <div className={`evap-historial-barra h-full rounded-full ${colorExp.barra}`} style={{ width: `${Math.max(0, Math.min(100, metricas.pExpNum || 0))}%`, animationDelay: `${index * 40 + 120}ms` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center align-middle text-sm font-medium text-slate-900">
                              {proc.cajas ? proc.cajas.length : 0}
                            </td>
                            <td className="relative px-4 py-3 text-center align-middle">
                              <button type="button" onClick={(e) => alternarMenuEscritorio(e, proc.id)} aria-haspopup="menu" aria-expanded={menuProcesoAbiertoId === proc.id} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" title="Opciones del proceso">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {menuProcesoAbiertoId === proc.id && menuEscritorioPosicion && typeof document !== 'undefined' && createPortal(
                                <div
                                  ref={menuEscritorioRef}
                                  role="menu"
                                  aria-label={`Acciones del proceso ${proc.numProceso}`}
                                  className="fixed z-[200] flex w-64 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white text-left shadow-2xl divide-y divide-slate-100"
                                  style={{ top: menuEscritorioPosicion.top, left: menuEscritorioPosicion.left, maxHeight: 'calc(100dvh - 20px)' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {puedeEditar && (
                                    <button
                                      onClick={() => !isEnCurso && abrirEdicionProceso(proc)}
                                      disabled={isEnCurso}
                                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors ${isEnCurso ? 'cursor-not-allowed bg-slate-50 opacity-50' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                      <Edit3 className={`w-4 h-4 ${isEnCurso ? 'text-slate-400' : 'text-blue-600'}`} />
                                      <div className="flex flex-col text-left">
                                        <span className={isEnCurso ? 'text-slate-500' : ''}>Editar proceso</span>
                                        {isEnCurso && <span className="mt-0.5 text-[9px] font-bold uppercase text-rose-600">Bloqueado (En curso)</span>}
                                      </div>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => !isEnCurso && descargarPDF(proc.id)}
                                    disabled={generandoReporteId === proc.id || isEnCurso}
                                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors ${isEnCurso ? 'cursor-not-allowed bg-slate-50 opacity-50' : 'text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50'}`}
                                  >
                                    <Download className={`w-4 h-4 ${isEnCurso ? 'text-slate-400' : 'text-emerald-600'}`} />
                                    <div className="flex flex-col text-left">
                                      <span className={isEnCurso ? 'text-slate-500' : ''}>{generandoReporteId === proc.id ? 'Generando...' : 'Descargar Informe PDF'}</span>
                                      {isEnCurso && <span className="mt-0.5 text-[9px] font-bold uppercase text-rose-600">Cerrar para descargar</span>}
                                    </div>
                                  </button>
                                  {puedeEliminar && (
                                    <button
                                      onClick={() => !isEnCurso && solicitarEliminarProceso(proc)}
                                      disabled={isEnCurso}
                                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-xs font-bold transition-colors ${isEnCurso ? 'cursor-not-allowed bg-slate-50 opacity-50' : 'text-red-600 hover:bg-red-50'}`}
                                    >
                                      <Trash2 className={`w-4 h-4 ${isEnCurso ? 'text-slate-400' : 'text-red-600'}`} />
                                      <div className="flex flex-col text-left">
                                        <span className={isEnCurso ? 'text-slate-500' : ''}>Eliminar proceso</span>
                                        {isEnCurso && <span className="mt-0.5 text-[9px] font-bold uppercase text-rose-600">Bloqueado (En curso)</span>}
                                      </div>
                                    </button>
                                  )}
                                </div>,
                                document.body
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {Array.from({ length: filasVaciasPagina }).map((_, index) => (
                        <tr key={`fila-vacia-${paginaActual}-${index}`} aria-hidden="true" className="h-[60px] bg-white pointer-events-none select-none border-b border-slate-100 last:border-b-0">
                          <td colSpan="10" className="px-4 py-0">&nbsp;</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-4 border-t border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <span>Mostrar</span>
                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                    15 por página
                  </div>
                </div>
                <span>Mostrando {filtrados.length === 0 ? 0 : (paginaActual - 1) * procesosPorPagina + 1} a {Math.min(paginaActual * procesosPorPagina, filtrados.length)} de {filtrados.length} procesos registrados</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Anterior
                </button>
                {paginasVisibles.map((pagina, index) => pagina === '...' ? (
                  <span key={`dots-${index}`} className="px-1 text-slate-400">...</span>
                ) : (
                  <button
                    key={pagina}
                    onClick={() => setPaginaActual(pagina)}
                    className={`min-w-[36px] rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-95 ${paginaActual === pagina ? 'bg-amber-500 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {pagina}
                  </button>
                ))}
                <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {horaUltimaSincronizacion ? `Última sincronización: ${horaUltimaSincronizacion} hrs (Chile)` : 'Sin sincronización reciente'}
              </span>
            </div>
          </div>
        </div>
        {/* MODAL ELIMINAR Y VISTA PREVIA */}
        {procesoAEliminar && puedeEliminar && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 md:p-8 border border-red-100 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100 shadow-sm"><AlertTriangle className="w-8 h-8" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Eliminar Inspección</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">¿Estás seguro de eliminar el proceso N° <span className="font-black text-slate-900">{procesoAEliminar.numProceso}</span>? Esta acción eliminará permanentemente toda su inspeccion.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setProcesoAEliminar(null)} className="flex-1 py-3 px-4 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
                <button onClick={ejecutarEliminacionProceso} className="flex-1 py-3 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-colors text-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}
        {datosVistaPrevia && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white z-10">
                <div>
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    Vista Previa del Informe
                    {datosVistaPrevia.estado === 'En curso' && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold animate-pulse">En curso</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">Proceso N° {datosVistaPrevia.numProceso || datosVistaPrevia.id}<span className="sm:hidden"> · Pellizca con dos dedos para ampliar o reducir</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => descargarPDF(datosVistaPrevia.id || datosVistaPrevia._id)} disabled={generandoReporteId === (datosVistaPrevia.id || datosVistaPrevia._id) || datosVistaPrevia.estado === 'En curso'} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50">
                    <Download className="w-4 h-4" /> {generandoReporteId === (datosVistaPrevia.id || datosVistaPrevia._id) ? 'Generando...' : 'Descargar PDF'}
                  </button>
                  <button onClick={() => setDatosVistaPrevia(null)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-200 p-2 sm:p-6 custom-scrollbar" onTouchStart={iniciarPinch} onTouchMove={moverPinch} onTouchEnd={terminarPinch} onTouchCancel={terminarPinch}>
                <div className="min-w-full flex justify-center items-start">
                  <div className="relative shrink-0" style={{ width: `${816 * zoomVistaPrevia}px`, height: `${1056 * zoomVistaPrevia}px` }}>
                    <div className="absolute left-0 top-0 shadow-2xl origin-top-left" style={{ transform: `scale(${zoomVistaPrevia})`, width: '816px', height: '1056px' }}><PlantillaInforme datos={datosVistaPrevia} parametros={datosVistaPrevia.parametrosInforme} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* CONTENEDOR OCULTO PARA EL PDF */}
        <div style={{ position: 'fixed', top: 0, left: '-10000px', zIndex: -1000, opacity: 1, pointerEvents: 'none' }}>
          {datosReporte && <PlantillaInforme ref={reporteRef} datos={datosReporte} parametros={datosReporte.parametrosInforme} />}
        </div>
      </div>
    );
  }
  // ================= VISTA 2: EDICIÓN COMPLETA =================
  const metricasLive = calcularMetricas(procesoEnEdicion);
  const catalogoEdicion = obtenerCatalogoProceso(procesoEnEdicion);
  const nombresCalidadEdicion = catalogoEdicion.nombresCalidad;
  const nombresCondicionEdicion = catalogoEdicion.nombresCondicion;
  const listaCajasEnEdicion = Array.isArray(procesoEnEdicion?.cajas) ? procesoEnEdicion.cajas : [];
  const cajaEditandoModal = cajaIndexEditandoModal !== null ? listaCajasEnEdicion[cajaIndexEditandoModal] : null;
  return (
    <div className="w-full h-full bg-[#F4F7FA] overflow-y-auto custom-scrollbar animate-fade-in relative pb-28">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5 py-6 px-4 md:px-8 font-sans w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={cerrarEdicion} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-full transition-colors shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Editando Proceso N° #{procesoEnEdicion?.numProceso || '-'}</h1>
              <p className="text-xs text-slate-500 font-medium">Modifica los datos del proceso y gestiona la lista de cajas inspeccionadas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cerrarEdicion} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-full text-xs transition-colors hidden md:block">Cancelar</button>
            <button onClick={guardarCambiosProceso} className="px-6 py-2.5 bg-[#00A859] hover:bg-[#008f4c] text-white font-bold rounded-full text-xs shadow-md transition-all flex items-center gap-2"><Save className="w-4 h-4" /> <span className="hidden sm:inline">Guardar Todo el Proceso</span></button>
          </div>
        </div>
        {/* SECCIÓN 1: DATOS GENERALES DEL PROCESO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">1. Datos Generales del Proceso</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div><label className="text-xs font-bold text-slate-500 block mb-1">N° Proceso</label><input type="number" value={procesoEnEdicion?.numProceso || ''} onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, numProceso: e.target.value })} className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-sm outline-none focus:border-[#E96008]" /></div>
            <div><label className="text-xs font-bold text-slate-500 block mb-1">Exportadora</label><select value={procesoEnEdicion?.exportadora || ''} onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, exportadora: e.target.value })} className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]">{exportadoras.map((e, idx) => <option key={idx} value={e.nombre || e}>{e.nombre || e}</option>)}</select></div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">CSG / Huerto</label>
              <select value={procesoEnEdicion?.csg || ''} onChange={(e) => handleCSGChange(e.target.value)} className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]">
                {huertos.map((h, idx) => (
                  <option key={idx} value={h.csg}>{h.csg} - {h.huerto || h.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Huerto</label>
              <input
                type="text" readOnly
                value={procesoEnEdicion?.huerto || procesoEnEdicion?.productor || ''}
                className="w-full h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 font-medium text-slate-500 text-xs cursor-not-allowed"
              />
            </div>
            <div><label className="text-xs font-bold text-slate-500 block mb-1">Variedad</label><select value={procesoEnEdicion?.variedad || ''} onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, variedad: e.target.value })} className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]">{variedades.map((v, idx) => <option key={idx} value={v.nombre || v}>{v.nombre || v}</option>)}</select></div>
          </div>
        </div>
        {puedeEditar && procesoEnEdicion?.estado !== 'En curso' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wider text-slate-800">Fotografías del proceso</h2>
            <p className="mb-3 text-xs text-slate-500">Agrega o reemplaza las fotografías Light y Dark del proceso cerrado. Se guardan inmediatamente en el servidor, sin alterar las cajas ni la calificación.</p>
            {fotosEdicion.error && <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{fotosEdicion.error}</p>}
            {fotosEdicion.cargando ? (
              <p className="text-xs font-medium text-slate-500">Consultando fotografías guardadas...</p>
            ) : (
              <FotografiasProceso
                apiUrl={API_URL}
                procesoId={procesoEnEdicion.id || procesoEnEdicion._id}
                modoHistorial
                lightOk={fotosEdicion.light}
                darkOk={fotosEdicion.dark}
                onPhotoSaved={({ tipo }) => setFotosEdicion(prev => ({ ...prev, [tipo]: true }))}
              />
            )}
          </div>
        )}

        {/* RESTO DE LA VISTA DE EDICIÓN */}
        <div className="bg-[#E96008] rounded-2xl px-5 py-4 text-white shadow-md w-full">
          <h2 className="font-extrabold mb-3 text-xs md:text-sm tracking-wide uppercase opacity-95">Resumen de Proceso en Tiempo Real</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 text-xs md:text-sm">
            <div className="flex flex-col gap-1"><div className="flex justify-between items-center"><span className="opacity-80">Proceso:</span> <span className="font-black text-base">#{procesoEnEdicion?.numProceso || '-'}</span></div><div className="flex justify-between items-center"><span className="opacity-80">Muestra:</span> <span className="font-black text-base">{metricasLive.acumuladoFrutos}</span></div></div>
            <div className="flex flex-col gap-1"><div className="flex justify-between items-center"><span className="opacity-80">Cajas:</span> <span className="font-black text-base">{listaCajasEnEdicion.length}</span></div><div className="flex justify-between items-center"><span className="opacity-80">Exportable:</span> <span className="font-black text-base">{metricasLive.pExp}%</span></div></div>
            <div className="flex flex-col gap-1"><div className="flex justify-between items-center"><span className="opacity-80">Sólidos (L/D):</span> <span className="font-black text-base">{metricasLive.promLight} / {metricasLive.promDark}</span></div><div className="flex justify-between items-center"><span className="opacity-80">Calificación:</span> <span className="font-black text-base">{metricasLive.nota}</span></div></div>
            <div className="flex flex-col gap-1"><div className="flex justify-between items-center"><span className="opacity-80">Def. calidad:</span> <span className="font-black text-base">{metricasLive.pCal}%</span></div><div className="flex justify-between items-center"><span className="opacity-80">Estado:</span> <span className={`font-black px-2 py-0.5 rounded text-xs ${metricasLive.estado === 'Objetado' ? 'bg-red-900/40 text-red-200' : 'text-white'}`}>{metricasLive.estado}</span></div></div>
            <div className="flex flex-col gap-1"><div className="flex justify-between items-center"><span className="opacity-80">Def. condición:</span> <span className="font-black text-base">{metricasLive.pCond}%</span></div></div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">2. Cajas Analizadas ({listaCajasEnEdicion.length})</h2>
            <button onClick={agregarNuevaCaja} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"><Plus className="w-4 h-4" /> Agregar Nueva Caja</button>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[980px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">N° Caja</th><th className="py-3 px-4">Usuario</th><th className="py-3 px-4">Calibre</th><th className="py-3 px-4">Temp pulpa</th><th className="py-3 px-4">Color</th><th className="py-3 px-4">°Brix</th><th className="py-3 px-4 text-center">Def. Calidad</th><th className="py-3 px-4 text-center">Def. Condición</th><th className="py-3 px-4 text-center">% Exportable</th><th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {listaCajasEnEdicion.length === 0 ? (
                    <tr><td colSpan="10" className="py-8 text-center text-slate-400 font-medium">No hay cajas registradas en este proceso. Presiona "Agregar Nueva Caja".</td></tr>
                  ) : (
                    listaCajasEnEdicion.map((c, idx) => {
                      const totales = calcularTotalesCaja(c);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900">Caja #{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{nombreUsuarioCaja(c)}</td>
                          <td className="py-3 px-4 font-bold text-[#E96008]">{c.calibre || '-'}</td>
                          <td className="py-3 px-4 font-bold text-slate-700">{c.tempPulpa == null || c.tempPulpa === '' ? '-' : `${String(c.tempPulpa).replace('.', ',')} °C`}</td>
                          <td className="py-3 px-4"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{c.color || '-'}</span></td>
                          <td className="py-3 px-4 font-bold">{c.brix ? `${c.brix}°` : '-'}</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">{totales.tCal} ({totales.pCal}%)</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">{totales.tCond} ({totales.pCond}%)</td>
                          <td className="py-3 px-4 text-center"><span className={`font-black ${parseFloat(totales.pExp) >= 90 ? 'text-emerald-600' : 'text-red-600'}`}>{totales.pExp}%</span></td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => { setCajaIndexEditandoModal(idx); setTabDefectosModal('calidad'); }} className="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-[#E96008] text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1" title="Editar inspección de esta caja"><Edit3 className="w-3.5 h-3.5" /> Editar</button>
                              <button onClick={() => eliminarCaja(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar caja"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* MODAL DETALLADO PARA EDITAR LA REVISIÓN DE UNA CAJA */}
      {cajaEditandoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-5 border border-slate-100 relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div><h3 className="font-black text-slate-900 text-lg md:text-xl">Editando Caja #{cajaIndexEditandoModal + 1}</h3><p className="text-xs text-slate-400 font-medium">Ajusta los parámetros técnicos y conteo de defectos para esta caja</p></div>
              <button onClick={() => setCajaIndexEditandoModal(null)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div><label className="text-xs font-bold text-slate-700 block mb-1">Muestra (frutos)</label><input type="number" value={cajaEditandoModal.frutos ?? ''} onChange={(e) => handleCajaCampoModalChange('frutos', e.target.value)} className="w-full h-10 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" /></div>
              <div><label className="text-xs font-bold text-slate-700 block mb-1">Calibre</label><select value={cajaEditandoModal.calibre ?? ''} onChange={(e) => handleCajaCampoModalChange('calibre', e.target.value)} className="w-full h-10 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]"><option value="">Seleccionar</option><option value="L">L</option><option value="XL">XL</option><option value="J">J</option><option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option></select></div>
              <div><label className="text-xs font-bold text-slate-700 block mb-1">Temp pulpa (°C)</label><input type="text" inputMode="decimal" maxLength={8} placeholder="Ej. 2,5" value={cajaEditandoModal.tempPulpa ?? ''} onChange={(e) => handleCajaCampoModalChange('tempPulpa', e.target.value)} className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm font-bold outline-none focus:border-[#E96008]" /></div>
              <div><label className="text-xs font-bold text-slate-700 block mb-1">Color Embalaje</label><select value={cajaEditandoModal.color ?? ''} onChange={(e) => handleCajaCampoModalChange('color', e.target.value)} className="w-full h-10 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]"><option value="">Seleccionar</option><option value="Light">Light</option><option value="Dark">Dark</option></select></div>
              <div><label className="text-xs font-bold text-slate-700 block mb-1">° Brix (Sólidos)</label><input type="number" step="0.1" value={cajaEditandoModal.brix ?? ''} onChange={(e) => handleCajaCampoModalChange('brix', e.target.value)} className="w-full h-10 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" /></div>
            </div>
            <div className="flex border-b border-slate-200">
              <button type="button" onClick={() => setTabDefectosModal('calidad')} className={`flex-1 py-3 font-extrabold text-xs md:text-sm border-b-2 transition-all ${tabDefectosModal === 'calidad' ? 'border-[#E96008] text-[#E96008] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Defectos de Calidad</button>
              <button type="button" onClick={() => setTabDefectosModal('condicion')} className={`flex-1 py-3 font-extrabold text-xs md:text-sm border-b-2 transition-all ${tabDefectosModal === 'condicion' ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Defectos de Condición</button>
            </div>
            {tabDefectosModal === 'calidad' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {nombresCalidadEdicion.map(def => {
                  const cant = cajaEditandoModal.defCalidad?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1.5 border-b border-slate-100">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input type="number" value={cant === 0 ? '' : cant} onChange={(e) => handleDefectoModalChange('defCalidad', def, e.target.value)} className="w-16 h-9 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-[#E96008]" />
                    </div>
                  );
                })}
              </div>
            )}
            {tabDefectosModal === 'condicion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {nombresCondicionEdicion.map(def => {
                  const cant = cajaEditandoModal.defCondicion?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1.5 border-b border-slate-100">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input type="number" value={cant === 0 ? '' : cant} onChange={(e) => handleDefectoModalChange('defCondicion', def, e.target.value)} className="w-16 h-9 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-red-500" />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setCajaIndexEditandoModal(null)} className="px-6 py-2.5 bg-[#E96008] hover:bg-[#c74c04] text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center gap-2">
                <Check className="w-4 h-4" /> Listo (Aplicar Cambios)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

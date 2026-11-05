import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronRight, Clock3, FilePlus2, History,
  AlertTriangle, Check, ChevronDown, Download, Eye, Menu, Moon, MoreHorizontal, MoreVertical, PencilLine, Plus, RefreshCw, Save, Search, Sun, Thermometer, Trash2, X, ShieldAlert
} from 'lucide-react';
import { API_URL } from '../../config/api.js';

const PUNTOS_INICIALES = [
  { id: 'agua-variado', codigo: 'agua-variado', nombre: 'T° Agua Vaciado', categoria: 'agua' },
  { id: 'pulpa-ingreso', codigo: 'pulpa-ingreso', nombre: 'T° Pulpa Ingreso', categoria: 'pulpa' },
  { id: 'agua-cort-pedicelo', codigo: 'agua-cort-pedicelo', nombre: 'T° Agua Cort. Pedicelo', categoria: 'agua' },
  { id: 'pulpa-cort-pedicelo', codigo: 'pulpa-cort-pedicelo', nombre: 'T° Pulpa Cort. Pedicelo', categoria: 'pulpa' },
  { id: 'agua-est-fungicida', codigo: 'agua-est-fungicida', nombre: 'T° Agua Est. Fungicida', categoria: 'agua' },
  { id: 'pulpa-est-fungicida', codigo: 'pulpa-est-fungicida', nombre: 'T° Pulpa Est. Fungicida', categoria: 'pulpa' },
  { id: 'pulpa-sellado', codigo: 'pulpa-sellado', nombre: 'T° Pulpa Sellado', categoria: 'pulpa' },
  { id: 'ambiente-sellado', codigo: 'ambiente-sellado', nombre: 'T° Ambiente Sellado', categoria: 'ambiente' },
  { id: 'amb-palletizaje', codigo: 'amb-palletizaje', nombre: 'T° Amb. Palletizaje', categoria: 'ambiente' }
];

const COLORES = { agua: '#0284C7', pulpa: '#E11D48', ambiente: '#10B981' };
const CATEGORIAS_UI = {
  agua: { etiqueta: 'AGUA', barra: 'bg-[#0284C7]', chip: 'bg-[#E0F2FE] text-[#0369A1]' },
  pulpa: { etiqueta: 'PULPA', barra: 'bg-[#E11D48]', chip: 'bg-[#FFE4E6] text-[#BE123C]' },
  ambiente: { etiqueta: 'AMBIENTE', barra: 'bg-[#10B981]', chip: 'bg-[#ECFDF5] text-[#047857]' }
};
const RANGOS_TEMPERATURA = {
  'pulpa-ingreso': { min: 2, max: 5 },
  'agua-variado': { min: 5, max: 17 },
  'pulpa-cort-pedicelo': { min: 4, max: 6 },
  'agua-cort-pedicelo': { min: 2, max: 4 },
  'pulpa-est-fungicida': { min: 4, max: 6 },
  'agua-est-fungicida': { min: 0, max: 2 },
  'pulpa-sellado': { min: 4, max: 6 },
  'ambiente-sellado': { min: 10.1, max: 15 },
  'amb-palletizaje': { min: 4, max: 6 }
};
const DELTA_ADVERTENCIA = 0.5;
const TURNOS_INFO = {
  Dia: { label: 'Turno Día', rango: '07:00 - 18:00', icono: '☀️', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  Noche: { label: 'Turno Noche', rango: '18:30 - 06:00', icono: '🌙', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
};
const HISTORIAL_COLUMNAS = [
  { codigo: 'agua-variado', zona: 'VACIADO', variable: 'T° AGUA' },
  { codigo: 'pulpa-ingreso', zona: 'VACIADO', variable: 'T° PULPA' },
  { codigo: 'agua-cort-pedicelo', zona: 'CORTADOR PEDICELO', variable: 'T° AGUA' },
  { codigo: 'pulpa-cort-pedicelo', zona: 'CORTADOR PEDICELO', variable: 'T° PULPA' },
  { codigo: 'agua-est-fungicida', zona: 'ESTANQUE FUNGICIDA', variable: 'T° AGUA' },
  { codigo: 'pulpa-est-fungicida', zona: 'ESTANQUE FUNGICIDA', variable: 'T° PULPA' },
  { codigo: 'pulpa-sellado', zona: 'SELLADO', variable: 'T° PULPA' },
  { codigo: 'ambiente-sellado', zona: 'SELLADO', variable: 'T° AMBIENTE' },
  { codigo: 'amb-palletizaje', zona: 'PALETIZADO', variable: 'T° AMBIENTE' }
];
// El turno puede abarcar más de siete controles horarios; la tabla permite desplazamiento horizontal.
const COLUMNAS_VISIBLES_BASE = 24;
const CLAVE_ACTIVOS = 'evap_temperatura_registros_activos_v2';
const CLAVE_BORRADOR = 'evap_temperatura_borrador_v2';
const claveFechaTurno = (fecha, turno) => `${fecha}|${turno}`;
const leerStorageSeguro = (clave, fallback = null) => {
  try {
    const data = JSON.parse(localStorage.getItem(clave) || 'null');
    return data && typeof data === 'object' ? data : fallback;
  } catch { return fallback; }
};

let columnaSeq = 0;
// El identificador también debe ser único frente a mediciones restauradas desde un borrador.
const crearColumna = (hora = '') => ({ id: `hora-${Date.now()}-${++columnaSeq}`, hora });

const FUENTE_INTER = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const fetchJsonSeguro = async (url, options) => {
  const response = await fetch(url, options);
  const texto = await response.text();
  let data = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      const error = new Error('El servidor respondió en un formato no compatible. Reinicia el backend con el server.js actualizado.');
      error.status = response.status;
      error.code = 'RESPUESTA_NO_JSON';
      throw error;
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error || `No fue posible completar la consulta (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
};

const fechaHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const numero = valor => {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const formatear = valor => valor === null || valor === undefined ? '--' : Number(valor).toFixed(1).replace('.', ',');
const promedio = valores => {
  const nums = valores.map(numero).filter(v => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};

const formatearFechaTitulo = fechaStr => {
  if (!fechaStr) return '';
  return new Date(`${fechaStr}T00:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
};
const formatearFechaCorta = fechaStr => fechaStr ? new Date(`${fechaStr}T00:00:00`).toLocaleDateString('es-CL') : '';
const formatearFechaMovil = fechaStr => {
  if (!fechaStr) return '';
  const d = new Date(`${fechaStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(fechaStr);
  const mes = d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
  return `${String(d.getDate()).padStart(2, '0')} ${mes.charAt(0).toUpperCase()}${mes.slice(1)}, ${d.getFullYear()}`;
};
// Fecha legible y compacta sin desfases UTC: 02 Nov 2026.
const formatearFechaHistorial = fechaStr => {
  const coincidencia = String(fechaStr || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) return String(fechaStr || '');
  const [, anio, mesNumero, dia] = coincidencia;
  const fecha = new Date(Number(anio), Number(mesNumero) - 1, Number(dia), 12);
  const mes = fecha.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '');
  return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${anio}`;
};
const estiloHistorialPorCodigo = codigo => {
  if (String(codigo).startsWith('agua-')) return {
    fondo: 'bg-blue-50/70', borde: 'border-blue-500', texto: 'text-blue-600'
  };
  if (String(codigo).startsWith('pulpa-')) return {
    fondo: 'bg-rose-50/70', borde: 'border-rose-600', texto: 'text-rose-600'
  };
  return { fondo: 'bg-amber-50/70', borde: 'border-amber-500', texto: 'text-amber-600' };
};
const etapaHistorial = zona => {
  if (zona === 'CORTADOR PEDICELO') return 'CORTADOR';
  if (zona === 'ESTANQUE FUNGICIDA') return 'ESTANQUE';
  return zona;
};
const variableHistorial = variable => variable === 'T° AMBIENTE' ? 'T° AMB.' : variable;
const TAMANO_PAGINA_HISTORIAL = 15;
const ALTO_TABLA_HISTORIAL = 640; // 12 filas visibles de ~48 px y cabecera, 15 fechas por página.

const GRUPOS_HISTORIAL_MOVIL = [
  {
    clave: 'agua', titulo: 'T° AGUA',
    barra: 'bg-[#2563EB]', fondo: 'bg-[#EFF6FF]', texto: 'text-[#1D4ED8]',
    columnas: 'grid-cols-3',
    puntos: [
      { codigo: 'agua-variado', etiqueta: 'Vaciado' },
      { codigo: 'agua-cort-pedicelo', etiqueta: 'Cortador' },
      { codigo: 'agua-est-fungicida', etiqueta: 'Estanque' }
    ]
  },
  {
    clave: 'pulpa', titulo: 'T° PULPA',
    barra: 'bg-[#E11D48]', fondo: 'bg-[#FFF1F2]', texto: 'text-[#BE123C]',
    columnas: 'grid-cols-4',
    puntos: [
      { codigo: 'pulpa-ingreso', etiqueta: 'Vaciado' },
      { codigo: 'pulpa-cort-pedicelo', etiqueta: 'Cortador' },
      { codigo: 'pulpa-est-fungicida', etiqueta: 'Estanque' },
      { codigo: 'pulpa-sellado', etiqueta: 'Sellado' }
    ]
  },
  {
    clave: 'ambiente', titulo: 'T° AMBIENTE',
    barra: 'bg-[#D97706]', fondo: 'bg-[#FFFBEB]', texto: 'text-[#B45309]',
    columnas: 'grid-cols-2',
    puntos: [
      { codigo: 'ambiente-sellado', etiqueta: 'Sellado' },
      { codigo: 'amb-palletizaje', etiqueta: 'Paletizado' }
    ]
  }
];

// Las mismas nueve temperaturas se agrupan en ambas pantallas.
// El detalle aplica los rangos reales; el resumen muestra promedios sin semáforos.
function GruposTemperaturasMovil({ valores, detalle = false, edicion = false, valoresEditados = {}, onEditar }) {
  return (
    <div className="space-y-2">
      {GRUPOS_HISTORIAL_MOVIL.map(grupo => (
        <div key={grupo.clave} className={`rounded-xl p-2 ${grupo.fondo}`}>
          <div className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider ${grupo.texto}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${grupo.barra}`} />
            {grupo.titulo}
          </div>
          <div className={`grid ${grupo.columnas} gap-1.5`}>
            {grupo.puntos.map(punto => {
              const valor = numero(valores?.[punto.codigo]);
              const editable = valoresEditados[punto.codigo] ?? (valor === null ? '' : String(valor).replace('.', ','));
              return (
                <div key={punto.codigo} className={`min-w-0 rounded-lg border px-1.5 py-1.5 ${detalle && !edicion ? `border-transparent ${claseCeldaTemperatura(punto.codigo, valor)}` : 'border-slate-100 bg-white'}`}>
                  <p className="truncate text-[9px] font-medium leading-3 text-slate-500" title={punto.etiqueta}>{punto.etiqueta}</p>
                  {edicion ? (
                    <input type="text" inputMode="decimal" value={editable} onChange={e => onEditar?.(punto.codigo, e.target.value)} aria-label={`${punto.etiqueta}, ${grupo.titulo}`} placeholder="--" className={`mt-1 h-7 w-full rounded-md border px-1 text-center text-[12px] font-bold outline-none focus:ring-2 focus:ring-orange-200 ${claseInputTemperatura(punto.codigo, editable, true)}`} />
                  ) : (
                    <div className={`mt-0.5 whitespace-nowrap text-[13px] font-bold tabular-nums ${detalle ? '' : 'text-slate-900'}`}>
                      {valor === null ? '--' : formatear(valor)}
                      <span className="ml-0.5 text-[9px] font-normal text-slate-500">°C</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const horaActual = () => {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
};
const moverFecha = (fechaStr, deltaDias) => {
  const d = new Date(`${fechaStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const claseCeldaTemperatura = (codigo, valor) => {
  const n = numero(valor);
  if (n === null) return 'text-slate-300';
  const rango = RANGOS_TEMPERATURA[codigo];
  if (!rango) return 'text-slate-700';
  if (n >= rango.min && n <= rango.max) return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200';
  const distancia = n < rango.min ? rango.min - n : n - rango.max;
  if (distancia <= DELTA_ADVERTENCIA) return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
};

const claseInputTemperatura = (codigo, valor, habilitado = true) => {
  if (!habilitado) return 'border-slate-100 bg-slate-50 text-slate-300 placeholder:text-slate-300 cursor-not-allowed';
  const n = numero(valor);
  if (n === null) return 'border-slate-200 bg-white text-slate-700';
  const rango = RANGOS_TEMPERATURA[codigo];
  if (!rango) return 'border-slate-200 bg-white text-slate-700';
  if (n >= rango.min && n <= rango.max) return 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100';
  const distancia = n < rango.min ? rango.min - n : n - rango.max;
  if (distancia <= DELTA_ADVERTENCIA) return 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-100';
  return 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-100';
};

const formatearHoraManual = valor => {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
};
const horaManualValida = valor => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(valor || '').trim());
const cargarMotorExcel = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const existente = document.querySelector('script[data-evap-xlsx="true"]');
  if (existente) {
    existente.addEventListener('load', () => resolve(window.XLSX), { once: true });
    existente.addEventListener('error', () => reject(new Error('No fue posible cargar el generador de Excel.')), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  script.async = true;
  script.dataset.evapXlsx = 'true';
  script.onload = () => resolve(window.XLSX);
  script.onerror = () => reject(new Error('No fue posible cargar el generador de Excel. Revisa la conexión de red.'));
  document.head.appendChild(script);
});
const fechaExcel = fechaStr => {
  if (!fechaStr) return '';
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : String(fechaStr);
};

export default function TemperaturaLineaModule({ onAbrirMenu, onRegistrarGuardSalida, usuarioId, userRole = '', plantaId = null }) {
  // El backend aún no informa el estado de cierre. Se conserva solo en este navegador.
  // El almacenamiento local se separa por usuario y, cuando está disponible, por planta.
  const sufijoLocal = `${usuarioId ?? 'sin-usuario'}:${plantaId ?? 'sin-planta'}`;
  const claveActivosLocal = `${CLAVE_ACTIVOS}:${sufijoLocal}`;
  const claveBorradorLocal = `${CLAVE_BORRADOR}:${sufijoLocal}`;
  const [registrosActivos, setRegistrosActivos] = useState(() => leerStorageSeguro(claveActivosLocal, {}) || {});
  const registrosActivosRef = useRef(registrosActivos);
  const guardSalidaActualRef = useRef(null);
  const navegacionPendienteRef = useRef(null);
  const [mostrarConfirmacionNavegacion, setMostrarConfirmacionNavegacion] = useState(false);
  const [confirmacionFinalizacion, setConfirmacionFinalizacion] = useState(null);
  const [vista, setVista] = useState('menu');
  const esAdministrador = ['admin', 'administrador'].includes(String(userRole ?? '').trim().toLowerCase());
  const [puntos, setPuntos] = useState(PUNTOS_INICIALES);
  const [fecha, setFecha] = useState(fechaHoy());
  const [turno, setTurno] = useState('Dia');
  const [columnas, setColumnas] = useState(() => [crearColumna('')]);
  const [columnaActivaId, setColumnaActivaId] = useState(null);
  const [mediciones, setMediciones] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [historialFecha, setHistorialFecha] = useState(fechaHoy());
  const [historial, setHistorial] = useState({ Dia: null, Noche: null });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState('');
  const [pageSizeHistorial, setPageSizeHistorial] = useState('all');
  const [ultimaActualizacionHistorial, setUltimaActualizacionHistorial] = useState(null);
  const [registroGuardado, setRegistroGuardado] = useState(false);
  const [autosaveStamp, setAutosaveStamp] = useState(Date.now());
  const [resumenHistorial, setResumenHistorial] = useState([]);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState('');
  const [busquedaResumen, setBusquedaResumen] = useState('');
  const [paginaResumen, setPaginaResumen] = useState(1);
  const [fechaExpandidaMovil, setFechaExpandidaMovil] = useState(null);
  const [horaExpandidaMovil, setHoraExpandidaMovil] = useState(null);
  const [historialTabMovil, setHistorialTabMovil] = useState('resumen');
  const [turnosHistorialPorFecha, setTurnosHistorialPorFecha] = useState({});
  const [exportando, setExportando] = useState(false);
  const [modoEdicionHistorial, setModoEdicionHistorial] = useState(false);
  const [edicionesHistorial, setEdicionesHistorial] = useState({});
  const [guardandoEdicionHistorial, setGuardandoEdicionHistorial] = useState(false);
  const [mensajeExportacion, setMensajeExportacion] = useState('');
  const [mostrarConfirmacionSalida, setMostrarConfirmacionSalida] = useState(false);
  const [confirmacionGuardado, setConfirmacionGuardado] = useState(null);
  // Las opciones del historial se aplican solo después de una respuesta DELETE correcta.
  const [confirmacionEliminacion, setConfirmacionEliminacion] = useState(null);
  const [eliminandoHistorial, setEliminandoHistorial] = useState(false);
  const [errorEliminacion, setErrorEliminacion] = useState('');
  const [mensajeEliminacion, setMensajeEliminacion] = useState('');
  // Autorización dentro del mismo cuadro de confirmación cuando Login no preserva el token.
  const [mostrarAutorizacionEliminacion, setMostrarAutorizacionEliminacion] = useState(false);
  const [errorAutorizacionEliminacion, setErrorAutorizacionEliminacion] = useState('');
  const [usuarioAutorizacion, setUsuarioAutorizacion] = useState(() => leerStorageSeguro('qc_user_session', null)?.username || '');
  const [passwordAutorizacion, setPasswordAutorizacion] = useState('');
  const claveTokenEliminacion = `evap_temp_token_autorizado:${sufijoLocal}`;
  const obtenerTokenEliminacion = () => {
    // La reautorización reciente prevalece sobre un token antiguo guardado por Login.
    try {
      const renovado = sessionStorage.getItem(claveTokenEliminacion);
      if (renovado) return renovado;
    } catch {}
    const sesion = leerStorageSeguro('qc_user_session', null);
    return sesion?.tokenTemperaturas || '';
  };
  // Evita reenviar al backend columnas ya guardadas sin cambios en la misma sesión.
  const firmasGuardadasRef = useRef({});
  const claveActivosAnteriorRef = useRef(claveActivosLocal);

  // Si la planta o el usuario cambian sin desmontar el componente, evita reutilizar otro registro local.
  useEffect(() => {
    if (claveActivosAnteriorRef.current === claveActivosLocal) return;
    claveActivosAnteriorRef.current = claveActivosLocal;
    const siguientes = leerStorageSeguro(claveActivosLocal, {}) || {};
    registrosActivosRef.current = siguientes;
    setRegistrosActivos(siguientes);
    firmasGuardadasRef.current = {};
    setFecha(fechaHoy());
    setTurno('Dia');
    setColumnas([crearColumna('')]);
    setMediciones({});
    setColumnaActivaId(null);
    setRegistroGuardado(false);
    setMensaje('');
    setVista('menu');
  }, [claveActivosLocal]);

  useEffect(() => {
    fetch(`${API_URL}/api/digitacion/temperaturas/puntos`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length) setPuntos(data.map(p => ({ ...p, codigo: p.codigo || String(p.id) })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(claveBorradorLocal);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.fecha) setFecha(draft.fecha);
      if (draft?.turno) setTurno(draft.turno);
      if (Array.isArray(draft?.columnas) && draft.columnas.length) {
        // Conserva los IDs: mediciones usa esos mismos IDs como claves.
        setColumnas(draft.columnas.map(c => c?.id ? { id: c.id, hora: c.hora || '' } : crearColumna(c?.hora || '')));
      }
      if (draft?.mediciones && typeof draft.mediciones === 'object') setMediciones(draft.mediciones);
      if (draft?.firmasGuardadas && typeof draft.firmasGuardadas === 'object') firmasGuardadasRef.current = draft.firmasGuardadas;
    } catch {
      // ignore local draft errors
    }
  }, []);

  useEffect(() => {
    if (vista !== 'nuevo') return;
    try {
      localStorage.setItem(claveBorradorLocal, JSON.stringify({ fecha, turno, columnas, mediciones, firmasGuardadas: firmasGuardadasRef.current }));
      setAutosaveStamp(Date.now());
    } catch {
      // ignore local draft errors
    }
  }, [vista, fecha, turno, columnas, mediciones, claveBorradorLocal]);

  const hayDatosColumna = columnaId => puntos.some(p => numero(mediciones[columnaId]?.[p.id]) !== null);

  const hayMediciones = useMemo(
    () => columnas.some(c => puntos.some(p => numero(mediciones[c.id]?.[p.id]) !== null)),
    [columnas, mediciones, puntos]
  );

  const hayCambios = useMemo(
    () => hayMediciones || columnas.some(c => c.hora),
    [hayMediciones, columnas]
  );

  const registrosIngresados = useMemo(
    () => columnas.filter(c => hayDatosColumna(c.id)).length,
    [columnas, mediciones, puntos]
  );

  const promedioPunto = id => promedio(columnas.map(c => mediciones[c.id]?.[id]));

  // En móvil se edita una medición por vez; las otras siguen disponibles en pestañas.
  const columnaActiva = columnas.find(c => c.id === columnaActivaId) || columnas[columnas.length - 1] || null;
  const indiceMedicionActiva = Math.max(0, columnas.findIndex(c => c.id === columnaActiva?.id));
  const puntosConDatosActivos = columnaActiva
    ? puntos.filter(p => numero(mediciones[columnaActiva.id]?.[p.id]) !== null).length
    : 0;
  const porcentajeProgresoActivo = puntos.length ? Math.round((puntosConDatosActivos / puntos.length) * 100) : 0;

  const firmaColumna = columna => JSON.stringify({
    fecha,
    turno,
    hora: columna.hora,
    mediciones: puntos.map(p => [String(p.id), numero(mediciones[columna.id]?.[p.id])])
  });
  const todasLasColumnasGuardadas = columnas.length > 0 && columnas.every(
    c => Boolean(firmasGuardadasRef.current[c.id]) && firmasGuardadasRef.current[c.id] === firmaColumna(c)
  );
  const hayMedicionesPendientes = vista === 'nuevo' && columnas.some(c => {
    // Una medición vacía no obliga a descartar; una hora o un valor sí.
    const tieneAlgo = Boolean(c.hora) || puntos.some(p => String(mediciones[c.id]?.[p.id] ?? '').trim() !== '');
    return tieneAlgo && firmasGuardadasRef.current[c.id] !== firmaColumna(c);
  });
  const registroActivoActual = registrosActivos[claveFechaTurno(fecha, turno)] || null;
  const registrosAbiertosHoy = Object.values(registrosActivos)
    .filter(r => r?.fecha === fechaHoy() && r?.estado === 'en_curso' && Array.isArray(r.columnas) && r.columnas.length)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const registroAbiertoHoy = registrosAbiertosHoy[0] || null;
  const registroAbiertoConfigurado = registrosActivos[claveFechaTurno(fecha, turno)] || null;

  // Solo conserva una copia de lo CONFIRMADO por el backend; no mezcla borradores pendientes.
  const snapshotGuardado = (columnasActuales = columnas) => {
    const guardadas = columnasActuales.filter(c => Boolean(firmasGuardadasRef.current[c.id]));
    return {
      columnas: guardadas.map(c => {
        const firmado = JSON.parse(firmasGuardadasRef.current[c.id]);
        return { id: c.id, hora: firmado.hora };
      }),
      mediciones: Object.fromEntries(guardadas.map(c => {
        const firmado = JSON.parse(firmasGuardadasRef.current[c.id]);
        return [c.id, Object.fromEntries(firmado.mediciones
          .filter(([, val]) => val !== null)
          .map(([puntoId, val]) => [puntoId, String(val).replace('.', ',')]))];
      })),
      firmasGuardadas: Object.fromEntries(guardadas.map(c => [c.id, firmasGuardadasRef.current[c.id]]))
    };
  };

  const escribirActivos = siguiente => {
    registrosActivosRef.current = siguiente;
    setRegistrosActivos(siguiente);
    try { localStorage.setItem(claveActivosLocal, JSON.stringify(siguiente)); } catch {}
  };

  const persistirRegistroAbierto = () => {
    const snapshot = snapshotGuardado();
    if (!snapshot.columnas.length) return;
    const id = claveFechaTurno(fecha, turno);
    const anterior = registrosActivosRef.current[id];
    escribirActivos({
      ...registrosActivosRef.current,
      [id]: {
        ...snapshot, fecha, turno, estado: 'en_curso',
        iniciadoEn: anterior?.iniciadoEn || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  };

  const restaurarRegistro = (reg, recuperarBorrador = true) => {
    if (!reg?.fecha || !reg?.turno) return false;
    let datos = reg;
    if (recuperarBorrador) {
      const draft = leerStorageSeguro(claveBorradorLocal);
      if (draft?.fecha === reg.fecha && draft?.turno === reg.turno && Array.isArray(draft.columnas)) {
        datos = { ...reg, ...draft };
      }
    }
    const cols = Array.isArray(datos.columnas) ? datos.columnas.map(c => ({ id: c.id || crearColumna('').id, hora: c.hora || '' })) : [];
    firmasGuardadasRef.current = { ...(reg.firmasGuardadas || {}) };
    setFecha(reg.fecha);
    setTurno(reg.turno);
    setColumnas(cols.length ? cols : [crearColumna('')]);
    setColumnaActivaId(cols.length ? cols[cols.length - 1].id : null);
    setMediciones(datos.mediciones || {});
    setRegistroGuardado(!cols.some(c => {
      const firmado = firmasGuardadasRef.current[c.id];
      return !firmado || firmado !== JSON.stringify({
        fecha: reg.fecha, turno: reg.turno, hora: c.hora,
        mediciones: puntos.map(p => [String(p.id), numero(datos.mediciones?.[c.id]?.[p.id])])
      });
    }));
    setConfirmacionGuardado(null);
    setMensaje('');
    setVista('nuevo');
    return true;
  };

  const descartarBorradorActual = () => {
    try { localStorage.removeItem(claveBorradorLocal); } catch {}
    setConfirmacionGuardado(null);
  };

  // App.jsx consulta este guard antes de navegar desde el sidebar original.
  guardSalidaActualRef.current = continuar => {
    if (!hayMedicionesPendientes && !guardando) return true;
    navegacionPendienteRef.current = continuar;
    setMostrarConfirmacionNavegacion(true);
    return false;
  };
  useEffect(() => {
    if (typeof onRegistrarGuardSalida !== 'function') return;
    const guard = continuar => guardSalidaActualRef.current?.(continuar) !== false;
    onRegistrarGuardSalida(guard);
    return () => onRegistrarGuardSalida(null);
  }, [onRegistrarGuardSalida]);

  const confirmarSalidaExterna = () => {
    const continuar = navegacionPendienteRef.current;
    navegacionPendienteRef.current = null;
    setMostrarConfirmacionNavegacion(false);
    descartarBorradorActual();
    // Incluso si se cancela un cierre de sesión posterior, los datos descartados no reaparecen.
    const activo = registrosActivosRef.current[claveFechaTurno(fecha, turno)];
    if (activo) restaurarRegistro(activo, false);
    else limpiarRegistro();
    if (typeof continuar === 'function') continuar();
  };

  const finalizarMediciones = () => {
    if (guardando) return;
    if (!registroActivoActual?.columnas?.length) {
      setConfirmacionFinalizacion('sin_guardar');
    } else if (hayMedicionesPendientes || !todasLasColumnasGuardadas) {
      setConfirmacionFinalizacion('pendientes');
    } else {
      setConfirmacionFinalizacion('confirmar');
    }
  };

  const confirmarFinalizacion = () => {
    if (confirmacionFinalizacion !== 'confirmar') return;
    if (hayMedicionesPendientes || !todasLasColumnasGuardadas || !registroActivoActual) {
      setConfirmacionFinalizacion('pendientes');
      return;
    }
    const key = claveFechaTurno(fecha, turno);
    const siguientes = { ...registrosActivosRef.current };
    delete siguientes[key];
    escribirActivos(siguientes);
    descartarBorradorActual();
    firmasGuardadasRef.current = {};
    setColumnas([crearColumna('')]);
    setMediciones({});
    setColumnaActivaId(null);
    setRegistroGuardado(false);
    setConfirmacionFinalizacion(null);
    setMensaje('');
    setVista('menu');
  };
  // Guardar mientras se está digitando; Nueva Medición solo al inicio vacío o tras guardar.
  const puedeCrearOtraMedicion = columnas.length < COLUMNAS_VISIBLES_BASE &&
    (columnas.length === 0 || todasLasColumnasGuardadas);
  const mostrarGuardar = columnas.length > 0 && !todasLasColumnasGuardadas;
  const textoGuardarMovil = columnas.length === 1
    ? 'Guardar Medición 1'
    : `Guardar registro${registrosIngresados ? ` (${registrosIngresados} con datos)` : ''}`;

  const cambiarTurno = valor => {
    if (valor === turno) return;
    if (hayMedicionesPendientes && !window.confirm('Hay una medición sin guardar. ¿Deseas descartar los cambios y cambiar de turno?')) return;
    descartarBorradorActual();
    const guardadoOtroTurno = registrosActivosRef.current[claveFechaTurno(fecha, valor)];
    if (guardadoOtroTurno?.estado === 'en_curso') {
      restaurarRegistro(guardadoOtroTurno, false);
      return;
    }
    setTurno(valor);
    firmasGuardadasRef.current = {};
    setConfirmacionGuardado(null);
    setColumnas([crearColumna('')]);
    setColumnaActivaId(null);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
  };

  const actualizarHora = (columnaId, valor) => {
    const hora = formatearHoraManual(valor);
    setColumnas(prev => prev.map(c => c.id === columnaId ? { ...c, hora } : c));
    setConfirmacionGuardado(null);
    setRegistroGuardado(false);
    setMensaje('');
  };

  const actualizarValor = (columnaId, puntoId, valor) => {
    const limpio = valor.replace(/[^0-9,.-]/g, '');
    setMediciones(prev => ({ ...prev, [columnaId]: { ...(prev[columnaId] || {}), [puntoId]: limpio } }));
    setConfirmacionGuardado(null);
    setRegistroGuardado(false);
    setMensaje('');
  };

  const agregarHora = () => {
    if (!puedeCrearOtraMedicion || guardando) return;
    setConfirmacionGuardado(null);
    const nueva = crearColumna('');
    setColumnas(prev => [...prev, nueva]);
    setColumnaActivaId(nueva.id);
    setRegistroGuardado(false);
    setMensaje('');
  };

  const eliminarColumna = columnaId => {
    if (firmasGuardadasRef.current[columnaId]) {
      setMensaje('Una medición ya guardada permanece en el historial. Puedes corregir sus valores y guardar nuevamente, pero no eliminarla desde este panel.');
      return;
    }
    if (hayDatosColumna(columnaId) && !window.confirm('¿Eliminar esta medición? Las temperaturas ingresadas en ella se perderán.')) return;
    setColumnas(prev => prev.filter(c => c.id !== columnaId));
    setColumnaActivaId(prev => prev === columnaId ? null : prev);
    delete firmasGuardadasRef.current[columnaId];
    setConfirmacionGuardado(null);
    setMediciones(prev => {
      const copia = { ...prev };
      delete copia[columnaId];
      return copia;
    });
    // Una columna vacía eliminada no invalida las anteriores ya guardadas.
    const restantes = columnas.filter(c => c.id !== columnaId);
    setRegistroGuardado(restantes.length > 0 && restantes.every(c => firmasGuardadasRef.current[c.id] === firmaColumna(c)));
    setMensaje('');
  };

  const limpiarRegistro = () => {
    firmasGuardadasRef.current = {};
    setConfirmacionGuardado(null);
    setColumnas([crearColumna('')]);
    setColumnaActivaId(null);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
    descartarBorradorActual();
  };

  const descartarCambios = () => {
    if (!hayMedicionesPendientes) return;
    if (!window.confirm('¿Deseas descartar los cambios no guardados? Las mediciones ya guardadas permanecerán disponibles.')) return;
    descartarBorradorActual();
    const activo = registrosActivosRef.current[claveFechaTurno(fecha, turno)];
    if (activo) restaurarRegistro(activo, false);
    else limpiarRegistro();
  };

  const volverMenu = () => {
    if (vista === 'historial-detalle') return setVista('historial');
    if (vista === 'nuevo' && hayMedicionesPendientes) {
      setMostrarConfirmacionSalida(true);
      return;
    }
    if (vista === 'nuevo') descartarBorradorActual();
    setVista('menu');
  };

  const confirmarVolverMenu = () => {
    setMostrarConfirmacionSalida(false);
    descartarBorradorActual();
    setVista('menu');
  };

  const iniciarRegistro = () => {
    const existente = registrosActivosRef.current[claveFechaTurno(fecha, turno)];
    if (existente?.estado === 'en_curso' && Array.isArray(existente.columnas) && existente.columnas.length) {
      restaurarRegistro(existente);
      return;
    }
    firmasGuardadasRef.current = {};
    setConfirmacionGuardado(null);
    setColumnas([crearColumna('')]);
    setColumnaActivaId(null);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
    setVista('nuevo');
  };

  const abrirConfiguracion = () => {
    setFecha(fechaHoy());
    setTurno('Dia');
    setVista('configurar');
  };

  const cambiarConfiguracionRegistro = () => {
    if (hayMedicionesPendientes && !window.confirm('Hay mediciones ingresadas sin guardar. ¿Deseas descartarlas para cambiar la fecha o turno?')) return;
    descartarBorradorActual();
    setVista('configurar');
  };

  const guardar = async (confirmarIncompletos = false) => {
    if (guardando) return;
    const columnasConDatos = columnas.filter(c => hayDatosColumna(c.id));
    if (!columnasConDatos.length) return setMensaje('Ingresa al menos una temperatura antes de guardar.');
    const sinHora = columnasConDatos.find(c => !c.hora);
    if (sinHora) return setMensaje('Debes indicar la hora de cada medición que contiene temperaturas.');
    const horaInvalida = columnasConDatos.find(c => !horaManualValida(c.hora));
    if (horaInvalida) return setMensaje('La hora debe tener el formato HH:MM, por ejemplo 16:58.');
    const horas = columnasConDatos.map(c => c.hora);
    if (new Set(horas).size !== horas.length) return setMensaje('No puedes guardar dos mediciones con la misma hora.');

    // No envía de nuevo las horas ya guardadas, salvo que se haya cambiado su contenido.
    const pendientes = columnasConDatos.filter(c => firmasGuardadasRef.current[c.id] !== firmaColumna(c));
    if (!pendientes.length) {
      setMensaje('Ingresa temperaturas en la nueva medición o modifica un valor antes de guardar.');
      return;
    }

    const incompletas = pendientes.map(c => {
      const indice = columnas.findIndex(item => item.id === c.id) + 1;
      const faltantes = puntos.filter(p => numero(mediciones[c.id]?.[p.id]) === null);
      return { indice, hora: c.hora, faltantes };
    }).filter(c => c.faltantes.length > 0);

    if (incompletas.length && !confirmarIncompletos) {
      setConfirmacionGuardado(incompletas);
      setMensaje('');
      return;
    }

    setConfirmacionGuardado(null);
    setGuardando(true);
    setMensaje('');
    let enviadas = 0;
    try {
      for (const columna of pendientes) {
        const datos = puntos
          .map(p => ({ puntoId: p.id, codigo: p.codigo, valor: numero(mediciones[columna.id]?.[p.id]) }))
          .filter(m => m.valor !== null);

        const resp = await fetch(`${API_URL}/api/digitacion/temperaturas/guardar-hora`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha, turno, hora: columna.hora, usuarioId, mediciones: datos })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `No fue posible guardar ${columna.hora}.`);
        firmasGuardadasRef.current[columna.id] = firmaColumna(columna);
        persistirRegistroAbierto();
        enviadas += 1;
      }
      setRegistroGuardado(true);
      setMensaje(`Medición guardada con éxito. ${enviadas} medición${enviadas === 1 ? '' : 'es'} registrada${enviadas === 1 ? '' : 's'}. Presiona Nueva Medición para ingresar otra hora con todos sus campos vacíos.`);
      try { localStorage.removeItem(claveBorradorLocal); } catch {}
    } catch (error) {
      // Si la solicitud intermedia falló, se conserva el control de las horas ya guardadas.
      if (enviadas) {
        try {
          localStorage.setItem(claveBorradorLocal, JSON.stringify({ fecha, turno, columnas, mediciones, firmasGuardadas: firmasGuardadasRef.current }));
        } catch {}
      }
      setMensaje(`${error.message || 'No fue posible guardar el registro.'}${enviadas ? ` (${enviadas} medición(es) guardada(s) antes del error).` : ''}`);
    } finally {
      setGuardando(false);
    }
  };

  const cerrarConfirmacionEliminacion = () => {
    setConfirmacionEliminacion(null);
    setMostrarAutorizacionEliminacion(false);
    setErrorAutorizacionEliminacion('');
    setPasswordAutorizacion('');
  };
  const accionesRegistro = (tipo, fechaRegistro, turnoRegistro = null, horaRegistro = null) => {
    setErrorEliminacion('');
    setMensajeEliminacion('');
    setErrorAutorizacionEliminacion('');
    setPasswordAutorizacion('');
    const sesion = leerStorageSeguro('qc_user_session', null);
    setUsuarioAutorizacion(sesion?.username || '');
    // Si la API es de otro origen, el navegador no puede adjuntar cookies
    // sin una configuración CORS específica: ofrecer autorización dentro del mismo diálogo.
    const url = new URL(`${API_URL}/api/digitacion/temperaturas/dia`, window.location.href);
    setMostrarAutorizacionEliminacion(!obtenerTokenEliminacion() && url.origin !== window.location.origin);
    setConfirmacionEliminacion({ tipo, fecha: fechaRegistro, turno: turnoRegistro, hora: horaRegistro });
  };

  // Sin borrado optimista: conservamos todo hasta obtener confirmación de PostgreSQL vía API.
  const actualizarCacheTrasEliminar = objetivo => {
    const afecta = registro => registro?.fecha === objetivo.fecha &&
      (objetivo.tipo === 'fecha' || registro?.turno === objetivo.turno);
    const ajustar = reg => {
      if (!afecta(reg)) return reg;
      if (objetivo.tipo === 'fecha') return null;
      const cols = (reg.columnas || []).filter(c => c.hora !== objetivo.hora);
      if (!cols.length) return null;
      const ids = new Set(cols.map(c => c.id));
      return {
        ...reg,
        columnas: cols,
        mediciones: Object.fromEntries(Object.entries(reg.mediciones || {}).filter(([id]) => ids.has(id))),
        firmasGuardadas: Object.fromEntries(Object.entries(reg.firmasGuardadas || {}).filter(([id]) => ids.has(id))),
        updatedAt: new Date().toISOString()
      };
    };
    const siguientes = {};
    Object.entries(registrosActivosRef.current).forEach(([clave, reg]) => {
      const ajustado = ajustar(reg);
      if (ajustado) siguientes[clave] = ajustado;
    });
    escribirActivos(siguientes);

    const borrador = leerStorageSeguro(claveBorradorLocal);
    if (borrador && afecta(borrador)) {
      const ajustado = ajustar(borrador);
      try {
        if (ajustado) localStorage.setItem(claveBorradorLocal, JSON.stringify(ajustado));
        else localStorage.removeItem(claveBorradorLocal);
      } catch {}
    }
    if (fecha === objetivo.fecha && (objetivo.tipo === 'fecha' || turno === objetivo.turno)) {
      // Evita que una hora eliminada reaparezca al continuar con un borrador antiguo.
      firmasGuardadasRef.current = {};
      setColumnas([crearColumna('')]);
      setMediciones({});
      setColumnaActivaId(null);
      setRegistroGuardado(false);
    }
  };

  const eliminarRegistroDesdeHistorial = async () => {
    const objetivo = confirmacionEliminacion;
    if (!objetivo || eliminandoHistorial) return;
    const errorValidacion = !/^\d{4}-\d{2}-\d{2}$/.test(objetivo.fecha)
      ? 'La fecha seleccionada no es válida.'
      : objetivo.tipo === 'hora' && (!['Dia', 'Noche'].includes(objetivo.turno) || !horaManualValida(objetivo.hora))
        ? 'No fue posible identificar la fecha, el turno y la hora del registro.'
        : objetivo.tipo !== 'hora' && objetivo.tipo !== 'fecha'
          ? 'El registro seleccionado no es válido.'
          : '';
    if (errorValidacion) {
      cerrarConfirmacionEliminacion();
      setErrorEliminacion(errorValidacion);
      return;
    }
    if (mostrarAutorizacionEliminacion && (!usuarioAutorizacion.trim() || !passwordAutorizacion.trim())) {
      setErrorAutorizacionEliminacion('Ingresa tu usuario y contraseña de EVAP para autorizar esta eliminación.');
      return;
    }

    setEliminandoHistorial(true);
    setErrorEliminacion('');
    setErrorAutorizacionEliminacion('');
    setMensajeEliminacion('');
    let reautorizando = false;
    try {
      let token = obtenerTokenEliminacion();
      if (mostrarAutorizacionEliminacion) {
        reautorizando = true;
        const respuesta = await fetchJsonSeguro(`${API_URL}/api/digitacion/temperaturas/sesion`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usuarioAutorizacion.trim(),
            password: passwordAutorizacion,
            usuarioId
          })
        });
        token = respuesta?.tokenTemperaturas;
        if (respuesta?.success !== true || !/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) {
          throw new Error('El servidor no pudo autorizar la eliminación.');
        }
        try { sessionStorage.setItem(claveTokenEliminacion, token); } catch {}
        setPasswordAutorizacion('');
        reautorizando = false;
      }
      const parametros = new URLSearchParams({ fecha: objetivo.fecha });
      if (objetivo.tipo === 'hora') {
        parametros.set('turno', objetivo.turno);
        parametros.set('hora', objetivo.hora);
      }
      const recurso = objetivo.tipo === 'fecha' ? 'dia' : 'hora';
      const url = `${API_URL}/api/digitacion/temperaturas/${recurso}?${parametros.toString()}`;
      const mismaProcedencia = new URL(url, window.location.href).origin === window.location.origin;
      const resultado = await fetchJsonSeguro(url, {
        method: 'DELETE',
        // Cookie HTTP-only en mismo origen. En origen diferente usar Bearer obtenido
        // al reautorizar con usuario y contraseña (sin depender de Login.jsx).
        credentials: mismaProcedencia ? 'same-origin' : 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resultado?.success !== true && resultado?.ok !== true) {
        throw new Error('El servidor no confirmó la eliminación. Ningún dato local fue modificado.');
      }
    } catch (error) {
      const estado = Number(error?.status);
      if (estado === 401) {
        // El token no llegó, venció o se reinició el backend. No abrir otra alerta:
        // solicitar reautorización dentro de ESTE MISMO cuadro.
        try { sessionStorage.removeItem(claveTokenEliminacion); } catch {}
        setMostrarAutorizacionEliminacion(true);
        setErrorAutorizacionEliminacion(reautorizando
          ? 'No se pudieron validar tus credenciales. Revisa usuario y contraseña.'
          : 'Tu sesión requiere autorización. Ingresa las credenciales de EVAP para continuar.');
        setEliminandoHistorial(false);
        return;
      }
      if (mostrarAutorizacionEliminacion && estado === 400) {
        setErrorAutorizacionEliminacion(error?.message || 'Revisa el usuario y la contraseña.');
        setEliminandoHistorial(false);
        return;
      }
      if (mostrarAutorizacionEliminacion && estado === 429) {
        setErrorAutorizacionEliminacion(error?.message || 'Demasiados intentos. Inténtalo más tarde.');
        setEliminandoHistorial(false);
        return;
      }
      // No volver a mostrar una ventana. Los errores distintos de autenticación
      // aparecen como aviso dentro del historial.
      cerrarConfirmacionEliminacion();
      const mensaje = [405, 501].includes(estado) ||
        (estado === 404 && /Cannot DELETE|Cannot POST|endpoint no encontrado|Not Found/i.test(String(error?.message || '')))
        ? 'El backend no tiene habilitadas las rutas de eliminación o autorización. Actualiza server.js y reinícialo.'
        : estado === 403
          ? (error?.message || 'Tu usuario no tiene permiso para eliminar temperaturas.')
          : (error?.message || 'No fue posible eliminar el registro. Comprueba la conexión e inténtalo nuevamente.');
      setErrorEliminacion(mensaje);
      setEliminandoHistorial(false);
      return;
    }

    // Solo después de que PostgreSQL confirmó el DELETE se actualiza la UI.
    cerrarConfirmacionEliminacion();
    setModoEdicionHistorial(false);
    setEdicionesHistorial({});
    setMensajeEliminacion(objetivo.tipo === 'fecha'
      ? `Registro del ${formatearFechaCorta(objetivo.fecha)} eliminado correctamente.`
      : `Medición de las ${objetivo.hora} eliminada correctamente.`);
    // La etiqueta del turno de cada fecha se obtiene del backend y debe actualizarse
    // tras eliminar una hora o una fecha, para no mostrar estados antiguos.
    setTurnosHistorialPorFecha(prev => {
      if (!Object.prototype.hasOwnProperty.call(prev, objetivo.fecha)) return prev;
      const siguiente = { ...prev };
      delete siguiente[objetivo.fecha];
      return siguiente;
    });

    if (objetivo.tipo === 'fecha') {
      setResumenHistorial(prev => prev.filter(item => String(item.fecha || '').slice(0, 10) !== objetivo.fecha));
      if (vista === 'historial-detalle') setVista('historial');
    } else {
      setHistorial(prev => ({
        ...prev,
        [objetivo.turno]: {
          ...(prev[objetivo.turno] || {}),
          horas: (prev[objetivo.turno]?.horas || []).filter(h => h.hora !== objetivo.hora)
        }
      }));
    }
    try { actualizarCacheTrasEliminar(objetivo); }
    catch (error) { console.error('No se pudo actualizar el borrador local después del borrado:', error); }
    setEliminandoHistorial(false);
    try {
      if (objetivo.tipo === 'fecha') await cargarResumenHistorial();
      else await Promise.all([cargarHistorial(objetivo.fecha), cargarResumenHistorial()]);
    } catch (error) {
      console.warn('El registro fue eliminado pero el historial no pudo actualizarse:', error);
      setErrorEliminacion('El registro fue eliminado, pero no se pudo actualizar la lista. Refresca el historial.');
    }
  };

  const cargarResumenHistorial = async () => {
    setCargandoResumen(true);
    setErrorResumen('');
    try {
      const data = await fetchJsonSeguro(`${API_URL}/api/digitacion/temperaturas/resumen?limite=240`);
      const items = Array.isArray(data?.items) ? data.items : [];
      setResumenHistorial(items);
      const fechasUpdate = [data?.ultimaActualizacion, ...items.map(item => item?.updatedAt)]
        .map(valor => valor ? new Date(valor).getTime() : 0)
        .filter(valor => Number.isFinite(valor) && valor > 0);
      setUltimaActualizacionHistorial(fechasUpdate.length ? new Date(Math.max(...fechasUpdate)) : null);
    } catch (error) {
      console.error('Error cargando resumen de temperaturas:', error);
      setResumenHistorial([]);
      setErrorResumen(error.message || 'No fue posible cargar el resumen de mediciones.');
    } finally {
      setCargandoResumen(false);
    }
  };

  const cargarHistorial = async (fechaConsulta = historialFecha) => {
    setCargandoHistorial(true);
    setErrorHistorial('');
    try {
      try {
        const dataDia = await fetchJsonSeguro(`${API_URL}/api/digitacion/temperaturas/dia?fecha=${encodeURIComponent(fechaConsulta)}`);
        if (dataDia?.turnos) {
          setHistorial({
            Dia: dataDia.turnos.Dia || { fecha: fechaConsulta, turno: 'Dia', horas: [] },
            Noche: dataDia.turnos.Noche || { fecha: fechaConsulta, turno: 'Noche', horas: [] }
          });
          const ultima = dataDia?.ultimaActualizacion ? new Date(dataDia.ultimaActualizacion) : null;
          setUltimaActualizacionHistorial(ultima && !Number.isNaN(ultima.getTime()) ? ultima : null);
          return;
        }
      } catch (errorDia) {
        if (![404, 405].includes(Number(errorDia?.status)) && errorDia?.code !== 'RESPUESTA_NO_JSON') throw errorDia;
      }

      const cargarTurno = turnoConsulta => fetchJsonSeguro(
        `${API_URL}/api/digitacion/temperaturas?fecha=${encodeURIComponent(fechaConsulta)}&turno=${turnoConsulta}`
      );
      const [dia, noche] = await Promise.all([cargarTurno('Dia'), cargarTurno('Noche')]);
      setHistorial({ Dia: dia, Noche: noche });
      const fechasUpdate = [
        dia?.updatedAt, noche?.updatedAt,
        ...(dia?.horas || []).map(h => h?.updatedAt),
        ...(noche?.horas || []).map(h => h?.updatedAt)
      ].map(valor => valor ? new Date(valor).getTime() : 0).filter(valor => Number.isFinite(valor) && valor > 0);
      setUltimaActualizacionHistorial(fechasUpdate.length ? new Date(Math.max(...fechasUpdate)) : null);
    } catch (error) {
      console.error('Error cargando historial de temperaturas:', error);
      setErrorHistorial(
        error?.code === 'RESPUESTA_NO_JSON'
          ? 'No se pudo conectar correctamente con la API de temperaturas. Reinicia el backend con el server.js actualizado.'
          : error.message || 'No fue posible cargar el historial de temperaturas.'
      );
      setHistorial({ Dia: null, Noche: null });
    } finally {
      setCargandoHistorial(false);
    }
  };

  const abrirDetalleHistorial = item => {
    const fechaSeleccionada = String(item?.fecha || '').slice(0, 10);
    if (!fechaSeleccionada) {
      setErrorResumen('No fue posible identificar la fecha del registro seleccionado.');
      return;
    }
    setHistorialFecha(fechaSeleccionada);
    setModoEdicionHistorial(false);
    setEdicionesHistorial({});
    setErrorHistorial('');
    setVista('historial-detalle');
  };

  const iniciarEdicionHistorial = () => {
    const draft = {};
    historialPlano.forEach(row => {
      draft[row.id] = { ...row.valores };
    });
    setEdicionesHistorial(draft);
    setModoEdicionHistorial(true);
    setErrorHistorial('');
  };

  const cancelarEdicionHistorial = () => {
    setModoEdicionHistorial(false);
    setEdicionesHistorial({});
  };

  const actualizarEdicionHistorial = (rowId, codigo, valor) => {
    const limpio = valor.replace(/[^0-9,.-]/g, '');
    setEdicionesHistorial(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [codigo]: limpio } }));
  };

  const guardarEdicionHistorial = async () => {
    if (!historialPlano.length) return;
    setGuardandoEdicionHistorial(true);
    setErrorHistorial('');
    try {
      for (const row of historialPlano) {
        const valores = edicionesHistorial[row.id] || {};
        const datos = puntos.map(p => ({ puntoId: p.id, codigo: p.codigo, valor: numero(valores[p.codigo]) })).filter(m => m.valor !== null);
        if (!datos.length) continue;
        const resp = await fetch(`${API_URL}/api/digitacion/temperaturas/guardar-hora`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha: historialFecha, turno: row.turno, hora: row.hora, usuarioId, mediciones: datos })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `No fue posible actualizar la medición de las ${row.hora}.`);
      }
      await cargarHistorial(historialFecha);
      await cargarResumenHistorial();
      setModoEdicionHistorial(false);
      setEdicionesHistorial({});
    } catch (error) {
      setErrorHistorial(error.message || 'No fue posible guardar los cambios del historial.');
    } finally {
      setGuardandoEdicionHistorial(false);
    }
  };

  const exportarExcel = async () => {
    setExportando(true);
    setMensajeExportacion('');
    try {
      const [XLSX, data] = await Promise.all([
        cargarMotorExcel(),
        fetchJsonSeguro(`${API_URL}/api/digitacion/temperaturas/exportar`)
      ]);
      if (!XLSX) throw new Error('No fue posible iniciar el generador de Excel.');
      const resumen = Array.isArray(data?.resumen) ? data.resumen : [];
      const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
      if (!detalle.length) throw new Error('No existen mediciones registradas para exportar.');

      const resumenFilas = resumen.map(item => [
        fechaExcel(item.fecha),
        Number(item.mediciones || 0),
        item.primeraHora || '--',
        item.ultimaHora || '--'
      ]);
      const resumenAoa = [
        ['RESUMEN DIARIO DE TEMPERATURAS'],
        ['Fecha', 'Mediciones', 'Primera medición', 'Última medición'],
        ...resumenFilas
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa);
      wsResumen['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      wsResumen['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
      wsResumen['!autofilter'] = { ref: `A2:D${Math.max(2, resumenAoa.length)}` };

      const columnasDetalle = [
        ['Fecha', null],
        ['Turno', null],
        ['Hora medición', null],
        ['Vaciado - T° Agua', 'agua-variado'],
        ['Vaciado - T° Pulpa', 'pulpa-ingreso'],
        ['Cortador Pedicelo - T° Agua', 'agua-cort-pedicelo'],
        ['Cortador Pedicelo - T° Pulpa', 'pulpa-cort-pedicelo'],
        ['Estanque Fungicida - T° Agua', 'agua-est-fungicida'],
        ['Estanque Fungicida - T° Pulpa', 'pulpa-est-fungicida'],
        ['Sellado - T° Pulpa', 'pulpa-sellado'],
        ['Sala Proceso - T° Ambiente', 'ambiente-sellado'],
        ['Paletizado - T° Ambiente', 'amb-palletizaje']
      ];
      const detalleFilas = detalle.map(item => [
        fechaExcel(item.fecha),
        item.turno === 'Dia' ? 'Día' : 'Noche',
        item.hora || '--',
        ...columnasDetalle.slice(3).map(([, codigo]) => {
          const valor = item.mediciones?.[codigo];
          return valor === null || valor === undefined ? null : Number(valor);
        })
      ]);
      const detalleAoa = [
        ['DETALLE COMPLETO DE MEDICIONES POR HORA'],
        columnasDetalle.map(([titulo]) => titulo),
        ...detalleFilas
      ];
      const wsDetalle = XLSX.utils.aoa_to_sheet(detalleAoa);
      wsDetalle['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columnasDetalle.length - 1 } }];
      wsDetalle['!cols'] = [
        { wch: 16 }, { wch: 12 }, { wch: 15 },
        { wch: 22 }, { wch: 22 }, { wch: 29 }, { wch: 29 },
        { wch: 28 }, { wch: 28 }, { wch: 21 }, { wch: 27 }, { wch: 27 }
      ];
      wsDetalle['!autofilter'] = { ref: `A2:L${Math.max(2, detalleAoa.length)}` };
      for (let r = 2; r < detalleAoa.length; r++) {
        for (let c = 3; c < columnasDetalle.length; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (wsDetalle[ref] && wsDetalle[ref].t === 'n') wsDetalle[ref].z = '0.0';
        }
      }

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, wsResumen, 'Resumen diario');
      XLSX.utils.book_append_sheet(libro, wsDetalle, 'Detalle por hora');
      libro.Props = {
        Title: 'Historial completo de temperaturas EVAP',
        Subject: 'Resumen diario y detalle por hora',
        Author: 'EVAP'
      };
      XLSX.writeFile(libro, `EVAP_Temperaturas_${fechaHoy()}.xlsx`, { compression: true });
      setMensajeExportacion(`Excel generado correctamente con ${detalle.length} mediciones registradas.`);
    } catch (error) {
      setMensajeExportacion(error.message || 'No fue posible exportar el historial de temperaturas.');
    } finally {
      setExportando(false);
    }
  };

  useEffect(() => {
    if (vista === 'historial') cargarResumenHistorial();
    if (vista === 'historial-detalle') cargarHistorial(historialFecha);
  }, [vista, historialFecha]);

  const historialPlano = useMemo(() => {
    const mapearTurno = turnoKey => {
      const base = historial?.[turnoKey];
      const horas = Array.isArray(base?.horas) ? base.horas : Array.isArray(base) ? base : [];
      return horas.map((registro, index) => {
        const valores = {};
        (registro.mediciones || []).forEach(m => {
          const punto = puntos.find(p => String(p.id) === String(m.puntoId) || String(p.codigo) === String(m.codigo) || String(p.codigo) === String(m.puntoId));
          valores[punto?.codigo || String(m.puntoId)] = numero(m.valor);
        });
        return {
          id: registro.id || `${turnoKey}-${registro.hora}-${index}`,
          fecha: historialFecha,
          turno: turnoKey,
          hora: registro.hora || '--:--',
          numProceso: registro.numProceso || null,
          estadoAsociacion: registro.estadoAsociacion || '',
          valores
        };
      });
    };
    return [...mapearTurno('Dia'), ...mapearTurno('Noche')];
  }, [historial, historialFecha, puntos]);

  const historialOrdenado = useMemo(() => [...historialPlano].sort((a, b) => {
    if (a.turno !== b.turno) return a.turno === 'Dia' ? -1 : 1;
    return a.hora.localeCompare(b.hora);
  }), [historialPlano]);
  const historialPaginado = useMemo(() => pageSizeHistorial === 'all' ? historialOrdenado : historialOrdenado.slice(0, Number(pageSizeHistorial)), [historialOrdenado, pageSizeHistorial]);
  const horaMovilActual = horaExpandidaMovil === null ? historialPaginado[0]?.id : horaExpandidaMovil;
  useEffect(() => { setHoraExpandidaMovil(null); }, [historialFecha, historialPaginado[0]?.id]);
  const historialAgrupado = useMemo(() => ({ Dia: historialPaginado.filter(r => r.turno === 'Dia'), Noche: historialPaginado.filter(r => r.turno === 'Noche') }), [historialPaginado]);
  const resumenHistorialDiario = useMemo(() => {
    const mapa = new Map();
    resumenHistorial.forEach(item => {
      const fechaItem = String(item?.fecha || '').slice(0, 10);
      if (!fechaItem) return;
      const existente = mapa.get(fechaItem) || {
        fecha: fechaItem,
        mediciones: 0,
        primeraHora: null,
        ultimaHora: null,
        updatedAt: null,
        promedios: {}
      };
      existente.mediciones += Number(item?.mediciones || 0);
      if (item?.promedios && typeof item.promedios === 'object') existente.promedios = { ...existente.promedios, ...item.promedios };
      if (item?.primeraHora && (!existente.primeraHora || item.primeraHora < existente.primeraHora)) existente.primeraHora = item.primeraHora;
      if (item?.ultimaHora && (!existente.ultimaHora || item.ultimaHora > existente.ultimaHora)) existente.ultimaHora = item.ultimaHora;
      const updateActual = existente.updatedAt ? new Date(existente.updatedAt).getTime() : 0;
      const updateNuevo = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (updateNuevo > updateActual) existente.updatedAt = item.updatedAt;
      mapa.set(fechaItem, existente);
    });
    return Array.from(mapa.values()).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [resumenHistorial]);

  const resumenHistorialFiltrado = useMemo(() => {
    const term = busquedaResumen.trim().toLowerCase();
    if (!term) return resumenHistorialDiario;
    return resumenHistorialDiario.filter(item => [
      String(item.fecha || ''),
      formatearFechaCorta(item.fecha),
      formatearFechaTitulo(item.fecha),
      formatearFechaHistorial(item.fecha)
    ].join(' ').toLowerCase().includes(term));
  }, [resumenHistorialDiario, busquedaResumen]);
  const cantidadPaginasResumen = Math.max(1, Math.ceil(resumenHistorialFiltrado.length / TAMANO_PAGINA_HISTORIAL));
  const paginaActualResumen = Math.min(paginaResumen, cantidadPaginasResumen);
  const resumenHistorialPaginado = useMemo(() => resumenHistorialFiltrado.slice(
    (paginaActualResumen - 1) * TAMANO_PAGINA_HISTORIAL,
    paginaActualResumen * TAMANO_PAGINA_HISTORIAL
  ), [resumenHistorialFiltrado, paginaActualResumen]);
  useEffect(() => { setPaginaResumen(1); }, [busquedaResumen]);
  const fechaMovilActual = fechaExpandidaMovil === null ? resumenHistorialPaginado[0]?.fecha : fechaExpandidaMovil;
  useEffect(() => { setFechaExpandidaMovil(null); }, [paginaActualResumen, busquedaResumen, resumenHistorialPaginado[0]?.fecha]);
  // El resumen del backend no identifica el turno de cada fecha: lo consultamos solo
  // cuando se expande la tarjeta, en lugar de inventar un turno a partir de la hora.
  useEffect(() => {
    if (vista !== 'historial' || historialTabMovil !== 'resumen' || !fechaMovilActual || Object.prototype.hasOwnProperty.call(turnosHistorialPorFecha, fechaMovilActual)) return;
    let cancelado = false;
    fetchJsonSeguro(`${API_URL}/api/digitacion/temperaturas/dia?fecha=${encodeURIComponent(fechaMovilActual)}`)
      .then(data => {
        if (cancelado) return;
        setTurnosHistorialPorFecha(prev => ({ ...prev, [fechaMovilActual]: { dia: Number(data.totalDia || 0), noche: Number(data.totalNoche || 0) } }));
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [vista, historialTabMovil, fechaMovilActual, turnosHistorialPorFecha]);
  const textoTurnoFecha = fechaItem => {
    const info = turnosHistorialPorFecha[fechaItem];
    if (!info) return 'Registro diario';
    if (info.dia > 0 && info.noche > 0) return 'Turnos Día y Noche';
    if (info.dia > 0) return 'Turno Día';
    if (info.noche > 0) return 'Turno Noche';
    return 'Registro diario';
  };
  const alertasPromedioHistorial = useMemo(() => resumenHistorialDiario.flatMap(item =>
    HISTORIAL_COLUMNAS.flatMap(col => {
      const valor = numero(item.promedios?.[col.codigo]);
      const rango = RANGOS_TEMPERATURA[col.codigo];
      return valor !== null && rango && (valor < rango.min || valor > rango.max)
        ? [{ fecha: item.fecha, codigo: col.codigo, zona: col.zona, variable: col.variable, valor }]
        : [];
    })
  ), [resumenHistorialDiario]);

  const totalDia = Array.isArray(historial?.Dia?.horas) ? historial.Dia.horas.length : Array.isArray(historial?.Dia) ? historial.Dia.length : 0;
  const totalNoche = Array.isArray(historial?.Noche?.horas) ? historial.Noche.horas.length : Array.isArray(historial?.Noche) ? historial.Noche.length : 0;
  const totalDelDia = totalDia + totalNoche;
  const textoUltimaActualizacion = ultimaActualizacionHistorial && !Number.isNaN(ultimaActualizacionHistorial.getTime())
    ? `${ultimaActualizacionHistorial.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} · ${ultimaActualizacionHistorial.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} CLT`
    : 'Sin registros cargados';

  const Encabezado = ({ titulo, subtitulo, volver = true, onVolver = volverMenu }) => (
    <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="h-[58px] px-4 md:px-6 flex items-center gap-3">
        {volver ? (
          <button onClick={onVolver} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
        ) : onAbrirMenu ? (
          <button onClick={onAbrirMenu} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
            <Menu className="w-5 h-5" />
          </button>
        ) : null}
        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#E96008] flex items-center justify-center"><Thermometer className="w-5 h-5" /></div>
        <div className="min-w-0">
          <h1 className="text-[18px] md:text-[20px] font-extrabold text-slate-900 truncate">{titulo}</h1>
          <p className="text-[12px] text-slate-500 truncate">{subtitulo}</p>
        </div>
      </div>
    </div>
  );

  const BotonExportarExcel = () => esAdministrador ? (
    <button
      type="button"
      onClick={exportarExcel}
      disabled={exportando}
      className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold inline-flex items-center gap-2 shadow-sm disabled:opacity-60 transition-colors"
    >
      {exportando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {exportando ? 'Exportando...' : 'Exportar Excel'}
    </button>
  ) : null;

  const DialogosEliminacion = () => (
    <>
      {confirmacionEliminacion && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-eliminar-temperatura" className="fixed inset-0 z-[360] flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[22px] bg-white border border-slate-200 shadow-2xl p-5">
            <span className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></span>
            <h3 id="titulo-eliminar-temperatura" className="mt-3 text-[17px] font-extrabold text-slate-900">¿Eliminar definitivamente?</h3>
            <p className="mt-2 text-[13px] leading-5 text-slate-600">
              {confirmacionEliminacion.tipo === 'fecha'
                ? `Se eliminarán todas las mediciones del ${formatearFechaTitulo(confirmacionEliminacion.fecha)}, incluyendo turnos Día y Noche. Esta acción es irreversible.`
                : `Se eliminará toda la medición de las ${confirmacionEliminacion.hora} del turno ${confirmacionEliminacion.turno === 'Dia' ? 'Día' : 'Noche'}, fecha ${formatearFechaCorta(confirmacionEliminacion.fecha)}. Esta acción es irreversible.`}
            </p>
            {mostrarAutorizacionEliminacion && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
                <p className="text-[12px] font-semibold text-amber-950">Autorizar esta eliminación</p>
                <p className="text-[11px] leading-4 text-amber-900/80">Confirma tu usuario y contraseña de EVAP una vez. No se cambiará tu sesión de inspección.</p>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Usuario
                  <input type="text" autoComplete="username" value={usuarioAutorizacion} onChange={e => setUsuarioAutorizacion(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
                </label>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Contraseña
                  <input type="password" autoComplete="current-password" value={passwordAutorizacion} onChange={e => setPasswordAutorizacion(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-[13px] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
                </label>
                {errorAutorizacionEliminacion && <p role="alert" className="text-[11px] text-rose-700 font-medium">{errorAutorizacionEliminacion}</p>}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={cerrarConfirmacionEliminacion} disabled={eliminandoHistorial} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={eliminarRegistroDesdeHistorial} disabled={eliminandoHistorial} className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold disabled:opacity-60 flex items-center gap-2">
                {eliminandoHistorial ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {eliminandoHistorial ? 'Eliminando...' : mostrarAutorizacionEliminacion ? 'Autorizar y eliminar' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (vista === 'menu') return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <Encabezado titulo="Control Temperatura" subtitulo="Seleccione la acción que desea realizar" volver={false} />
      <div className="min-h-[calc(100%-58px)] p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#E96008]">Registro térmico</p>
            <h2 className="text-[22px] md:text-[28px] font-black text-slate-900">Temperatura línea de proceso</h2>
            <p className="text-[12px] md:text-[13px] text-slate-500 mt-1">Seleccione si desea crear un registro o consultar mediciones anteriores.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => registroAbiertoHoy ? restaurarRegistro(registroAbiertoHoy) : abrirConfiguracion()} className={`group text-left rounded-[22px] p-5 md:p-6 shadow-sm hover:shadow-md transition-all border ${registroAbiertoHoy ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400' : 'bg-white border-orange-200 hover:border-orange-300'}`}>
              <div className="flex justify-between"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${registroAbiertoHoy ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-50 text-[#E96008]'}`}>{registroAbiertoHoy ? <History className="w-6 h-6" /> : <FilePlus2 className="w-6 h-6" />}</div><ChevronRight className={`w-5 h-5 ${registroAbiertoHoy ? 'text-emerald-500' : 'text-slate-300 group-hover:text-[#E96008]'}`} /></div>
              <h3 className="text-[17px] font-extrabold text-slate-900 mt-5">{registroAbiertoHoy ? 'Continuar con registro' : 'Nuevo registro'}</h3>
              <p className="text-[12px] text-slate-500 mt-1.5">{registroAbiertoHoy ? `Retomar las mediciones del ${formatearFechaCorta(registroAbiertoHoy.fecha)}, turno ${registroAbiertoHoy.turno === 'Dia' ? 'Día' : 'Noche'}.` : 'Ingrese las temperaturas horarias correspondientes al día y turno.'}</p>
            </button>
            <button onClick={() => setVista('historial')} className="group text-left bg-white border border-slate-200 hover:border-slate-300 rounded-[22px] p-5 md:p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between"><div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center"><History className="w-6 h-6" /></div><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600" /></div>
              <h3 className="text-[17px] font-extrabold text-slate-900 mt-5">Historial de mediciones diarias</h3>
              <p className="text-[12px] text-slate-500 mt-1.5">Consulte registros por fecha, turno, hora y proceso asociado.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (vista === 'configurar') return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <div className="md:hidden p-2.5">
        <section className="min-h-[calc(100vh-20px)] bg-white rounded-[22px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <header className="px-4 pt-3 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {onAbrirMenu ? (
                  <button onClick={onAbrirMenu} aria-label="Abrir menú" className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                    <Menu className="w-4.5 h-4.5" />
                  </button>
                ) : (
                  <button onClick={() => setVista('menu')} aria-label="Volver" className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                    <ArrowLeft className="w-4.5 h-4.5" />
                  </button>
                )}
                <div className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#EA580C] truncate">Control temperatura linea proceso</span>
                  <h1 className="text-[29px] leading-none font-black tracking-tight text-slate-900 mt-1">Nuevo registro</h1>
                </div>
              </div>
              <button type="button" onClick={() => setVista('menu')} className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-500 transition-colors shrink-0">Atrás</button>
            </div>
          </header>

          <main className="flex-1 bg-slate-50 px-4 pt-4 pb-5 flex flex-col">
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Configuración del registro</span>
              <h2 className="text-[17px] font-bold text-slate-900 mt-1">Selecciona fecha y turno</h2>
              <p className="text-[11px] leading-relaxed text-slate-500 mt-1.5 max-w-[260px]">Define primero la fecha y el turno de proceso para asociar las mediciones.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-[18px] p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="fecha-input-movil" className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">Fecha del registro</label>
                  <button type="button" onClick={() => setFecha(fechaHoy())} className="text-[11px] font-bold text-[#EA580C] hover:text-[#C2410C] transition-colors">Hoy</button>
                </div>
                <div className="relative flex items-center h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 transition-all focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10">
                  <input id="fecha-input-movil" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-slate-800 outline-none cursor-pointer" />
                  <CalendarDays className="w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Predeterminado: {formatearFechaCorta(fecha)}</p>
              </div>

              <div className="bg-white rounded-[18px] p-4 border border-slate-200 shadow-sm">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 mb-3">Turno de proceso</span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button type="button" onClick={() => setTurno('Dia')} className={`h-11 rounded-lg text-[14px] transition-all border ${turno === 'Dia' ? 'bg-white border-orange-500 text-[#EA580C] font-bold shadow-sm' : 'border-transparent text-slate-500 font-semibold'}`}>Día</button>
                  <button type="button" onClick={() => setTurno('Noche')} className={`h-11 rounded-lg text-[14px] transition-all border ${turno === 'Noche' ? 'bg-white border-orange-500 text-[#EA580C] font-bold shadow-sm' : 'border-transparent text-slate-500 font-semibold'}`}>Noche</button>
                </div>
              </div>

              <div className="rounded-[18px] p-4 bg-orange-50/60 border border-orange-200/70">
                <p className="text-[11px] font-bold text-orange-900 mb-1.5">Aviso de registro</p>
                <p className="text-[11px] leading-relaxed text-orange-900/80 max-w-[280px]">Estos datos quedarán asociados a todas las mediciones que ingreses a continuación.</p>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button type="button" onClick={iniciarRegistro} className="w-full h-12 rounded-2xl bg-[#F45D01] hover:bg-[#E05300] active:scale-[0.98] text-white font-bold text-[14px] shadow-[0_10px_24px_-8px_rgba(234,88,12,0.5)] inline-flex items-center justify-center gap-2 transition-all">
                <span>{registroAbiertoConfigurado ? 'Continuar con registro' : 'Continuar al registro'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </main>
        </section>
      </div>

      <div className="hidden md:flex min-h-[calc(100%-58px)] p-6 xl:p-8 items-center justify-center">
        <section className="w-full max-w-4xl bg-white border border-[#F1F5F9] rounded-[26px] shadow-[0_1px_3px_0_rgb(0_0_0_/_0.05)] p-6 xl:p-8">
          <div className="mb-7">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#EA580C]">Configuración del registro</p>
            <h2 className="text-[28px] font-black text-slate-900 mt-1 tracking-tight">Selecciona fecha y turno</h2>
            <p className="text-[13px] text-slate-500 mt-1.5">Define primero la fecha y el turno de proceso para asociar las mediciones. El diseño conserva la misma estética minimalista de la versión móvil.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="fecha-input-desktop" className="text-xs font-bold uppercase tracking-wider text-slate-700">Fecha del registro</label>
                <button type="button" onClick={() => setFecha(fechaHoy())} className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">Hoy</button>
              </div>
              <div className="relative flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 shadow-sm transition-all focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10">
                <input id="fecha-input-desktop" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none cursor-pointer" />
                <CalendarDays className="w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Predeterminado: {formatearFechaCorta(fecha)}</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">Turno de proceso</span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button type="button" onClick={() => setTurno('Dia')} className={`py-3 px-4 rounded-lg text-sm transition-all border ${turno === 'Dia' ? 'bg-white border-orange-500 text-[#EA580C] shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 border-transparent font-medium'}`}>Día</button>
                <button type="button" onClick={() => setTurno('Noche')} className={`py-3 px-4 rounded-lg text-sm transition-all border ${turno === 'Noche' ? 'bg-white border-orange-500 text-[#EA580C] shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900 border-transparent font-medium'}`}>Noche</button>
              </div>

              <div className="mt-5 rounded-2xl p-4 bg-orange-50/60 border border-orange-200/60">
                <p className="text-xs font-bold text-orange-950 mb-1">Aviso de registro</p>
                <p className="text-xs text-orange-900/80 leading-relaxed">Estos datos quedarán asociados a todas las mediciones que ingreses a continuación.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button type="button" onClick={iniciarRegistro} className="h-12 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-orange-600/25 inline-flex items-center justify-center gap-2 transition-all">
              <span>{registroAbiertoConfigurado ? 'Continuar con registro' : 'Continuar al registro'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  if (vista === 'historial') return (
    <div className="w-full h-full overflow-y-auto bg-[#FAF8FF] md:bg-[#F8FAFC]" style={{ ...FUENTE_INTER, fontFamily: "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style>{`@keyframes evapHistorialShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <header className="md:hidden sticky top-0 z-30 border-b border-slate-200/80 bg-[#FAF8FF]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[56px] max-w-md items-center gap-2 px-4">
          <button type="button" onClick={volverMenu} aria-label="Volver al menú" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 active:scale-95"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-tight text-slate-900">{historialTabMovil === 'resumen' ? 'Resumen Diario' : historialTabMovil === 'graficos' ? 'Gráficos' : 'Alertas'}</h1>
          <button type="button" onClick={() => cargarResumenHistorial()} disabled={cargandoResumen} aria-label="Actualizar historial" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white active:scale-95 disabled:opacity-50"><RefreshCw className={`h-[17px] w-[17px] ${cargandoResumen ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>
      <header className="hidden md:block bg-white border-b border-[#F1F5F9]">
        <div className="mx-auto max-w-7xl min-h-[70px] px-6 xl:px-8 flex items-center gap-3">
          <button type="button" onClick={volverMenu} aria-label="Volver" className="w-9 h-9 shrink-0 rounded-full border border-slate-200 bg-white inline-flex items-center justify-center text-slate-600 hover:bg-slate-50"><ArrowLeft className="w-4 h-4" /></button>
          <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100/60 text-amber-500 flex items-center justify-center"><BarChart3 className="w-[18px] h-[18px]" /></div>
          <div className="min-w-0"><h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Historial de mediciones diarias</h1><p className="text-[13px] text-slate-500">Resumen diario de mediciones</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 pt-3 pb-24 md:max-w-7xl md:px-6 md:py-6 xl:px-8">
        <section className="md:hidden flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-2.5 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-600">
            <Clock3 className="h-4 w-4 shrink-0 text-[#2563EB]" />
            <span className="truncate">Última carga: {ultimaActualizacionHistorial && !Number.isNaN(ultimaActualizacionHistorial.getTime()) ? `${ultimaActualizacionHistorial.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })} · ${ultimaActualizacionHistorial.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}` : 'Sin datos'}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          {esAdministrador && <button type="button" onClick={exportarExcel} disabled={exportando} className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-[10px] font-bold text-blue-700 active:scale-95 disabled:opacity-50"><Download className="h-3.5 w-3.5" />{exportando ? 'Exportando' : 'Exportar'}</button>}
        </section>

        <section className="md:hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'resumen', nombre: 'Resumen', icono: <CalendarDays className="h-4 w-4" /> },
              { id: 'graficos', nombre: 'Gráficos', icono: <BarChart3 className="h-4 w-4" /> },
              { id: 'alertas', nombre: 'Alertas', icono: <ShieldAlert className="h-4 w-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistorialTabMovil(tab.id)}
                aria-current={historialTabMovil === tab.id ? 'page' : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all active:scale-95 ${historialTabMovil === tab.id ? 'bg-[#EFF6FF] text-[#2563EB] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {tab.icono}
                <span>{tab.nombre}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hidden md:flex bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3 items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Última información cargada: <strong className="font-semibold text-slate-800">{textoUltimaActualizacion}</strong></span>
            <span className="relative inline-flex w-2.5 h-2.5 shrink-0 rounded-full bg-emerald-500"><span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" /></span>
          </div>
          <BotonExportarExcel />
        </section>

        {mensajeExportacion && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700">{mensajeExportacion}</div>}
        {errorResumen && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700">{errorResumen}</div>}
        {errorEliminacion && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">{errorEliminacion}</div>}
        {mensajeEliminacion && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">{mensajeEliminacion}</div>}

        <section className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <div><h2 className="text-[13px] font-extrabold uppercase tracking-[0.02em] text-slate-900">Resumen diario</h2><p className="mt-0.5 text-[12px] text-slate-500">Selecciona cualquier fecha para abrir el registro completo de ese día.</p></div>
            <div className="relative w-64"><input value={busquedaResumen} onChange={e => setBusquedaResumen(e.target.value)} placeholder="Buscar fecha..." aria-label="Buscar fecha" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 text-[12px] outline-none focus:ring-2 focus:ring-slate-100" /><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div>
          </div>
          <div className="overflow-auto" style={{ height: ALTO_TABLA_HISTORIAL }}>
            {cargandoResumen ? <div className="flex h-full items-center justify-center gap-2 text-[12px] text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" />Cargando historial...</div> : resumenHistorialFiltrado.length === 0 ? <div className="flex h-full items-center justify-center text-[12px] text-slate-400">No existen registros de temperatura para esta búsqueda.</div> : (
<table className="w-full min-w-[1000px] table-fixed border-collapse">
                  <colgroup>
                    <col style={{ width: 68 }} />
                    <col style={{ width: 108 }} />
                    <col style={{ width: 58 }} />
                    {HISTORIAL_COLUMNAS.map(col => <col key={col.codigo} style={{ width: 66 }} />)}
                    <col style={{ width: 114 }} />
                    <col style={{ width: 44 }} />
                  </colgroup>
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-1.5 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Detalle</th>
                      <th className="px-1.5 py-3 text-left text-[10px] font-extrabold uppercase text-slate-500">Fecha</th>
                      <th className="px-1 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">N° med.</th>
                      {HISTORIAL_COLUMNAS.map(col => {
                        const estilo = estiloHistorialPorCodigo(col.codigo);
                        return (
                          <th key={col.codigo} className={`px-0.5 py-2.5 border-b-2 text-center ${estilo.fondo} ${estilo.borde}`}>
                            <span className="block text-[9px] leading-3 font-extrabold tracking-tight uppercase text-slate-800">{etapaHistorial(col.zona)}</span>
                            <span className={`block mt-0.5 text-[9px] leading-3 font-bold ${estilo.texto}`}>{variableHistorial(col.variable)}</span>
                          </th>
                        );
                      })}
                      <th className="px-1 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Rango horario</th>
                      <th className="px-0.5 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenHistorialPaginado.map(item => (
                      <tr key={String(item.fecha)} className="group relative z-0 h-12 border-b border-slate-100 bg-white hover:z-10 hover:bg-blue-50/80 hover:scale-[1.006] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out">
                        <td className="px-1 py-2 text-center">
                          <button type="button" onClick={() => abrirDetalleHistorial(item)} className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 text-[11px] font-medium text-blue-600 hover:bg-blue-100"><Eye className="w-3 h-3" />Ver</button>
                        </td>
                        <td className="px-1.5 py-2 text-left text-[11px] font-bold text-slate-900 whitespace-nowrap">{formatearFechaHistorial(item.fecha)}</td>
                        <td className="px-1 py-2 text-center text-[11px] font-semibold text-slate-700 tabular-nums">{item.mediciones}</td>
                        {HISTORIAL_COLUMNAS.map(col => {
                          const valor = numero(item.promedios?.[col.codigo]);
                          return (
                            <td key={col.codigo} className="px-0.5 py-2 text-center">
                              <span className="inline-flex h-7 min-w-[54px] items-center justify-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 group-hover:bg-white transition-colors">
                                <span className="text-[11px] font-bold tabular-nums text-slate-900">{valor === null ? '--' : formatear(valor)}</span>
                                {valor !== null && <span className="text-[9px] font-normal text-slate-400">°C</span>}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-1 py-2 text-center text-[11px] font-medium font-mono text-slate-600 tabular-nums whitespace-nowrap">{item.primeraHora || '--'} - {item.ultimaHora || '--'}</td>
                        <td className="px-0.5 py-2 text-center">
                          <button type="button" onClick={() => accionesRegistro('fecha', String(item.fecha).slice(0, 10))} title="Opciones" aria-label={`Eliminar registro del ${formatearFechaCorta(item.fecha)}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><MoreVertical className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            <span>Mostrando <strong className="text-slate-700">{resumenHistorialPaginado.length}</strong> de <strong className="text-slate-700">{resumenHistorialFiltrado.length}</strong> fechas · 15 por página, 12 filas visibles</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPaginaResumen(n => Math.max(1, n - 1))} disabled={paginaActualResumen <= 1} className="h-8 rounded-lg border border-slate-200 px-2.5 text-slate-600 disabled:opacity-30">Anterior</button>
              <span className="px-2 text-[11px] font-semibold tabular-nums text-slate-600">Página {paginaActualResumen} de {cantidadPaginasResumen}</span>
              <button type="button" onClick={() => setPaginaResumen(n => Math.min(cantidadPaginasResumen, n + 1))} disabled={paginaActualResumen >= cantidadPaginasResumen} className="h-8 rounded-lg border border-slate-200 px-2.5 text-slate-600 disabled:opacity-30">Siguiente</button>
            </div>
          </div>
        </section>

        {historialTabMovil === 'resumen' && (
          <section className="md:hidden space-y-3">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={busquedaResumen} onChange={e => setBusquedaResumen(e.target.value)} placeholder="Buscar por fecha..." aria-label="Buscar por fecha" className="h-[42px] w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
            <div className="h-[690px] space-y-2.5 overflow-y-auto pr-0.5" aria-label="Fechas del historial">
              {cargandoResumen ? <div className="flex h-full items-center justify-center gap-2 text-[12px] text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" />Cargando fechas...</div> : resumenHistorialPaginado.length === 0 ? <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center text-[12px] text-slate-500">No hay fechas registradas que coincidan con la búsqueda.</div> : resumenHistorialPaginado.map(item => {
                const abierta = String(fechaMovilActual || '') === String(item.fecha || '');
                const chipsCompactos = [
                  { codigo: 'pulpa-sellado', etiqueta: 'Pulpa', clase: 'border-rose-100 bg-rose-50 text-rose-700' },
                  { codigo: 'ambiente-sellado', etiqueta: 'Amb Sellado', clase: 'border-amber-100 bg-amber-50 text-amber-700' },
                  { codigo: 'amb-palletizaje', etiqueta: 'Amb Paletizado', clase: 'border-amber-100 bg-amber-50 text-amber-700' }
                ];
                return (
                  <article key={item.fecha} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    {abierta && <div className="h-1.5 bg-gradient-to-r from-[#2563EB] via-[#E11D48] to-[#F59E0B]" style={{ backgroundSize: '200% 100%', animation: 'evapHistorialShimmer 5s linear infinite' }} />}
                    <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-2">
                      <button type="button" onClick={() => setFechaExpandidaMovil(abierta ? '' : item.fecha)} aria-expanded={abierta} aria-label={`${abierta ? 'Contraer' : 'Expandir'} ${formatearFechaHistorial(item.fecha)}`} className="min-w-0 flex-1 text-left active:scale-[0.99]">
                        <div className="flex flex-wrap items-center gap-1.5"><span className={`${abierta ? 'text-[16px]' : 'text-[13px]'} font-bold text-slate-900`}>{formatearFechaHistorial(item.fecha)}</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{item.mediciones} medición{Number(item.mediciones) === 1 ? '' : 'es'}</span></div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-500"><Clock3 className="h-3 w-3 text-slate-500" /><span className="tabular-nums">{item.primeraHora || '--:--'} - {item.ultimaHora || '--:--'}</span><span className="text-blue-500">· {textoTurnoFecha(item.fecha)}</span></div>
                      </button>
                      <button type="button" onClick={() => abrirDetalleHistorial(item)} aria-label={`Ver detalle del ${formatearFechaHistorial(item.fecha)}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F1F4FE] text-[#2563EB] active:scale-95"><Eye className="h-4 w-4" /></button>
                      <button type="button" onClick={() => accionesRegistro('fecha', String(item.fecha).slice(0, 10))} aria-label={`Opciones de ${formatearFechaHistorial(item.fecha)}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F1F4FE] text-slate-600 active:scale-95"><MoreVertical className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setFechaExpandidaMovil(abierta ? '' : item.fecha)} aria-expanded={abierta} aria-label="Expandir o contraer fecha" className="flex h-8 w-6 shrink-0 items-center justify-center text-slate-500"><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} /></button>
                    </div>
                    {abierta ? (
                      <div className="px-2.5 pb-2.5"><GruposTemperaturasMovil valores={item.promedios} /></div>
                    ) : (
                      <div className="flex gap-1.5 overflow-x-auto px-2.5 pb-2.5">
                        {chipsCompactos.map(chip => {
                          const valor = numero(item.promedios?.[chip.codigo]);
                          return <span key={chip.codigo} className={`shrink-0 rounded-md border px-2 py-1 text-[9px] font-semibold ${chip.clase}`}>{chip.etiqueta}: {valor === null ? '--' : formatear(valor)}°C</span>;
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-[11px] text-slate-500 shadow-sm">
              <p className="text-center">Mostrando <strong className="text-slate-700">{resumenHistorialPaginado.length}</strong> de <strong className="text-slate-700">{resumenHistorialFiltrado.length}</strong> fechas</p>
              <div className="flex items-center justify-center gap-1.5">
                <button type="button" onClick={() => setPaginaResumen(n => Math.max(1,n-1))} disabled={paginaActualResumen <= 1} className="h-8 rounded-lg border border-slate-200 px-2 text-[10px] disabled:opacity-30">Anterior</button>
                {Array.from({ length: cantidadPaginasResumen }, (_, i) => i + 1).filter(pag => Math.abs(pag - paginaActualResumen) <= 1).map(pag => <button key={pag} type="button" onClick={() => setPaginaResumen(pag)} aria-current={pag === paginaActualResumen ? 'page' : undefined} className={`h-8 w-8 rounded-xl text-[11px] font-bold ${pag === paginaActualResumen ? 'bg-[#2563EB] text-white' : 'border border-slate-200 text-slate-600'}`}>{pag}</button>)}
                <button type="button" onClick={() => setPaginaResumen(n => Math.min(cantidadPaginasResumen,n+1))} disabled={paginaActualResumen >= cantidadPaginasResumen} className="h-8 rounded-lg border border-slate-200 px-2 text-[10px] disabled:opacity-30">Siguiente</button>
              </div>
            </div>
          </section>
        )}
        {historialTabMovil === 'graficos' && (
          <section className="md:hidden space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-[14px] font-bold text-slate-900">Mediciones por fecha</h2>
            <p className="text-[11px] text-slate-500">Comparación de las 8 fechas más recientes del historial.</p>
            {resumenHistorialDiario.slice(0, 8).map(item => {
              const max = Math.max(1, ...resumenHistorialDiario.slice(0, 8).map(x => Number(x.mediciones) || 0));
              return <div key={item.fecha} className="space-y-1"><div className="flex justify-between text-[11px] font-medium text-slate-700"><span>{formatearFechaHistorial(item.fecha)}</span><span>{item.mediciones}</span></div><div className="h-2 rounded-full bg-blue-50"><div className="h-2 rounded-full bg-[#2563EB]" style={{ width: `${Math.max(0,Number(item.mediciones)||0) / max * 100}%` }} /></div></div>;
            })}
            {!resumenHistorialDiario.length && <p className="text-[12px] text-slate-500">Sin datos disponibles.</p>}
          </section>
        )}
        {historialTabMovil === 'alertas' && (
          <section className="md:hidden space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-[14px] font-bold text-slate-900">Promedios fuera de rango</h2>
            <p className="text-[11px] leading-4 text-slate-500">Este listado evalúa promedios diarios, no cada medición individual. Revisa el detalle para identificar cada desviación.</p>
            {alertasPromedioHistorial.slice(0, 40).map((alerta,i) => <button key={`${alerta.fecha}-${alerta.codigo}-${i}`} type="button" onClick={() => abrirDetalleHistorial({ fecha: alerta.fecha })} className="flex w-full items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-left text-[11px] text-rose-800"><ShieldAlert className="h-4 w-4 shrink-0" /><span className="flex-1">{formatearFechaHistorial(alerta.fecha)} · {alerta.zona} / {alerta.variable}</span><strong className="whitespace-nowrap tabular-nums">{formatear(alerta.valor)} °C</strong></button>)}
            {!alertasPromedioHistorial.length && <p className="rounded-xl bg-emerald-50 p-3 text-[12px] text-emerald-800">Sin promedios fuera de rango en las fechas cargadas.</p>}
          </section>
        )}
      </main>
      {DialogosEliminacion()}
    </div>
  );

  if (vista === 'historial-detalle') return (
    <div className="h-full w-full overflow-y-auto bg-[#FAF8FF] md:bg-[#F8FAFC]" style={{ ...FUENTE_INTER, fontFamily: "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header className="md:hidden sticky top-0 z-30 border-b border-slate-200/80 bg-[#FAF8FF]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <button type="button" onClick={() => setVista('historial')} aria-label="Volver al historial" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 active:scale-95"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <div className="min-w-0 flex-1"><h1 className="truncate text-[18px] font-bold tracking-tight text-slate-900">Detalle diario</h1><p className="text-[10px] font-medium text-slate-500">{formatearFechaHistorial(historialFecha)}</p></div>
          <button type="button" onClick={() => cargarHistorial(historialFecha)} disabled={cargandoHistorial} aria-label="Actualizar detalle" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white disabled:opacity-40"><RefreshCw className={`h-[17px] w-[17px] ${cargandoHistorial ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>
      <header className="hidden md:block border-b border-slate-100 bg-white">
        <div className="mx-auto flex min-h-[70px] max-w-7xl items-center gap-3 px-6 xl:px-8">
          <button type="button" onClick={() => setVista('historial')} aria-label="Volver al historial" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100/60 text-amber-500"><BarChart3 className="h-[18px] w-[18px]" /></div>
          <div><h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Detalle de mediciones diarias</h1><p className="text-[13px] text-slate-500">{formatearFechaHistorial(historialFecha)} · Registros por hora y turno</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 pt-3 pb-24 md:max-w-7xl md:px-6 md:py-6 xl:px-8">
        <section className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:rounded-xl md:px-4 md:py-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-medium text-slate-600 md:text-[12px]"><Clock3 className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">Última carga: {textoUltimaActualizacion}</span><span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" /></div>
          <button type="button" onClick={() => cargarHistorial(historialFecha)} disabled={cargandoHistorial || guardandoEdicionHistorial} className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${cargandoHistorial ? 'animate-spin' : ''}`} />Actualizar</button>
        </section>
        {errorHistorial && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700">{errorHistorial}</div>}
        {errorEliminacion && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">{errorEliminacion}</div>}
        {mensajeEliminacion && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">{mensajeEliminacion}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-3 py-3.5 md:flex-row md:items-center md:justify-between md:px-4">
            <div>
              <h2 className="text-[13px] font-extrabold uppercase tracking-[0.02em] text-slate-900">Detalle del día · {formatearFechaHistorial(historialFecha)}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">{totalDia} medición{totalDia === 1 ? '' : 'es'} turno Día · {totalNoche} medición{totalNoche === 1 ? '' : 'es'} turno Noche</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Dentro de rango</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Advertencia</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Fuera de rango</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {modoEdicionHistorial ? (
                <><button type="button" onClick={cancelarEdicionHistorial} disabled={guardandoEdicionHistorial} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600">Cancelar</button><button type="button" onClick={guardarEdicionHistorial} disabled={guardandoEdicionHistorial} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#F97316] px-3 text-[11px] font-bold text-white disabled:opacity-50">{guardandoEdicionHistorial ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Guardar cambios</button></>
              ) : <button type="button" onClick={iniciarEdicionHistorial} disabled={cargandoHistorial || !historialPlano.length} className="flex h-9 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 text-[11px] font-bold text-orange-700 disabled:opacity-50"><PencilLine className="h-3.5 w-3.5" />Editar datos</button>}
            </div>
          </div>

          <div className="hidden md:block overflow-auto" style={{ height: ALTO_TABLA_HISTORIAL }}>
            {cargandoHistorial ? <div className="flex h-full items-center justify-center text-[12px] text-slate-400">Cargando mediciones...</div> : historialPaginado.length === 0 ? <div className="flex h-full items-center justify-center text-[12px] text-slate-400">No existen mediciones para esta fecha.</div> : (
              <table className="w-full min-w-[880px] table-fixed border-collapse">
                <colgroup><col style={{ width: 84 }} /><col style={{ width: 78 }} />{HISTORIAL_COLUMNAS.map(col => <col key={col.codigo} style={{ width: 68 }} />)}<col style={{ width: 50 }} /></colgroup>
                <thead className="sticky top-0 z-20 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-1 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Turno</th>
                    <th className="px-1 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Hora</th>
                    {HISTORIAL_COLUMNAS.map(col => {
                      const estilo = estiloHistorialPorCodigo(col.codigo);
                      return <th key={col.codigo} className={`border-b-2 px-0.5 py-2.5 text-center ${estilo.fondo} ${estilo.borde}`}><span className="block text-[9px] font-extrabold uppercase leading-3 tracking-tight text-slate-800">{etapaHistorial(col.zona)}</span><span className={`mt-0.5 block text-[9px] font-bold leading-3 ${estilo.texto}`}>{variableHistorial(col.variable)}</span></th>;
                    })}
                    <th className="px-0.5 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPaginado.map(row => <tr key={row.id} className="group relative z-0 h-12 border-b border-slate-100 bg-white transition-all duration-200 ease-out hover:z-10 hover:scale-[1.006] hover:bg-blue-50/80 hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.08)]">
                    <td className="px-1 py-2 text-center"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${TURNOS_INFO[row.turno].badge}`}>{row.turno === 'Dia' ? 'Día' : 'Noche'}</span></td>
                    <td className="px-1 py-2 text-center font-mono text-[11px] font-semibold tabular-nums text-slate-700">{row.hora}</td>
                    {HISTORIAL_COLUMNAS.map(col => {
                      const value = row.valores?.[col.codigo] ?? null;
                      const editValue = edicionesHistorial[row.id]?.[col.codigo] ?? (value === null ? '' : String(value).replace('.', ','));
                      return <td key={col.codigo} className="px-0.5 py-2 text-center">{modoEdicionHistorial ? <input type="text" inputMode="decimal" value={editValue} onChange={e => actualizarEdicionHistorial(row.id, col.codigo, e.target.value)} placeholder="--" className={`h-8 w-[60px] rounded-lg border px-1 text-center text-[11px] font-bold outline-none focus:ring-2 focus:ring-orange-200 ${claseInputTemperatura(col.codigo, editValue, true)}`} /> : <span className={`inline-flex h-7 min-w-[54px] items-center justify-center gap-0.5 rounded-full px-1.5 ${claseCeldaTemperatura(col.codigo, value)} ${value === null ? 'border border-slate-200 bg-slate-50' : ''}`}><span className="text-[11px] font-bold tabular-nums">{value === null ? '--' : formatear(value)}</span>{value !== null && <span className="text-[9px] font-normal opacity-60">°C</span>}</span>}</td>;
                    })}
                    <td className="px-1 py-2 text-center"><button type="button" disabled={modoEdicionHistorial} onClick={() => accionesRegistro('hora', row.fecha, row.turno, row.hora)} aria-label={`Eliminar medición de las ${row.hora}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"><MoreVertical className="h-4 w-4" /></button></td>
                  </tr>)}
                </tbody>
              </table>
            )}
          </div>

          <div className="md:hidden h-[690px] space-y-2.5 overflow-y-auto bg-[#FAF8FF] p-2.5">
            {cargandoHistorial ? <div className="flex h-full items-center justify-center text-[12px] text-slate-400">Cargando mediciones...</div> : historialPaginado.length === 0 ? <div className="flex h-full items-center justify-center text-[12px] text-slate-500">Sin mediciones en este día.</div> : historialPaginado.map(row => {
              const abierta = String(row.id) === String(horaMovilActual);
              const chips = [
                { codigo: 'pulpa-sellado', titulo: 'Pulpa' },
                { codigo: 'ambiente-sellado', titulo: 'Amb Sellado' },
                { codigo: 'amb-palletizaje', titulo: 'Amb Paletizado' }
              ];
              return <article key={row.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {abierta && <div className="h-1.5 bg-gradient-to-r from-[#2563EB] via-[#E11D48] to-[#F59E0B]" />}
                <div className="flex items-start gap-2 px-2.5 py-2.5">
                  <button type="button" onClick={() => setHoraExpandidaMovil(abierta ? '' : row.id)} aria-expanded={abierta} aria-label={`${abierta ? 'Contraer' : 'Expandir'} la medición ${row.hora}`} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5"><span className="text-[15px] font-bold tabular-nums text-slate-900">{row.hora}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TURNOS_INFO[row.turno].badge}`}>Turno {row.turno === 'Dia' ? 'Día' : 'Noche'}</span></div>
                    <div className="mt-1 text-[10px] text-slate-500">{Object.values(row.valores || {}).filter(x => numero(x) !== null).length} de {HISTORIAL_COLUMNAS.length} temperaturas registradas</div>
                  </button>
                  <button type="button" onClick={() => accionesRegistro('hora', row.fecha, row.turno, row.hora)} disabled={modoEdicionHistorial} aria-label={`Opciones medición ${row.hora}`} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1F4FE] text-slate-600 disabled:opacity-40"><MoreVertical className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setHoraExpandidaMovil(abierta ? '' : row.id)} aria-expanded={abierta} aria-label="Expandir o contraer" className="flex h-8 w-7 items-center justify-center text-slate-500"><ChevronDown className={`h-4 w-4 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} /></button>
                </div>
                {abierta ? <div className="px-2.5 pb-2.5"><GruposTemperaturasMovil valores={row.valores} detalle edicion={modoEdicionHistorial} valoresEditados={edicionesHistorial[row.id] || {}} onEditar={(codigo,valor) => actualizarEdicionHistorial(row.id,codigo,valor)} /></div> : <div className="flex gap-1.5 overflow-x-auto px-2.5 pb-2.5">{chips.map(chip => {
                  const value = row.valores?.[chip.codigo] ?? null;
                  return <span key={chip.codigo} className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${claseCeldaTemperatura(chip.codigo, value)} ${value === null ? 'border border-slate-200 bg-slate-50' : ''}`}>{chip.titulo}: {value === null ? '--' : formatear(value)} °C</span>;
                })}</div>}
              </article>;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-3 py-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5"><label htmlFor="historial-detalle-pagina" className="font-semibold">Ver:</label><select id="historial-detalle-pagina" value={pageSizeHistorial} onChange={e => setPageSizeHistorial(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold"><option value="all">Todas</option><option value="5">5</option><option value="10">10</option><option value="15">15</option><option value="20">20</option></select></div>
            <p>Mostrando <strong className="text-slate-700">{historialPaginado.length}</strong> de <strong className="text-slate-700">{totalDelDia}</strong> mediciones</p>
          </div>
        </section>
      </main>
      {DialogosEliminacion()}
    </div>
  );

  return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <style>{`
        @keyframes fadeUpModule { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseSoft { 0%,100% { opacity: .68; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      `}</style>

      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#F1F5F9]">
        <div className="min-h-[62px] px-3 py-2 flex items-center gap-2.5">
          <button
            type="button"
            onClick={volverMenu}
            aria-label="Volver"
            className="w-10 h-10 shrink-0 rounded-full bg-[#F1F5F9] text-[#475569] flex items-center justify-center active:scale-95"
          >
            <ArrowLeft className="w-[19px] h-[19px]" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.09em] text-[#94A3B8] uppercase">
              <span className="w-[6px] h-[6px] rounded-full bg-[#10B981] shrink-0" />
              Línea de embalaje
            </div>
            <h1 className="text-[18px] leading-[23px] font-extrabold tracking-[-0.025em] text-[#0F172A] truncate">Control Temperatura</h1>
          </div>
          <span
            title={registroGuardado ? 'Registro guardado' : 'Control de temperatura activo'}
            className="w-10 h-10 shrink-0 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
          </span>
        </div>
      </header>

      <div className="hidden md:block sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#F1F5F9]">
        <div className="mx-auto max-w-[1220px] px-5 xl:px-6 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={volverMenu} aria-label="Volver" className="w-11 h-11 shrink-0 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] transition-colors">
              <ArrowLeft className="w-[19px] h-[19px]" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.1em] text-[#94A3B8] uppercase">
                <span className="w-[6px] h-[6px] rounded-full bg-[#10B981]" />
                Línea de embalaje
              </p>
              <h1 className="text-[21px] leading-7 font-extrabold tracking-tight text-[#0F172A]">Control Temperatura</h1>
              <p className="text-[12px] text-[#64748B]">Control y monitoreo térmico en línea de embalaje</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="min-h-[51px] flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-3.5">
              <CalendarDays className="w-[17px] h-[17px] text-[#F97316]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[9px] font-extrabold tracking-[0.08em] text-[#94A3B8]">FECHA</span>
                <span className="text-[12px] font-bold text-[#1E293B] tabular-nums whitespace-nowrap">{formatearFechaMovil(fecha)}</span>
              </span>
              <span className="w-px h-8 bg-[#F1F5F9] ml-1" />
              <span className="text-[9px] font-extrabold tracking-[0.08em] text-[#94A3B8]">TURNO</span>
              <span className="flex items-center gap-0.5 rounded-xl bg-[#F8FAFC] p-0.5 border border-[#F1F5F9]" role="group" aria-label="Turno">
                <button type="button" aria-pressed={turno === 'Dia'} onClick={() => cambiarTurno('Dia')} className={`h-8 px-2.5 flex items-center gap-1 rounded-[10px] text-[11px] font-bold transition-colors ${turno === 'Dia' ? 'bg-[#FFFBEB] text-[#92400E] shadow-sm border border-[#FDE68A]' : 'text-[#94A3B8] border border-transparent'}`}><Sun className="w-3.5 h-3.5" />Día</button>
                <button type="button" aria-pressed={turno === 'Noche'} onClick={() => cambiarTurno('Noche')} className={`h-8 px-2.5 flex items-center gap-1 rounded-[10px] text-[11px] font-bold transition-colors ${turno === 'Noche' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200' : 'text-[#94A3B8] border border-transparent'}`}><Moon className="w-3.5 h-3.5" />Noche</button>
              </span>
            </div>
            <button type="button" onClick={cambiarConfiguracionRegistro} className="h-10 px-3 rounded-xl text-[12px] font-bold text-[#64748B] hover:text-[#EA580C] hover:bg-[#FFF7ED] transition-colors">Cambiar</button>
            <span title={registroGuardado ? 'Registro guardado' : 'Control activo'} className="w-10 h-10 shrink-0 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <Check className="w-[19px] h-[19px]" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>

      <div className="md:hidden px-3 pt-3">
        <section className="w-full rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <button
              type="button"
              onClick={cambiarConfiguracionRegistro}
              title="Cambiar fecha del registro"
              aria-label={`Cambiar fecha, seleccionada ${formatearFechaMovil(fecha)}`}
              className="min-w-0 flex items-center gap-2 text-left"
            >
              <CalendarDays className="w-5 h-5 shrink-0 text-[#F97316]" />
              <span className="min-w-0 flex flex-col">
                <span className="text-[10px] font-extrabold tracking-[0.09em] text-[#94A3B8]">FECHA</span>
                <span className="text-[12px] min-[375px]:text-[13px] font-bold text-[#1E293B] whitespace-nowrap tracking-tight">{formatearFechaMovil(fecha)}</span>
              </span>
            </button>
            <div className="min-w-0 flex rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] p-0.5 gap-0.5" role="group" aria-label="Turno del registro">
              <button
                type="button"
                onClick={() => cambiarTurno('Dia')}
                aria-pressed={turno === 'Dia'}
                className={`min-w-0 flex-1 h-9 flex items-center justify-center gap-1 rounded-[10px] text-[11px] font-bold transition-colors ${turno === 'Dia' ? 'bg-[#FFFBEB] border border-amber-200 text-[#92400E] shadow-sm' : 'text-[#94A3B8] border border-transparent'}`}
              >
                <Sun className={`w-[14px] h-[14px] shrink-0 ${turno === 'Dia' ? 'text-[#F97316]' : ''}`} />Día
              </button>
              <button
                type="button"
                onClick={() => cambiarTurno('Noche')}
                aria-pressed={turno === 'Noche'}
                className={`min-w-0 flex-1 h-9 flex items-center justify-center gap-1 rounded-[10px] text-[11px] font-bold transition-colors ${turno === 'Noche' ? 'bg-white border border-indigo-200 text-indigo-700 shadow-sm' : 'text-[#94A3B8] border border-transparent'}`}
              >
                <Moon className="w-[14px] h-[14px] shrink-0" />Noche
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="p-3 md:p-6 space-y-3 md:space-y-5">
        {mensaje.startsWith('Medición guardada con éxito') && (
          <div role="status" aria-live="polite" className="mx-auto max-w-[1380px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 shadow-sm">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Check className="w-5 h-5" /></span>
            <div className="min-w-0">
              <p className="font-extrabold text-[13px] text-emerald-800">Registro guardado con éxito</p>
              <p className="mt-0.5 text-[11px] leading-5 text-emerald-800/85">La siguiente medición se iniciará vacía al presionar <strong>Nueva Medición</strong>. Los datos guardados seguirán disponibles para consulta.</p>
            </div>
          </div>
        )}
        {puedeCrearOtraMedicion && (
          <div className="md:hidden flex items-center justify-between gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#94A3B8]">Registro de temperaturas</span>
            <button type="button" onClick={agregarHora} disabled={guardando} className="h-10 px-3.5 rounded-xl border border-[#EA580C] bg-[#EA580C] text-white shadow-[0_7px_18px_-8px_rgba(234,88,12,0.6)] text-[11px] font-extrabold inline-flex items-center gap-1 disabled:opacity-50 active:scale-[0.98]"><Plus className="w-4 h-4" />Nueva Medición {columnas.length + 1}</button>
          </div>
        )}
        <section className="hidden md:block mx-auto w-full max-w-[1380px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#94A3B8]">REGISTRO DE TEMPERATURAS</p>
              <h2 className="text-[17px] font-extrabold text-[#0F172A] mt-0.5">Control en línea de proceso</h2>
              <p className="text-[11px] text-[#64748B] mt-1">Cada medición se incorpora como una columna nueva, conservando los puntos de control a la izquierda.</p>
            </div>
            <div className="flex items-center flex-wrap justify-end gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#64748B]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                {registrosIngresados} medición{registrosIngresados === 1 ? '' : 'es'} con datos
              </span>
              {puedeCrearOtraMedicion && (
                <button type="button" onClick={agregarHora} disabled={guardando} className="h-11 px-5 rounded-xl border border-[#EA580C] bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-[0_10px_24px_-10px_rgba(234,88,12,0.8)] text-[12px] font-extrabold inline-flex items-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"><Plus className="w-4 h-4" />Nueva Medición (Medición {columnas.length + 1})</button>
              )}
            </div>
          </div>

          <div className="rounded-[24px] bg-white border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto" tabIndex={0} aria-label="Tabla de mediciones de temperatura; desplázate horizontalmente para ver más horas">
              <table className="w-max min-w-full border-separate border-spacing-0 text-left" style={{ minWidth: `${310 + Math.max(columnas.length, 1) * 180 + 128}px` }}>
                <thead>
                  <tr className="bg-[#F8FAFC]">
                    <th scope="col" className="sticky left-0 z-20 w-[310px] min-w-[310px] bg-[#F8FAFC] px-5 py-4 border-b border-r border-[#E2E8F0] align-middle">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">PUNTOS DE MUESTREO</span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {Object.entries(CATEGORIAS_UI).filter(([clave]) => puntos.some(p => p.categoria === clave)).map(([clave, config]) => (
                          <span key={clave} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${config.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.barra}`} />
                            {config.etiqueta.charAt(0) + config.etiqueta.slice(1).toLowerCase()}
                          </span>
                        ))}
                      </div>
                    </th>
                    {columnas.map((c, i) => {
                      const completos = puntos.filter(p => numero(mediciones[c.id]?.[p.id]) !== null).length;
                      const porcentaje = puntos.length ? Math.round(completos / puntos.length * 100) : 0;
                      return (
                        <th scope="col" key={c.id} className="w-[180px] min-w-[180px] px-3 py-3 border-b border-r border-[#E2E8F0] bg-[#F8FAFC] align-top">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                              <span className="w-6 h-6 rounded-lg bg-[#FFEDD5] text-[#C2410C] inline-flex items-center justify-center text-[11px]">{String(i + 1).padStart(2, '0')}</span>
                              Medición {i + 1}
                            </span>
                            <button type="button" onClick={() => eliminarColumna(c.id)} aria-label={`Eliminar medición ${i + 1}`} title="Eliminar medición" className="w-7 h-7 rounded-lg text-[#94A3B8] hover:text-[#E11D48] hover:bg-[#FFF1F2] flex items-center justify-center transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="flex items-center justify-center gap-1.5">
                            <input type="text" inputMode="numeric" maxLength={5} value={c.hora} onChange={e => actualizarHora(c.id, e.target.value)} aria-label={`Hora de la medición ${i + 1}, HH:MM`} placeholder="HH:MM" className="w-[90px] h-9 rounded-xl border border-[#E2E8F0] bg-white text-center text-[13px] font-bold tabular-nums text-[#334155] outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#F97316]" />
                            <button type="button" onClick={() => actualizarHora(c.id, horaActual())} className="h-9 px-2 rounded-xl bg-[#FFF7ED] text-[#EA580C] text-[10px] font-extrabold hover:bg-[#FFEDD5]">Ahora</button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-1 text-[10px] font-medium text-[#64748B]"><span>Progreso</span><span className="tabular-nums">{completos}/{puntos.length}</span></div>
                          <div className="mt-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden"><div className="h-full bg-[#F97316] rounded-full transition-all" style={{ width: `${porcentaje}%` }} /></div>
                        </th>
                      );
                    })}
                    <th scope="col" className="w-[128px] min-w-[128px] px-3 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] text-center align-middle">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">PROMEDIO</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {puntos.map(p => {
                    const categoria = CATEGORIAS_UI[p.categoria] || CATEGORIAS_UI.ambiente;
                    const avg = promedioPunto(p.id);
                    return (
                      <tr key={p.id} className="group">
                        <th scope="row" className="sticky left-0 z-10 w-[310px] min-w-[310px] bg-white group-hover:bg-[#F8FAFC] px-4 py-2.5 border-r border-b border-[#F1F5F9]">
                          <div className="flex items-center gap-3 min-h-[49px]">
                            <span className={`w-[4px] h-8 rounded-full shrink-0 ${categoria.barra}`} />
                            <span className="min-w-0 flex flex-col items-start justify-center gap-1">
                              <span className={`inline-flex rounded-[5px] px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.025em] ${categoria.chip}`}>{categoria.etiqueta}</span>
                              <span className="text-[12px] font-semibold text-[#1E293B]">{p.nombre}</span>
                            </span>
                          </div>
                        </th>
                        {columnas.map(c => {
                          const habilitado = horaManualValida(c.hora);
                          const valor = mediciones[c.id]?.[p.id] ?? '';
                          return (
                            <td key={c.id} className="w-[180px] min-w-[180px] px-3 py-2.5 border-r border-b border-[#F1F5F9] text-center group-hover:bg-[#F8FAFC]/50">
                              <label className="relative inline-block w-[112px]">
                                <input type="text" inputMode="decimal" disabled={!habilitado} title={!habilitado ? 'Primero define una hora válida en formato HH:MM' : p.nombre} aria-label={`${p.nombre}, temperatura de las ${c.hora || 'hora pendiente'} en grados Celsius`} value={valor} onChange={e => actualizarValor(c.id, p.id, e.target.value)} placeholder="--.-" className={`w-full h-10 rounded-xl border pl-1 pr-[23px] text-right text-[13px] font-extrabold tabular-nums outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-orange-100 focus:border-[#F97316] ${claseInputTemperatura(p.codigo, valor, habilitado)}`} />
                                <span className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#94A3B8]">°C</span>
                              </label>
                            </td>
                          );
                        })}
                        <td className="w-[128px] min-w-[128px] px-3 py-2.5 border-b border-[#F1F5F9] text-center group-hover:bg-[#F8FAFC]/50">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F8FAFC] px-3 py-2 text-[13px] font-extrabold" style={{ color: COLORES[p.categoria] || '#64748B' }}>
                            {avg === null ? '--' : formatear(avg)} <span className="text-[10px] font-semibold text-[#94A3B8]">°C</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#F8FAFC] text-[11px] text-[#64748B]">
              <span>Las temperaturas se habilitan al indicar una hora válida (HH:MM).</span>
              <span>Máximo {COLUMNAS_VISIBLES_BASE} mediciones por registro.</span>
            </div>
          </div>
        </section>

        <section className="md:hidden space-y-2.5">
          {columnas.length > 1 && (
            <div className="flex gap-2 overflow-x-auto py-0.5" role="tablist" aria-label="Seleccionar medición">
              {columnas.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={columnaActiva?.id === c.id}
                  onClick={() => setColumnaActivaId(c.id)}
                  className={`h-8 px-3 shrink-0 rounded-full text-[11px] font-bold border transition-colors ${columnaActiva?.id === c.id ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#C2410C]' : 'bg-white border-[#E2E8F0] text-[#64748B]'}`}
                >
                  Medición {i + 1}{hayDatosColumna(c.id) ? ' •' : ''}
                </button>
              ))}
            </div>
          )}

          {!columnaActiva ? (
            <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-4 py-7 text-center text-[12px] text-[#64748B]">
              Añade una medición para comenzar el registro.
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 rounded-full bg-[#FFEDD5] text-[#C2410C] px-2.5 py-1 text-[12px] font-extrabold tabular-nums">
                  {String(indiceMedicionActiva + 1).padStart(2, '0')}
                </span>
                <h2 className="min-w-0 flex-1 text-[15px] font-extrabold tracking-[-0.01em] text-[#0F172A]">Medición en Curso</h2>
                <button
                  type="button"
                  onClick={() => eliminarColumna(columnaActiva.id)}
                  aria-label={`Eliminar medición ${indiceMedicionActiva + 1}`}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-rose-50 hover:text-[#E11D48] active:scale-95"
                >
                  <Trash2 className="w-[18px] h-[18px]" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-1.5 text-[11px] min-[375px]:text-[12px] font-semibold text-[#64748B]">
                  <Clock3 className="w-4 h-4 shrink-0 text-[#F97316]" />
                  <span className="whitespace-nowrap">Hora registro</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={columnaActiva.hora}
                    onChange={e => actualizarHora(columnaActiva.id, e.target.value)}
                    aria-label={`Hora de la medición ${indiceMedicionActiva + 1} en formato HH:MM`}
                    placeholder="HH:MM"
                    className="w-[66px] h-8 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] text-center text-[12px] font-bold tabular-nums text-[#334155] outline-none focus:ring-2 focus:ring-orange-200 focus:border-[#F97316]"
                  />
                  <button
                    type="button"
                    onClick={() => actualizarHora(columnaActiva.id, horaActual())}
                    className="h-8 px-2.5 rounded-[10px] bg-[#FFF7ED] text-[#EA580C] text-[11px] font-extrabold active:scale-95"
                  >
                    Ahora
                  </button>
                </div>
              </div>

              <div className="mt-3.5">
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-[#64748B]">
                  <span>Progreso del registro:</span>
                  <span className="shrink-0 tabular-nums">{puntosConDatosActivos} de {puntos.length} puntos</span>
                </div>
                <div
                  className="w-full h-[5px] rounded-full bg-[#E2E8F0] overflow-hidden"
                  role="progressbar"
                  aria-label="Progreso de la medición"
                  aria-valuenow={puntosConDatosActivos}
                  aria-valuemin={0}
                  aria-valuemax={puntos.length}
                >
                  <div className="h-full rounded-full bg-[#F97316] transition-all duration-200" style={{ width: `${porcentajeProgresoActivo}%` }} />
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-extrabold tracking-[0.1em] text-[#94A3B8]">PUNTOS DE MUESTREO</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(CATEGORIAS_UI).filter(([clave]) => puntos.some(p => p.categoria === clave)).map(([clave, config]) => (
                    <span key={clave} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${config.chip}`}>
                      <span className={`w-[6px] h-[6px] rounded-full ${config.barra}`} />
                      {config.etiqueta.charAt(0) + config.etiqueta.slice(1).toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>

              {!horaManualValida(columnaActiva.hora) && (
                <p className="mt-3 text-[10px] text-[#B45309] bg-[#FFFBEB] rounded-lg px-2.5 py-1.5">
                  Ingresa una hora válida (HH:MM) para habilitar las temperaturas.
                </p>
              )}

              <div className="mt-3 space-y-2">
                {puntos.map(p => {
                  const categoria = CATEGORIAS_UI[p.categoria] || CATEGORIAS_UI.ambiente;
                  const habilitado = horaManualValida(columnaActiva.hora);
                  const valor = mediciones[columnaActiva.id]?.[p.id] ?? '';
                  return (
                    <label
                      key={p.id}
                      className="min-h-[58px] w-full flex items-center gap-2.5 rounded-[15px] border border-[#E2E8F0] bg-white px-2.5 py-2 transition-all focus-within:border-[#F97316] focus-within:ring-2 focus-within:ring-orange-100"
                    >
                      <span className={`w-1 h-7 rounded-full shrink-0 ${categoria.barra}`} />
                      <span className="min-w-0 flex-1 flex flex-col items-start justify-center gap-0.5">
                        <span className={`inline-flex rounded-[5px] px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.025em] ${categoria.chip}`}>
                          {categoria.etiqueta}
                        </span>
                        <span className="text-[12px] min-[375px]:text-[13px] font-medium leading-[17px] text-[#1E293B]">
                          {p.nombre}
                        </span>
                      </span>
                      <span className="relative w-[82px] shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={!habilitado}
                          title={!habilitado ? 'Primero define una hora válida en formato HH:MM' : p.nombre}
                          aria-label={`${p.nombre}, temperatura en grados Celsius`}
                          value={valor}
                          onChange={e => actualizarValor(columnaActiva.id, p.id, e.target.value)}
                          placeholder="--.-"
                          className={`w-full h-[36px] rounded-xl border pl-1 pr-[21px] text-right text-[13px] font-extrabold tabular-nums outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-orange-100 focus:border-[#F97316] ${claseInputTemperatura(p.codigo, valor, habilitado)}`}
                        />
                        <span className="pointer-events-none absolute right-[6px] top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#94A3B8]">°C</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 px-1 pt-0.5 text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="w-[7px] h-[7px] rounded-full bg-[#10B981]" />
              Borrador local automático
            </span>
            <span className="tabular-nums">{registrosIngresados} con datos</span>
          </div>
        </section>

        <section className="hidden md:flex mx-auto w-full max-w-[1220px] bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 lg:px-5 py-3.5 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B]"><span className="w-[8px] h-[8px] rounded-full bg-[#10B981]" />Cambios guardados localmente automáticamente</span>
            <span className="text-[11px] text-[#94A3B8]">Última actualización local {new Date(autosaveStamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button type="button" onClick={descartarCambios} disabled={!hayCambios || guardando} className="h-10 px-3.5 rounded-xl text-[12px] font-bold text-[#64748B] hover:text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50">Descartar cambios</button>
            <button type="button" onClick={() => guardar()} disabled={guardando || !mostrarGuardar} className="h-11 min-w-[185px] px-5 rounded-2xl bg-[#F97316] hover:bg-[#EA580C] text-white font-extrabold text-[13px] inline-flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(249,115,22,0.35)] transition-colors disabled:opacity-60">
              {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
              {guardando ? 'Guardando...' : mostrarGuardar ? textoGuardarMovil : 'Medición guardada'}
            </button>
            <button type="button" onClick={finalizarMediciones} disabled={guardando} className="h-11 px-4 rounded-2xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#334155] text-[12px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Check className="w-4 h-4" />Finalizar mediciones</button>
          </div>
        </section>

        {mensaje && !mensaje.startsWith('Medición guardada con éxito') && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-[11px] font-semibold">{mensaje}</div>}
      </div>

      <div
        className="md:hidden sticky bottom-0 z-20 w-full bg-white/95 backdrop-blur-md border-t border-[#F1F5F9] px-3 pt-2.5 shadow-[0_-6px_18px_rgba(15,23,42,0.04)]"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <button type="button" onClick={() => guardar()} disabled={guardando || !mostrarGuardar} className="min-w-0 h-[52px] px-2 rounded-2xl bg-[#F97316] text-white font-extrabold text-[11px] min-[390px]:text-[12px] inline-flex items-center justify-center gap-1.5 shadow-[0_6px_14px_-5px_rgba(249,115,22,0.35)] active:bg-[#EA580C] disabled:opacity-60">
            {guardando ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
            <span>{guardando ? 'Guardando...' : mostrarGuardar ? 'Guardar medición' : 'Guardado'}</span>
          </button>
          <button type="button" onClick={finalizarMediciones} disabled={guardando} className="min-w-0 h-[52px] px-2 rounded-2xl border border-[#CBD5E1] bg-white text-[#334155] font-extrabold text-[11px] min-[390px]:text-[12px] inline-flex items-center justify-center gap-1.5 active:bg-slate-50 disabled:opacity-60"><Check className="w-4 h-4 shrink-0" />Finalizar mediciones</button>
        </div>
      </div>

      {mensaje.startsWith('Medición guardada con éxito') && (
        <div role="status" aria-live="polite" className="fixed z-[60] bottom-[112px] md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[420px] rounded-2xl border border-emerald-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] px-4 py-3 flex items-start gap-2.5">
          <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Check className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-slate-900">Medición guardada con éxito</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Usa <strong>Nueva Medición</strong> para ingresar otra hora con todos sus campos vacíos.</p>
          </div>
          <button type="button" onClick={() => setMensaje('')} aria-label="Cerrar confirmación de guardado" className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {mostrarConfirmacionNavegacion && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-salida-temperatura" className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-[440px] rounded-[24px] bg-white border border-slate-200 shadow-2xl p-5 md:p-6">
            <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5" /></span><div><h3 id="titulo-salida-temperatura" className="text-[17px] font-extrabold text-slate-900">Medición sin guardar</h3><p className="mt-1.5 text-[13px] leading-5 text-slate-600">Estás saliendo de Control Temperatura con cambios pendientes. ¿Deseas salir y descartar los datos no guardados?</p><p className="mt-1 text-[11px] text-slate-500">Las mediciones guardadas anteriormente se conservarán para continuar más tarde.</p></div></div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2.5"><button type="button" onClick={() => { setMostrarConfirmacionNavegacion(false); navegacionPendienteRef.current = null; }} className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-[12px] font-bold">Seguir registrando</button><button type="button" onClick={confirmarSalidaExterna} className="h-11 px-4 rounded-xl bg-[#EA580C] text-white text-[12px] font-bold">Salir sin guardar</button></div>
          </div>
        </div>
      )}

      {confirmacionFinalizacion && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-finalizar-temperaturas" className="fixed inset-0 z-[380] flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-[440px] rounded-[24px] bg-white border border-slate-200 shadow-2xl p-5 md:p-6">
            <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5" /></span><div>
              <h3 id="titulo-finalizar-temperaturas" className="text-[17px] font-extrabold text-slate-900">{confirmacionFinalizacion === 'confirmar' ? '¿Finalizar mediciones?' : 'No se puede finalizar todavía'}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{confirmacionFinalizacion === 'sin_guardar' ? 'Primero debes guardar al menos una medición de este registro.' : confirmacionFinalizacion === 'pendientes' ? 'Quedan horas o temperaturas sin guardar. Guarda la medición pendiente o descártala antes de finalizar.' : `Se cerrará el registro activo del ${formatearFechaCorta(fecha)} (${turno === 'Dia' ? 'turno Día' : 'turno Noche'}). Después podrás crear un nuevo registro.`}</p>
            </div></div>
            <div className="mt-5 flex justify-end gap-2.5"><button type="button" onClick={() => setConfirmacionFinalizacion(null)} className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-[12px] font-bold">{confirmacionFinalizacion === 'confirmar' ? 'Cancelar' : 'Volver a registrar'}</button>{confirmacionFinalizacion === 'confirmar' && <button type="button" onClick={confirmarFinalizacion} className="h-11 px-4 rounded-xl bg-[#EA580C] text-white text-[12px] font-bold">Finalizar mediciones</button>}</div>
          </div>
        </div>
      )}

      {confirmacionGuardado && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-[#0F172A]/45 backdrop-blur-[2px] px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="titulo-guardado-incompleto">
          <div className="w-full max-w-[460px] bg-white border border-[#E2E8F0] rounded-[24px] shadow-2xl p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5" /></span>
              <div>
                <h3 id="titulo-guardado-incompleto" className="text-[17px] font-extrabold text-[#0F172A]">Hay temperaturas sin registrar</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-[#64748B]">Se detectaron campos pendientes en las mediciones que deseas guardar.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-[#FFF7ED] border border-[#FFEDD5] px-4 py-3">
              <p className="text-[12px] font-bold text-[#9A3412] mb-2">Campos incompletos:</p>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {confirmacionGuardado.map(item => (
                  <p key={item.indice} className="text-[12px] text-[#9A3412]">
                    <strong>Medición {item.indice}</strong> ({item.hora}): {item.faltantes.length} de {puntos.length} puntos sin temperatura.
                    <span className="block mt-0.5 text-[11px] opacity-85">{item.faltantes.map(p => p.nombre).join(' · ')}</span>
                  </p>
                ))}
              </div>
              <p className="text-[11px] leading-4 text-[#9A3412]/85 mt-2">Los campos vacíos no se enviarán. ¿Deseas guardar igualmente?</p>
            </div>
            <div className="mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button type="button" onClick={() => setConfirmacionGuardado(null)} disabled={guardando} className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-white text-[#475569] text-[12px] font-bold hover:bg-[#F8FAFC]">Volver a completar</button>
              <button type="button" onClick={() => guardar(true)} disabled={guardando} className="h-11 px-4 rounded-xl bg-[#EA580C] text-white text-[12px] font-bold hover:bg-[#C2410C] inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {guardando ? 'Guardando...' : 'Guardar igualmente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacionSalida && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px] p-4" onMouseDown={e => { if (e.target === e.currentTarget) setMostrarConfirmacionSalida(false); }}>
          <div className="w-full max-w-[430px] rounded-[24px] border border-slate-200 bg-white p-5 md:p-6 shadow-2xl" style={{ animation: 'fadeUpModule .22s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[17px] font-extrabold text-slate-900">Hay cambios sin guardar</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">¿Deseas volver al menú principal y descartar la medición pendiente?</p>
                <p className="mt-1 text-[11px] text-slate-400">Solo se descartarán los cambios sin guardar. Las mediciones guardadas permanecerán disponibles para continuar.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setMostrarConfirmacionSalida(false)} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">Seguir editando</button>
              <button type="button" onClick={confirmarVolverMenu} className="h-10 px-4 rounded-xl bg-[#F97316] text-white text-[12px] font-extrabold hover:bg-[#EA580C] active:scale-[0.98] transition-all">Volver al menú</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

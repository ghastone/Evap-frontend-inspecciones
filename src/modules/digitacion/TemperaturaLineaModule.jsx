import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, ChevronRight, Clock3, FilePlus2, History,
  AlertTriangle, Download, Eye, Menu, PencilLine, Plus, RefreshCw, Save, Search, Thermometer, Trash2
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

const COLORES = { agua: '#0284C7', pulpa: '#E11D48', ambiente: '#D97706' };
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
const COLUMNAS_VISIBLES_BASE = 7;
const DRAFT_KEY = 'evap_digitacion_temperatura_linea_draft_v1';
let columnaSeq = 0;
const crearColumna = (hora = '') => ({ id: `hora-${++columnaSeq}`, hora });

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

export default function TemperaturaLineaModule({ onAbrirMenu, usuarioId }) {
  const [vista, setVista] = useState('menu');
  const [puntos, setPuntos] = useState(PUNTOS_INICIALES);
  const [fecha, setFecha] = useState(fechaHoy());
  const [turno, setTurno] = useState('Dia');
  const [columnas, setColumnas] = useState(() => [crearColumna('')]);
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
  const [exportando, setExportando] = useState(false);
  const [modoEdicionHistorial, setModoEdicionHistorial] = useState(false);
  const [edicionesHistorial, setEdicionesHistorial] = useState({});
  const [guardandoEdicionHistorial, setGuardandoEdicionHistorial] = useState(false);
  const [mensajeExportacion, setMensajeExportacion] = useState('');
  const [mostrarConfirmacionSalida, setMostrarConfirmacionSalida] = useState(false);

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
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.fecha) setFecha(draft.fecha);
      if (draft?.turno) setTurno(draft.turno);
      if (Array.isArray(draft?.columnas) && draft.columnas.length) {
        setColumnas(draft.columnas.map(c => crearColumna(c.hora || '')));
      }
      if (draft?.mediciones && typeof draft.mediciones === 'object') setMediciones(draft.mediciones);
    } catch {
      // ignore local draft errors
    }
  }, []);

  useEffect(() => {
    if (vista !== 'nuevo') return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fecha, turno, columnas, mediciones }));
      setAutosaveStamp(Date.now());
    } catch {
      // ignore local draft errors
    }
  }, [vista, fecha, turno, columnas, mediciones]);

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

  const columnasVisuales = useMemo(() => {
    const faltantes = Math.max(0, COLUMNAS_VISIBLES_BASE - columnas.length);
    return [
      ...columnas.map(c => ({ ...c, placeholder: false })),
      ...Array.from({ length: faltantes }, (_, i) => ({ id: `slot-vacio-${i}`, placeholder: true }))
    ];
  }, [columnas]);

  const anchoTabla = 250 + COLUMNAS_VISIBLES_BASE * 120 + 126;
  const promedioPunto = id => promedio(columnas.map(c => mediciones[c.id]?.[id]));

  const cambiarTurno = valor => {
    setTurno(valor);
    setColumnas([crearColumna('')]);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
  };

  const actualizarHora = (columnaId, valor) => {
    const hora = formatearHoraManual(valor);
    setColumnas(prev => prev.map(c => c.id === columnaId ? { ...c, hora } : c));
    setRegistroGuardado(false);
    setMensaje('');
  };

  const actualizarValor = (columnaId, puntoId, valor) => {
    const limpio = valor.replace(/[^0-9,.-]/g, '');
    setMediciones(prev => ({ ...prev, [columnaId]: { ...(prev[columnaId] || {}), [puntoId]: limpio } }));
    setRegistroGuardado(false);
    setMensaje('');
  };

  const agregarHora = () => {
    if (columnas.length >= COLUMNAS_VISIBLES_BASE) return;
    setColumnas(prev => [...prev, crearColumna('')]);
    setRegistroGuardado(false);
    setMensaje('');
  };

  const eliminarColumna = columnaId => {
    setColumnas(prev => prev.filter(c => c.id !== columnaId));
    setMediciones(prev => {
      const copia = { ...prev };
      delete copia[columnaId];
      return copia;
    });
    setRegistroGuardado(false);
    setMensaje('');
  };

  const limpiarRegistro = () => {
    setColumnas([crearColumna('')]);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const descartarCambios = () => {
    if (!hayCambios) return;
    if (!window.confirm('¿Deseas descartar este registro? Se eliminarán las horas y temperaturas ingresadas.')) return;
    limpiarRegistro();
  };

  const volverMenu = () => {
    if (vista === 'historial-detalle') return setVista('historial');
    if (vista === 'nuevo' && hayCambios && !registroGuardado) {
      setMostrarConfirmacionSalida(true);
      return;
    }
    if (vista === 'nuevo') limpiarRegistro();
    setVista('menu');
  };

  const confirmarVolverMenu = () => {
    setMostrarConfirmacionSalida(false);
    limpiarRegistro();
    setVista('menu');
  };

  const iniciarRegistro = () => {
    setColumnas([crearColumna('')]);
    setMediciones({});
    setRegistroGuardado(false);
    setMensaje('');
    setVista('nuevo');
  };

  const cambiarConfiguracionRegistro = () => {
    if (hayCambios && !registroGuardado && !window.confirm('Hay mediciones ingresadas. ¿Deseas volver y cambiar la fecha o el turno?')) return;
    limpiarRegistro();
    setVista('configurar');
  };

  const guardar = async () => {
    const columnasConDatos = columnas.filter(c => hayDatosColumna(c.id));
    if (!columnasConDatos.length) return setMensaje('Ingresa al menos una temperatura antes de guardar.');
    const sinHora = columnasConDatos.find(c => !c.hora);
    if (sinHora) return setMensaje('Debes indicar la hora de cada columna que contiene mediciones.');
    const horaInvalida = columnasConDatos.find(c => !horaManualValida(c.hora));
    if (horaInvalida) return setMensaje('La hora debe ingresarse manualmente en formato HH:MM, por ejemplo 16:58.');
    const horas = columnasConDatos.map(c => c.hora);
    if (new Set(horas).size !== horas.length) return setMensaje('No puedes guardar dos columnas con la misma hora.');

    setGuardando(true);
    setMensaje('');
    try {
      for (const columna of columnasConDatos) {
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
      }
      setRegistroGuardado(true);
      setMensaje(`Registro guardado correctamente: ${columnasConDatos.length} medición${columnasConDatos.length === 1 ? '' : 'es'} horaria${columnasConDatos.length === 1 ? '' : 's'}.`);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (error) {
      setMensaje(error.message || 'No fue posible guardar el registro.');
    } finally {
      setGuardando(false);
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
      formatearFechaTitulo(item.fecha)
    ].join(' ').toLowerCase().includes(term));
  }, [resumenHistorialDiario, busquedaResumen]);
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

  const BotonExportarExcel = () => (
    <button
      type="button"
      onClick={exportarExcel}
      disabled={exportando}
      className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold inline-flex items-center gap-2 shadow-sm disabled:opacity-60 transition-colors"
    >
      {exportando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {exportando ? 'Exportando...' : 'Exportar Excel'}
    </button>
  );

  if (vista === 'menu') return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <Encabezado titulo="Temperatura en línea" subtitulo="Seleccione la acción que desea realizar" volver={false} />
      <div className="min-h-[calc(100%-58px)] p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#E96008]">Digitación</p>
            <h2 className="text-[22px] md:text-[28px] font-black text-slate-900">Control de temperatura en línea</h2>
            <p className="text-[12px] md:text-[13px] text-slate-500 mt-1">Seleccione si desea crear un registro o consultar mediciones anteriores.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => setVista('configurar')} className="group text-left bg-white border border-orange-200 hover:border-orange-300 rounded-[22px] p-5 md:p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between"><div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#E96008] flex items-center justify-center"><FilePlus2 className="w-6 h-6" /></div><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#E96008]" /></div>
              <h3 className="text-[17px] font-extrabold text-slate-900 mt-5">Nuevo registro</h3>
              <p className="text-[12px] text-slate-500 mt-1.5">Ingrese las temperaturas horarias correspondientes al día y turno.</p>
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
      <Encabezado titulo="Nuevo registro" subtitulo="Define primero la fecha y el turno del registro" />
      <div className="min-h-[calc(100%-58px)] p-4 md:p-8 flex items-center justify-center">
        <section className="w-full max-w-3xl bg-white border border-slate-200 rounded-[26px] shadow-sm p-5 md:p-7">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-orange-600">Configuración del registro</p>
            <h2 className="text-[22px] md:text-[26px] font-black text-slate-900 mt-1">Selecciona fecha y turno</h2>
            <p className="text-[13px] text-slate-500 mt-1">Estos datos quedarán asociados a todas las mediciones que ingreses a continuación.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 focus-within:border-orange-300 focus-within:bg-orange-50/30 transition-colors">
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500"><CalendarDays className="w-4 h-4 text-orange-500" />Fecha del registro</span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="mt-3 w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
            </label>
            <label className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 focus-within:border-orange-300 focus-within:bg-orange-50/30 transition-colors">
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500"><Clock3 className="w-4 h-4 text-orange-500" />Turno de proceso</span>
              <select value={turno} onChange={e => setTurno(e.target.value)} className="mt-3 w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400">
                <option value="Dia">Día</option>
                <option value="Noche">Noche</option>
              </select>
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={iniciarRegistro} className="h-11 px-5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-[13px] font-extrabold inline-flex items-center gap-2 shadow-sm transition-all hover:-translate-y-[1px] active:scale-[0.98]"><ChevronRight className="w-4 h-4" />Continuar al registro</button>
          </div>
        </section>
      </div>
    </div>
  );

  if (vista === 'historial') return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <Encabezado titulo="Historial de mediciones diarias" subtitulo="Resumen diario de mediciones" />
      <div className="p-3 md:p-5 lg:p-6 space-y-4">
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[13px] md:text-[14px] font-semibold text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span>Última información cargada: {textoUltimaActualizacion}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <BotonExportarExcel />
        </section>

        {mensajeExportacion && <div className={`rounded-2xl border px-4 py-3 text-[12px] font-semibold ${mensajeExportacion.toLowerCase().includes('correctamente') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{mensajeExportacion}</div>}
        {errorResumen && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-700">{errorResumen}</div>}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /><h2 className="text-[14px] md:text-[15px] font-black uppercase tracking-[0.02em] text-slate-900">Resumen diario</h2></div>
              <p className="text-[12px] text-slate-500 mt-1">Selecciona cualquier fecha para abrir el registro completo de ese día.</p>
            </div>
            <div className="relative w-full md:w-[320px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={busquedaResumen} onChange={e => setBusquedaResumen(e.target.value)} placeholder="Buscar fecha..." className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-200" />
            </div>
          </div>

          {cargandoResumen ? (
            <div className="h-44 flex items-center justify-center text-[12px] text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" />Cargando historial...</div>
          ) : !resumenHistorialFiltrado.length ? (
            <div className="h-44 flex items-center justify-center text-[12px] text-slate-400">No existen registros de temperatura guardados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500">DETALLE</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500">FECHA</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500">MEDICIONES</th>
                    {HISTORIAL_COLUMNAS.map(col => (
                      <th key={col.codigo} className="px-2 py-2.5 text-center text-slate-500 min-w-[92px]">
                        <span className="block text-[9px] leading-tight font-black tracking-[0.04em]">{col.zona}</span>
                        <span className="block mt-1 text-[9px] leading-tight font-bold text-slate-400">PROM. {col.variable}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500">PRIMERA</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500">ÚLTIMA</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenHistorialFiltrado.map((item, index) => (
                    <tr key={`${item.fecha}-${index}`} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <button type="button" onClick={() => abrirDetalleHistorial(item)} className="h-8 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-blue-100 transition-colors"><Eye className="w-3.5 h-3.5" />Ver detalle</button>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-extrabold text-slate-800 whitespace-nowrap">{formatearFechaTitulo(item.fecha)}</td>
                      <td className="px-4 py-3.5 text-center text-[13px] font-bold text-slate-700">{item.mediciones}</td>
                      {HISTORIAL_COLUMNAS.map(col => {
                        const value = numero(item.promedios?.[col.codigo]);
                        return (
                          <td key={col.codigo} className="px-2 py-2.5 text-center">
                            <div className={`min-h-[36px] min-w-[78px] rounded-lg px-2 inline-flex items-center justify-center gap-1 text-[12px] font-extrabold ${claseCeldaTemperatura(col.codigo, value)}`}>
                              <span>{value === null ? '--' : formatear(value)}</span>
                              {value !== null && <span className="text-[9px] opacity-70">°C</span>}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3.5 text-center text-[12px] font-semibold text-slate-600">{item.primeraHora || '--'}</td>
                      <td className="px-4 py-3.5 text-center text-[12px] font-semibold text-slate-600">{item.ultimaHora || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  if (vista === 'historial-detalle') return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <Encabezado titulo="Detalle diario de temperaturas" subtitulo="Temperatura en línea · mediciones completas del día seleccionado" onVolver={() => setVista('historial')} />
      <div className="p-3 md:p-5 lg:p-6 space-y-4">
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
          <div className="inline-flex items-center gap-2 text-[13px] md:text-[14px] font-semibold text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span>Última información cargada: {textoUltimaActualizacion}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </section>

        {errorHistorial && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-700">{errorHistorial}</div>}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-[13px] md:text-[14px] font-black text-slate-800">Registros del día: {formatearFechaTitulo(historialFecha)}</h3>
              </div>
              <p className="text-[11px] text-slate-500">Turno Día ({totalDia} mediciones) · Turno Noche ({totalNoche} mediciones)</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {modoEdicionHistorial ? (
                <>
                  <button type="button" onClick={cancelarEdicionHistorial} disabled={guardandoEdicionHistorial} className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-[11px] font-bold hover:bg-slate-50">Cancelar edición</button>
                  <button type="button" onClick={guardarEdicionHistorial} disabled={guardandoEdicionHistorial} className="h-9 px-3.5 rounded-xl bg-[#F97316] text-white text-[11px] font-bold inline-flex items-center gap-2 hover:bg-[#EA580C] disabled:opacity-60">{guardandoEdicionHistorial ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{guardandoEdicionHistorial ? 'Guardando...' : 'Guardar cambios'}</button>
                </>
              ) : (
                <button type="button" onClick={iniciarEdicionHistorial} disabled={cargandoHistorial || !historialPlano.length} className="h-9 px-3.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-[11px] font-bold inline-flex items-center gap-2 hover:bg-orange-100 disabled:opacity-50"><PencilLine className="w-3.5 h-3.5" />Editar datos</button>
              )}
              <button type="button" onClick={() => cargarHistorial()} disabled={cargandoHistorial || guardandoEdicionHistorial} className="h-9 px-3.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-2 hover:bg-slate-700"><RefreshCw className={`w-3.5 h-3.5 ${cargandoHistorial ? 'animate-spin' : ''}`} />Actualizar</button>
            </div>
          </div>

          {cargandoHistorial ? (
            <div className="h-40 flex items-center justify-center text-[12px] text-slate-400">Cargando historial...</div>
          ) : historialPaginado.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[12px] text-slate-400">No existen mediciones para la fecha seleccionada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-[0.04em] text-slate-500">HORA MEDICIÓN</th>
                    {HISTORIAL_COLUMNAS.map(col => (
                      <th key={col.codigo} className="px-2 py-2.5 text-center text-slate-500 min-w-[92px]">
                        <span className="block text-[9px] leading-tight font-black tracking-[0.04em]">{col.zona}</span>
                        <span className="block mt-1 text-[9px] leading-tight font-bold text-slate-400">{col.variable}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['Dia', 'Noche'].map(turnoKey => {
                    const rows = historialAgrupado[turnoKey];
                    if (!rows.length) return null;
                    return (
                      <React.Fragment key={turnoKey}>
                        <tr className={turnoKey === 'Dia' ? 'bg-amber-50/70' : 'bg-indigo-50/70'}>
                          <td colSpan={1 + HISTORIAL_COLUMNAS.length} className="px-4 py-2.5 border-y border-slate-200">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-[10px] font-black ${TURNOS_INFO[turnoKey].badge}`}>
                                <span>{TURNOS_INFO[turnoKey].icono}</span>{TURNOS_INFO[turnoKey].label} ({TURNOS_INFO[turnoKey].rango})
                              </span>
                              <span className="text-[11px] text-slate-500">{rows.length} mediciones registradas</span>
                            </div>
                          </td>
                        </tr>
                        {rows.map(row => (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-[12px] font-bold text-slate-800 whitespace-nowrap">{row.hora}</td>
                            {HISTORIAL_COLUMNAS.map(col => {
                              const value = row.valores?.[col.codigo] ?? null;
                              const editValue = edicionesHistorial[row.id]?.[col.codigo] ?? (value === null ? '' : String(value).replace('.', ','));
                              return (
                                <td key={col.codigo} className="px-2 py-2 text-center">
                                  {modoEdicionHistorial ? (
                                    <input inputMode="decimal" value={editValue} onChange={e => actualizarEdicionHistorial(row.id, col.codigo, e.target.value)} placeholder="--" className={`h-9 w-[78px] rounded-lg border px-2 text-center text-[12px] font-bold outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 ${claseInputTemperatura(col.codigo, editValue, true)}`} />
                                  ) : (
                                    <div className={`min-h-[36px] rounded-lg px-2 inline-flex items-center justify-center text-[12px] font-bold min-w-[78px] ${claseCeldaTemperatura(col.codigo, value)}`}>{value === null ? '--' : formatear(value)}</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Ver por página:</span>
              <select value={pageSizeHistorial} onChange={e => setPageSizeHistorial(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600">
                <option value="all">Todas las del día</option>
                <option value="5">5 registros</option>
                <option value="10">10 registros</option>
                <option value="20">20 registros</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-500">Mostrando <span className="font-bold text-slate-700">{historialPaginado.length}</span> de <span className="font-bold text-slate-700">{totalDelDia}</span> mediciones del día <span className="font-bold text-slate-700">{formatearFechaCorta(historialFecha)}</span></div>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-[#F8FAFC] overflow-y-auto" style={FUENTE_INTER}>
      <style>{`
        @keyframes fadeUpModule { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseSoft { 0%,100% { opacity: .68; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      `}</style>

      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200" style={{ animation: 'fadeUpModule .45s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="px-4 md:px-6 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={volverMenu} className="w-11 h-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="w-11 h-11 rounded-2xl border border-orange-200 bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
              <Thermometer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] leading-none md:text-[28px] font-extrabold text-slate-800">Ingreso de Temperatura</h1>
              <p className="mt-1 text-[12px] md:text-[13px] text-slate-500">Control y monitoreo térmico en línea de embalaje</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <div className="min-w-[185px] h-11 px-3 rounded-2xl border border-orange-200 bg-orange-50/60 shadow-sm flex items-center gap-2 text-slate-700">
              <CalendarDays className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Fecha</span>
              <span className="ml-auto text-[13px] font-extrabold">{formatearFechaCorta(fecha)}</span>
            </div>
            <div className="min-w-[145px] h-11 px-3 rounded-2xl border border-orange-200 bg-orange-50/60 shadow-sm flex items-center gap-2 text-slate-700">
              <Clock3 className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Turno</span>
              <span className="ml-auto text-[13px] font-extrabold">{turno === 'Dia' ? 'Día' : 'Noche'}</span>
            </div>
            <button type="button" onClick={cambiarConfiguracionRegistro} className="h-10 px-3 rounded-xl text-[11px] font-bold text-slate-500 hover:text-orange-700 hover:bg-orange-50 transition-colors">Cambiar</button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-5">
        <section className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden" style={{ animation: 'fadeUpModule .45s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '150ms' }}>
          <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-white via-white to-orange-50/30">
            <div className="flex items-center flex-wrap gap-3">
              <span className="text-[12px] md:text-[13px] font-extrabold uppercase tracking-[0.04em] text-slate-700">Registro temperaturas línea de proceso</span>
              <button
                onClick={agregarHora}
                disabled={columnas.length >= COLUMNAS_VISIBLES_BASE}
                className="h-8 px-3.5 rounded-xl bg-[#F97316] text-white text-[11px] font-black inline-flex items-center gap-1.5 transition-all hover:-translate-y-[1px] hover:shadow-[0_10px_22px_-10px_rgba(249,115,22,0.65)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Plus className="w-3.5 h-3.5" />Hora
              </button>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: 'pulseSoft 1.8s ease-in-out infinite' }} />
              {registrosIngresados} medición{registrosIngresados === 1 ? '' : 'es'} con datos
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto px-3 md:px-4 pb-4 pt-3">
            <table className="w-full table-fixed border-separate border-spacing-0" style={{ minWidth: `${anchoTabla}px` }}>
              <colgroup>
                <col style={{ width: '250px' }} />
                {Array.from({ length: COLUMNAS_VISIBLES_BASE }).map((_, i) => <col key={`col-${i}`} style={{ width: '120px' }} />)}
                <col style={{ width: '126px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-slate-50 border-y border-l border-slate-200 rounded-tl-2xl text-[10px] font-black uppercase tracking-[0.05em] text-slate-500">Punto de medición</th>
                  {columnasVisuales.map((c, i) => c.placeholder ? (
                    <th key={c.id} className="px-2 py-2 bg-slate-50 border-y border-slate-200">
                      <div className="h-[52px] rounded-xl border border-dashed border-slate-200 bg-white/75 flex items-center justify-center text-[14px] font-bold text-slate-300">—</div>
                    </th>
                  ) : (
                    <th key={c.id} className="px-2 py-2 bg-slate-50 border-y border-slate-200">
                      <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-2.5 py-2 flex flex-col items-center gap-1.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
                        <span className="text-[9px] leading-none font-black uppercase tracking-[0.05em] text-orange-600">Medición {i + 1}</span>
                        <div className="relative w-full">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            value={c.hora}
                            onChange={e => actualizarHora(c.id, e.target.value)}
                            placeholder="HH:MM"
                            className="h-8 w-full rounded-xl border border-orange-200 bg-white px-2 pr-7 text-center text-[12px] font-bold text-slate-700 outline-none transition-all hover:-translate-y-[1px] hover:shadow-[0_8px_20px_-14px_rgba(249,115,22,0.9)] focus:ring-2 focus:ring-orange-200 focus:border-orange-400 active:scale-[0.98]"
                          />
                          <Clock3 className="w-3.5 h-3.5 text-orange-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 bg-slate-50 border-y border-r border-slate-200 rounded-tr-2xl text-[10px] font-black uppercase tracking-[0.05em] text-slate-500">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {puntos.map(p => {
                  const fondoFila = 'bg-white';
                  return (
                    <tr key={p.id} className="group bg-white">
                      <td className="px-4 py-2.5 border-b border-l border-slate-100 bg-white transition-colors group-hover:bg-white">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES[p.categoria] || '#94A3B8' }} />
                          <span className="text-[12px] md:text-[13px] font-semibold text-slate-700">{p.nombre}</span>
                        </div>
                      </td>
                      {columnasVisuales.map(c => c.placeholder ? (
                        <td key={c.id} className="px-2 py-2 border-b border-slate-100 bg-white transition-colors group-hover:bg-white">
                          <div className="w-[82px] h-9 mx-auto rounded-xl border border-slate-100 bg-slate-50/70 text-slate-300 flex items-center justify-center text-[12px] font-semibold hover:bg-slate-50">--</div>
                        </td>
                      ) : (
                        <td key={c.id} className="px-2 py-2 border-b border-slate-100 bg-white transition-colors group-hover:bg-white">
                          <input
                            inputMode="decimal"
                            disabled={!horaManualValida(c.hora)}
                            title={!horaManualValida(c.hora) ? 'Primero define una hora válida en formato HH:MM' : ''}
                            value={mediciones[c.id]?.[p.id] || ''}
                            onChange={e => actualizarValor(c.id, p.id, e.target.value)}
                            placeholder="--"
                            className={`w-[82px] h-9 mx-auto block rounded-xl border px-2 text-center text-[13px] font-bold outline-none transition-all focus:scale-[1.02] focus:ring-2 focus:ring-orange-200 focus:border-orange-500 ${claseInputTemperatura(p.codigo, mediciones[c.id]?.[p.id], horaManualValida(c.hora))}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 border-b border-r border-slate-100 bg-white transition-colors group-hover:bg-white">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[15px] font-extrabold" style={{ color: COLORES[p.categoria] || '#64748B' }}>{formatear(promedioPunto(p.id))}</span>
                          <span className="text-[10px] font-semibold text-slate-400">°C</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-4 py-3 bg-slate-50/85 border-b border-l border-slate-200 rounded-bl-2xl text-[10px] font-bold text-slate-400">Acción de columna</td>
                  {columnasVisuales.map(c => c.placeholder ? (
                    <td key={c.id} className="px-2 py-3 bg-slate-50/85 border-b border-slate-200 text-center text-slate-300 text-[12px]">—</td>
                  ) : (
                    <td key={c.id} className="px-2 py-3 bg-slate-50/85 border-b border-slate-200 text-center">
                      <button
                        type="button"
                        onClick={() => eliminarColumna(c.id)}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-red-200 text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />Eliminar
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-3 bg-slate-50/85 border-b border-r border-slate-200 rounded-br-2xl" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="md:hidden p-3 space-y-3">
            {columnas.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-[11px] text-slate-400">Añade una hora para comenzar el registro.</div>}
            {columnas.map((c, i) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-3 py-2.5 bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock3 className="w-4 h-4 text-[#EA580C]" />
                    <span className="text-[11px] font-extrabold">Medición {i + 1}</span>
                    <div className="relative"><input type="text" inputMode="numeric" maxLength={5} value={c.hora} onChange={e => actualizarHora(c.id, e.target.value)} placeholder="HH:MM" className="h-8 w-[104px] rounded-xl border border-orange-200 bg-orange-50/70 pl-2 pr-7 text-center text-[12px] font-bold text-slate-700" /><Clock3 className="w-3.5 h-3.5 text-orange-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
                  </div>
                  <button type="button" onClick={() => eliminarColumna(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="p-3 space-y-2.5">
                  {puntos.map(p => (
                    <label key={p.id} className="grid grid-cols-[1fr_92px] gap-3 items-center">
                      <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORES[p.categoria] || '#94A3B8' }} />{p.nombre}</span>
                      <input inputMode="decimal" disabled={!horaManualValida(c.hora)} title={!horaManualValida(c.hora) ? 'Primero define una hora válida en formato HH:MM' : ''} value={mediciones[c.id]?.[p.id] || ''} onChange={e => actualizarValor(c.id, p.id, e.target.value)} placeholder="--" className={`h-9 rounded-xl border px-2 text-center text-[13px] font-bold outline-none transition-all focus:ring-2 focus:ring-orange-200 focus:border-orange-500 ${claseInputTemperatura(p.codigo, mediciones[c.id]?.[p.id], horaManualValida(c.hora))}`} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[24px] shadow-sm px-4 md:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{ animation: 'fadeUpModule .45s cubic-bezier(0.16,1,0.3,1) both', animationDelay: '300ms' }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] md:text-[12px] font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: 'pulseSoft 1.8s ease-in-out infinite' }} />
              Cambios guardados localmente automáticamente
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] md:text-[11px] font-semibold text-slate-500">
              {Object.entries(COLORES).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1.5 capitalize"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />{k}</span>)}
              <span className="text-slate-400">Última actualización local {new Date(autosaveStamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button onClick={descartarCambios} className="h-10 px-3.5 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all">Descartar cambios</button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="h-10 px-4.5 rounded-xl bg-[#F97316] text-white font-extrabold text-[12px] inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-[1px] hover:shadow-[0_12px_26px_-14px_rgba(249,115,22,0.9)] active:scale-[0.98] disabled:opacity-60"
            >
              {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {guardando ? 'Guardando...' : 'Guardar registro'}
            </button>
          </div>
        </section>

        {mensaje && <div className={`rounded-2xl border px-4 py-3 text-[11px] font-semibold ${mensaje.toLowerCase().includes('correctamente') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{mensaje}</div>}
      </div>

      {mostrarConfirmacionSalida && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px] p-4" onMouseDown={e => { if (e.target === e.currentTarget) setMostrarConfirmacionSalida(false); }}>
          <div className="w-full max-w-[430px] rounded-[24px] border border-slate-200 bg-white p-5 md:p-6 shadow-2xl" style={{ animation: 'fadeUpModule .22s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[17px] font-extrabold text-slate-900">Hay cambios sin guardar</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">¿Deseas volver al menú principal?</p>
                <p className="mt-1 text-[11px] text-slate-400">Los datos ingresados que no hayas guardado se descartarán.</p>
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

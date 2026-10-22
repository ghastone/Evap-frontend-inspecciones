import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Menu, X, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config/api.js';
// === HOOK PERSONALIZADO: CONTEO ANIMADO DE NÚMEROS (TICKER) ===
const useCountUp = (endValue, duration = 1000, decimals = 0) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (endValue === 0) {
      setCount(0);
      return;
    }
    let startTime = null;
    let animationFrame;
    const startValue = 0;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(startValue + (endValue - startValue) * easeOut);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };
    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [endValue, duration]);
  return {
    formatted: count.toFixed(decimals).replace('.', ','),
    raw: count
  };
};
// === HELPER: Obtener fecha de hoy en formato DD-MM-YYYY ===
const getHoyStr = () => {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${hoy.getFullYear()}`;
};
const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
// Identidad de planta; las direcciones de consulta solo se obtienen de API_URL.
const PLANTAS_RESUMEN = Object.freeze({ MAQ: 'Maquehua', ROS: 'Rosario' });
const PLANTA_POR_HOST = Object.freeze({
  'evap.maq.goldanda.cl': 'MAQ',
  '192.168.0.10': 'MAQ',
  'evap.ros.goldanda.cl': 'ROS',
  '192.168.10.10': 'ROS'
});
const validarPlantaResumen = datos => {
  const plantaId = String(datos?.plantaId || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(PLANTAS_RESUMEN, plantaId)) {
    throw new Error('El backend no informó una planta válida (MAQ o ROS). Revisa /api/planta.');
  }
  const plantaNombre = PLANTAS_RESUMEN[plantaId];
  const nombreRecibido = String(datos?.plantaNombre || '').trim();
  if (nombreRecibido && nombreRecibido.toLowerCase() !== plantaNombre.toLowerCase()) {
    throw new Error('El identificador y el nombre de planta no coinciden. Revisa /api/planta.');
  }
  for (const valor of [window.location.hostname, new URL(API_URL).hostname]) {
    const host = String(valor || '').toLowerCase().replace(/\.$/, '');
    const esperada = Object.prototype.hasOwnProperty.call(PLANTA_POR_HOST, host) ? PLANTA_POR_HOST[host] : null;
    if (esperada && esperada !== plantaId) {
      throw new Error(`Esta dirección corresponde a ${PLANTAS_RESUMEN[esperada]}, pero el backend informa ${plantaNombre}. Revisa el proxy y PLANTA_ID.`);
    }
  }
  // En localhost se usa la identidad declarada por el backend, sin suponer una planta.
  return { plantaId, plantaNombre };
};
const numeroParametro = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const nivelPorLimite = (pct, lim1, lim2) => {
  if (lim1 === null || lim2 === null) return 1;
  return pct > lim2 ? 3 : pct > lim1 ? 2 : 1;
};
const parametrosDeProceso = (proceso, actuales) => {
  const snap = proceso?.parametrosSnapshot || proceso?.parametros_snapshot;
  if (snap && Array.isArray(snap.calidad) && Array.isArray(snap.condicion) && (snap.calidad.length || snap.condicion.length)) return snap;
  return actuales || { calidad: [], condicion: [] };
};
const fechaProceso = proceso => {
  const raw = proceso?.fecha || proceso?.createdAt || proceso?.created_at;
  if (!raw) return '';
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(d).replace(/\//g, '-');
};
const horaProceso = proceso => {
  const raw = proceso?.horaInicio || proceso?.horaFin || proceso?.createdAt || proceso?.created_at;
  if (!raw) return `P${proceso?.numProceso || ''}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `P${proceso?.numProceso || ''}`;
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d);
};
const evaluarProceso = (proceso, parametrosActuales) => {
  const parametros = parametrosDeProceso(proceso, parametrosActuales);
  const calidad = Array.isArray(parametros.calidad) ? parametros.calidad : [];
  const condicion = Array.isArray(parametros.condicion) ? parametros.condicion : [];
  const cajas = Array.isArray(proceso?.cajas) ? proceso.cajas : [];
  let totalFrutos = 0, totalCal = 0, totalCond = 0;
  const agregadoCal = {}, agregadoCond = {}, brixLight = [], brixDark = [];
  cajas.forEach(c => {
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
    if (Number.isFinite(brix) && brix > 0) {
      if (c.color === 'Light') brixLight.push(brix);
      if (c.color === 'Dark') brixDark.push(brix);
    }
  });
  const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
  const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
  const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;
  let nivelCal = 1, nivelCond = 1;
  if (totalFrutos > 0 && (calidad.length || condicion.length)) {
    const sumCal = calidad.find(p => p.nombre === SUM_CALIDAD);
    if (sumCal) nivelCal = Math.max(nivelCal, nivelPorLimite(pCal, numeroParametro(sumCal.limAB), numeroParametro(sumCal.limBC)));
    calidad.filter(p => p.nombre !== SUM_CALIDAD).forEach(p => {
      const pct = ((agregadoCal[p.nombre] || 0) / totalFrutos) * 100;
      nivelCal = Math.max(nivelCal, nivelPorLimite(pct, numeroParametro(p.limAB), numeroParametro(p.limBC)));
    });
    const sumCond = condicion.find(p => p.nombre === SUM_CONDICION);
    if (sumCond) nivelCond = Math.max(nivelCond, nivelPorLimite(pCond, numeroParametro(sumCond.lim12), numeroParametro(sumCond.lim23)));
    condicion.filter(p => p.nombre !== SUM_CONDICION).forEach(p => {
      const pct = ((agregadoCond[p.nombre] || 0) / totalFrutos) * 100;
      nivelCond = Math.max(nivelCond, nivelPorLimite(pct, numeroParametro(p.lim12), numeroParametro(p.lim23)));
    });
  }
  const tieneCatalogo = calidad.length > 0 || condicion.length > 0;
  let nota = totalFrutos && tieneCatalogo ? `${nivelCal === 3 ? 'C' : nivelCal === 2 ? 'B' : 'A'}${nivelCond}` : '-';
  if (!tieneCatalogo && /^[ABC][123]$/.test(proceso?.estado || '')) nota = proceso.estado;
  const estadoCalculado = nota !== '-' ? ((nota.includes('C') || nota.includes('3')) ? 'Objetado' : 'Aprobado') : (proceso?.estado || '-');
  const estado = proceso?.estado === 'En curso' ? 'En curso' : estadoCalculado;
  const categoria = estadoCalculado === 'Objetado' ? 'Crítico' : nota === 'A1' ? 'Óptimo' : 'Regular';
  return { totalFrutos, pCal, pCond, pExp, nota, estado, estadoCalculado, categoria, agregadoCal, agregadoCond, brixLight, brixDark };
};
const claseNota = nota => {
  if (nota === 'A1') return 'bg-[#ecfdf5] text-[#059669]';
  if (nota?.includes('C') || nota?.includes('3')) return 'bg-[#ffe4e6] text-[#e11d48]';
  return 'bg-[#fef3c7] text-[#a16207]';
};
const posicionSegmentadaExportable = valor => {
  const v = Math.max(0, Math.min(Number(valor) || 0, 100));
  if (v <= 80) return (v / 80) * (100 / 3);
  if (v <= 90) return (100 / 3) + ((v - 80) / 10) * (100 / 3);
  return (200 / 3) + ((v - 90) / 10) * (100 / 3);
};
// === COMPONENTE: BARRA HORIZONTAL (DISEÑO APLICADO) ===
const BarraDefecto = ({ nombre, pct, colorClass }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(Math.min(pct * 10, 100));
    }, 150);
    return () => clearTimeout(timer);
  }, [pct]);
  return (
    <div className="flex items-center py-1.5 defect-item cursor-pointer rounded-lg px-2 -mx-2">
      <span className="w-1/3 text-[13.2px] font-medium text-[#64748b] truncate pr-2" title={nombre}>{nombre}</span>
      <div className="flex-1 bg-[#f1f5f9] rounded-full h-[8px] overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass} defect-bar`}
          style={{ width: `${width}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        ></div>
      </div>
      <span className="w-12 text-right text-[12px] font-bold text-[#0f172a] ml-3">{pct.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
};
// === COMPONENTE: CALENDARIO MENSUAL PERSONALIZADO ===
const CustomCalendar = ({ fechaSeleccionada, setFechaSeleccionada, onClose, fechasConProcesos }) => {
  const parts = fechaSeleccionada.split('-');
  const initialDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, 1) : new Date();
  const [viewDate, setViewDate] = useState(initialDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const prevMonth = (e) => { e.preventDefault(); setViewDate(new Date(year, month - 1, 1)); };
  const nextMonth = (e) => { e.preventDefault(); setViewDate(new Date(year, month + 1, 1)); };
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return (
    <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] w-[300px] p-4 z-50">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-lg transition-colors"><ChevronLeft className="w-5 h-5"/></button>
        <span className="text-[15px] font-bold text-[#0f172a] capitalize">{monthNames[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] rounded-lg transition-colors"><ChevronRight className="w-5 h-5"/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Do','Lu','Ma','Mi','Ju','Vi','Sa'].map(d => <span key={d} className="text-[11px] font-black text-[#64748b] uppercase">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {blanks.map((_, i) => <div key={`blank-${i}`} className="w-8 h-8"></div>)}
        {days.map(d => {
          const dateStr = `${String(d).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}-${year}`;
          const hasProcess = fechasConProcesos.includes(dateStr);
          const isSelected = dateStr === fechaSeleccionada;
          return (
            <button
              key={d}
              disabled={!hasProcess}
              onClick={() => { if (hasProcess) { setFechaSeleccionada(dateStr); onClose(); } }}
              title={!hasProcess ? 'No hay procesos este día' : ''}
              className={`w-8 h-8 mx-auto rounded-full text-[13px] font-medium flex items-center justify-center transition-all ${
                isSelected ? 'bg-[#10b981] text-white font-bold shadow-sm transform scale-110' :
                hasProcess ? 'bg-[#f1f5f9] text-[#0f172a] font-bold hover:bg-[#e2e8f0]' :
                'text-[#94a3b8] cursor-not-allowed hover:bg-[#f8fafc]'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
const renderCustomBarLabel = props => {
  const { x, y, width, value } = props;
  if (value === undefined || value === null || Number(value) === 0) return null;
  const cx = x + width / 2, cy = y - 5;
  return <text x={cx} y={cy} fill="#0f172a" textAnchor="start" fontSize={11.6} fontWeight="bold" transform={`rotate(-90 ${cx} ${cy})`}>{`${Number(value).toFixed(1)}%`}</text>;
};
export default function DashboardResumenDiario({ onClose, onAbrirMenu }) {
  const [allInspecciones, setAllInspecciones] = useState([]);
  const [fechasConProcesos, setFechasConProcesos] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getHoyStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [svgMounted, setSvgMounted] = useState(false);
  const [donutHover, setDonutHover] = useState(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState('');
  const [parametrosActuales, setParametrosActuales] = useState({ calidad: [], condicion: [] });
  const [planta, setPlanta] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [intentoCarga, setIntentoCarga] = useState(0);
  // REFERENCIAS PARA EL SCROLL INFINITO
  const scrollRef = useRef(null);
  const tbodyRef = useRef(null);
  const [kpis, setKpis] = useState({ procesos: 0, exportable: 0, notaPredominante: '-', categoriaPredominante: '-', calidad: 0, condicion: 0 });
  // NÚMEROS ANIMADOS
  const procesosAnim = useCountUp(kpis.procesos, 800, 0);
  const exportableAnim = useCountUp(kpis.exportable, 1100, 1);
  const calidadAnim = useCountUp(kpis.calidad, 1000, 1);
  const condicionAnim = useCountUp(kpis.condicion, 1000, 1);
  const [distribucionNotas, setDistribucionNotas] = useState([
    { name: 'A1', descripcion: 'Óptimo', value: 0.0001, displayValue: 0, color: '#10b981' },
    { name: 'A2', descripcion: 'Regular', value: 0.0001, displayValue: 0, color: '#eab308' },
    { name: 'A3', descripcion: 'Crítico', value: 0.0001, displayValue: 0, color: '#f43f5e' }
  ]);
  const [nivelDesempeno, setNivelDesempeno] = useState({ optimo: { cant: 0, pct: 0 }, regular: { cant: 0, pct: 0 }, critico: { cant: 0, pct: 0 } });
  const [tablaProcesos, setTablaProcesos] = useState([]);
  const [defectosCalidad, setDefectosCalidad] = useState([]);
  const [defectosCondicion, setDefectosCondicion] = useState([]);
  const [brixData, setBrixData] = useState([
    { rango: '<14', Light: 0, Dark: 0 }, { rango: '14-16', Light: 0, Dark: 0 },
    { rango: '16-18', Light: 0, Dark: 0 }, { rango: '>18', Light: 0, Dark: 0 }
  ]);
  const [chartData, setChartData] = useState([]);
  // Trigger para dibujar la dona suavemente
  useEffect(() => {
    setSvgMounted(true);
  }, []);
  useEffect(() => {
    let activo = true;
    let tiempoAgotado = false;
    const controller = new AbortController();
    const temporizador = setTimeout(() => {
      tiempoAgotado = true;
      controller.abort();
    }, 15000);
    const opciones = { method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal };
    const cargarDatos = async () => {
      setErrorCarga('');
      setPlanta(null);
      try {
        // Confirmar la planta antes de consultar inspecciones y parámetros.
        const resPlanta = await fetch(`${API_URL}/api/planta`, opciones);
        if (!resPlanta.ok) throw new Error(`No se pudo identificar la planta (HTTP ${resPlanta.status}). Comprueba que el backend tenga /api/planta.`);
        const plantaVerificada = validarPlantaResumen(await resPlanta.json());
        if (!activo) return;
        if (controller.signal.aborted) throw new Error('Consulta cancelada.');
        setPlanta(plantaVerificada);
        const [resInspecciones, resParametros] = await Promise.all([
          fetch(`${API_URL}/api/inspecciones`, opciones),
          fetch(`${API_URL}/api/parametros`, opciones)
        ]);
        if (!resInspecciones.ok) throw new Error(`No se pudieron cargar las inspecciones (HTTP ${resInspecciones.status}).`);
        const data = await resInspecciones.json();
        if (!Array.isArray(data)) throw new Error('El backend no devolvió una lista de inspecciones válida.');
        const parametros = resParametros.ok ? await resParametros.json() : { calidad: [], condicion: [] };
        if (!activo) return;
        if (controller.signal.aborted) throw new Error('Consulta cancelada.');
        setParametrosActuales({
          calidad: Array.isArray(parametros.calidad) ? parametros.calidad : [],
          condicion: Array.isArray(parametros.condicion) ? parametros.condicion : []
        });
        setAllInspecciones(data);
        setUltimaSincronizacion(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
        const arrFechas = [...new Set(data.map(fechaProceso).filter(Boolean))];
        setFechasConProcesos(arrFechas);
        if (!arrFechas.includes(getHoyStr()) && arrFechas.length) setFechaSeleccionada(arrFechas[arrFechas.length - 1]);
      } catch (err) {
        if (!activo) return;
        const mensaje = tiempoAgotado
          ? 'El servidor no respondió a tiempo. Revisa la conexión e intenta nuevamente.'
          : err instanceof SyntaxError
            ? 'El servidor no devolvió JSON válido. Revisa el backend y el proxy /api.'
            : err instanceof TypeError
              ? 'No se pudo cargar el resumen diario. Revisa la conexión y la respuesta del backend.'
              : err.message || 'No se pudo cargar el resumen diario.';
        setErrorCarga(mensaje);
        console.error('Error al cargar resumen diario:', err);
        controller.abort();
      } finally {
        clearTimeout(temporizador);
      }
    };
    cargarDatos();
    return () => { activo = false; clearTimeout(temporizador); controller.abort(); };
  }, [intentoCarga]);
  useEffect(() => {
    if (!allInspecciones.length) return;
    const procesosDelDia = allInspecciones.filter(p => fechaProceso(p) === fechaSeleccionada);
    const totalProc = procesosDelDia.length;
    if (!totalProc) {
      setKpis({ procesos: 0, exportable: 0, notaPredominante: '-', categoriaPredominante: '-', calidad: 0, condicion: 0 });
      setTablaProcesos([]); setDefectosCalidad([]); setDefectosCondicion([]); setChartData([]);
      setBrixData([{ rango: '<14', Light: 0, Dark: 0 }, { rango: '14-16', Light: 0, Dark: 0 }, { rango: '16-18', Light: 0, Dark: 0 }, { rango: '>18', Light: 0, Dark: 0 }]);
      setDistribucionNotas([
        { name: 'A1', descripcion: 'Óptimo', value: 0.0001, displayValue: 0, color: '#10b981' },
        { name: 'A2', descripcion: 'Regular', value: 0.0001, displayValue: 0, color: '#eab308' },
        { name: 'A3', descripcion: 'Crítico', value: 0.0001, displayValue: 0, color: '#f43f5e' }
      ]);
      setNivelDesempeno({ optimo: { cant: 0, pct: 0 }, regular: { cant: 0, pct: 0 }, critico: { cant: 0, pct: 0 } });
      return;
    }
    let sumaExportable = 0, sumaCalidad = 0, sumaCondicion = 0, procesosConMuestra = 0;
    let notaA1 = 0, notaA2 = 0, notaA3 = 0, evaluables = 0;
    let desempenoOptimo = 0, desempenoRegular = 0, desempenoCritico = 0;
    const notasMap = {}, categoriasMap = { 'Óptimo': 0, 'Regular': 0, 'Crítico': 0 };
    const tablaFormateada = [], acumuladorCalidad = {}, acumuladorCondicion = {};
    const brixCount = { '<14': { Light: 0, Dark: 0 }, '14-16': { Light: 0, Dark: 0 }, '16-18': { Light: 0, Dark: 0 }, '>18': { Light: 0, Dark: 0 } };
    let totalLight = 0, totalDark = 0;
    const evolucion = [];
    procesosDelDia.forEach((p, index) => {
      const met = evaluarProceso(p, parametrosActuales);
      if (met.totalFrutos > 0) {
        procesosConMuestra++;
        sumaExportable += met.pExp; sumaCalidad += met.pCal; sumaCondicion += met.pCond;
        if (met.pExp >= 90) desempenoOptimo++;
        else if (met.pExp >= 80) desempenoRegular++;
        else desempenoCritico++;
      }
      Object.entries(met.agregadoCal).forEach(([n, v]) => acumuladorCalidad[n] = (acumuladorCalidad[n] || 0) + v);
      Object.entries(met.agregadoCond).forEach(([n, v]) => acumuladorCondicion[n] = (acumuladorCondicion[n] || 0) + v);
      if (met.nota !== '-') {
        evaluables++;
        notasMap[met.nota] = (notasMap[met.nota] || 0) + 1;
        categoriasMap[met.categoria]++;
        if (met.categoria === 'Óptimo') notaA1++;
        else if (met.categoria === 'Regular') notaA2++;
        else notaA3++;
      }
      [...met.brixLight].forEach(b => {
        totalLight++;
        const r = b < 14 ? '<14' : b < 16 ? '14-16' : b <= 18 ? '16-18' : '>18';
        brixCount[r].Light++;
      });
      [...met.brixDark].forEach(b => {
        totalDark++;
        const r = b < 14 ? '<14' : b < 16 ? '14-16' : b <= 18 ? '16-18' : '>18';
        brixCount[r].Dark++;
      });
      if (met.totalFrutos > 0) evolucion.push({ time: horaProceso(p), value: Number(met.pExp.toFixed(1)), orden: new Date(p.horaInicio || p.horaFin || 0).getTime() || index });
      tablaFormateada.push({
        id: p.id || index + 1,
        numProceso: p.numProceso || '-',
        huerto: p.huerto || p.productor || '-',
        exportable: `${met.pExp.toFixed(1)}%`,
        nota: met.nota,
        estado: met.estado
      });
    });
    const notaPredominante = Object.entries(notasMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const categoriaPredominante = Object.entries(categoriasMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    setKpis({
      procesos: totalProc,
      exportable: procesosConMuestra ? sumaExportable / procesosConMuestra : 0,
      notaPredominante,
      categoriaPredominante,
      calidad: procesosConMuestra ? sumaCalidad / procesosConMuestra : 0,
      condicion: procesosConMuestra ? sumaCondicion / procesosConMuestra : 0
    });
    const baseNotas = evaluables || 1;
    setDistribucionNotas([
      { name: 'A1', descripcion: 'Óptimo', value: notaA1 || 0.0001, displayValue: (notaA1 / baseNotas) * 100, color: '#10b981' },
      { name: 'A2', descripcion: 'Regular', value: notaA2 || 0.0001, displayValue: (notaA2 / baseNotas) * 100, color: '#eab308' },
      { name: 'A3', descripcion: 'Crítico', value: notaA3 || 0.0001, displayValue: (notaA3 / baseNotas) * 100, color: '#f43f5e' }
    ]);
    const baseDesempeno = procesosConMuestra || 1;
    setNivelDesempeno({
      optimo: { cant: desempenoOptimo, pct: (desempenoOptimo / baseDesempeno) * 100 },
      regular: { cant: desempenoRegular, pct: (desempenoRegular / baseDesempeno) * 100 },
      critico: { cant: desempenoCritico, pct: (desempenoCritico / baseDesempeno) * 100 }
    });
    setTablaProcesos(tablaFormateada);
    const totalFrutosDia = procesosDelDia.reduce((sum, p) => sum + (p.cajas || []).reduce((s, c) => s + (parseInt(c.frutos) || 0), 0), 0);
    const formatDefectos = obj => totalFrutosDia ? Object.entries(obj)
      .map(([nombre, cant]) => ({ nombre, pct: (cant / totalFrutosDia) * 100 }))
      .filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 6) : [];
    setDefectosCalidad(formatDefectos(acumuladorCalidad));
    setDefectosCondicion(formatDefectos(acumuladorCondicion));
    setBrixData(Object.keys(brixCount).map(rango => ({
      rango,
      Light: totalLight ? (brixCount[rango].Light / totalLight) * 100 : 0,
      Dark: totalDark ? (brixCount[rango].Dark / totalDark) * 100 : 0
    })));
    setChartData(evolucion.sort((a, b) => a.orden - b.orden).map(({ orden, ...item }) => item));
  }, [fechaSeleccionada, allInspecciones, parametrosActuales]);
  // ================= EFECTO AUTO-SCROLL (INFINITO CONTINUO PERFECTO) =================
  useEffect(() => {
    const el = scrollRef.current;
    const tbody = tbodyRef.current;
    if (!el || !tbody || tablaProcesos.length <= 4) return;
    let scrollAmount = 0;
    let isPaused = false;
    let animationFrameId;
    el.style.scrollBehavior = 'auto';
    const step = () => {
      if (!isPaused) {
        if (Math.abs(el.scrollTop - scrollAmount) > 2) {
          scrollAmount = el.scrollTop;
        }
        scrollAmount += 0.5; // Velocidad de bajada
        const targetHeight = tbody.offsetHeight;
        if (scrollAmount >= targetHeight) {
          scrollAmount -= targetHeight;
        }
        el.scrollTop = scrollAmount;
      }
      animationFrameId = requestAnimationFrame(step);
    };
    animationFrameId = requestAnimationFrame(step);
    const pause = () => isPaused = true;
    const play = () => isPaused = false;
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', play);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', play);
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (el) {
        el.removeEventListener('mouseenter', pause);
        el.removeEventListener('mouseleave', play);
        el.removeEventListener('touchstart', pause);
        el.removeEventListener('touchend', play);
      }
    };
  }, [tablaProcesos]);
  return (
    <div className="w-full h-full flex flex-col bg-[#f8fafc]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* 🎨 ESTILOS INYECTADOS CON ANIMACIONES DISEÑADAS */}
      <style>{`
        /* Scroll Infinito */
        .auto-scroll-table::-webkit-scrollbar { width: 6px; height: 6px; }
        .auto-scroll-table::-webkit-scrollbar-track { background: transparent; }
        .auto-scroll-table::-webkit-scrollbar-thumb { background-color: rgba(100, 116, 139, 0.15); border-radius: 10px; transition: background-color 0.3s ease; }
        .auto-scroll-table:hover::-webkit-scrollbar-thumb, .auto-scroll-table:active::-webkit-scrollbar-thumb { background-color: rgba(100, 116, 139, 0.8); }
        /* Animaciones Base */
        @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeInUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        /* Pulso Sutil */
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.6; } }
        .animate-pulse-dot { animation: pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        /* Efecto Radar Evolución */
        @keyframes radarPing { 0% { r: 6; opacity: 0.9; stroke-width: 2; } 70% { r: 16; opacity: 0; stroke-width: 1; } 100% { r: 18; opacity: 0; } }
        .animate-ping-ring { transform-origin: center; animation: radarPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        /* Micro-interacciones (Hover States) */
        .kpi-card { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
        .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04); }
        .table-row-hover { transition: background-color 0.2s ease, transform 0.15s ease; cursor: default; }
        .table-row-hover:hover { background-color: #f8fafc; transform: scale(1.002); }
        .defect-item { transition: background-color 0.2s ease, padding 0.2s ease; }
        .defect-item:hover .defect-bar { filter: brightness(1.15); box-shadow: 0 0 8px rgba(0, 0, 0, 0.08); } /* Sombra sutil sin alterar el color */
        /* Dona: transición por segmento */
        .donut-arc, .donut-gap { transition: stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1), stroke-width .22s ease, opacity .22s ease; }
        @media (max-width: 767px) { .kpi-card:hover { transform: none; } }
        @media (min-width: 1800px) { .kpi-card { min-height: 68px !important; } }
      `}</style>
      {/* ENCABEZADO TIPO APP */}
      <div className="flex items-center justify-between bg-[#ffffff] border-b border-[#f1f5f9] px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onAbrirMenu} className="p-2 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse-dot"></div>
             <h1 className="text-[13px] sm:text-[14px] lg:text-[15px] font-black text-[#0f172a] tracking-tight uppercase">Resumen diario de calidad</h1>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-[#64748b] hover:bg-[#ffe4e6] hover:text-[#e11d48] rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* CONTENEDOR CON SCROLL */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative z-10">
        <div className="w-full min-w-0 px-3 sm:px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3 lg:px-8 lg:pb-8 lg:pt-4 space-y-4 md:space-y-6">
          {/* HEADER INTERNO CON TÍTULO MODIFICADO Y HORA DE SINCRONIZACIÓN */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 relative z-40">
            <div>
              <h2 className="text-[18px] sm:text-[20px] md:text-[22px] font-black text-[#0f172a] tracking-tight uppercase">Resumen diario de calidad</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[14px] md:text-[15px] text-[#64748b] font-medium">{planta ? `Planta ${planta.plantaNombre}` : errorCarga ? 'Planta sin identificar' : 'Verificando planta...'}</p>
                <span className="text-[#94a3b8] text-sm">•</span>
                <p className="text-[13px] text-[#64748b] flex items-center gap-1.5 bg-[#f1f5f9] px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                  <RefreshCw className="w-3.5 h-3.5 text-[#94a3b8]" />
                  Última sincronización: <span className="font-bold text-[#0f172a]">{ultimaSincronizacion || (errorCarga ? 'Sin sincronizar' : 'Cargando...')}</span>
                </p>
              </div>
            </div>
            <div className="relative mt-0 w-full md:w-auto">
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center justify-between md:justify-start w-full md:w-auto bg-[#ffffff] border border-[#f1f5f9] rounded-xl p-2.5 shadow-sm gap-3 cursor-pointer hover:border-[#e2e8f0] transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-2 pl-2">
                  <Calendar className="w-4 h-4 text-[#0f172a]" />
                  <span className="text-[12px] text-[#64748b] font-semibold uppercase tracking-wider">Fecha:</span>
                </div>
                <div className="flex items-center gap-2 bg-[#f8fafc] px-4 py-1.5 rounded-lg border border-[#f1f5f9]">
                  <span className="text-[14px] text-[#0f172a] font-black">{fechaSeleccionada}</span>
                  <ChevronDown className={`w-4 h-4 text-[#64748b] ml-2 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {calendarOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCalendarOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 z-50 animate-fade-in">
                    <CustomCalendar fechaSeleccionada={fechaSeleccionada} setFechaSeleccionada={setFechaSeleccionada} onClose={() => setCalendarOpen(false)} fechasConProcesos={fechasConProcesos}/>
                  </div>
                </>
              )}
            </div>
          </div>
          {errorCarga && (
            <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <p className="text-sm font-semibold">{errorCarga}</p>
              <button type="button" onClick={() => setIntentoCarga(v => v + 1)} className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold hover:bg-red-100">Reintentar</button>
            </div>
          )}
          {/* ================= SECCIÓN 1: KPIs ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4 relative z-10 mt-2">
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-2 flex flex-col items-center justify-center min-h-[82px] xl:min-h-[68px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#475569] text-left w-full uppercase tracking-wider absolute top-2 left-4">PROCESOS INSPECCIONADOS</p>
              <p className="text-[28px] sm:text-[31px] lg:text-[33px] xl:text-[35px] font-black text-[#0f172a] leading-none mt-4">
                {procesosAnim.formatted}
              </p>
            </div>
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-2 flex flex-col items-center justify-center min-h-[82px] xl:min-h-[68px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#475569] text-left w-full uppercase tracking-wider absolute top-2 left-4">NOTA PREDOMINANTE</p>
              <p className="text-[28px] sm:text-[31px] lg:text-[33px] xl:text-[35px] font-black text-[#0f172a] leading-none mt-4 animate-fade-in">
                {kpis.notaPredominante}
              </p>
            </div>
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-2 flex flex-col items-center justify-center min-h-[82px] xl:min-h-[68px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#475569] text-left w-full uppercase tracking-wider absolute top-2 left-4">DEFECTOS CALIDAD (PROMEDIO)</p>
              {/* Aplicado el color amarillo dorado más oscuro (#eab308) */}
              <p className="text-[28px] sm:text-[31px] lg:text-[33px] xl:text-[35px] font-black text-[#eab308] leading-none mt-4">
                {calidadAnim.formatted}%
              </p>
            </div>
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-2 flex flex-col items-center justify-center min-h-[82px] xl:min-h-[68px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#475569] text-left w-full uppercase tracking-wider absolute top-2 left-4">DEFECTOS CONDICIÓN (PROMEDIO)</p>
              <p className="text-[28px] sm:text-[31px] lg:text-[33px] xl:text-[35px] font-black text-[#e11d48] leading-none mt-4">
                {condicionAnim.formatted}%
              </p>
            </div>
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-5 py-2 flex flex-col justify-center min-h-[82px] xl:min-h-[68px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#475569] text-left w-full uppercase tracking-wider absolute top-2 left-5">
                NIVEL EXPORTABLE GENERAL
              </p>
              <div className="w-full mt-4">
                <p className="text-[27px] sm:text-[29px] xl:text-[32px] font-black leading-none mb-1 text-[#0f172a] text-center">
                  {exportableAnim.formatted}%
                </p>
                <div className="relative w-full">
                  <div className="relative h-[8px] w-full overflow-visible">
                    <div className="absolute inset-0 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#f87171]" style={{ width: '33.3333%' }} />
                      <div className="h-full bg-gradient-to-r from-[#facc15] to-[#eab308]" style={{ width: '33.3333%' }} />
                      <div className="h-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: '33.3333%' }} />
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[1.5px] border-[#0f172a] rounded-full shadow-sm transition-all duration-300 z-10"
                      style={{ left: `calc(${posicionSegmentadaExportable(exportableAnim.raw)}% - 8px)` }} />
                  </div>
                  <div className="relative h-3 mt-0.5 text-[10px] font-semibold text-[#475569]">
                    <span className="absolute left-1/3 -translate-x-1/2">80</span>
                    <span className="absolute left-2/3 -translate-x-1/2">90</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-1 text-[12px] font-bold text-center">
                    <span className="text-[#ef4444]">Crítico</span>
                    <span className="text-[#ca8a04]">Regular</span>
                    <span className="text-[#059669]">Óptimo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 2: GRÁFICOS INTERMEDIOS ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
            {/* Distribución Nota (Dona SVG Dinámica con Efecto Degradado) */}
            <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-4 text-left uppercase tracking-wider">DISTRIBUCIÓN DE CALIFICACIONES</h3>
              <div className="flex-1 flex flex-col sm:flex-row items-center justify-between w-full mt-2 gap-4">
                <div className="w-full sm:w-1/2 h-[194px] flex items-center justify-center">
                  <div className="relative w-[180px] h-[180px] flex items-center justify-center donut-container">
                    <svg className="w-full h-full -rotate-90 transform overflow-visible" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      {/* DEFINICIÓN DE GRADIENTES PARA LA DONA */}
                      <defs>
                        <linearGradient id="gradDonutA1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                        <linearGradient id="gradDonutA2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#facc15" />
                          {/* Aplicado el color amarillo dorado (#eab308) */}
                          <stop offset="100%" stopColor="#eab308" />
                        </linearGradient>
                        <linearGradient id="gradDonutA3" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#fb7185" />
                          <stop offset="100%" stopColor="#e11d48" />
                        </linearGradient>
                      </defs>
                      {/* BORDES CONCÉNTRICOS ESTRUCTURALES */}
                      <circle cx="50" cy="50" r="44" fill="transparent" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" className="opacity-60" />
                      <circle cx="50" cy="50" r="32" fill="transparent" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" className="opacity-60" />
                      {/* RIEL BASE DE FONDO */}
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="11" />
                      {/* SEGMENTOS DINÁMICOS CON BORDES BLANCOS DE CORTE Y SIN GLOW EXTERNO */}
                      {(() => {
                        const validData = distribucionNotas.filter(d => d.displayValue > 0);
                        const total = validData.reduce((acc, d) => acc + d.displayValue, 0);
                        if (total === 0) return null;
                        const radius = 38;
                        const circumference = 2 * Math.PI * radius;
                        let currentOffset = 0;
                        return validData.map((item, index) => {
                          const pct = item.displayValue / total;
                          const sliceLength = pct * circumference;
                          const currentDashOffset = -currentOffset;
                          // Selección del gradiente correspondiente
                          const strokeGradient = item.name === 'A1' ? 'url(#gradDonutA1)' : item.name === 'A2' ? 'url(#gradDonutA2)' : 'url(#gradDonutA3)';
                          const activo = donutHover === item.name;
                          const atenuado = donutHover && !activo;
                          const element = (
                            <g key={index} onMouseEnter={() => setDonutHover(item.name)} onMouseLeave={() => setDonutHover(null)} style={{ cursor: 'pointer' }}>
                              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#ffffff" strokeWidth={activo ? 15 : 14} strokeLinecap="round"
                                strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`} strokeDashoffset={currentDashOffset} className="donut-gap" opacity={atenuado ? .5 : 1} />
                              <circle cx="50" cy="50" r="38" fill="transparent" stroke={strokeGradient} strokeWidth={activo ? 13 : 11} strokeLinecap="round"
                                strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`} strokeDashoffset={currentDashOffset} className="donut-arc" opacity={atenuado ? .42 : 1} />
                            </g>
                          );
                          currentOffset += sliceLength;
                          return element;
                        });
                      })()}
                    </svg>
                  </div>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col gap-4 sm:pl-6 sm:border-l border-[#f1f5f9]">
                  {distribucionNotas.map((item, idx) => {
                    const activo = donutHover === item.name, atenuado = donutHover && !activo;
                    return (
                      <div key={idx} onMouseEnter={() => setDonutHover(item.name)} onMouseLeave={() => setDonutHover(null)}
                        className={`flex items-center justify-between w-full rounded-lg px-2 py-1.5 -mx-2 transition-all duration-200 cursor-default ${activo ? 'bg-[#f8fafc] scale-[1.025] shadow-sm' : ''} ${atenuado ? 'opacity-45' : 'opacity-100'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full transition-transform ${activo ? 'scale-125' : ''}`} style={{ backgroundColor: item.color }}></div>
                          <span className="text-[13px] font-normal text-[#64748b]"><strong className="font-bold text-[#0f172a]">{item.name}</strong> ({item.descripcion})</span>
                        </div>
                        <span className="text-[15px] font-bold text-[#0f172a]">{item.displayValue.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Nivel de desempeño */}
            <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col relative hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-6 text-left uppercase tracking-wider">NIVEL DE DESEMPEÑO DE PROCESOS</h3>
              <div className="flex-1 flex flex-col justify-center space-y-6 px-2">
                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div><span className="text-[13px] text-[#0f172a] font-bold">Óptimo (90% a 100%)</span></div>
                    <span className="text-[15px] text-[#0f172a] font-bold">{nivelDesempeno.optimo.cant} <span className="text-[13px] font-normal text-[#64748b]">({nivelDesempeno.optimo.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                     {/* Aplicado gradiente para nivel óptimo */}
                     <div className="bg-gradient-to-r from-[#34d399] to-[#10b981] h-full rounded-full defect-bar" style={{ width: `${nivelDesempeno.optimo.pct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                  </div>
                </div>
                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    {/* Aplicado el color amarillo dorado (#eab308) */}
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></div><span className="text-[13px] text-[#0f172a] font-bold">Regular (80% a 89,9%)</span></div>
                    <span className="text-[15px] text-[#0f172a] font-bold">{nivelDesempeno.regular.cant} <span className="text-[13px] font-normal text-[#64748b]">({nivelDesempeno.regular.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                    {/* Aplicado gradiente amarillo dorado para nivel regular */}
                    <div className="bg-gradient-to-r from-[#facc15] to-[#eab308] h-full rounded-full defect-bar" style={{ width: `${nivelDesempeno.regular.pct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                  </div>
                </div>
                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[13px] text-[#0f172a] font-bold">Crítico (&lt; 80%)</span></div>
                    <span className="text-[15px] text-[#0f172a] font-bold">{nivelDesempeno.critico.cant} <span className="text-[13px] font-normal text-[#64748b]">({nivelDesempeno.critico.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                     {/* Aplicado gradiente para nivel crítico */}
                     <div className="bg-gradient-to-r from-[#fb7185] to-[#e11d48] h-full rounded-full defect-bar" style={{ width: `${nivelDesempeno.critico.pct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                  </div>
                </div>
              </div>
            </div>
            {/* Distribución Brix */}
            <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-2 text-left uppercase tracking-wider">DISTRIBUCIÓN DE SÓLIDOS SOLUBLES</h3>
              <div className="flex justify-center gap-6 mb-2 mt-1">
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#D06C79] rounded-sm"></div><span className="text-[12px] text-[#64748b] font-medium uppercase">Light</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#7A1F3D] rounded-sm"></div><span className="text-[12px] text-[#64748b] font-medium uppercase">Dark</span></div>
              </div>
              <div className="flex-1 w-full min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brixData} margin={{ top: 44, right: 10, left: -25, bottom: 0 }} barCategoryGap="28%" barGap={3}>
                    <defs>
                      <linearGradient id="gradLightBrix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EBA0A8"/><stop offset="100%" stopColor="#D77A86"/></linearGradient>
                      <linearGradient id="gradDarkBrix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8A2747"/><stop offset="100%" stopColor="#5A1430"/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="rango" axisLine={false} tickLine={false} tick={{ fontSize: 12.7, fill: '#475569', fontWeight: 600 }} dy={10} tickFormatter={v => `${v}°Brix`} />
                    <YAxis ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip cursor={{ fill: '#f8fafc', opacity: 0.55 }} formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} labelFormatter={label => `${label}°Brix`} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,.10)', fontWeight: 600, padding: '9px 12px' }} />
                    <Bar dataKey="Light" fill="url(#gradLightBrix)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} animationDuration={1000} barSize={20} opacity={0.76} activeBar={{ opacity: 1 }} />
                    <Bar dataKey="Dark" fill="url(#gradDarkBrix)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} animationDuration={1000} barSize={20} opacity={0.78} activeBar={{ opacity: 1 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 3: TABLA Y GRÁFICO ================= */}
          <div className="grid grid-cols-12 gap-5">
            {/* Gráfico Evolución (Con Gradiente en la Línea) */}
            <div className="col-span-12 lg:col-span-5 bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-6 text-left uppercase tracking-wider">EVOLUCIÓN DEL PORCENTAJE EXPORTABLE</h3>
              <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLine" x1="0" y1="0" x2="1" y2="0">
                        {/* Gradiente amarillo dorado a naranja oscuro para la línea principal */}
                        <stop offset="0%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} dy={10} interval="preserveStartEnd" />
                    <YAxis domain={[60, 100]} ticks={[60, 70, 80, 90, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => `${val}%`} allowDataOverflow/>
                    <ReferenceLine y={80} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 6" />
                    <Tooltip formatter={value => [`${Number(value).toFixed(1)}%`, 'Exportable']} labelStyle={{ color: '#334155', fontWeight: 800, marginBottom: 4 }} itemStyle={{ color: '#0f172a', fontWeight: 600 }} contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 12px 30px rgba(15,23,42,.12)', padding: '10px 14px' }} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="value" stroke="url(#gradLine)" strokeWidth={3} dot={{ r: 4, fill: '#ea580c', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#ea580c', strokeWidth: 2 }} animationDuration={1500} connectNulls/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* TABLA CON AUTO-SCROLL INFINITO Y HOVER ROW */}
            <div className="col-span-12 lg:col-span-7 bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col min-w-0 hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-4 text-left uppercase tracking-wider shrink-0">DETALLE DE PROCESOS DEL DÍA</h3>
              <div className="border border-[#f1f5f9] rounded-xl overflow-hidden w-full h-[255px]">
                <div ref={scrollRef} className="overflow-y-auto overflow-x-auto auto-scroll-table w-full h-full relative group">
                  <table className="w-full text-[12px] text-left min-w-[500px]">
                    <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#f1f5f9] sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                      <tr>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">N° Proceso</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Huerto</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">% Exportable</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Calificación</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Estado</th>
                      </tr>
                    </thead>
                    <tbody ref={tbodyRef} className="divide-y divide-[#f1f5f9]">
                      {tablaProcesos.map((row) => (
                        <tr key={row.id} className="bg-[#ffffff] table-row-hover">
                          <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap">{row.numProceso}</td>
                          <td className="py-3.5 px-4 text-[13px] text-[#334155] truncate max-w-[200px] font-normal">{row.huerto}</td>
                          <td className="py-3.5 px-4 font-black text-[#0f172a] whitespace-nowrap">{row.exportable}</td>
                          <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${claseNota(row.nota)}`}>{row.nota}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                             <span className={`flex items-center gap-1.5 text-xs font-semibold ${row.estado === 'Aprobado' ? 'text-[#047857]' : row.estado === 'En curso' ? 'text-[#2563eb]' : 'text-[#e11d48]'}`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-[#10b981]' : row.estado === 'En curso' ? 'bg-[#3b82f6]' : 'bg-[#ef4444]'}`}></div>
                               {row.estado}
                             </span>
                          </td>
                        </tr>
                      ))}
                      {tablaProcesos.length === 0 && (
                        <tr className="bg-[#ffffff]">
                          <td colSpan="5" className="py-8 text-center font-bold text-[#94a3b8]">No hay procesos registrados para esta fecha.</td>
                        </tr>
                      )}
                    </tbody>
                    {/* Clonación perfecta de la tabla para lograr el bucle infinito */}
                    {tablaProcesos.length > 4 && (
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {tablaProcesos.map((row) => (
                          <tr key={`clone-${row.id}`} className="bg-[#ffffff] table-row-hover">
                            <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap">{row.numProceso}</td>
                            <td className="py-3.5 px-4 text-[13px] text-[#334155] truncate max-w-[200px] font-normal">{row.huerto}</td>
                            <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap">{row.exportable}</td>
                            <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${claseNota(row.nota)}`}>{row.nota}</span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                               <span className={`flex items-center gap-1.5 text-xs font-semibold ${row.estado === 'Aprobado' ? 'text-[#047857]' : row.estado === 'En curso' ? 'text-[#2563eb]' : 'text-[#e11d48]'}`}>
                                 <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-[#10b981]' : row.estado === 'En curso' ? 'bg-[#3b82f6]' : 'bg-[#ef4444]'}`}></div>
                                 {row.estado}
                               </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 4: DESGLOSE DE DEFECTOS ================= */}
          <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-[14px] font-bold text-[#0f172a] mb-6 text-left uppercase tracking-wider">
              DEFECTOS PRINCIPALES DEL DÍA <span className="text-[#64748b] text-[12px] font-normal normal-case tracking-normal ml-2">(Promedio del total de procesos inspeccionados)</span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
              <div>
                {/* Cambiado color del header a #eab308 para defectos de calidad */}
                <h4 className="flex items-center text-[13px] font-bold text-[#eab308] mb-4 uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#eab308] mr-2"></div>
                  DEFECTOS DE CALIDAD
                </h4>
                <div className="space-y-1">
                  {defectosCalidad.length > 0 ? defectosCalidad.map((defecto, index) => (
                    // Gradiente amarillo dorado específico para los defectos de calidad
                    <BarraDefecto key={index} nombre={defecto.nombre} pct={defecto.pct} colorClass="bg-gradient-to-r from-[#facc15] to-[#eab308]" />
                  )) : <p className="text-sm font-bold text-[#94a3b8] py-4 text-center">Sin defectos registrados</p>}
                </div>
              </div>
              <div className="lg:border-l border-[#f1f5f9] lg:pl-12">
                <h4 className="flex items-center text-[13px] font-bold text-[#e11d48] mb-4 uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e11d48] mr-2"></div>
                  DEFECTOS DE CONDICIÓN
                </h4>
                <div className="space-y-1">
                  {defectosCondicion.length > 0 ? defectosCondicion.map((defecto, index) => (
                    <BarraDefecto key={index} nombre={defecto.nombre} pct={defecto.pct} colorClass="bg-gradient-to-r from-[#fb7185] to-[#e11d48]" />
                  )) : <p className="text-sm font-bold text-[#94a3b8] py-4 text-center">Sin defectos registrados</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

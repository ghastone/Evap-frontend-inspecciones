import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar
} from 'recharts';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Menu, X, RefreshCw } from 'lucide-react';

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
      <span className="w-1/3 text-[12px] font-medium text-[#64748b] truncate pr-2" title={nombre}>{nombre}</span>
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

const renderCustomBarLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  return (
    <text x={x + width / 2} y={y - 8} fill="#0f172a" textAnchor="middle" fontSize={12} fontWeight="bold">
      {value}%
    </text>
  );
};

export default function DashboardResumenDiario({ onClose, onAbrirMenu }) {
  const [allInspecciones, setAllInspecciones] = useState([]);
  const [fechasConProcesos, setFechasConProcesos] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getHoyStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [svgMounted, setSvgMounted] = useState(false);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState('');

  // REFERENCIAS PARA EL SCROLL INFINITO
  const scrollRef = useRef(null);
  const tbodyRef = useRef(null); 

  const [kpis, setKpis] = useState({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
  
  // NÚMEROS ANIMADOS
  const procesosAnim = useCountUp(kpis.procesos, 800, 0);
  const exportableAnim = useCountUp(kpis.exportable, 1100, 1);
  const calidadAnim = useCountUp(kpis.calidad, 1000, 1);
  const condicionAnim = useCountUp(kpis.condicion, 1000, 1);

  // Actualizado con el amarillo dorado oscuro #eab308 para la nota A2
  const [distribucionNotas, setDistribucionNotas] = useState([
    { name: 'A1', value: 0.0001, displayValue: 0, color: '#10b981' }, 
    { name: 'A2', value: 0.0001, displayValue: 0, color: '#eab308' },
    { name: 'A3', value: 0.0001, displayValue: 0, color: '#f43f5e' },
  ]);
  
  // Animación del número de la Dona central
  const notaPredominanteVal = distribucionNotas.find(d => kpis.notaPredominante.includes(d.name))?.displayValue || 0;
  const donutAnim = useCountUp(notaPredominanteVal, 1200, 0);

  const [nivelDesempeno, setNivelDesempeno] = useState({ optimo: { cant: 0, pct: 0 }, regular: { cant: 0, pct: 0 }, critico: { cant: 0, pct: 0 } });
  const [tablaProcesos, setTablaProcesos] = useState([]);
  const [defectosCalidad, setDefectosCalidad] = useState([]);
  const [defectosCondicion, setDefectosCondicion] = useState([]);

  const brixData = [
    { rango: '<14', Light: 0, Dark: 0 }, { rango: '14-16', Light: 0, Dark: 0 },
    { rango: '16-18', Light: 0, Dark: 100 }, { rango: '>18', Light: 0, Dark: 0 },
  ];
  
  const chartData = [
    { time: '07:00', value: kpis.exportable || null }, { time: '10:00', value: null }, { time: '13:00', value: null },
    { time: '16:00', value: null }, { time: '19:00', value: null }, { time: '22:00', value: null }
  ];

  // Trigger para dibujar la dona suavemente
  useEffect(() => {
    setSvgMounted(true);
  }, []);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const API_URL = window.location.hostname.includes('goldanda.cl') 
          ? 'https://evap.maq.goldanda.cl' 
          : `http://${window.location.hostname || 'localhost'}:3001`;

        const res = await fetch(`${API_URL}/api/inspecciones`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setAllInspecciones(data);

          // Actualizamos la hora de la última sincronización
          const horaActual = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
          setUltimaSincronizacion(horaActual);

          const fechasUnicas = new Set();
          data.forEach(proceso => {
            const fechaBase = proceso.createdAt || proceso.fecha;
            if (fechaBase) {
              const d = new Date(fechaBase);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              fechasUnicas.add(`${dd}-${mm}-${d.getFullYear()}`);
            }
          });

          const arrFechas = Array.from(fechasUnicas);
          setFechasConProcesos(arrFechas);
          
          if (!arrFechas.includes(getHoyStr()) && arrFechas.length > 0) {
             setFechaSeleccionada(arrFechas[arrFechas.length - 1]);
          }
        }
      } catch (err) {
        console.error("Error al cargar inspecciones:", err);
      }
    };
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!allInspecciones.length) return;

    const procesosDelDia = allInspecciones.filter(proceso => {
      const fechaBase = proceso.createdAt || proceso.fecha;
      if (!fechaBase) return false;
      const d = new Date(fechaBase);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}-${mm}-${d.getFullYear()}` === fechaSeleccionada;
    });

    const totalProc = procesosDelDia.length;

    if (totalProc === 0) {
      setKpis({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
      setTablaProcesos([]);
      setDefectosCalidad([]);
      setDefectosCondicion([]);
      setNivelDesempeno({ optimo: { cant: 0, pct: 0 }, regular: { cant: 0, pct: 0 }, critico: { cant: 0, pct: 0 } });
      return;
    }

    let sumaExportable = 0, sumaCalidad = 0, sumaCondicion = 0;
    let conteoA1 = 0, conteoA2 = 0, conteoA3 = 0;
    let optimo = 0, regular = 0, critico = 0;
    
    const notasMap = {};
    const tablaFormateada = [];
    const acumuladorCalidad = {};
    const acumuladorCondicion = {};

    procesosDelDia.forEach((p, index) => {
      let totalFrutos = 0, defCal = 0, defCond = 0;
      
      if (p.cajas && p.cajas.length > 0) {
        p.cajas.forEach(c => {
          totalFrutos += (parseInt(c.frutos) || 0);
          
          Object.entries(c.defCalidad || {}).forEach(([nombre, cant]) => {
            if (nombre !== 'Bajo calibre' && nombre !== 'Sobre calibre') defCal += cant;
            acumuladorCalidad[nombre] = (acumuladorCalidad[nombre] || 0) + cant;
          });
          
          Object.entries(c.defCondicion || {}).forEach(([nombre, cant]) => {
            defCond += cant;
            acumuladorCondicion[nombre] = (acumuladorCondicion[nombre] || 0) + cant;
          });
        });
      }

      let pExp = 100, pCal = 0, pCond = 0;
      if (totalFrutos > 0) {
        pCal = (defCal / totalFrutos) * 100;
        pCond = (defCond / totalFrutos) * 100;
        pExp = Math.max(0, 100 - pCal - pCond);
      }

      sumaExportable += pExp;
      sumaCalidad += pCal;
      sumaCondicion += pCond;

      if (pExp >= 87) { optimo++; }
      else if (pExp >= 80) { regular++; }
      else { critico++; }

      let notaStr = p.nota || p.estado || '';
      if (!notaStr || notaStr === '-' || notaStr === 'Aprobado' || notaStr === 'Objetado') {
        if (pExp >= 87) notaStr = 'A1';
        else if (pExp >= 80) notaStr = 'A2';
        else notaStr = 'A3';
      }

      if (notaStr.includes('1') || notaStr === 'A1') { conteoA1++; notaStr = 'A1'; }
      else if (notaStr.includes('2') || notaStr === 'A2') { conteoA2++; notaStr = 'A2'; }
      else { conteoA3++; notaStr = 'A3'; }
      
      notasMap[notaStr] = (notasMap[notaStr] || 0) + 1;

      tablaFormateada.push({
        id: index + 1,
        numProceso: p.numProceso || '-',
        huerto: p.huerto || p.productor || '-',
        exportable: `${pExp.toFixed(1)}%`,
        nota: notaStr,
        estado: pExp >= 80 ? 'Aprobado' : 'Objetado'
      });
    });

    const avgExportable = sumaExportable / totalProc;
    const avgCalidad = sumaCalidad / totalProc;
    const avgCondicion = sumaCondicion / totalProc;

    let notaPredominante = '-';
    let max = 0;
    Object.entries(notasMap).forEach(([nota, cant]) => {
      if (cant > max) { max = cant; notaPredominante = nota; }
    });

    setKpis({
      procesos: totalProc,
      exportable: avgExportable,
      notaPredominante,
      calidad: avgCalidad,
      condicion: avgCondicion
    });

    setDistribucionNotas([
      { name: 'A1', value: conteoA1 || 0.0001, displayValue: (conteoA1/totalProc)*100, color: '#10b981' }, 
      { name: 'A2', value: conteoA2 || 0.0001, displayValue: (conteoA2/totalProc)*100, color: '#eab308' },
      { name: 'A3', value: conteoA3 || 0.0001, displayValue: (conteoA3/totalProc)*100, color: '#f43f5e' },
    ]);

    setNivelDesempeno({
      optimo: { cant: optimo, pct: (optimo/totalProc)*100 },
      regular: { cant: regular, pct: (regular/totalProc)*100 },
      critico: { cant: critico, pct: (critico/totalProc)*100 }
    });

    setTablaProcesos(tablaFormateada);

    const formatDefectos = (obj) => {
      let totalFrutosDia = 0;
      procesosDelDia.forEach(p => p.cajas?.forEach(c => totalFrutosDia += (parseInt(c.frutos) || 0)));
      if (totalFrutosDia === 0) return [];

      return Object.entries(obj)
        .map(([nombre, cant]) => ({ nombre, pct: (cant / totalFrutosDia) * 100 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
    };

    setDefectosCalidad(formatDefectos(acumuladorCalidad));
    setDefectosCondicion(formatDefectos(acumuladorCondicion));

  }, [fechaSeleccionada, allInspecciones]);

  const getMarkerPosition = (val) => {
    if (val <= 80) return (val / 80) * 33.33;
    if (val <= 87) return 33.33 + ((val - 80) / 7) * 33.33;
    return 66.66 + ((Math.min(val, 100) - 87) / 13) * 33.33; 
  };

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

        /* ================== DONUT CHART SVG ANIMATIONS ================== */
        .donut-arc, .donut-gap {
          transition: stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.25s ease;
        }
        .donut-container:hover .donut-arc {
          stroke-width: 12.5px;
        }
        .donut-container:hover .donut-gap {
          stroke-width: 15.5px;
        }
      `}</style>

      {/* ⚠️ AVISO DE ROTACIÓN PARA MÓVILES */}
      <div className="md:hidden portrait:flex hidden fixed inset-0 z-[100] bg-[#0f172a] flex-col items-center justify-center text-center p-6 text-white animate-fade-in">
         <svg className="w-16 h-16 mb-4 animate-pulse text-[#d97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
         </svg>
         <h2 className="text-xl font-black mb-2">Gira tu teléfono</h2>
         <p className="text-[#64748b] text-sm">Para visualizar este panel correctamente, por favor coloca tu dispositivo en posición horizontal.</p>
         <button onClick={onClose} className="mt-8 px-6 py-2 bg-[#1e293b] hover:bg-[#334155] transition-colors rounded-full text-sm font-bold border border-[#475569]">Volver al menú</button>
      </div>

      {/* ENCABEZADO TIPO APP */}
      <div className="flex items-center justify-between bg-[#ffffff] border-b border-[#f1f5f9] px-4 py-3 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onAbrirMenu} className="p-2 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse-dot"></div>
             <h1 className="text-[15px] font-black text-[#0f172a] tracking-tight uppercase">Resumen Diario</h1>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-[#64748b] hover:bg-[#ffe4e6] hover:text-[#e11d48] rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CONTENEDOR CON SCROLL */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative z-10">
        <div className="min-w-[1280px] p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">

          {/* HEADER INTERNO CON TÍTULO MODIFICADO Y HORA DE SINCRONIZACIÓN */}
          <div className="flex justify-between items-center relative z-40">
            <div>
              <h2 className="text-[28px] md:text-[32px] font-black text-[#0f172a] tracking-tight uppercase">Dashboard Resumen Diario</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[14px] md:text-[15px] text-[#64748b] font-medium">Planta Maquehua</p>
                <span className="text-[#94a3b8] text-sm">•</span>
                <p className="text-[13px] text-[#64748b] flex items-center gap-1.5 bg-[#f1f5f9] px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                  <RefreshCw className="w-3.5 h-3.5 text-[#94a3b8]" />
                  Última sincronización: <span className="font-bold text-[#0f172a]">{ultimaSincronizacion || 'Cargando...'}</span>
                </p>
              </div>
            </div>
            
            <div className="relative mt-2 md:mt-0">
              <button 
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center bg-[#ffffff] border border-[#f1f5f9] rounded-xl p-2.5 shadow-sm gap-3 cursor-pointer hover:border-[#e2e8f0] transition-all hover:shadow-md"
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

          {/* ================= SECCIÓN 1: KPIs ================= */}
          <div className="grid grid-cols-5 gap-4 relative z-10 mt-2">
            
            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-5 flex flex-col items-center justify-center min-h-[120px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#64748b] text-left w-full uppercase tracking-wider absolute top-4 left-4">PROCESOS INSPECCIONADOS</p>
              <p className="text-[44px] font-black text-[#0f172a] leading-none mt-5">
                {procesosAnim.formatted}
              </p>
            </div>

            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-5 flex flex-col items-center justify-center min-h-[120px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#64748b] text-left w-full uppercase tracking-wider absolute top-4 left-4">NOTA PREDOMINANTE</p>
              <p className="text-[44px] font-black text-[#0f172a] leading-none mt-5 animate-fade-in">
                {kpis.notaPredominante}
              </p>
            </div>

            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-5 flex flex-col items-center justify-center min-h-[120px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#64748b] text-left w-full uppercase tracking-wider absolute top-4 left-4">DEFECTOS CALIDAD (PROMEDIO)</p>
              {/* Aplicado el color amarillo dorado más oscuro (#eab308) */}
              <p className="text-[44px] font-black text-[#eab308] leading-none mt-5">
                {calidadAnim.formatted}%
              </p>
            </div>

            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-4 py-5 flex flex-col items-center justify-center min-h-[120px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#64748b] text-left w-full uppercase tracking-wider absolute top-4 left-4">DEFECTOS CONDICIÓN (PROMEDIO)</p>
              <p className="text-[44px] font-black text-[#e11d48] leading-none mt-5">
                {condicionAnim.formatted}%
              </p>
            </div>

            <div className="kpi-card bg-[#ffffff] border border-[#f1f5f9] rounded-2xl px-5 py-5 flex flex-col justify-center min-h-[120px] relative shadow-sm">
              <p className="text-[11px] font-semibold text-[#64748b] text-left w-full uppercase tracking-wider absolute top-4 left-5">
                NIVEL EXPORTABLE GENERAL
              </p>
              
              <div className="w-full mt-6">
                <p className="text-[44px] font-black leading-none mb-3 text-[#0f172a] text-center">
                  {exportableAnim.formatted}%
                </p>

                <div className="relative w-full">
                  <div className="relative h-2.5 w-full rounded-full overflow-hidden flex">
                    <div className="bg-[#ef4444] flex-1"></div>
                    {/* Aplicado el color amarillo dorado (#eab308) en el segmento regular */}
                    <div className="bg-[#eab308] flex-1"></div>
                    <div className="bg-gradient-to-r from-[#34d399] to-[#10b981] flex-1"></div>
                  </div>
                  
                  {/* Puntero que se desliza fluidamente conectándose al Ticker */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#ffffff] border-[3px] border-[#0f172a] rounded-full shadow-sm transition-all duration-[50ms] ease-linear" 
                    style={{ left: `calc(${getMarkerPosition(exportableAnim.raw)}% - 8px)` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center mt-3 px-1">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Crítico</span></div>
                  {/* Aplicado el color amarillo dorado (#eab308) en la leyenda */}
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></div><span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Regular</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div><span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Óptimo</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 2: GRÁFICOS INTERMEDIOS ================= */}
          <div className="grid grid-cols-3 gap-5">
            
            {/* Distribución Nota (Dona SVG Dinámica con Efecto Degradado) */}
            <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-4 text-left uppercase tracking-wider">DISTRIBUCIÓN DE CALIFICACIONES</h3>
              
              <div className="flex-1 flex items-center justify-between w-full mt-2">
                
                <div className="w-1/2 h-[160px] flex items-center justify-center">
                  <div className="relative w-36 h-36 flex items-center justify-center donut-container cursor-pointer group">
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

                          const element = (
                            <g key={index}>
                              {/* Capa de borde blanco (Separador / Gap Cut) */}
                              <circle
                                cx="50" cy="50" r="38"
                                fill="transparent"
                                stroke="#ffffff"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`}
                                strokeDashoffset={currentDashOffset}
                                className="donut-gap"
                              />
                              {/* Relleno del segmento animado con degrade, SIN filtro de brillo exterior */}
                              <circle
                                cx="50" cy="50" r="38"
                                fill="transparent"
                                stroke={strokeGradient}
                                strokeWidth="11"
                                strokeLinecap="round"
                                strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`}
                                strokeDashoffset={currentDashOffset}
                                className="donut-arc"
                              />
                            </g>
                          );
                          currentOffset += sliceLength;
                          return element;
                        });
                      })()}
                    </svg>

                    {/* NÚCLEO CENTRAL CON EFECTO HOVER */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-300 group-hover:scale-110">
                      <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                        {kpis.notaPredominante !== '-' ? kpis.notaPredominante : 'N/A'}
                      </span>
                      <span className="text-2xl font-black text-[#0f172a] tracking-tight leading-none mt-0.5">
                        {donutAnim.formatted}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="w-1/2 flex flex-col gap-4 pl-6 border-l border-[#f1f5f9]">
                  {distribucionNotas.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[12px] font-normal text-[#64748b]">({item.name})</span>
                      </div>
                      <span className="text-[14px] font-bold text-[#0f172a]">{item.displayValue.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Nivel de desempeño */}
            <div className="bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col relative hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-6 text-left uppercase tracking-wider">NIVEL DE DESEMPEÑO DE PROCESOS</h3>
              <div className="flex-1 flex flex-col justify-center space-y-6 px-2">
                
                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div><span className="text-[12px] text-[#0f172a] font-bold">Óptimo (87% a 100%)</span></div>
                    <span className="text-[14px] text-[#0f172a] font-bold">{nivelDesempeno.optimo.cant} <span className="text-[12px] font-normal text-[#64748b]">({nivelDesempeno.optimo.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                     {/* Aplicado gradiente para nivel óptimo */}
                     <div className="bg-gradient-to-r from-[#34d399] to-[#10b981] h-full rounded-full defect-bar" style={{ width: `${nivelDesempeno.optimo.pct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                  </div>
                </div>

                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    {/* Aplicado el color amarillo dorado (#eab308) */}
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></div><span className="text-[12px] text-[#0f172a] font-bold">Regular (80% a 87%)</span></div>
                    <span className="text-[14px] text-[#0f172a] font-bold">{nivelDesempeno.regular.cant} <span className="text-[12px] font-normal text-[#64748b]">({nivelDesempeno.regular.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
                    {/* Aplicado gradiente amarillo dorado para nivel regular */}
                    <div className="bg-gradient-to-r from-[#facc15] to-[#eab308] h-full rounded-full defect-bar" style={{ width: `${nivelDesempeno.regular.pct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}></div>
                  </div>
                </div>

                <div className="relative defect-item">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[12px] text-[#0f172a] font-bold">Crítico (&lt; 80%)</span></div>
                    <span className="text-[14px] text-[#0f172a] font-bold">{nivelDesempeno.critico.cant} <span className="text-[12px] font-normal text-[#64748b]">({nivelDesempeno.critico.pct.toFixed(0)}%)</span></span>
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
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#3b82f6] rounded-sm"></div><span className="text-[11px] text-[#64748b] font-medium uppercase">Light</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#10b981] rounded-sm"></div><span className="text-[11px] text-[#64748b] font-medium uppercase">Dark</span></div>
              </div>

              <div className="flex-1 w-full min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brixData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLightBrix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={1}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={1}/></linearGradient>
                      <linearGradient id="gradDarkBrix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={1}/><stop offset="100%" stopColor="#10b981" stopOpacity={1}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="rango" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} dy={10} />
                    <YAxis ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Bar dataKey="Light" fill="url(#gradLightBrix)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} animationDuration={1000} />
                    <Bar dataKey="Dark" fill="url(#gradDarkBrix)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ================= SECCIÓN 3: TABLA Y GRÁFICO ================= */}
          <div className="grid grid-cols-12 gap-5">
            
            {/* Gráfico Evolución (Con Gradiente en la Línea) */}
            <div className="col-span-5 bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
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
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} dy={10}/>
                    <YAxis domain={[80, 100]} ticks={[80, 85, 90, 95, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} tickFormatter={(val) => `${val}%`}/>
                    <Tooltip formatter={(value) => [`${value}%`, 'Exportable']} labelStyle={{ color: '#475569', fontWeight: 'bold' }}/>
                    <Line type="monotone" dataKey="value" stroke="url(#gradLine)" strokeWidth={3} dot={{ r: 4, fill: '#ea580c', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#ea580c', strokeWidth: 2 }} animationDuration={1500} connectNulls/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABLA CON AUTO-SCROLL INFINITO Y HOVER ROW */}
            <div className="col-span-7 bg-[#ffffff] border border-[#f1f5f9] rounded-2xl p-6 shadow-sm flex flex-col min-w-0 hover:shadow-md transition-shadow">
              <h3 className="text-[14px] font-bold text-[#0f172a] mb-4 text-left uppercase tracking-wider shrink-0">DETALLE DE PROCESOS DEL DÍA</h3>
              
              <div className="border border-[#f1f5f9] rounded-xl overflow-hidden w-full h-[255px]">
                <div ref={scrollRef} className="overflow-y-auto overflow-x-auto auto-scroll-table w-full h-full relative group">
                  <table className="w-full text-[12px] text-left min-w-[500px]">
                    <thead className="bg-[#f8fafc] text-[#64748b] border-b border-[#f1f5f9] sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                      <tr>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">N° Proceso</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Huerto</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">% Exportable</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Nota</th>
                        <th className="py-3 px-4 font-bold uppercase text-[11px] tracking-wider whitespace-nowrap">Estado</th>
                      </tr>
                    </thead>
                    <tbody ref={tbodyRef} className="divide-y divide-[#f1f5f9]">
                      {tablaProcesos.map((row) => (
                        <tr key={row.id} className="bg-[#ffffff] table-row-hover">
                          <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap">{row.numProceso}</td>
                          <td className="py-3.5 px-4 text-[#334155] truncate max-w-[200px] font-normal">{row.huerto}</td>
                          <td className="py-3.5 px-4 font-black text-[#0f172a] whitespace-nowrap">{row.exportable}</td>
                          <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.nota === 'A1' ? 'bg-[#ecfdf5] text-[#059669]' : row.nota === 'A2' ? 'bg-[#fef3c7] text-[#eab308]' : 'bg-[#ffe4e6] text-[#e11d48]'}`}>{row.nota}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                             <span className={`flex items-center gap-1.5 text-xs font-semibold ${row.estado === 'Aprobado' ? 'text-[#047857]' : 'text-[#e11d48]'}`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}></div>
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
                            <td className="py-3.5 px-4 text-[#334155] truncate max-w-[200px] font-normal">{row.huerto}</td>
                            <td className="py-3.5 px-4 font-bold text-[#0f172a] whitespace-nowrap">{row.exportable}</td>
                            <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${row.nota === 'A1' ? 'bg-[#ecfdf5] text-[#059669]' : row.nota === 'A2' ? 'bg-[#fef3c7] text-[#eab308]' : 'bg-[#ffe4e6] text-[#e11d48]'}`}>{row.nota}</span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                               <span className={`flex items-center gap-1.5 text-xs font-semibold ${row.estado === 'Aprobado' ? 'text-[#047857]' : 'text-[#e11d48]'}`}>
                                 <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}></div>
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
              DESGLOSE CONSOLIDADO DE DEFECTOS <span className="text-[#64748b] text-[12px] font-normal capitalize tracking-normal ml-2">(% promedio del total inspeccionado)</span>
            </h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-8">
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
              <div className="border-l border-[#f1f5f9] pl-12">
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
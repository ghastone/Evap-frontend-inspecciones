import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';

// === HELPER: Obtener fecha de hoy en formato DD-MM-YYYY ===
const getHoyStr = () => {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${hoy.getFullYear()}`;
};

// === COMPONENTE: BARRA HORIZONTAL ===
const BarraDefecto = ({ nombre, pct, colorClass }) => (
  <div className="flex items-center py-1.5">
    <span className="w-1/3 text-[13px] font-bold text-slate-500 truncate pr-2" title={nombre}>{nombre}</span>
    <div className="flex-1 bg-slate-100 rounded-full h-[8px] overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(pct * 10, 100)}%` }}></div>
    </div>
    <span className="w-12 text-right text-[13px] font-black text-slate-700 ml-3">{pct.toFixed(1).replace('.', ',')}%</span>
  </div>
);

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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[300px] p-4 z-50">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5"/></button>
        <span className="text-[15px] font-bold text-slate-800 capitalize">{monthNames[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Do','Lu','Ma','Mi','Ju','Vi','Sa'].map(d => <span key={d} className="text-[11px] font-black text-slate-400">{d}</span>)}
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
              className={`w-8 h-8 mx-auto rounded-full text-[13px] flex items-center justify-center transition-all ${
                isSelected ? 'bg-[#E96008] text-white font-bold shadow-md' :
                hasProcess ? 'bg-orange-50 text-[#E96008] font-bold hover:bg-orange-100' :
                'text-slate-300 cursor-not-allowed hover:bg-slate-50'
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
    <text x={x + width / 2} y={y - 8} fill="#334155" textAnchor="middle" fontSize={11} fontWeight="black">
      {value}%
    </text>
  );
};

export default function DashboardResumenDiario({ onClose, onAbrirMenu }) {
  const [allInspecciones, setAllInspecciones] = useState([]);
  const [fechasConProcesos, setFechasConProcesos] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getHoyStr());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // REFERENCIAS PARA EL SCROLL INFINITO
  const scrollRef = useRef(null);
  const tbodyRef = useRef(null); 

  const [kpis, setKpis] = useState({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
  const [distribucionNotas, setDistribucionNotas] = useState([
    { name: '(A1)', value: 0.0001, displayValue: 0, color: '#16A34A' }, 
    { name: '(A2)', value: 0.0001, displayValue: 0, color: '#EAB308' },
    { name: '(A3)', value: 0.0001, displayValue: 0, color: '#DC2626' },
  ]);
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
      { name: '(A1)', value: conteoA1 || 0.0001, displayValue: (conteoA1/totalProc)*100, color: '#16A34A' }, 
      { name: '(A2)', value: conteoA2 || 0.0001, displayValue: (conteoA2/totalProc)*100, color: '#EAB308' },
      { name: '(A3)', value: conteoA3 || 0.0001, displayValue: (conteoA3/totalProc)*100, color: '#DC2626' },
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

    // Removemos estilos de scroll suave nativo para permitir el salto cuántico invisible
    el.style.scrollBehavior = 'auto';

    const step = () => {
      if (!isPaused) {
        // Sincronizar si el usuario scrolleó manualmente mientras estaba pausado
        if (Math.abs(el.scrollTop - scrollAmount) > 2) {
          scrollAmount = el.scrollTop;
        }

        scrollAmount += 0.5; // Velocidad de bajada constante
        const targetHeight = tbody.offsetHeight;

        // Salto cuántico invisible: cuando pasamos exacto la altura de la tabla original, 
        // restamos esa misma altura a la variable. Como está clonada, el ojo humano no nota el corte.
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

    // Eventos para pausar el scroll automático cuando el usuario interactúa
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
    <div className="w-full h-full flex flex-col bg-[#F8FAFC]">
      
      {/* 🎨 ESTILOS INYECTADOS PARA LA BARRA DE SCROLL DINÁMICA */}
      <style>{`
        .auto-scroll-table::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .auto-scroll-table::-webkit-scrollbar-track {
          background: transparent;
        }
        .auto-scroll-table::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.15); /* Muy transparente cuando se mueve solo */
          border-radius: 10px;
          transition: background-color 0.3s ease;
        }
        /* Cuando el usuario pone el ratón o toca la tabla, se oscurece la barra */
        .auto-scroll-table:hover::-webkit-scrollbar-thumb,
        .auto-scroll-table:active::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.8); 
        }
      `}</style>

      {/* ⚠️ AVISO DE ROTACIÓN PARA MÓVILES EN VERTICAL */}
      <div className="md:hidden portrait:flex hidden fixed inset-0 z-[100] bg-slate-900 flex-col items-center justify-center text-center p-6 text-white animate-fade-in">
         <svg className="w-16 h-16 mb-4 animate-pulse text-[#E96008]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
         </svg>
         <h2 className="text-xl font-black mb-2">Gira tu teléfono</h2>
         <p className="text-slate-400 text-sm">Para visualizar este panel correctamente, por favor coloca tu dispositivo en posición horizontal (apaisado).</p>
         <button onClick={onClose} className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-full text-sm font-bold border border-slate-700">Volver al menú</button>
      </div>

      {/* ENCABEZADO TIPO APP */}
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onAbrirMenu} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#E96008] animate-pulse"></div>
             <h1 className="text-[15px] font-black text-slate-800 tracking-tight">Resumen Diario</h1>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* CONTENEDOR CON SCROLL Y ANCHO MÍNIMO PARA FORZAR VISTA HORIZONTAL PERFECTA */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative z-10">
        <div className="min-w-[1280px] p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">

          {/* HEADER INTERNO */}
          <div className="flex justify-between items-center relative z-40">
            <div>
              <h2 className="text-[28px] md:text-[32px] font-black text-slate-900 tracking-tight">Resumen diario</h2>
              <p className="text-[14px] md:text-[15px] text-slate-500 font-medium">Planta Maquehua</p>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="flex items-center bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm gap-3 cursor-pointer hover:border-[#E96008] transition-all"
              >
                <div className="flex items-center gap-2 pl-2">
                  <Calendar className="w-4 h-4 text-[#E96008]" />
                  <span className="text-[13px] text-slate-500 font-bold uppercase tracking-wide">Fecha:</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">
                  <span className="text-[15px] text-slate-800 font-black">{fechaSeleccionada}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 ml-2 transition-transform ${calendarOpen ? 'rotate-180' : ''}`} />
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
          <div className="grid grid-cols-5 gap-4 relative z-10">
            
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-5 shadow-sm flex flex-col items-center justify-center min-h-[120px] relative hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black text-slate-800 text-left w-full uppercase tracking-wider absolute top-4 left-4">PROCESOS INSPECCIONADOS</p>
              <p className="text-[32px] md:text-[34px] font-black text-slate-900 leading-none mt-5">{kpis.procesos}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-5 shadow-sm flex flex-col items-center justify-center min-h-[120px] relative hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black text-slate-800 text-left w-full uppercase tracking-wider absolute top-4 left-4">NOTA PREDOMINANTE</p>
              <p className="text-[32px] md:text-[34px] font-black text-slate-900 leading-none mt-5">{kpis.notaPredominante}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-5 shadow-sm flex flex-col items-center justify-center min-h-[120px] relative hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black text-slate-800 text-left w-full uppercase tracking-wider absolute top-4 left-4">DEFECTOS CALIDAD (PROMEDIO)</p>
              <p className="text-[32px] md:text-[34px] font-black text-[#EA580C] leading-none mt-5">{kpis.calidad.toFixed(1).replace('.', ',')}%</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-5 shadow-sm flex flex-col items-center justify-center min-h-[120px] relative hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black text-slate-800 text-left w-full uppercase tracking-wider absolute top-4 left-4">DEFECTOS CONDICIÓN (PROMEDIO)</p>
              <p className="text-[32px] md:text-[34px] font-black text-[#DC2626] leading-none mt-5">{kpis.condicion.toFixed(1).replace('.', ',')}%</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-5 shadow-sm flex flex-col justify-center min-h-[120px] relative hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black text-slate-800 text-left w-full uppercase tracking-wider absolute top-4 left-5">
                NIVEL EXPORTABLE GENERAL
              </p>
              
              <div className="w-full mt-6">
                <p className="text-[32px] md:text-[34px] font-black leading-none mb-3 text-slate-900 text-center">
                  {kpis.exportable.toFixed(1).replace('.', ',')}%
                </p>

                <div className="relative w-full">
                  <div className="relative h-2.5 w-full rounded-full overflow-hidden flex">
                    <div className="bg-gradient-to-r from-red-500 to-red-600 flex-1"></div>
                    <div className="bg-gradient-to-r from-amber-400 to-amber-500 flex-1"></div>
                    <div className="bg-gradient-to-r from-emerald-400 to-green-500 flex-1"></div>
                  </div>
                  
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-slate-700 rounded-full shadow-sm transition-all duration-1000 ease-out" 
                    style={{ left: `calc(${getMarkerPosition(kpis.exportable)}% - 8px)` }}
                  ></div>
                </div>

                <div className="relative w-full h-4 mt-1">
                  <span className="absolute text-[10px] font-black text-slate-700 -translate-x-1/2" style={{ left: '33.33%' }}>80%</span>
                  <span className="absolute text-[10px] font-black text-slate-700 -translate-x-1/2" style={{ left: '66.66%' }}>87%</span>
                </div>

                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></div><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Crítico</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#EAB308]"></div><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Regular</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></div><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Óptimo</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 2: GRÁFICOS INTERMEDIOS ================= */}
          <div className="grid grid-cols-3 gap-5">
            
            {/* Distribución Nota */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="text-[14px] font-black text-slate-800 mb-4 text-left uppercase tracking-wide">DISTRIBUCIÓN DE CALIFICACIONES</h3>
              
              <div className="flex-1 flex items-center justify-between w-full mt-2">
                <div className="w-1/2 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="gradA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity={1}/><stop offset="100%" stopColor="#16A34A" stopOpacity={1}/></linearGradient>
                        <linearGradient id="gradA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCD34D" stopOpacity={1}/><stop offset="100%" stopColor="#D97706" stopOpacity={1}/></linearGradient>
                        <linearGradient id="gradA3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171" stopOpacity={1}/><stop offset="100%" stopColor="#DC2626" stopOpacity={1}/></linearGradient>
                      </defs>
                      <Pie data={distribucionNotas} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {distribucionNotas.map((entry, index) => {
                          const gradId = entry.name.includes('A1') ? 'url(#gradA1)' : entry.name.includes('A2') ? 'url(#gradA2)' : 'url(#gradA3)';
                          return <Cell key={`cell-${index}`} fill={gradId} />;
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="w-1/2 flex flex-col gap-4 pl-6 border-l border-slate-100">
                  {distribucionNotas.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-[15px] font-bold text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-[16px] font-black text-slate-800">{item.displayValue.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Nivel de desempeño */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col relative">
              <h3 className="text-[14px] font-black text-slate-800 mb-6 text-left uppercase tracking-wide">NIVEL DE DESEMPEÑO DE PROCESOS</h3>
              <div className="flex-1 flex flex-col justify-center space-y-6 px-2">
                
                <div className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></div><span className="text-[14px] text-slate-800 font-bold">Óptimo (87% a 100%)</span></div>
                    <span className="text-[14px] text-slate-800 font-black">{nivelDesempeno.optimo.cant} <span className="text-[12px] font-medium text-slate-500">({nivelDesempeno.optimo.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                     <div className="bg-gradient-to-r from-emerald-400 to-green-500 h-full rounded-full" style={{ width: `${nivelDesempeno.optimo.pct}%` }}></div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#EAB308]"></div><span className="text-[14px] text-slate-800 font-bold">Regular (80% a 87%)</span></div>
                    <span className="text-[14px] text-slate-800 font-black">{nivelDesempeno.regular.cant} <span className="text-[12px] font-medium text-slate-500">({nivelDesempeno.regular.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-300 to-amber-500 h-full rounded-full" style={{ width: `${nivelDesempeno.regular.pct}%` }}></div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></div><span className="text-[14px] text-slate-800 font-bold">Crítico (&lt; 80%)</span></div>
                    <span className="text-[14px] text-slate-800 font-black">{nivelDesempeno.critico.cant} <span className="text-[12px] font-medium text-slate-500">({nivelDesempeno.critico.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                     <div className="bg-gradient-to-r from-red-400 to-red-600 h-full rounded-full" style={{ width: `${nivelDesempeno.critico.pct}%` }}></div>
                  </div>
                </div>

              </div>
            </div>

            {/* Distribución Brix */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="text-[14px] font-black text-slate-800 mb-2 text-left uppercase tracking-wide">DISTRIBUCIÓN DE SÓLIDOS SOLUBLES</h3>
              
              <div className="flex justify-center gap-6 mb-2 mt-1">
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-sm"></div><span className="text-[11px] text-slate-500 font-bold uppercase">Light</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#16A34A] rounded-sm"></div><span className="text-[11px] text-slate-500 font-bold uppercase">Dark</span></div>
              </div>

              <div className="flex-1 w-full min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brixData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60A5FA" stopOpacity={1}/><stop offset="100%" stopColor="#2563EB" stopOpacity={1}/></linearGradient>
                      <linearGradient id="gradDarkBrix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity={1}/><stop offset="100%" stopColor="#16A34A" stopOpacity={1}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="rango" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} dy={10} />
                    <YAxis ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Bar dataKey="Light" fill="url(#gradLight)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} />
                    <Bar dataKey="Dark" fill="url(#gradDarkBrix)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ================= SECCIÓN 3: TABLA Y GRÁFICO ================= */}
          <div className="grid grid-cols-12 gap-5">
            
            {/* Gráfico Evolución */}
            <div className="col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="text-[14px] font-black text-slate-800 mb-6 text-left uppercase tracking-wide">EVOLUCIÓN DEL PORCENTAJE EXPORTABLE</h3>
              <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} dy={10}/>
                    <YAxis domain={[80, 100]} ticks={[80, 85, 90, 95, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickFormatter={(val) => `${val}%`}/>
                    <Tooltip formatter={(value) => [`${value}%`, 'Exportable']} labelStyle={{ color: '#475569', fontWeight: 'bold' }}/>
                    <Line type="monotone" dataKey="value" stroke="#E96008" strokeWidth={3} dot={{ r: 4, fill: '#E96008', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} connectNulls/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABLA CON AUTO-SCROLL INFINITO (BUCLE PERFECTO) Y TRANSPARENCIAS DINÁMICAS */}
            <div className="col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
              <h3 className="text-[14px] font-black text-slate-800 mb-4 text-left uppercase tracking-wide shrink-0">DETALLE DE PROCESOS DEL DÍA</h3>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden w-full h-[255px]">
                <div ref={scrollRef} className="overflow-y-auto overflow-x-auto auto-scroll-table w-full h-full relative group">
                  <table className="w-full text-sm text-left min-w-[500px]">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="py-3 px-4 font-black uppercase text-[11px] tracking-wider whitespace-nowrap">N° Proceso</th>
                        <th className="py-3 px-4 font-black uppercase text-[11px] tracking-wider whitespace-nowrap">Huerto</th>
                        <th className="py-3 px-4 font-black uppercase text-[11px] tracking-wider whitespace-nowrap">% Exportable</th>
                        <th className="py-3 px-4 font-black uppercase text-[11px] tracking-wider whitespace-nowrap">Nota</th>
                        <th className="py-3 px-4 font-black uppercase text-[11px] tracking-wider whitespace-nowrap">Estado</th>
                      </tr>
                    </thead>
                    <tbody ref={tbodyRef} className="divide-y divide-slate-100">
                      {tablaProcesos.map((row) => (
                        <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">{row.numProceso}</td>
                          <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px] font-medium">{row.huerto}</td>
                          <td className="py-3.5 px-4 font-black text-slate-700 whitespace-nowrap">{row.exportable}</td>
                          <td className="py-3.5 px-4 text-slate-600 font-bold whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs ${row.nota === 'A1' ? 'bg-green-100 text-green-700' : row.nota === 'A2' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{row.nota}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                             <span className={`flex items-center gap-1.5 text-xs font-bold ${row.estado === 'Aprobado' ? 'text-green-600' : 'text-red-600'}`}>
                               <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                               {row.estado}
                             </span>
                          </td>
                        </tr>
                      ))}
                      {tablaProcesos.length === 0 && (
                        <tr className="bg-white">
                          <td colSpan="5" className="py-8 text-center font-bold text-slate-400">No hay procesos registrados para esta fecha.</td>
                        </tr>
                      )}
                    </tbody>

                    {/* Clonación perfecta de la tabla para lograr el bucle infinito */}
                    {tablaProcesos.length > 4 && (
                      <tbody className="divide-y divide-slate-100">
                        {tablaProcesos.map((row) => (
                          <tr key={`clone-${row.id}`} className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">{row.numProceso}</td>
                            <td className="py-3.5 px-4 text-slate-600 truncate max-w-[200px] font-medium">{row.huerto}</td>
                            <td className="py-3.5 px-4 font-black text-slate-700 whitespace-nowrap">{row.exportable}</td>
                            <td className="py-3.5 px-4 text-slate-600 font-bold whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs ${row.nota === 'A1' ? 'bg-green-100 text-green-700' : row.nota === 'A2' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{row.nota}</span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                               <span className={`flex items-center gap-1.5 text-xs font-bold ${row.estado === 'Aprobado' ? 'text-green-600' : 'text-red-600'}`}>
                                 <div className={`w-1.5 h-1.5 rounded-full ${row.estado === 'Aprobado' ? 'bg-green-600' : 'bg-red-600'}`}></div>
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[14px] font-black text-slate-800 mb-6 text-left uppercase tracking-wide">
              DESGLOSE CONSOLIDADO DE DEFECTOS <span className="text-slate-400 text-[12px] font-bold capitalize tracking-normal ml-2">(% promedio del total inspeccionado)</span>
            </h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-8">
              <div>
                <h4 className="text-[13px] font-black text-[#EA580C] mb-4 uppercase tracking-wider">
                  DEFECTOS DE CALIDAD
                </h4>
                <div className="space-y-1">
                  {defectosCalidad.length > 0 ? defectosCalidad.map((defecto, index) => (
                    <BarraDefecto key={index} nombre={defecto.nombre} pct={defecto.pct} colorClass="bg-gradient-to-r from-orange-400 to-orange-500" />
                  )) : <p className="text-sm font-bold text-slate-300 py-4 text-center">Sin defectos registrados</p>}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-12">
                <h4 className="text-[13px] font-black text-[#DC2626] mb-4 uppercase tracking-wider">
                   DEFECTOS DE CONDICIÓN
                </h4>
                <div className="space-y-1">
                  {defectosCondicion.length > 0 ? defectosCondicion.map((defecto, index) => (
                    <BarraDefecto key={index} nombre={defecto.nombre} pct={defecto.pct} colorClass="bg-gradient-to-r from-red-500 to-red-600" />
                  )) : <p className="text-sm font-bold text-slate-300 py-4 text-center">Sin defectos registrados</p>}
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
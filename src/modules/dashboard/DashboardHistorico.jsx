import React, { useState, useEffect, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { Menu, X, BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// === ESTILOS INYECTADOS (SLIDER Y FUENTE INTER) ===
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .dual-range-input {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
  }
  .dual-range-input::-webkit-slider-thumb {
    height: 18px;
    width: 18px;
    border-radius: 50%;
    background: white;
    border: 3px solid #f87171;
    pointer-events: auto;
    -webkit-appearance: none;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    transition: transform 0.1s;
  }
  .dual-range-input::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
  
  /* ESTILOS DEL SCROLL DINÁMICO */
  .auto-scroll-list::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .auto-scroll-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .auto-scroll-list::-webkit-scrollbar-thumb {
    background-color: rgba(148, 163, 184, 0.15); 
    border-radius: 10px;
    transition: background-color 0.3s ease;
  }
  .auto-scroll-list:hover::-webkit-scrollbar-thumb,
  .auto-scroll-list:active::-webkit-scrollbar-thumb {
    background-color: rgba(148, 163, 184, 0.8); 
  }
`;

// === HELPER: Obtener fecha de hoy ===
const getHoyStr = () => {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${hoy.getFullYear()}`;
};

// === HELPERS DE FECHAS Y SEMANAS ===
const getISOWeek = (dateString) => {
  const date = new Date(dateString + 'T00:00:00');
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getLocalYYYYMMDD = (fechaVal) => {
  if (!fechaVal) return '';
  if (typeof fechaVal === 'string') {
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(fechaVal)) {
      const parts = fechaVal.split(/[-/]/);
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(fechaVal)) {
      return fechaVal.substring(0, 10);
    }
  }
  try {
    const d = new Date(fechaVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch { return ''; }
};

// === COMPONENTES DE PUNTOS ACTIVOS PERSONALIZADOS (HOVER) ===
const CustomActiveDotA1 = (props) => {
  const { cx, cy, value } = props;
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#16A34A" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 12} fill="#16A34A" fontSize={11} fontWeight="900" textAnchor="middle">{value.toFixed(1)}%</text>
    </g>
  );
};

const CustomActiveDotA2 = (props) => {
  const { cx, cy, value } = props;
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#EAB308" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 12} fill="#EAB308" fontSize={11} fontWeight="900" textAnchor="middle">{value.toFixed(1)}%</text>
    </g>
  );
};

const CustomActiveDotA3 = (props) => {
  const { cx, cy, value } = props;
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#DC2626" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy + 18} fill="#DC2626" fontSize={11} fontWeight="900" textAnchor="middle">{value.toFixed(1)}%</text>
    </g>
  );
};

// === COMPONENTE: SELECTOR DE FECHAS CUSTOM COMPACTO ===
const CustomDatePicker = ({ dateStr, minDateStr, maxDateStr, onChange, diasConProcesos, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const wrapperRef = useRef(null);

  useEffect(() => { if (dateStr) setViewDate(new Date(dateStr + 'T12:00:00')); }, [dateStr]);

  useEffect(() => {
    function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-');
    return `${d}-${m}-${y}`;
  };

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <div onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center border ${isOpen ? 'border-[#EA580C] ring-1 ring-orange-100' : 'border-slate-200 hover:border-orange-300'} rounded-lg px-2.5 py-1.5 bg-white shadow-sm transition-all cursor-pointer`}
      >
        <Calendar className={`w-3.5 h-3.5 shrink-0 mr-1.5 ${isOpen ? 'text-[#EA580C]' : 'text-slate-400'}`} />
        <span className="w-full text-[11px] font-black text-slate-700 tracking-wide select-none">{formatDisplayDate(dateStr)}</span>
      </div>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'} bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-[240px] z-[100] animate-fade-in`}>
          <div className="flex justify-between items-center mb-4">
            <button onClick={(e) => { e.stopPropagation(); setViewDate(new Date(year, month - 1, 1)); }} className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-[13px] font-black text-slate-800 tracking-tight">{monthNames[month]} {year}</span>
            <button onClick={(e) => { e.stopPropagation(); setViewDate(new Date(year, month + 1, 1)); }} className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg"><ChevronRight className="w-4 h-4"/></button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map(d => <div key={d} className="text-[10px] font-black text-slate-400">{d}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-y-1 gap-x-1">
            {Array.from({length: firstDayIndex}).map((_, i) => <div key={`empty-${i}`} />)}
            {daysArray.map(d => {
              const currentDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const isSelected = currentDateStr === dateStr;
              const hasData = diasConProcesos.includes(currentDateStr);
              const isOutOfRange = (minDateStr && currentDateStr < minDateStr) || (maxDateStr && currentDateStr > maxDateStr);

              let btnClass = "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all mx-auto ";
              if (isSelected) btnClass += "bg-[#EA580C] text-white shadow-sm transform scale-110";
              else if (isOutOfRange) btnClass += "text-slate-300 opacity-50 cursor-not-allowed";
              else if (hasData) btnClass += "bg-orange-50 text-[#EA580C] hover:bg-orange-100 hover:scale-110";
              else btnClass += "text-slate-600 hover:bg-slate-100 hover:scale-110";

              return (
                <button key={d} disabled={isOutOfRange} onClick={() => { onChange(currentDateStr); setIsOpen(false); }} className={btnClass}>{d}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// === COMPONENTE: TARJETA GAUGE ===
const GaugeCard = ({ title, value, objText, colors, thresholds, labels, invertedLogic = false }) => {
  const colorGradients = {
    '#ef4444': { start: '#ef4444', end: '#dc2626' }, 
    '#f59e0b': { start: '#f59e0b', end: '#d97706' }, 
    '#10b981': { start: '#10b981', end: '#059669' }  
  };

  const gradId1 = `grad-${title.replace(/\s+/g, '')}-1`;
  const gradId2 = `grad-${title.replace(/\s+/g, '')}-2`;
  const gradId3 = `grad-${title.replace(/\s+/g, '')}-3`;

  let statusColor = '#10b981'; let statusShadow = 'rgba(16, 185, 129, 0.5)';
  if (invertedLogic) {
    if (value <= thresholds[0]) { statusColor = '#10b981'; statusShadow = 'rgba(16,185,129,0.5)'; }
    else if (value <= thresholds[1]) { statusColor = '#f59e0b'; statusShadow = 'rgba(245,158,11,0.5)'; }
    else { statusColor = '#ef4444'; statusShadow = 'rgba(239,68,68,0.5)'; }
  } else {
    if (value >= thresholds[1]) { statusColor = '#10b981'; statusShadow = 'rgba(16,185,129,0.5)'; }
    else if (value >= thresholds[0]) { statusColor = '#f59e0b'; statusShadow = 'rgba(245,158,11,0.5)'; }
    else { statusColor = '#ef4444'; statusShadow = 'rgba(239,68,68,0.5)'; }
  }

  const getVisualPercentage = (val, t1, t2) => {
    if (val <= t1) return (val / t1) * 33.33;
    if (val <= t2) return 33.33 + ((val - t1) / (t2 - t1)) * 33.33;
    return 66.66 + ((val - t2) / (100 - t2)) * 33.33;
  };

  const vp = Math.min(Math.max(getVisualPercentage(value, thresholds[0], thresholds[1]), 0), 100);
  const angleRad = (180 - vp * 1.8) * (Math.PI / 180);
  const markerX = 110 + 75 * Math.cos(angleRad);
  const markerY = 100 - 75 * Math.sin(angleRad);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden h-full">
      <div className="bg-[#E96008] text-white flex items-center px-4 py-2 font-black text-[12px] uppercase tracking-wider">
        <div className="w-3 h-3 rounded-full animate-pulse mr-2.5" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusShadow}` }}></div>
        <span>{title}</span>
      </div>
      <div className="p-4 flex flex-col items-center justify-center relative bg-white flex-1">
        <svg width="220" height="110" viewBox="0 0 220 110" className="overflow-visible mt-1">
           <defs>
             <linearGradient id={gradId1} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={colorGradients[colors[0]].start} /><stop offset="100%" stopColor={colorGradients[colors[0]].end} /></linearGradient>
             <linearGradient id={gradId2} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={colorGradients[colors[1]].start} /><stop offset="100%" stopColor={colorGradients[colors[1]].end} /></linearGradient>
             <linearGradient id={gradId3} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={colorGradients[colors[2]].start} /><stop offset="100%" stopColor={colorGradients[colors[2]].end} /></linearGradient>
           </defs>
           <circle cx="35" cy="100" r="10" fill={colorGradients[colors[0]].start} />
           <path d="M 35 100 A 75 75 0 0 1 70.81 36.05" fill="none" stroke={`url(#${gradId1})`} strokeWidth="20" strokeLinecap="butt" />
           <path d="M 73.06 34.7 A 75 75 0 0 1 146.94 34.7" fill="none" stroke={`url(#${gradId2})`} strokeWidth="20" strokeLinecap="butt" />
           <path d="M 149.19 36.05 A 75 75 0 0 1 185 100" fill="none" stroke={`url(#${gradId3})`} strokeWidth="20" strokeLinecap="butt" />
           <circle cx="185" cy="100" r="10" fill={colorGradients[colors[2]].end} />
           
           <text x="65" y="26" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="end">{labels[0]}</text>
           <text x="155" y="26" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="start">{labels[1]}</text>
           <text x="110" y="94" fill="#1e293b" fontSize="24" fontWeight="900" textAnchor="middle" letterSpacing="-0.5">{value.toFixed(1)}%</text>
           <circle cx={markerX} cy={markerY} r="6" fill="white" stroke="#1e293b" strokeWidth="2" style={{ transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </svg>
        <p className="text-[12px] font-bold text-slate-500 mt-2">{objText}</p>
      </div>
    </div>
  );
};

const BarraDefecto = ({ nombre, pct, colorClass }) => (
  <div className="flex items-center py-1.5">
    <span className="w-1/3 text-[13px] font-bold text-slate-500 truncate pr-2" title={nombre}>{nombre}</span>
    <div className="flex-1 bg-slate-100 rounded-full h-[8px] overflow-hidden"><div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(pct * 10, 100)}%` }}></div></div>
    <span className="w-12 text-right text-[13px] font-black text-slate-700 ml-3">{pct.toFixed(1).replace('.', ',')}%</span>
  </div>
);

export default function DashboardHistoricoTemporada({ onClose, onAbrirMenu }) {
  const [allInspecciones, setAllInspecciones] = useState([]);
  
  // Slider y Semanas
  const [fechasDisponibles, setFechasDisponibles] = useState([]);
  const [diasConProcesos, setDiasConProcesos] = useState([]);
  const [rangoIndices, setRangoIndices] = useState([0, 0]);
  const [semanasVisibles, setSemanasVisibles] = useState([]);

  // KPIs
  const [kpis, setKpis] = useState({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
  const [distribucionNotas, setDistribucionNotas] = useState([
    { name: 'A1', value: 0.0001, displayValue: 0, color: '#16A34A' }, 
    { name: 'A2', value: 0.0001, displayValue: 0, color: '#EAB308' }, 
    { name: 'A3', value: 0.0001, displayValue: 0, color: '#DC2626' }
  ]);
  const [evolucionNotas, setEvolucionNotas] = useState([]); 
  const [defectosCalidad, setDefectosCalidad] = useState([]);
  const [defectosCondicion, setDefectosCondicion] = useState([]);
  const [pctA1, setPctA1] = useState(0);
  const [pctA1A2, setPctA1A2] = useState(0);
  const [pctObjetados, setPctObjetados] = useState(0);

  // Ranking Huertos & Refs Auto-Scroll
  const [rankingHuertos, setRankingHuertos] = useState([]);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const API_URL = window.location.hostname.includes('goldanda.cl') 
          ? 'https://evap.maq.goldanda.cl' : `http://${window.location.hostname || 'localhost'}:3001`;
        const res = await fetch(`${API_URL}/api/inspecciones`);
        const data = await res.json();
        
        if (Array.isArray(data) && data.length > 0) {
          setAllInspecciones(data);
          
          const processDates = data.map(p => getLocalYYYYMMDD(p.createdAt || p.fecha)).filter(Boolean);
          setDiasConProcesos([...new Set(processDates)]);
          
          const hoyStrLocal = getLocalYYYYMMDD(getHoyStr());
          processDates.push(hoyStrLocal); 

          const uniqueDates = [...new Set(processDates)].sort();

          if (uniqueDates.length > 0) {
            const [minY, minM, minD] = uniqueDates[0].split('-');
            let curr = new Date(minY, minM - 1, minD, 12, 0, 0);
            
            const [maxY, maxM, maxD] = uniqueDates[uniqueDates.length - 1].split('-');
            const end = new Date(maxY, maxM - 1, maxD, 12, 0, 0);
            
            const continuousDates = [];
            while (curr <= end) {
              const y = curr.getFullYear(); 
              const m = String(curr.getMonth() + 1).padStart(2, '0'); 
              const d = String(curr.getDate()).padStart(2, '0');
              continuousDates.push(`${y}-${m}-${d}`);
              curr.setDate(curr.getDate() + 1); 
            }
            
            setFechasDisponibles(continuousDates);
            setRangoIndices([0, continuousDates.length - 1]);
          }
        }
      } catch (err) { console.error("Error", err); }
    };
    cargarDatos();
  }, []);

  // Actualización Maestra
  useEffect(() => {
    if (!allInspecciones.length || fechasDisponibles.length === 0) return;

    const semanasMap = new Map();
    fechasDisponibles.forEach((dStr, i) => {
        const w = getISOWeek(dStr);
        if(!semanasMap.has(w)) semanasMap.set(w, []);
        semanasMap.get(w).push(i);
    });

    const uniqueWeeks = Array.from(semanasMap.keys()).filter(w => semanasMap.get(w).some(i => i >= rangoIndices[0] && i <= rangoIndices[1])).sort((a,b)=>a-b);
    const nuevasSemanas = uniqueWeeks.map((week, idx) => ({ week, pct: uniqueWeeks.length > 1 ? (idx / (uniqueWeeks.length - 1)) * 100 : 50 }));
    setSemanasVisibles(nuevasSemanas);

    const procesosFiltrados = allInspecciones.filter(p => {
        const d = getLocalYYYYMMDD(p.createdAt || p.fecha);
        if (!d) return false;
        return d >= fechasDisponibles[rangoIndices[0]] && d <= fechasDisponibles[rangoIndices[1]];
    });

    if (procesosFiltrados.length === 0) {
      setKpis({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
      setPctA1(0); setPctA1A2(0); setPctObjetados(0); setDefectosCalidad([]); setDefectosCondicion([]); setRankingHuertos([]); setEvolucionNotas([]); return;
    }

    let sumaExportable = 0, sumaCalidad = 0, sumaCondicion = 0;
    let conteoA1 = 0, conteoA2 = 0, conteoA3 = 0, conteoObj = 0;
    const notasMap = {}; const acumuladorCalidad = {}; const acumuladorCondicion = {};
    const huertoMap = {}; const notasPorSemana = {};

    procesosFiltrados.forEach((p) => {
      let totalFrutos = 0, defCal = 0, defCond = 0;
      if (p.cajas) {
        p.cajas.forEach(c => {
          totalFrutos += (parseInt(c.frutos) || 0);
          Object.entries(c.defCalidad || {}).forEach(([n, cant]) => { if (n !== 'Bajo calibre' && n !== 'Sobre calibre') defCal += cant; acumuladorCalidad[n] = (acumuladorCalidad[n] || 0) + cant; });
          Object.entries(c.defCondicion || {}).forEach(([n, cant]) => { defCond += cant; acumuladorCondicion[n] = (acumuladorCondicion[n] || 0) + cant; });
        });
      }

      let pExp = 100, pCal = 0, pCond = 0;
      if (totalFrutos > 0) { pCal = (defCal / totalFrutos) * 100; pCond = (defCond / totalFrutos) * 100; pExp = Math.max(0, 100 - pCal - pCond); }
      sumaExportable += pExp; sumaCalidad += pCal; sumaCondicion += pCond;

      const nombreBase = p.huerto || p.productor || 'Sin registro';
      const huertoKey = p.csg ? `${p.csg}_${nombreBase}` : nombreBase;

      if (!huertoMap[huertoKey]) {
        huertoMap[huertoKey] = { sum: 0, count: 0, displayName: nombreBase };
      }
      huertoMap[huertoKey].sum += pExp; 
      huertoMap[huertoKey].count += 1;

      let notaStr = p.nota || p.estado || '';
      if (!notaStr || notaStr === '-' || notaStr === 'Aprobado' || notaStr === 'Objetado') { if (pExp >= 87) notaStr = 'A1'; else if (pExp >= 80) notaStr = 'A2'; else notaStr = 'A3'; }
      if (notaStr.includes('1') || notaStr === 'A1') { conteoA1++; notaStr = 'A1'; }
      else if (notaStr.includes('2') || notaStr === 'A2') { conteoA2++; notaStr = 'A2'; }
      else { conteoA3++; notaStr = 'A3'; }
      if (pExp < 80 || notaStr === 'A3' || p.estado === 'Objetado') conteoObj++;
      notasMap[notaStr] = (notasMap[notaStr] || 0) + 1;

      const dStr = getLocalYYYYMMDD(p.createdAt || p.fecha);
      if (dStr) {
        const week = getISOWeek(dStr);
        if (!notasPorSemana[week]) notasPorSemana[week] = { A1: 0, A2: 0, A3: 0, total: 0 };
        notasPorSemana[week][notaStr]++;
        notasPorSemana[week].total++;
      }
    });

    const totalProc = procesosFiltrados.length;
    let notaPredominante = '-'; let max = 0;
    Object.entries(notasMap).forEach(([nota, cant]) => { if (cant > max) { max = cant; notaPredominante = nota; } });

    setKpis({ procesos: totalProc, exportable: sumaExportable / totalProc, notaPredominante, calidad: sumaCalidad / totalProc, condicion: sumaCondicion / totalProc });
    
    setDistribucionNotas([
      { name: 'A1', value: conteoA1 || 0.0001, displayValue: (conteoA1/totalProc)*100, color: '#16A34A' }, 
      { name: 'A2', value: conteoA2 || 0.0001, displayValue: (conteoA2/totalProc)*100, color: '#EAB308' }, 
      { name: 'A3', value: conteoA3 || 0.0001, displayValue: (conteoA3/totalProc)*100, color: '#DC2626' }
    ]);
    
    setPctA1((conteoA1 / totalProc) * 100); setPctA1A2(((conteoA1 + conteoA2) / totalProc) * 100); setPctObjetados((conteoObj / totalProc) * 100);

    const formatDefectos = (obj) => {
      let totalF = 0; procesosFiltrados.forEach(p => p.cajas?.forEach(c => totalF += (parseInt(c.frutos) || 0)));
      if (totalF === 0) return [];
      return Object.entries(obj).map(([nombre, cant]) => ({ nombre, pct: (cant / totalF) * 100 })).sort((a, b) => b.pct - a.pct).slice(0, 6); 
    };
    setDefectosCalidad(formatDefectos(acumuladorCalidad)); setDefectosCondicion(formatDefectos(acumuladorCondicion));

    const arrRanking = Object.entries(huertoMap).map(([key, data]) => ({ 
      nombre: data.displayName, 
      exp: data.sum / data.count 
    }))
    .sort((a, b) => b.exp - a.exp)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
    setRankingHuertos(arrRanking);

    const allDaysInRange = fechasDisponibles.slice(rangoIndices[0], rangoIndices[1] + 1);
    const weeksInRange = [...new Set(allDaysInRange.map(d => getISOWeek(d)))].sort((a,b) => a-b);

    const arrEvolucion = weeksInRange.map(w => {
      const data = notasPorSemana[w];
      const indices = semanasMap.get(w) || [];
      
      let dateText = '';
      if (indices.length > 0) {
         const d1 = fechasDisponibles[indices[0]];
         const d2 = fechasDisponibles[indices[indices.length - 1]];
         
         // Escudo de seguridad (Optional Chaining) para prevenir quiebre si la fecha está mal formada
         if (d1 && d2) {
           const f1 = `${d1.split('-')[2]}/${d1.split('-')[1]}`;
           const f2 = `${d2.split('-')[2]}/${d2.split('-')[1]}`;
           dateText = f1 === f2 ? f1 : `${f1} al ${f2}`;
         }
      }

      if (!data) return { weekName: `Sem ${w}`, dateText, A1: null, A2: null, A3: null };
      return {
        weekName: `Sem ${w}`,
        dateText,
        A1: data.total ? (data.A1 / data.total) * 100 : null,
        A2: data.total ? (data.A2 / data.total) * 100 : null,
        A3: data.total ? (data.A3 / data.total) * 100 : null,
      };
    });
    setEvolucionNotas(arrEvolucion);

  }, [allInspecciones, rangoIndices, fechasDisponibles]);

  // ================= EFECTO AUTO-SCROLL INFINITO =================
  useEffect(() => {
    const el = scrollRef.current;
    const contentBox = contentRef.current;
    if (!el || !contentBox || rankingHuertos.length <= 4) return;

    let scrollAmount = 0;
    let isPaused = false;
    let animationFrameId;

    el.style.scrollBehavior = 'auto';

    const step = () => {
      if (!isPaused) {
        if (Math.abs(el.scrollTop - scrollAmount) > 2) {
          scrollAmount = el.scrollTop;
        }

        scrollAmount += 0.5; 
        const targetHeight = contentBox.offsetHeight;

        // Escudo de seguridad: Solo ciclar si hay altura válida
        if (targetHeight > 0 && scrollAmount >= targetHeight) {
          scrollAmount -= targetHeight;
        }
        
        el.scrollTop = scrollAmount;
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    const pause = () => { isPaused = true; };
    const play = () => { isPaused = false; scrollAmount = el.scrollTop; };

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
  }, [rankingHuertos]);

  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{customStyles}</style>
      
      {/* ⚠️ AVISO DE ROTACIÓN */}
      <div className="md:hidden portrait:flex hidden fixed inset-0 z-[100] bg-slate-900 flex-col items-center justify-center text-center p-6 text-white animate-fade-in">
         <svg className="w-16 h-16 mb-4 animate-pulse text-[#E96008]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
         <h2 className="text-xl font-black mb-2">Gira tu teléfono</h2>
         <p className="text-slate-400 text-sm font-medium">Por favor coloca tu dispositivo en posición horizontal.</p>
         <button onClick={onClose} className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-full text-sm font-bold border border-slate-700">Volver al menú</button>
      </div>

      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onAbrirMenu} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5" /></button>
          <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#E96008]"/><h1 className="text-[15px] font-black text-slate-800 tracking-tight">Histórico Temporada</h1></div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative z-10">
        <div className="min-w-[1280px] p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">

          {/* HEADER INTERNO CON CALENDARIOS COMPACTOS */}
          <div className="flex justify-between items-center relative z-40 mb-2">
            <div>
              <h2 className="text-[28px] md:text-[32px] font-black text-slate-900 tracking-tight">Histórico Temporada</h2>
              <p className="text-[14px] md:text-[15px] text-slate-500 font-medium">Consolidado general de procesos por rango de fechas</p>
            </div>
            
            {fechasDisponibles.length > 0 && (
              <div className="flex flex-col w-[260px]">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <CustomDatePicker align="left" dateStr={fechasDisponibles[rangoIndices[0]]} minDateStr={fechasDisponibles[0]} maxDateStr={fechasDisponibles[rangoIndices[1]]} onChange={(val) => { let idx = fechasDisponibles.findIndex(d=>d>=val); if(idx===-1)idx=0; setRangoIndices([Math.min(idx, rangoIndices[1]), rangoIndices[1]]); }} diasConProcesos={diasConProcesos}/>
                  <CustomDatePicker align="right" dateStr={fechasDisponibles[rangoIndices[1]]} minDateStr={fechasDisponibles[rangoIndices[0]]} maxDateStr={fechasDisponibles[fechasDisponibles.length - 1]} onChange={(val) => { let idx = [...fechasDisponibles].reverse().findIndex(d=>d<=val); idx = idx===-1 ? fechasDisponibles.length-1 : fechasDisponibles.length-1-idx; setRangoIndices([rangoIndices[0], Math.max(idx, rangoIndices[0])]); }} diasConProcesos={diasConProcesos}/>
                </div>
                <div className="relative h-4 flex items-center px-2 mt-1">
                  <div className="absolute left-0 right-0 h-[4px] bg-slate-200/80 rounded-full mx-2"></div>
                  <div className="absolute h-[4px] bg-[#f87171] rounded-full mx-2" style={{ left: `${(rangoIndices[0] / (fechasDisponibles.length - 1 || 1)) * 100}%`, width: `${((rangoIndices[1] - rangoIndices[0]) / (fechasDisponibles.length - 1 || 1)) * 100}%` }}></div>
                  <input type="range" min="0" max={fechasDisponibles.length - 1} value={rangoIndices[0]} onChange={(e) => setRangoIndices([Math.min(Number(e.target.value), rangoIndices[1]), rangoIndices[1]])} className="dual-range-input z-10" />
                  <input type="range" min="0" max={fechasDisponibles.length - 1} value={rangoIndices[1]} onChange={(e) => setRangoIndices([rangoIndices[0], Math.max(Number(e.target.value), rangoIndices[0])])} className="dual-range-input z-20" />
                </div>
                <div className="relative h-4 mt-2 mx-2">
                  {semanasVisibles.map((s, idx) => (
                    <div key={idx} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${s.pct}%` }}>
                      <div className="w-[3px] h-[3px] rounded-full bg-slate-300 mb-0.5"></div>
                      <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap tracking-wide">Sem {s.week}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================= SECCIÓN 1: KPIs CON NUEVOS TÍTULOS ================= */}
          <div className="grid grid-cols-5 gap-4 relative z-10">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm flex flex-col justify-center min-h-[140px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-4 left-4">PROCESOS INSPECCIONADOS</p>
              <p className="text-[34px] font-black text-slate-900 mt-5 text-center">{kpis.procesos}</p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm flex flex-col justify-center min-h-[140px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-4 left-4">CALIFICACIÓN PREDOMINANTE</p>
              <p className="text-[34px] font-black text-slate-900 mt-5 text-center">{kpis.notaPredominante}</p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm flex flex-col justify-center min-h-[140px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-4 left-4">DEFEC. CALIDAD (PROM)</p>
              <p className="text-[34px] font-black text-[#EA580C] mt-5 text-center">{kpis.calidad.toFixed(1).replace('.', ',')}%</p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm flex flex-col justify-center min-h-[140px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-4 left-4">DEFEC. CONDICIÓN (PROM)</p>
              <p className="text-[34px] font-black text-[#DC2626] mt-5 text-center">{kpis.condicion.toFixed(1).replace('.', ',')}%</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center min-h-[140px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-4 left-5">EXPORTABLE HISTÓRICO</p>
              
              <p className="text-[34px] font-black leading-none mt-6 mb-2 text-slate-900 text-center">
                {kpis.exportable.toFixed(1).replace('.', ',')}%
              </p>
              
              <div className="w-full relative mt-1 mb-4">
                <div className="relative w-full h-2.5 rounded-full overflow-hidden flex">
                  <div className="bg-[#ef4444] flex-1"></div>
                  <div className="bg-[#f59e0b] flex-1"></div>
                  <div className="bg-[#10b981] flex-1"></div>
                </div>
                
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-[#334155] rounded-full shadow-sm transition-all duration-1000 ease-out z-10" 
                  style={{ left: `calc(${Math.min(Math.max((kpis.exportable <= 80 ? (kpis.exportable/80)*33.33 : kpis.exportable <= 87 ? 33.33 + ((kpis.exportable-80)/7)*33.33 : 66.66 + ((Math.min(kpis.exportable,100)-87)/13)*33.33), 0), 100)}% - 8px)` }}
                ></div>

                <div className="absolute top-3 left-[33.33%] -translate-x-1/2 text-[10px] font-black text-slate-700">80%</div>
                <div className="absolute top-3 left-[66.66%] -translate-x-1/2 text-[10px] font-black text-slate-700">87%</div>
              </div>

              <div className="w-full flex justify-between items-center mt-2 px-1">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><span className="text-[9px] font-black text-[#1e293b] uppercase">Crítico</span></div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div><span className="text-[9px] font-black text-[#1e293b] uppercase">Regular</span></div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div><span className="text-[9px] font-black text-[#1e293b] uppercase">Óptimo</span></div>
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 2: GAUGES + RANKING ================= */}
          <div className="grid grid-cols-12 gap-5 mt-5">
            <div className="col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wide">CUMPLIMIENTO DE ESTÁNDARES</h3>
                <div className="flex items-center gap-6 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-700">Óptimo</span></div>
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-700">Alerta</span></div>
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-[10px] font-bold text-slate-700">Crítico</span></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5 flex-1">
                <GaugeCard title="Procesos A1" value={pctA1} objText="Objetivo: ≥ 40%" colors={['#ef4444', '#f59e0b', '#10b981']} thresholds={[30, 40]} labels={['30%', '40%']} />
                <GaugeCard title="A1 + A2" value={pctA1A2} objText="Objetivo: ≥ 92%" colors={['#ef4444', '#f59e0b', '#10b981']} thresholds={[85, 92]} labels={['85%', '92%']} />
                <GaugeCard title="Objetados" value={pctObjetados} objText="Objetivo: ≤ 8%" colors={['#10b981', '#f59e0b', '#ef4444']} thresholds={[8, 15]} labels={['8%', '15%']} invertedLogic={true} />
              </div>
            </div>

            <div className="col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-[280px] overflow-hidden min-w-0">
              <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wide">RANKING CALIDAD HUERTOS</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Exportable</span>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto auto-scroll-list pr-2 relative group">
                {rankingHuertos.length === 0 ? (
                  <div className="flex items-center justify-center h-full"><span className="text-sm font-bold text-slate-400">Sin datos de huertos</span></div>
                ) : (
                  <>
                    <div ref={contentRef} className="flex flex-col gap-2 pb-2">
                      {rankingHuertos.map((prod, i) => (
                        <div key={`rank-${prod.rank}-${i}`} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg shrink-0 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                             <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow-sm bg-slate-200 text-slate-600 shrink-0">
                               {prod.rank}
                             </div>
                             <span className="text-[12px] font-bold text-slate-700 truncate" title={prod.nombre}>
                               {prod.nombre}
                             </span>
                          </div>
                          <span className="text-[14px] font-black text-[#16A34A] shrink-0 ml-2">{prod.exp.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                    {/* Clonación para bucle perfecto */}
                    {rankingHuertos.length > 4 && (
                      <div className="flex flex-col gap-2 pb-2">
                        {rankingHuertos.map((prod, i) => (
                          <div key={`clone-${prod.rank}-${i}`} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg shrink-0 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                               <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shadow-sm bg-slate-200 text-slate-600 shrink-0">
                                 {prod.rank}
                               </div>
                               <span className="text-[12px] font-bold text-slate-700 truncate" title={prod.nombre}>
                                 {prod.nombre}
                               </span>
                            </div>
                            <span className="text-[14px] font-black text-[#16A34A] shrink-0 ml-2">{prod.exp.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 3: PIE Y GRÁFICO EVOLUTIVO ================= */}
          <div className="grid grid-cols-12 gap-5 mt-5">
            
            {/* DISTRIBUCIÓN CALIFICACIONES (Col-span-4) */}
            <div className="col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <h3 className="text-[14px] font-black text-slate-800 mb-4 uppercase tracking-wide">DISTRIBUCIÓN CALIFICACIONES</h3>
              <div className="flex-1 flex items-center justify-between mt-2">
                <div className="w-1/2 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="gradA1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399"/><stop offset="100%" stopColor="#16A34A"/></linearGradient>
                        <linearGradient id="gradA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FCD34D"/><stop offset="100%" stopColor="#D97706"/></linearGradient>
                        <linearGradient id="gradA3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171"/><stop offset="100%" stopColor="#DC2626"/></linearGradient>
                      </defs>
                      <Pie data={distribucionNotas} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                        {distribucionNotas.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'A1' ? 'url(#gradA1)' : entry.name === 'A2' ? 'url(#gradA2)' : 'url(#gradA3)'} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 flex flex-col gap-4 pl-4 border-l border-slate-100">
                  {distribucionNotas.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
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

            {/* GRÁFICO: EVOLUCIÓN CALIFICACIONES (Col-Span-8) */}
            <div className="col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col relative">
              <h3 className="text-[14px] font-black text-slate-800 mb-2 uppercase tracking-wide">EVOLUCIÓN CALIFICACIONES</h3>
              
              <div className="flex-1 w-full min-h-[220px] mt-2 relative pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  {/* Margin bottom 50 permite desplazar la leyenda al borde absoluto */}
                  <LineChart data={evolucionNotas} margin={{ top: 20, right: 30, left: -20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    
                    <XAxis 
                      dataKey="weekName" 
                      axisLine={false} 
                      tickLine={false} 
                      padding={{ left: 10, right: 10 }}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const item = evolucionNotas[payload.index];
                        return (
                          <g transform={`translate(${x},${y})`}>
                            {/* Ajuste de margen visual con el gráfico */}
                            <text x={0} y={20} dy={0} textAnchor="middle" fill="#64748B" fontSize={12} fontWeight={800}>
                              {payload.value}
                            </text>
                            <text x={0} y={36} dy={0} textAnchor="middle" fill="#94A3B8" fontSize={10} fontWeight={600}>
                              {item?.dateText || ''}
                            </text>
                          </g>
                        );
                      }}
                    />

                    <YAxis 
                      domain={[0, 100]} 
                      ticks={[0, 25, 50, 75, 100]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} 
                      tickFormatter={(val) => `${val}%`}
                    />
                    
                    <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} content={() => null} />
                    
                    {/* LEYENDA EN EL BORDE INFERIOR EXACTO */}
                    <Legend 
                      iconType="circle" 
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ 
                        position: 'absolute',
                        bottom: -25, /* Empuja la leyenda contra el borde del contenedor principal */
                        left: 0,
                        width: '100%',
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: '40px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#475569'
                      }} 
                    />
                    
                    <Line 
                      connectNulls 
                      type="monotone" 
                      dataKey="A1" 
                      name="A1" 
                      stroke="#16A34A" 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: '#16A34A', fillOpacity: 0.3, stroke: '#16A34A', strokeWidth: 2 }} 
                      activeDot={<CustomActiveDotA1 />} 
                    />
                    <Line 
                      connectNulls 
                      type="monotone" 
                      dataKey="A2" 
                      name="A2" 
                      stroke="#EAB308" 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: '#EAB308', fillOpacity: 0.3, stroke: '#EAB308', strokeWidth: 2 }} 
                      activeDot={<CustomActiveDotA2 />} 
                    />
                    <Line 
                      connectNulls 
                      type="monotone" 
                      dataKey="A3" 
                      name="A3" 
                      stroke="#DC2626" 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: '#DC2626', fillOpacity: 0.3, stroke: '#DC2626', strokeWidth: 2 }} 
                      activeDot={<CustomActiveDotA3 />} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 4: PRINCIPALES DEFECTOS ================= */}
          <div className="grid grid-cols-12 gap-5 mt-5 pb-8">
            <div className="col-span-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-[14px] font-black text-slate-800 mb-6 uppercase tracking-wide">
                PRINCIPALES DEFECTOS <span className="text-slate-400 text-[12px] font-bold capitalize tracking-normal ml-2">(Promedio histórico temporada)</span>
              </h3>
              <div className="grid grid-cols-2 gap-x-16">
                <div>
                  <h4 className="text-[13px] font-black text-[#EA580C] mb-4 uppercase tracking-wider">CALIDAD</h4>
                  <div className="space-y-1">
                    {defectosCalidad.length > 0 ? defectosCalidad.map((d, i) => <BarraDefecto key={i} nombre={d.nombre} pct={d.pct} colorClass="bg-gradient-to-r from-orange-400 to-orange-500" />) : <p className="text-sm font-bold text-slate-300 py-4 text-center">Sin defectos</p>}
                  </div>
                </div>
                <div className="border-l border-slate-100 pl-16">
                  <h4 className="text-[13px] font-black text-[#DC2626] mb-4 uppercase tracking-wider">CONDICIÓN</h4>
                  <div className="space-y-1">
                    {defectosCondicion.length > 0 ? defectosCondicion.map((d, i) => <BarraDefecto key={i} nombre={d.nombre} pct={d.pct} colorClass="bg-gradient-to-r from-red-500 to-red-600" />) : <p className="text-sm font-bold text-slate-300 py-4 text-center">Sin defectos</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
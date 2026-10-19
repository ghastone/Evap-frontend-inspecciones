import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, LineChart, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea } from 'recharts';
import { Menu, X, BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
const useCountUp = (endValue, duration = 1000, decimals = 0) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let frame, start = null, from = count;
    const end = Number(endValue) || 0;
    const step = t => {
      if (!start) start = t;
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(from + (end - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(step); else setCount(end);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [endValue, duration]);
  return { raw: count, formatted: count.toFixed(decimals).replace('.', ',') };
};
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
  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(22px) scale(.985); }
    65% { opacity: 1; }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .animate-fade-in { animation: fadeInUp .8s cubic-bezier(.16,1,.3,1) both; }
  .delay-1 { animation-delay: .08s; }
  .delay-2 { animation-delay: .16s; }
  .delay-3 { animation-delay: .24s; }
  .delay-4 { animation-delay: .32s; }
  @keyframes pulseDot {
    0%,100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.28); opacity: .65; }
  }
  .animate-pulse-dot { animation: pulseDot 2s cubic-bezier(.4,0,.6,1) infinite; }
  .kpi-card, .animated-card { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .kpi-card:hover, .animated-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px -5px rgba(15,23,42,.07), 0 8px 10px -6px rgba(15,23,42,.04); }
  .defect-item { transition: background-color .2s ease, transform .2s ease; border-radius: .5rem; }
  .defect-item:hover { background: #f8fafc; transform: translateX(2px); }
  .defect-bar { transition: width 1s cubic-bezier(.16,1,.3,1), filter .2s ease, box-shadow .2s ease; }
  .defect-item:hover .defect-bar { filter: brightness(1.12); box-shadow: 0 0 8px rgba(15,23,42,.08); }
  .ranking-row { transition: background-color .2s ease, transform .18s ease, box-shadow .2s ease; }
  .ranking-row:hover { transform: translateX(3px); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
  .donut-arc, .donut-gap { transition: stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1), stroke-width .22s ease, opacity .22s ease; }
  @media (max-width: 767px) {
    .kpi-card:hover, .animated-card:hover { transform: none; }
  }
  @media (min-width: 1800px) {
    .kpi-card { min-height: 108px !important; height: 108px !important; }
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
const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
const API_URL = window.location.hostname.includes('goldanda.cl')
  ? 'https://evap.maq.goldanda.cl'
  : `http://${window.location.hostname || 'localhost'}:3001`;
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
const evaluarProceso = (proceso, parametrosActuales) => {
  const parametros = parametrosDeProceso(proceso, parametrosActuales);
  const calidad = Array.isArray(parametros.calidad) ? parametros.calidad : [];
  const condicion = Array.isArray(parametros.condicion) ? parametros.condicion : [];
  const cajas = Array.isArray(proceso?.cajas) ? proceso.cajas : [];
  let totalFrutos = 0, totalCal = 0, totalCond = 0;
  const agregadoCal = {}, agregadoCond = {};
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
  const categoria = estadoCalculado === 'Objetado' ? 'Crítico' : nota === 'A1' ? 'Óptimo' : 'Regular';
  return { totalFrutos, pCal, pCond, pExp, nota, estadoCalculado, categoria, agregadoCal, agregadoCond };
};
const posicionSegmentadaExportable = valor => {
  const v = Math.max(0, Math.min(Number(valor) || 0, 100));
  if (v <= 80) return (v / 80) * (100 / 3);
  if (v <= 90) return (100 / 3) + ((v - 80) / 10) * (100 / 3);
  return (200 / 3) + ((v - 90) / 10) * (100 / 3);
};
// === COMPONENTES DE PUNTOS ACTIVOS PERSONALIZADOS (HOVER) ===
const CustomActiveDotA1 = (props) => {
  const { cx, cy, value } = props;
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#16A34A" stroke="#fff" strokeWidth={2} />
      <text x={cx} y={cy - 12} fill="#16A34A" fontSize={11} fontWeight="900" textAnchor="middle">{Number(value).toFixed(1)}%</text>
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
  const anim = useCountUp(value, 1000, 1);
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
  const vp = Math.min(Math.max(getVisualPercentage(anim.raw, thresholds[0], thresholds[1]), 0), 100);
  const angleRad = (180 - vp * 1.8) * (Math.PI / 180);
  const markerX = 110 + 75 * Math.cos(angleRad);
  const markerY = 100 - 75 * Math.sin(angleRad);
  return (
    <div className="animated-card bg-white/90 border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
      <div className="bg-slate-50/85 text-slate-700 border-b border-slate-200/80 flex items-center px-4 py-2 font-black text-[12px] uppercase tracking-wider">
        <div className="w-3 h-3 rounded-full animate-pulse-dot mr-2.5" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusShadow}` }}></div>
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
const PuntoExportable = ({ cx, cy, value }) => {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6.5} fill="#FFFFFF" stroke="#107E44" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={2.2} fill="#107E44" />
      <text x={cx} y={cy - 15} fill="#0F172A" fontSize="11.5" fontWeight="800" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 4, strokeLinejoin: 'round' }}>
        {`${Number(value).toFixed(1).replace('.', ',')}%`}
      </text>
    </g>
  );
};
const formatearRangoSemana = texto => {
  const raw = String(texto || '').trim();
  if (!raw) return '';
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const partes = raw.split(/\s+al\s+/i);
  const parse = valor => {
    const [dd, mm] = valor.trim().split('/');
    const idx = Number(mm) - 1;
    return { dd, mes: meses[idx] || mm, mm };
  };
  if (partes.length === 1) {
    const a = parse(partes[0]);
    return `${a.dd} ${a.mes}`;
  }
  const a = parse(partes[0]), b = parse(partes[1]);
  if (a.mm === b.mm) return `${a.dd} - ${b.dd} ${b.mes}`;
  return `${a.dd} ${a.mes} - ${b.dd} ${b.mes}`;
};
const PuntoEvolucion = ({ cx, cy, value, color, labelColor, seleccionado = false, atenuado = false, mostrarEtiqueta = false, decimales = 1, offsetY = -12, onClick, onMouseEnter, onMouseLeave }) => {
  if (cx == null || cy == null || value == null) return null;
  const etiqueta = `${Number(value).toFixed(decimales).replace('.', ',')}%`;
  return (
    <g
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={(e) => { e?.stopPropagation?.(); onClick?.(); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <circle cx={cx} cy={cy} r={seleccionado ? 6 : 5} fill={color} fillOpacity={atenuado ? 0.08 : 0.28} stroke={color} strokeWidth={seleccionado ? 2.5 : 2} strokeOpacity={atenuado ? 0.2 : 1} style={{ transition: 'all .22s ease' }} />
      {mostrarEtiqueta && !atenuado && (
        <text x={cx} y={cy + offsetY} fill={labelColor || color} fontSize="11" fontWeight="900" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' }}>{etiqueta}</text>
      )}
    </g>
  );
};

const redondearPasoSuperior = (valor, paso = 0.5) => {
  const num = Number(valor) || 0;
  if (num <= 0) return paso;
  return Math.ceil(num / paso) * paso;
};
const ticksPorDominio = (maximo, paso = 0.5) => {
  const max = Math.max(paso, Number(maximo) || paso);
  const total = Math.round(max / paso);
  return Array.from({ length: total + 1 }, (_, i) => Number((i * paso).toFixed(1)));
};
const TooltipEvolucionDefectos = ({ active, payload, label, seriesMap, semanaPico }) => {
  if (!active || !payload || !payload.length) return null;
  const unicos = new Map();
  payload
    .filter(item => item && item.value !== null && item.value !== undefined)
    .forEach(item => {
      if (!unicos.has(item.dataKey)) unicos.set(item.dataKey, item);
    });
  const filas = [...unicos.values()]
    .map(item => ({
      key: item.dataKey,
      value: Number(item.value) || 0,
      color: seriesMap[item.dataKey]?.tooltipColor || seriesMap[item.dataKey]?.color || item.color,
      nombre: seriesMap[item.dataKey]?.nombre || item.name || item.dataKey
    }))
    .sort((a, b) => b.value - a.value);
  if (!filas.length) return null;
  return (
    <div
      style={{
        minWidth: 200,
        borderRadius: 14,
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(226,232,240,.95)',
        boxShadow: '0 18px 45px rgba(15,23,42,.12), 0 6px 14px rgba(15,23,42,.08)'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
        {`Detalle ${label}${semanaPico === label ? ' (Semana Pico)' : ''}`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filas.map(fila => (
          <div key={fila.key} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'center', columnGap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: fila.color, display: 'inline-block' }}></span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B' }}>{fila.nombre}:</span>
            <span style={{ fontSize: 11.5, fontWeight: 900, color: fila.color }}>{`${fila.value.toFixed(2)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
const ChipSerieDefecto = ({ item, activo, visible, onToggle, onHoverStart, onHoverEnd }) => (
  <div
    onMouseEnter={onHoverStart}
    onMouseLeave={onHoverEnd}
    className={`group flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-200 min-w-0 ${activo ? 'shadow-sm' : ''} ${visible ? '' : 'opacity-45'}`}
    style={{
      background: visible ? item.chipBg : '#ffffff',
      borderColor: activo ? item.color : item.chipBorder,
      boxShadow: activo ? `0 5px 14px ${item.shadow}` : 'none'
    }}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${item.nombre}`}
      className="h-3.5 w-3.5 rounded-full shrink-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1"
      style={{
        background: visible ? item.color : '#ffffff',
        border: `2px solid ${item.color}`,
        boxShadow: visible ? `0 0 0 2px ${item.dotHalo}` : 'none'
      }}
    />
    <span className="text-[9px] sm:text-[9.5px] xl:text-[10px] font-black whitespace-nowrap truncate" style={{ color: '#0F172A' }}>{item.nombre}</span>
  </div>
);

const normalizarDefectoGrafico = texto => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const valorDefectoSeleccionado = (met, tipo) => {
  const todos = { ...(met?.agregadoCal || {}), ...(met?.agregadoCond || {}) };
  return Object.entries(todos).reduce((sum, [nombre, valor]) => {
    const n = normalizarDefectoGrafico(nombre);
    if (tipo === 'sinPedicelo' && n.includes('sin pedicelo')) return sum + (Number(valor) || 0);
    if (tipo === 'machucon' && n.includes('machucon')) return sum + (Number(valor) || 0);
    if (tipo === 'frutaBlanda' && n.includes('fruta blanda')) return sum + (Number(valor) || 0);
    if (tipo === 'partiduraAgua' && n.includes('partidura por agua')) return sum + (Number(valor) || 0);
    if (tipo === 'pitting' && n.includes('pitting')) return sum + (Number(valor) || 0);
    return sum;
  }, 0);
};
const BarraDefecto = ({ nombre, pct, colorClass }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(Math.min(pct * 10, 100)), 100);
    return () => clearTimeout(timer);
  }, [pct]);
  return (
    <div className="defect-item flex items-center py-1.5 px-2 -mx-2">
      <span className="w-1/3 text-[13px] font-bold text-slate-500 truncate pr-2" title={nombre}>{nombre}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-[8px] overflow-hidden"><div className={`defect-bar h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} /></div>
      <span className="w-12 text-right text-[13px] font-black text-slate-700 ml-3">{pct.toFixed(1).replace('.', ',')}%</span>
    </div>
  );
};
export default function DashboardHistoricoTemporada({ onClose, onAbrirMenu }) {
  const [allInspecciones, setAllInspecciones] = useState([]);
  const [parametrosActuales, setParametrosActuales] = useState({ calidad: [], condicion: [] });
  // Slider y Semanas
  const [fechasDisponibles, setFechasDisponibles] = useState([]);
  const [diasConProcesos, setDiasConProcesos] = useState([]);
  const [rangoIndices, setRangoIndices] = useState([0, 0]);
  const [semanasVisibles, setSemanasVisibles] = useState([]);
  const [filtroExportadora, setFiltroExportadora] = useState('');
  const [filtroVariedad, setFiltroVariedad] = useState('');
  // KPIs
  const [kpis, setKpis] = useState({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
  const [distribucionNotas, setDistribucionNotas] = useState([
    { name: 'A1', descripcion: 'Óptimo', value: 0.0001, displayValue: 0, color: '#10b981' },
    { name: 'A2', descripcion: 'Regular', value: 0.0001, displayValue: 0, color: '#eab308' },
    { name: 'A3', descripcion: 'Crítico', value: 0.0001, displayValue: 0, color: '#f43f5e' }
  ]);
  const [evolucionNotas, setEvolucionNotas] = useState([]); 
  const [evolucionDefectos, setEvolucionDefectos] = useState([]);
  const [evolucionExportable, setEvolucionExportable] = useState([]);
  const [defectosCalidad, setDefectosCalidad] = useState([]);
  const [defectosCondicion, setDefectosCondicion] = useState([]);
  const [pctA1, setPctA1] = useState(0);
  const [pctA1A2, setPctA1A2] = useState(0);
  const [pctObjetados, setPctObjetados] = useState(0);
  // Ranking Huertos & Refs Auto-Scroll
  const [rankingHuertos, setRankingHuertos] = useState([]);
  const [donutHover, setDonutHover] = useState(null);
  const [evolucionHover, setEvolucionHover] = useState(null);
  const [evolucionSeleccion, setEvolucionSeleccion] = useState(null);
  const evolucionActiva = evolucionSeleccion || evolucionHover;
  const [defectoHover, setDefectoHover] = useState(null);
  const [defectoSeleccion, setDefectoSeleccion] = useState(null);
  const [seriesDefectosVisibles, setSeriesDefectosVisibles] = useState({
    sinPedicelo: true,
    machucon: true,
    frutaBlanda: true,
    partiduraAgua: true,
    pitting: true
  });
  const defectoActivo = defectoSeleccion || defectoHover;
  const [svgMounted, setSvgMounted] = useState(false);
  const [animacionId, setAnimacionId] = useState(0);
  const procesosAnim = useCountUp(kpis.procesos, 800, 0);
  const exportableAnim = useCountUp(kpis.exportable, 1100, 1);
  const calidadAnim = useCountUp(kpis.calidad, 1000, 1);
  const condicionAnim = useCountUp(kpis.condicion, 1000, 1);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  useEffect(() => {
    setSvgMounted(false);
    const t = setTimeout(() => setSvgMounted(true), 40);
    return () => clearTimeout(t);
  }, [animacionId]);
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resInspecciones, resParametros] = await Promise.all([
          fetch(`${API_URL}/api/inspecciones`),
          fetch(`${API_URL}/api/parametros`)
        ]);
        const data = await resInspecciones.json();
        const parametros = resParametros.ok ? await resParametros.json() : { calidad: [], condicion: [] };
        setParametrosActuales({
          calidad: Array.isArray(parametros.calidad) ? parametros.calidad : [],
          condicion: Array.isArray(parametros.condicion) ? parametros.condicion : []
        });
        if (!Array.isArray(data)) return;
        setAllInspecciones(data);
        const processDates = data.map(p => getLocalYYYYMMDD(p.createdAt || p.fecha)).filter(Boolean);
        setDiasConProcesos([...new Set(processDates)]);
        const hoyStrLocal = getLocalYYYYMMDD(getHoyStr());
        if (hoyStrLocal) processDates.push(hoyStrLocal);
        const uniqueDates = [...new Set(processDates)].sort();
        if (!uniqueDates.length) return;
        const [minY, minM, minD] = uniqueDates[0].split('-');
        const [maxY, maxM, maxD] = uniqueDates[uniqueDates.length - 1].split('-');
        const curr = new Date(+minY, +minM - 1, +minD, 12, 0, 0);
        const fin = new Date(+maxY, +maxM - 1, +maxD, 12, 0, 0);
        const continuousDates = [];
        while (curr <= fin) {
          continuousDates.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
          curr.setDate(curr.getDate() + 1);
        }
        setFechasDisponibles(continuousDates);
        setRangoIndices([0, continuousDates.length - 1]);
      } catch (err) {
        console.error('Error cargando histórico de temporada:', err);
      }
    };
    cargarDatos();
  }, []);
  // Recalcula todo el histórico cada vez que cambia el rango seleccionado.
  useEffect(() => {
    if (!allInspecciones.length || !fechasDisponibles.length) return;
    setAnimacionId(v => v + 1);
    const inicio = fechasDisponibles[rangoIndices[0]];
    const fin = fechasDisponibles[rangoIndices[1]];
    const semanasMap = new Map();
    fechasDisponibles.forEach((dStr, i) => {
      const w = getISOWeek(dStr);
      if (!semanasMap.has(w)) semanasMap.set(w, []);
      semanasMap.get(w).push(i);
    });
    const weeksRange = [...new Set(fechasDisponibles.slice(rangoIndices[0], rangoIndices[1] + 1).map(getISOWeek))].sort((a, b) => a - b);
    setSemanasVisibles(weeksRange.map((week, idx) => ({ week, pct: weeksRange.length > 1 ? (idx / (weeksRange.length - 1)) * 100 : 50 })));
    const procesosFiltrados = allInspecciones.filter(p => {
      const d = getLocalYYYYMMDD(p.createdAt || p.fecha);
      const cumpleFecha = d && d >= inicio && d <= fin;
      const cumpleExportadora = !filtroExportadora || String(p.exportadora || '') === filtroExportadora;
      const cumpleVariedad = !filtroVariedad || String(p.variedad || '') === filtroVariedad;
      return cumpleFecha && cumpleExportadora && cumpleVariedad;
    });
    if (!procesosFiltrados.length) {
      setKpis({ procesos: 0, exportable: 0, notaPredominante: '-', calidad: 0, condicion: 0 });
      setDistribucionNotas([
        { name: 'A1', descripcion: 'Óptimo', value: 0.0001, displayValue: 0, color: '#10b981' },
        { name: 'A2', descripcion: 'Regular', value: 0.0001, displayValue: 0, color: '#eab308' },
        { name: 'A3', descripcion: 'Crítico', value: 0.0001, displayValue: 0, color: '#f43f5e' }
      ]);
      setPctA1(0); setPctA1A2(0); setPctObjetados(0);
      setDefectosCalidad([]); setDefectosCondicion([]); setRankingHuertos([]); setEvolucionNotas([]); setEvolucionDefectos([]); setEvolucionExportable([]);
      return;
    }
    let sumaExportable = 0, sumaCalidad = 0, sumaCondicion = 0, procesosConMuestra = 0;
    let catA1 = 0, catA2 = 0, catA3 = 0, evaluables = 0;
    const notasMap = {}, acumuladorCalidad = {}, acumuladorCondicion = {}, huertoMap = {}, categoriasPorSemana = {}, defectosPorSemana = {}, exportablePorSemana = {};
    procesosFiltrados.forEach(p => {
      const met = evaluarProceso(p, parametrosActuales);
      if (met.totalFrutos > 0) {
        procesosConMuestra++;
        sumaExportable += met.pExp;
        sumaCalidad += met.pCal;
        sumaCondicion += met.pCond;
        const nombreBase = p.huerto || p.productor || 'Sin registro';
        const huertoKey = p.csg ? `${p.csg}_${nombreBase}` : nombreBase;
        if (!huertoMap[huertoKey]) huertoMap[huertoKey] = { sum: 0, count: 0, displayName: nombreBase };
        huertoMap[huertoKey].sum += met.pExp;
        huertoMap[huertoKey].count++;
      }
      Object.entries(met.agregadoCal).forEach(([n, v]) => acumuladorCalidad[n] = (acumuladorCalidad[n] || 0) + v);
      Object.entries(met.agregadoCond).forEach(([n, v]) => acumuladorCondicion[n] = (acumuladorCondicion[n] || 0) + v);
      const fechaDefecto = getLocalYYYYMMDD(p.createdAt || p.fecha);
      if (fechaDefecto && met.totalFrutos > 0) {
        const weekDefecto = getISOWeek(fechaDefecto);
        if (!defectosPorSemana[weekDefecto]) defectosPorSemana[weekDefecto] = { totalFrutos: 0, sinPedicelo: 0, machucon: 0, frutaBlanda: 0, partiduraAgua: 0, pitting: 0 };
        defectosPorSemana[weekDefecto].totalFrutos += met.totalFrutos;
        defectosPorSemana[weekDefecto].sinPedicelo += valorDefectoSeleccionado(met, 'sinPedicelo');
        defectosPorSemana[weekDefecto].machucon += valorDefectoSeleccionado(met, 'machucon');
        defectosPorSemana[weekDefecto].frutaBlanda += valorDefectoSeleccionado(met, 'frutaBlanda');
        defectosPorSemana[weekDefecto].partiduraAgua += valorDefectoSeleccionado(met, 'partiduraAgua');
        defectosPorSemana[weekDefecto].pitting += valorDefectoSeleccionado(met, 'pitting');
        if (!exportablePorSemana[weekDefecto]) exportablePorSemana[weekDefecto] = { sum: 0, count: 0 };
        exportablePorSemana[weekDefecto].sum += met.pExp;
        exportablePorSemana[weekDefecto].count++;
      }
      if (met.nota === '-') return;
      evaluables++;
      notasMap[met.nota] = (notasMap[met.nota] || 0) + 1;
      const categoriaNota = met.categoria === 'Óptimo' ? 'A1' : met.categoria === 'Regular' ? 'A2' : 'A3';
      if (categoriaNota === 'A1') catA1++;
      else if (categoriaNota === 'A2') catA2++;
      else catA3++;
      const dStr = getLocalYYYYMMDD(p.createdAt || p.fecha);
      if (!dStr) return;
      const week = getISOWeek(dStr);
      if (!categoriasPorSemana[week]) categoriasPorSemana[week] = { A1: 0, A2: 0, A3: 0, total: 0 };
      categoriasPorSemana[week][categoriaNota]++;
      categoriasPorSemana[week].total++;
    });
    const totalProc = procesosFiltrados.length;
    const notaPredominante = Object.entries(notasMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    setKpis({
      procesos: totalProc,
      exportable: procesosConMuestra ? sumaExportable / procesosConMuestra : 0,
      notaPredominante,
      calidad: procesosConMuestra ? sumaCalidad / procesosConMuestra : 0,
      condicion: procesosConMuestra ? sumaCondicion / procesosConMuestra : 0
    });
    const baseNotas = evaluables || 1;
    setDistribucionNotas([
      { name: 'A1', descripcion: 'Óptimo', value: catA1 || 0.0001, displayValue: (catA1 / baseNotas) * 100, color: '#10b981' },
      { name: 'A2', descripcion: 'Regular', value: catA2 || 0.0001, displayValue: (catA2 / baseNotas) * 100, color: '#eab308' },
      { name: 'A3', descripcion: 'Crítico', value: catA3 || 0.0001, displayValue: (catA3 / baseNotas) * 100, color: '#f43f5e' }
    ]);
    setPctA1((catA1 / baseNotas) * 100);
    setPctA1A2(((catA1 + catA2) / baseNotas) * 100);
    setPctObjetados((catA3 / baseNotas) * 100);
    const totalFrutosRango = procesosFiltrados.reduce((sum, p) => sum + (p.cajas || []).reduce((s, c) => s + (parseInt(c.frutos) || 0), 0), 0);
    const formatDefectos = obj => totalFrutosRango ? Object.entries(obj)
      .map(([nombre, cant]) => ({ nombre, pct: (cant / totalFrutosRango) * 100 }))
      .filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 6) : [];
    setDefectosCalidad(formatDefectos(acumuladorCalidad));
    setDefectosCondicion(formatDefectos(acumuladorCondicion));
    setRankingHuertos(Object.values(huertoMap)
      .map(data => ({ nombre: data.displayName, exp: data.count ? data.sum / data.count : 0 }))
      .sort((a, b) => b.exp - a.exp)
      .map((item, idx) => ({ ...item, rank: idx + 1 })));
    const datosSemana = w => {
      const indices = (semanasMap.get(w) || []).filter(i => i >= rangoIndices[0] && i <= rangoIndices[1]);
      let dateText = '';
      if (indices.length) {
        const d1 = fechasDisponibles[indices[0]], d2 = fechasDisponibles[indices[indices.length - 1]];
        if (d1 && d2) {
          const f1 = `${d1.split('-')[2]}/${d1.split('-')[1]}`;
          const f2 = `${d2.split('-')[2]}/${d2.split('-')[1]}`;
          dateText = f1 === f2 ? f1 : `${f1} al ${f2}`;
        }
      }
      return { weekName: `Sem ${w}`, dateText };
    };
    setEvolucionNotas(weeksRange.map(w => {
      const base = datosSemana(w);
      const data = categoriasPorSemana[w];
      if (!data) return { ...base, A1: null, A2: null, A3: null };
      return {
        ...base,
        A1: data.total ? (data.A1 / data.total) * 100 : null,
        A2: data.total ? (data.A2 / data.total) * 100 : null,
        A3: data.total ? (data.A3 / data.total) * 100 : null
      };
    }));
    setEvolucionDefectos(weeksRange.map(w => {
      const base = datosSemana(w);
      const data = defectosPorSemana[w];
      const total = data?.totalFrutos || 0;
      return {
        ...base,
        sinPedicelo: total ? (data.sinPedicelo / total) * 100 : null,
        machucon: total ? (data.machucon / total) * 100 : null,
        frutaBlanda: total ? (data.frutaBlanda / total) * 100 : null,
        partiduraAgua: total ? (data.partiduraAgua / total) * 100 : null,
        pitting: total ? (data.pitting / total) * 100 : null
      };
    }));
    setEvolucionExportable(weeksRange.map(w => {
      const base = datosSemana(w);
      const data = exportablePorSemana[w];
      return { ...base, exportable: data?.count ? data.sum / data.count : null };
    }));
  }, [allInspecciones, rangoIndices, fechasDisponibles, parametrosActuales, filtroExportadora, filtroVariedad]);
  // Auto-scroll del ranking: intervalo liviano para evitar un requestAnimationFrame permanente.
  useEffect(() => {
    const el = scrollRef.current, contentBox = contentRef.current;
    if (!el || !contentBox || rankingHuertos.length <= 4) return;
    let paused = false, targetHeight = contentBox.offsetHeight;
    const refreshHeight = () => { targetHeight = contentBox.offsetHeight || targetHeight; };
    const timer = setInterval(() => {
      if (paused || document.hidden || !el.isConnected || !contentBox.isConnected || targetHeight <= 0) return;
      const next = el.scrollTop + 0.8;
      el.scrollTop = next >= targetHeight ? next - targetHeight : next;
    }, 45);
    const pause = () => { paused = true; }, play = () => { paused = false; };
    const onVisibility = () => { if (!document.hidden) refreshHeight(); };
    el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', play);
    el.addEventListener('touchstart', pause, { passive: true }); el.addEventListener('touchend', play);
    window.addEventListener('resize', refreshHeight); document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      el.removeEventListener('mouseenter', pause); el.removeEventListener('mouseleave', play);
      el.removeEventListener('touchstart', pause); el.removeEventListener('touchend', play);
      window.removeEventListener('resize', refreshHeight); document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rankingHuertos]);
  const exportadorasDisponibles = [...new Set(allInspecciones.map(p => String(p.exportadora || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const variedadesDisponibles = [...new Set(allInspecciones
    .filter(p => !filtroExportadora || String(p.exportadora || '') === filtroExportadora)
    .map(p => String(p.variedad || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const diasConProcesosFiltrados = [...new Set(allInspecciones
    .filter(p => (!filtroExportadora || String(p.exportadora || '') === filtroExportadora) && (!filtroVariedad || String(p.variedad || '') === filtroVariedad))
    .map(p => getLocalYYYYMMDD(p.createdAt || p.fecha)).filter(Boolean))];
  const seriesDefectosEvolucion = [
    { key: 'sinPedicelo', nombre: 'Sin pedicelo', color: '#EA580C', tooltipColor: '#F97316', duracion: 850, chipBg: 'rgba(249,115,22,0.06)', chipBorder: 'rgba(249,115,22,0.24)', dotHalo: 'rgba(249,115,22,0.15)', shadow: 'rgba(249,115,22,0.18)' },
    { key: 'machucon', nombre: 'Machucón', color: '#BE123C', tooltipColor: '#E11D48', duracion: 950, chipBg: 'rgba(190,18,60,0.06)', chipBorder: 'rgba(190,18,60,0.24)', dotHalo: 'rgba(190,18,60,0.14)', shadow: 'rgba(190,18,60,0.16)' },
    { key: 'frutaBlanda', nombre: 'Fruta blanda', color: '#2563EB', tooltipColor: '#2563EB', duracion: 1050, gradientId: 'gradFrutaBlanda', gradientStart: '#60A5FA', gradientEnd: '#1D4ED8', labelColor: '#1E3A8A', chipBg: 'rgba(37,99,235,0.06)', chipBorder: 'rgba(37,99,235,0.22)', dotHalo: 'rgba(37,99,235,0.14)', shadow: 'rgba(37,99,235,0.16)' },
    { key: 'partiduraAgua', nombre: 'Partidura por agua', color: '#0D9488', tooltipColor: '#0D9488', duracion: 1150, chipBg: 'rgba(13,148,136,0.06)', chipBorder: 'rgba(13,148,136,0.24)', dotHalo: 'rgba(13,148,136,0.14)', shadow: 'rgba(13,148,136,0.16)' },
    { key: 'pitting', nombre: 'Pitting', color: '#7C3AED', tooltipColor: '#8B5CF6', duracion: 1250, gradientId: 'gradPitting', gradientStart: '#A78BFA', gradientEnd: '#6D28D9', labelColor: '#5B21B6', chipBg: 'rgba(124,58,237,0.06)', chipBorder: 'rgba(124,58,237,0.24)', dotHalo: 'rgba(124,58,237,0.14)', shadow: 'rgba(124,58,237,0.16)', strokeDasharray: '6 5' }
  ];
  const seriesDefectosMap = seriesDefectosEvolucion.reduce((acc, item) => { acc[item.key] = item; return acc; }, {});
  const seriesDefectosVisiblesLista = seriesDefectosEvolucion.filter(item => seriesDefectosVisibles[item.key]);
  const defectosValoresVisibles = evolucionDefectos.flatMap(fila => seriesDefectosVisiblesLista
    .map(item => Number(fila?.[item.key]))
    .filter(value => Number.isFinite(value) && value >= 0));
  const maxDefectoVisible = defectosValoresVisibles.length ? Math.max(...defectosValoresVisibles) : 0;
  const dominioMaxDefectos = (() => {
    if (maxDefectoVisible <= 0.5) return 1;
    if (maxDefectoVisible <= 3) return Math.min(3, redondearPasoSuperior(maxDefectoVisible * 1.18, 0.5));
    return redondearPasoSuperior(maxDefectoVisible * 1.12, 0.5);
  })();
  const ticksDefectos = ticksPorDominio(dominioMaxDefectos, 0.5);
  const toggleVisibilidadSerieDefecto = key => {
    setSeriesDefectosVisibles(prev => {
      const activos = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activos === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
    if (defectoSeleccion === key && seriesDefectosVisibles[key]) setDefectoSeleccion(null);
    if (defectoHover === key && seriesDefectosVisibles[key]) setDefectoHover(null);
  };
  const semanaPicoDefectos = evolucionDefectos.reduce((best, fila) => {
    const visibleValues = seriesDefectosVisiblesLista.map(item => Number(fila?.[item.key]) || 0);
    const filaMax = visibleValues.length ? Math.max(...visibleValues) : 0;
    if (!best || filaMax > best.value) return { label: fila.weekName, value: filaMax };
    return best;
  }, null)?.label || null;
  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{customStyles}</style>
      <div className="flex items-center justify-between bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onAbrirMenu} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu className="w-5 h-5" /></button>
          <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#E96008]"/><h1 className="text-[13px] sm:text-[14px] lg:text-[15px] font-black text-slate-800 tracking-tight">Resumen de calidad histórico de temporada</h1></div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-lg"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative z-10">
        <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 lg:px-8 pt-2 md:pt-3 lg:pt-4 pb-4 md:pb-6 lg:pb-8 space-y-4 md:space-y-6">
          {/* CONTROLES SUPERIORES: FILTROS A LA IZQUIERDA Y RANGO A LA DERECHA */}
          <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-start relative z-40 mb-2 pb-3 gap-4 lg:gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-end gap-3 pt-0.5 w-full lg:w-auto">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Exportadora</span>
                <select value={filtroExportadora} onChange={(e) => { setFiltroExportadora(e.target.value); setFiltroVariedad(''); }} className="w-full sm:w-[180px] h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-colors shadow-sm">
                  <option value="">Todas</option>
                  {exportadorasDisponibles.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </label>
              <div className="hidden sm:block h-[45px] w-px bg-slate-200/90 mt-1"></div>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Variedad</span>
                <select value={filtroVariedad} onChange={(e) => setFiltroVariedad(e.target.value)} className="w-full sm:w-[165px] h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 outline-none focus:border-slate-400 transition-colors shadow-sm">
                  <option value="">Todas</option>
                  {variedadesDisponibles.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                </select>
              </label>
            </div>
            {fechasDisponibles.length > 0 && (
              <div className="flex flex-col w-full sm:w-[360px] lg:w-[330px] shrink-0 lg:ml-auto">
                <div className="flex justify-between items-center mb-1 gap-2">
                  <CustomDatePicker align="left" dateStr={fechasDisponibles[rangoIndices[0]]} minDateStr={fechasDisponibles[0]} maxDateStr={fechasDisponibles[rangoIndices[1]]} onChange={(val) => { let idx = fechasDisponibles.findIndex(d=>d>=val); if(idx===-1)idx=0; setRangoIndices([Math.min(idx, rangoIndices[1]), rangoIndices[1]]); }} diasConProcesos={diasConProcesosFiltrados}/>
                  <CustomDatePicker align="right" dateStr={fechasDisponibles[rangoIndices[1]]} minDateStr={fechasDisponibles[rangoIndices[0]]} maxDateStr={fechasDisponibles[fechasDisponibles.length - 1]} onChange={(val) => { let idx = [...fechasDisponibles].reverse().findIndex(d=>d<=val); idx = idx===-1 ? fechasDisponibles.length-1 : fechasDisponibles.length-1-idx; setRangoIndices([rangoIndices[0], Math.max(idx, rangoIndices[0])]); }} diasConProcesos={diasConProcesosFiltrados}/>
                </div>
                <div className="relative h-[14px] flex items-center px-2 mt-1">
                  <div className="absolute left-0 right-0 h-[2px] bg-slate-200/80 rounded-full mx-2"></div>
                  <div className="absolute h-[2px] bg-[#f87171] rounded-full mx-2" style={{ left: `${(rangoIndices[0] / (fechasDisponibles.length - 1 || 1)) * 100}%`, width: `${((rangoIndices[1] - rangoIndices[0]) / (fechasDisponibles.length - 1 || 1)) * 100}%` }}></div>
                  <input type="range" min="0" max={fechasDisponibles.length - 1} value={rangoIndices[0]} onChange={(e) => setRangoIndices([Math.min(Number(e.target.value), rangoIndices[1]), rangoIndices[1]])} className="dual-range-input z-10" />
                  <input type="range" min="0" max={fechasDisponibles.length - 1} value={rangoIndices[1]} onChange={(e) => setRangoIndices([rangoIndices[0], Math.max(Number(e.target.value), rangoIndices[0])])} className="dual-range-input z-20" />
                </div>
                <div className="relative h-5 mt-[-2px] mx-2">
                  {semanasVisibles.map((s, idx) => (
                    <div key={idx} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${s.pct}%` }}>
                      <div className="w-[3px] h-[3px] rounded-full bg-slate-400 mb-0"></div>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-700 whitespace-nowrap tracking-normal">Sem {s.week}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* ================= SECCIÓN 1: KPIs CON NUEVOS TÍTULOS ================= */}
          <div key={`kpis-${animacionId}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4 relative z-10">
            <div className="kpi-card animate-fade-in delay-1 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm flex flex-col justify-center min-h-[108px] xl:h-[108px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-3 left-4">PROCESOS INSPECCIONADOS</p>
              <p className="text-[34px] font-black text-slate-800 mt-4 text-center">{procesosAnim.formatted}</p>
            </div>
            <div className="kpi-card animate-fade-in delay-2 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm flex flex-col justify-center min-h-[108px] xl:h-[108px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-3 left-4">CALIFICACIÓN PREDOMINANTE</p>
              <p className="text-[34px] font-black text-slate-800 mt-4 text-center animate-fade-in">{kpis.notaPredominante}</p>
            </div>
            <div className="kpi-card animate-fade-in delay-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm flex flex-col justify-center min-h-[108px] xl:h-[108px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-3 left-4">DEFEC. CALIDAD (PROM)</p>
              <p className="text-[34px] font-black text-slate-800 mt-4 text-center">{calidadAnim.formatted}%</p>
            </div>
            <div className="kpi-card animate-fade-in delay-4 bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm flex flex-col justify-center min-h-[108px] xl:h-[108px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-3 left-4">DEFEC. CONDICIÓN (PROM)</p>
              <p className="text-[34px] font-black text-slate-800 mt-4 text-center">{condicionAnim.formatted}%</p>
            </div>
            <div className="kpi-card animate-fade-in bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-sm flex flex-col justify-center min-h-[108px] xl:h-[108px] relative">
              <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase absolute top-3 left-5 right-4">EXPORTABLE HISTÓRICO</p>
              <p className="text-[24px] sm:text-[25px] font-black leading-none mt-6 mb-1 text-slate-800 text-center">
                {exportableAnim.formatted}%
              </p>
              <div className="w-full relative mt-0 mb-0">
                <div className="relative h-[8px] w-full overflow-visible">
                  <div className="absolute inset-0 rounded-full overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#f87171]" style={{ width: '33.3333%' }} />
                    <div className="h-full bg-gradient-to-r from-[#facc15] to-[#eab308]" style={{ width: '33.3333%' }} />
                    <div className="h-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: '33.3333%' }} />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-[1.5px] border-[#0f172a] rounded-full shadow-sm transition-all duration-500 z-10"
                    style={{ left: `calc(${posicionSegmentadaExportable(exportableAnim.raw)}% - 7px)` }} />
                </div>
                <div className="relative h-3 mt-1 text-[11px] font-bold text-[#475569]">
                  <span className="absolute left-1/3 -translate-x-1/2">80</span>
                  <span className="absolute left-2/3 -translate-x-1/2">90</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-0 text-[10px] font-black text-center uppercase">
                  <span className="text-[#ef4444]">Crítico</span>
                  <span className="text-[#ca8a04]">Regular</span>
                  <span className="text-[#059669]">Óptimo</span>
                </div>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 2: GAUGES + RANKING ================= */}
          <div key={`cumplimiento-${animacionId}`} className="grid grid-cols-12 gap-4 lg:gap-5 mt-5">
            <div className="animated-card animate-fade-in delay-1 col-span-12 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wide">CUMPLIMIENTO DE ESTÁNDARES</h3>
                <div className="flex items-center gap-6 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-700">Óptimo</span></div>
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-700">Alerta</span></div>
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-[10px] font-bold text-slate-700">Crítico</span></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 flex-1">
                <GaugeCard title="Procesos A1" value={pctA1} objText="Objetivo: ≥ 40%" colors={['#ef4444', '#f59e0b', '#10b981']} thresholds={[30, 40]} labels={['30%', '40%']} />
                <GaugeCard title="A1 + A2" value={pctA1A2} objText="Objetivo: ≥ 92%" colors={['#ef4444', '#f59e0b', '#10b981']} thresholds={[85, 92]} labels={['85%', '92%']} />
                <GaugeCard title="Objetados" value={pctObjetados} objText="Objetivo: ≤ 8%" colors={['#10b981', '#f59e0b', '#ef4444']} thresholds={[8, 15]} labels={['8%', '15%']} invertedLogic={true} />
              </div>
            </div>
            <div className="animated-card animate-fade-in delay-1 col-span-12 xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-[280px] overflow-hidden min-w-0">
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
                        <div key={`rank-${prod.rank}-${i}`} className="ranking-row animate-fade-in flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg shrink-0 hover:bg-slate-100">
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
                          <div key={`clone-${prod.rank}-${i}`} className="ranking-row animate-fade-in flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg shrink-0 hover:bg-slate-100">
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
          {/* ================= SECCIÓN 3: DISTRIBUCIÓN Y EVOLUCIONES ================= */}
          <div key={`graficos-${animacionId}`} className="grid grid-cols-12 gap-4 lg:gap-5 mt-5">
            <div className="col-span-12 lg:col-span-4 min-w-0">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow animate-fade-in delay-2 h-full">
                <h3 className="text-[14px] font-bold text-slate-900 mb-4 text-left uppercase tracking-wider">DISTRIBUCIÓN DE CALIFICACIONES</h3>
                <div className="flex-1 flex flex-col sm:flex-row items-center justify-between w-full mt-2 gap-4">
                  <div className="w-full sm:w-1/2 h-[194px] flex items-center justify-center">
                    <div className="relative w-[180px] h-[180px] flex items-center justify-center donut-container">
                      <svg className="w-full h-full -rotate-90 transform overflow-visible" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="histGradDonutA1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#10b981"/></linearGradient>
                          <linearGradient id="histGradDonutA2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#facc15"/><stop offset="100%" stopColor="#eab308"/></linearGradient>
                          <linearGradient id="histGradDonutA3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fb7185"/><stop offset="100%" stopColor="#e11d48"/></linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="44" fill="transparent" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" className="opacity-60"/>
                        <circle cx="50" cy="50" r="32" fill="transparent" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" className="opacity-60"/>
                        <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="11"/>
                        {(() => {
                          const validData = distribucionNotas.filter(d => d.displayValue > 0);
                          const total = validData.reduce((acc, d) => acc + d.displayValue, 0);
                          if (!total) return null;
                          const radius = 38, circumference = 2 * Math.PI * radius;
                          let currentOffset = 0;
                          return validData.map((item, index) => {
                            const sliceLength = (item.displayValue / total) * circumference;
                            const currentDashOffset = -currentOffset;
                            const strokeGradient = item.name === 'A1' ? 'url(#histGradDonutA1)' : item.name === 'A2' ? 'url(#histGradDonutA2)' : 'url(#histGradDonutA3)';
                            const activo = donutHover === item.name, atenuado = donutHover && !activo;
                            const element = (
                              <g key={index} onMouseEnter={() => setDonutHover(item.name)} onMouseLeave={() => setDonutHover(null)} style={{ cursor: 'pointer' }}>
                                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#ffffff" strokeWidth={activo ? 15 : 14} strokeLinecap="round" strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`} strokeDashoffset={currentDashOffset} className="donut-gap" opacity={atenuado ? .5 : 1}/>
                                <circle cx="50" cy="50" r="38" fill="transparent" stroke={strokeGradient} strokeWidth={activo ? 13 : 11} strokeLinecap="round" strokeDasharray={`${svgMounted ? sliceLength : 0} ${circumference}`} strokeDashoffset={currentDashOffset} className="donut-arc" opacity={atenuado ? .42 : 1}/>
                              </g>
                            );
                            currentOffset += sliceLength;
                            return element;
                          });
                        })()}
                      </svg>
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2 flex flex-col gap-4 sm:pl-6 sm:border-l border-slate-100">
                    {distribucionNotas.map((item, idx) => {
                      const activo = donutHover === item.name, atenuado = donutHover && !activo;
                      return (
                        <div key={idx} onMouseEnter={() => setDonutHover(item.name)} onMouseLeave={() => setDonutHover(null)} className={`flex items-center justify-between w-full rounded-lg px-2 py-1.5 -mx-2 transition-all duration-200 cursor-default ${activo ? 'bg-slate-50 scale-[1.025] shadow-sm' : ''} ${atenuado ? 'opacity-45' : 'opacity-100'}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full transition-transform ${activo ? 'scale-125' : ''}`} style={{ backgroundColor: item.color }}></div>
                            <span className="text-[13px] font-normal text-slate-500"><strong className="font-bold text-slate-900">{item.name}</strong> ({item.descripcion})</span>
                          </div>
                          <span className="text-[15px] font-bold text-slate-900">{item.displayValue.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="animated-card animate-fade-in delay-2 col-span-12 lg:col-span-8 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col relative self-start">
              <h3 className="text-[14px] font-black text-slate-800 mb-2 uppercase tracking-wide">EVOLUCIÓN CALIFICACIONES</h3>
              <div className="w-full h-[230px] mt-1 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucionNotas} margin={{ top: 36, right: 18, left: -8, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="weekName" axisLine={false} tickLine={false} padding={{ left: 18, right: 18 }} tick={(props) => {
                      const { x, y, payload } = props;
                      const item = evolucionNotas[payload.index];
                      const esPrimero = payload.index === 0;
                      const esUltimo = payload.index === evolucionNotas.length - 1;
                      const ajusteX = esPrimero ? 12 : esUltimo ? -12 : 0;
                      return (
                        <g transform={`translate(${x + ajusteX},${y})`}>
                          <text x={0} y={20} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700}>{payload.value}</text>
                          <text x={0} y={37} textAnchor="middle" fill="#64748B" fontSize={10.5} fontWeight={400}>{formatearRangoSemana(item?.dateText)}</text>
                        </g>
                      );
                    }} />
                    <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} width={44} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} content={() => null} />
                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{ position: 'absolute', bottom: -20, left: 0, width: '100%' }} content={() => (
                      <div className="flex items-center justify-center gap-5">
                        {[{ name: 'A1', color: '#16A34A' }, { name: 'A2', color: '#EAB308' }, { name: 'A3', color: '#DC2626' }].map(item => {
                          const activo = evolucionActiva === item.name, atenuado = evolucionActiva && !activo;
                          return (
                            <button type="button" key={item.name} onClick={() => setEvolucionSeleccion(prev => prev === item.name ? null : item.name)} onMouseEnter={() => setEvolucionHover(item.name)} onMouseLeave={() => setEvolucionHover(null)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${activo ? 'bg-slate-50 scale-105 shadow-sm' : ''} ${atenuado ? 'opacity-30' : 'opacity-100'}`} aria-pressed={evolucionSeleccion === item.name}>
                              <span className={`w-3 h-3 rounded-full transition-transform duration-200 ${activo ? 'scale-125' : ''}`} style={{ backgroundColor: item.color }} />
                              <span className="text-[12px] font-bold" style={{ color: item.color }}>{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )} />
                    <Line connectNulls type="monotone" dataKey="A1" name="A1" stroke="#16A34A" strokeWidth={evolucionActiva === 'A1' ? 4 : 3} strokeOpacity={evolucionActiva && evolucionActiva !== 'A1' ? 0.2 : 1} dot={(props) => <PuntoEvolucion {...props} color="#16A34A" labelColor="#166534" seleccionado={evolucionSeleccion === 'A1'} mostrarEtiqueta={evolucionActiva === 'A1'} atenuado={!!(evolucionActiva && evolucionActiva !== 'A1')} onClick={() => setEvolucionSeleccion(prev => prev === 'A1' ? null : 'A1')} onMouseEnter={() => setEvolucionHover('A1')} onMouseLeave={() => setEvolucionHover(null)} />} activeDot={<CustomActiveDotA1 />} onClick={() => setEvolucionSeleccion(prev => prev === 'A1' ? null : 'A1')} onMouseEnter={() => setEvolucionHover('A1')} onMouseLeave={() => setEvolucionHover(null)} style={{ cursor: 'pointer', transition: 'opacity .25s ease, stroke-width .25s ease' }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                    <Line connectNulls type="monotone" dataKey="A2" name="A2" stroke="#EAB308" strokeWidth={evolucionActiva === 'A2' ? 4 : 3} strokeOpacity={evolucionActiva && evolucionActiva !== 'A2' ? 0.2 : 1} dot={(props) => <PuntoEvolucion {...props} color="#CA8A04" labelColor="#854D0E" seleccionado={evolucionSeleccion === 'A2'} mostrarEtiqueta={evolucionActiva === 'A2'} atenuado={!!(evolucionActiva && evolucionActiva !== 'A2')} onClick={() => setEvolucionSeleccion(prev => prev === 'A2' ? null : 'A2')} onMouseEnter={() => setEvolucionHover('A2')} onMouseLeave={() => setEvolucionHover(null)} />} activeDot={<CustomActiveDotA2 />} onClick={() => setEvolucionSeleccion(prev => prev === 'A2' ? null : 'A2')} onMouseEnter={() => setEvolucionHover('A2')} onMouseLeave={() => setEvolucionHover(null)} style={{ cursor: 'pointer', transition: 'opacity .25s ease, stroke-width .25s ease' }} isAnimationActive animationDuration={1050} animationEasing="ease-out" />
                    <Line connectNulls type="monotone" dataKey="A3" name="A3" stroke="#DC2626" strokeWidth={evolucionActiva === 'A3' ? 4 : 3} strokeOpacity={evolucionActiva && evolucionActiva !== 'A3' ? 0.2 : 1} dot={(props) => <PuntoEvolucion {...props} color="#DC2626" labelColor="#991B1B" seleccionado={evolucionSeleccion === 'A3'} mostrarEtiqueta={evolucionActiva === 'A3'} atenuado={!!(evolucionActiva && evolucionActiva !== 'A3')} onClick={() => setEvolucionSeleccion(prev => prev === 'A3' ? null : 'A3')} onMouseEnter={() => setEvolucionHover('A3')} onMouseLeave={() => setEvolucionHover(null)} />} activeDot={<CustomActiveDotA3 />} onClick={() => setEvolucionSeleccion(prev => prev === 'A3' ? null : 'A3')} onMouseEnter={() => setEvolucionHover('A3')} onMouseLeave={() => setEvolucionHover(null)} style={{ cursor: 'pointer', transition: 'opacity .25s ease, stroke-width .25s ease' }} isAnimationActive animationDuration={1200} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 3B: EVOLUCIÓN DEFECTOS + EXPORTABLE ================= */}
          <div key={`evoluciones-extra-${animacionId}`} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 mt-5 items-stretch">
            <div className="animated-card animate-fade-in delay-3 bg-white border border-slate-200 rounded-[24px] p-3 sm:p-4 shadow-sm flex flex-col min-w-0 overflow-hidden h-full">
              <div className="flex items-center mb-2 px-1">
                <h3 className="text-[13px] sm:text-[14px] font-black text-slate-800 uppercase tracking-wide">EVOLUCIÓN DE DEFECTOS</h3>
              </div>
              <div className="w-full h-[250px] sm:h-[265px] rounded-[18px] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,.6),rgba(255,255,255,0))]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucionDefectos} margin={{ top: 24, right: 8, left: -8, bottom: 42 }}>
                    <defs>
                      <linearGradient id="gradFrutaBlanda" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#60A5FA"/><stop offset="55%" stopColor="#2563EB"/><stop offset="100%" stopColor="#1D4ED8"/></linearGradient>
                      <linearGradient id="gradPitting" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#A78BFA"/><stop offset="55%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#6D28D9"/></linearGradient>
                      <linearGradient id="areaSinPedicelo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(234,88,12,0.30)" stopOpacity={0.32} />
                        <stop offset="75%" stopColor="rgba(234,88,12,0.10)" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="rgba(234,88,12,0.00)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#DCE6F1" />
                    <XAxis
                      dataKey="weekName"
                      axisLine={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                      tickLine={false}
                      interval={0}
                      padding={{ left: 6, right: 6 }}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const item = evolucionDefectos[payload.index];
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={20} textAnchor="middle" fill="#0F172A" fontSize={12} fontWeight={700}>{payload.value}</text>
                            <text x={0} y={37} textAnchor="middle" fill="#64748B" fontSize={10.5} fontWeight={400}>{formatearRangoSemana(item?.dateText)}</text>
                          </g>
                        );
                      }}
                    />
                    <YAxis domain={[0, dominioMaxDefectos]} ticks={ticksDefectos} axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Tooltip
                      cursor={{ stroke: '#CBD5E1', strokeWidth: 1.2, strokeDasharray: '4 4' }}
                      content={<TooltipEvolucionDefectos seriesMap={seriesDefectosMap} semanaPico={semanaPicoDefectos} />}
                    />
                    <Area
                      type="monotone"
                      dataKey="sinPedicelo"
                      stroke="none"
                      fill="url(#areaSinPedicelo)"
                      fillOpacity={seriesDefectosVisibles.sinPedicelo ? (defectoActivo && defectoActivo !== 'sinPedicelo' ? 0.08 : 1) : 0}
                      isAnimationActive
                      animationDuration={900}
                      hide={!seriesDefectosVisibles.sinPedicelo}
                    />
                    {seriesDefectosEvolucion.map(item => {
                      const activo = defectoActivo === item.key;
                      const atenuado = defectoActivo && !activo;
                      return (
                        <Line
                          key={item.key}
                          hide={!seriesDefectosVisibles[item.key]}
                          connectNulls
                          type="monotone"
                          dataKey={item.key}
                          name={item.nombre}
                          stroke={item.gradientId ? `url(#${item.gradientId})` : item.color}
                          strokeWidth={activo ? 4 : 3}
                          strokeOpacity={atenuado ? 0.18 : 1}
                          strokeDasharray={item.strokeDasharray}
                          dot={(props) => (
                            <PuntoEvolucion
                              {...props}
                              color={item.color}
                              labelColor={item.labelColor || item.color}
                              seleccionado={defectoSeleccion === item.key}
                              mostrarEtiqueta={defectoActivo === item.key}
                              decimales={2}
                              offsetY={-14}
                              atenuado={!!atenuado}
                              onClick={() => setDefectoSeleccion(prev => prev === item.key ? null : item.key)}
                              onMouseEnter={() => setDefectoHover(item.key)}
                              onMouseLeave={() => setDefectoHover(null)}
                            />
                          )}
                          activeDot={{ r: 7, fill: item.color, stroke: '#fff', strokeWidth: 2.5 }}
                          onClick={() => setDefectoSeleccion(prev => prev === item.key ? null : item.key)}
                          onMouseEnter={() => setDefectoHover(item.key)}
                          onMouseLeave={() => setDefectoHover(null)}
                          style={{ cursor: 'pointer', transition: 'opacity .22s ease, stroke-width .22s ease' }}
                          isAnimationActive
                          animationDuration={item.duracion}
                          animationEasing="ease-out"
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-auto border-t border-slate-100 pt-2.5 px-1 min-h-[72px] flex flex-col justify-end">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5 text-center">PRINCIPALES DEFECTOS</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5 w-full">
                  {seriesDefectosEvolucion.map(item => {
                    const activo = defectoActivo === item.key || defectoSeleccion === item.key;
                    return (
                      <ChipSerieDefecto
                        key={item.key}
                        item={item}
                        activo={activo}
                        visible={!!seriesDefectosVisibles[item.key]}
                        onToggle={() => toggleVisibilidadSerieDefecto(item.key)}
                        onHoverStart={() => seriesDefectosVisibles[item.key] && setDefectoHover(item.key)}
                        onHoverEnd={() => setDefectoHover(null)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="animated-card animate-fade-in delay-4 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col min-w-0 overflow-hidden h-full">
              <div className="flex items-center mb-2 px-1">
                <h3 className="text-[13px] sm:text-[14px] font-black text-slate-800 uppercase tracking-wide">EVOLUCIÓN PORCENTAJE EXPORTABLE</h3>
              </div>
              <div className="w-full h-[250px] sm:h-[265px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evolucionExportable} margin={{ top: 24, right: 8, left: -8, bottom: 42 }} baseValue={70}>
                    <defs>
                      <linearGradient id="exportableAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#107E44" stopOpacity={0.30} />
                        <stop offset="38%" stopColor="#107E44" stopOpacity={0.19} />
                        <stop offset="72%" stopColor="#107E44" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#107E44" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="criticalAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FB7185" stopOpacity={0.11} />
                        <stop offset="42%" stopColor="#F43F5E" stopOpacity={0.17} />
                        <stop offset="100%" stopColor="#DC2626" stopOpacity={0.27} />
                      </linearGradient>
                    </defs>
                    <ReferenceArea y1={80} y2={90} fill="#FEF3C7" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />
                    <Area connectNulls type="monotone" dataKey="exportable" stroke="none" fill="url(#exportableAreaFill)" fillOpacity={1} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                    <ReferenceArea y1={70} y2={80} fill="url(#criticalAreaFill)" fillOpacity={1} stroke="none" ifOverflow="extendDomain" />
                    <CartesianGrid strokeDasharray="4 4" vertical horizontal stroke="#DCE6F1" />
                    <ReferenceLine y={90} stroke="#64748B" strokeDasharray="6 4" strokeWidth={1.6} ifOverflow="extendDomain" label={({ viewBox }) => {
                      const x = (viewBox?.x || 0) + (viewBox?.width || 0) - 88;
                      const y = (viewBox?.y || 0) - 9;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <rect x="0" y="0" width="84" height="20" rx="4" fill="#E2E8F0" />
                          <text x="42" y="13" textAnchor="middle" fill="#475569" fontSize="9.5" fontWeight="800">META: 90.0%</text>
                        </g>
                      );
                    }} />
                    <ReferenceLine y={80} stroke="#DC2626" strokeDasharray="4 4" strokeWidth={1.25} ifOverflow="extendDomain" />
                    <XAxis
                      dataKey="weekName"
                      axisLine={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                      tickLine={false}
                      interval={0}
                      padding={{ left: 6, right: 6 }}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const item = evolucionExportable[payload.index];
                        const esUltimo = payload.index === evolucionExportable.length - 1;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={20} textAnchor="middle" fill={esUltimo ? '#107E44' : '#0F172A'} fontSize={12} fontWeight={700}>{payload.value}{esUltimo ? ' (Act.)' : ''}</text>
                            <text x={0} y={37} textAnchor="middle" fill={esUltimo ? '#107E44' : '#64748B'} fontSize={10.5} fontWeight={esUltimo ? 600 : 400}>{formatearRangoSemana(item?.dateText)}</text>
                          </g>
                        );
                      }}
                    />
                    <YAxis domain={[70, 100]} ticks={[70, 80, 90, 95, 100]} axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      cursor={{ stroke: '#CBD5E1', strokeWidth: 1.4, strokeDasharray: '4 4' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 14px 34px rgba(15,23,42,.10)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)' }}
                      formatter={(value) => [value == null ? '-' : `${Number(value).toFixed(1).replace('.', ',')}%`, '% Exportable Real']}
                      labelStyle={{ fontWeight: 800, color: '#334155' }}
                    />
                    <Line
                      connectNulls
                      type="monotone"
                      dataKey="exportable"
                      name="Exportable"
                      stroke="#107E44"
                      strokeWidth={3.4}
                      dot={(props) => <PuntoExportable {...props} />}
                      activeDot={{ r: 7.5, fill: '#FFFFFF', stroke: '#107E44', strokeWidth: 3 }}
                      isAnimationActive
                      animationDuration={1000}
                      animationEasing="ease-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-auto border-t border-slate-100 pt-2.5 px-1 min-h-[72px] flex flex-col justify-end">
                <div className="h-[12px] mb-1.5" aria-hidden="true"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-[10px] sm:text-[11px] 2xl:text-[12px] font-semibold w-full">
                  <span className="inline-flex items-center justify-start xl:justify-center gap-2 text-[#374151] min-w-0"><span className="w-3 h-3 rounded-full bg-[#107E44] shrink-0" /><span className="whitespace-nowrap">% Exportable Real</span></span>
                  <span className="inline-flex items-center justify-start xl:justify-center gap-2 text-[#374151] min-w-0"><span className="w-6 border-t-2 border-dashed border-[#64748B] shrink-0" /><span className="whitespace-nowrap">Meta Objetivo (90%)</span></span>
                  <span className="inline-flex items-center justify-start xl:justify-center gap-2 text-[#B91C1C] min-w-0"><span className="w-3.5 h-3.5 rounded-[3px] border border-[#EF4444] bg-[#FEE2E2] shrink-0" /><span className="whitespace-nowrap">Alerta Crítica (&lt;80%)</span></span>
                </div>
              </div>
            </div>
          </div>
          {/* ================= SECCIÓN 4: PRINCIPALES DEFECTOS ================= */}
          <div key={`defectos-${animacionId}`} className="grid grid-cols-12 gap-5 mt-5 pb-8">
            <div className="animated-card animate-fade-in delay-3 col-span-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-[14px] font-black text-slate-800 mb-6 uppercase tracking-wide">
                PRINCIPALES DEFECTOS <span className="text-slate-400 text-[12px] font-bold capitalize tracking-normal ml-2">(Promedio del rango seleccionado)</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-x-16">
                <div>
                  <h4 className="text-[13px] font-black text-[#EA580C] mb-4 uppercase tracking-wider">CALIDAD</h4>
                  <div className="space-y-1">
                    {defectosCalidad.length > 0 ? defectosCalidad.map((d, i) => <BarraDefecto key={i} nombre={d.nombre} pct={d.pct} colorClass="bg-gradient-to-r from-orange-400 to-orange-500" />) : <p className="text-sm font-bold text-slate-300 py-4 text-center">Sin defectos</p>}
                  </div>
                </div>
                <div className="lg:border-l border-slate-100 lg:pl-16">
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
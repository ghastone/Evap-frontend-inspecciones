import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Activity, Maximize, AlertTriangle } from 'lucide-react';
const emptyData = {
  numProceso: '...', 
  huerto: 'Iniciando inspección...', 
  variedad: '...', 
  cajasEvaluadas: 0,
  exportable: 100.0, 
  pctCalidad: 0.0, 
  pctCondicion: 0.0, 
  estado: 'Evaluando', 
  calificacion: '-',
  solidos: { 
    light: { min: 0.0, max: 0.0, prom: 0.0, count: 0 }, 
    dark: { min: 0.0, max: 0.0, prom: 0.0, count: 0 } 
  },
  topCalidad: [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }],
  topCondicion: [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }]
};
function BarraTolerancia({ nombre, pct, lim1, lim2 }) {
  const pctZona1 = 100 / 3;
  const pctZona2 = 100 / 3;
  const pctZona3 = 100 / 3; 
  const fill1 = Math.min(pct, lim1);
  const fill2 = Math.max(0, Math.min(pct, lim2) - lim1);
  const fill3 = Math.max(0, pct - lim2);
  const defectosCondicionLimiteCero = ['Herida de pájaro', 'Mancha parda', 'Pudrición', 'Herida de insecto'];
  const forzarZonaAzul = lim1 === 0 && pct > 0 && defectosCondicionLimiteCero.includes(nombre);
  const wFill1 = forzarZonaAzul ? 100 : (lim1 > 0 ? (fill1 / lim1) * 100 : 0);
  const wFill2 = (lim2 - lim1) > 0 ? (fill2 / (lim2 - lim1)) * 100 : 0;
  const maxOverflow = lim2 * 0.5 || 5; 
  const wFill3 = maxOverflow > 0 ? Math.min((fill3 / maxOverflow) * 100, 100) : 100;
  let visualPct = 0;
  if (pct <= lim1) {
    visualPct = lim1 > 0 ? (pct / lim1) * pctZona1 : 0;
  } else if (pct <= lim2) {
    visualPct = pctZona1 + ((pct - lim1) / (lim2 - lim1)) * pctZona2;
  } else {
    visualPct = pctZona1 + pctZona2 + Math.min(((pct - lim2) / maxOverflow) * pctZona3, pctZona3);
  }
  const [anim, setAnim] = useState({ w1: 0, w2: 0, w3: 0, visual: 0 });
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnim({ w1: wFill1, w2: wFill2, w3: wFill3, visual: visualPct }));
    return () => cancelAnimationFrame(frame);
  }, [wFill1, wFill2, wFill3, visualPct]);
  const formatNum = (n) => n.toFixed(1).replace('.', ',');
  const transicionBarra = 'width 620ms cubic-bezier(0.16,1,0.3,1)';
  return (
    <div className="grid grid-cols-12 gap-2 h-[38px] shrink-0">
      <div className="col-span-5 h-full flex items-center pr-2" title={nombre}>
        <span className="text-[12px] lg:text-[13px] truncate leading-tight w-full font-medium text-[#475569]">
          {nombre}
        </span>
      </div>
      <div className="col-span-7 relative flex flex-col justify-center">
        <div className="relative h-[16px] w-full rounded-full overflow-hidden flex gap-[2px] bg-[#f8fafc] shadow-inner border border-[#f1f5f9]">
          <div className="bg-[#e0e7ff] h-full relative" style={{ width: `${pctZona1}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#60a5fa] to-[#3b82f6]" style={{ width: `${anim.w1}%`, transition: transicionBarra }}></div>
          </div>
          <div className="bg-[#dcfce7] h-full relative" style={{ width: `${pctZona2}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${anim.w2}%`, transition: transicionBarra }}></div>
          </div>
          <div className="bg-[#ffe4e6] h-full relative" style={{ width: `${pctZona3}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#fb7185] to-[#e11d48]" style={{ width: `${anim.w3}%`, transition: transicionBarra }}></div>
          </div>
          {pct > 0 && (
            <div 
              className="absolute top-0 left-0 h-full flex items-center justify-end pr-2" 
              style={{ width: `${anim.visual}%`, minWidth: '45px', transition: transicionBarra }}
            >
              <span className="text-white text-[10px] lg:text-[11px] font-bold leading-none drop-shadow-md z-10">
                {formatNum(pct)}%
              </span>
            </div>
          )}
        </div>
        <div className="relative h-4 mt-0.5 w-full">
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1}%`, top: '-2px' }}>
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-[#94a3b8]"></div>
            <span className="text-[9px] lg:text-[10px] font-bold text-[#94a3b8] leading-none mt-0.5">{formatNum(lim1)}%</span>
          </div>
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1 + pctZona2}%`, top: '-2px' }}>
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-[#94a3b8]"></div>
            <span className="text-[9px] lg:text-[10px] font-bold text-[#94a3b8] leading-none mt-0.5">{formatNum(lim2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function ListaDefectosInfinita({ items = [] }) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const debeDesplazar = items.length > 5;
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || !debeDesplazar) {
      if (viewport) viewport.scrollTop = 0;
      return;
    }
    let scrollAmount = 0;
    let paused = false;
    let animationFrameId;
    const step = () => {
      if (!paused && !document.hidden && viewport.isConnected && content.isConnected) {
        const targetHeight = content.offsetHeight;
        if (Math.abs(viewport.scrollTop - scrollAmount) > 2) scrollAmount = viewport.scrollTop;
        scrollAmount += 0.45;
        if (targetHeight > 0 && scrollAmount >= targetHeight) scrollAmount -= targetHeight;
        viewport.scrollTop = scrollAmount;
      }
      animationFrameId = requestAnimationFrame(step);
    };
    const pause = () => { paused = true; };
    const play = () => { paused = false; };
    viewport.addEventListener('mouseenter', pause);
    viewport.addEventListener('mouseleave', play);
    viewport.addEventListener('touchstart', pause, { passive: true });
    viewport.addEventListener('touchend', play);
    animationFrameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animationFrameId);
      viewport.removeEventListener('mouseenter', pause);
      viewport.removeEventListener('mouseleave', play);
      viewport.removeEventListener('touchstart', pause);
      viewport.removeEventListener('touchend', play);
    };
  }, [items, debeDesplazar]);
  const renderItems = (suffix = '') => (
    <div
      ref={suffix ? undefined : contentRef}
      className={debeDesplazar
        ? "flex flex-col gap-[4px] xl:gap-[10px] pb-[4px] xl:pb-[10px] w-full shrink-0"
        : "h-full flex flex-col justify-start gap-[4px] xl:gap-[10px] w-full"}
    >
      {items.map((item, index) => <BarraTolerancia key={`${item.nombre}-${index}-${suffix}`} {...item} />)}
    </div>
  );
  return (
    <div ref={viewportRef} className="h-full min-h-0 overflow-hidden w-full" style={{ scrollBehavior: 'auto' }}>
      {renderItems()}
      {debeDesplazar && renderItems('clone')}
    </div>
  );
}
export default function DashboardLiveView({ onClose, onAbrirMenu }) {
  const [datos, setDatos] = useState(emptyData);
  const [hayConexion, setHayConexion] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [errorParametros, setErrorParametros] = useState(false);
  const [animacionDatos, setAnimacionDatos] = useState(0);
  const [donutHover, setDonutHover] = useState(null);
  const parametrosRef = useRef({ calidad: [], condicion: [] });
  const firmaDatosRef = useRef('');
  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl'
    : `http://${window.location.hostname || 'localhost'}:3001`;
  const SUM_CALIDAD = 'Sumatoria de calidad';
  const SUM_CONDICION = 'Sumatoria de condición';
  const numero = valor => {
    const n = Number(String(valor ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  useEffect(() => {
    const cargarParametros = async () => {
      try {
        const res = await fetch(`${API_URL}/api/parametros`);
        if (!res.ok) throw new Error('No fue posible cargar los parámetros');
        const data = await res.json();
        parametrosRef.current = {
          calidad: Array.isArray(data.calidad) ? data.calidad : [],
          condicion: Array.isArray(data.condicion) ? data.condicion : []
        };
        setErrorParametros(false);
      } catch (err) {
        console.error('Error cargando parámetros:', err);
        setErrorParametros(true);
      }
    };
    cargarParametros();
  }, [API_URL]);
  const procesarDatosVivos = procesoDB => {
    if (!procesoDB?.numProceso) return emptyData;
    const cajas = Array.isArray(procesoDB.cajas) ? procesoDB.cajas : [];
    const snapshot = procesoDB.parametrosSnapshot;
    const parametros = snapshot?.calidad?.length && snapshot?.condicion?.length
      ? snapshot
      : parametrosRef.current;
    const calidadConfig = Array.isArray(parametros.calidad) ? parametros.calidad : [];
    const condicionConfig = Array.isArray(parametros.condicion) ? parametros.condicion : [];
    const defectosCalidad = calidadConfig.filter(p => p.nombre !== SUM_CALIDAD);
    const defectosCondicion = condicionConfig.filter(p => p.nombre !== SUM_CONDICION);
    const nombresCalidad = new Set(defectosCalidad.map(p => p.nombre));
    const nombresCondicion = new Set(defectosCondicion.map(p => p.nombre));
    const mapCalidad = new Map(calidadConfig.map(p => [p.nombre, p]));
    const mapCondicion = new Map(condicionConfig.map(p => [p.nombre, p]));
    const getLimitesCalidad = nombre => {
      const p = mapCalidad.get(nombre);
      if (!p) return null;
      const lim1 = numero(p.limAB), lim2 = numero(p.limBC);
      return lim1 === null || lim2 === null ? null : { lim1, lim2 };
    };
    const getLimitesCondicion = nombre => {
      const p = mapCondicion.get(nombre);
      if (!p) return null;
      const lim1 = numero(p.lim12), lim2 = numero(p.lim23);
      return lim1 === null || lim2 === null ? null : { lim1, lim2 };
    };
    let totalFrutos = 0, totalCal = 0, totalCond = 0;
    const lightBrix = [], darkBrix = [];
    const agregadoCal = {}, agregadoCond = {};
    cajas.forEach(c => {
      totalFrutos += parseInt(c.frutos) || 0;
      const brix = parseFloat(c.brix);
      if (Number.isFinite(brix) && brix > 0) {
        if (c.color === 'Light') lightBrix.push(brix);
        if (c.color === 'Dark') darkBrix.push(brix);
      }
      Object.entries(c.defCalidad || {}).forEach(([def, val]) => {
        if (!nombresCalidad.has(def)) return;
        const v = parseInt(val) || 0;
        totalCal += v;
        if (v > 0) agregadoCal[def] = (agregadoCal[def] || 0) + v;
      });
      Object.entries(c.defCondicion || {}).forEach(([def, val]) => {
        if (!nombresCondicion.has(def)) return;
        const v = parseInt(val) || 0;
        totalCond += v;
        if (v > 0) agregadoCond[def] = (agregadoCond[def] || 0) + v;
      });
    });
    const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
    const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
    const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;
    const calcSolidos = arr => arr.length
      ? { min: Math.min(...arr), max: Math.max(...arr), prom: arr.reduce((a, b) => a + b, 0) / arr.length, count: arr.length }
      : { min: 0, max: 0, prom: 0, count: 0 };
    const sumCal = getLimitesCalidad(SUM_CALIDAD);
    const sumCond = getLimitesCondicion(SUM_CONDICION);
    const parametrosValidos = !!sumCal && !!sumCond;
    let peorNotaCalidad = 1, peorNotaCondicion = 1;
    const evaluar = (pct, limites) => {
      if (!limites) return 1;
      if (pct > limites.lim2) return 3;
      if (pct > limites.lim1) return 2;
      return 1;
    };
    if (parametrosValidos && totalFrutos > 0) {
      peorNotaCalidad = Math.max(peorNotaCalidad, evaluar(pCal, sumCal));
      peorNotaCondicion = Math.max(peorNotaCondicion, evaluar(pCond, sumCond));
      defectosCalidad.forEach(p => {
        const pct = ((agregadoCal[p.nombre] || 0) / totalFrutos) * 100;
        peorNotaCalidad = Math.max(peorNotaCalidad, evaluar(pct, getLimitesCalidad(p.nombre)));
      });
      defectosCondicion.forEach(p => {
        const pct = ((agregadoCond[p.nombre] || 0) / totalFrutos) * 100;
        peorNotaCondicion = Math.max(peorNotaCondicion, evaluar(pct, getLimitesCondicion(p.nombre)));
      });
    }
    const califLetter = peorNotaCalidad === 3 ? 'C' : peorNotaCalidad === 2 ? 'B' : 'A';
    const califNum = String(peorNotaCondicion);
    const calificacion = parametrosValidos && totalFrutos > 0 ? `${califLetter}${califNum}` : '-';
    const estado = parametrosValidos && totalFrutos > 0
      ? (califLetter === 'C' || califNum === '3' ? 'Objetado' : 'Aprobado')
      : 'Evaluando';
    const topCalidad = defectosCalidad
      .map(p => ({ nombre: p.nombre, count: agregadoCal[p.nombre] || 0, limites: getLimitesCalidad(p.nombre) }))
      .filter(x => x.count > 0 && x.limites)
      .sort((a, b) => b.count - a.count)
      .map(x => ({ nombre: x.nombre, pct: totalFrutos ? (x.count / totalFrutos) * 100 : 0, ...x.limites }));
    const topCondicion = defectosCondicion
      .map(p => ({ nombre: p.nombre, count: agregadoCond[p.nombre] || 0, limites: getLimitesCondicion(p.nombre) }))
      .filter(x => x.count > 0 && x.limites)
      .sort((a, b) => b.count - a.count)
      .map(x => ({ nombre: x.nombre, pct: totalFrutos ? (x.count / totalFrutos) * 100 : 0, ...x.limites }));
    return {
      numProceso: procesoDB.numProceso,
      huerto: procesoDB.huerto || procesoDB.productor || 'Sin huerto',
      variedad: procesoDB.variedad || '-',
      cajasEvaluadas: cajas.length,
      exportable: pExp,
      pctCalidad: pCal,
      pctCondicion: pCond,
      estado,
      calificacion,
      solidos: { light: calcSolidos(lightBrix), dark: calcSolidos(darkBrix) },
      topCalidad: topCalidad.length ? topCalidad : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }],
      topCondicion: topCondicion.length ? topCondicion : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }]
    };
  };
  useEffect(() => {
    let isMounted = true;
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('No se pudo forzar la pantalla completa automáticamente.', err);
      }
    };
    const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    const consultarProceso = async () => {
      try {
        const [resProceso, resLive] = await Promise.all([
          fetch(`${API_URL}/api/procesos/colaborativo/activo-detalle`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/live`, { cache: 'no-store' })
        ]);
        if (!resProceso.ok) throw new Error('Error consultando proceso activo');
        const [procesoActivo, live] = await Promise.all([
          resProceso.json(),
          resLive.ok ? resLive.json() : Promise.resolve({ status: 'waiting', sessions: [] })
        ]);
        if (!isMounted) return;
        if (!procesoActivo?.numProceso || procesoActivo.status === 'waiting') { setHayConexion(false); return; }
        const cajasGuardadas = Array.isArray(procesoActivo.cajas) ? procesoActivo.cajas : [];
        const sesiones = Array.isArray(live?.sessions) ? live.sessions : (live?.numProceso ? [live] : []);
        const sesionesProceso = sesiones.filter(s => Number(s.numProceso) === Number(procesoActivo.numProceso));
        const cajasVivas = [...cajasGuardadas];
        sesionesProceso.forEach(sesion => {
          if (!sesion.cajaActual) return;
          cajasVivas.push({ ...sesion.cajaActual, _liveClientId: sesion.clientId, _enVivo: true });
        });
        const ultimaSesion = sesionesProceso.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
        const procesoVivo = {
          ...procesoActivo,
          huerto: ultimaSesion?.huerto || procesoActivo.huerto,
          productor: ultimaSesion?.productor || procesoActivo.productor,
          variedad: ultimaSesion?.variedad || procesoActivo.variedad,
          cajas: cajasVivas
        };
        const nuevosDatos = procesarDatosVivos(procesoVivo);
        const firma = JSON.stringify(nuevosDatos);
        if (firma !== firmaDatosRef.current) {
          firmaDatosRef.current = firma;
          setDatos(nuevosDatos);
          setAnimacionDatos(v => v + 1);
        }
        setHayConexion(true);
      } catch (err) {
        if (!isMounted) return;
        console.warn('Error actualizando Dashboard Live:', err);
        setHayConexion(false);
      }
    };
    enterFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    consultarProceso();
    const interval = setInterval(consultarProceso, 500);
    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [API_URL]);
  const handleMenuAction = async () => {
    if (isFullScreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(()=>{});
      }
      setIsFullScreen(false);
      if (onAbrirMenu) onAbrirMenu();
    } else {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch(e){}
      setIsFullScreen(true);
    }
  };
  if (!hayConexion) {
    return (
      <div className={`dashboard-live-root ${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-[#f8fafc] flex flex-col items-center justify-center`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          .dashboard-live-root, .dashboard-live-root * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .delay-1 { animation-delay: 0.1s; }
          .delay-2 { animation-delay: 0.2s; }
        `}</style>
        <div className="absolute top-6 left-6 flex items-center gap-3">
          <button 
            onClick={handleMenuAction} 
            title={isFullScreen ? "Mostrar menú lateral" : "Pantalla completa"}
            className="p-2.5 bg-white border border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] rounded-xl transition-all shadow-sm group"
          >
            {isFullScreen ? <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
        <Activity className="w-16 h-16 text-[#ea580c] mb-6 animate-pulse opacity-80" strokeWidth={1.5} />
        <h1 className="text-2xl md:text-3xl font-black mb-3 text-[#0f172a] text-center px-4 tracking-tight animate-fade-in-up">
          Esperando conexión en vivo...
        </h1>
        <p className="text-[#64748b] md:text-lg max-w-md text-center px-6 leading-relaxed animate-fade-in-up delay-1 opacity-0">
          Inicia la evaluación de un nuevo proceso para comenzar a visualizar las métricas consolidadas del equipo en tiempo real.
        </p>
      </div>
    );
  }
  const chartData = [
    { name: 'Exportable', value: datos.exportable, color: 'url(#colorExportable)' },
    { name: 'Calidad', value: datos.pctCalidad, color: 'url(#colorCalidad)' },
    { name: 'Condición', value: datos.pctCondicion, color: 'url(#colorCondicion)' }
  ];
  const isObjetado = datos.estado === 'Objetado';
  const isObjCalidad = typeof datos.calificacion === 'string' && datos.calificacion.includes('C');
  const isObjCondicion = typeof datos.calificacion === 'string' && datos.calificacion.includes('3');
  let motivoObj = "EXCESO DE DEFECTOS";
  if (isObjCalidad && isObjCondicion) motivoObj = "EXCESO DE DEFECTOS DE CALIDAD Y CONDICIÓN";
  else if (isObjCalidad) motivoObj = "EXCESO DE DEFECTOS DE CALIDAD";
  else if (isObjCondicion) motivoObj = "EXCESO DE DEFECTOS DE CONDICIÓN";
  const bannerStartColor = isObjetado ? "#991B1B" : "#047857"; 
  const bannerEndColor = isObjetado ? "#DC2626" : "#10b981";   
  return (
    <div className={`dashboard-live-root ${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-[#f8fafc] overflow-x-hidden overflow-y-auto md:overflow-y-hidden`} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .dashboard-live-root, .dashboard-live-root * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes liveValuePop { 0% { opacity: .45; transform: scale(.94); } 55% { opacity: 1; transform: scale(1.045); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes liveCardPulse { 0% { box-shadow: 0 1px 2px rgba(15,23,42,.04); } 45% { box-shadow: 0 8px 22px rgba(16,185,129,.11); } 100% { box-shadow: 0 1px 2px rgba(15,23,42,.04); } }
        .animate-fade-in-up { animation: fadeInUp .42s cubic-bezier(.16,1,.3,1) forwards; opacity: 0; }
        .live-value-pop { animation: liveValuePop .46s cubic-bezier(.16,1,.3,1) both; }
        .live-card-update { animation: liveCardPulse .58s ease-out both; }
        .live-card { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        .live-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -10px rgba(15,23,42,.20); }
        .delay-1 { animation-delay: .05s; }
        .delay-2 { animation-delay: .10s; }
        .delay-3 { animation-delay: .15s; }
        @media (max-width: 767px) {
          .live-card:hover { transform: none; }
        }
        @media (min-width: 1800px) {
          .dashboard-live-root .live-card { max-width: 100%; }
        }
      `}</style>
      <div className={`w-full min-h-full md:h-full flex flex-col py-3 sm:py-4 px-2 sm:px-4 lg:px-6 xl:px-8 min-h-0 ${isObjetado ? 'gap-[8px] xl:gap-[11px]' : 'gap-[11px] xl:gap-[14px]'}`}>
        {errorParametros && !datos.numProceso?.startsWith('...') && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2 text-xs font-bold shrink-0">
            No fue posible actualizar el catálogo de parámetros. Se utilizará el snapshot guardado del proceso si está disponible.
          </div>
        )}
        {/* BANNER SUPERIOR */}
        <div className="live-card bg-white rounded-[20px] shadow-sm h-[45px] xl:h-[45px] flex items-center justify-between overflow-hidden relative shrink-0 transition-colors duration-500 w-full border border-[#e2e8f0] animate-fade-in-up">
          <svg className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none" preserveAspectRatio="none" viewBox="0 0 1000 100">
            <defs>
              <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={bannerStartColor} className="transition-all duration-500" />
                <stop offset="100%" stopColor={bannerEndColor} className="transition-all duration-500" />
              </linearGradient>
              <pattern id="dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="rgba(255,255,255,0.15)" />
              </pattern>
            </defs>
            <rect width="1000" height="100" fill="#ffffff" />
            <path d="M0,0 H590 C 520,0 490,100 420,100 H0 Z" fill="#e2e8f0" className="transition-all duration-500 opacity-50"/>
            <path d="M0,0 H570 C 500,0 470,100 400,100 H0 Z" fill="#cbd5e1" className="transition-all duration-500 opacity-50"/>
            <path d="M0,0 H550 C 480,0 450,100 380,100 H0 Z" fill="url(#mainGrad)" className="transition-all duration-500"/>
            <path d="M400,0 H550 C 515,0 500,50 465,50 H400 Z" fill="url(#dots)"/>
          </svg>
          <div className="relative z-10 flex items-center pl-3 sm:pl-5 text-white h-full">
            <button 
              onClick={handleMenuAction}
              title={isFullScreen ? "Abrir menú lateral" : "Pantalla completa"}
              className="mr-3 xl:mr-5 flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all shadow-sm group shrink-0"
            >
              {isFullScreen ? (
                <ArrowLeft className="w-4 h-4 xl:w-5 xl:h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
              ) : (
                <Maximize className="w-4 h-4 xl:w-5 xl:h-5 text-white" />
              )}
            </button>
            <div className={`w-[5px] xl:w-[6px] h-[26px] xl:h-[32px] rounded-[3px] shrink-0 mr-3 xl:mr-5 transition-colors duration-500 ${isObjetado ? 'bg-white' : 'bg-[#10b981]'}`}></div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[18px] xl:text-[24px] font-semibold leading-none tracking-tight flex items-center gap-1.5">
                QC Evap <span className={`${isObjetado ? 'text-white' : 'text-[#10b981]'} font-medium transition-colors duration-500`}>+</span>
              </h1>
              <p className="text-[11px] xl:text-[13px] font-medium leading-none mt-1 xl:mt-0.5 opacity-80 hidden sm:block tracking-wide uppercase">
                Inspección de producto terminado en vivo
              </p>
            </div>
          </div>
          <div className="relative z-10 pr-6 sm:pr-10 flex items-center gap-4 sm:gap-6 h-full">
            <img 
              src="/Logo_goldanda.png" 
              alt="Gold Anda" 
              className="h-[24px] xl:h-[30px] w-auto object-contain hidden sm:block ml-2 brightness-0 invert opacity-90" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
        {/* ALERTA DE RECHAZO */}
        {isObjetado && (
          <div className="flex bg-white border border-[#e11d48] rounded-xl overflow-hidden shrink-0 shadow-sm h-[34px] xl:h-[40px] w-full animate-fade-in-up delay-1">
            <div className="bg-[#e11d48] w-[60px] xl:w-[70px] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 xl:w-5 xl:h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex items-center px-4 md:px-6 flex-1 bg-[#fff1f2]">
              <div className="w-[3px] h-[20px] bg-[#fecaca] mr-4 rounded-full"></div>
              <span className="text-[#e11d48] text-[12px] md:text-[13px] xl:text-[14px] font-bold tracking-wide">
                <strong className="font-black uppercase mr-1">Atención:</strong> EL LOTE ESTÁ SIENDO OBJETADO DEBIDO A {motivoObj}.
              </span>
            </div>
          </div>
        )}
        {/* TARJETAS DE INFORMACIÓN DEL PROCESO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[8px] lg:gap-[10px] shrink-0 w-full animate-fade-in-up delay-1">
          {[
            { label: 'N° proceso', val: datos.numProceso },
            { label: 'Huerto', val: datos.huerto },
            { label: 'Variedad', val: datos.variedad },
            { label: 'Cajas inspeccionadas', val: datos.cajasEvaluadas }
          ].map((item, i) => (
            <div key={i} className={`live-card bg-white rounded-2xl shadow-sm border border-[#e2e8f0] min-h-[62px] lg:h-[58px] px-4 flex flex-col justify-center transition-colors w-full relative overflow-hidden group`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${isObjetado ? 'bg-[#e11d48]' : 'bg-[#ea580c]'}`}></div>
              <div className="pl-2">
                <p className="text-[11px] lg:text-[12px] font-bold text-[#64748b] mb-0.5 leading-none uppercase tracking-wider">{item.label}</p>
                <p className="text-[16px] lg:text-[17px] font-black text-[#0f172a] truncate leading-tight">{item.val}</p>
              </div>
            </div>
          ))}
        </div>
        {/* SECCIÓN CENTRAL: DONA, ESTADO, BRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[8px] xl:gap-[10px] shrink-0 w-full xl:h-[178px] animate-fade-in-up delay-2">
          {/* DONA Y PORCENTAJES GLOBALES */}
          <div className="live-card col-span-12 lg:col-span-5 bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 xl:px-6 py-2 flex flex-col justify-between h-full overflow-hidden">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-1 tracking-wider uppercase">Resumen general</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3 xl:gap-5 flex-1 justify-center w-full">
              <div className="w-[130px] h-[130px] xl:w-[140px] xl:h-[140px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="colorExportable" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" /></linearGradient>
                      <linearGradient id="colorCalidad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#facc15" /><stop offset="100%" stopColor="#eab308" /></linearGradient>
                      <linearGradient id="colorCondicion" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#e11d48" /></linearGradient>
                    </defs>
                    <Pie key={`pie-live-${animacionDatos}`}
                      data={chartData} cx="50%" cy="50%" 
                      innerRadius="74%" outerRadius="100%" 
                      startAngle={90} endAngle={-270} 
                      cornerRadius={15} paddingAngle={-8} 
                      dataKey="value" stroke="none"
                      animationDuration={720}
                      animationBegin={0}
                      isAnimationActive
                    >
                      {chartData.map((entry, index) => {
                        const activo = donutHover === entry.name;
                        const atenuado = donutHover && !activo;
                        return <Cell key={`cell-${index}`} fill={entry.color} opacity={atenuado ? 0.28 : 1} stroke="none" onMouseEnter={() => setDonutHover(entry.name)} onMouseLeave={() => setDonutHover(null)} style={{ outline: 'none', cursor: 'pointer', transition: 'opacity .2s ease, filter .2s ease', filter: activo ? 'brightness(1.07) drop-shadow(0 3px 7px rgba(15,23,42,.16))' : 'none' }} />;
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 w-full flex flex-col justify-center">
                {[
                  { name: 'Exportable', value: datos.exportable, color: '#10b981', key: 'exp' },
                  { name: 'Calidad', value: datos.pctCalidad, color: '#eab308', key: 'cal' },
                  { name: 'Condición', value: datos.pctCondicion, color: '#e11d48', key: 'cond' }
                ].map(item => {
                  const activo = donutHover === item.name, atenuado = donutHover && !activo;
                  return (
                    <div key={item.name} onMouseEnter={() => setDonutHover(item.name)} onMouseLeave={() => setDonutHover(null)} className={`bg-[#f8fafc] p-2 rounded-xl border border-[#f1f5f9] flex items-center justify-between cursor-default transition-all duration-200 ${activo ? 'scale-[1.025] shadow-sm bg-white' : ''} ${atenuado ? 'opacity-35' : 'opacity-100'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full shadow-sm transition-transform duration-200 ${activo ? 'scale-125' : ''}`} style={{ backgroundColor: item.color }}></div>
                        <span className="text-[12px] xl:text-[14px] font-bold text-[#334155]">{item.name}</span>
                      </div>
                      <span key={`${item.key}-${animacionDatos}`} className="live-value-pop text-[13px] xl:text-[15px] font-black" style={{ color: item.color }}>{item.value.toFixed(1).replace('.', ',')}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* ESTADO Y CALIFICACIÓN */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-[8px] w-full h-full min-h-0">
            <div className={`live-card rounded-2xl shadow-sm border px-5 py-2 flex-1 flex flex-col transition-colors ${isObjetado ? 'bg-[#fff1f2] border-[#fecaca]' : 'bg-white border-[#e2e8f0]'}`}>
              <div className="flex justify-between items-center w-full mb-1">
                <h3 className={`text-[12px] xl:text-[13px] font-bold tracking-wider uppercase ${isObjetado ? 'text-[#e11d48]' : 'text-[#64748b]'}`}>Estado</h3>
                <span className={`px-2 py-0.5 rounded-md text-[9px] xl:text-[10px] font-black flex items-center gap-1.5 shadow-sm border tracking-wider ${isObjetado ? 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]' : 'bg-[#dcfce7] text-[#047857] border-[#86efac]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isObjetado ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`}></span> LIVE
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span key={`estado-${animacionDatos}`} className={`live-value-pop text-[22px] xl:text-[28px] font-black tracking-tight ${isObjetado ? 'text-[#e11d48]' : 'text-[#10b981]'}`}>
                  {datos.estado}
                </span>
              </div>
            </div>
            <div className="live-card bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 py-2 flex-1 flex flex-col w-full">
              <h3 className="text-[12px] xl:text-[13px] font-bold text-[#64748b] tracking-wider uppercase mb-1">Calificación</h3>
              <div className="flex-1 flex items-center justify-center">
                <span key={`nota-${animacionDatos}`} className={`live-value-pop text-[28px] xl:text-[36px] font-black ${isObjetado ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>{datos.calificacion}</span>
              </div>
            </div>
          </div>
          {/* SÓLIDOS SOLUBLES */}
          <div className="live-card col-span-12 sm:col-span-6 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-4 xl:p-3 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-2 xl:mb-1 shrink-0 text-left uppercase tracking-wider">Sólidos solubles</h3>
            <div className="flex-1 grid grid-cols-2 divide-x divide-[#f1f5f9] text-center items-stretch">
              {/* Columna Light */}
              <div className="flex flex-col h-full items-center justify-between px-2 xl:px-4">
                <div className="flex flex-col items-center w-full">
                  <span className="text-[12px] xl:text-[14px] font-bold text-[#64748b] mb-1.5">Light</span>
                  <div className="flex gap-4 xl:gap-6 justify-center mb-1 w-full">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.light.min || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-8 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-[#EBA0A8] to-[#D77A86]"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.light.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-8 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-[#EBA0A8] to-[#D77A86]"></div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Min / Max</span>
                </div>
                <div className="flex flex-col items-center mt-2 xl:mt-1">
                  <span key={`brix-l-${animacionDatos}`} className="live-value-pop text-[22px] xl:text-[24px] font-black text-[#D06C79] leading-none">{Number(datos.solidos.light.prom || 0).toFixed(1).replace('.', ',')}</span>
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Promedio</span>
                </div>
              </div>
              {/* Columna Dark */}
              <div className="flex flex-col h-full items-center justify-between px-2 xl:px-4">
                <div className="flex flex-col items-center w-full">
                  <span className="text-[12px] xl:text-[14px] font-bold text-[#64748b] mb-1.5">Dark</span>
                  <div className="flex gap-4 xl:gap-6 justify-center mb-1 w-full">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.dark.min || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-8 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-[#8A2747] to-[#5A1430]"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.dark.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-8 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-[#8A2747] to-[#5A1430]"></div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Min / Max</span>
                </div>
                <div className="flex flex-col items-center mt-2 xl:mt-1">
                  <span key={`brix-d-${animacionDatos}`} className="live-value-pop text-[22px] xl:text-[24px] font-black text-[#7A1F3D] leading-none">{Number(datos.solidos.dark.prom || 0).toFixed(1).replace('.', ',')}</span>
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Promedio</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* BARRAS DE DEFECTOS AL INFERIOR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[8px] xl:gap-[14px] flex-1 min-h-0 w-full mt-1 animate-fade-in-up delay-3">
          <div className="live-card bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 lg:px-6 pt-3 pb-3 flex flex-col w-full min-h-0 overflow-hidden">
            <h3 className="text-[13px] font-bold text-[#0f172a] mb-2 shrink-0 uppercase tracking-wider">Principales defectos de calidad</h3>
            <div className="w-full flex-1 min-h-0 flex items-stretch overflow-hidden">
              <ListaDefectosInfinita items={datos.topCalidad} />
            </div>
            <div className="flex items-center justify-center gap-6 lg:gap-8 mt-auto pt-1.5 border-t border-[#f1f5f9] w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div> A</span>
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div> B</span>
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#e11d48]"></div> C</span>
            </div>
          </div>
          <div className="live-card bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 lg:px-6 pt-3 pb-3 flex flex-col w-full min-h-0 overflow-hidden">
            <h3 className="text-[13px] font-bold text-[#0f172a] mb-2 shrink-0 uppercase tracking-wider">Principales defectos de condición</h3>
            <div className="w-full flex-1 min-h-0 flex items-stretch overflow-hidden">
              <ListaDefectosInfinita items={datos.topCondicion} />
            </div>
            <div className="flex items-center justify-center gap-6 lg:gap-8 mt-auto pt-1.5 border-t border-[#f1f5f9] w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div> 1</span>
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div> 2</span>
              <span className="flex items-center gap-1.5 text-[12px] lg:text-[13px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#e11d48]"></div> 3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

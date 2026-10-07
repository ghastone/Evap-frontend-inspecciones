import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Activity, Maximize } from 'lucide-react';

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
  const pctZona1 = 45; 
  const pctZona2 = 35; 
  const pctZona3 = 20; 

  const fill1 = Math.min(pct, lim1);
  const fill2 = Math.max(0, Math.min(pct, lim2) - lim1);
  const fill3 = Math.max(0, pct - lim2);

  const wFill1 = lim1 > 0 ? (fill1 / lim1) * 100 : 0;
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

  const formatNum = (n) => n.toFixed(1).replace('.', ',');

  return (
    <div className="grid grid-cols-12 gap-2 py-0.5 xl:py-1">
      <div className="col-span-5 h-[16px] xl:h-[22px] flex items-center pr-2" title={nombre}>
        <span className="text-[13px] xl:text-[14px] truncate leading-tight w-full font-medium text-[#475569]">
          {nombre}
        </span>
      </div>
      
      <div className="col-span-7 relative flex flex-col justify-center">
        <div className="relative h-[16px] xl:h-[20px] w-full rounded-full overflow-hidden flex gap-[2px] bg-[#f8fafc] shadow-inner border border-[#f1f5f9]">
          <div className="bg-[#e0e7ff] h-full relative" style={{ width: `${pctZona1}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#60a5fa] to-[#3b82f6]" style={{ width: `${wFill1}%` }}></div>
          </div>
          <div className="bg-[#dcfce7] h-full relative" style={{ width: `${pctZona2}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${wFill2}%` }}></div>
          </div>
          <div className="bg-[#ffe4e6] h-full relative" style={{ width: `${pctZona3}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#fb7185] to-[#e11d48]" style={{ width: `${wFill3}%` }}></div>
          </div>

          {pct > 0 && (
            <div 
              className="absolute top-0 left-0 h-full flex items-center justify-end pr-2" 
              style={{ width: `${visualPct}%`, minWidth: '45px' }}
            >
              <span className="text-white text-[11px] xl:text-[13px] font-bold leading-none drop-shadow-md z-10">
                {formatNum(pct)}%
              </span>
            </div>
          )}
        </div>

        <div className="relative h-4 xl:h-5 mt-0.5 w-full">
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1}%`, top: '-2px' }}>
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-[#94a3b8]"></div>
            <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] leading-none mt-0.5">{formatNum(lim1)}%</span>
          </div>
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1 + pctZona2}%`, top: '-2px' }}>
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-[#94a3b8]"></div>
            <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] leading-none mt-0.5">{formatNum(lim2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLiveView({ onClose, onAbrirMenu }) {
  const [datos, setDatos] = useState(emptyData);
  const [hayConexion, setHayConexion] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);

  const limitesCalidadRef = useRef([]);
  const limitesCondicionRef = useRef([]);

  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  useEffect(() => {
    fetch(`${API_URL}/api/parametros`)
      .then(res => res.json())
      .then(data => {
        if (data.calidad) limitesCalidadRef.current = data.calidad;
        if (data.condicion) limitesCondicionRef.current = data.condicion;
      })
      .catch(err => console.error("Error cargando límites de tolerancia:", err));
  }, [API_URL]);

  // 🔥 NUEVA LÓGICA: Recibe la info del proceso y las cajas fusionadas instantáneas
  const procesarDatosVivos = (procesoInfo, cajasConsolidadas) => {
    if (!procesoInfo || !procesoInfo.numProceso) return emptyData;
    
    const cajas = cajasConsolidadas || [];
    
    if (cajas.length === 0) {
      return { ...emptyData, numProceso: procesoInfo.numProceso, huerto: procesoInfo.productor || procesoInfo.huerto, variedad: procesoInfo.variedad };
    }
    
    let totalFrutos = 0, totalCal = 0, totalCond = 0, sumatoriaCalSinCalibres = 0;
    let lightBrix = [], darkBrix = [];
    let agregadoCal = {}, agregadoCond = {};
    
    cajas.forEach(c => {
      const f = parseInt(c.frutos) || 0;
      totalFrutos += f;
      
      if (c.brix && parseFloat(c.brix) > 0) {
        if (c.color === 'Light') lightBrix.push(parseFloat(c.brix));
        if (c.color === 'Dark') darkBrix.push(parseFloat(c.brix));
      }
      
      Object.entries(c.defCalidad || {}).forEach(([def, val]) => {
        const v = parseInt(val) || 0;
        totalCal += v;
        if (v > 0) agregadoCal[def] = (agregadoCal[def] || 0) + v;
        
        // Excluimos Bajo Calibre y Sobre Calibre de la sumatoria
        if (def !== 'Bajo calibre' && def !== 'Sobre calibre') {
          sumatoriaCalSinCalibres += v;
        }
      });
      
      Object.entries(c.defCondicion || {}).forEach(([def, val]) => {
        const v = parseInt(val) || 0;
        totalCond += v;
        if (v > 0) agregadoCond[def] = (agregadoCond[def] || 0) + v;
      });
    });
    
    const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
    const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
    const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;
    
    const calcSolidos = (arr) => {
      if (arr.length === 0) return { min: 0, max: 0, prom: 0, count: 0 };
      return { min: Math.min(...arr), max: Math.max(...arr), prom: arr.reduce((a,b)=>a+b,0)/arr.length, count: arr.length };
    };

    const getLimitesCalidad = (nombre) => {
      const param = limitesCalidadRef.current.find(p => p.nombre === nombre);
      if (param) return { lim1: parseFloat(param.limAB) || 0, lim2: parseFloat(param.limBC) || 0 };
      
      if (nombre === 'Sumatoria de calidad') return { lim1: 15, lim2: 20 };
      if (nombre === 'Falta de color') return { lim1: 10, lim2: 20 };
      if (nombre === 'Fruta sin pedicelo') return { lim1: 8, lim2: 16 };
      if (nombre === 'Russet') return { lim1: 6, lim2: 15 };
      if (nombre === 'Frutos deformes / dobles') return { lim1: 3, lim2: 6 };
      return { lim1: 5, lim2: 10 }; 
    };

    const getLimitesCondicion = (nombre) => {
      const param = limitesCondicionRef.current.find(p => p.nombre === nombre);
      if (param) return { lim1: parseFloat(param.lim12) || 0, lim2: parseFloat(param.lim23) || 0 };
      
      if (nombre === 'Sumatoria de condición') return { lim1: 10, lim2: 15 };
      if (['Pudrición', 'Mancha parda', 'Herida de insecto', 'Herida de pájaro'].includes(nombre)) return { lim1: 0, lim2: 0.4 };
      if (['Herida abierta'].includes(nombre)) return { lim1: 1, lim2: 3 };
      if (['Partidura por agua', 'Virosis'].includes(nombre)) return { lim1: 2, lim2: 4 };
      if (['Partiduras laterales', 'Partiduras apicales', 'Machucón', 'Pitting severo', 'Fruta blanda', 'Sobre madurez', 'Quemado de sol'].includes(nombre)) return { lim1: 2, lim2: 5 };
      if (nombre === 'Desgarro pedicelar') return { lim1: 3, lim2: 6 };
      if (['Medias lunas', 'Pitting leve', 'Piel de lagarto'].includes(nombre)) return { lim1: 5, lim2: 8 };

      return { lim1: 1, lim2: 2 };
    };
    
    // ============================================
    // EVALUADOR MULTIVARIABLE (INCLUYE SUMATORIAS)
    // ============================================
    let peorNotaCalidad = 1; 
    let peorNotaCondicion = 1; 

    // Calidad individual
    Object.entries(agregadoCal).forEach(([def, count]) => {
      const pct = (count / totalFrutos) * 100;
      const lims = getLimitesCalidad(def);
      if (pct > lims.lim2) peorNotaCalidad = Math.max(peorNotaCalidad, 3);
      else if (pct > lims.lim1) peorNotaCalidad = Math.max(peorNotaCalidad, 2);
    });

    // Sumatoria de Calidad global
    const pctSumCal = totalFrutos ? (sumatoriaCalSinCalibres / totalFrutos) * 100 : 0;
    const limSumCal = getLimitesCalidad('Sumatoria de calidad');
    if (pctSumCal > limSumCal.lim2) peorNotaCalidad = Math.max(peorNotaCalidad, 3);
    else if (pctSumCal > limSumCal.lim1) peorNotaCalidad = Math.max(peorNotaCalidad, 2);

    // Condición individual
    Object.entries(agregadoCond).forEach(([def, count]) => {
      const pct = (count / totalFrutos) * 100;
      const lims = getLimitesCondicion(def);
      if (pct > lims.lim2) peorNotaCondicion = Math.max(peorNotaCondicion, 3);
      else if (pct > lims.lim1) peorNotaCondicion = Math.max(peorNotaCondicion, 2);
    });

    // Sumatoria de Condición global
    const pctSumCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
    const limSumCond = getLimitesCondicion('Sumatoria de condición');
    if (pctSumCond > limSumCond.lim2) peorNotaCondicion = Math.max(peorNotaCondicion, 3);
    else if (pctSumCond > limSumCond.lim1) peorNotaCondicion = Math.max(peorNotaCondicion, 2);

    let califLetter = peorNotaCalidad === 3 ? 'C' : peorNotaCalidad === 2 ? 'B' : 'A';
    let califNum = peorNotaCondicion.toString();
    const calificacion = `${califLetter}${califNum}`;
    const estado = (califLetter === 'C' || califNum === '3') ? 'Objetado' : 'Aprobado';

    // Generar Arrays limpios
    const topCalidad = Object.entries(agregadoCal).sort((a,b)=>b[1]-a[1]).map(([nombre, count]) => {
      const limites = getLimitesCalidad(nombre);
      return { nombre, pct: (count / totalFrutos) * 100, lim1: limites.lim1, lim2: limites.lim2 };
    });
      
    const topCondicion = Object.entries(agregadoCond).sort((a,b)=>b[1]-a[1]).map(([nombre, count]) => {
      const limites = getLimitesCondicion(nombre);
      return { nombre, pct: (count / totalFrutos) * 100, lim1: limites.lim1, lim2: limites.lim2 };
    });
      
    return {
      numProceso: procesoInfo.numProceso, huerto: procesoInfo.productor || procesoInfo.huerto, variedad: procesoInfo.variedad,
      cajasEvaluadas: cajas.length, exportable: pExp, pctCalidad: pCal, pctCondicion: pCond,
      estado, calificacion,
      solidos: { light: calcSolidos(lightBrix), dark: calcSolidos(darkBrix) },
      topCalidad: topCalidad.length ? topCalidad : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }],
      topCondicion: topCondicion.length ? topCondicion : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }]
    };
  };

  useEffect(() => {
    let isMounted = true; 

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("No se pudo forzar la pantalla completa automáticamente.", err);
      }
    };
    enterFullscreen();

    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // 🔥 SINCRONIZACIÓN PERFECTA A 1000ms: Combinamos DB (verdad absoluta) + Live (tecleo en tiempo real)
    const fetchData = async () => {
      if (!isMounted) return;
      try {
        const [resLive, resDb] = await Promise.all([
          fetch(`${API_URL}/api/live`),
          fetch(`${API_URL}/api/inspecciones`)
        ]);
        
        const liveData = await resLive.json();
        const dbData = await resDb.json();

        if (!isMounted) return;

        const procesoDB = Array.isArray(dbData) ? dbData.find(p => p.estado === 'En curso') : null;

        if (procesoDB) {
          // Extraemos cajas confirmadas de la base de datos (0 retraso colaborativo)
          let cajasConsolidadas = [...(procesoDB.cajas || [])];

          // Si hay alguien escribiendo en vivo y la caja actual tiene frutos, la sumamos visualmente
          if (liveData && String(liveData.numProceso) === String(procesoDB.numProceso) && liveData.cajaActual && liveData.cajaActual.frutos) {
            // Solo la sumamos si no existe ya en la BD (para no duplicarla en el milisegundo exacto en que se guarda)
            const existeEnDB = cajasConsolidadas.some(c => String(c.numCaja) === String(liveData.cajaActual.numCaja));
            if (!existeEnDB) {
              cajasConsolidadas.push(liveData.cajaActual);
            }
          }

          setDatos(procesarDatosVivos(procesoDB, cajasConsolidadas));
          setHayConexion(true);
        } else if (liveData && liveData.numProceso) {
          // Fallback en caso de que recién inicie y la BD esté vacía
          let cajasConsolidadas = [...(liveData.cajas || [])];
          if (liveData.cajaActual && liveData.cajaActual.frutos) cajasConsolidadas.push(liveData.cajaActual);
          
          setDatos(procesarDatosVivos(liveData, cajasConsolidadas));
          setHayConexion(true);
        } else {
          setHayConexion(false);
        }
      } catch (error) {
        if (!isMounted) return;
        console.log('Buscando conexión con servidor...');
        setHayConexion(false);
      }
    };

    const interval = setInterval(fetchData, 1000); 

    return () => {
      isMounted = false; 
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
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
      <div className={`${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-[#f8fafc] flex flex-col items-center justify-center`} style={{ fontFamily: "'Inter', sans-serif" }}>
        
        <style>{`
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

  const bannerStartColor = isObjetado ? "#991B1B" : "#0f172a"; 
  const bannerEndColor = isObjetado ? "#DC2626" : "#1e293b";   

  return (
    <div className={`${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-[#f8fafc] overflow-hidden`} style={{ fontFamily: "'Inter', sans-serif" }}>
      
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .delay-1 { animation-delay: 0.05s; }
        .delay-2 { animation-delay: 0.1s; }
        .delay-3 { animation-delay: 0.15s; }
      `}</style>

      <div className={`w-full h-full flex flex-col py-4 px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 min-h-0 ${isObjetado ? 'gap-[8px] xl:gap-[11px]' : 'gap-[11px] xl:gap-[14px]'}`}>
        
        {/* BANNER SUPERIOR */}
        <div className="bg-white rounded-[20px] shadow-sm h-[45px] xl:h-[56px] flex items-center justify-between overflow-hidden relative shrink-0 transition-colors duration-500 w-full border border-[#e2e8f0] animate-fade-in-up">
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

            <div className="w-[5px] xl:w-[6px] h-[26px] xl:h-[32px] bg-[#10b981] rounded-[3px] shrink-0 mr-3 xl:mr-5"></div>
            
            <div className="flex flex-col justify-center">
              <h1 className="text-[18px] xl:text-[24px] font-black leading-none tracking-tight flex items-center gap-1.5">
                QC Evap <span className="text-[#10b981] font-bold">+</span>
              </h1>
              <p className="text-[11px] xl:text-[13px] font-medium leading-none mt-1.5 opacity-80 hidden sm:block tracking-wide uppercase">
                Análisis Colaborativo en Vivo
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px] xl:gap-[14px] shrink-0 w-full animate-fade-in-up delay-1">
          {[
            { label: 'N° proceso', val: datos.numProceso },
            { label: 'Huerto', val: datos.huerto },
            { label: 'Variedad', val: datos.variedad },
            { label: 'Cajas equipo', val: datos.cajasEvaluadas }
          ].map((item, i) => (
            <div key={i} className={`bg-white rounded-2xl shadow-sm border border-[#e2e8f0] py-2.5 xl:py-3.5 px-4 xl:px-5 flex flex-col justify-center transition-colors w-full relative overflow-hidden group`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${isObjetado ? 'bg-[#e11d48]' : 'bg-[#ea580c]'}`}></div>
              <div className="pl-2">
                <p className="text-[12px] xl:text-[13px] font-bold text-[#64748b] mb-0.5 leading-none uppercase tracking-wider">{item.label}</p>
                <p className="text-[17px] xl:text-[19px] font-black text-[#0f172a] truncate leading-tight">{item.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SECCIÓN CENTRAL: DONA, ESTADO, BRIX */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[8px] xl:gap-[14px] shrink-0 w-full animate-fade-in-up delay-2">
          
          {/* DONA Y PORCENTAJES GLOBALES */}
          <div className="col-span-12 md:col-span-5 bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 xl:px-6 py-2 xl:py-3 flex flex-col justify-between">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-1 tracking-wider uppercase">Resumen general</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3 xl:gap-5 flex-1 justify-center w-full">
              
              <div className="w-[105px] h-[105px] xl:w-[130px] xl:h-[130px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="colorExportable" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" /></linearGradient>
                      <linearGradient id="colorCalidad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#facc15" /><stop offset="100%" stopColor="#eab308" /></linearGradient>
                      <linearGradient id="colorCondicion" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#e11d48" /></linearGradient>
                    </defs>
                    <Pie 
                      data={chartData} cx="50%" cy="50%" 
                      innerRadius="74%" outerRadius="100%" 
                      startAngle={90} endAngle={-270} 
                      cornerRadius={15} paddingAngle={-8} 
                      dataKey="value" stroke="none"
                      animationDuration={1500}
                    >
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[20px] xl:text-[24px] font-black text-[#0f172a] tracking-tight">{datos.exportable.toFixed(1).replace('.', ',')}%</span>
                </div>
              </div>

              <div className="space-y-2 flex-1 w-full flex flex-col justify-center">
                <div className="bg-[#f8fafc] p-2 rounded-xl border border-[#f1f5f9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-[#10b981] shadow-sm"></div>
                    <span className="text-[12px] xl:text-[14px] font-bold text-[#334155]">Exportable</span>
                  </div>
                  <span className="text-[13px] xl:text-[15px] font-black text-[#10b981]">{datos.exportable.toFixed(1).replace('.', ',')}%</span>
                </div>
                <div className="bg-[#f8fafc] p-2 rounded-xl border border-[#f1f5f9] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-[#eab308] shadow-sm"></div>
                    <span className="text-[12px] xl:text-[14px] font-bold text-[#334155]">Calidad</span>
                  </div>
                  <span className="text-[13px] xl:text-[15px] font-black text-[#eab308]">{datos.pctCalidad.toFixed(1).replace('.', ',')}%</span>
                </div>
                <div className="bg-[#f8fafc] p-2 rounded-xl border border-[#f1f5f9] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-[#e11d48] shadow-sm"></div>
                    <span className="text-[12px] xl:text-[14px] font-bold text-[#334155]">Condición</span>
                  </div>
                  <span className="text-[13px] xl:text-[15px] font-black text-[#e11d48]">{datos.pctCondicion.toFixed(1).replace('.', ',')}%</span>
                </div>
              </div>
              
            </div>
          </div>

          {/* ESTADO Y CALIFICACIÓN */}
          <div className="col-span-12 sm:col-span-6 md:col-span-3 flex flex-col gap-[8px] xl:gap-[14px] w-full">
            <div className={`rounded-2xl shadow-sm border px-5 py-2 flex-1 flex flex-col transition-colors ${isObjetado ? 'bg-[#fff1f2] border-[#fecaca]' : 'bg-white border-[#e2e8f0]'}`}>
              <div className="flex justify-between items-center w-full mb-1">
                <h3 className={`text-[12px] xl:text-[13px] font-bold tracking-wider uppercase ${isObjetado ? 'text-[#e11d48]' : 'text-[#64748b]'}`}>Estado</h3>
                <span className={`px-2 py-0.5 rounded-md text-[9px] xl:text-[10px] font-black flex items-center gap-1.5 shadow-sm border tracking-wider ${isObjetado ? 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]' : 'bg-[#dcfce7] text-[#047857] border-[#86efac]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isObjetado ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`}></span> LIVE
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-[22px] xl:text-[28px] font-black tracking-tight ${isObjetado ? 'text-[#e11d48]' : 'text-[#10b981]'}`}>
                  {datos.estado}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 py-2 flex-1 flex flex-col w-full">
              <h3 className="text-[12px] xl:text-[13px] font-bold text-[#64748b] tracking-wider uppercase mb-1">Calificación</h3>
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-[28px] xl:text-[36px] font-black ${isObjetado ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>{datos.calificacion}</span>
              </div>
            </div>
          </div>

          {/* SÓLIDOS SOLUBLES */}
          <div className="col-span-12 sm:col-span-6 md:col-span-4 bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-4 flex flex-col w-full">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-2 shrink-0 text-left uppercase tracking-wider">Sólidos solubles</h3>
            
            <div className="flex-1 grid grid-cols-2 divide-x divide-[#f1f5f9] text-center items-stretch">
              
              {/* Columna Light */}
              <div className="flex flex-col h-full items-center justify-between px-2 xl:px-4">
                <div className="flex flex-col items-center w-full">
                  <span className="text-[12px] xl:text-[14px] font-bold text-[#64748b] mb-1.5">Light</span>
                  
                  <div className="flex gap-4 xl:gap-6 justify-center mb-1 w-full">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.light.min || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-10 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.light.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-10 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
                      </div>
                    </div>
                  </div>
                  
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Min / Max</span>
                </div>

                <div className="flex flex-col items-center mt-2">
                  <span className="text-[22px] xl:text-[26px] font-black text-[#3b82f6] leading-none">{Number(datos.solidos.light.prom || 0).toFixed(1).replace('.', ',')}</span>
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
                      <div className="w-3 h-8 xl:w-3.5 xl:h-10 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-[#34d399] to-[#10b981]"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[16px] xl:text-[18px] font-black text-[#0f172a] leading-none">{Number(datos.solidos.dark.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-8 xl:w-3.5 xl:h-10 rounded-full bg-[#f1f5f9] overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-[#34d399] to-[#10b981]"></div>
                      </div>
                    </div>
                  </div>
                  
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Min / Max</span>
                </div>

                <div className="flex flex-col items-center mt-2">
                  <span className="text-[22px] xl:text-[26px] font-black text-[#10b981] leading-none">{Number(datos.solidos.dark.prom || 0).toFixed(1).replace('.', ',')}</span>
                  <span className="text-[10px] xl:text-[11px] font-bold text-[#94a3b8] mt-1 uppercase tracking-wider">Promedio</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* BARRAS DE DEFECTOS AL INFERIOR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] xl:gap-[14px] flex-1 min-h-0 w-full mt-1 animate-fade-in-up delay-3">
          
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 xl:px-8 pt-4 pb-3 flex flex-col w-full min-h-0">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-3 shrink-0 uppercase tracking-wider">Principales defectos de calidad</h3>
            <div className="flex flex-col gap-[4px] xl:gap-[8px] w-full flex-1 min-h-0 justify-start">
              {datos.topCalidad.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}
            </div>
            <div className="flex items-center justify-center gap-6 xl:gap-10 mt-auto pt-3 border-t border-[#f1f5f9] w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div> A (Leve)</span>
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div> B (Moderado)</span>
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#e11d48]"></div> C (Severo)</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] px-5 xl:px-8 pt-4 pb-3 flex flex-col w-full min-h-0">
            <h3 className="text-[13px] xl:text-[14px] font-bold text-[#0f172a] mb-3 shrink-0 uppercase tracking-wider">Principales defectos de condición</h3>
            <div className="flex flex-col gap-[4px] xl:gap-[8px] w-full flex-1 min-h-0 justify-start">
              {datos.topCondicion.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}
            </div>
            <div className="flex items-center justify-center gap-6 xl:gap-10 mt-auto pt-3 border-t border-[#f1f5f9] w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div> 1 (Leve)</span>
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div> 2 (Moderado)</span>
              <span className="flex items-center gap-1.5 text-[12px] xl:text-[14px] font-bold text-[#334155]"><div className="w-2.5 h-2.5 rounded-full bg-[#e11d48]"></div> 3 (Severo)</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
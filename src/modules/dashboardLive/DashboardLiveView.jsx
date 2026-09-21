import React, { useState, useEffect } from 'react';
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
        <span className="text-[14px] xl:text-[18px] font-medium text-slate-700 truncate leading-tight w-full">
          {nombre}
        </span>
      </div>
      
      <div className="col-span-7 relative flex flex-col justify-center">
        <div className="relative h-[16px] xl:h-[22px] w-full rounded-full overflow-hidden flex gap-[2px] bg-white shadow-inner">
          <div className="bg-[#E0E7FF] h-full relative" style={{ width: `${pctZona1}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB]" style={{ width: `${wFill1}%` }}></div>
          </div>
          <div className="bg-[#D1FAE5] h-full relative" style={{ width: `${pctZona2}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#22C55E] to-[#16A34A]" style={{ width: `${wFill2}%` }}></div>
          </div>
          <div className="bg-[#FFE4E6] h-full relative" style={{ width: `${pctZona3}%` }}>
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#EF4444] to-[#DC2626]" style={{ width: `${wFill3}%` }}></div>
          </div>

          {pct > 0 && (
            <div 
              className="absolute top-0 left-0 h-full flex items-center justify-end pr-2" 
              style={{ width: `${visualPct}%`, minWidth: '45px' }}
            >
              <span className="text-white text-[12px] xl:text-[14px] font-bold leading-none drop-shadow-md z-10">
                {formatNum(pct)}%
              </span>
            </div>
          )}
        </div>

        <div className="relative h-5 xl:h-6 mt-0.5 xl:mt-1 w-full">
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1}%`, top: '-4px' }}>
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-slate-700"></div>
            <span className="text-[11px] xl:text-[13px] font-bold text-slate-400 leading-none mt-1">{formatNum(lim1)}%</span>
          </div>
          <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pctZona1 + pctZona2}%`, top: '-4px' }}>
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-slate-700"></div>
            <span className="text-[11px] xl:text-[13px] font-bold text-slate-400 leading-none mt-1">{formatNum(lim2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Añadimos onAbrirMenu como posible prop enviada desde tu Layout principal
export default function DashboardLiveView({ onClose, onAbrirMenu }) {
  const [datos, setDatos] = useState(emptyData);
  const [hayConexion, setHayConexion] = useState(false);
  
  // Estado para controlar la pantalla completa y el menú lateral
  const [isFullScreen, setIsFullScreen] = useState(true);

  const procesarDatosVivos = (rawData) => {
    if (!rawData || !rawData.numProceso) return emptyData;
    
    const cajas = [...(rawData.cajas || [])];
    if (rawData.cajaActual && rawData.cajaActual.frutos) {
      cajas.push(rawData.cajaActual);
    }
    
    if (cajas.length === 0) {
      return { ...emptyData, numProceso: rawData.numProceso, huerto: rawData.productor, variedad: rawData.variedad };
    }
    
    let totalFrutos = 0, totalCal = 0, totalCond = 0;
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
    
    let califLetter = pCal <= 5 ? 'A' : pCal <= 10 ? 'B' : 'C';
    let califNum = pCond <= 5 ? '1' : pCond <= 10 ? '2' : '3';
    const calificacion = `${califLetter}${califNum}`;
    
    const estado = (califLetter === 'C' || califNum === '3') ? 'Objetado' : 'Aprobado';
    
    const calcSolidos = (arr) => {
      if (arr.length === 0) return { min: 0, max: 0, prom: 0, count: 0 };
      return { min: Math.min(...arr), max: Math.max(...arr), prom: arr.reduce((a,b)=>a+b,0)/arr.length, count: arr.length };
    };
    
    const topCalidad = Object.entries(agregadoCal).sort((a,b)=>b[1]-a[1]).map(([nombre, count]) => ({
      nombre, pct: (count / totalFrutos) * 100, lim1: 5, lim2: 10 
    }));
      
    const topCondicion = Object.entries(agregadoCond).sort((a,b)=>b[1]-a[1]).map(([nombre, count]) => ({
      nombre, pct: (count / totalFrutos) * 100, lim1: 5, lim2: 10
    }));
      
    return {
      numProceso: rawData.numProceso, huerto: rawData.productor, variedad: rawData.variedad,
      cajasEvaluadas: cajas.length, exportable: pExp, pctCalidad: pCal, pctCondicion: pCond,
      estado, calificacion,
      solidos: { light: calcSolidos(lightBrix), dark: calcSolidos(darkBrix) },
      topCalidad: topCalidad.length ? topCalidad : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }],
      topCondicion: topCondicion.length ? topCondicion : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }]
    };
  };

  useEffect(() => {
    // 1. Intentar forzar pantalla completa al montar
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

    // 2. Sincronizar el estado si el usuario presiona "ESC" en el teclado
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // 3. Intervalo de consulta al servidor
    const interval = setInterval(() => {
      fetch('http://localhost:3001/api/live')
        .then(res => res.json())
        .then(rawData => {
          if (rawData && rawData.numProceso) {
            setDatos(procesarDatosVivos(rawData));
            setHayConexion(true);
          } else {
            setHayConexion(false);
          }
        })
        .catch(err => {
          console.log('Buscando conexión con servidor...');
          setHayConexion(false);
        });
    }, 1500); 

    // Al desmontar, salir de pantalla completa
    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Lógica del botón de la flecha izquierda
  const handleMenuAction = async () => {
    if (isFullScreen) {
      // Si está en pantalla completa, salimos y mostramos el menú
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(()=>{});
      }
      setIsFullScreen(false);
      // Disparamos la apertura del menú si existe la función (útil para móviles)
      if (onAbrirMenu) onAbrirMenu();
    } else {
      // Si no está en pantalla completa, forzamos el modo inmersivo
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
      <div className={`${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-slate-50 flex flex-col items-center justify-center animate-fade-in`}>
        {/* BOTÓN PARA REVELAR MENÚ LATERAL EN ESTADO DE CARGA */}
        <div className="absolute top-6 left-6 flex items-center gap-3">
          <button 
            onClick={handleMenuAction} 
            title={isFullScreen ? "Mostrar menú lateral" : "Pantalla completa"}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-xl transition-all shadow-sm group"
          >
            {isFullScreen ? <ArrowLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" /> : <Maximize className="w-6 h-6" />}
          </button>
        </div>

        <Activity className="w-16 h-16 text-[#E96008] mb-6 animate-pulse" />
        
        {/* TEXTOS ACTUALIZADOS */}
        <h1 className="text-2xl md:text-4xl font-bold mb-3 text-slate-800 text-center px-4">
          Esperando conexión en vivo...
        </h1>
        <p className="text-slate-500 md:text-lg max-w-lg text-center px-6 leading-relaxed">
          Inicia la inspección de un nuevo proceso para comenzar a visualizar EVAP en tiempo real.
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

  const bannerStartColor = isObjetado ? "#991B1B" : "#0A7A40"; 
  const bannerEndColor = isObjetado ? "#DC2626" : "#139E59";   

  return (
    // CONTENEDOR DINÁMICO: Si isFullScreen es true, cubre la pantalla (fixed inset-0). Si no, permite ver el menú lateral al natural.
    <div className={`${isFullScreen ? "fixed inset-0 z-[100] h-screen" : "h-full relative"} w-full bg-slate-50 overflow-hidden animate-fade-in`}>
      <div className={`w-full h-full flex flex-col py-4 px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 min-h-0 ${isObjetado ? 'gap-[8px] xl:gap-[11px]' : 'gap-[11px] xl:gap-[14px]'}`} style={{ fontFamily: '"Segoe UI", sans-serif' }}>
        
        {/* BANNER SUPERIOR */}
        <div className="bg-white rounded-[20px] xl:rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.04)] h-[45px] xl:h-[56px] flex items-center justify-between overflow-hidden relative shrink-0 transition-colors duration-500 w-full border border-slate-100">
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

            <path d="M0,0 H590 C 520,0 490,100 420,100 H0 Z" fill="#E6F2EB" className="transition-all duration-500"/>
            <path d="M0,0 H570 C 500,0 470,100 400,100 H0 Z" fill="#C5E3D2" className="transition-all duration-500"/>
            <path d="M0,0 H550 C 480,0 450,100 380,100 H0 Z" fill="url(#mainGrad)" className="transition-all duration-500"/>

            <path d="M400,0 H550 C 515,0 500,50 465,50 H400 Z" fill="url(#dots)"/>
          </svg>

          <div className="relative z-10 flex items-center pl-3 sm:pl-5 text-white h-full">
            
            {/* NUEVO BOTÓN TIPO FLECHA (Izquierda del Banner) */}
            <button 
              onClick={handleMenuAction}
              title={isFullScreen ? "Abrir menú lateral" : "Pantalla completa"}
              className="mr-3 xl:mr-5 flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl transition-all shadow-sm group shrink-0"
            >
              {isFullScreen ? (
                <ArrowLeft className="w-4 h-4 xl:w-5 xl:h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
              ) : (
                <Maximize className="w-4 h-4 xl:w-5 xl:h-5 text-white" />
              )}
            </button>

            <div className="w-[5px] xl:w-[6px] h-[26px] xl:h-[32px] bg-white rounded-[3px] shrink-0 mr-3 xl:mr-5"></div>
            
            <div className="flex flex-col justify-center">
              <h1 className="text-[20px] xl:text-[28px] font-semibold leading-none tracking-wide flex items-center gap-2">
                QC Evap <span className="font-medium">+</span>
              </h1>
              <p className="text-[13px] xl:text-[15px] font-light leading-none mt-1.5 opacity-95 hidden sm:block">
                (Evaluación de análisis de procesos)
              </p>
            </div>
          </div>

          <div className="relative z-10 pr-6 sm:pr-10 flex items-center gap-4 sm:gap-6 h-full">
            <img 
              src="/Logo_goldanda.png" 
              alt="Gold Anda" 
              className="h-[26px] xl:h-[34px] w-auto object-contain hidden sm:block ml-2" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div className="hidden lg:flex items-center gap-2 ml-2 xl:ml-4">
              <div className="w-[2px] h-[20px] xl:h-[24px] rounded-full transition-colors duration-500" style={{ backgroundColor: bannerEndColor }}></div>
              <div className="grid grid-cols-3 gap-[4px] opacity-40">
                {Array.from({length: 15}).map((_, i) => (
                  <div key={i} className="w-[2px] h-[2px] xl:w-[3px] xl:h-[3px] rounded-full" style={{ backgroundColor: bannerEndColor }}></div>
                ))}
              </div>
            </div>
            
          </div>
        </div>

        {/* ALERTA DE RECHAZO */}
        {isObjetado && (
          <div className="flex bg-white border-2 border-[#C53030] rounded-full overflow-hidden shrink-0 shadow-md h-[34px] xl:h-[40px] w-full animate-fade-in">
            <div className="bg-[#C53030] w-[70px] xl:w-[80px] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 xl:w-6 xl:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex items-center px-4 md:px-6 flex-1 bg-red-50">
              <div className="w-[3px] h-[20px] bg-red-300 mr-4 rounded-full"></div>
              <span className="text-[#C53030] text-[12px] md:text-[14px] xl:text-[16px] tracking-wide">
                <strong className="font-black uppercase">Atención:</strong> ESTE PROCESO ESTÁ SIENDO OBJETADO DEBIDO A {motivoObj}.
              </span>
            </div>
          </div>
        )}

        {/* TARJETAS DE INFORMACIÓN DEL PROCESO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px] xl:gap-[14px] shrink-0 w-full">
          {[
            { label: 'N° proceso', val: datos.numProceso },
            { label: 'Huerto', val: datos.huerto },
            { label: 'Variedad', val: datos.variedad },
            { label: 'Cajas evaluadas', val: datos.cajasEvaluadas }
          ].map((item, i) => (
            <div key={i} className={`bg-white rounded-2xl shadow-sm border border-l-[6px] xl:border-l-[8px] py-2.5 xl:py-3.5 px-4 xl:px-5 flex flex-col justify-center transition-colors w-full ${isObjetado ? 'border-red-200 border-l-[#DC2626]' : 'border-orange-200 border-l-[#F97316]'}`}>
              <div>
                <p className="text-[15px] xl:text-[16px] font-semibold text-black mb-0.5 leading-none">{item.label}</p>
                <p className="text-[17px] xl:text-[19px] font-bold text-black truncate leading-tight">{item.val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SECCIÓN CENTRAL: DONA, ESTADO, BRIX */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[8px] xl:gap-[14px] shrink-0 w-full">
          
          {/* DONA Y PORCENTAJES GLOBALES */}
          <div className="col-span-12 md:col-span-5 bg-white rounded-xl xl:rounded-2xl shadow-sm border border-slate-100 px-5 xl:px-6 py-1 xl:py-1.5 flex flex-col justify-between">
            <h3 className="text-[15px] xl:text-[18px] font-extrabold text-slate-800 mb-1 tracking-wider shrink-0">Resumen general</h3>
            <div className="flex flex-col sm:flex-row items-center gap-3 xl:gap-4 flex-1 justify-center w-full">
              
              <div className="w-[105px] h-[105px] xl:w-[135px] xl:h-[135px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="colorExportable" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22C55E" /><stop offset="100%" stopColor="#16A34A" /></linearGradient>
                      <linearGradient id="colorCalidad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FB923C" /><stop offset="100%" stopColor="#EA580C" /></linearGradient>
                      <linearGradient id="colorCondicion" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F87171" /><stop offset="100%" stopColor="#DC2626" /></linearGradient>
                    </defs>
                    <Pie 
                      data={chartData} cx="50%" cy="50%" 
                      innerRadius="74%" outerRadius="100%" 
                      startAngle={90} endAngle={-270} 
                      cornerRadius={15} paddingAngle={-10} 
                      dataKey="value" stroke="none"
                    >
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[18px] xl:text-[24px] font-black text-black tracking-tighter">{datos.exportable.toFixed(1).replace('.', ',')}%</span>
                </div>
              </div>

              <div className="space-y-1.5 flex-1 w-full flex flex-col justify-center">
                <div className="bg-green-50/50 p-1.5 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-gradient-to-r from-[#22C55E] to-[#16A34A] shadow-sm"></div>
                    <span className="text-[13px] xl:text-[15px] font-bold text-slate-700">Exportable</span>
                  </div>
                </div>
                <div className="bg-orange-50/50 p-1.5 rounded-lg border border-orange-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-gradient-to-r from-[#FB923C] to-[#EA580C] shadow-sm"></div>
                    <span className="text-[13px] xl:text-[15px] font-bold text-slate-700">Calidad</span>
                  </div>
                  <span className="text-[14px] xl:text-[16px] font-black text-[#EA580C]">{datos.pctCalidad.toFixed(1).replace('.', ',')}%</span>
                </div>
                <div className="bg-red-50/50 p-1.5 rounded-lg border border-red-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 xl:w-3.5 xl:h-3.5 rounded-full bg-gradient-to-r from-[#F87171] to-[#DC2626] shadow-sm"></div>
                    <span className="text-[13px] xl:text-[15px] font-bold text-slate-700">Condición</span>
                  </div>
                  <span className="text-[14px] xl:text-[16px] font-black text-[#DC2626]">{datos.pctCondicion.toFixed(1).replace('.', ',')}%</span>
                </div>
              </div>
              
            </div>
          </div>

          {/* ESTADO Y CALIFICACIÓN */}
          <div className="col-span-12 sm:col-span-6 md:col-span-3 flex flex-col gap-[6px] xl:gap-[8px] w-full">
            <div className={`rounded-xl xl:rounded-2xl shadow-sm border px-4 py-1 xl:py-1.5 flex-1 flex flex-col transition-colors ${isObjetado ? 'bg-red-50 border-[#DC2626]' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-center w-full">
                <h3 className={`text-[14px] xl:text-[16px] font-extrabold mb-0.5 tracking-wide ${isObjetado ? 'text-[#B91C1C]' : 'text-slate-800'}`}>Estado</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] xl:text-[10px] font-bold flex items-center gap-1.5 shadow-sm border ${isObjetado ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                  <span className={`w-1.5 h-1.5 xl:w-2 xl:h-2 rounded-full animate-pulse ${isObjetado ? 'bg-red-600' : 'bg-green-600'}`}></span> LIVE
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-[20px] xl:text-[26px] font-bold tracking-tight ${isObjetado ? 'text-[#DC2626]' : 'text-[#00A859]'}`}>
                  {datos.estado}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl xl:rounded-2xl shadow-sm border border-slate-100 px-4 py-1 xl:py-1.5 flex-1 flex flex-col w-full">
              <h3 className="text-[14px] xl:text-[16px] font-extrabold text-slate-800 tracking-wide mb-0.5">Calificación</h3>
              <div className="flex-1 flex items-center justify-center">
                <span className={`text-[24px] xl:text-[32px] font-bold ${isObjetado ? 'text-[#DC2626]' : 'text-slate-800'}`}>{datos.calificacion}</span>
              </div>
            </div>
          </div>

          {/* SÓLIDOS SOLUBLES */}
          <div className="col-span-12 sm:col-span-6 md:col-span-4 bg-white rounded-xl xl:rounded-2xl shadow-sm border border-slate-100 p-2 xl:p-2.5 flex flex-col w-full">
            <h3 className="text-[15px] xl:text-[18px] font-extrabold text-slate-800 mb-1 xl:mb-1.5 shrink-0 text-left">Sólidos solubles</h3>
            
            <div className="flex-1 grid grid-cols-2 divide-x divide-slate-200 text-center items-stretch">
              
              {/* Columna Light */}
              <div className="flex flex-col h-full items-center justify-between px-2 xl:px-4">
                <div className="flex flex-col items-center w-full">
                  <span className="text-[14px] xl:text-[16px] font-bold text-slate-700 mb-1 xl:mb-1.5">Light</span>
                  
                  <div className="flex gap-3 xl:gap-5 justify-center mb-1 w-full">
                    <div className="flex flex-col items-center gap-1 xl:gap-1.5">
                      <span className="text-[16px] xl:text-[18px] font-black text-slate-800 leading-none">{Number(datos.solidos.light.min || 0).toFixed(0)}</span>
                      <div className="w-3 h-6 xl:w-4 xl:h-8 rounded-full bg-slate-200 overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-red-400 to-red-500"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 xl:gap-1.5">
                      <span className="text-[16px] xl:text-[18px] font-black text-slate-800 leading-none">{Number(datos.solidos.light.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-6 xl:w-4 xl:h-8 rounded-full bg-slate-200 overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-red-400 to-red-500"></div>
                      </div>
                    </div>
                  </div>
                  
                  <span className="text-[11px] xl:text-[13px] font-bold text-slate-400 mt-1">Min Max</span>
                </div>

                <div className="flex flex-col items-center mt-1 xl:mt-1.5">
                  <span className="text-[20px] xl:text-[25px] font-black text-black leading-none">{Number(datos.solidos.light.prom || 0).toFixed(1).replace('.', ',')}</span>
                  <span className="text-[12px] xl:text-[14px] font-bold text-slate-400 mt-1">Promedio</span>
                </div>
              </div>
              
              {/* Columna Dark */}
              <div className="flex flex-col h-full items-center justify-between px-2 xl:px-4">
                <div className="flex flex-col items-center w-full">
                  <span className="text-[14px] xl:text-[16px] font-bold text-slate-700 mb-1 xl:mb-1.5">Dark</span>
                  
                  <div className="flex gap-3 xl:gap-5 justify-center mb-1 w-full">
                    <div className="flex flex-col items-center gap-1 xl:gap-1.5">
                      <span className="text-[16px] xl:text-[18px] font-black text-slate-800 leading-none">{Number(datos.solidos.dark.min || 0).toFixed(0)}</span>
                      <div className="w-3 h-6 xl:w-4 xl:h-8 rounded-full bg-slate-200 overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[45%] bg-gradient-to-b from-red-800 to-red-900"></div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 xl:gap-1.5">
                      <span className="text-[16px] xl:text-[18px] font-black text-slate-800 leading-none">{Number(datos.solidos.dark.max || 0).toFixed(0)}</span>
                      <div className="w-3 h-6 xl:w-4 xl:h-8 rounded-full bg-slate-200 overflow-hidden flex flex-col justify-end shadow-inner">
                        <div className="w-full h-[65%] bg-gradient-to-b from-red-800 to-red-900"></div>
                      </div>
                    </div>
                  </div>
                  
                  <span className="text-[11px] xl:text-[13px] font-bold text-slate-400 mt-1">Min Max</span>
                </div>

                <div className="flex flex-col items-center mt-1 xl:mt-1.5">
                  <span className="text-[20px] xl:text-[25px] font-black text-black leading-none">{Number(datos.solidos.dark.prom || 0).toFixed(1).replace('.', ',')}</span>
                  <span className="text-[12px] xl:text-[14px] font-bold text-slate-400 mt-1">Promedio</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* BARRAS DE DEFECTOS AL INFERIOR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] xl:gap-[14px] flex-1 min-h-0 w-full mt-1">
          
          <div className="bg-white rounded-xl xl:rounded-2xl shadow-sm border border-slate-100 px-5 xl:px-8 pt-3 xl:pt-5 pb-2 xl:pb-3 flex flex-col w-full min-h-0">
            <h3 className="text-[15px] xl:text-[18px] font-bold text-slate-800 mb-2 xl:mb-3 shrink-0">Principales defectos de calidad</h3>
            <div className="flex flex-col gap-[3px] xl:gap-[8px] w-full flex-1 min-h-0 justify-start">
              {datos.topCalidad.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}
            </div>
            <div className="flex items-center justify-center gap-6 xl:gap-10 mt-auto pt-2 w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#3B82F6]"></div> A</span>
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#22C55E]"></div> B</span>
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#EF4444]"></div> C</span>
            </div>
          </div>

          <div className="bg-white rounded-xl xl:rounded-2xl shadow-sm border border-slate-100 px-5 xl:px-8 pt-3 xl:pt-5 pb-2 xl:pb-3 flex flex-col w-full min-h-0">
            <h3 className="text-[15px] xl:text-[18px] font-bold text-slate-800 mb-2 xl:mb-3 shrink-0">Principales defectos de condición</h3>
            <div className="flex flex-col gap-[3px] xl:gap-[8px] w-full flex-1 min-h-0 justify-start">
              {datos.topCondicion.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}
            </div>
            <div className="flex items-center justify-center gap-6 xl:gap-10 mt-auto pt-2 w-full shrink-0">
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#3B82F6]"></div> 1</span>
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#22C55E]"></div> 2</span>
              <span className="flex items-center gap-1.5 text-[15px] xl:text-[17px] font-black text-black"><div className="w-2.5 h-2.5 xl:w-3 xl:h-3 rounded-full bg-[#EF4444]"></div> 3</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const mockProceso = {
  numProceso: '2', huerto: 'Maria veronica flores muñoz', variedad: 'Lapins', cajasEvaluadas: 1,
  exportable: 78.0, pctCalidad: 13.0, pctCondicion: 9.0, estado: 'Aprobado', calificacion: 'A2',
  solidos: { light: { min: 0.0, max: 0.0, prom: 0.0, count: 0 }, dark: { min: 18.0, max: 18.0, prom: 18.0, count: 18 } },
  topCalidad: [
    { nombre: 'Russet', pct: 3.0, lim1: 6.0, lim2: 15.0 }, { nombre: 'Manchas', pct: 2.0, lim1: 6.0, lim2: 10.0 },
    { nombre: 'Fruta sin pedicelo', pct: 2.0, lim1: 8.0, lim2: 16.0 }, { nombre: 'Frutos deformes / dobles', pct: 1.0, lim1: 3.0, lim2: 6.0 },
    { nombre: 'Daños de trips', pct: 1.0, lim1: 6.0, lim2: 10.0 }, { nombre: 'Golpe de sol', pct: 1.0, lim1: 6.0, lim2: 10.0 }
  ],
  topCondicion: [
    { nombre: 'Partiduras laterales', pct: 2.0, lim1: 2.0, lim2: 5.0 }, { nombre: 'Machucón', pct: 2.0, lim1: 2.0, lim2: 5.0 },
    { nombre: 'Partidura por agua', pct: 1.0, lim1: 2.0, lim2: 4.0 }, { nombre: 'Virosis', pct: 1.0, lim1: 2.0, lim2: 4.0 },
    { nombre: 'Pitting severo', pct: 1.0, lim1: 2.0, lim2: 5.0 }, { nombre: 'Quemado de sol', pct: 1.0, lim1: 3.0, lim2: 6.0 }
  ]
};

function BarraTolerancia({ nombre, pct, lim1, lim2 }) {
  const maxLimit = Math.max(lim2 * 1.2, pct * 1.1, 10);
  const pctZona1 = (lim1 / maxLimit) * 100;
  const pctZona2 = ((lim2 - lim1) / maxLimit) * 100;
  const pctZona3 = 100 - pctZona1 - pctZona2;
  const posBadge = Math.min((pct / maxLimit) * 100, 98);

  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2">
      <div className="col-span-4 text-[13px] font-medium text-slate-700 truncate pr-2" title={nombre}>{nombre}</div>
      <div className="col-span-8 relative pt-5 pb-3">
        <div className="absolute top-0 -translate-x-1/2 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10 flex items-center justify-center min-w-[36px]" style={{ left: `${posBadge}%` }}>
          {pct.toFixed(1).replace('.', ',')}%
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[#2563EB]"></div>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden flex">
          <div className="bg-[#E0E7FF] h-full" style={{ width: `${pctZona1}%` }}></div>
          <div className="bg-[#D1FAE5] h-full" style={{ width: `${pctZona2}%` }}></div>
          <div className="bg-[#FFE4E6] h-full" style={{ width: `${pctZona3}%` }}></div>
        </div>
        <div className="relative h-2 text-[9px] font-medium text-slate-400 mt-1">
          <span className="absolute -translate-x-1/2" style={{ left: `${pctZona1}%` }}>{lim1.toFixed(1).replace('.', ',')}%</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${pctZona1 + pctZona2}%` }}>{lim2.toFixed(1).replace('.', ',')}%</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLiveView({ datosProcesoLive, onClose }) {
  
  // LEER INICIALMENTE DESDE LOCALSTORAGE
  const getInitialData = () => {
    if (datosProcesoLive) return datosProcesoLive;
    const saved = localStorage.getItem('qc_live_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.log(e); }
    }
    return mockProceso;
  };

  const [datos, setDatos] = useState(getInitialData());

  useEffect(() => {
    const channel = new BroadcastChannel('qc_dashboard_sync');
    channel.onmessage = (event) => { 
      if (event.data) setDatos(event.data); 
    };

    // Escuchar cambios nativos por si refrescas la pestaña
    const handleStorageChange = (e) => {
      if (e.key === 'qc_live_data' && e.newValue) {
        setDatos(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const chartData = [
    { name: 'Exportable', value: datos.exportable, color: 'url(#colorExportable)' },
    { name: 'Calidad', value: datos.pctCalidad, color: 'url(#colorCalidad)' },
    { name: 'Condición', value: datos.pctCondicion, color: 'url(#colorCondicion)' }
  ];

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-4 h-full pb-8" style={{ fontFamily: '"Segoe UI", sans-serif' }}>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-16 flex items-center justify-between overflow-hidden relative shrink-0">
        <div className="absolute top-0 bottom-0 left-0 w-[55%] bg-gradient-to-r from-[#00A859] to-[#10b981]" style={{ clipPath: 'polygon(0 0, 100% 0, 92% 100%, 0% 100%)' }}></div>
        <div className="relative z-10 flex items-center px-6 text-white h-full">
          <div className="w-1.5 h-6 bg-white rounded-full mr-3"></div>
          <div className="flex flex-col justify-center">
            <h1 className="text-base font-bold leading-tight">QC Evap <span className="text-orange-200">+</span></h1>
            <p className="text-[10px] text-emerald-50 leading-none mt-0.5 font-medium">(Evaluación de análisis de procesos)</p>
          </div>
        </div>
        <div className="relative z-10 pr-6 flex items-center gap-4">
          <span className="text-[11px] font-bold text-slate-300 tracking-widest hidden sm:block">LOGO EMPRESA</span>
          {onClose && (
            <button 
              onClick={() => {
                if (document.fullscreenElement) { document.exitFullscreen().catch(()=>{}); }
                onClose();
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2"
            >
              Volver a menú
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 shrink-0">
        {[
          { label: 'N° proceso', val: datos.numProceso },
          { label: 'Huerto', val: datos.huerto },
          { label: 'Variedad', val: datos.variedad },
          { label: 'Cajas evaluadas', val: datos.cajasEvaluadas }
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-100 py-3.5 px-4 relative overflow-hidden flex flex-col justify-center">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-300 to-orange-600"></div>
            <div className="pl-1.5">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">{item.label}</p>
              <p className="text-[15px] font-bold text-slate-800 truncate">{item.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 shrink-0">
        <div className="col-span-12 md:col-span-5 bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <h3 className="text-[13px] font-bold text-slate-800 mb-4">Resumen general</h3>
          <div className="flex items-center justify-between px-2 sm:pr-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10B981]"></div><span className="text-[12px] font-bold text-slate-700">Exportable</span></div>
              </div>
              <div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#F97316]"></div><span className="text-[12px] font-bold text-slate-700">Calidad</span></div>
                <p className="text-[11px] text-slate-500 font-medium ml-5 mt-0.5 leading-none">{datos.pctCalidad.toFixed(1).replace('.', ',')}%</p>
              </div>
              <div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#DC2626]"></div><span className="text-[12px] font-bold text-slate-700">Condición</span></div>
                <p className="text-[11px] text-slate-500 font-medium ml-5 mt-0.5 leading-none">{datos.pctCondicion.toFixed(1).replace('.', ',')}%</p>
              </div>
            </div>
            <div className="w-[140px] h-[140px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="colorExportable" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22C55E" /><stop offset="100%" stopColor="#16A34A" /></linearGradient>
                    <linearGradient id="colorCalidad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FB923C" /><stop offset="100%" stopColor="#EA580C" /></linearGradient>
                    <linearGradient id="colorCondicion" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F87171" /><stop offset="100%" stopColor="#DC2626" /></linearGradient>
                  </defs>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={46} outerRadius={64} startAngle={90} endAngle={-270} cornerRadius={20} paddingAngle={-14} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-semibold text-slate-700 tracking-tight">{datos.exportable.toFixed(1).replace('.', ',')}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col">
            <h3 className="text-[13px] font-bold text-slate-800 mb-2">Estado</h3>
            <div className="flex-1 flex items-center justify-center">
              <span className={`text-2xl font-semibold ${datos.estado === 'Aprobado' ? 'text-[#00A859]' : 'text-red-600'}`}>{datos.estado}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex-1 flex flex-col">
            <h3 className="text-[13px] font-bold text-slate-800 mb-2">Calificación</h3>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-3xl font-semibold text-slate-800">{datos.calificacion}</span>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col">
          <h3 className="text-[13px] font-bold text-slate-800 mb-2">Sólidos solubles</h3>
          <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 text-center items-center">
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-[11px] font-bold text-slate-400 mb-1">Light</span>
              <div className="flex gap-1.5 my-1"><div className="w-2.5 h-[18px] bg-slate-200 rounded-full"></div><div className="w-2.5 h-[18px] bg-slate-200 rounded-full"></div></div>
              <span className="text-[9px] font-semibold text-slate-400 uppercase">Min Max</span>
              <span className="text-[22px] font-black text-slate-800 leading-none my-0.5">{datos.solidos.light.prom.toFixed(1).replace('.', ',')}</span>
              <span className="text-[10px] text-slate-400">Promedio</span>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-[11px] font-bold text-slate-400 mb-0.5">Dark</span>
              <div className="flex gap-4"><span className="text-[9px] font-bold text-slate-600">{datos.solidos.dark.count}</span><span className="text-[9px] font-bold text-slate-600">{datos.solidos.dark.count}</span></div>
              <div className="flex gap-3 my-0.5"><div className="w-2.5 h-[18px] bg-red-700 rounded-full"></div><div className="w-2.5 h-[18px] bg-red-700 rounded-full"></div></div>
              <span className="text-[9px] font-semibold text-slate-400 uppercase">Min Max</span>
              <span className="text-[22px] font-black text-slate-800 leading-none my-0.5">{datos.solidos.dark.prom.toFixed(1).replace('.', ',')}</span>
              <span className="text-[10px] text-slate-400">Promedio</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-4">Principales defectos de calidad</h3>
            <div className="flex flex-col gap-1">{datos.topCalidad.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}</div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-50 text-xs font-bold text-slate-700">
            <span>Calificación:</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2563EB]"></div> A</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#00A859]"></div> B</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#DC2626]"></div> C</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-4">Principales defectos de condición</h3>
            <div className="flex flex-col gap-1">{datos.topCondicion.slice(0, 6).map(item => <BarraTolerancia key={item.nombre} {...item} />)}</div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-50 text-xs font-bold text-slate-700">
            <span>Calificación:</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2563EB]"></div> 1</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#00A859]"></div> 2</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#DC2626]"></div> 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
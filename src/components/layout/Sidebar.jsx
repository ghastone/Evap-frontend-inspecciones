import React, { useState } from 'react';
import { FileText, History, Activity, LayoutDashboard, Settings, ChevronDown, ChevronUp } from 'lucide-react';

export default function Sidebar({ vista, setVista }) {
  const [ajustesAbierto, setAjustesAbierto] = useState(true);

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 p-6 flex flex-col justify-between shrink-0 z-20">
      <div>
        <div className="flex items-center gap-1 mb-8 pl-2">
          <span className="text-2xl font-bold text-slate-800">Qc Evap</span>
          <span className="text-2xl font-bold text-[#FF5500]">+</span>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">INSPECCIÓN</p>
          <nav className="space-y-1.5">
            <button
              onClick={() => setVista('inspeccion')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
                vista === 'inspeccion' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nuevo proceso</span>
            </button>

            <button
              onClick={() => setVista('historial')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
                vista === 'historial' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historial de procesos</span>
            </button>

            <button
              onClick={() => {
                setVista('dashboard_live');
                try {
                  if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); }
                } catch (e) { console.log(e); }
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
                vista === 'dashboard_live' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Dashboard en Vivo</span>
            </button>
          </nav>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">ANÁLISIS</p>
          <button
            onClick={() => setVista('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm transition-all ${
              vista === 'dashboard' ? 'bg-[#FF5500] text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>

        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">AJUSTES</p>
          <button
            onClick={() => setAjustesAbierto(!ajustesAbierto)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-medium text-sm text-slate-600 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" />
              <span>Ajustes</span>
            </div>
            {ajustesAbierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {ajustesAbierto && (
            <div className="mt-2 pl-4 space-y-1">
              <button onClick={() => setVista('parametros')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'parametros' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <span className="text-base">•</span><span>Modificar parámetros</span>
              </button>
              <button onClick={() => setVista('exportadoras')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'exportadoras' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <span className="text-base">•</span><span>Gestionar exportadoras</span>
              </button>
              <button onClick={() => setVista('variedades')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'variedades' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <span className="text-base">•</span><span>Gestionar variedades</span>
              </button>
              <button onClick={() => setVista('huertos')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'huertos' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <span className="text-base">•</span><span>Agregar o editar huertos</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
import React, { useState } from 'react';
import { 
  FileText, History, Activity, LayoutDashboard, Settings, 
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft 
} from 'lucide-react';

export default function Sidebar({ vista, setVista, isCollapsed, setIsCollapsed }) {
  const [ajustesAbierto, setAjustesAbierto] = useState(true);

  return (
    <aside 
      className={`bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 z-20 transition-all duration-300 ${
        isCollapsed ? 'w-20 px-3 py-6 items-center' : 'w-64 p-6'
      }`}
    >
      <div className="w-full">
        {/* LOGO ADAPTATIVO */}
        <div className={`flex items-center mb-8 ${isCollapsed ? 'justify-center' : 'gap-1 pl-2'}`}>
          {isCollapsed ? (
            <span className="text-2xl font-black text-[#FF5500]">Qc</span>
          ) : (
            <>
              <span className="text-2xl font-bold text-slate-800">Qc Evap</span>
              <span className="text-2xl font-bold text-[#FF5500]">+</span>
            </>
          )}
        </div>

        {/* SECCIÓN INSPECCIÓN */}
        <div className="mb-6 w-full">
          {!isCollapsed && <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">INSPECCIÓN</p>}
          <nav className="space-y-1.5 w-full">
            <button
              title="Nuevo proceso"
              onClick={() => {
                setVista('inspeccion');
                setIsCollapsed(false); // Expande el menú
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-medium text-sm transition-all ${
                vista === 'inspeccion' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Nuevo proceso</span>}
            </button>

            <button
              title="Historial de procesos"
              onClick={() => {
                setVista('historial');
                setIsCollapsed(true); // <--- CONTRAE EL MENÚ AUTOMÁTICAMENTE
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-medium text-sm transition-all ${
                vista === 'historial' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <History className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Historial de procesos</span>}
            </button>

            <button
              title="Dashboard en Vivo"
              onClick={() => {
                setVista('dashboard_live');
                setIsCollapsed(true); // Contrae el menú
                try {
                  if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); }
                } catch (e) { console.log(e); }
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-medium text-sm transition-all ${
                vista === 'dashboard_live' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Dashboard en Vivo</span>}
            </button>
          </nav>
        </div>

        {/* SECCIÓN ANÁLISIS */}
        <div className="mb-6 w-full">
          {!isCollapsed && <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">ANÁLISIS</p>}
          <button
            title="Dashboard"
            onClick={() => {
              setVista('dashboard');
              setIsCollapsed(true); // Contrae el menú
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-medium text-sm transition-all ${
              vista === 'dashboard' ? 'bg-[#FF5500] text-white shadow-md shadow-orange-200' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </button>
        </div>

        {/* SECCIÓN AJUSTES */}
        <div className="w-full">
          {!isCollapsed && <p className="text-[11px] font-bold text-slate-400 tracking-wider mb-3 uppercase pl-2">AJUSTES</p>}
          <button
            title="Ajustes"
            onClick={() => {
              if (isCollapsed) {
                setIsCollapsed(false);
                setAjustesAbierto(true);
              } else {
                setAjustesAbierto(!ajustesAbierto);
              }
            }}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} rounded-2xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition-all`}
          >
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
              <Settings className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Ajustes</span>}
            </div>
            {!isCollapsed && (ajustesAbierto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
          </button>

          {!isCollapsed && ajustesAbierto && (
            <div className="mt-2 pl-4 space-y-1 w-full animate-fade-in">
              <button onClick={() => setVista('parametros')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'parametros' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="text-base">•</span><span>Parámetros</span></button>
              <button onClick={() => setVista('exportadoras')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'exportadoras' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="text-base">•</span><span>Exportadoras</span></button>
              <button onClick={() => setVista('variedades')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'variedades' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="text-base">•</span><span>Variedades</span></button>
              <button onClick={() => setVista('huertos')} className={`w-full flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${vista === 'huertos' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="text-base">•</span><span>Huertos</span></button>
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mt-6 p-2 w-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
        title={isCollapsed ? "Expandir menú" : "Minimizar menú"}
      >
        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
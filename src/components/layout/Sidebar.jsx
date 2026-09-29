import React, { useState } from 'react';
import { 
  PlusCircle, 
  ClipboardList, 
  LayoutDashboard, 
  Settings, 
  ChevronDown, 
  LogOut, 
  User,
  ChevronLeft
} from 'lucide-react';

export default function Sidebar({ vistaActual, setVistaActual, isSidebarOpen, setIsSidebarOpen }) {
  const [menuDashboards, setMenuDashboards] = useState(true);
  const [menuAjustes, setMenuAjustes] = useState(true);

  return (
    <>
      {/* Overlay para móviles */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Contenedor principal del Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Logo superior */}
        <div className="h-20 flex items-center justify-center border-b border-slate-100 relative shrink-0">
          <img src="/Logo_goldanda.png" alt="Gold Anda Logo" className="h-10 object-contain" />
          
          {/* Botón ocultar en móvil */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden absolute right-[-14px] top-1/2 -translate-y-1/2 bg-white border border-slate-200 p-1.5 rounded-full shadow-sm text-slate-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Menú Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 space-y-8">
          
          {/* SECCIÓN: PRINCIPAL */}
          <div className="space-y-2">
            <button
              onClick={() => setVistaActual('crear_proceso')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${
                vistaActual === 'crear_proceso' 
                  ? 'bg-green-50 text-[#00A859]' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <PlusCircle className={`w-6 h-6 ${vistaActual === 'crear_proceso' ? 'text-[#00A859]' : 'text-green-600'}`} />
              <span className="text-[15px]">Crear Proceso</span>
            </button>

            <button
              onClick={() => setVistaActual('historial')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${
                vistaActual === 'historial' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ClipboardList className={`w-6 h-6 ${vistaActual === 'historial' ? 'text-blue-700' : 'text-blue-600'}`} />
              <span className="text-[15px]">Historial</span>
            </button>
          </div>

          {/* SECCIÓN: ANÁLISIS */}
          <div>
            <h3 className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">
              Análisis
            </h3>
            
            <div className="space-y-1">
              <button
                onClick={() => setMenuDashboards(!menuDashboards)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold ${
                  vistaActual.includes('dashboard') ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 text-slate-900">
                  <LayoutDashboard className="w-6 h-6 text-[#E96008]" />
                  <span className="text-[15px]">Dashboards</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuDashboards ? 'rotate-180' : ''}`} />
              </button>

              {/* SUBMENÚ DASHBOARDS REDISEÑADO */}
              {menuDashboards && (
                <div className="flex flex-col mt-1 mb-2 space-y-1">
                  
                  {/* Evap (En vivo) - Minimalista pero destacado */}
                  <button
                    onClick={() => setVistaActual('dashboard_live')}
                    className={`relative flex items-center w-full text-left pl-12 pr-4 py-2.5 rounded-xl transition-all ${
                      vistaActual === 'dashboard_live' || vistaActual === 'live' // Ajusta el string según tu estado
                        ? 'bg-orange-50 text-[#E96008]'
                        : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${vistaActual === 'dashboard_live' || vistaActual === 'live' ? 'bg-[#E96008] animate-pulse' : 'bg-slate-400'}`}></span>
                      <span className="font-extrabold text-[14px]">
                        Evap <span className="font-semibold text-[12px] opacity-70">(análisis en vivo)</span>
                      </span>
                    </div>
                  </button>

                  {/* Línea divisoria delgada */}
                  <div className="h-px bg-slate-200/70 mx-10 my-0.5"></div>

                  {/* Resumen Diario */}
                  <button
                    onClick={() => setVistaActual('dashboard_resumen')}
                    className={`w-full text-left pl-12 pr-4 py-2.5 rounded-xl transition-all font-bold text-[14px] ${
                      vistaActual === 'dashboard_resumen'
                        ? 'bg-orange-50 text-[#E96008]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Resumen Diario
                  </button>
                  
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN: ADMINISTRACIÓN */}
          <div>
            <h3 className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">
              Administración
            </h3>
            
            <div className="space-y-1">
              <button
                onClick={() => setMenuAjustes(!menuAjustes)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold ${
                  ['exportadoras', 'variedades', 'productores', 'parametros'].includes(vistaActual) ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 text-slate-700">
                  <Settings className="w-6 h-6 text-slate-500" />
                  <span className="text-[15px]">Ajustes</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuAjustes ? 'rotate-180' : ''}`} />
              </button>

              {menuAjustes && (
                <div className="flex flex-col space-y-0.5 mt-1">
                  {['exportadoras', 'variedades', 'productores', 'parametros'].map((item) => {
                    const titulos = {
                      exportadoras: 'Exportadoras',
                      variedades: 'Variedades',
                      productores: 'Productores/Huertos',
                      parametros: 'Parámetros Calificación'
                    };
                    return (
                      <button
                        key={item}
                        onClick={() => setVistaActual(item)}
                        className={`w-full text-left pl-14 pr-4 py-2.5 rounded-xl transition-colors text-[13.5px] font-medium ${
                          vistaActual === item
                            ? 'bg-orange-50 text-[#E96008] font-bold'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {titulos[item]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* PIE DEL SIDEBAR (Perfil y Cerrar sesión) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-black text-slate-800 leading-tight">Admin</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Administrador</p>
            </div>
          </div>
          
          <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all shadow-sm">
            <LogOut className="w-4 h-4 text-slate-500" />
            <span className="text-[13px]">Cerrar Sesión</span>
          </button>
        </div>

      </aside>
    </>
  );
}
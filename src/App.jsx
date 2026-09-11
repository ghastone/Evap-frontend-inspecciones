import React, { useState, useEffect } from 'react';
import Login from './modules/dashboardLive/Login';
import DashboardLiveView from './modules/dashboardLive/DashboardLiveView';

import NuevoProceso from './modules/inspeccion/NuevoProceso';
import InspeccionModule from './modules/inspeccion/InspeccionModule';

import HistorialProcesosView from './modules/historial/HistorialProcesosView';
import GestionExportadoras from './modules/ajustes/GestionExportadoras';
import GestionVariedades from './modules/ajustes/GestionVariedades';
import TablaHuertos from './modules/ajustes/TablaHuertos';
import ParametrosCalificacion from './modules/ajustes/ParametrosCalificacion';

import { 
  LogOut, PlusCircle, ClipboardList, LayoutDashboard, Settings, User, 
  ChevronLeft, ChevronRight, ChevronDown, X
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAjustes, setShowAjustes] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const [datosProcesoActivo, setDatosProcesoActivo] = useState(null);

  const [dbData, setDbData] = useState({
    exportadoras: [],
    variedades: [],
    productores: [],
    procesosExistentes: []
  });

  const cargarDatosMaestros = async () => {
    try {
      const API_URL = `http://${window.location.hostname || 'localhost'}:3001`;
      
      const [expRes, varRes, hueRes, inspRes] = await Promise.all([
        fetch(`${API_URL}/api/exportadoras`),
        fetch(`${API_URL}/api/variedades`),
        fetch(`${API_URL}/api/huertos`),
        fetch(`${API_URL}/api/inspecciones`)
      ]);

      const exportadorasDB = await expRes.json();
      const variedadesDB = await varRes.json();
      const huertosDB = await hueRes.json();
      const inspeccionesDB = await inspRes.json();

      const expSeguro = Array.isArray(exportadorasDB) ? exportadorasDB : [];
      const varSeguro = Array.isArray(variedadesDB) ? variedadesDB : [];
      const hueSeguro = Array.isArray(huertosDB) ? huertosDB : [];
      const inspSeguro = Array.isArray(inspeccionesDB) ? inspeccionesDB : [];

      setDbData({
        exportadoras: expSeguro.map(e => e.nombre),
        variedades: varSeguro.map(v => v.nombre),
        productores: hueSeguro,
        procesosExistentes: inspSeguro.map(p => p.numProceso)
      });
      
    } catch (error) {
      console.error("Error al cargar los datos maestros:", error);
    }
  };

  useEffect(() => {
    if (user) {
      cargarDatosMaestros();
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentView('home');
  };

  const handleLogout = () => {
    if(window.confirm('¿Estás seguro de cerrar sesión?')) {
      setUser(null);
      setCurrentView('home');
      setIsCollapsed(false);
      setShowAjustes(false);
      setShowDrawer(false);
      setDatosProcesoActivo(null);
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // AQUÍ AGRUPAMOS EL DASHBOARD PARA QUE PUEDA ABRIR EL MENÚ LATERAL
  if (currentView === 'nuevo-proceso' || currentView === 'inspeccion' || currentView === 'dashboard') {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-50 relative">
        
        {currentView === 'nuevo-proceso' && (
          <NuevoProceso 
            exportadoras={dbData.exportadoras}
            productores={dbData.productores}
            variedades={dbData.variedades}
            procesosExistentes={dbData.procesosExistentes}
            onAbrirMenu={() => setShowDrawer(true)}
            onIniciarInspeccion={(datosGenerales) => {
              setDatosProcesoActivo(datosGenerales);
              setCurrentView('inspeccion');
            }}
          />
        )}

        {currentView === 'inspeccion' && datosProcesoActivo && (
          <InspeccionModule 
            datosProceso={datosProcesoActivo}
            onAbrirMenu={() => setShowDrawer(true)}
            onVolver={() => {
              setCurrentView('home');
              setDatosProcesoActivo(null);
            }}
            onFinishedInspection={(num) => {
              cargarDatosMaestros(); 
              setCurrentView('historial'); 
              setDatosProcesoActivo(null);
            }}
          />
        )}

        {/* AQUÍ SE INYECTA EL DASHBOARD CON EL MENÚ HABILITADO */}
        {currentView === 'dashboard' && (
          <DashboardLiveView 
            onClose={() => setCurrentView('home')} 
            onAbrirMenu={() => setShowDrawer(true)} 
          />
        )}

        {showDrawer && (
          <div className="fixed inset-0 z-[200] flex animate-fade-in">
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setShowDrawer(false)} 
            />
            <aside className="relative w-[280px] max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-right">
              <div className="h-20 flex items-center justify-between border-b border-slate-100 px-5 shrink-0">
                <img src="/Logo_goldanda.png" alt="Gold Anda" className="h-9 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <button onClick={() => setShowDrawer(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                <button onClick={() => { setShowDrawer(false); setCurrentView('nuevo-proceso'); }} className="w-full flex items-center px-4 py-3 rounded-xl bg-orange-50 text-[#E96008] font-bold text-left text-sm">
                  <PlusCircle className="w-5 h-5 text-[#E96008] shrink-0 mr-3" />
                  <span>Crear Proceso</span>
                </button>
                <button onClick={() => { setShowDrawer(false); setCurrentView('historial'); }} className="w-full flex items-center px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                  <ClipboardList className="w-5 h-5 text-blue-600 shrink-0 mr-3" />
                  <span>Historial</span>
                </button>

                {user.role === 'admin' && (
                  <>
                    <div className="pt-4 mt-2 mb-2 border-t border-slate-100"><p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Administración</p></div>
                    <button onClick={() => { setShowDrawer(false); setCurrentView('dashboard'); }} className="w-full flex items-center px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                      <LayoutDashboard className="w-5 h-5 text-[#E96008] shrink-0 mr-3" /><span>Dashboard Live</span>
                    </button>
                    <div className="flex flex-col">
                      <button onClick={() => setShowAjustes(!showAjustes)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                        <div className="flex items-center"><Settings className="w-5 h-5 text-slate-600 shrink-0 mr-3" /><span>Ajustes</span></div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAjustes ? 'rotate-180' : ''}`} />
                      </button>
                      {showAjustes && (
                        <div className="mt-1 pl-12 flex flex-col space-y-1">
                          <button onClick={() => { setShowDrawer(false); setCurrentView('ajustes-exportadoras'); }} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Exportadoras</button>
                          <button onClick={() => { setShowDrawer(false); setCurrentView('ajustes-variedades'); }} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Variedades</button>
                          <button onClick={() => { setShowDrawer(false); setCurrentView('ajustes-huertos'); }} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Productores/Huertos</button>
                          <button onClick={() => { setShowDrawer(false); setCurrentView('ajustes-parametros'); }} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Parámetros Calificación</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </nav>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0"><User className="w-4 h-4" /></div>
                  <div className="overflow-hidden">
                    <p className="text-slate-800 text-xs font-bold capitalize truncate">{user.username}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-black">{user.role}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl text-xs font-bold transition-colors">
                  <LogOut className="w-4 h-4" /><span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F4F7FA] font-sans overflow-hidden">
      
      <aside className={`${isCollapsed ? 'w-20' : 'w-[260px]'} bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 shrink-0 transition-all duration-300 relative`}>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-7 bg-white border border-slate-200 text-slate-600 rounded-full p-1 shadow-md hover:bg-slate-50 transition-colors z-30" title={isCollapsed ? "Expandir menú" : "Contraer menú"}>
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="h-20 flex items-center justify-center border-b border-slate-100 px-4 shrink-0">
          <img src="/Logo_goldanda.png" alt="Gold Anda" className={`${isCollapsed ? 'h-7' : 'h-10'} w-auto object-contain transition-all`} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          <button onClick={() => setCurrentView('nuevo-proceso')} title="Crear Proceso" className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${currentView === 'nuevo-proceso' ? 'bg-orange-50 text-[#E96008] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
            <PlusCircle className="w-6 h-6 text-green-600 shrink-0" />
            {!isCollapsed && <span className="text-sm truncate ml-3 font-semibold">Crear Proceso</span>}
          </button>
          
          <button onClick={() => { setCurrentView('historial'); setIsCollapsed(true); }} title="Historial" className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${currentView === 'historial' ? 'bg-orange-50 text-[#E96008] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
            <ClipboardList className="w-6 h-6 text-blue-600 shrink-0" />
            {!isCollapsed && <span className="text-sm truncate ml-3">Historial</span>}
          </button>

          {user.role === 'admin' && (
            <>
              <div className="pt-4 mt-2 mb-2 border-t border-slate-100">
                {!isCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Administración</p>}
              </div>
              <button onClick={() => setCurrentView('dashboard')} title="Dashboard Live" className="w-full flex items-center px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-all text-left">
                <LayoutDashboard className="w-6 h-6 text-[#E96008] shrink-0" />
                {!isCollapsed && <span className="text-sm truncate ml-3">Dashboard Live</span>}
              </button>
              
              <div className="flex flex-col">
                <button onClick={() => { if (isCollapsed) setIsCollapsed(false); setShowAjustes(!showAjustes); }} title="Ajustes" className={`w-full flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${showAjustes ? 'bg-slate-50 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
                  <div className="flex items-center"><Settings className="w-6 h-6 text-slate-600 shrink-0" />{!isCollapsed && <span className="text-sm truncate ml-3">Ajustes</span>}</div>
                  {!isCollapsed && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAjustes ? 'rotate-180' : ''}`} />}
                </button>
                {showAjustes && !isCollapsed && (
                  <div className="mt-1 pl-12 flex flex-col space-y-1 animate-fade-in">
                    <button onClick={() => setCurrentView('ajustes-exportadoras')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-exportadoras' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Exportadoras</button>
                    <button onClick={() => setCurrentView('ajustes-variedades')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-variedades' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Variedades</button>
                    <button onClick={() => setCurrentView('ajustes-huertos')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-huertos' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Productores/Huertos</button>
                    <button onClick={() => setCurrentView('ajustes-parametros')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-parametros' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Parámetros Calificación</button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className={`flex items-center ${isCollapsed ? 'justify-center mb-3' : 'gap-3 mb-4 px-2'}`}>
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm shrink-0"><User className="w-5 h-5" /></div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-slate-800 text-sm font-bold capitalize truncate">{user.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">{user.role}</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} title="Cerrar Sesión" className={`w-full flex items-center justify-center ${isCollapsed ? 'p-2.5' : 'gap-2 py-2.5'} bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors text-sm font-bold shadow-sm`}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden">
        {currentView === 'home' && (
          <div className="w-full h-full p-4 md:p-8 flex items-center justify-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm w-full h-full flex flex-col items-center justify-center p-8 text-center">
              <img src="/Logo_goldanda.png" alt="Gold Anda" className="h-20 md:h-24 object-contain mb-6" onError={(e) => { e.target.style.display = 'none'; }} />
              <p className="text-[#475569] text-base md:text-lg font-medium mb-1">Bienvenido a Qc Evap +</p>
              <p className="text-[#475569] text-base md:text-lg font-medium">Seleccione un módulo lateral.</p>
            </div>
          </div>
        )}

        {currentView === 'historial' && (
          <HistorialProcesosView onVerResumen={(proceso) => console.log('Resumen:', proceso)} />
        )}

        {currentView === 'ajustes-exportadoras' && (
          <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in">
            <GestionExportadoras exportadoras={dbData.exportadoras} setExportadoras={(nuevas) => setDbData(prev => ({ ...prev, exportadoras: nuevas }))} />
          </div>
        )}

        {currentView === 'ajustes-variedades' && (
          <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in">
            <GestionVariedades variedades={dbData.variedades} setVariedades={(nuevas) => setDbData(prev => ({ ...prev, variedades: nuevas }))} />
          </div>
        )}

        {currentView === 'ajustes-huertos' && (
          <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in">
            <TablaHuertos exportadoras={dbData.exportadoras} productores={dbData.productores} setProductores={(nuevos) => setDbData(prev => ({ ...prev, productores: nuevos }))} />
          </div>
        )}

        {currentView === 'ajustes-parametros' && (
          <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in">
            <ParametrosCalificacion />
          </div>
        )}
      </main>
    </div>
  );
}
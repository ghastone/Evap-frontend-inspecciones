import React, { useState, useEffect, useRef } from 'react';
import Login from './modules/dashboardLive/Login';
import DashboardLiveView from './modules/dashboardLive/DashboardLiveView';
import DashboardResumenDiario from './modules/dashboard/DashboardResumenDiario';
import DashboardHistoricoTemporada from './modules/dashboard/DashboardHistorico';

import NuevoProceso from './modules/inspeccion/NuevoProceso';
import InspeccionModule from './modules/inspeccion/InspeccionModule';

import HistorialProcesosView from './modules/historial/HistorialProcesosView';
import GestionExportadoras from './modules/ajustes/GestionExportadoras';
import GestionVariedades from './modules/ajustes/GestionVariedades';
import TablaHuertos from './modules/ajustes/TablaHuertos';
import ParametrosCalificacion from './modules/ajustes/ParametrosCalificacion';
import GestionUsuarios from './modules/ajustes/GestionUsuarios'; 

import { 
  LogOut, PlusCircle, ClipboardList, LineChart, Settings, User, 
  ChevronLeft, ChevronRight, ChevronDown, X
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('qc_user_session');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  // ================= MEMORIA PERSISTENTE DE RUTAS =================
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('qc_current_view') || 'home';
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('qc_is_collapsed') === 'true';
  });

  const [datosProcesoActivo, setDatosProcesoActivo] = useState(() => {
    const saved = localStorage.getItem('inspeccionActiva');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => { localStorage.setItem('qc_current_view', currentView); }, [currentView]);
  useEffect(() => { localStorage.setItem('qc_is_collapsed', isCollapsed); }, [isCollapsed]);
  useEffect(() => {
    if (datosProcesoActivo) localStorage.setItem('inspeccionActiva', JSON.stringify(datosProcesoActivo));
    else localStorage.removeItem('inspeccionActiva');
  }, [datosProcesoActivo]);
  // ================================================================

  const [showAjustes, setShowAjustes] = useState(false);
  const [dashboardsAbierto, setDashboardsAbierto] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  // ================= ESTADOS INACTIVIDAD =================
  const [mostrarAlertaInactividad, setMostrarAlertaInactividad] = useState(false);
  const timerInactividad = useRef(null);
  const timerCierre = useRef(null);

  const TIEMPO_ALERTA = 28 * 60 * 1000; 
  const TIEMPO_CIERRE_FINAL = 2 * 60 * 1000;

  const resetearTemporizadores = () => {
    if (timerInactividad.current) clearTimeout(timerInactividad.current);
    if (timerCierre.current) clearTimeout(timerCierre.current);

    if (user) {
      timerInactividad.current = setTimeout(() => {
        setMostrarAlertaInactividad(true);
        timerCierre.current = setTimeout(() => {
          forzarCierrePorInactividad();
        }, TIEMPO_CIERRE_FINAL);
      }, TIEMPO_ALERTA);
    }
  };

  const forzarCierrePorInactividad = () => {
    localStorage.clear();
    sessionStorage.clear();
    
    const API_URL = window.location.hostname.includes('goldanda.cl')     
      ? 'https://evap.maq.goldanda.cl' 
      : `http://${window.location.hostname || 'localhost'}:3001`;
      
    fetch(`${API_URL}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(err => console.log('Live limpiado (Inactividad)', err));

    setUser(null);
    setMostrarAlertaInactividad(false);
    setCurrentView('home');
    setDatosProcesoActivo(null);
    
    alert("Tu sesión se ha cerrado por inactividad prolongada por tu seguridad.");
  };

  const mantenerSesionViva = () => {
    setMostrarAlertaInactividad(false);
    resetearTemporizadores();
  };

  useEffect(() => {
    if (!user) return;

    let ultimoMovimiento = Date.now();
    const handleActividad = () => {
      const ahora = Date.now();
      if (ahora - ultimoMovimiento > 2000 && !mostrarAlertaInactividad) {
        ultimoMovimiento = ahora;
        resetearTemporizadores();
      }
    };

    const eventos = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    eventos.forEach(evt => window.addEventListener(evt, handleActividad));
    
    resetearTemporizadores();

    return () => {
      eventos.forEach(evt => window.removeEventListener(evt, handleActividad));
      if (timerInactividad.current) clearTimeout(timerInactividad.current);
      if (timerCierre.current) clearTimeout(timerCierre.current);
    };
  }, [user, mostrarAlertaInactividad]);

  // ================= ESTADOS INTERCEPTOR DE NAVEGACIÓN =================
  const [vistaPendiente, setVistaPendiente] = useState(null);
  const [mostrarAlertaSalida, setMostrarAlertaSalida] = useState(false);
  const vistasProtegidas = ['nuevo-proceso', 'inspeccion'];

  const intentarNavegar = (nuevaVista) => {
    if (nuevaVista === currentView) return;
    
    setShowDrawer(false);

    if (['historial', 'ajustes-exportadoras', 'ajustes-variedades', 'ajustes-huertos', 'ajustes-parametros', 'ajustes-usuarios'].includes(nuevaVista)) {
      setIsCollapsed(true);
    } else if (nuevaVista === 'nuevo-proceso' || nuevaVista === 'home') {
      setIsCollapsed(false);
    }

    if (vistasProtegidas.includes(currentView)) {
      setVistaPendiente(nuevaVista);
      setMostrarAlertaSalida(true);
    } else {
      setCurrentView(nuevaVista);
    }
  };

  const confirmarSalida = () => {
    setCurrentView(vistaPendiente);
    
    if (['historial', 'ajustes-exportadoras', 'ajustes-variedades', 'ajustes-huertos', 'ajustes-parametros', 'ajustes-usuarios'].includes(vistaPendiente)) {
      setIsCollapsed(true);
    } else if (vistaPendiente === 'nuevo-proceso' || vistaPendiente === 'home') {
      setIsCollapsed(false);
    }

    setDatosProcesoActivo(null);
    setMostrarAlertaSalida(false);
    setVistaPendiente(null);

    localStorage.removeItem('dashboardLive'); 
    localStorage.removeItem('inspeccionActiva');
    sessionStorage.clear();

    const API_URL = window.location.hostname.includes('goldanda.cl') 
      ? 'https://evap.maq.goldanda.cl' 
      : `http://${window.location.hostname || 'localhost'}:3001`;

    fetch(`${API_URL}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(err => console.log('Live limpiado (Descarte)', err));
  };

  const cancelarSalida = () => {
    setMostrarAlertaSalida(false);
    setVistaPendiente(null);
  };

  const [dbData, setDbData] = useState({
    exportadoras: [],
    variedades: [],
    productores: [],
    procesosExistentes: []
  });

  const cargarDatosMaestros = async () => {
    try {
      const API_URL = window.location.hostname.includes('goldanda.cl') 
        ? 'https://evap.maq.goldanda.cl' 
        : `http://${window.location.hostname || 'localhost'}:3001`;
      
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

      setDbData({
        exportadoras: Array.isArray(exportadorasDB) ? exportadorasDB.map(e => e.nombre) : [],
        variedades: Array.isArray(variedadesDB) ? variedadesDB.map(v => v.nombre) : [],
        productores: Array.isArray(huertosDB) ? huertosDB : [],
        procesosExistentes: Array.isArray(inspeccionesDB) ? inspeccionesDB.map(p => p.numProceso) : []
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
    localStorage.setItem('qc_user_session', JSON.stringify(userData));
    setCurrentView('home');
  };

  const handleLogout = () => {
    if (vistasProtegidas.includes(currentView)) {
      if(!window.confirm('Tienes un proceso sin guardar. ¿Estás seguro de descartarlo y cerrar sesión?')) return;
    } else {
      if(!window.confirm('¿Estás seguro de cerrar sesión?')) return;
    }
    
    localStorage.clear(); 
    sessionStorage.clear();

    const API_URL = window.location.hostname.includes('goldanda.cl') 
     ? 'https://evap.maq.goldanda.cl' 
     : `http://${window.location.hostname || 'localhost'}:3001`;
      
    fetch(`${API_URL}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).catch(err => console.log('Live limpiado (Logout)', err));

    setUser(null);
    setCurrentView('home');
    setIsCollapsed(false);
    setShowAjustes(false);
    setDashboardsAbierto(true);
    setShowDrawer(false);
    setDatosProcesoActivo(null);
  };

  const ModalAdvertencia = mostrarAlertaSalida ? (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">¿Seguro que deseas salir?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Tienes datos en pantalla que no han sido guardados. Si sales ahora, 
            <span className="font-bold text-slate-700"> todo el progreso se perderá </span> 
            y no podrás recuperarlo.
          </p>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
          <button onClick={cancelarSalida} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 bg-white border border-slate-200 rounded-xl text-xs transition-colors">
            No, quedarme
          </button>
          <button onClick={confirmarSalida} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm">
            Sí, salir y descartar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const ModalInactividad = mostrarAlertaInactividad ? (
    <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-center">
        <div className="p-8">
          <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3">¿Sigues ahí?</h3>
          <p className="text-sm text-slate-500 leading-relaxed px-4">
            Por tu seguridad, cerraremos tu sesión por inactividad en <span className="font-bold text-slate-800">pocos minutos</span>. ¿Deseas mantener tu sesión abierta?
          </p>
        </div>
        <div className="bg-slate-50 px-6 py-5 flex gap-3 justify-center border-t border-slate-100">
          <button onClick={mantenerSesionViva} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl w-full transition-colors shadow-md text-sm">
            Sí, seguir trabajando
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Rutas que ocupan pantalla completa sin Sidebar tradicional (para móvil o procesos en vivo)
  if (['nuevo-proceso', 'inspeccion', 'dashboard_live', 'dashboard_resumen', 'dashboard_historico'].includes(currentView)) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-slate-50 relative" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        
        {/* ESTILOS DE ANIMACIÓN GLOBAL INYECTADOS */}
        <style>{`
          @keyframes ping-radar {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .live-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
          }
          .live-dot-active {
            background-color: #10b981;
            animation: ping-radar 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
          }
          .live-dot-inactive {
            background-color: #94A3B8;
            box-shadow: none;
          }
        `}</style>

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
              setIsCollapsed(false);
              setDatosProcesoActivo(null);
            }} 
            onFinishedInspection={(num) => {
              localStorage.removeItem('dashboardLive'); 
              localStorage.removeItem('inspeccionActiva');
              sessionStorage.clear();
              cargarDatosMaestros(); 
              
              setCurrentView('historial');
              setIsCollapsed(true);
              setDatosProcesoActivo(null);
            }}
          />
        )}
        {currentView === 'dashboard_live' && (
          <DashboardLiveView onClose={() => intentarNavegar('home')} onAbrirMenu={() => setShowDrawer(true)} />
        )}
        {currentView === 'dashboard_resumen' && (
          <DashboardResumenDiario onClose={() => intentarNavegar('home')} onAbrirMenu={() => setShowDrawer(true)} />
        )}
        {currentView === 'dashboard_historico' && (
          <DashboardHistoricoTemporada onClose={() => intentarNavegar('home')} onAbrirMenu={() => setShowDrawer(true)} />
        )}

        {/* DRAWER MÓVIL (Mantiene clases idénticas al Sidebar Desktop para coherencia) */}
        {showDrawer && (
          <div className="fixed inset-0 z-[200] flex animate-fade-in">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDrawer(false)} />
            <aside className="relative w-[280px] max-w-[80vw] bg-[#FFFFFF] h-full shadow-2xl flex flex-col z-10 animate-slide-right border-r border-[#F1F5F9]">
              <div className="h-20 flex items-center justify-between border-b border-[#F1F5F9] px-5 shrink-0">
                <img src="/Logo_goldanda.png" alt="Gold Anda" className="h-9 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <button onClick={() => setShowDrawer(false)} className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                
                {['admin', 'qc'].includes(user.role) && (
                  <button onClick={() => intentarNavegar('nuevo-proceso')} className={`group w-full flex items-center px-4 py-3 bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#A7F3D0] hover:border-[#86EFAC] rounded-[14px] text-[#065F46] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_-2px_rgba(16,185,129,0.12)] active:scale-[0.98]`}>
                    <PlusCircle className={`w-5 h-5 text-[#059669] shrink-0 group-hover:rotate-90 group-hover:scale-[1.08] transition-transform duration-200`} />
                    <span className="text-[14px] font-semibold truncate ml-3">Crear Proceso</span>
                  </button>
                )}
                
                <button onClick={() => intentarNavegar('historial')} className={`group w-full flex items-center px-3.5 py-2.5 rounded-[10px] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${currentView === 'historial' ? 'bg-[#F8FAFC] text-[#0F172A]' : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:translate-x-[3px]'}`}>
                  <ClipboardList className="w-5 h-5 text-[#2563EB] shrink-0 group-hover:-rotate-[12deg] group-hover:scale-[1.05] transition-transform duration-150" />
                  <span className="text-[14px] font-semibold truncate ml-3">Historial</span>
                </button>
                
                {/* SECCIÓN ANÁLISIS */}
                <div className="pt-4 mt-2 mb-2 border-t border-[#F1F5F9]"><p className="px-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Análisis</p></div>
                <div className="flex flex-col">
                  <button onClick={() => setDashboardsAbierto(!dashboardsAbierto)} className={`group w-full flex items-center justify-between px-3.5 py-2.5 rounded-[10px] transition-all duration-150 ${dashboardsAbierto ? 'bg-[#FFF7ED] border border-[#FFEDD5] text-[#9A3412]' : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`}>
                    <div className="flex items-center">
                      {/* Icono de métricas actualizado */}
                      <LineChart className={`w-5 h-5 text-[#EA580C] shrink-0 ${!dashboardsAbierto && 'group-hover:scale-105'} transition-transform duration-150`} />
                      <span className="text-[14px] font-semibold truncate ml-3">Panel de métricas</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#EA580C] transition-transform duration-300 ${dashboardsAbierto ? 'rotate-180' : ''}`} />
                  </button>
                  {dashboardsAbierto && (
                    <div className="mt-1 flex flex-col space-y-1 animate-fade-in">
                      <button 
                        onClick={() => { intentarNavegar('dashboard_live'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }} 
                        className={`group flex items-center w-full text-left py-2 pr-3 rounded-lg transition-all duration-150 ${currentView === 'dashboard_live' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`live-dot ${datosProcesoActivo ? 'live-dot-active' : 'live-dot-inactive'}`}></span>
                          <span className="font-medium text-[13px]">Evap <span className="text-[11px] font-normal text-[#64748B]">(análisis en vivo)</span></span>
                        </div>
                      </button>
                      
                      <button 
                        onClick={() => { intentarNavegar('dashboard_resumen'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }}
                        className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-150 font-medium text-[13px] ${currentView === 'dashboard_resumen' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                      >
                        Resumen Diario
                      </button>

                      <button 
                        onClick={() => { intentarNavegar('dashboard_historico'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }}
                        className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-150 font-medium text-[13px] ${currentView === 'dashboard_historico' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                      >
                        Histórico Temporada
                      </button>
                    </div>
                  )}
                </div>

                {/* SECCIÓN ADMINISTRACIÓN */}
                {user.role === 'admin' && (
                  <>
                    <div className="pt-4 mt-2 mb-2 border-t border-[#F1F5F9]"><p className="px-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Administración</p></div>
                    <div className="flex flex-col">
                      <button onClick={() => setShowAjustes(!showAjustes)} className={`group w-full flex items-center justify-between px-3.5 py-2.5 rounded-[10px] transition-all duration-150 ${showAjustes ? 'bg-[#F8FAFC] text-[#0F172A]' : 'text-[#334155] hover:bg-[#F8FAFC]'}`}>
                        <div className="flex items-center">
                          <Settings className="w-5 h-5 text-[#334155] shrink-0 group-hover:rotate-45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                          <span className="text-[14px] font-semibold truncate ml-3">Ajustes</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform duration-300 ${showAjustes ? 'rotate-180' : ''}`} />
                      </button>
                      {showAjustes && (
                        <div className="mt-1 flex flex-col space-y-1 animate-fade-in">
                          {['exportadoras', 'variedades', 'huertos', 'parametros', 'usuarios'].map((item) => (
                            <button 
                              key={item}
                              onClick={() => intentarNavegar(`ajustes-${item}`)} 
                              className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-150 font-medium text-[13px] ${currentView === `ajustes-${item}` ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                            >
                              {item === 'huertos' ? 'Productores/Huertos' : item === 'parametros' ? 'Parámetros Calificación' : item.charAt(0).toUpperCase() + item.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </nav>
              <div className="p-3 border-t border-[#F1F5F9] bg-[#F8FAFC]">
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-center text-[#475569] font-bold shrink-0"><User className="w-5 h-5" /></div>
                  <div className="overflow-hidden">
                    <p className="text-[#0F172A] text-[14px] font-semibold capitalize truncate">{user.username}</p>
                    <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-[0.06em]">{user.role === 'admin' ? 'Administrador' : user.role === 'qc' ? 'Control Calidad' : 'Gerencia'}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="group w-full flex items-center justify-center gap-2 py-2.5 px-3.5 bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#FECACA] hover:bg-[#FEF2F2] text-[#334155] hover:text-[#DC2626] rounded-[12px] transition-all duration-150 text-[13px] font-semibold hover:shadow-[0_2px_6px_-1px_rgba(239,68,68,0.1)] active:scale-[0.98]">
                  <LogOut className="w-4 h-4 shrink-0 group-hover:translate-x-[3px] transition-transform duration-150" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </aside>
          </div>
        )}
        {ModalAdvertencia}
        {ModalInactividad}
      </div>
    );
  }

  // ================= VIEW DESKTOP PRINCIPAL (Sidebar Animado & Personalizado) =================
  return (
    <div className="flex h-screen bg-[#F4F7FA] overflow-hidden relative" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      
      {/* ESTILOS DE ANIMACIÓN GLOBAL INYECTADOS */}
      <style>{`
        @keyframes ping-radar {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .live-dot-active {
          background-color: #10b981;
          animation: ping-radar 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        .live-dot-inactive {
          background-color: #94A3B8;
          box-shadow: none;
        }
      `}</style>

      <aside className={`${isCollapsed ? 'w-20' : 'w-[260px]'} bg-[#FFFFFF] border-r border-[#F1F5F9] flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.02)] z-20 shrink-0 transition-all duration-300 relative`}>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-7 bg-white border border-[#E2E8F0] text-[#475569] rounded-full p-1 shadow-md hover:bg-[#F8FAFC] transition-colors z-30">
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className="h-20 flex items-center justify-center border-b border-[#F1F5F9] px-4 shrink-0">
          <img src="/Logo_goldanda.png" alt="Gold Anda" className={`${isCollapsed ? 'h-7' : 'h-10'} w-auto object-contain transition-all`} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          
          {['admin', 'qc'].includes(user.role) && (
            <button onClick={() => intentarNavegar('nuevo-proceso')} className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'} bg-[#F0FDF4] hover:bg-[#DCFCE7] border border-[#A7F3D0] hover:border-[#86EFAC] rounded-[14px] text-[#065F46] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_4px_12px_-2px_rgba(16,185,129,0.15)] active:scale-[0.98]`}>
              <PlusCircle className="w-5 h-5 text-[#059669] shrink-0 group-hover:rotate-90 group-hover:scale-[1.08] transition-transform duration-300" />
              {!isCollapsed && <span className="text-[14px] font-semibold truncate ml-3">Crear Proceso</span>}
            </button>
          )}
          
          <button onClick={() => intentarNavegar('historial')} className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'} rounded-[10px] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${currentView === 'historial' ? 'bg-[#F8FAFC] text-[#0F172A]' : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#0F172A] hover:translate-x-[3px]'}`}>
            <ClipboardList className="w-5 h-5 text-[#2563EB] shrink-0 group-hover:-rotate-[12deg] group-hover:scale-[1.05] transition-transform duration-200" />
            {!isCollapsed && <span className="text-[14px] font-semibold truncate ml-3">Historial</span>}
          </button>
          
          {/* SECCIÓN ANÁLISIS AGRUPADA */}
          <div className="pt-4 mt-2 mb-2 border-t border-[#F1F5F9]">
            {!isCollapsed && <p className="px-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Análisis</p>}
          </div>
          <div className="flex flex-col">
            <button 
              onClick={() => { if (isCollapsed) { setIsCollapsed(false); setDashboardsAbierto(true); } else { setDashboardsAbierto(!dashboardsAbierto); } }} 
              className={`group w-full flex items-center justify-between ${isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'} rounded-[10px] transition-all duration-200 ${dashboardsAbierto && !isCollapsed ? 'bg-[#FFF7ED] border border-[#FFEDD5] text-[#9A3412]' : 'text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'}`}
            >
              <div className="flex items-center">
                {/* Icono de métricas actualizado */}
                <LineChart className={`w-5 h-5 text-[#EA580C] shrink-0 ${!dashboardsAbierto ? 'group-hover:scale-105' : ''} transition-transform duration-200`} />
                {!isCollapsed && <span className="text-[14px] font-semibold truncate ml-3">Panel de métricas</span>}
              </div>
              {!isCollapsed && <ChevronDown className={`w-4 h-4 text-[#EA580C] transition-transform duration-300 ${dashboardsAbierto ? 'rotate-180' : ''}`} />}
            </button>
            
            {dashboardsAbierto && !isCollapsed && (
              <div className="mt-1 flex flex-col space-y-1 animate-fade-in">
                <button 
                  onClick={() => { intentarNavegar('dashboard_live'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }} 
                  className={`group flex items-center w-full text-left py-2 pr-3 rounded-lg transition-all duration-200 ${currentView === 'dashboard_live' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`live-dot ${datosProcesoActivo ? 'live-dot-active' : 'live-dot-inactive'}`}></span>
                    <span className="font-medium text-[13px]">Evap <span className="text-[11px] font-normal text-[#64748B]">(análisis en vivo)</span></span>
                  </div>
                </button>
                
                <button 
                  onClick={() => { intentarNavegar('dashboard_resumen'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }} 
                  className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-200 font-medium text-[13px] ${currentView === 'dashboard_resumen' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                >
                  Resumen Diario
                </button>

                <button 
                  onClick={() => { intentarNavegar('dashboard_historico'); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } catch (e) {} }} 
                  className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-200 font-medium text-[13px] ${currentView === 'dashboard_historico' ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                >
                  Histórico Temporada
                </button>
              </div>
            )}
          </div>

          {/* Permiso Sidebar: Solo Admin ve Ajustes */}
          {user.role === 'admin' && (
            <>
              <div className="pt-4 mt-2 mb-2 border-t border-[#F1F5F9]">
                {!isCollapsed && <p className="px-4 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">Administración</p>}
              </div>
              <div className="flex flex-col">
                <button 
                  onClick={() => { if (isCollapsed) setIsCollapsed(false); setShowAjustes(!showAjustes); }} 
                  className={`group w-full flex items-center justify-between ${isCollapsed ? 'justify-center px-0 py-2.5' : 'px-3.5 py-2.5'} rounded-[10px] transition-all duration-200 ${showAjustes ? 'bg-[#F8FAFC] text-[#0F172A]' : 'text-[#334155] hover:bg-[#F8FAFC]'}`}
                >
                  <div className="flex items-center">
                    <Settings className="w-5 h-5 text-[#334155] shrink-0 group-hover:rotate-45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                    {!isCollapsed && <span className="text-[14px] font-semibold truncate ml-3">Ajustes</span>}
                  </div>
                  {!isCollapsed && <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform duration-300 ${showAjustes ? 'rotate-180' : ''}`} />}
                </button>
                
                {showAjustes && !isCollapsed && (
                  <div className="mt-1 flex flex-col space-y-1 animate-fade-in">
                    {['exportadoras', 'variedades', 'huertos', 'parametros', 'usuarios'].map(item => (
                      <button 
                        key={item}
                        onClick={() => intentarNavegar(`ajustes-${item}`)} 
                        className={`group w-full text-left py-2 pr-3 rounded-lg transition-all duration-200 font-medium text-[13px] ${currentView === `ajustes-${item}` ? 'bg-[#F8FAFC] pl-[40px] text-[#0F172A]' : 'pl-[36px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:pl-[40px]'}`}
                      >
                        {item === 'huertos' ? 'Productores/Huertos' : item === 'parametros' ? 'Parámetros Calificación' : item.charAt(0).toUpperCase() + item.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
        
        <div className="p-3 border-t border-[#F1F5F9] bg-[#F8FAFC]">
          <div className={`flex items-center ${isCollapsed ? 'justify-center mb-3' : 'gap-3 mb-4 px-2'}`}>
            <div className="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-center text-[#475569] shadow-sm shrink-0"><User className="w-5 h-5" /></div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-[#0F172A] text-[14px] font-semibold capitalize truncate">{user.username}</p>
                <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-[0.06em]">
                  {user.role === 'admin' ? 'Administrador' : user.role === 'qc' ? 'Control Calidad' : 'Gerencia'}
                </p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={`group w-full flex items-center justify-center ${isCollapsed ? 'p-2.5' : 'gap-2 py-2.5 px-3.5'} bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#FECACA] hover:bg-[#FEF2F2] text-[#334155] hover:text-[#DC2626] rounded-[12px] transition-all duration-200 text-[13px] font-semibold hover:shadow-[0_2px_6px_-1px_rgba(239,68,68,0.1)] active:scale-[0.98]`}>
            <LogOut className="w-4 h-4 shrink-0 group-hover:translate-x-[3px] transition-transform duration-200" />
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
        
        {/* === RENDERIZADO DE MÓDULOS SEGÚN VISTA === */}
        {currentView === 'historial' && (
          <HistorialProcesosView 
            onVerResumen={(proceso) => console.log('Resumen:', proceso)} 
            userRole={user.role}
          />
        )}
        {currentView === 'ajustes-exportadoras' && <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in"><GestionExportadoras exportadoras={dbData.exportadoras} setExportadoras={(nuevas) => setDbData(prev => ({ ...prev, exportadoras: nuevas }))} /></div>}
        {currentView === 'ajustes-variedades' && <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in"><GestionVariedades variedades={dbData.variedades} setVariedades={(nuevas) => setDbData(prev => ({ ...prev, variedades: nuevas }))} /></div>}
        {currentView === 'ajustes-huertos' && <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in"><TablaHuertos exportadoras={dbData.exportadoras} productores={dbData.productores} setProductores={(nuevos) => setDbData(prev => ({ ...prev, productores: nuevos }))} /></div>}
        {currentView === 'ajustes-parametros' && <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in"><ParametrosCalificacion /></div>}
        {currentView === 'ajustes-usuarios' && <div className="p-6 md:p-8 overflow-y-auto h-full animate-fade-in"><GestionUsuarios /></div>}
      </main>

      {ModalAdvertencia}
      {ModalInactividad}
    </div>
  );
}
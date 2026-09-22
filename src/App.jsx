import React, { useState, useEffect, useRef } from 'react';
import Login from './modules/dashboardLive/Login';
import DashboardLiveView from './modules/dashboardLive/DashboardLiveView';

import NuevoProceso from './modules/inspeccion/NuevoProceso';
import InspeccionModule from './modules/inspeccion/InspeccionModule';

import HistorialProcesosView from './modules/historial/HistorialProcesosView';
import GestionExportadoras from './modules/ajustes/GestionExportadoras';
import GestionVariedades from './modules/ajustes/GestionVariedades';
import TablaHuertos from './modules/ajustes/TablaHuertos';
import ParametrosCalificacion from './modules/ajustes/ParametrosCalificacion';
import GestionUsuarios from './modules/ajustes/GestionUsuarios'; // <-- NUEVO IMPORT

import { 
  LogOut, PlusCircle, ClipboardList, LayoutDashboard, Settings, User, 
  ChevronLeft, ChevronRight, ChevronDown, X, Users
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('qc_user_session');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [currentView, setCurrentView] = useState('home');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAjustes, setShowAjustes] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [datosProcesoActivo, setDatosProcesoActivo] = useState(null);

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
    
    const API_URL = import.meta.env.PROD 
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

    if (['historial', 'dashboard', 'ajustes-exportadoras', 'ajustes-variedades', 'ajustes-huertos', 'ajustes-parametros', 'ajustes-usuarios'].includes(nuevaVista)) {
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
    
    if (['historial', 'dashboard', 'ajustes-exportadoras', 'ajustes-variedades', 'ajustes-huertos', 'ajustes-parametros', 'ajustes-usuarios'].includes(vistaPendiente)) {
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

    const API_URL = import.meta.env.PROD 
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
      const API_URL = import.meta.env.PROD 
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

    const API_URL = import.meta.env.PROD 
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
            onVolver={() => intentarNavegar('home')} 
            onFinishedInspection={(num) => {
              localStorage.removeItem('dashboardLive'); 
              localStorage.removeItem('inspeccionActiva');
              sessionStorage.clear();
              cargarDatosMaestros(); 
              intentarNavegar('historial'); 
              setDatosProcesoActivo(null);
            }}
          />
        )}
        {currentView === 'dashboard' && (
          <DashboardLiveView onClose={() => intentarNavegar('home')} onAbrirMenu={() => setShowDrawer(true)} />
        )}

        {/* DRAWER MÓVIL */}
        {showDrawer && (
          <div className="fixed inset-0 z-[200] flex animate-fade-in">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowDrawer(false)} />
            <aside className="relative w-[280px] max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-right">
              <div className="h-20 flex items-center justify-between border-b border-slate-100 px-5 shrink-0">
                <img src="/Logo_goldanda.png" alt="Gold Anda" className="h-9 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                <button onClick={() => setShowDrawer(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                
                {/* Permisos Drawer: Admin y QC pueden Crear */}
                {['admin', 'qc'].includes(user.role) && (
                  <button onClick={() => intentarNavegar('nuevo-proceso')} className="w-full flex items-center px-4 py-3 rounded-xl bg-orange-50 text-[#E96008] font-bold text-left text-sm">
                    <PlusCircle className="w-5 h-5 text-[#E96008] shrink-0 mr-3" /><span>Crear Proceso</span>
                  </button>
                )}
                
                <button onClick={() => intentarNavegar('historial')} className="w-full flex items-center px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                  <ClipboardList className="w-5 h-5 text-blue-600 shrink-0 mr-3" /><span>Historial</span>
                </button>
                
                {/* Todos pueden ver Dashboard */}
                <button onClick={() => intentarNavegar('dashboard')} className="w-full flex items-center px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                  <LayoutDashboard className="w-5 h-5 text-[#E96008] shrink-0 mr-3" /><span>Dashboard Live</span>
                </button>

                {/* Permisos Drawer: Solo Admin ve Ajustes */}
                {user.role === 'admin' && (
                  <>
                    <div className="pt-4 mt-2 mb-2 border-t border-slate-100"><p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Administración</p></div>
                    <div className="flex flex-col">
                      <button onClick={() => setShowAjustes(!showAjustes)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold text-left text-sm">
                        <div className="flex items-center"><Settings className="w-5 h-5 text-slate-600 shrink-0 mr-3" /><span>Ajustes</span></div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAjustes ? 'rotate-180' : ''}`} />
                      </button>
                      {showAjustes && (
                        <div className="mt-1 pl-12 flex flex-col space-y-1">
                          <button onClick={() => intentarNavegar('ajustes-exportadoras')} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Exportadoras</button>
                          <button onClick={() => intentarNavegar('ajustes-variedades')} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Variedades</button>
                          <button onClick={() => intentarNavegar('ajustes-huertos')} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Productores/Huertos</button>
                          <button onClick={() => intentarNavegar('ajustes-parametros')} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Parámetros Calificación</button>
                          <button onClick={() => intentarNavegar('ajustes-usuarios')} className="text-left text-sm py-2 px-3 text-slate-500 hover:text-slate-900 rounded-lg">Usuarios</button>
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
        {ModalAdvertencia}
        {ModalInactividad}
      </div>
    );
  }

  // ================= VIEW DESKTOP PRINCIPAL =================
  return (
    <div className="flex h-screen bg-[#F4F7FA] font-sans overflow-hidden relative">
      <aside className={`${isCollapsed ? 'w-20' : 'w-[260px]'} bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 shrink-0 transition-all duration-300 relative`}>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute -right-3 top-7 bg-white border border-slate-200 text-slate-600 rounded-full p-1 shadow-md hover:bg-slate-50 transition-colors z-30">
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 px-4 shrink-0">
          <img src="/Logo_goldanda.png" alt="Gold Anda" className={`${isCollapsed ? 'h-7' : 'h-10'} w-auto object-contain transition-all`} onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          
          {/* Permiso Sidebar: Admin y QC pueden Crear */}
          {['admin', 'qc'].includes(user.role) && (
            <button onClick={() => intentarNavegar('nuevo-proceso')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${currentView === 'nuevo-proceso' ? 'bg-orange-50 text-[#E96008] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
              <PlusCircle className="w-6 h-6 text-green-600 shrink-0" />{!isCollapsed && <span className="text-sm truncate ml-3 font-semibold">Crear Proceso</span>}
            </button>
          )}
          
          <button onClick={() => intentarNavegar('historial')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${currentView === 'historial' ? 'bg-orange-50 text-[#E96008] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
            <ClipboardList className="w-6 h-6 text-blue-600 shrink-0" />{!isCollapsed && <span className="text-sm truncate ml-3">Historial</span>}
          </button>
          
          <div className="pt-4 mt-2 mb-2 border-t border-slate-100">{!isCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Análisis</p>}</div>
          <button onClick={() => intentarNavegar('dashboard')} className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${currentView === 'dashboard' ? 'bg-orange-50 text-[#E96008] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
            <LayoutDashboard className="w-6 h-6 text-[#E96008] shrink-0" />{!isCollapsed && <span className="text-sm truncate ml-3">Dashboard Live</span>}
          </button>

          {/* Permiso Sidebar: Solo Admin ve Ajustes */}
          {user.role === 'admin' && (
            <>
              <div className="pt-4 mt-2 mb-2 border-t border-slate-100">{!isCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Administración</p>}</div>
              <div className="flex flex-col">
                <button onClick={() => { if (isCollapsed) setIsCollapsed(false); setShowAjustes(!showAjustes); }} className={`w-full flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-xl transition-all text-left ${showAjustes ? 'bg-slate-50 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}>
                  <div className="flex items-center"><Settings className="w-6 h-6 text-slate-600 shrink-0" />{!isCollapsed && <span className="text-sm truncate ml-3">Ajustes</span>}</div>
                  {!isCollapsed && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAjustes ? 'rotate-180' : ''}`} />}
                </button>
                {showAjustes && !isCollapsed && (
                  <div className="mt-1 pl-12 flex flex-col space-y-1 animate-fade-in">
                    <button onClick={() => intentarNavegar('ajustes-exportadoras')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-exportadoras' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Exportadoras</button>
                    <button onClick={() => intentarNavegar('ajustes-variedades')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-variedades' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Variedades</button>
                    <button onClick={() => intentarNavegar('ajustes-huertos')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-huertos' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Productores/Huertos</button>
                    <button onClick={() => intentarNavegar('ajustes-parametros')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-parametros' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>Parámetros Calificación</button>
                    <button onClick={() => intentarNavegar('ajustes-usuarios')} className={`text-left text-sm py-2 px-3 rounded-lg transition-colors ${currentView === 'ajustes-usuarios' ? 'text-[#E96008] font-bold bg-orange-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                       Usuarios
                    </button>
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
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                  {user.role === 'admin' ? 'Administrador' : user.role === 'qc' ? 'Control Calidad' : 'Gerencia'}
                </p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={`w-full flex items-center justify-center ${isCollapsed ? 'p-2.5' : 'gap-2 py-2.5'} bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors text-sm font-bold shadow-sm`}>
            <LogOut className="w-4 h-4 shrink-0" />{!isCollapsed && <span>Cerrar Sesión</span>}
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
            userRole={user.role} // <-- Enviamos el rol al historial para bloquear la edición a la Gerencia si es necesario en el futuro
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
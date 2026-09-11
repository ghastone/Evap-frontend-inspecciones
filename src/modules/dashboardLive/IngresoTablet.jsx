import React, { useState } from 'react';
import { Wifi, WifiOff, Save, Plus, Minus, RotateCcw, AlertTriangle } from 'lucide-react';

// Listas de defectos de ejemplo (adaptadas de tu dashboard)
const DEFECTOS_CALIDAD = ['Manchas', 'Piel de sapo', 'Cicatriz', 'Falta de color', 'Herida abierta', 'Daño de pájaro', 'Forma', 'Russet'];
const DEFECTOS_CONDICION = ['Blando', 'Deshidratación', 'Pudrición', 'Machucón', 'Partidura', 'Daño por frío', 'Pardeamiento'];

export default function IngresoTablet() {
  // Estado de conexión simulado (Para la PWA)
  const [isOnline, setIsOnline] = useState(true);
  
  // Pestañas: 'frutos', 'calidad', 'condicion'
  const [activeTab, setActiveTab] = useState('frutos');

  // Estado de los datos de la caja actual
  const [cajaActual, setCajaActual] = useState({
    totalFrutos: 100,
    brixLight: '',
    brixDark: '',
    defCalidad: {},
    defCondicion: {}
  });

  // Función para manejar el +/- de los defectos
  const updateDefecto = (tipo, defecto, cantidad) => {
    setCajaActual(prev => {
      const currentVal = prev[tipo][defecto] || 0;
      const newVal = Math.max(0, currentVal + cantidad); // No permite negativos
      return {
        ...prev,
        [tipo]: { ...prev[tipo], [defecto]: newVal }
      };
    });
  };

  const resetCaja = () => {
    if(window.confirm('¿Borrar los datos de esta caja y empezar de nuevo?')) {
      setCajaActual({ totalFrutos: 100, brixLight: '', brixDark: '', defCalidad: {}, defCondicion: {} });
      setActiveTab('frutos');
    }
  };

  const guardarCaja = () => {
    // Aquí iría el fetch o la subida por WebSockets a tu servidor
    console.log("Caja guardada:", cajaActual);
    alert('¡Caja guardada con éxito!');
    // Limpiamos para la siguiente caja
    setCajaActual({ totalFrutos: 100, brixLight: '', brixDark: '', defCalidad: {}, defCondicion: {} });
    setActiveTab('frutos');
  };

  // Cálculos rápidos para el pie de página
  const totalCalidad = Object.values(cajaActual.defCalidad).reduce((a, b) => a + b, 0);
  const totalCondicion = Object.values(cajaActual.defCondicion).reduce((a, b) => a + b, 0);

  return (
    // select-none evita que el usuario resalte texto al tocar rápido
    // overflow-hidden y h-screen fijan la PWA como una app nativa
    <div className="h-screen w-full bg-slate-100 flex flex-col select-none overflow-hidden font-sans">
      
      {/* 1. HEADER (Datos fijos del proceso) */}
      <header className="bg-slate-800 text-white shadow-md flex-none">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600">
              <span className="text-slate-400 text-[11px] uppercase font-bold block leading-none mb-1">Proceso</span>
              <span className="text-white text-[16px] font-bold leading-none">#12345</span>
            </div>
            <div>
              <h1 className="text-[18px] font-bold leading-tight">AgroIndustrial El Monte</h1>
              <p className="text-slate-300 text-[14px] leading-none mt-0.5">Variedad: Nashi Kosui</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Indicador de Red para la PWA */}
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-green-900/50 border-green-500/30' : 'bg-red-900/50 border-red-500/30 animate-pulse'}`}
              onClick={() => setIsOnline(!isOnline)} // Solo para probar el diseño
            >
              {isOnline ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
              <span className={`text-[13px] font-bold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE (Guardando local)'}
              </span>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex px-2 pt-2 bg-slate-900">
          <button 
            onClick={() => setActiveTab('frutos')}
            className={`flex-1 py-3 px-2 text-[16px] font-bold text-center rounded-t-xl transition-colors ${activeTab === 'frutos' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            1. Datos Generales
          </button>
          <button 
            onClick={() => setActiveTab('calidad')}
            className={`flex-1 py-3 px-2 text-[16px] font-bold text-center rounded-t-xl transition-colors ${activeTab === 'calidad' ? 'bg-slate-100 text-[#EA580C]' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            2. Calidad ({totalCalidad})
          </button>
          <button 
            onClick={() => setActiveTab('condicion')}
            className={`flex-1 py-3 px-2 text-[16px] font-bold text-center rounded-t-xl transition-colors ${activeTab === 'condicion' ? 'bg-slate-100 text-[#DC2626]' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            3. Condición ({totalCondicion})
          </button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL DE INGRESO (Scrollable) */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100">
        
        {/* PESTAÑA 1: DATOS GENERALES */}
        {activeTab === 'frutos' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Total de Frutos */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-[18px] font-bold text-slate-700 mb-4 text-center">Total de frutos en la caja</h2>
              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={() => setCajaActual(p => ({...p, totalFrutos: Math.max(1, p.totalFrutos - 5)}))}
                  className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                >
                  <Minus className="w-8 h-8" />
                </button>
                <div className="text-[64px] font-black text-slate-800 w-32 text-center leading-none">
                  {cajaActual.totalFrutos}
                </div>
                <button 
                  onClick={() => setCajaActual(p => ({...p, totalFrutos: p.totalFrutos + 5}))}
                  className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-100 active:bg-blue-200"
                >
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Sólidos Solubles (Brix) */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center">
                <h2 className="text-[16px] font-bold text-slate-500 mb-4 uppercase">Brix Light Promedio</h2>
                <input 
                  type="number" step="0.1" placeholder="Ej: 14.5"
                  value={cajaActual.brixLight}
                  onChange={(e) => setCajaActual(p => ({...p, brixLight: e.target.value}))}
                  className="w-full text-center text-[32px] font-black text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center">
                <h2 className="text-[16px] font-bold text-slate-500 mb-4 uppercase">Brix Dark Promedio</h2>
                <input 
                  type="number" step="0.1" placeholder="Ej: 15.2"
                  value={cajaActual.brixDark}
                  onChange={(e) => setCajaActual(p => ({...p, brixDark: e.target.value}))}
                  className="w-full text-center text-[32px] font-black text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
            
            {/* Aviso visual para avanzar */}
            <div className="flex justify-center mt-8">
              <button 
                onClick={() => setActiveTab('calidad')}
                className="bg-slate-800 text-white px-8 py-4 rounded-xl text-[18px] font-bold shadow-lg active:scale-95 transition-transform"
              >
                Continuar a Defectos &rarr;
              </button>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: DEFECTOS DE CALIDAD */}
        {activeTab === 'calidad' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in">
            {DEFECTOS_CALIDAD.map(defecto => {
              const cantidad = cajaActual.defCalidad[defecto] || 0;
              return (
                <div key={defecto} className={`bg-white rounded-2xl p-3 shadow-sm border-2 transition-colors ${cantidad > 0 ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}>
                  <h3 className="text-[16px] font-bold text-slate-700 text-center mb-3 h-10 flex items-center justify-center leading-tight">
                    {defecto}
                  </h3>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button 
                      onClick={() => updateDefecto('defCalidad', defecto, -1)}
                      className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${cantidad > 0 ? 'bg-white text-slate-600 shadow border border-slate-200 active:bg-slate-100' : 'bg-transparent text-slate-300'}`}
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <span className={`text-[28px] font-black w-12 text-center ${cantidad > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                      {cantidad}
                    </span>
                    <button 
                      onClick={() => updateDefecto('defCalidad', defecto, 1)}
                      className="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 shadow flex items-center justify-center border border-orange-200 active:bg-orange-200"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PESTAÑA 3: DEFECTOS DE CONDICIÓN */}
        {activeTab === 'condicion' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in">
            {DEFECTOS_CONDICION.map(defecto => {
              const cantidad = cajaActual.defCondicion[defecto] || 0;
              return (
                <div key={defecto} className={`bg-white rounded-2xl p-3 shadow-sm border-2 transition-colors ${cantidad > 0 ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
                  <h3 className="text-[16px] font-bold text-slate-700 text-center mb-3 h-10 flex items-center justify-center leading-tight">
                    {defecto}
                  </h3>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button 
                      onClick={() => updateDefecto('defCondicion', defecto, -1)}
                      className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${cantidad > 0 ? 'bg-white text-slate-600 shadow border border-slate-200 active:bg-slate-100' : 'bg-transparent text-slate-300'}`}
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <span className={`text-[28px] font-black w-12 text-center ${cantidad > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {cantidad}
                    </span>
                    <button 
                      onClick={() => updateDefecto('defCondicion', defecto, 1)}
                      className="w-12 h-12 rounded-lg bg-red-100 text-red-600 shadow flex items-center justify-center border border-red-200 active:bg-red-200"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 3. FOOTER (Resumen y Botón de Guardar gigante) */}
      <footer className="bg-white border-t border-slate-200 p-4 flex-none shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          
          {/* Botón Reset */}
          <button 
            onClick={resetCaja}
            className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center border border-slate-200 active:bg-slate-200 shrink-0"
          >
            <RotateCcw className="w-7 h-7" />
          </button>

          {/* Resumen para el operario */}
          <div className="hidden md:flex gap-6 items-center">
            <div className="text-center">
              <span className="text-[12px] font-bold text-slate-400 block uppercase">Frutos</span>
              <span className="text-[20px] font-black text-slate-800 leading-none">{cajaActual.totalFrutos}</span>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <span className="text-[12px] font-bold text-orange-400 block uppercase">D. Calidad</span>
              <span className="text-[20px] font-black text-orange-600 leading-none">{totalCalidad}</span>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <span className="text-[12px] font-bold text-red-400 block uppercase">D. Condición</span>
              <span className="text-[20px] font-black text-red-600 leading-none">{totalCondicion}</span>
            </div>
          </div>

          {/* Alerta si no ha ingresado defectos */}
          {(totalCalidad === 0 && totalCondicion === 0) && activeTab !== 'frutos' && (
            <div className="hidden lg:flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-[13px] font-bold">Caja limpia (0 defectos)</span>
            </div>
          )}

          {/* BOTÓN GUARDAR GIGANTE */}
          <button 
            onClick={guardarCaja}
            className="flex-1 max-w-sm h-16 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all"
          >
            <Save className="w-7 h-7" />
            <span className="text-[20px] font-black uppercase tracking-wide">Guardar Caja</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
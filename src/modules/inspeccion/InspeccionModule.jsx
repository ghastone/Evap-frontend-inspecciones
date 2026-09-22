import React, { useState, useEffect } from 'react';
import { 
  Check, AlertTriangle, Menu, 
  Edit3, Trash2, X, ArrowLeft 
} from 'lucide-react';

const defectosCalidadBase = {
  'Frutos deformes / dobles': 0, 'Daños de trips': 0, 'Golpe de sol': 0, 'Manchas': 0, 'Sutura (severa)': 0, 'Herida cicatrizada': 0,
  'Desuniformidad de color': 0, 'Russet': 0, 'Fruta sin pedicelo': 0, 'Falta de color': 0, 'Bajo calibre': 0, 'Sobre calibre': 0
};
const defectosCondicionBase = {
  'Pudrición': 0, 'Mancha parda': 0, 'Herida de insecto': 0, 'Herida de pájaro': 0, 'Herida abierta': 0, 'Partidura por agua': 0,
  'Virosis': 0, 'Partiduras laterales': 0, 'Partiduras apicales': 0, 'Machucón': 0, 'Pitting severo': 0, 'Fruta blanda': 0,
  'Sobre madurez': 0, 'Quemado de sol': 0, 'Desgarro pedicelar': 0, 'Medias lunas': 0, 'Pitting leve': 0, 'Piel de lagarto': 0
};

export default function InspeccionModule({ 
  datosProceso, 
  onFinishedInspection, 
  onAbrirMenu,
  onVolver
}) {
  const { numProceso, exportadoraSel, csgSel, variedadSel, productorNombre } = datosProceso || {};

  const [tabDefectos, setTabDefectos] = useState('calidad'); 
  const [showModalFinalizar, setShowModalFinalizar] = useState(false);
  const [showModalCancelar, setShowModalCancelar] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [haVistoCondicion, setHaVistoCondicion] = useState(false);

  // ESTADOS PRINCIPALES DE LOS DATOS
  const [cajas, setCajas] = useState([]);
  const [cajaActual, setCajaActual] = useState({
    numCaja: 1, frutos: '100', calibre: '', brix: '', color: '',
    defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase }
  });

  const [cajaEnEdicion, setCajaEnEdicion] = useState(null);
  const [cajaIndexEdicion, setCajaIndexEdicion] = useState(null);
  const [tabDefectosEdicion, setTabDefectosEdicion] = useState('calidad');

  const hideSpinners = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const headerCompleto = cajaActual.frutos !== '' && cajaActual.calibre !== '' && cajaActual.color !== '' && cajaActual.brix !== '';

  const API_URL = import.meta.env.PROD 
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  // ==========================================
  // LÓGICA DE AUTOGUARDADO (LOCALSTORAGE)
  // ==========================================
  const DRAFT_KEY = `draft_inspeccion_${numProceso}`;

  // 1. Cargar borrador al montar el componente (Si existe)
  useEffect(() => {
    if (!numProceso) return;
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setCajas(parsed.cajas || []);
        if (parsed.cajaActual) setCajaActual(parsed.cajaActual);
        setMensajeExito('Borrador restaurado correctamente');
        setTimeout(() => setMensajeExito(''), 3000);
      }
    } catch (e) {
      console.warn("Error leyendo borrador local", e);
    }
  }, [numProceso, DRAFT_KEY]);

  // 2. Guardar borrador automáticamente ante CUALQUIER cambio en cajas o cajaActual
  useEffect(() => {
    if (!numProceso) return;
    const draft = { cajas, cajaActual };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [cajas, cajaActual, numProceso, DRAFT_KEY]);

  // Función para limpiar el borrador una vez finalizado o cancelado el proceso
  const limpiarBorrador = () => {
    localStorage.removeItem(DRAFT_KEY);
  };
  // ==========================================

  // Envío de datos al Dashboard en vivo (Broadcast)
  useEffect(() => {
    const payload = {
      numProceso, exportadora: exportadoraSel, productor: productorNombre, variedad: variedadSel, csg: csgSel,
      cajas: cajas, cajaActual: headerCompleto ? cajaActual : null 
    };
    fetch(`${API_URL}/api/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.log('Error enviando datos en vivo:', err));
  }, [cajas, cajaActual, headerCompleto, numProceso, exportadoraSel, productorNombre, variedadSel, csgSel, API_URL]);

  const actualizarDefecto = (tipo, def, valor) => {
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setCajaActual(prev => ({ 
      ...prev, [tipo === 'calidad' ? 'defCalidad' : 'defCondicion']: { ...prev[tipo === 'calidad' ? 'defCalidad' : 'defCondicion'], [def]: val } 
    }));
  };

  const calcularPctGlobalDefecto = (tipoStr, def) => {
    let tFrutos = parseInt(cajaActual.frutos) || 0;
    let tDefecto = parseInt(cajaActual[tipoStr][def]) || 0;
    cajas.forEach(c => {
      tFrutos += parseInt(c.frutos) || 0;
      tDefecto += parseInt(c[tipoStr][def]) || 0;
    });
    return tFrutos === 0 ? '0.0' : ((tDefecto / tFrutos) * 100).toFixed(1);
  };

  const totalesCaja = () => {
    const tCal = Object.values(cajaActual.defCalidad).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const tCond = Object.values(cajaActual.defCondicion).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const f = parseInt(cajaActual.frutos) || 0;
    const pCal = f ? (tCal / f) * 100 : 0;
    const pCond = f ? (tCond / f) * 100 : 0;
    return { cal: pCal.toFixed(1), cond: pCond.toFixed(1), exp: f ? Math.max(0, 100 - pCal - pCond).toFixed(1) : '100.0' };
  };

  const manejarCambioBrix = (e, esEdicion = false) => {
    let val = e.target.value.replace(',', '.');
    val = val.replace(/[^0-9.]/g, ''); 
    if ((val.match(/\./g) || []).length > 1) return; 

    if (esEdicion) {
      setCajaEnEdicion(prev => ({ ...prev, brix: val }));
    } else {
      setCajaActual(prev => ({ ...prev, brix: val }));
    }
  };

  const guardarCaja = () => {
    if (!headerCompleto) return alert("Completa Muestra, Calibre, Color de embalaje y °Brix.");

    const brixVal = parseFloat(cajaActual.brix);
    if (!isNaN(brixVal) && brixVal > 30) {
      if (!window.confirm(`El valor de °Brix ingresado (${brixVal}) es superior a 30. ¿Estás seguro de que el valor es correcto?`)) {
        return;
      }
    }

    setCajas([...cajas, { ...cajaActual, id: Date.now() }]);
    setCajaActual({ 
      numCaja: cajas.length + 2, frutos: '100', calibre: '', brix: '', color: '', 
      defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase } 
    });
    
    setHaVistoCondicion(false);
    setTabDefectos('calidad');
    
    setMensajeExito('Caja guardada correctamente');
    setTimeout(() => { setMensajeExito(''); }, 2500);
  };

  const abrirModalEdicionCaja = (caja, index) => {
    setCajaEnEdicion(JSON.parse(JSON.stringify(caja)));
    setCajaIndexEdicion(index);
    setTabDefectosEdicion('calidad');
  };

  const handleEdicionCampo = (campo, valor) => {
    setCajaEnEdicion(prev => ({ ...prev, [campo]: valor }));
  };

  const handleEdicionDefecto = (tipoDef, def, valor) => {
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setCajaEnEdicion(prev => ({
      ...prev, [tipoDef]: { ...prev[tipoDef], [def]: val }
    }));
  };

  const guardarCambiosCajaEditada = () => {
    const brixVal = parseFloat(cajaEnEdicion.brix);
    if (!isNaN(brixVal) && brixVal > 30) {
      if (!window.confirm(`El valor de °Brix ingresado (${brixVal}) es superior a 30. ¿Estás seguro de que el valor es correcto?`)) {
        return;
      }
    }

    const nuevasCajas = [...cajas];
    nuevasCajas[cajaIndexEdicion] = cajaEnEdicion;
    setCajas(nuevasCajas);
    setCajaEnEdicion(null);
    setCajaIndexEdicion(null);
    setMensajeExito('Caja actualizada correctamente');
    setTimeout(() => { setMensajeExito(''); }, 2500);
  };

  const eliminarCajaGuardada = (index) => {
    if (window.confirm(`¿Seguro que deseas eliminar la Caja #${cajas[index]?.numCaja}?`)) {
      const filtradas = cajas.filter((_, i) => i !== index);
      const reindexadas = filtradas.map((c, i) => ({ ...c, numCaja: i + 1 }));
      setCajas(reindexadas);
      setCajaActual(prev => ({ ...prev, numCaja: reindexadas.length + 1 }));
      setCajaEnEdicion(null);
      setCajaIndexEdicion(null);
    }
  };

  const confirmarCancelarProceso = async () => {
    try {
      await fetch(`${API_URL}/api/live`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({}) 
      });
    } catch (err) {
      console.log('Error limpiando live process:', err);
    }
    limpiarBorrador(); // Borramos el autoguardado porque el usuario decidió cancelar todo
    setShowModalCancelar(false);
    if (onVolver) onVolver();
  };

  let acumuladoFrutos = parseInt(cajaActual.frutos) || 0;
  let acumuladoCal = Object.values(cajaActual.defCalidad).reduce((a, b) => a + (parseInt(b) || 0), 0);
  let acumuladoCond = Object.values(cajaActual.defCondicion).reduce((a, b) => a + (parseInt(b) || 0), 0);
  let sumBrixLight = 0, countBrixLight = 0, sumBrixDark = 0, countBrixDark = 0;

  if (cajaActual.brix && parseFloat(cajaActual.brix) > 0) {
    if (cajaActual.color === 'Light') { sumBrixLight += parseFloat(cajaActual.brix); countBrixLight++; }
    if (cajaActual.color === 'Dark') { sumBrixDark += parseFloat(cajaActual.brix); countBrixDark++; }
  }

  cajas.forEach(c => {
    const f = parseInt(c.frutos) || 0;
    acumuladoFrutos += f;
    if (c.brix && parseFloat(c.brix) > 0) {
      if (c.color === 'Light') { sumBrixLight += parseFloat(c.brix); countBrixLight++; }
      if (c.color === 'Dark') { sumBrixDark += parseFloat(c.brix); countBrixDark++; }
    }
    Object.values(c.defCalidad || {}).forEach(v => acumuladoCal += (parseInt(v) || 0));
    Object.values(c.defCondicion || {}).forEach(v => acumuladoCond += (parseInt(v) || 0));
  });

  const pCalGlobal = acumuladoFrutos ? (acumuladoCal / acumuladoFrutos) * 100 : 0;
  const pCondGlobal = acumuladoFrutos ? (acumuladoCond / acumuladoFrutos) * 100 : 0;
  const pExpGlobal = acumuladoFrutos ? Math.max(0, 100 - pCalGlobal - pCondGlobal) : 100;
  const califLetter = pCalGlobal <= 5 ? 'A' : pCalGlobal <= 10 ? 'B' : 'C';
  const califNum = pCondGlobal <= 5 ? '1' : pCondGlobal <= 10 ? '2' : '3';
  const notaGlobal = acumuladoFrutos ? `${califLetter}${califNum}` : '-';
  const estadoGlobal = acumuladoFrutos ? ((califLetter === 'C' || califNum === '3') ? 'Objetado' : 'Aprobado') : '-';
  const promLight = countBrixLight ? (sumBrixLight / countBrixLight).toFixed(1).replace('.', ',') : '0,0';
  const promDark = countBrixDark ? (sumBrixDark / countBrixDark).toFixed(1).replace('.', ',') : '0,0';
  const totalCajasBanner = cajas.length + ((parseInt(cajaActual.frutos) || 0) > 0 ? 1 : 0);
  const totalDefCalidadActual = Object.values(cajaActual.defCalidad).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const totalDefCondicionActual = Object.values(cajaActual.defCondicion).reduce((a, b) => a + (parseInt(b) || 0), 0);

  const enviarInspeccionAlServidor = async () => {
    let cajasFinales = headerCompleto ? [...cajas, cajaActual] : [...cajas];
    if (cajasFinales.length === 0) return alert("No has evaluado ninguna caja.");

    try {
      const payload = { numProceso, exportadora: exportadoraSel, csg: csgSel, variedad: variedadSel, estado: estadoGlobal, cajas: cajasFinales };
      const response = await fetch(`${API_URL}/api/inspecciones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json(); 
      if (response.ok) {
        await fetch(`${API_URL}/api/live`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({}) 
        });
        limpiarBorrador(); // Eliminamos el autoguardado porque ya se envió exitosamente al servidor
        alert("¡Proceso guardado exitosamente!");
        if (onFinishedInspection) onFinishedInspection(parseInt(numProceso, 10));
      } else { alert("❌ ERROR DEL SERVIDOR: " + (data.error || "Error al guardar")); }
    } catch (err) { alert("❌ ERROR DE CONEXIÓN: No se pudo contactar al servidor Backend."); }
  };

  const rend = totalesCaja();

  return (
    <div className="w-full h-full bg-[#F4F7FA] overflow-y-auto custom-scrollbar animate-fade-in relative">
      
      {mensajeExito && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#00A859] text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 border border-green-600 text-sm animate-bounce">
          <Check className="w-5 h-5" /> {mensajeExito}
        </div>
      )}

      <div className="max-w-[1600px] mx-auto flex flex-col gap-3 py-3 px-3 sm:px-6 lg:px-8 font-sans w-full pb-10">
        
        {/* CABECERA */}
        <div className="flex justify-between items-center w-full mt-1">
          <div className="flex items-center gap-3">
            {onAbrirMenu && (
              <button type="button" onClick={onAbrirMenu} className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl shadow-sm">
                <Menu className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            )}
            <div>
              <h1 className="text-[19px] md:text-2xl font-black text-[#0F172A] leading-tight">Inspección producto<br className="md:hidden"/> terminado</h1>
              {/* Texto Productor / Variedad ajustado a 14px (text-sm) en móvil */}
              <p className="text-sm md:text-sm text-slate-500 font-semibold uppercase">{productorNombre || 'Ingreso en vivo'} - {variedadSel}</p>
            </div>
          </div>
          <img src="/Logo_goldanda.png" alt="Logo" className="h-7 md:h-10 object-contain hidden sm:block" />
        </div>
        
        {/* BANNER ACUMULADO */}
        <div className="bg-[#E96008] rounded-2xl p-3 md:p-5 text-white shadow-md shrink-0 w-full transition-all mt-1">
          <div className="flex items-center gap-2 mb-2 md:mb-4">
            <div className="w-1 h-3 md:h-4 bg-white rounded-full"></div>
            <h2 className="text-[11px] md:text-sm font-black tracking-wider uppercase">ACUMULADO DE PROCESO</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-2 md:gap-y-4 gap-x-2 text-white">
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              {/* Etiquetas ajustadas a 11px */}
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Proceso</span>
              <span className="text-base md:text-xl font-black">{numProceso || '-'}</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Cajas analizadas</span>
              <span className="text-base md:text-xl font-black">{totalCajasBanner}</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Exportable</span>
              <span className="text-base md:text-xl font-black">{acumuladoFrutos ? pExpGlobal.toFixed(1) : '100.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Sólidos (L/D)</span>
              <span className="text-base md:text-xl font-black">{promLight} / {promDark}</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Calificación</span>
              <span className="text-base md:text-xl font-black">{notaGlobal}</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Def. calidad</span>
              <span className="text-base md:text-xl font-black">{acumuladoFrutos ? pCalGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-white/20 pr-1 md:pr-2">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Def. condición</span>
              <span className="text-base md:text-xl font-black">{acumuladoFrutos ? pCondGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col justify-center items-start pl-1">
              <span className="text-[11px] font-medium opacity-80 mb-0.5">Estado</span>
              <span className={`inline-block px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold text-white shadow-inner ${estadoGlobal === 'Objetado' ? 'bg-red-600/80' : 'bg-white/25 border border-white/30'}`}>
                {estadoGlobal}
              </span>
            </div>
          </div>
        </div>

        {/* MINI LISTA DESPLEGABLE DE CAJAS ANALIZADAS */}
        {cajas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-2 px-3 shadow-sm w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] md:text-xs font-extrabold text-slate-600 uppercase tracking-wider shrink-0">
                Editar caja guardada ({cajas.length}):
              </span>
              <select 
                value=""
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && idx >= 0) {
                    abrirModalEdicionCaja(cajas[idx], idx);
                  }
                }}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl font-bold px-3 py-1 outline-none focus:border-[#E96008] cursor-pointer"
              >
                <option value="" disabled>Seleccionar caja...</option>
                {cajas.map((c, idx) => (
                  <option key={idx} value={idx}>
                    Caja #{c.numCaja} - {c.calibre || 'Sin Calibre'} ({c.frutos} fr. - {c.brix ? `${c.brix}°Bx` : 'Sin Bx'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* EVALUANDO NUEVA CAJA - INPUTS REDUCIDOS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-6 shadow-sm w-full relative">
          {cajaEnEdicion && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded-2xl"></div>}

          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <span className="text-slate-600 font-bold text-sm md:text-lg">
              Evaluando nueva caja <span className="text-[#E96008] text-lg md:text-2xl font-black ml-1">#{cajaActual.numCaja}</span>
            </span>
            {/* Cápsulas de rendimiento a 11px */}
            <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-sm font-bold">
              <span className="text-slate-500 hidden sm:inline">Rendimiento:</span>
              <span className="bg-orange-50 text-[#E96008] px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg">Cal: {rend.cal}%</span>
              <span className="bg-red-50 text-red-600 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg">Cond: {rend.cond}%</span>
              <span className="bg-green-50 text-green-700 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg">Exp: {rend.exp}%</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
              {/* Labels a 12px (text-xs) */}
              <span className="text-xs font-bold text-slate-700">Muestra (frutos):</span>
              <input type="number" inputMode="numeric" onWheel={(e) => e.target.blur()} value={cajaActual.frutos} onChange={(e) => setCajaActual({ ...cajaActual, frutos: e.target.value })} className={`w-24 md:w-28 text-center font-bold text-base md:text-lg bg-white border border-slate-300 rounded-lg md:rounded-xl h-8 md:h-10 outline-none focus:border-[#E96008] ${hideSpinners}`} />
            </div>
            <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Calibre:</span>
              <select value={cajaActual.calibre} onChange={(e) => setCajaActual({ ...cajaActual, calibre: e.target.value })} className="w-24 md:w-28 text-center font-bold text-xs md:text-sm bg-white border border-slate-300 rounded-lg md:rounded-xl h-8 md:h-10 outline-none focus:border-[#E96008]">
                <option value="">Seleccionar</option>
                <option value="L">L</option><option value="XL">XL</option><option value="J">J</option>
                <option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option>
              </select>
            </div>
            <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Color embalaje:</span>
              <select value={cajaActual.color} onChange={(e) => setCajaActual({ ...cajaActual, color: e.target.value })} className="w-24 md:w-28 text-center font-bold text-xs md:text-sm bg-white border border-slate-300 rounded-lg md:rounded-xl h-8 md:h-10 outline-none focus:border-[#E96008]">
                <option value="">Seleccionar</option>
                <option value="Light">Light</option><option value="Dark">Dark</option>
              </select>
            </div>
            <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">° Brix:</span>
              <input 
                type="text" 
                inputMode="decimal"
                value={cajaActual.brix} 
                onChange={(e) => manejarCambioBrix(e, false)} 
                className={`w-24 md:w-28 text-center font-bold text-base md:text-lg bg-white border border-slate-300 rounded-lg md:rounded-xl h-8 md:h-10 outline-none focus:border-[#E96008]`} 
              />
            </div>
          </div>
        </div>

        {/* DEFECTOS */}
        <div className={`bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm transition-all ${!headerCompleto ? 'opacity-50 pointer-events-none' : ''} ${cajaEnEdicion ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex border-b border-slate-200 mb-4 gap-2">
            {/* Pestañas a 13px */}
            <button 
              onClick={() => setTabDefectos('calidad')} 
              className={`flex-1 py-2 md:py-3 px-2 md:px-4 font-extrabold text-[13px] md:text-base border-b-2 transition-all flex items-center justify-center gap-2 ${tabDefectos === 'calidad' ? 'border-[#E96008] text-[#E96008] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Defectos de Calidad
              {totalDefCalidadActual > 0 && <span className="bg-[#E96008] text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-bold">{totalDefCalidadActual}</span>}
            </button>
            <button 
              onClick={() => { 
                setTabDefectos('condicion'); 
                setHaVistoCondicion(true); 
              }} 
              className={`flex-1 py-2 md:py-3 px-2 md:px-4 font-extrabold text-[13px] md:text-base border-b-2 transition-all flex items-center justify-center gap-2 ${tabDefectos === 'condicion' ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Defectos de Condición
              {totalDefCondicionActual > 0 && <span className="bg-red-600 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-bold">{totalDefCondicionActual}</span>}
            </button>
          </div>

          {!headerCompleto && (
            <p className="text-center text-[11px] md:text-xs text-orange-600 font-bold mb-4 bg-orange-50 py-2 rounded-lg">
              Completa Muestra, Calibre, Color y °Brix en la sección superior para ingresar los defectos.
            </p>
          )}

          {tabDefectos === 'calidad' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3">
              {Object.keys(defectosCalidadBase).map(def => {
                const count = cajaActual.defCalidad[def];
                return (
                  <div key={def} className="flex items-center justify-between gap-2 p-1 border-b border-slate-100 sm:border-0">
                    {/* Nombre Defecto a 13px */}
                    <span className="text-[13px] md:text-sm font-semibold text-slate-700 flex-1 truncate">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('calidad', def, e.target.value)} className={`w-14 md:w-16 h-9 md:h-11 border border-slate-300 rounded-lg text-center font-bold text-sm md:text-base outline-none focus:border-[#E96008] shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-slate-50' : 'bg-white'}`} />
                      <span className="text-[10px] md:text-xs w-10 md:w-12 text-right font-bold text-slate-500">{calcularPctGlobalDefecto('defCalidad', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tabDefectos === 'condicion' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-3">
              {Object.keys(defectosCondicionBase).map(def => {
                const count = cajaActual.defCondicion[def];
                return (
                  <div key={def} className="flex items-center justify-between gap-2 p-1 border-b border-slate-100 sm:border-0">
                    {/* Nombre Defecto a 13px */}
                    <span className="text-[13px] md:text-sm font-semibold text-slate-700 flex-1 truncate">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('condicion', def, e.target.value)} className={`w-14 md:w-16 h-9 md:h-11 border border-slate-300 rounded-lg text-center font-bold text-sm md:text-base outline-none focus:border-red-500 shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-slate-50' : 'bg-white'}`} />
                      <span className="text-[10px] md:text-xs w-10 md:w-12 text-right font-bold text-slate-500">{calcularPctGlobalDefecto('defCondicion', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="pt-2 pb-6 md:pb-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
          <button 
            onClick={() => setShowModalCancelar(true)} 
            disabled={cajaEnEdicion !== null}
            className="py-3 md:py-3.5 px-4 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-extrabold rounded-xl text-xs md:text-base shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Cancelar
          </button>

          <button 
            onClick={guardarCaja} 
            disabled={!headerCompleto || cajaEnEdicion !== null || !haVistoCondicion}
            className="py-3 md:py-3.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-extrabold rounded-xl text-xs md:text-base shadow-md transition-all active:scale-[0.98]"
          >
            {(!haVistoCondicion && headerCompleto && cajaEnEdicion === null) 
              ? 'Revisa Condición para Guardar' 
              : 'Guardar y Siguiente'}
          </button>

          <button 
            onClick={() => setShowModalFinalizar(true)} 
            disabled={cajaEnEdicion !== null}
            className="py-3 md:py-3.5 px-6 bg-[#00A859] hover:bg-[#008f4c] disabled:bg-slate-400 text-white font-extrabold rounded-xl text-xs md:text-base shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <Check className="w-4 h-4 md:w-5 md:h-5" /> Finalizar Proceso
          </button>
        </div>

      </div>

      {/* MODAL DE EDICIÓN DE CAJA */}
      {cajaEnEdicion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 md:p-8 flex flex-col gap-4 border border-slate-100 relative custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base md:text-xl">
                  Corrigiendo Caja #{cajaEnEdicion.numCaja}
                </h3>
              </div>
              <button onClick={() => setCajaEnEdicion(null)} className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Muestra (frutos)</label>
                <input type="number" value={cajaEnEdicion.frutos ?? ''} onChange={(e) => handleEdicionCampo('frutos', e.target.value)} className="w-full h-9 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Calibre</label>
                <select value={cajaEnEdicion.calibre ?? ''} onChange={(e) => handleEdicionCampo('calibre', e.target.value)} className="w-full h-9 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]">
                  <option value="">Seleccionar</option>
                  <option value="L">L</option><option value="XL">XL</option><option value="J">J</option>
                  <option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Color</label>
                <select value={cajaEnEdicion.color ?? ''} onChange={(e) => handleEdicionCampo('color', e.target.value)} className="w-full h-9 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]">
                  <option value="">Seleccionar</option>
                  <option value="Light">Light</option><option value="Dark">Dark</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">° Brix</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={cajaEnEdicion.brix ?? ''} 
                  onChange={(e) => manejarCambioBrix(e, true)} 
                  className="w-full h-9 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" 
                />
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <button type="button" onClick={() => setTabDefectosEdicion('calidad')} className={`flex-1 py-2.5 font-extrabold text-[13px] md:text-sm border-b-2 transition-all ${tabDefectosEdicion === 'calidad' ? 'border-[#E96008] text-[#E96008] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Defectos de Calidad</button>
              <button type="button" onClick={() => setTabDefectosEdicion('condicion')} className={`flex-1 py-2.5 font-extrabold text-[13px] md:text-sm border-b-2 transition-all ${tabDefectosEdicion === 'condicion' ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Defectos de Condición</button>
            </div>

            {tabDefectosEdicion === 'calidad' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(defectosCalidadBase).map(def => {
                  const cant = cajaEnEdicion.defCalidad?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1 border-b border-slate-100">
                      <span className="text-[13px] md:text-sm font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input type="number" value={cant === 0 ? '' : cant} onChange={(e) => handleEdicionDefecto('defCalidad', def, e.target.value)} className="w-14 h-8 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-[#E96008]" />
                    </div>
                  );
                })}
              </div>
            )}

            {tabDefectosEdicion === 'condicion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(defectosCondicionBase).map(def => {
                  const cant = cajaEnEdicion.defCondicion?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1 border-b border-slate-100">
                      <span className="text-[13px] md:text-sm font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input type="number" value={cant === 0 ? '' : cant} onChange={(e) => handleEdicionDefecto('defCondicion', def, e.target.value)} className="w-14 h-8 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-red-500" />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center pt-3 border-t border-slate-100 gap-3">
              <button 
                onClick={() => eliminarCajaGuardada(cajaIndexEdicion)} 
                className="w-full md:w-auto px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-[11px] md:text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Eliminar caja
              </button>
              
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setCajaEnEdicion(null)} className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-[11px] md:text-xs transition-colors">Cancelar</button>
                <button onClick={guardarCambiosCajaEditada} className="flex-1 md:flex-none px-5 py-2.5 bg-[#E96008] hover:bg-[#c74c04] text-white font-bold rounded-xl text-[11px] md:text-xs shadow-md transition-colors flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR INSPECCIÓN */}
      {showModalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Cancelar Inspección</h3>
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                ¿Estás seguro de cancelar la inspección y volver al menú principal? Los datos evaluados de este proceso <span className="font-bold text-slate-800">no se guardarán</span>.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowModalCancelar(false)} 
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-sm transition-colors"
                >
                  Continuar
                </button>
                <button 
                  onClick={confirmarCancelarProceso} 
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md text-sm transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FINALIZAR PROCESO */}
      {showModalFinalizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-orange-100 text-[#E96008] rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Finalizar Inspección</h3>
              <p className="text-slate-600 mb-6 text-sm">¿Deseas concluir el registro y enviar los datos guardados al servidor?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowModalFinalizar(false)} className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-sm">
                  Continuar
                </button>
                <button onClick={() => { setShowModalFinalizar(false); enviarInspeccionAlServidor(); }} className="flex-1 py-3 rounded-xl bg-[#00A859] text-white font-bold hover:bg-[#008f4c] shadow-md text-sm">
                  Sí, guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { 
  Check, AlertTriangle, Menu, 
  Trash2, X, ArrowLeft 
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
  const { 
    numProceso, exportadoraSel, csgSel, variedadSel, productorNombre, huertoNombre,
    procesoIdBD, isColaborativo, nextCajaColaborativa, cajasPreviasColaborativas, horaInicioAsignada 
  } = datosProceso || {};
  
  const DRAFT_KEY = `draft_inspeccion_${numProceso}`;

  const getDraft = () => {
    if (!numProceso) return null;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const draftInit = getDraft();

  // 🔥 SOLUCIÓN SALTOS DE CAJA 1: Prioridad absoluta a la BD sobre el borrador local
  const [cajas, setCajas] = useState(() => {
    if (isColaborativo && cajasPreviasColaborativas) return cajasPreviasColaborativas;
    if (draftInit?.cajas && draftInit.cajas.length > 0) return draftInit.cajas;
    return [];
  });

  const numCajaInicial = isColaborativo ? (nextCajaColaborativa || 1) : (draftInit?.cajaActual?.numCaja || 1);

  const [cajaActual, setCajaActual] = useState(() => {
    const base = draftInit?.cajaActual || {
      frutos: '100', calibre: '', brix: '', color: '',
      defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase }
    };
    // Mantenemos lo que el usuario estaba digitando, pero FORZAMOS el N° de caja según la BD
    return { ...base, numCaja: numCajaInicial };
  });
  
  const [horaInicio, setHoraInicio] = useState(draftInit?.horaInicio || horaInicioAsignada || null);

  const [tabDefectos, setTabDefectos] = useState('calidad'); 
  const [showModalFinalizar, setShowModalFinalizar] = useState(false);
  const [showModalCancelar, setShowModalCancelar] = useState(false);
  const [showModalExitoGuardado, setShowModalExitoGuardado] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [haVistoCondicion, setHaVistoCondicion] = useState(false);
  
  const [guardandoCaja, setGuardandoCaja] = useState(false);

  const [paramsCalidad, setParamsCalidad] = useState([]);
  const [paramsCondicion, setParamsCondicion] = useState([]);

  const [cajaEnEdicion, setCajaEnEdicion] = useState(null);
  const [cajaIndexEdicion, setCajaIndexEdicion] = useState(null);
  const [tabDefectosEdicion, setTabDefectosEdicion] = useState('calidad');

  const hideSpinners = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const headerCompleto = cajaActual.frutos !== '' && cajaActual.calibre !== '' && cajaActual.color !== '' && cajaActual.brix !== '';

  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  useEffect(() => {
    if (isColaborativo && cajasPreviasColaborativas?.length > 0) {
      setMensajeExito(`Unido al proceso. ${cajasPreviasColaborativas.length} cajas ya evaluadas por el equipo.`);
      setTimeout(() => setMensajeExito(''), 4000);
    } else if (draftInit && draftInit.cajas && draftInit.cajas.length > 0) {
      setMensajeExito('Borrador local restaurado (F5)');
      setTimeout(() => setMensajeExito(''), 3000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!numProceso) return;
    const draft = { cajas, cajaActual, horaInicio };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [cajas, cajaActual, horaInicio, numProceso, DRAFT_KEY]);

  const limpiarBorrador = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/parametros`)
      .then(r => r.json())
      .then(data => {
        setParamsCalidad(data.calidad || []);
        setParamsCondicion(data.condicion || []);
      })
      .catch(err => console.error("Error obteniendo parámetros:", err));
  }, [API_URL]);

  // 🔥 SOLUCIÓN SALTOS DE CAJA 2: Polling Inteligente Visual
  useEffect(() => {
    if (!isColaborativo || !procesoIdBD) return;
    let isMounted = true;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/inspecciones`);
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        
        const procesoActualizado = data.find(p => p.id === procesoIdBD);
        if (procesoActualizado && procesoActualizado.cajas) {
          setCajas(prevCajas => {
            if (procesoActualizado.cajas.length !== prevCajas.length) {
              // Si otro usuario guardó, actualizamos visualmente el N° de NUESTRA caja actual
              setCajaActual(curr => ({ ...curr, numCaja: procesoActualizado.cajas.length + 1 }));
              return procesoActualizado.cajas;
            }
            return prevCajas;
          });
        }
      } catch (error) {}
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isColaborativo, procesoIdBD, API_URL]);

  // Envío constante al Dashboard (Para que se vean los defectos mientras se tipea)
  useEffect(() => {
    const payload = {
      numProceso, exportadora: exportadoraSel, productor: productorNombre, huerto: huertoNombre, variedad: variedadSel, csg: csgSel,
      cajas: cajas, cajaActual: headerCompleto ? cajaActual : null,
      horaInicio 
    };
    fetch(`${API_URL}/api/live`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).catch(err => console.log('Error enviando datos en vivo:', err));
  }, [cajas, cajaActual, headerCompleto, numProceso, exportadoraSel, productorNombre, huertoNombre, variedadSel, csgSel, horaInicio, API_URL]);

  const registrarInicioProceso = () => { if (!horaInicio) setHoraInicio(new Date().toISOString()); };

  const actualizarDefecto = (tipo, def, valor) => {
    registrarInicioProceso();
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setCajaActual(prev => ({ 
      ...prev, [tipo === 'calidad' ? 'defCalidad' : 'defCondicion']: { ...prev[tipo === 'calidad' ? 'defCalidad' : 'defCondicion'], [def]: val } 
    }));
  };

  const calcularPctGlobalDefecto = (tipoStr, def) => {
    let tFrutos = parseInt(cajaActual.frutos) || 0;
    let tDefecto = parseInt(cajaActual[tipoStr][def]) || 0;
    cajas.forEach(c => { tFrutos += parseInt(c.frutos) || 0; tDefecto += parseInt(c[tipoStr][def]) || 0; });
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
    if (!esEdicion) registrarInicioProceso();
    let val = e.target.value.replace(',', '.'); val = val.replace(/[^0-9.]/g, ''); 
    if ((val.match(/\./g) || []).length > 1) return; 
    if (esEdicion) setCajaEnEdicion(prev => ({ ...prev, brix: val }));
    else setCajaActual(prev => ({ ...prev, brix: val }));
  };

  const guardarCaja = async () => {
    if (!headerCompleto) return alert("Completa Muestra, Calibre, Color de embalaje y °Brix.");
    const brixVal = parseFloat(cajaActual.brix);
    if (!isNaN(brixVal) && brixVal > 30) { if (!window.confirm(`El valor de °Brix ingresado (${brixVal}) es superior a 30. ¿Estás seguro?`)) return; }
    registrarInicioProceso();

    if (isColaborativo && procesoIdBD) {
      setGuardandoCaja(true);
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/caja`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ procesoId: procesoIdBD, caja: cajaActual })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          const nuevasCajas = [...cajas];
          if (!nuevasCajas.find(c => c.id === data.cajaGuardada.id)) nuevasCajas.push(data.cajaGuardada);
          
          setCajas(nuevasCajas);
          setCajaActual({ numCaja: data.nextCaja, frutos: '100', calibre: '', brix: '', color: '', defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase } });
          setHaVistoCondicion(false); setTabDefectos('calidad');
          
          // 🔥 SOLUCIÓN DASHBOARD: Refresco forzado al instante para evitar latencia de 1 seg.
          fetch(`${API_URL}/api/live`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numProceso, exportadora: exportadoraSel, productor: productorNombre, huerto: huertoNombre, variedad: variedadSel, csg: csgSel,
              cajas: nuevasCajas, cajaActual: null, horaInicio 
            })
          }).catch(()=>{});

          setMensajeExito(`Caja #${data.cajaGuardada.numCaja} enviada al servidor.`);
          setTimeout(() => { setMensajeExito(''); }, 2500);
        } else {
          alert("Error al sincronizar con el servidor: " + data.error);
        }
      } catch (e) {
        console.error(e);
        alert("Error de conexión. Se guardará localmente, pero debes asegurar tu red antes de finalizar.");
        setCajas(prev => [...prev, { ...cajaActual, id: Date.now() }]);
        setCajaActual(prev => ({ numCaja: prev.numCaja + 1, frutos: '100', calibre: '', brix: '', color: '', defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase } }));
        setHaVistoCondicion(false); setTabDefectos('calidad');
      } finally {
        setGuardandoCaja(false);
      }
    } else {
      setCajas([...cajas, { ...cajaActual, id: Date.now() }]);
      setCajaActual({ numCaja: cajas.length + 2, frutos: '100', calibre: '', brix: '', color: '', defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase } });
      setHaVistoCondicion(false); setTabDefectos('calidad');
      setMensajeExito('Caja guardada correctamente'); setTimeout(() => { setMensajeExito(''); }, 2500);
    }
  };

  const abrirModalEdicionCaja = (caja, index) => { setCajaEnEdicion(JSON.parse(JSON.stringify(caja))); setCajaIndexEdicion(index); setTabDefectosEdicion('calidad'); };
  const handleEdicionCampo = (campo, valor) => setCajaEnEdicion(prev => ({ ...prev, [campo]: valor }));
  const handleEdicionDefecto = (tipoDef, def, valor) => { const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0); setCajaEnEdicion(prev => ({ ...prev, [tipoDef]: { ...prev[tipoDef], [def]: val } })); };

  const guardarCambiosCajaEditada = () => {
    const brixVal = parseFloat(cajaEnEdicion.brix);
    if (!isNaN(brixVal) && brixVal > 30) { if (!window.confirm(`El valor de °Brix (${brixVal}) es mayor a 30. ¿Es correcto?`)) return; }
    const nuevasCajas = [...cajas]; nuevasCajas[cajaIndexEdicion] = cajaEnEdicion;
    setCajas(nuevasCajas); setCajaEnEdicion(null); setCajaIndexEdicion(null);
    setMensajeExito('Caja actualizada localmente'); setTimeout(() => setMensajeExito(''), 2500);
  };

  const eliminarCajaGuardada = (index) => {
    if (window.confirm(`¿Seguro que deseas eliminar la Caja #${cajas[index]?.numCaja}?`)) {
      const filtradas = cajas.filter((_, i) => i !== index);
      const reindexadas = filtradas.map((c, i) => ({ ...c, numCaja: i + 1 }));
      setCajas(reindexadas); setCajaActual(prev => ({ ...prev, numCaja: reindexadas.length + 1 }));
      setCajaEnEdicion(null); setCajaIndexEdicion(null);
    }
  };

  const confirmarCancelarProceso = async () => {
    try { 
      if (isColaborativo && procesoIdBD) {
        await fetch(`${API_URL}/api/procesos/colaborativo/cancelar-caja`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ procesoId: procesoIdBD, numCajaLiberar: cajaActual.numCaja }) 
        });
      }
      await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); 
    } catch (err) {}
    limpiarBorrador(); setShowModalCancelar(false); if (onVolver) onVolver();
  };

  let acumuladoFrutos = parseInt(cajaActual.frutos) || 0;
  let acumuladoCal = 0;
  let acumuladoCond = 0;
  let sumBrixLight = 0, countBrixLight = 0, sumBrixDark = 0, countBrixDark = 0;

  let defCalidadMap = { ...cajaActual.defCalidad };
  let defCondicionMap = { ...cajaActual.defCondicion };

  Object.values(cajaActual.defCalidad).forEach(v => acumuladoCal += (parseInt(v) || 0));
  Object.values(cajaActual.defCondicion).forEach(v => acumuladoCond += (parseInt(v) || 0));

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
    Object.entries(c.defCalidad || {}).forEach(([k, v]) => {
      const val = parseInt(v) || 0;
      acumuladoCal += val;
      defCalidadMap[k] = (defCalidadMap[k] || 0) + val;
    });
    Object.entries(c.defCondicion || {}).forEach(([k, v]) => {
      const val = parseInt(v) || 0;
      acumuladoCond += val;
      defCondicionMap[k] = (defCondicionMap[k] || 0) + val;
    });
  });

  const pCalGlobal = acumuladoFrutos ? (acumuladoCal / acumuladoFrutos) * 100 : 0;
  const pCondGlobal = acumuladoFrutos ? (acumuladoCond / acumuladoFrutos) * 100 : 0;
  const pExpGlobal = acumuladoFrutos ? Math.max(0, 100 - pCalGlobal - pCondGlobal) : 100;
  
  let letCal = 'A';
  let numCond = '1';

  if (acumuladoFrutos > 0) {
    const sumCalP = paramsCalidad.find(p => p.nombre === 'Sumatoria de calidad') || { limAB: 15, limBC: 20 };
    if (pCalGlobal > (Number(sumCalP.limBC) || 20)) letCal = 'C';
    else if (pCalGlobal > (Number(sumCalP.limAB) || 15) && letCal === 'A') letCal = 'B';

    Object.entries(defCalidadMap).forEach(([def, val]) => {
      const pct = (val / acumuladoFrutos) * 100;
      const p = paramsCalidad.find(x => x.nombre === def);
      if (p) {
        if (pct > (Number(p.limBC) || 999)) letCal = 'C';
        else if (pct > (Number(p.limAB) || 999) && letCal === 'A') letCal = 'B';
      }
    });

    const sumCondP = paramsCondicion.find(p => p.nombre === 'Sumatoria de condición') || { lim12: 10, lim23: 15 };
    if (pCondGlobal > (Number(sumCondP.lim23) || 15)) numCond = '3';
    else if (pCondGlobal > (Number(sumCondP.lim12) || 10) && numCond === '1') numCond = '2';

    Object.entries(defCondicionMap).forEach(([def, val]) => {
      const pct = (val / acumuladoFrutos) * 100;
      const p = paramsCondicion.find(x => x.nombre === def);
      if (p) {
        if (pct > (Number(p.lim23) || 999)) numCond = '3';
        else if (pct > (Number(p.lim12) || 999) && numCond === '1') numCond = '2';
      }
    });
  }

  const notaGlobal = acumuladoFrutos > 0 ? `${letCal}${numCond}` : '-';
  const esCritico = letCal === 'C' || numCond === '3';
  const esAlerta = (!esCritico) && (letCal === 'B' || numCond === '2');
  const estadoGlobal = acumuladoFrutos ? (esCritico ? 'Objetado' : 'Aprobado') : '-';
  
  const colorNota = esCritico 
    ? 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]' 
    : esAlerta 
    ? 'bg-[#fffbeb] text-[#f59e0b] border-[#fde68a]' 
    : 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]';

  const promLight = countBrixLight ? (sumBrixLight / countBrixLight).toFixed(1).replace('.', ',') : '0,0';
  const promDark = countBrixDark ? (sumBrixDark / countBrixDark).toFixed(1).replace('.', ',') : '0,0';
  const totalCajasBanner = cajas.length + ((parseInt(cajaActual.frutos) || 0) > 0 ? 1 : 0);
  
  const totalDefCalidadActual = Object.values(cajaActual.defCalidad).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const totalDefCondicionActual = Object.values(cajaActual.defCondicion).reduce((a, b) => a + (parseInt(b) || 0), 0);

  const enviarInspeccionAlServidor = async () => {
    let cajasFinales = headerCompleto ? [...cajas, cajaActual] : [...cajas];
    if (cajasFinales.length === 0) return alert("No has evaluado ninguna caja.");
    
    const horaFinCalculada = new Date().toISOString();
    const fechaExactaChile = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Santiago', 
      year: 'numeric', month: '2-digit', day: '2-digit' 
    }).format(new Date());

    try {
      if (isColaborativo && procesoIdBD) {
        if (headerCompleto) {
           await fetch(`${API_URL}/api/procesos/colaborativo/caja`, {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ procesoId: procesoIdBD, caja: cajaActual })
           });
        }
        const resEnd = await fetch(`${API_URL}/api/procesos/colaborativo/finalizar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ procesoId: procesoIdBD, estadoGlobal: notaGlobal, horaFin: horaFinCalculada })
        });
        
        if (resEnd.ok) {
          await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          limpiarBorrador(); 
          setShowModalExitoGuardado(true);
        } else {
          alert("Error finalizando el proceso.");
        }
      } else {
        const payload = { 
          numProceso, exportadora: exportadoraSel, csg: csgSel, variedad: variedadSel, 
          estado: notaGlobal, cajas: cajasFinales, productor: productorNombre, huerto: huertoNombre,
          horaInicio, horaFin: horaFinCalculada, fecha: fechaExactaChile
        };
        const response = await fetch(`${API_URL}/api/inspecciones`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) 
        });
        
        if (response.ok) {
          await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          limpiarBorrador(); 
          setShowModalExitoGuardado(true);
        } else { 
          const data = await response.json(); 
          alert("❌ ERROR DEL SERVIDOR: " + (data.error || "Error al guardar")); 
        }
      }
    } catch (err) { 
      alert("❌ ERROR DE CONEXIÓN: No se pudo contactar al servidor Backend."); 
    }
  };

  const rend = totalesCaja();

  return (
    <div className="w-full h-full bg-[#f1f5f9] overflow-y-auto custom-scrollbar relative" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '-0.01em' }}>
      
      {/* ================= ESTILOS INYECTADOS ================= */}
      <style>{`
        /* Entrada suave escalonada */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-1 { animation-delay: 0.05s; }
        .delay-2 { animation-delay: 0.12s; }
        .delay-3 { animation-delay: 0.18s; }
        .delay-4 { animation-delay: 0.24s; }

        /* Pulso sutil para badges e indicadores */
        @keyframes softPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.88; }
        }
        .pulse-badge { animation: softPulse 2.8s ease-in-out infinite; }

        /* Efecto de foco en inputs de defectos */
        .defect-input { transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }
        .defect-input:focus {
          outline: none;
          border-color: #ea580c; 
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
          transform: scale(1.02);
        }

        /* Hover en fila de defecto */
        .defect-row { transition: background-color 0.15s ease, transform 0.15s ease; border-radius: 0.5rem; padding: 0.35rem 0.5rem; }
        .defect-row:hover { background-color: #f8fafc; }

        /* Pestañas activas con línea indicadora */
        .tab-indicator { position: relative; font-weight: 700; color: #ea580c; padding-bottom: 0.35rem; }
        .tab-indicator::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2.5px;
          background-color: #ea580c;
          border-radius: 9999px;
          transition: all 0.3s ease;
        }

        /* Estilos de Botones */
        .btn-cancel {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 1.75rem; border-radius: 0.75rem;
          background-color: #1e293b; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .btn-cancel:hover { background-color: #0f172a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2); }
        .btn-cancel:active { transform: translateY(0) scale(0.97); }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 2rem; border-radius: 0.75rem;
          background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .btn-primary:hover { background-color: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45); }
        .btn-primary:active { transform: translateY(0) scale(0.97); }

        .btn-success {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 1.75rem; border-radius: 0.75rem;
          background-color: #059669; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }
        .btn-success:hover { background-color: #047857; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4); }
        .btn-success:active { transform: translateY(0) scale(0.97); }

        .btn-disabled { opacity: 0.6; pointer-events: none; background-color: #94a3b8 !important; box-shadow: none !important; }
      `}</style>

      {mensajeExito && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#059669] text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 border border-[#047857] text-sm animate-fade-in-up">
          <Check className="w-5 h-5" /> {mensajeExito}
        </div>
      )}

      <div className="max-w-[1600px] mx-auto flex flex-col gap-3 py-3 px-3 sm:px-6 lg:px-8 w-full pb-10">
        
        {/* CABECERA */}
        <div className="flex justify-between items-center w-full mt-1 mb-2 animate-fade-in-up delay-1">
          <div className="flex items-center gap-3">
            {onAbrirMenu && (
              <button type="button" onClick={onAbrirMenu} className="p-2 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#1e293b] rounded-xl shadow-sm transition-colors">
                <Menu className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            )}
            <div>
              <h1 className="text-[19px] md:text-2xl font-bold text-[#0f172a] leading-tight tracking-tight">Inspección Producto Terminado</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-sm md:text-sm text-[#64748b] font-medium uppercase tracking-wider">
                  {huertoNombre || productorNombre || 'Ingreso en vivo'} <span className="mx-1">•</span> {variedadSel}
                </p>
                {horaInicio ? (
                  <span className="text-[#ea580c] font-bold bg-[#ffedd5] px-2 py-0.5 rounded-md border border-[#fed7aa] whitespace-nowrap text-xs shadow-sm">
                    INICIO: {new Date(horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="text-[#64748b] font-bold bg-[#f1f5f9] px-2 py-0.5 rounded-md border border-[#e2e8f0] whitespace-nowrap text-[10px] pulse-badge">
                    ESPERANDO INICIO...
                  </span>
                )}
              </div>
            </div>
          </div>
          <img src="/Logo_goldanda.png" alt="Logo" className="h-7 md:h-10 object-contain hidden sm:block" />
        </div>
        
        {/* 1. TARJETA: ACUMULADO DE PROCESO */}
        <div className="bg-[#ffffff] rounded-2xl border-t-4 border-[#ea580c] border-x border-b border-[#e2e8f0] shadow-sm px-4 md:px-6 py-3.5 mb-3 shrink-0 w-full transition-all animate-fade-in-up delay-2">
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <h2 className="text-[11px] md:text-xs font-bold text-[#94a3b8] tracking-wider uppercase">Acumulado de Proceso</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-3 md:gap-y-4 gap-x-2 text-[#0f172a]">
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Proceso</span>
              <span className="text-base md:text-[22px] font-black">{numProceso || '-'}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Cajas analizadas</span>
              <span className="text-base md:text-[22px] font-black">{totalCajasBanner}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Exportable</span>
              <span className="text-base md:text-[22px] font-black text-[#0f172a]">{acumuladoFrutos ? pExpGlobal.toFixed(1) : '100.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Sólidos (L/D)</span>
              <span className="text-base md:text-[22px] font-black">{promLight} <span className="text-[#94a3b8] font-normal mx-0.5">/</span> {promDark}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Calificación</span>
              <span className="text-base md:text-[22px] font-black">{notaGlobal}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Def. calidad</span>
              <span className="text-base md:text-[22px] font-black text-[#ea580c]">{acumuladoFrutos ? pCalGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Def. condición</span>
              <span className="text-base md:text-[22px] font-black text-[#e11d48]">{acumuladoFrutos ? pCondGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col justify-center items-start pl-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-1">Estado</span>
              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold border ${colorNota} ${estadoGlobal === 'Aprobado' ? 'pulse-badge' : ''}`}>
                {estadoGlobal}
              </span>
            </div>
          </div>
        </div>

        {/* MINI LISTA DESPLEGABLE DE CAJAS ANALIZADAS */}
        {cajas.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 px-4 shadow-sm w-full flex items-center justify-between gap-3 animate-fade-in-up delay-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider shrink-0">
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
                className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-lg font-medium px-3 py-1.5 outline-none focus:border-[#ea580c] cursor-pointer"
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

        {/* 2. TARJETA: EVALUANDO NUEVA CAJA */}
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-2xl p-4 md:px-6 md:py-4 shadow-sm w-full relative mb-3 animate-fade-in-up delay-3">
          {cajaEnEdicion && <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 rounded-2xl"></div>}

          <div className="flex items-center justify-between mb-3 border-b border-[#f1f5f9] pb-3">
            <span className="text-[#1e293b] font-semibold text-sm md:text-lg tracking-tight">
              Evaluando nueva caja <span className="text-[#ea580c] text-lg md:text-xl font-bold ml-1">#{cajaActual.numCaja}</span>
            </span>
            <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-sm font-semibold">
              <span className="text-[#64748b] hidden sm:inline">Rendimiento:</span>
              <span className="bg-[#ffedd5] text-[#ea580c] px-2 py-1 md:px-3 rounded-lg border border-[#fed7aa]">Cal: {rend.cal}%</span>
              <span className="bg-[#ffe4e6] text-[#e11d48] px-2 py-1 md:px-3 rounded-lg border border-[#fecaca]">Cond: {rend.cond}%</span>
              <span className="bg-[#ecfdf5] text-[#059669] px-2 py-1 md:px-3 rounded-lg border border-[#a7f3d0]">Exp: {rend.exp}%</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Muestra (frutos):</span>
              <input 
                type="number" inputMode="numeric" onWheel={(e) => e.target.blur()} value={cajaActual.frutos} 
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, frutos: e.target.value }); }} 
                className={`w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all ${hideSpinners}`} 
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Calibre:</span>
              <select 
                value={cajaActual.calibre} 
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, calibre: e.target.value }); }} 
                className="w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all"
              >
                <option value="">Seleccionar</option>
                <option value="L">L</option><option value="XL">XL</option><option value="J">J</option>
                <option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Color embalaje:</span>
              <select 
                value={cajaActual.color} 
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, color: e.target.value }); }} 
                className="w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all"
              >
                <option value="">Seleccionar</option>
                <option value="Light">Light</option><option value="Dark">Dark</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">° Brix:</span>
              <input 
                type="text" inputMode="decimal" value={cajaActual.brix} onChange={(e) => manejarCambioBrix(e, false)} 
                className={`w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all`} 
              />
            </div>
          </div>
        </div>

        {/* 3. TARJETA: DEFECTOS */}
        <div className={`bg-[#ffffff] border border-[#e2e8f0] rounded-2xl px-4 md:px-6 pt-2 pb-5 shadow-sm transition-all animate-fade-in-up delay-4 ${!headerCompleto ? 'opacity-50 pointer-events-none' : ''} ${cajaEnEdicion ? 'pointer-events-none opacity-50' : ''}`}>
          
          <div className="flex border-b border-[#f1f5f9] mb-4 pt-1">
            <button 
              onClick={() => { registrarInicioProceso(); setTabDefectos('calidad'); }} 
              className={`flex-1 pb-2 font-bold text-[13px] md:text-sm flex items-center justify-center gap-2 transition-all ${tabDefectos === 'calidad' ? 'tab-indicator text-[#ea580c]' : 'text-[#64748b] border-b-[2.5px] border-transparent hover:text-[#0f172a]'}`}
            >
              Defectos de Calidad
              {totalDefCalidadActual > 0 && <span className="bg-[#ea580c] text-white text-[10px] md:text-xs px-2 py-0.5 rounded-md font-bold">{totalDefCalidadActual}</span>}
            </button>
            <button 
              onClick={() => { registrarInicioProceso(); setTabDefectos('condicion'); setHaVistoCondicion(true); }} 
              className={`flex-1 pb-2 font-bold text-[13px] md:text-sm flex items-center justify-center gap-2 transition-all ${tabDefectos === 'condicion' ? 'tab-indicator text-[#e11d48]' : 'text-[#64748b] border-b-[2.5px] border-transparent hover:text-[#0f172a]'}`}
              style={tabDefectos === 'condicion' ? { color: '#e11d48', '--tw-bg-opacity': 1 } : {}}
            >
              Defectos de Condición
              {totalDefCondicionActual > 0 && <span className="bg-[#e11d48] text-white text-[10px] md:text-xs px-2 py-0.5 rounded-md font-bold">{totalDefCondicionActual}</span>}
              {tabDefectos === 'condicion' && <style>{`.tab-indicator::after { background-color: #e11d48 !important; }`}</style>}
            </button>
          </div>

          {!headerCompleto && (
            <p className="text-center text-[12px] md:text-sm text-[#ea580c] font-medium my-4 py-2 bg-[#ffedd5] rounded-lg">
              Completa Muestra, Calibre, Color y °Brix en la sección superior para ingresar los defectos.
            </p>
          )}

          {tabDefectos === 'calidad' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
              {Object.keys(defectosCalidadBase).map(def => {
                const count = cajaActual.defCalidad[def];
                return (
                  <div key={def} className="defect-row flex items-center justify-between gap-2 border-b border-[#f1f5f9] sm:border-0">
                    <span className="text-[13px] md:text-[13.5px] font-medium text-[#334155] flex-1 truncate leading-tight">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('calidad', def, e.target.value)} className={`defect-input w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-[#f8fafc]' : 'bg-white'}`} />
                      <span className="text-[11px] md:text-xs w-10 md:w-11 text-right font-semibold text-[#94a3b8]">{calcularPctGlobalDefecto('defCalidad', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tabDefectos === 'condicion' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
              {Object.keys(defectosCondicionBase).map(def => {
                const count = cajaActual.defCondicion[def];
                return (
                  <div key={def} className="defect-row flex items-center justify-between gap-2 border-b border-[#f1f5f9] sm:border-0">
                    <span className="text-[13px] md:text-[13.5px] font-medium text-[#334155] flex-1 truncate leading-tight">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('condicion', def, e.target.value)} className={`defect-input w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-[#f8fafc]' : 'bg-white'} focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4e6]`} />
                      <span className="text-[11px] md:text-xs w-10 md:w-11 text-right font-semibold text-[#94a3b8]">{calcularPctGlobalDefecto('defCondicion', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. BOTONES DE ACCIÓN */}
        <div className="pt-2 pb-6 md:pb-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full animate-fade-in-up delay-4">
          <button onClick={() => setShowModalCancelar(true)} disabled={cajaEnEdicion !== null || guardandoCaja} className={`btn-cancel group ${cajaEnEdicion !== null || guardandoCaja ? 'btn-disabled' : ''}`}>
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Cancelar</span>
          </button>
          
          <button onClick={guardarCaja} disabled={!headerCompleto || cajaEnEdicion !== null || !haVistoCondicion || guardandoCaja} className={`btn-primary group ${(!headerCompleto || cajaEnEdicion !== null || !haVistoCondicion || guardandoCaja) ? 'btn-disabled' : ''}`}>
            {guardandoCaja ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Sincronizando...
              </span>
            ) : (
              <span>{(!haVistoCondicion && headerCompleto && cajaEnEdicion === null) ? 'Revisa Condición para Guardar' : 'Guardar y Siguiente'}</span>
            )}
          </button>
          
          <button onClick={() => setShowModalFinalizar(true)} disabled={cajaEnEdicion !== null || guardandoCaja} className={`btn-success group shrink-0 ${cajaEnEdicion !== null || guardandoCaja ? 'btn-disabled' : ''}`}>
            <Check className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
            <span>Finalizar Proceso</span>
          </button>
        </div>

      </div>

      {/* MODAL DE EDICIÓN DE CAJA */}
      {cajaEnEdicion && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 md:p-8 flex flex-col gap-4 border border-[#e2e8f0] relative custom-scrollbar">
            <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-3">
              <h3 className="font-black text-[#0f172a] text-base md:text-xl tracking-tight">Corrigiendo Caja #{cajaEnEdicion.numCaja}</h3>
              <button onClick={() => setCajaEnEdicion(null)} className="p-1.5 rounded-lg bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[#f1f5f9]">
              <div><label className="text-xs font-semibold text-[#475569] block mb-1">Muestra (frutos)</label><input type="number" value={cajaEnEdicion.frutos ?? ''} onChange={(e) => handleEdicionCampo('frutos', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors" /></div>
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1">Calibre</label>
                <select value={cajaEnEdicion.calibre ?? ''} onChange={(e) => handleEdicionCampo('calibre', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors"><option value="">Seleccionar</option><option value="L">L</option><option value="XL">XL</option><option value="J">J</option><option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option></select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1">Color</label>
                <select value={cajaEnEdicion.color ?? ''} onChange={(e) => handleEdicionCampo('color', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors"><option value="">Seleccionar</option><option value="Light">Light</option><option value="Dark">Dark</option></select>
              </div>
              <div><label className="text-xs font-semibold text-[#475569] block mb-1">° Brix</label><input type="text" inputMode="decimal" value={cajaEnEdicion.brix ?? ''} onChange={(e) => manejarCambioBrix(e, true)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors" /></div>
            </div>

            <div className="flex border-b border-[#f1f5f9] mt-2">
              <button type="button" onClick={() => setTabDefectosEdicion('calidad')} className={`flex-1 pb-2 font-bold text-[13px] md:text-sm transition-all ${tabDefectosEdicion === 'calidad' ? 'tab-indicator text-[#ea580c]' : 'border-b-[2.5px] border-transparent text-[#64748b] hover:text-[#0f172a]'}`}>Defectos de Calidad</button>
              <button type="button" onClick={() => setTabDefectosEdicion('condicion')} className={`flex-1 pb-2 font-bold text-[13px] md:text-sm transition-all ${tabDefectosEdicion === 'condicion' ? 'tab-indicator text-[#e11d48]' : 'border-b-[2.5px] border-transparent text-[#64748b] hover:text-[#0f172a]'}`} style={tabDefectosEdicion === 'condicion' ? { color: '#e11d48' } : {}}>Defectos de Condición</button>
            </div>
            
            {tabDefectosEdicion === 'calidad' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pt-2">
                {Object.keys(defectosCalidadBase).map(def => <div key={def} className="flex justify-between items-center p-1 border-b border-[#f1f5f9]"><span className="text-[13px] md:text-sm font-medium text-[#334155]">{def}</span><input type="number" value={cajaEnEdicion.defCalidad?.[def] || ''} onChange={(e) => handleEdicionDefecto('defCalidad', def, e.target.value)} className="w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none focus:border-[#ea580c]" /></div>)}
              </div>
            )}
            {tabDefectosEdicion === 'condicion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pt-2">
                {Object.keys(defectosCondicionBase).map(def => <div key={def} className="flex justify-between items-center p-1 border-b border-[#f1f5f9]"><span className="text-[13px] md:text-sm font-medium text-[#334155]">{def}</span><input type="number" value={cajaEnEdicion.defCondicion?.[def] || ''} onChange={(e) => handleEdicionDefecto('defCondicion', def, e.target.value)} className="w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none focus:border-[#e11d48]" /></div>)}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t border-[#f1f5f9] mt-2">
              <button onClick={() => eliminarCajaGuardada(cajaIndexEdicion)} className="flex items-center gap-1.5 px-4 py-2 bg-[#fef2f2] text-[#e11d48] hover:bg-[#ffe4e6] font-semibold rounded-lg text-sm transition-colors"><Trash2 className="w-4 h-4" /> Eliminar caja</button>
              <div className="flex gap-3">
                <button onClick={() => setCajaEnEdicion(null)} className="px-5 py-2 bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] hover:text-[#0f172a] font-semibold rounded-lg text-sm transition-colors">Cancelar</button>
                <button onClick={guardarCambiosCajaEditada} className="px-6 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"><Check className="w-4 h-4" /> Aplicar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-md p-6 md:p-8 border border-[#e2e8f0]">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#fef2f2] text-[#e11d48] rounded-full flex items-center justify-center mb-5"><AlertTriangle className="w-7 h-7" /></div>
              <h3 className="text-xl font-bold text-[#0f172a] mb-2">Cancelar Inspección</h3>
              <p className="text-[#64748b] mb-8 text-sm leading-relaxed">¿Estás seguro de cancelar la inspección y volver al menú principal? Los datos de esta caja <span className="font-bold text-[#0f172a]">no se guardarán</span>.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowModalCancelar(false)} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-[#334155] font-semibold hover:bg-[#f8fafc] text-sm transition-colors">Continuar editando</button>
                <button onClick={confirmarCancelarProceso} className="flex-1 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold shadow-sm text-sm transition-colors">Sí, descartar caja</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalFinalizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-md p-6 md:p-8 border border-[#e2e8f0]">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#fff7ed] text-[#ea580c] rounded-full flex items-center justify-center mb-5"><Check className="w-7 h-7" strokeWidth={3} /></div>
              <h3 className="text-xl font-bold text-[#0f172a] mb-2">Finalizar Inspección</h3>
              <p className="text-[#64748b] mb-8 text-sm leading-relaxed">¿Deseas concluir el registro de la inspección n° {numProceso} y sellar el proceso en el servidor?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowModalFinalizar(false)} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-[#334155] font-semibold hover:bg-[#f8fafc] text-sm transition-colors">Revisar más</button>
                <button onClick={() => { setShowModalFinalizar(false); enviarInspeccionAlServidor(); }} className="flex-1 py-2.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-semibold shadow-sm text-sm transition-colors">Sí, sellar proceso</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL DE ÉXITO === */}
      {showModalExitoGuardado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-sm p-6 md:p-8 text-center border border-[#e2e8f0]">
            <div className="w-20 h-20 bg-[#ecfdf5] text-[#059669] rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-black text-[#0f172a] mb-2 tracking-tight">¡Éxito!</h3>
            <p className="text-[#475569] mb-8 text-[15px] leading-relaxed">
              La inspección del proceso n° <span className="font-bold text-[#0f172a]">{numProceso}</span> ha sido finalizada y guardada correctamente.
            </p>
            <button 
              onClick={() => {
                setShowModalExitoGuardado(false);
                if (onFinishedInspection) onFinishedInspection(parseInt(numProceso, 10));
              }}
              className="w-full py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-semibold shadow-md text-sm md:text-base transition-all active:scale-[0.98]"
            >
              Aceptar y Salir
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Play } from 'lucide-react';

export default function NuevoProceso({ 
  exportadoras = [], 
  productores = [], 
  variedades = [], 
  procesosExistentes = [], 
  onIniciarInspeccion, 
  onAbrirMenu 
}) {
  const [fecha] = useState(new Date().toLocaleDateString('es-CL').replace(/\//g, '-'));
  
  // Estados para MODO COLABORATIVO
  const [verificando, setVerificando] = useState(true);
  const [procesoEnCurso, setProcesoEnCurso] = useState(null);

  const [numProceso, setNumProceso] = useState('');
  const [mensajeNum, setMensajeNum] = useState('');
  const [esErrorNum, setEsErrorNum] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [exportadoraSel, setExportadoraSel] = useState('');
  const [csgSel, setCsgSel] = useState('');
  const [variedadSel, setVariedadSel] = useState('');
  const [productorNombre, setProductorNombre] = useState('');
  const [huertoNombre, setHuertoNombre] = useState('');
  const [csgFiltrados, setCsgFiltrados] = useState([]);

  const hideSpinners = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  // AUTO-DETECCIÓN DE PROCESO ACTIVO
  useEffect(() => {
    const checkActiveProcess = async () => {
      try {
        const API_URL = window.location.hostname.includes('goldanda.cl') 
          ? 'https://evap.maq.goldanda.cl' 
          : `http://${window.location.hostname || 'localhost'}:3001`;
        
        const res = await fetch(`${API_URL}/api/inspecciones`);
        if (res.ok) {
          const data = await res.json();
          // Buscamos si hay un proceso que NO ha sido finalizado
          const activo = data.find(p => p.estado === 'En curso');
          if (activo) {
            setProcesoEnCurso(activo);
            setNumProceso(activo.numProceso.toString());
          }
        }
      } catch (error) {
        console.error("Error verificando procesos activos:", error);
      } finally {
        setVerificando(false);
      }
    };
    checkActiveProcess();
  }, []);

  useEffect(() => {
    if (exportadoraSel && !procesoEnCurso) {
      setCsgFiltrados(productores.filter(p => p.exportadora === exportadoraSel));
      setCsgSel(''); setProductorNombre(''); setHuertoNombre('');
    } else { 
      setCsgFiltrados([]); 
    }
  }, [exportadoraSel, productores, procesoEnCurso]);

  const handleSelectCSG = (codigoCsg) => {
    setCsgSel(codigoCsg);
    const encontrado = csgFiltrados.find(h => String(h.csg) === String(codigoCsg));
    if (encontrado) { 
      setProductorNombre(encontrado.productor || ''); 
      setHuertoNombre(encontrado.huerto || encontrado.nombre || ''); 
    } else {
      setProductorNombre('');
      setHuertoNombre('');
    }
  };

  const handleNumProcesoChange = (e) => {
    // Solo se ejecuta si NO hay proceso en curso
    const val = e.target.value;
    setNumProceso(val);
    
    if (val === '') { 
      setMensajeNum('Campo requerido'); 
      setEsErrorNum(true);
      return; 
    }
    
    const num = parseInt(val, 10);
    // Si digita un número que existe en props, significa que ya está Finalizado (pues verificamos que no estaba en curso antes)
    const yaFinalizado = procesosExistentes.some(p => Number(p) === num);

    if (isNaN(num) || num < 1) { 
      setMensajeNum('El número debe ser mayor a 0.'); 
      setEsErrorNum(true);
    } else if (yaFinalizado) { 
      setMensajeNum(`El proceso N° ${num} ya fue finalizado. Usa un número nuevo.`); 
      setEsErrorNum(true); 
    } else { 
      setMensajeNum(''); 
      setEsErrorNum(false);
    }
  };

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Si nos estamos uniendo a uno en curso, usamos ese número
    const targetNum = procesoEnCurso ? parseInt(procesoEnCurso.numProceso, 10) : parseInt(numProceso, 10);

    if (isNaN(targetNum) || targetNum < 1 || (!procesoEnCurso && esErrorNum)) {
      alert(`Por favor verifica el N° de Proceso.`);
      return;
    }

    setCargando(true);

    try {
      const API_URL = window.location.hostname.includes('goldanda.cl') 
        ? 'https://evap.maq.goldanda.cl' 
        : `http://${window.location.hostname || 'localhost'}:3001`;

      const horaActualStr = new Date().toISOString();
      const fechaActualIso = horaActualStr.split('T')[0];

      // Si nos unimos, rescatamos la información del proceso actual para pasarla a la inspección
      const finalExportadora = procesoEnCurso ? procesoEnCurso.exportadora : exportadoraSel;
      const finalCsg = procesoEnCurso ? procesoEnCurso.csg : csgSel;
      const finalVariedad = procesoEnCurso ? procesoEnCurso.variedad : variedadSel;
      const finalProductor = procesoEnCurso ? procesoEnCurso.productor : productorNombre;
      const finalHuerto = procesoEnCurso ? procesoEnCurso.huerto : huertoNombre;

      // Hablamos con el servidor para iniciar o unirnos
      const response = await fetch(`${API_URL}/api/procesos/colaborativo/iniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numProceso: targetNum,
          exportadora: finalExportadora,
          csg: finalCsg,
          variedad: finalVariedad,
          fecha: fechaActualIso,
          horaInicio: horaActualStr
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Le pasamos todos los datos al módulo de inspección.
        onIniciarInspeccion({
          numProceso: targetNum.toString(),
          exportadoraSel: finalExportadora,
          csgSel: finalCsg,
          variedadSel: finalVariedad,
          productorNombre: finalProductor,
          huertoNombre: finalHuerto,
          procesoIdBD: data.procesoId,
          nextCajaColaborativa: data.nextCaja,
          cajasPreviasColaborativas: data.cajasPrevias || [],
          isColaborativo: true,
          horaInicioAsignada: horaActualStr
        });
      } else {
        alert(`❌ Error: ${data.error || 'No se pudo iniciar/unirse al proceso.'}`);
      }

    } catch (error) {
      console.error("Error conectando con el backend:", error);
      alert("❌ Error de conexión. No se pudo contactar al servidor.");
    } finally {
      setCargando(false);
    }
  };

  // PANTALLA DE CARGA INICIAL (Buscando proceso activo)
  if (verificando) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E96008]"></div>
      </div>
    );
  }

  // 🔥 INTERFAZ EXCLUSIVA SI HAY UN PROCESO EN CURSO (TIPO "UNIRSE")[cite: 2]
  if (procesoEnCurso) {
    return (
      <div className="h-full w-full flex flex-col justify-center items-center px-6 py-6 animate-fade-in bg-slate-50 relative">
        {onAbrirMenu && (
          <button 
            type="button" onClick={onAbrirMenu} 
            className="absolute left-6 md:left-10 top-8 md:top-10 w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all flex items-center justify-center z-20 hover:scale-105 active:scale-95"
            title="Abrir menú"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        )}

        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-blue-100 w-full max-w-2xl flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
            <Users className="w-10 h-10" strokeWidth={2.5} />
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 mb-2">Unirse a la revisión</h1>
          <p className="text-slate-500 mb-8 max-w-md">El equipo ya ha comenzado una inspección. Solo puedes unirte al proceso activo.</p>
          
          <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full p-6 text-left grid grid-cols-2 gap-y-4 gap-x-6 mb-8 shadow-inner">
            <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Fecha</span><span className="text-base font-bold text-slate-800">{fecha}</span></div>
            <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">N° Proceso</span><span className="text-xl font-black text-[#E96008]">{procesoEnCurso.numProceso}</span></div>
            <div className="col-span-2 border-t border-slate-200 my-2"></div>
            <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Exportadora</span><span className="text-base font-bold text-slate-800">{procesoEnCurso.exportadora}</span></div>
            <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Huerto / Prod.</span><span className="text-base font-bold text-slate-800">{procesoEnCurso.huerto || procesoEnCurso.productor}</span></div>
            <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Variedad</span><span className="text-base font-bold text-blue-600">{procesoEnCurso.variedad}</span></div>
          </div>

          <button 
            onClick={onSubmit} 
            disabled={cargando} 
            className="w-full py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black rounded-xl shadow-lg shadow-blue-500/30 text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-400 disabled:shadow-none"
          >
            {cargando ? 'Conectando...' : <><Play className="w-5 h-5 fill-white" /> Unirse a inspección</>}
          </button>
        </div>
      </div>
    );
  }

  // INTERFAZ DE CREACIÓN NORMAL (SI NO HAY NADA EN CURSO)
  return (
    <div className="h-full w-full flex flex-col justify-start md:justify-center items-center px-6 py-6 animate-fade-in overflow-y-auto bg-slate-50 relative">
      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-slate-100 w-full max-w-4xl flex flex-col relative transition-all duration-500">
        
        {onAbrirMenu && (
          <button 
            type="button" onClick={onAbrirMenu} 
            className="absolute -left-4 md:-left-5 top-8 md:top-10 w-9 h-9 md:w-10 md:h-10 bg-white border border-slate-200 text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all flex items-center justify-center z-20 hover:scale-105 active:scale-95"
            title="Abrir menú de navegación"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        )}

        <div className="flex items-center mb-10 shrink-0 pl-2">
          <div className="w-1.5 h-8 bg-[#E96008] mr-4 rounded-full"></div>
          <h1 className="text-2xl md:text-3xl font-black text-[#0F172A]">Crear nueva revisión</h1>
        </div>
        
        <form onSubmit={onSubmit} className="flex flex-col gap-y-6 max-w-2xl">
          <div className="flex flex-col md:flex-row md:items-center">
            <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Fecha:</label>
            <input type="text" readOnly value={fecha} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed outline-none" />
          </div>

          <div className="flex flex-col md:flex-row md:items-start">
            <label className="md:w-36 text-left md:text-right md:pr-6 md:mt-3 text-[15px] font-bold text-slate-700">N° Proceso:</label>
            <div className="flex-1 w-full flex flex-col">
              <input 
                type="number" min="1" required placeholder="Ej: 15"
                value={numProceso} onChange={handleNumProcesoChange} 
                className={`w-full bg-white border rounded-full px-5 py-3 text-sm text-slate-800 outline-none transition-all ${esErrorNum ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-300 focus:border-[#E96008] focus:ring-2 focus:ring-orange-100'} ${hideSpinners}`} 
              />
              {mensajeNum && <span className={`text-xs mt-2 pl-4 font-bold ${esErrorNum ? 'text-red-500' : 'text-blue-600'}`}>{mensajeNum}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center">
              <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Exportadora:</label>
              <select required value={exportadoraSel} onChange={(e) => setExportadoraSel(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none cursor-pointer">
                <option value="">Seleccionar...</option>
                {exportadoras.map((e,i)=><option key={i} value={e.nombre || e}>{e.nombre || e}</option>)}
              </select>
            </div>

            <div className="flex flex-col md:flex-row md:items-center">
              <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">CSG:</label>
              <select required disabled={!exportadoraSel} value={csgSel} onChange={(e) => handleSelectCSG(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer">
                <option value="">{exportadoraSel ? 'Seleccionar...' : 'Selecciona Exportadora'}</option>
                {csgFiltrados.map((i,idx) => <option key={idx} value={i.csg}>{i.csg} - {i.huerto || i.nombre}</option>)}
              </select>
            </div>

            <div className="flex flex-col md:flex-row md:items-center">
              <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Productor:</label>
              <input type="text" readOnly placeholder="Automático" value={productorNombre} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed font-medium outline-none" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center">
              <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Huerto:</label>
              <input type="text" readOnly placeholder="Automático" value={huertoNombre} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed font-medium outline-none" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center">
              <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Variedad:</label>
              <select required value={variedadSel} onChange={(e) => setVariedadSel(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none cursor-pointer">
                <option value="">Seleccionar...</option>
                {variedades.map((v,i)=><option key={i} value={v.nombre || v}>{v.nombre || v}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-4 w-full">
            <button 
              type="submit" 
              disabled={esErrorNum || !numProceso || cargando} 
              className="px-10 py-3.5 disabled:bg-slate-300 text-white font-bold rounded-full shadow-md text-sm transition-colors flex items-center justify-center min-w-[200px] gap-2 bg-[#E96008] hover:bg-[#c74c04]"
            >
              {cargando ? 'Conectando...' : 'Iniciar evaluación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
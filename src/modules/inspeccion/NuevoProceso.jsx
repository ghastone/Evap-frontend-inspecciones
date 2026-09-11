import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

export default function NuevoProceso({ 
  exportadoras = [], 
  productores = [], 
  variedades = [], 
  procesosExistentes = [], 
  onIniciarInspeccion, 
  onAbrirMenu 
}) {
  const [fecha] = useState(new Date().toLocaleDateString('es-CL').replace(/\//g, '-'));
  const [numProceso, setNumProceso] = useState('');
  const [errorNum, setErrorNum] = useState('');

  const [exportadoraSel, setExportadoraSel] = useState('');
  const [csgSel, setCsgSel] = useState('');
  const [variedadSel, setVariedadSel] = useState('');
  const [productorNombre, setProductorNombre] = useState('');
  const [huertoNombre, setHuertoNombre] = useState('');
  const [csgFiltrados, setCsgFiltrados] = useState([]);

  const hideSpinners = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  useEffect(() => {
    if (exportadoraSel) {
      setCsgFiltrados(productores.filter(p => p.exportadora === exportadoraSel));
      setCsgSel(''); setProductorNombre(''); setHuertoNombre('');
    } else { 
      setCsgFiltrados([]); 
    }
  }, [exportadoraSel, productores]);

  const handleSelectCSG = (codigoCsg) => {
    setCsgSel(codigoCsg);
    const encontrado = csgFiltrados.find(h => String(h.csg) === String(codigoCsg));
    if (encontrado) { 
      setProductorNombre(encontrado.productor || ''); 
      setHuertoNombre(encontrado.nombre || ''); 
    } else {
      setProductorNombre('');
      setHuertoNombre('');
    }
  };

  const handleNumProcesoChange = (e) => {
    const val = e.target.value;
    setNumProceso(val);
    if (val === '') { setErrorNum('Campo requerido'); return; }
    
    const num = parseInt(val, 10);
    const existeEnBD = procesosExistentes.some(p => Number(p) === num);

    if (isNaN(num) || num < 1) { 
      setErrorNum('El número debe ser mayor a 0.'); 
    } else if (existeEnBD) { 
      setErrorNum(`El proceso N° ${num} ya fue registrado en la base de datos.`); 
    } else { 
      setErrorNum(''); 
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (numProceso === '') return alert('Debes ingresar un N° de Proceso.');
    const num = parseInt(numProceso, 10);
    const existeEnBD = procesosExistentes.some(p => Number(p) === num);

    if (isNaN(num) || num < 1 || existeEnBD) {
      alert(`Por favor verifica el N° de Proceso. El proceso N° ${num} ya existe o es inválido.`);
      return;
    }

    onIniciarInspeccion({
      numProceso,
      exportadoraSel,
      csgSel,
      variedadSel,
      productorNombre,
      huertoNombre
    });
  };

  return (
    <div className="h-full w-full flex flex-col justify-start md:justify-center items-center px-6 py-6 animate-fade-in overflow-y-auto bg-slate-50 relative">
      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-slate-100 w-full max-w-4xl flex flex-col relative">
        
        {/* BOTÓN CIRCULAR MINIMALISTA CON FLECHA A LA IZQUIERDA */}
        {onAbrirMenu && (
          <button 
            type="button" 
            onClick={onAbrirMenu} 
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
                className={`w-full bg-white border rounded-full px-5 py-3 text-sm text-slate-800 outline-none transition-all ${errorNum ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-300 focus:border-[#E96008] focus:ring-2 focus:ring-orange-100'} ${hideSpinners}`} 
              />
              {errorNum && <span className="text-red-500 text-xs mt-2 pl-4 font-bold">{errorNum}</span>}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center">
            <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Exportadora:</label>
            <select required value={exportadoraSel} onChange={(e) => setExportadoraSel(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none cursor-pointer">
              <option value="">Seleccionar...</option>
              {exportadoras.map((e,i)=><option key={i} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex flex-col md:flex-row md:items-center">
            <label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">CSG:</label>
            <select required disabled={!exportadoraSel} value={csgSel} onChange={(e) => handleSelectCSG(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer">
              <option value="">{exportadoraSel ? 'Seleccionar...' : 'Selecciona Exportadora'}</option>
              {csgFiltrados.map((i,idx)=><option key={idx} value={i.csg}>{i.csg} - {i.nombre}</option>)}
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
              {variedades.map((v,i)=><option key={i} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="pt-6 flex justify-end gap-4 w-full">
            <button type="submit" disabled={!!errorNum || !numProceso} className="px-10 py-3.5 bg-[#E96008] hover:bg-[#c74c04] disabled:bg-slate-300 text-white font-bold rounded-full shadow-md text-sm transition-colors">
              Iniciar evaluación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
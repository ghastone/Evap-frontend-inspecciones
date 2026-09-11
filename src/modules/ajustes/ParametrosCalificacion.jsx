import React, { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';

export default function ParametrosCalificacion({ 
  parametrosCalidad, 
  setParametrosCalidad, 
  parametrosCondicion, 
  setParametrosCondicion 
}) {
  const [calidadLocal, setCalidadLocal] = useState([...parametrosCalidad]);
  const [condicionLocal, setCondicionLocal] = useState([...parametrosCondicion]);

  // Formulario para agregar nuevo defecto de calidad
  const [nuevoCalidad, setNuevoCalidad] = useState({ nombre: '', limAB: '', limBC: '' });
  // Formulario para agregar nuevo defecto de condición
  const [nuevoCondicion, setNuevoCondicion] = useState({ nombre: '', lim12: '', lim23: '' });

  const handleCalidadChange = (index, field, value) => {
    const copia = [...calidadLocal];
    copia[index][field] = value === '' ? '' : parseFloat(value);
    setCalidadLocal(copia);
  };

  const handleCondicionChange = (index, field, value) => {
    const copia = [...condicionLocal];
    copia[index][field] = value === '' ? '' : parseFloat(value);
    setCondicionLocal(copia);
  };

  const agregarDefectoCalidad = (e) => {
    e.preventDefault();
    if (!nuevoCalidad.nombre.trim()) return;
    setCalidadLocal([
      ...calidadLocal,
      {
        id: Date.now(),
        nombre: nuevoCalidad.nombre.trim(),
        limAB: parseFloat(nuevoCalidad.limAB) || 0,
        limBC: parseFloat(nuevoCalidad.limBC) || 0
      }
    ]);
    setNuevoCalidad({ nombre: '', limAB: '', limBC: '' });
  };

  const agregarDefectoCondicion = (e) => {
    e.preventDefault();
    if (!nuevoCondicion.nombre.trim()) return;
    setCondicionLocal([
      ...condicionLocal,
      {
        id: Date.now(),
        nombre: nuevoCondicion.nombre.trim(),
        lim12: parseFloat(nuevoCondicion.lim12) || 0,
        lim23: parseFloat(nuevoCondicion.lim23) || 0
      }
    ]);
    setNuevoCondicion({ nombre: '', lim12: '', lim23: '' });
  };

  const eliminarCalidad = (id) => {
    setCalidadLocal(calidadLocal.filter(item => item.id !== id));
  };

  const eliminarCondicion = (id) => {
    setCondicionLocal(condicionLocal.filter(item => item.id !== id));
  };

  const guardarTodo = () => {
    setParametrosCalidad(calidadLocal);
    setParametrosCondicion(condicionLocal);
    alert('¡Parámetros de calificación guardados correctamente!');
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-5xl mx-auto space-y-8">
      
      <div>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 bg-[#FF5500] rounded-full"></div>
          <h2 className="text-2xl font-bold text-slate-900">Modificar Parámetros</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 pl-4">
          Configuración de límites para determinar notas de calidad (A/B/C) y condición (1/2/3).
        </p>
      </div>

      {/* DEFECTOS DE CALIDAD */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-lg">Defectos de Calidad</h3>
        
        <div className="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100 px-2">
          <div className="col-span-5">Defecto</div>
          <div className="col-span-3 text-center">Límite A-B (%)</div>
          <div className="col-span-3 text-center">Límite B-C (%)</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>

        <div className="space-y-2">
          {calidadLocal.map((item, index) => (
            <div key={item.id || item.nombre} className="grid grid-cols-12 items-center gap-3 text-sm py-1 px-2 hover:bg-slate-50/50 rounded-xl">
              <span className="col-span-5 text-slate-700 font-medium text-xs truncate">
                {item.nombre}
              </span>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.1"
                  value={item.limAB}
                  onChange={(e) => handleCalidadChange(index, 'limAB', e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.1"
                  value={item.limBC}
                  onChange={(e) => handleCalidadChange(index, 'limBC', e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                />
              </div>
              <div className="col-span-1 text-right">
                {item.esSumatoria ? null : (
                  <button onClick={() => eliminarCalidad(item.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Formulario Agregar Defecto Calidad */}
        <form onSubmit={agregarDefectoCalidad} className="flex gap-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
          <input
            type="text"
            placeholder="Nuevo defecto calidad..."
            value={nuevoCalidad.nombre}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, nombre: e.target.value })}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Lim A-B"
            value={nuevoCalidad.limAB}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, limAB: e.target.value })}
            className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Lim B-C"
            value={nuevoCalidad.limBC}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, limBC: e.target.value })}
            className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none"
          />
          <button type="submit" className="bg-[#FF5500] hover:bg-[#e04b00] text-white px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </form>
      </div>

      {/* DEFECTOS DE CONDICIÓN */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="font-bold text-slate-800 text-lg">Defectos de Condición</h3>
        
        <div className="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase pb-2 border-b border-slate-100 px-2">
          <div className="col-span-5">Defecto</div>
          <div className="col-span-3 text-center">Límite 1-2 (%)</div>
          <div className="col-span-3 text-center">Límite 2-3 (%)</div>
          <div className="col-span-1 text-right">Acción</div>
        </div>

        <div className="space-y-2">
          {condicionLocal.map((item, index) => (
            <div key={item.id || item.nombre} className="grid grid-cols-12 items-center gap-3 text-sm py-1 px-2 hover:bg-slate-50/50 rounded-xl">
              <span className="col-span-5 text-slate-700 font-medium text-xs truncate">
                {item.nombre}
              </span>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  value={item.lim12}
                  onChange={(e) => handleCondicionChange(index, 'lim12', e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  value={item.lim23}
                  onChange={(e) => handleCondicionChange(index, 'lim23', e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-center text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                />
              </div>
              <div className="col-span-1 text-right">
                {item.esSumatoria ? null : (
                  <button onClick={() => eliminarCondicion(item.id)} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Formulario Agregar Defecto Condición */}
        <form onSubmit={agregarDefectoCondicion} className="flex gap-3 pt-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
          <input
            type="text"
            placeholder="Nuevo defecto condición..."
            value={nuevoCondicion.nombre}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, nombre: e.target.value })}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Lim 1-2"
            value={nuevoCondicion.lim12}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, lim12: e.target.value })}
            className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Lim 2-3"
            value={nuevoCondicion.lim23}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, lim23: e.target.value })}
            className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-center focus:outline-none"
          />
          <button type="submit" className="bg-[#FF5500] hover:bg-[#e04b00] text-white px-4 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </form>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          onClick={guardarTodo}
          className="flex items-center gap-2 px-8 py-3 bg-[#FF5500] hover:bg-[#e04b00] text-white font-bold rounded-full text-sm shadow-md transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Guardar Parámetros</span>
        </button>
      </div>

    </div>
  );
}
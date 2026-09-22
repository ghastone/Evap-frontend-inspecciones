import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

// Valores por defecto en caso de que la base de datos esté vacía (Ajustado según tabla técnica)
const defectosCalidadBase = [
  { id: 998, nombre: 'Sumatoria de calidad', limAB: 15.0, limBC: 20.0 }, // Añadido como normal
  { id: 1, nombre: 'Frutos deformes / dobles', limAB: 3.0, limBC: 6.0 },
  { id: 11, nombre: 'Bajo calibre', limAB: 5.0, limBC: 10.0 },
  { id: 12, nombre: 'Sobre calibre', limAB: 5.0, limBC: 10.0 },
  { id: 2, nombre: 'Daños de trips', limAB: 6.0, limBC: 10.0 },
  { id: 13, nombre: 'Daños de insecto (otros)', limAB: 6.0, limBC: 10.0 },
  { id: 3, nombre: 'Golpe de sol', limAB: 6.0, limBC: 10.0 },
  { id: 4, nombre: 'Manchas', limAB: 6.0, limBC: 10.0 },
  { id: 5, nombre: 'Sutura (severa)', limAB: 6.0, limBC: 10.0 },
  { id: 6, nombre: 'Herida cicatrizada', limAB: 6.0, limBC: 10.0 },
  { id: 7, nombre: 'Desuniformidad de color', limAB: 6.0, limBC: 10.0 },
  { id: 8, nombre: 'Russet', limAB: 6.0, limBC: 15.0 },
  { id: 9, nombre: 'Fruta sin pedicelo', limAB: 8.0, limBC: 16.0 },
  { id: 10, nombre: 'Falta de color', limAB: 10.0, limBC: 20.0 }
];

// Valores por defecto (Condición - Actualizado con nueva tabla técnica)
const defectosCondicionBase = [
  { id: 999, nombre: 'Sumatoria de condición', lim12: 10.0, lim23: 15.0 }, // Añadido como normal
  { id: 101, nombre: 'Pudrición', lim12: 0.0, lim23: 0.4 },
  { id: 102, nombre: 'Mancha parda', lim12: 0.0, lim23: 0.4 },
  { id: 103, nombre: 'Herida de insecto', lim12: 0.0, lim23: 0.4 },
  { id: 104, nombre: 'Herida de pájaro', lim12: 0.0, lim23: 0.4 },
  { id: 105, nombre: 'Herida abierta', lim12: 1.0, lim23: 3.0 },
  { id: 106, nombre: 'Partidura de agua', lim12: 2.0, lim23: 4.0 },
  { id: 107, nombre: 'Virosis', lim12: 2.0, lim23: 4.0 },
  { id: 108, nombre: 'Partiduras laterales', lim12: 2.0, lim23: 5.0 },
  { id: 109, nombre: 'Partiduras apicales', lim12: 2.0, lim23: 5.0 },
  { id: 110, nombre: 'Machucones', lim12: 2.0, lim23: 5.0 },
  { id: 111, nombre: 'Pitting severo', lim12: 2.0, lim23: 5.0 },
  { id: 112, nombre: 'Fruta blanda', lim12: 2.0, lim23: 5.0 },
  { id: 113, nombre: 'Sobre madurez (f. negros/ deshidratación)', lim12: 2.0, lim23: 5.0 },
  { id: 115, nombre: 'Desgarro pedicelar', lim12: 3.0, lim23: 6.0 },
  { id: 116, nombre: 'Medias lunas (anillo > 50%)', lim12: 5.0, lim23: 8.0 },
  { id: 117, nombre: 'Pitting leve', lim12: 5.0, lim23: 8.0 },
  { id: 118, nombre: 'Piel de lagarto (severa)', lim12: 5.0, lim23: 8.0 }
];

export default function ParametrosCalificacion() {
  const [calidadLocal, setCalidadLocal] = useState([]);
  const [condicionLocal, setCondicionLocal] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [nuevoCalidad, setNuevoCalidad] = useState({ nombre: '', limAB: '', limBC: '' });
  const [nuevoCondicion, setNuevoCondicion] = useState({ nombre: '', lim12: '', lim23: '' });

  // URL Inteligente
  const API_URL = import.meta.env.PROD 
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  // Cargar parámetros desde el servidor al montar
  useEffect(() => {
    const fetchParametros = async () => {
      try {
        const response = await fetch(`${API_URL}/api/parametros`);
        if (response.ok) {
          const data = await response.json();
          let cal = data.calidad?.length ? data.calidad : defectosCalidadBase;
          let cond = data.condicion?.length ? data.condicion : defectosCondicionBase;

          // Parche de seguridad: Asegura que las sumatorias existan aunque cargue DB antigua
          if (!cal.find(d => d.nombre === 'Sumatoria de calidad')) {
            cal.unshift({ id: 998, nombre: 'Sumatoria de calidad', limAB: 15.0, limBC: 20.0 });
          }
          if (!cond.find(d => d.nombre === 'Sumatoria de condición')) {
            cond.unshift({ id: 999, nombre: 'Sumatoria de condición', lim12: 10.0, lim23: 15.0 });
          }

          setCalidadLocal(cal);
          setCondicionLocal(cond);
        } else {
          setCalidadLocal(defectosCalidadBase);
          setCondicionLocal(defectosCondicionBase);
        }
      } catch (error) {
        console.error("Error cargando parámetros:", error);
        // Fallback a los datos base si no hay conexión
        setCalidadLocal(defectosCalidadBase);
        setCondicionLocal(defectosCondicionBase);
      } finally {
        setCargando(false);
      }
    };

    fetchParametros();
  }, [API_URL]);

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

  const guardarTodo = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const response = await fetch(`${API_URL}/api/parametros`, {
        method: 'POST', // o PUT, según cómo lo configures en el backend
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calidad: calidadLocal,
          condicion: condicionLocal
        })
      });

      if (response.ok) {
        setMensaje({ tipo: 'exito', texto: '¡Parámetros de tolerancia actualizados correctamente!' });
        setTimeout(() => setMensaje(null), 3000);
      } else {
        throw new Error('Error al guardar en el servidor');
      }
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: 'error', texto: 'No se pudieron guardar los parámetros en el servidor. Revisa tu conexión.' });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="p-8 text-center text-slate-500 font-bold">Cargando parámetros de calificación...</div>;
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100 max-w-5xl mx-auto space-y-8 animate-fade-in relative pb-24">
      
      {/* Alerta flotante de mensajes */}
      {mensaje && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 ${
          mensaje.tipo === 'exito' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {mensaje.tipo === 'exito' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {mensaje.texto}
        </div>
      )}

      <div>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-[#E96008] rounded-full"></div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Tolerancias y Calificación</h2>
        </div>
        <p className="text-sm text-slate-500 mt-2 pl-4 font-medium">
          Ajusta los porcentajes límite máximos permitidos para cada defecto. Estos valores dictarán automáticamente si un lote clasifica como <strong className="text-slate-700">A, B o C</strong> (en calidad) y <strong className="text-slate-700">1, 2 o 3</strong> (en condición).
        </p>
      </div>

      {/* DEFECTOS DE CALIDAD */}
      <div className="space-y-4 bg-slate-50/50 p-4 md:p-6 rounded-3xl border border-slate-100">
        <h3 className="font-black text-[#E96008] text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#E96008]"></span> Defectos de Calidad
        </h3>
        
        <div className="grid grid-cols-12 text-[11px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200 px-2">
          <div className="col-span-5">Nombre del Defecto</div>
          <div className="col-span-3 text-center">Tolerancia A - B (%)</div>
          <div className="col-span-3 text-center">Tolerancia B - C (%)</div>
          <div className="col-span-1 text-right"></div>
        </div>

        <div className="space-y-2">
          {calidadLocal.map((item, index) => (
            <div 
              key={item.id || item.nombre} 
              className="grid grid-cols-12 items-center gap-3 text-sm py-2 px-2 hover:bg-white rounded-xl transition-colors group"
            >
              <span className="col-span-5 text-slate-700 font-bold text-xs md:text-sm truncate">
                {item.nombre}
              </span>
              <div className="col-span-3 relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-400">{'<='}</span>
                <input
                  type="number"
                  step="0.1"
                  value={item.limAB}
                  onChange={(e) => handleCalidadChange(index, 'limAB', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-center text-xs font-bold focus:outline-none focus:border-[#E96008] shadow-sm"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">%</span>
              </div>
              <div className="col-span-3 relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-400">{'<='}</span>
                <input
                  type="number"
                  step="0.1"
                  value={item.limBC}
                  onChange={(e) => handleCalidadChange(index, 'limBC', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-center text-xs font-bold focus:outline-none focus:border-[#E96008] shadow-sm"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">%</span>
              </div>
              <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => eliminarCalidad(item.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulario Agregar Defecto Calidad */}
        <form onSubmit={agregarDefectoCalidad} className="flex flex-col md:flex-row gap-3 pt-4 mt-2 border-t border-slate-200/60">
          <input
            type="text"
            placeholder="Añadir nuevo defecto de calidad..."
            value={nuevoCalidad.nombre}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, nombre: e.target.value })}
            className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-[#E96008]"
          />
          <input
            type="number" step="0.1" placeholder="% Lím. AB"
            value={nuevoCalidad.limAB}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, limAB: e.target.value })}
            className="w-full md:w-28 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-center font-bold focus:outline-none focus:border-[#E96008]"
          />
          <input
            type="number" step="0.1" placeholder="% Lím. BC"
            value={nuevoCalidad.limBC}
            onChange={(e) => setNuevoCalidad({ ...nuevoCalidad, limBC: e.target.value })}
            className="w-full md:w-28 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-center font-bold focus:outline-none focus:border-[#E96008]"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>
      </div>

      {/* DEFECTOS DE CONDICIÓN */}
      <div className="space-y-4 bg-slate-50/50 p-4 md:p-6 rounded-3xl border border-slate-100">
        <h3 className="font-black text-red-600 text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600"></span> Defectos de Condición
        </h3>
        
        <div className="grid grid-cols-12 text-[11px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-200 px-2">
          <div className="col-span-5">Nombre del Defecto</div>
          <div className="col-span-3 text-center">Tolerancia 1 - 2 (%)</div>
          <div className="col-span-3 text-center">Tolerancia 2 - 3 (%)</div>
          <div className="col-span-1 text-right"></div>
        </div>

        <div className="space-y-2">
          {condicionLocal.map((item, index) => (
            <div 
              key={item.id || item.nombre} 
              className="grid grid-cols-12 items-center gap-3 text-sm py-2 px-2 hover:bg-white rounded-xl transition-colors group"
            >
              <span className="col-span-5 text-slate-700 font-bold text-xs md:text-sm truncate">
                {item.nombre}
              </span>
              <div className="col-span-3 relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-400">{'<='}</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.lim12}
                  onChange={(e) => handleCondicionChange(index, 'lim12', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-center text-xs font-bold focus:outline-none focus:border-red-500 shadow-sm"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">%</span>
              </div>
              <div className="col-span-3 relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-400">{'<='}</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.lim23}
                  onChange={(e) => handleCondicionChange(index, 'lim23', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-center text-xs font-bold focus:outline-none focus:border-red-500 shadow-sm"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">%</span>
              </div>
              <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => eliminarCondicion(item.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulario Agregar Defecto Condición */}
        <form onSubmit={agregarDefectoCondicion} className="flex flex-col md:flex-row gap-3 pt-4 mt-2 border-t border-slate-200/60">
          <input
            type="text"
            placeholder="Añadir nuevo defecto de condición..."
            value={nuevoCondicion.nombre}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, nombre: e.target.value })}
            className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-red-500"
          />
          <input
            type="number" step="0.01" placeholder="% Lím. 1-2"
            value={nuevoCondicion.lim12}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, lim12: e.target.value })}
            className="w-full md:w-28 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-center font-bold focus:outline-none focus:border-red-500"
          />
          <input
            type="number" step="0.01" placeholder="% Lím. 2-3"
            value={nuevoCondicion.lim23}
            onChange={(e) => setNuevoCondicion({ ...nuevoCondicion, lim23: e.target.value })}
            className="w-full md:w-28 bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-center font-bold focus:outline-none focus:border-red-500"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>
      </div>

      <div className="absolute bottom-6 right-6 md:right-10">
        <button
          onClick={guardarTodo}
          disabled={guardando}
          className="flex items-center gap-2 px-8 py-4 bg-[#E96008] hover:bg-[#c74c04] disabled:bg-slate-400 text-white font-black rounded-2xl text-sm shadow-xl hover:shadow-2xl transition-all"
        >
          <Save className="w-5 h-5" />
          <span>{guardando ? 'Guardando...' : 'Guardar Parámetros en Servidor'}</span>
        </button>
      </div>

    </div>
  );
}
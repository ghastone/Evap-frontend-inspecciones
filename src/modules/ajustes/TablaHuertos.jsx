import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import ModalHuerto from './ModalHuerto';

export default function TablaHuertos({ exportadoras = [] }) {
  const [huertosDb, setHuertosDb] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [huertoSeleccionado, setHuertoSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [formHuerto, setFormHuerto] = useState({ productor: '', huerto: '', csg: '', exportadora: '' });

  // 👇 NUEVO: Variable inteligente que detecta si está en Producción o Desarrollo
  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  // 1. Cargar los huertos de la base de datos al inicio
  const cargarHuertos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/huertos`);
      if (res.ok) {
        const data = await res.json();
        setHuertosDb(data);
      }
    } catch (error) {
      console.error('Error al cargar huertos:', error);
    }
  };

  useEffect(() => {
    cargarHuertos();
  }, []);

  const huertosFiltrados = huertosDb.filter(h => {
    const productor = h.productor || '';
    const huerto = h.huerto || ''; 
    const csg = h.csg || '';
    const exportadora = h.exportadora || '';

    return productor.toLowerCase().includes(busqueda.toLowerCase()) ||
           huerto.toLowerCase().includes(busqueda.toLowerCase()) ||
           String(csg).toLowerCase().includes(busqueda.toLowerCase()) ||
           exportadora.toLowerCase().includes(busqueda.toLowerCase());
  });

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    let expInicial = '';
    if (exportadoras && exportadoras.length > 0) {
      expInicial = typeof exportadoras[0] === 'object' ? exportadoras[0].nombre : exportadoras[0];
    }
    setFormHuerto({ productor: '', huerto: '', csg: '', exportadora: expInicial });
    setModalAbierto(true);
  };

  const abrirModalEditar = () => {
    const h = huertosDb.find(item => item.id === huertoSeleccionado);
    if (h) {
      setModoEdicion(true);
      setFormHuerto({ ...h });
      setModalAbierto(true);
    } else {
      alert("Por favor, selecciona un huerto haciendo clic en la tabla antes de editar.");
    }
  };

  // 2. Guardar o Editar en la Base de Datos
  const guardarHuerto = async (e) => {
    e.preventDefault();
    try {
      const method = modoEdicion ? 'PUT' : 'POST';
      const url = modoEdicion ? `${API_URL}/api/huertos/${formHuerto.id}` : `${API_URL}/api/huertos`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formHuerto)
      });

      if (res.ok) {
        await cargarHuertos(); // Recargar la tabla
        setModalAbierto(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al guardar huerto');
      }
    } catch (error) {
      alert('Error de conexión con el servidor.');
    }
  };

  // 3. Eliminar de la Base de Datos
  const eliminarHuerto = async () => {
    const h = huertosDb.find(item => item.id === huertoSeleccionado);
    if (!h) {
      return alert("Selecciona un huerto para eliminar.");
    }

    if (window.confirm(`¿Estás seguro de eliminar el huerto "${h.huerto}"?`)) {
      try {
        const res = await fetch(`${API_URL}/api/huertos/${h.id}`, { method: 'DELETE' });
        if (res.ok) {
          setHuertoSeleccionado(null);
          await cargarHuertos(); // Recargar tabla
        } else {
          const errorData = await res.json();
          alert(errorData.error || 'Error al eliminar');
        }
      } catch (error) {
        alert('Error de conexión con el servidor.');
      }
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 bg-[#FF5500] rounded-full"></div>
        <h2 className="text-2xl font-bold text-slate-900">Huertos registrados</h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por productor, huerto, CSG o exportadora..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-full pl-11 pr-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/40"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={abrirModalNuevo} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Nuevo huerto</span>
          </button>
          <button onClick={abrirModalEditar} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            <Edit className="w-4 h-4 text-slate-500" />
            <span>Editar</span>
          </button>
          <button onClick={eliminarHuerto} className="flex items-center gap-2 px-5 py-2.5 border border-red-200 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 transition-all">
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Eliminar</span>
          </button>
        </div>
      </div>

      <div className="border border-slate-200/70 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-6">Productor</th>
              <th className="py-3.5 px-6">Nombre del huerto</th>
              <th className="py-3.5 px-6">CSG</th>
              <th className="py-3.5 px-6">Exportadora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {huertosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-slate-400 font-medium">
                  No se encontraron huertos. Crea uno nuevo para comenzar.
                </td>
              </tr>
            ) : (
              huertosFiltrados.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setHuertoSeleccionado(item.id)}
                  className={`cursor-pointer transition-colors ${item.id === huertoSeleccionado ? 'bg-orange-50/50 font-medium border-l-2 border-l-[#FF5500]' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                >
                  <td className="py-4 px-6">{item.productor}</td>
                  <td className="py-4 px-6">{item.huerto}</td>
                  <td className="py-4 px-6 font-semibold">{item.csg}</td>
                  <td className="py-4 px-6">{item.exportadora}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <ModalHuerto
          modoEdicion={modoEdicion}
          formHuerto={formHuerto}
          setFormHuerto={setFormHuerto}
          guardarHuerto={guardarHuerto}
          cerrarModal={() => setModalAbierto(false)}
          exportadoras={exportadoras}
        />
      )}
    </div>
  );
}
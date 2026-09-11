import React, { useState } from 'react';
import { Search, Plus, Edit } from 'lucide-react';
import ModalHuerto from './ModalHuerto';

export default function TablaHuertos({ listaHuertos, setListaHuertos, exportadoras }) {
  const [busqueda, setBusqueda] = useState('');
  const [huertoSeleccionado, setHuertoSeleccionado] = useState(listaHuertos[0]?.id || null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [formHuerto, setFormHuerto] = useState({ productor: '', huerto: '', csg: '', exportadora: '' });

  const huertosFiltrados = listaHuertos.filter(h => 
    h.productor.toLowerCase().includes(busqueda.toLowerCase()) ||
    h.huerto.toLowerCase().includes(busqueda.toLowerCase()) ||
    h.csg.includes(busqueda) ||
    h.exportadora.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setFormHuerto({ productor: '', huerto: '', csg: '', exportadora: exportadoras[0] || '' });
    setModalAbierto(true);
  };

  const abrirModalEditar = () => {
    const h = listaHuertos.find(item => item.id === huertoSeleccionado);
    if (h) {
      setModoEdicion(true);
      setFormHuerto({ ...h });
      setModalAbierto(true);
    }
  };

  const guardarHuerto = (e) => {
    e.preventDefault();
    if (modoEdicion) {
      setListaHuertos(listaHuertos.map(h => h.id === formHuerto.id ? formHuerto : h));
    } else {
      const nuevo = { ...formHuerto, id: Date.now() };
      setListaHuertos([...listaHuertos, nuevo]);
      setHuertoSeleccionado(nuevo.id);
    }
    setModalAbierto(false);
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
            <span>Editar huerto</span>
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
            {huertosFiltrados.map((item) => (
              <tr
                key={item.id}
                onClick={() => setHuertoSeleccionado(item.id)}
                className={`cursor-pointer transition-colors ${item.id === huertoSeleccionado ? 'bg-sky-50/70 font-medium' : 'hover:bg-slate-50'}`}
              >
                <td className="py-4 px-6">{item.productor}</td>
                <td className="py-4 px-6">{item.huerto}</td>
                <td className="py-4 px-6 font-semibold">{item.csg}</td>
                <td className="py-4 px-6">{item.exportadora}</td>
              </tr>
            ))}
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
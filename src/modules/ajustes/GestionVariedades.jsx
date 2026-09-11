import React, { useState } from 'react';
import { Plus, Trash2, Apple } from 'lucide-react';

export default function GestionVariedades({ variedades, setVariedades }) {
  const [nombreNueva, setNombreNueva] = useState('');

  const agregarVariedad = (e) => {
    e.preventDefault();
    const nombreTrimmed = nombreNueva.trim();
    
    if (!nombreTrimmed) return;
    
    if (variedades.includes(nombreTrimmed)) {
      alert('Esta variedad ya se encuentra registrada.');
      return;
    }
    
    // Agrega la nueva variedad a la lista global
    setVariedades([...variedades, nombreTrimmed]);
    setNombreNueva(''); // Limpia el input
  };

  const eliminarVariedad = (nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar la variedad "${nombre}"?`)) {
      setVariedades(variedades.filter(v => v !== nombre));
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-4xl mx-auto space-y-6">
      
      {/* ENCABEZADO */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 bg-[#FF5500] rounded-full"></div>
        <h2 className="text-2xl font-bold text-slate-900">Variedades registradas</h2>
      </div>

      {/* FORMULARIO DE INGRESO */}
      <form onSubmit={agregarVariedad} className="flex flex-col sm:flex-row gap-3 pt-2">
        <div className="relative flex-1">
          <Apple className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Escribe el nombre de la variedad..."
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-full pl-12 pr-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/40 transition-shadow"
          />
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-8 py-3 bg-[#FF5500] hover:bg-[#e04b00] text-white rounded-full text-sm font-bold transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Variedad</span>
        </button>
      </form>

      {/* TABLA DE VARIEDADES */}
      <div className="border border-slate-200/70 rounded-2xl overflow-hidden mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/50 text-[12px] font-extrabold text-slate-500 uppercase tracking-wider">
              <th className="py-4 px-6 w-16">N°</th>
              <th className="py-4 px-6">Nombre de Variedad</th>
              <th className="py-4 px-6 text-right w-28">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {variedades.length === 0 ? (
              <tr>
                <td colSpan="3" className="py-8 text-center text-slate-400 font-medium">
                  No hay variedades registradas.
                </td>
              </tr>
            ) : (
              variedades.map((v, index) => (
                <tr key={v} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-400">{index + 1}</td>
                  <td className="py-4 px-6 font-bold text-slate-800">{v}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => eliminarVariedad(v)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Eliminar variedad"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
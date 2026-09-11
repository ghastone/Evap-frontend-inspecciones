import React, { useState } from 'react';
import { Plus, Trash2, Building2 } from 'lucide-react';

export default function GestionExportadoras({ exportadoras, setExportadoras }) {
  const [nombreNueva, setNombreNueva] = useState('');

  const agregarExportadora = (e) => {
    e.preventDefault();
    if (!nombreNueva.trim()) return;
    if (exportadoras.includes(nombreNueva.trim())) {
      alert('Esta exportadora ya existe.');
      return;
    }
    setExportadoras([...exportadoras, nombreNueva.trim()]);
    setNombreNueva('');
  };

  const eliminarExportadora = (nombre) => {
    if (confirm(`¿Eliminar la exportadora "${nombre}"?`)) {
      setExportadoras(exportadoras.filter(e => e !== nombre));
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 bg-[#FF5500] rounded-full"></div>
        <h2 className="text-2xl font-bold text-slate-900">Exportadoras registradas</h2>
      </div>

      <form onSubmit={agregarExportadora} className="flex gap-3 pt-2">
        <div className="relative flex-1">
          <Building2 className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Nombre de la nueva exportadora..."
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200/80 rounded-full pl-11 pr-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/40"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 px-6 py-2.5 bg-[#FF5500] hover:bg-[#e04b00] text-white rounded-full text-xs font-semibold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Exportadora</span>
        </button>
      </form>

      <div className="border border-slate-200/70 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-6">N°</th>
              <th className="py-3.5 px-6">Nombre Exportadora</th>
              <th className="py-3.5 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {exportadoras.map((exp, index) => (
              <tr key={exp} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-medium text-slate-400">{index + 1}</td>
                <td className="py-4 px-6 font-semibold text-slate-800">{exp}</td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => eliminarExportadora(exp)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
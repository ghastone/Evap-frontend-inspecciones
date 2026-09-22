import React, { useState } from 'react';
import { Plus, Trash2, Building2 } from 'lucide-react';

export default function GestionExportadoras({ exportadoras, setExportadoras }) {
  const [nombreNueva, setNombreNueva] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = `http://${window.location.hostname || 'localhost'}:3001`;

  const agregarExportadora = async (e) => {
    e.preventDefault();
    const nombre = nombreNueva.trim();
    
    if (!nombre) return;
    if (exportadoras.includes(nombre)) {
      alert('Esta exportadora ya existe.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/exportadoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      });

      if (res.ok) {
        setExportadoras([...exportadoras, nombre]);
        setNombreNueva(''); 
      } else {
        alert('Error al guardar la exportadora en la base de datos.');
      }
    } catch (error) {
      console.error('Error de conexión:', error);
      alert('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const eliminarExportadora = async (nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar la exportadora "${nombre}"?`)) {
      try {
        const API_URL = import.meta.env.PROD 
          ? 'https://evap.maq.goldanda.cl' 
          : `http://${window.location.hostname || 'localhost'}:3001`;

        const res = await fetch(`${API_URL}/api/exportadoras/${encodeURIComponent(nombre)}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          setExportadoras(exportadoras.filter(e => e !== nombre));
        } else {
          alert('Error al eliminar en la base de datos.');
        }
      } catch (error) {
        console.error('Error de conexión:', error);
        alert('No se pudo conectar con el servidor.');
      }
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-4xl mx-auto space-y-6">
      
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1.5 h-7 bg-[#FF5500] rounded-full"></div>
        <h2 className="text-2xl font-bold text-slate-900">Exportadoras</h2>
      </div>

      {/* NUEVO DISEÑO: FORMULARIO DE INGRESO */}
      <form onSubmit={agregarExportadora} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#FF5500]" />
          Registrar Nueva Exportadora
        </h3>
        
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="nombreExportadora" className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              Nombre de la Empresa
            </label>
            <input
              id="nombreExportadora"
              type="text"
              placeholder="Ej. Agrícola del Norte S.A."
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              disabled={isLoading}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/40 focus:border-[#FF5500]/60 transition-all shadow-sm"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#FF5500] hover:bg-[#e04b00] disabled:bg-slate-400 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{isLoading ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </form>

      {/* TABLA DE REGISTROS */}
      <div className="border border-slate-200/70 rounded-2xl overflow-hidden mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-4 px-6 w-16">N°</th>
              <th className="py-4 px-6">Nombre Exportadora</th>
              <th className="py-4 px-6 text-right w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {exportadoras.length === 0 ? (
              <tr>
                <td colSpan="3" className="py-8 text-center text-slate-400 font-medium">
                  No hay exportadoras registradas
                </td>
              </tr>
            ) : (
              exportadoras.map((exp, index) => (
                <tr key={exp} className="hover:bg-orange-50/30 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-400">{index + 1}</td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{exp}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => eliminarExportadora(exp)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
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
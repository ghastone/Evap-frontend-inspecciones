import React from 'react';
import { X } from 'lucide-react';

export default function ModalHuerto({ modoEdicion, formHuerto, setFormHuerto, guardarHuerto, cerrarModal, exportadoras }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">
            {modoEdicion ? 'Editar Huerto' : 'Agregar Nuevo Huerto'}
          </h3>
          <button onClick={cerrarModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={guardarHuerto} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Exportadora Asignada</label>
            <select
              required
              value={formHuerto.exportadora}
              onChange={(e) => setFormHuerto({ ...formHuerto, exportadora: e.target.value })}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            >
              <option value="">-- Seleccionar Exportadora --</option>
              {exportadoras.map((exp) => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Código CSG</label>
            <input
              type="text"
              required
              placeholder="Ej: 98901"
              value={formHuerto.csg}
              onChange={(e) => setFormHuerto({ ...formHuerto, csg: e.target.value })}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Productor</label>
            <input
              type="text"
              required
              value={formHuerto.productor}
              onChange={(e) => setFormHuerto({ ...formHuerto, productor: e.target.value })}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Huerto</label>
            <input
              type="text"
              required
              value={formHuerto.huerto}
              onChange={(e) => setFormHuerto({ ...formHuerto, huerto: e.target.value })}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={cerrarModal}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#FF5500] hover:bg-[#e04b00] text-white rounded-full text-xs font-medium shadow-sm"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
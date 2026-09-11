import React, { useState } from 'react';
import { Building2, Trees, Apple, SlidersHorizontal } from 'lucide-react';

// Importamos exactamente los archivos que tienes en tu carpeta
import GestionExportadoras from './GestionExportadoras';
import GestionVariedades from './GestionVariedades';
import TablaHuertos from './TablaHuertos';
import ParametrosCalificacion from './ParametrosCalificacion';

export default function AjustesModule({ 
  exportadoras, setExportadoras, 
  productores, setProductores, 
  variedades, setVariedades 
}) {
  // Estado para controlar qué submódulo se está viendo
  const [activeTab, setActiveTab] = useState('exportadoras');

  return (
    <div className="p-8 max-w-6xl mx-auto w-full animate-fade-in">
      <div className="bg-white p-8 md:p-10 rounded-[32px] shadow-sm border border-slate-200">
        
        {/* ENCABEZADO Y PESTAÑAS */}
        <div className="mb-8">
          <h2 className="text-3xl font-black text-slate-800 mb-2">Ajustes del Sistema</h2>
          <p className="text-slate-500 text-sm">Gestiona las listas maestras y parámetros de calificación.</p>
        </div>

        {/* NAVEGACIÓN ENTRE SUBMÓDULOS */}
        <div className="flex border-b border-slate-200 mb-8 gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('exportadoras')}
            className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'exportadoras' ? 'border-[#FF5500] text-[#FF5500] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Building2 className="w-4 h-4" /> Exportadoras
          </button>

          <button
            onClick={() => setActiveTab('variedades')}
            className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'variedades' ? 'border-[#FF5500] text-[#FF5500] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Apple className="w-4 h-4" /> Variedades
          </button>

          <button
            onClick={() => setActiveTab('huertos')}
            className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'huertos' ? 'border-[#FF5500] text-[#FF5500] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Trees className="w-4 h-4" /> Huertos y Productores
          </button>

          <button
            onClick={() => setActiveTab('parametros')}
            className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'parametros' ? 'border-[#FF5500] text-[#FF5500] bg-orange-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Parámetros Calificación
          </button>
        </div>

        {/* RENDERIZADO DEL SUBMÓDULO SELECCIONADO */}
        <div className="mt-4">
          {activeTab === 'exportadoras' && (
            <GestionExportadoras 
              exportadoras={exportadoras} 
              setExportadoras={setExportadoras} 
            />
          )}

          {activeTab === 'variedades' && (
            <GestionVariedades 
              variedades={variedades} 
              setVariedades={setVariedades} 
            />
          )}

          {activeTab === 'huertos' && (
            <TablaHuertos 
              exportadoras={exportadoras}
              productores={productores} 
              setProductores={setProductores} 
            />
          )}

          {activeTab === 'parametros' && (
            <ParametrosCalificacion />
          )}
        </div>

      </div>
    </div>
  );
}
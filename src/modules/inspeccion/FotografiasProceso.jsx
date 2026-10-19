import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Image as ImageIcon, Loader2, Plus, X } from 'lucide-react';

const comprimirImagen = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const original = reader.result;
    const img = new Image();
    img.onload = () => {
      const max = 2400;
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(original);
    img.src = original;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function FotografiasProceso({ apiUrl, procesoId, lightOk = false, darkOk = false, disabled = false, onEstadoChange, onLocalPhoto }) {
  const refs = { lightCam: useRef(null), lightFile: useRef(null), darkCam: useRef(null), darkFile: useRef(null) };
  const [estado, setEstado] = useState({ light: lightOk, dark: darkOk });
  const [subiendo, setSubiendo] = useState(null);
  const [selectorTipo, setSelectorTipo] = useState(null);
  const [confirmarTipo, setConfirmarTipo] = useState(null);
  useEffect(() => setEstado({ light: Boolean(lightOk), dark: Boolean(darkOk) }), [lightOk, darkOk]);

  const cargar = async (tipo, file) => {
    if (!file || disabled) return;
    setSelectorTipo(null);
    setSubiendo(tipo);
    try {
      const imagen = await comprimirImagen(file);
      if (!imagen?.startsWith('data:image/') || imagen.length > 8 * 1024 * 1024) throw new Error('La fotografía es demasiado grande o no tiene un formato compatible.');
      let nuevo = { ...estado, [tipo]: true };
      if (procesoId) {
        const res = await fetch(`${apiUrl}/api/procesos/colaborativo/${procesoId}/fotografias`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, imagen })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar la fotografía.');
        nuevo = { light: Boolean(data.fotoLight), dark: Boolean(data.fotoDark) };
      } else if (onLocalPhoto) onLocalPhoto(tipo, imagen);
      setEstado(nuevo);
      onEstadoChange?.(nuevo);
    } catch (error) {
      alert(error.message || 'No se pudo procesar la fotografía.');
    } finally { setSubiendo(null); }
  };

  const abrirEntrada = (tipo, origen) => {
    const ref = refs[`${tipo}${origen === 'camara' ? 'Cam' : 'File'}`];
    ref?.current?.click();
  };

  const TarjetaFoto = ({ tipo, label }) => {
    const listo = estado[tipo], cargando = subiendo === tipo;
    return (
      <button type="button" onClick={() => !disabled && (listo ? setConfirmarTipo(tipo) : setSelectorTipo(tipo))} disabled={disabled || Boolean(subiendo)}
        className={`group min-w-[145px] h-12 px-3 rounded-xl border flex items-center gap-2.5 text-left transition-all shadow-sm ${listo ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}>
        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${listo ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'}`}>
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-black leading-tight">{label}</span>
          <span className={`block text-[9px] font-semibold mt-0.5 ${listo ? 'text-emerald-600' : 'text-slate-400'}`}>{cargando ? 'Guardando...' : listo ? 'Fotografía cargada' : 'Añadir fotografía'}</span>
        </span>
        {listo && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
      </button>
    );
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 sm:mr-1">Fotografías embalaje</span>
        <div className="flex items-center gap-2 flex-wrap">
          <TarjetaFoto tipo="light" label="Embalaje Light" />
          <TarjetaFoto tipo="dark" label="Embalaje Dark" />
        </div>
      </div>

      <input ref={refs.lightCam} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; cargar('light', f); }} />
      <input ref={refs.lightFile} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; cargar('light', f); }} />
      <input ref={refs.darkCam} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; cargar('dark', f); }} />
      <input ref={refs.darkFile} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; cargar('dark', f); }} />

      {confirmarTipo && (
        <div className="fixed inset-0 z-[130] bg-slate-950/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-3" onClick={() => setConfirmarTipo(null)}>
          <div className="bg-white w-full sm:w-[380px] rounded-2xl shadow-2xl border border-slate-200 p-5" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3"><AlertTriangle className="w-5 h-5" /></div>
            <h3 className="text-base font-black text-slate-900">Modificar fotografía</h3>
            <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">Ya existe una fotografía de Embalaje {confirmarTipo === 'light' ? 'Light' : 'Dark'}. ¿Deseas reemplazarla por una nueva imagen?</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={() => setConfirmarTipo(null)} className="h-10 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">Mantener actual</button>
              <button type="button" onClick={() => { const tipo = confirmarTipo; setConfirmarTipo(null); setSelectorTipo(tipo); }} className="h-10 rounded-xl bg-[#E96008] text-white text-xs font-bold hover:bg-[#c74c04]">Sí, modificar</button>
            </div>
          </div>
        </div>
      )}

      {selectorTipo && (
        <div className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-3" onClick={() => setSelectorTipo(null)}>
          <div className="bg-white w-full sm:w-[360px] rounded-2xl shadow-2xl border border-slate-200 p-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fotografía de proceso</p>
                <h3 className="text-base font-black text-slate-800">Embalaje {selectorTipo === 'light' ? 'Light' : 'Dark'}</h3>
              </div>
              <button type="button" onClick={() => setSelectorTipo(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => abrirEntrada(selectorTipo, 'camara')} className="h-20 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-700 font-bold text-xs">
                <Camera className="w-6 h-6 text-[#ea580c]" />Tomar fotografía
              </button>
              <button type="button" onClick={() => abrirEntrada(selectorTipo, 'archivo')} className="h-20 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-700 font-bold text-xs">
                <ImageIcon className="w-6 h-6 text-[#2563eb]" />Seleccionar imagen
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center">En móvil, “Tomar fotografía” abre la cámara del dispositivo.</p>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, CheckCircle2, Image as ImageIcon, Loader2, Plus, X
} from 'lucide-react';
import { API_URL } from '../../config/api.js';

// El backend recibe la imagen como Data URL y limita su longitud a 8 MiB.
// Se conserva la calidad inicial de 0.92 y se reduce solo si resulta necesario.
const MAX_DATA_URL = 8 * 1024 * 1024;

const comprimirImagen = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('No se pudo leer la fotograf\u00eda. Intenta seleccionarla nuevamente.'));
  reader.onload = () => {
    const original = reader.result;
    if (typeof original !== 'string' || !original.startsWith('data:image/')) {
      reject(new Error('Selecciona un archivo de imagen compatible.'));
      return;
    }

    const img = new Image();
    img.onerror = () => {
      // Algunas fotos ya vienen comprimidas y no requieren usar canvas.
      if (original.length <= MAX_DATA_URL && /^data:image\/(jpeg|jpg|png|webp);/i.test(original)) {
        resolve(original);
      } else {
        reject(new Error('No se pudo procesar esta imagen. Intenta con JPEG, PNG o toma una nueva fotograf\u00eda.'));
      }
    };
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo inicializar el procesamiento de im\u00e1genes.');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Primero se intenta la resolucion y calidad usadas en la version original.
        for (const maximo of [2400, 2000, 1600, 1280]) {
          const escala = Math.min(1, maximo / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * escala));
          canvas.height = Math.max(1, Math.round(img.height * escala));
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          for (const calidad of [0.92, 0.82, 0.72, 0.62]) {
            const resultado = canvas.toDataURL('image/jpeg', calidad);
            if (resultado.startsWith('data:image/') && resultado.length <= MAX_DATA_URL) {
              resolve(resultado);
              return;
            }
          }
        }
        reject(new Error('La fotograf\u00eda es demasiado grande incluso despu\u00e9s de comprimirla.'));
      } catch (error) {
        reject(error);
      }
    };
    img.src = original;
  };
  reader.readAsDataURL(file);
});

// IMPORTANTE: este componente permanece FUERA de FotografiasProceso.
// Antes se declaraba dentro y React desmontaba/remontaba cada boton ante
// cada actualizacion del padre (la inspeccion consulta al servidor cada 1,2 s).
const TarjetaFoto = React.memo(function TarjetaFoto({ tipo, label, listo, cargando, bloqueado, onSeleccionar }) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(tipo, listo)}
      disabled={bloqueado}
      aria-label={`${listo ? 'Modificar' : 'A\u00f1adir'} fotograf\u00eda de ${label}`}
      className={`group min-w-[145px] h-12 px-3 rounded-xl border flex items-center gap-2.5 text-left transition-all shadow-sm active:scale-[0.98] touch-manipulation ${listo ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${listo ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'}`}>
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : listo ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black leading-tight">{label}</span>
        <span className={`block text-[9px] font-semibold mt-0.5 ${listo ? 'text-emerald-600' : 'text-slate-400'}`}>
          {cargando ? 'Guardando...' : listo ? 'Fotograf\u00eda cargada' : 'A\u00f1adir fotograf\u00eda'}
        </span>
      </span>
      {listo && !cargando && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
    </button>
  );
});

export default function FotografiasProceso({
  apiUrl = API_URL,
  procesoId,
  lightOk = false,
  darkOk = false,
  disabled = false,
  onEstadoChange,
  onLocalPhoto
}) {
  const [estado, setEstado] = useState({ light: Boolean(lightOk), dark: Boolean(darkOk) });
  const [subiendo, setSubiendo] = useState(null);
  const [selectorTipo, setSelectorTipo] = useState(null);
  const [confirmarTipo, setConfirmarTipo] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const subidaEnCursoRef = useRef(false);
  const procesoAnteriorRef = useRef(procesoId);

  // Evita renders adicionales y evita borrar la confirmacion de una foto
  // que acaba de ser guardada mientras llegan actualizaciones del servidor.
  useEffect(() => {
    if (procesoAnteriorRef.current !== procesoId) {
      procesoAnteriorRef.current = procesoId;
      setEstado({ light: Boolean(lightOk), dark: Boolean(darkOk) });
      setMensaje(null);
      setSelectorTipo(null);
      setConfirmarTipo(null);
      return;
    }
    setEstado(actual => {
      const light = Boolean(lightOk);
      const dark = Boolean(darkOk);
      return actual.light === light && actual.dark === dark ? actual : { light, dark };
    });
  }, [lightOk, darkOk, procesoId]);

  useEffect(() => {
    if (!mensaje || mensaje.tipo === 'error') return undefined;
    const timer = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(timer);
  }, [mensaje]);

  const seleccionarFoto = useCallback((tipo, listo) => {
    if (listo) setConfirmarTipo(tipo);
    else setSelectorTipo(tipo);
    setMensaje(null);
  }, []);

  const cargar = async (tipo, file) => {
    if (!file || disabled || subidaEnCursoRef.current) return;
    subidaEnCursoRef.current = true;
    setSelectorTipo(null);
    setConfirmarTipo(null);
    setSubiendo(tipo);
    setMensaje(null);
    try {
      const imagen = await comprimirImagen(file);
      if (!imagen?.startsWith('data:image/') || imagen.length > MAX_DATA_URL) {
        throw new Error('La fotograf\u00eda es demasiado grande o no tiene un formato compatible.');
      }
      let nuevo;
      if (procesoId) {
        const res = await fetch(`${apiUrl}/api/procesos/colaborativo/${procesoId}/fotografias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, imagen })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success !== true) {
          throw new Error(data.error || `No se pudo guardar la fotograf\u00eda (HTTP ${res.status}).`);
        }
        nuevo = { light: Boolean(data.fotoLight), dark: Boolean(data.fotoDark) };
        if (!nuevo[tipo]) {
          throw new Error('El servidor no confirm\u00f3 el guardado de la fotograf\u00eda.');
        }
      } else {
        if (onLocalPhoto) await onLocalPhoto(tipo, imagen);
        nuevo = { ...estado, [tipo]: true };
      }
      setEstado(nuevo);
      onEstadoChange?.(nuevo);
      setMensaje({ tipo: 'exito', texto: `Fotograf\u00eda ${tipo === 'light' ? 'Light' : 'Dark'} guardada correctamente.` });
    } catch (error) {
      console.error('Error al cargar fotograf\u00eda:', error);
      setMensaje({ tipo: 'error', texto: error?.message || 'No se pudo guardar la fotograf\u00eda. Intenta nuevamente.' });
    } finally {
      subidaEnCursoRef.current = false;
      setSubiendo(null);
    }
  };

  const onElegirArchivo = (event, tipo) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir exactamente la misma fotografia.
    event.target.value = '';
    if (file) cargar(tipo, file);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 sm:mr-1">Fotograf&iacute;as embalaje</span>
        <div className="flex items-center gap-2 flex-wrap">
          <TarjetaFoto tipo="light" label="Embalaje Light" listo={estado.light} cargando={subiendo === 'light'} bloqueado={disabled || Boolean(subiendo)} onSeleccionar={seleccionarFoto} />
          <TarjetaFoto tipo="dark" label="Embalaje Dark" listo={estado.dark} cargando={subiendo === 'dark'} bloqueado={disabled || Boolean(subiendo)} onSeleccionar={seleccionarFoto} />
        </div>
      </div>

      {mensaje && (
        <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`mt-2 text-[11px] font-semibold px-3 py-2 rounded-xl border ${mensaje.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {mensaje.texto}
        </div>
      )}

      {confirmarTipo && !disabled && (
        <div className="fixed inset-0 z-[130] bg-slate-950/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-3" onClick={() => setConfirmarTipo(null)}>
          <div className="bg-white w-full sm:w-[380px] rounded-2xl shadow-2xl border border-slate-200 p-5" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3"><AlertTriangle className="w-5 h-5" /></div>
            <h3 className="text-base font-black text-slate-900">Modificar fotograf&iacute;a</h3>
            <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
              Ya existe una fotograf&iacute;a de Embalaje {confirmarTipo === 'light' ? 'Light' : 'Dark'}. &iquest;Deseas reemplazarla por una nueva imagen?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={() => setConfirmarTipo(null)} className="h-10 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">Mantener actual</button>
              <button type="button" onClick={() => { const tipo = confirmarTipo; setConfirmarTipo(null); setSelectorTipo(tipo); }} className="h-10 rounded-xl bg-[#E96008] text-white text-xs font-bold hover:bg-[#c74c04]">S&iacute;, modificar</button>
            </div>
          </div>
        </div>
      )}

      {selectorTipo && !disabled && (
        <div className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-3" onClick={() => setSelectorTipo(null)}>
          <div className="bg-white w-full sm:w-[360px] rounded-2xl shadow-2xl border border-slate-200 p-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fotograf&iacute;a de proceso</p>
                <h3 className="text-base font-black text-slate-800">Embalaje {selectorTipo === 'light' ? 'Light' : 'Dark'}</h3>
              </div>
              <button type="button" onClick={() => setSelectorTipo(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* La pulsacion va DIRECTAMENTE al input nativo, no a ref.click().
                  Es mas confiable para camaras y galerias en iOS y Android. */}
              <label className="relative h-20 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-700 font-bold text-xs cursor-pointer active:scale-[0.98] touch-manipulation overflow-hidden">
                <Camera className="w-6 h-6 text-[#ea580c]" />Tomar fotograf&iacute;a
                <input type="file" accept="image/*" capture="environment" aria-label="Tomar foto con la camara" disabled={Boolean(subiendo)} onChange={e => onElegirArchivo(e, selectorTipo)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
              <label className="relative h-20 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-700 font-bold text-xs cursor-pointer active:scale-[0.98] touch-manipulation overflow-hidden">
                <ImageIcon className="w-6 h-6 text-[#2563eb]" />Seleccionar imagen
                <input type="file" accept="image/*" aria-label="Seleccionar imagen desde el dispositivo" disabled={Boolean(subiendo)} onChange={e => onElegirArchivo(e, selectorTipo)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center">En m&oacute;vil, &ldquo;Tomar fotograf&iacute;a&rdquo; abre la c&aacute;mara del dispositivo.</p>
          </div>
        </div>
      )}
    </>
  );
}

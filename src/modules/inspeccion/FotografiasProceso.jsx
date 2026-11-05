import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Camera, CheckCircle2, Image as ImageIcon, Loader2,
  Minus, Plus, RotateCcw, Save, X, ZoomIn
} from 'lucide-react';
import { API_URL } from '../../config/api.js';

// El recorte del editor tiene la misma relación de aspecto que el marco del
// informe de EVAP (5:6). En lugar de guardar las coordenadas del recorte,
// se guarda la fotografía YA ENCUADRADA: no requiere cambios en PostgreSQL.
const VISTA_ANCHO = 500;
const VISTA_ALTO = 600;
const MAX_DATA_URL = 520 * 1024; // Incluye el base64 (evita el HTTP 413 del proxy móvil).
const MAX_ARCHIVO = 60 * 1024 * 1024;
const ZOOM_MIN = 1; // 100% = cover, evita margenes vacios.
const ZOOM_INICIAL = 1.12; // Permite alejar desde 112% hasta el encuadre completo.
const ZOOM_MAX = 2.6;
const LONGITUD_NORMALIZADA = 1650;
const ES_IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

function limitarPosicion(imagen, zoom, posicion) {
  const ancho = imagen.naturalWidth || imagen.width;
  const alto = imagen.naturalHeight || imagen.height;
  const escala = Math.max(VISTA_ANCHO / ancho, VISTA_ALTO / alto) * zoom;
  const maxX = Math.max(0, (ancho * escala - VISTA_ANCHO) / 2);
  const maxY = Math.max(0, (alto * escala - VISTA_ALTO) / 2);
  return {
    x: limitar(posicion.x, -maxX, maxX),
    y: limitar(posicion.y, -maxY, maxY)
  };
}

// Es el ÚNICO algoritmo para vista previa y para archivo final.
// La posición se almacena en unidades de la vista lógica de 500x600.
function dibujarRecorte(ctx, imagen, zoom, posicion, anchoSalida, altoSalida) {
  const anchoFoto = imagen.naturalWidth || imagen.width;
  const altoFoto = imagen.naturalHeight || imagen.height;
  const escala = Math.max(anchoSalida / anchoFoto, altoSalida / altoFoto) * zoom;
  const posicionLimitada = limitarPosicion(imagen, zoom, posicion);
  const trasladoX = posicionLimitada.x * (anchoSalida / VISTA_ANCHO);
  const trasladoY = posicionLimitada.y * (altoSalida / VISTA_ALTO);
  const nuevoAncho = anchoFoto * escala;
  const nuevoAlto = altoFoto * escala;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, anchoSalida, altoSalida);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    imagen,
    (anchoSalida - nuevoAncho) / 2 + trasladoX,
    (altoSalida - nuevoAlto) / 2 + trasladoY,
    nuevoAncho,
    nuevoAlto
  );
}

function exportarRecorte(imagen, zoom, posicion) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('No se pudo preparar la fotografía en este dispositivo.');

  const anchos = [1050, 950, 850, 750, 650, 550, 450];
  const calidades = [0.86, 0.78, 0.70, 0.60, 0.50, 0.40];
  for (const ancho of anchos) {
    canvas.width = ancho;
    canvas.height = Math.round(ancho * VISTA_ALTO / VISTA_ANCHO);
    dibujarRecorte(ctx, imagen, zoom, posicion, canvas.width, canvas.height);
    if (salidaVisiblementeNegra(ctx, canvas.width, canvas.height)) {
      throw new Error('La imagen se exportaria en negro. Elige otra fotografia o utiliza el selector de Fotos.');
    }
    for (const calidad of calidades) {
      const resultado = canvas.toDataURL('image/jpeg', calidad);
      if (resultado.startsWith('data:image/jpeg;base64,') && resultado.length <= MAX_DATA_URL) {
        canvas.width = 1;
        canvas.height = 1;
        return resultado;
      }
    }
  }
  throw new Error('No se pudo reducir la imagen al tamaño permitido para móviles.');
}

function distanciaEntrePuntos(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// La camara del iPhone puede producir imagenes de decenas de megapixeles o HEIC.
// No se envia un dataURL gigante a React ni se usa el archivo original en
// cada repintado: el editor trabaja con un JPEG pequeno y normalizado.
function cargarImagenPorUrl(url) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => {
      if (!imagen.naturalWidth || !imagen.naturalHeight) {
        reject(new Error('El navegador no pudo decodificar la fotografia.'));
      } else {
        resolve(imagen);
      }
    };
    imagen.onerror = () => reject(new Error('No se pudo abrir la foto. Prueba seleccionarla desde Fotos o utiliza el formato JPEG de la camara.'));
    imagen.src = url;
  });
}

function crearBlobJpeg(canvas, calidad) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('No se pudo convertir la imagen a JPEG.')), 'image/jpeg', calidad);
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', calidad);
      const binario = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    } catch (error) { reject(error); }
  });
}

// Detectar un render realmente negro antes de ofrecer guardar una foto defectuosa.
function salidaVisiblementeNegra(ctx, ancho, alto) {
  try {
    // Evitar leer miles de pixeles: basta una cuadricula central.
    const muestras = 10;
    let negras = 0;
    let total = 0;
    for (let y = 0; y < muestras; y++) {
      for (let x = 0; x < muestras; x++) {
        const px = Math.min(ancho - 1, Math.round((x + 0.5) * ancho / muestras));
        const py = Math.min(alto - 1, Math.round((y + 0.5) * alto / muestras));
        const rgba = ctx.getImageData(px, py, 1, 1).data;
        if (rgba[0] < 6 && rgba[1] < 6 && rgba[2] < 6) negras++;
        total++;
      }
    }
    return negras >= total * 0.99;
  } catch (_) {
    // No bloquear si Safari impide inspeccionar el canvas.
    return false;
  }
}

async function normalizarImagenParaMovil(archivo) {
  const urlOriginal = URL.createObjectURL(archivo);
  let bitmap = null;
  let urlNormalizada = null;
  try {
    let fotoOriginal = null;
    try {
      fotoOriginal = await cargarImagenPorUrl(urlOriginal);
    } catch (error) {
      // Algunos navegadores pueden decodificar HEIC mediante createImageBitmap
      // aunque el elemento IMG no lo soporte.
      if (typeof createImageBitmap !== 'function') throw error;
      try { bitmap = await createImageBitmap(archivo); } catch (_) { throw error; }
    }
    const anchoOriginal = fotoOriginal?.naturalWidth || bitmap?.width;
    const altoOriginal = fotoOriginal?.naturalHeight || bitmap?.height;
    if (!anchoOriginal || !altoOriginal) throw new Error('La foto no tiene dimensiones validas.');
    const escala = Math.min(1, LONGITUD_NORMALIZADA / Math.max(anchoOriginal, altoOriginal));
    const ancho = Math.max(1, Math.round(anchoOriginal * escala));
    const alto = Math.max(1, Math.round(altoOriginal * escala));

    // En navegadores que implementan decodificacion reducida, se limita el
    // trabajo de memoria ANTES de pasarlo al canvas, clave en fotos de 48 MP.
    if (!bitmap && escala < 1 && typeof createImageBitmap === 'function') {
      try {
        const reducido = await createImageBitmap(archivo, {
          resizeWidth: ancho,
          resizeHeight: alto,
          resizeQuality: 'high',
          imageOrientation: 'from-image'
        });
        // Algunos navegadores ignoran los parametros resize. Aun asi se puede
        // usar la imagen HTML ya decodificada como alternativa.
        if (reducido.width <= ancho * 1.1 && reducido.height <= alto * 1.1) {
          bitmap = reducido;
        } else {
          reducido.close?.();
        }
      } catch (_) { /* Alternativa compatible: IMG + drawImage. */ }
    }

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No se pudo iniciar el procesador de imagenes del telefono.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const fuente = bitmap || fotoOriginal;
    ctx.drawImage(fuente, 0, 0, ancho, alto);
    if (salidaVisiblementeNegra(ctx, ancho, alto) && bitmap && fotoOriginal) {
      // Segundo intento: decodificacion HTML, por si la ruta ImageBitmap
      // devolvio fotogramas negros en un WebKit particular.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ancho, alto);
      ctx.drawImage(fotoOriginal, 0, 0, ancho, alto);
    }
    if (salidaVisiblementeNegra(ctx, ancho, alto)) {
      throw new Error('La fotografia se proceso en negro. Toma otra foto desde el selector del iPhone o elige una de Fotos.');
    }
    const jpeg = await crearBlobJpeg(canvas, 0.88);
    // Liberar buffers grandes antes de abrir el editor.
    canvas.width = 1;
    canvas.height = 1;
    urlNormalizada = URL.createObjectURL(jpeg);
    const imagen = await cargarImagenPorUrl(urlNormalizada);
    const resultado = { imagen, url: urlNormalizada };
    urlNormalizada = null; // La url pertenece ahora al editor.
    return resultado;
  } finally {
    bitmap?.close?.();
    URL.revokeObjectURL(urlOriginal);
    if (urlNormalizada) URL.revokeObjectURL(urlNormalizada);
  }
}

// Separado del módulo principal: no se desmonta ni pierde el gesto cuando
// InspeccionModule sincroniza usuarios/cajas en segundo plano.
// Modal fuera de los contenedores del dashboard: evita el recorte y los
// problemas de superposicion / composicion de Safari en iPhone.
function EditorEncuadre({ tipo, imagen, imagenUrl, guardando, error, onGuardar, onCancelar, onOtraFoto }) {
  const puntosRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [zoom, setZoom] = useState(ZOOM_INICIAL);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);

  const modificarZoom = nuevo => {
    const valor = limitar(Number(nuevo) || 1, ZOOM_MIN, ZOOM_MAX);
    setZoom(valor);
    setPosicion(actual => limitarPosicion(imagen, valor, actual));
  };

  const empezarGesto = evento => {
    if (guardando) return;
    evento.preventDefault();
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    puntosRef.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    setArrastrando(true);
    if (puntosRef.current.size === 2) {
      const [a, b] = Array.from(puntosRef.current.values());
      pinchRef.current = { distancia: distanciaEntrePuntos(a, b), zoomInicial: zoom };
    }
  };
  const moverGesto = evento => {
    const puntos = puntosRef.current;
    if (!puntos.has(evento.pointerId) || guardando) return;
    evento.preventDefault();
    const anterior = puntos.get(evento.pointerId);
    puntos.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    if (puntos.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(puntos.values());
      modificarZoom(pinchRef.current.zoomInicial * distanciaEntrePuntos(a, b) / Math.max(pinchRef.current.distancia, 1));
      return;
    }
    if (puntos.size !== 1) return;
    const rect = evento.currentTarget.getBoundingClientRect();
    const dx = (evento.clientX - anterior.x) * VISTA_ANCHO / Math.max(rect.width, 1);
    const dy = (evento.clientY - anterior.y) * VISTA_ALTO / Math.max(rect.height, 1);
    setPosicion(actual => limitarPosicion(imagen, zoom, { x: actual.x + dx, y: actual.y + dy }));
  };
  const terminarGesto = evento => {
    puntosRef.current.delete(evento.pointerId);
    if (puntosRef.current.size < 2) pinchRef.current = null;
    if (!puntosRef.current.size) setArrastrando(false);
  };
  const restaurar = () => {
    setZoom(ZOOM_INICIAL);
    setPosicion({ x: 0, y: 0 });
  };

  // La vista usa IMG y CSS (no canvas) para evitar la pantalla negra en Safari.
  // Solo usamos canvas al confirmar, sobre el JPEG previamente normalizado.
  const anchoFoto = imagen.naturalWidth || imagen.width;
  const altoFoto = imagen.naturalHeight || imagen.height;
  const escala = Math.max(VISTA_ANCHO / anchoFoto, VISTA_ALTO / altoFoto) * zoom;
  const anchoPct = anchoFoto * escala * 100 / VISTA_ANCHO;
  const altoPct = altoFoto * escala * 100 / VISTA_ALTO;
  const desplazamiento = limitarPosicion(imagen, zoom, posicion);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Ajustar encuadre de fotografia" style={{ isolation: 'isolate' }}>
      <div className="flex w-full max-w-[415px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: 'calc(100dvh - 16px)' }}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-orange-600">Encuadre para informe</p>
            <h3 className="text-[15px] font-black text-slate-900">Embalaje {tipo === 'light' ? 'Light' : 'Dark'}</h3>
          </div>
          <button type="button" onClick={onCancelar} disabled={guardando} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50" aria-label="Cerrar editor"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div className="mx-auto w-full max-w-[250px] overflow-hidden rounded-xl border-[3px] border-white bg-slate-100 shadow-md" style={{ boxShadow: '0 3px 18px rgba(15,23,42,0.16)' }}>
            <div
              className={`relative aspect-[5/6] w-full select-none overflow-hidden touch-none ${arrastrando ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ touchAction: 'none' }}
              onPointerDown={empezarGesto}
              onPointerMove={moverGesto}
              onPointerUp={terminarGesto}
              onPointerCancel={terminarGesto}
              onLostPointerCapture={terminarGesto}
              aria-label="Arrastra la imagen para centrar la caja de cerezas"
            >
              <img
                src={imagenUrl}
                alt="Vista previa del encuadre"
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: `${anchoPct}%`, height: `${altoPct}%`,
                  left: `${50 + desplazamiento.x * 100 / VISTA_ANCHO}%`,
                  top: `${50 + desplazamiento.y * 100 / VISTA_ALTO}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
              <div className="pointer-events-none absolute inset-1 rounded-lg border border-dashed border-white/55" />
            </div>
          </div>
          <p className="text-center text-[11px] font-medium text-slate-500">Arrastra para mover · Pellizca para ampliar · Marco 5:6</p>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={`zoom-${tipo}`} className="flex items-center gap-2 text-xs font-bold text-slate-700"><ZoomIn className="h-4 w-4 text-orange-600" /> Zoom</label>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black tabular-nums text-slate-700">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => modificarZoom(zoom - 0.05)} disabled={guardando || zoom <= ZOOM_MIN} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-35" aria-label="Reducir zoom"><Minus className="h-4 w-4" /></button>
              <input id={`zoom-${tipo}`} type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.01" value={zoom} onChange={e => modificarZoom(e.target.value)} disabled={guardando} className="min-w-0 flex-1 accent-orange-600" aria-label="Nivel de zoom" />
              <button type="button" onClick={() => modificarZoom(zoom + 0.05)} disabled={guardando || zoom >= ZOOM_MAX} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-35" aria-label="Aumentar zoom"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={restaurar} disabled={guardando} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Restablecer</button>
              <button type="button" onClick={onOtraFoto} disabled={guardando} className="h-9 flex-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 disabled:opacity-40">Elegir otra</button>
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-700">{error}</p>}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-3 py-2.5" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => onGuardar(zoom, posicion)} disabled={guardando} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ea580c] text-[13px] font-bold text-white shadow-sm disabled:opacity-60">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {guardando ? 'Guardando fotografía...' : 'Guardar fotografía encuadrada'}
          </button>
        </footer>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

// Fuera del componente: evita que los botones se desmonten durante cada
// actualización automática de la inspección colaborativa.
// "compacto" solo modifica la apariencia de los botones en móvil.
const TarjetaFoto = React.memo(function TarjetaFoto({ tipo, etiqueta, guardada, cargando, deshabilitada, onElegir, compacto = false }) {
  return (
    <button
      type="button"
      onClick={() => onElegir(tipo, guardada)}
      disabled={deshabilitada}
      aria-label={`${guardada ? 'Reemplazar' : 'Añadir'} fotografía de ${etiqueta}`}
      className={`group flex touch-manipulation items-center border shadow-sm transition-all active:scale-[0.98] ${
        compacto
          ? 'h-[74px] w-full min-w-0 flex-col justify-center gap-0.5 rounded-2xl px-1.5 py-1.5 text-center md:h-12 md:w-auto md:min-w-[145px] md:flex-row md:gap-2.5 md:rounded-xl md:px-3 md:text-left'
          : 'h-12 min-w-[145px] gap-2.5 rounded-xl px-3 text-left'
      } ${
        guardada
          ? (compacto
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50 md:bg-emerald-50 md:hover:bg-emerald-100'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')
          : (compacto
              ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 md:border-slate-300 md:bg-slate-50 md:hover:bg-slate-100'
              : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100')
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${guardada ? (compacto ? 'bg-emerald-500 text-white md:bg-emerald-600' : 'bg-emerald-600 text-white') : (compacto ? 'bg-slate-100 text-slate-500 md:bg-slate-200 md:text-slate-600' : 'bg-slate-200 text-slate-600')}`}>
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : guardada ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </span>
      <span className={`min-w-0 ${compacto ? 'md:flex-1' : 'flex-1'}`}>
        <span className="block text-[11px] font-black leading-tight">{etiqueta}</span>
        <span className={`mt-0.5 block text-[9px] font-semibold leading-tight ${guardada ? 'text-emerald-600' : 'text-slate-400'}`}>
          {cargando ? 'Guardando...' : guardada ? 'Fotografía cargada' : 'Añadir fotografía'}
        </span>
      </span>
      {guardada && !cargando && (
        <CheckCircle2 className={`h-4 w-4 shrink-0 text-emerald-600 ${compacto ? 'hidden md:block' : ''}`} />
      )}
    </button>
  );
});
export default function FotografiasProceso({
  apiUrl = API_URL, procesoId, lightOk = false, darkOk = false,
  disabled = false, modoHistorial = false, compacto = false, onEstadoChange, onLocalPhoto, onPhotoSaved
}) {
  const [estado, setEstado] = useState({ light: Boolean(lightOk), dark: Boolean(darkOk) });
  const [subiendo, setSubiendo] = useState(null);
  const [preparando, setPreparando] = useState(false);
  const [selectorTipo, setSelectorTipo] = useState(null);
  const [confirmarTipo, setConfirmarTipo] = useState(null);
  const [editor, setEditor] = useState(null);
  const [errorEditor, setErrorEditor] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const subidaRef = useRef(false);
  const claveRef = useRef(`${modoHistorial ? 'historial' : 'inspeccion'}:${procesoId || 'local'}`);

  useEffect(() => {
    const clave = `${modoHistorial ? 'historial' : 'inspeccion'}:${procesoId || 'local'}`;
    if (claveRef.current !== clave) {
      claveRef.current = clave;
      setEstado({ light: Boolean(lightOk), dark: Boolean(darkOk) });
      setMensaje(null);
      setSelectorTipo(null);
      setConfirmarTipo(null);
      setEditor(null);
    } else {
      setEstado(anterior => {
        const siguiente = { light: Boolean(lightOk), dark: Boolean(darkOk) };
        return anterior.light === siguiente.light && anterior.dark === siguiente.dark ? anterior : siguiente;
      });
    }
  }, [lightOk, darkOk, procesoId, modoHistorial]);

  useEffect(() => {
    if (!editor?.url) return undefined;
    // Liberar la URL temporal al cerrar el editor o desmontar el componente.
    return () => URL.revokeObjectURL(editor.url);
  }, [editor?.url]);

  useEffect(() => {
    if (!mensaje || mensaje.tipo === 'error') return undefined;
    const timeout = setTimeout(() => setMensaje(null), 4200);
    return () => clearTimeout(timeout);
  }, [mensaje]);

  const seleccionar = useCallback((tipo, guardada) => {
    setMensaje(null);
    if (guardada) setConfirmarTipo(tipo);
    else setSelectorTipo(tipo);
  }, []);

  const elegirArchivo = async (evento, tipo) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = ''; // Permite tomar de nuevo una foto con el mismo nombre.
    if (!archivo || !tipo || preparando || subidaRef.current) return;
    if (archivo.size > MAX_ARCHIVO) {
      setMensaje({ tipo: 'error', texto: 'La fotografia original excede 60 MB.' });
      return;
    }
    const extensionImagen = /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(archivo.name || '');
    if (!archivo.type.startsWith('image/') && !extensionImagen) {
      setMensaje({ tipo: 'error', texto: 'Selecciona un archivo de imagen compatible.' });
      return;
    }
    setPreparando(true);
    setMensaje(null);
    try {
      const { imagen, url } = await normalizarImagenParaMovil(archivo);
      setSelectorTipo(null);
      setErrorEditor('');
      setEditor({ tipo, imagen, url });
    } catch (error) {
      console.error('No se pudo preparar la fotografía de la cámara:', error);
      setMensaje({ tipo: 'error', texto: error?.message || 'La cámara produjo una imagen no compatible. Prueba con la galería.' });
    } finally {
      setPreparando(false);
    }
  };

  const guardarEncuadre = async (zoom, posicion) => {
    if (!editor || subidaRef.current || disabled) return;
    subidaRef.current = true;
    setSubiendo(editor.tipo);
    setErrorEditor('');
    const tipo = editor.tipo;
    try {
      // Exportamos exactamente el recorte visualizado, con compresión móvil.
      const imagen = exportarRecorte(editor.imagen, zoom, posicion);
      let nuevoEstado;
      if (procesoId) {
        const ruta = modoHistorial
          ? `${apiUrl}/api/procesos/${procesoId}/fotografias`
          : `${apiUrl}/api/procesos/colaborativo/${procesoId}/fotografias`;
        const headers = { 'Content-Type': 'application/json' };
        if (modoHistorial) {
          try {
            const sesion = JSON.parse(localStorage.getItem('qc_user_session') || 'null');
            if (/^[A-Za-z0-9_-]{43}$/.test(String(sesion?.tokenTemperaturas || ''))) {
              headers.Authorization = `Bearer ${sesion.tokenTemperaturas}`;
            }
          } catch (_) { /* El backend puede autenticar mediante cookie HTTP-only. */ }
        }
        const respuesta = await fetch(ruta, {
          method: modoHistorial ? 'PATCH' : 'POST',
          credentials: modoHistorial && !headers.Authorization ? 'include' : 'same-origin',
          headers,
          body: JSON.stringify({ tipo, imagen })
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || datos.success !== true) {
          if (respuesta.status === 413) throw new Error('El proxy rechazó la fotografía (HTTP 413). Es necesario revisar el límite de subida del servidor.');
          if (respuesta.status === 401) throw new Error('La sesión expiró. Vuelve a ingresar a EVAP antes de modificar las fotografías.');
          if (respuesta.status === 403) throw new Error('Tu cuenta no tiene permiso para modificar fotografías de procesos cerrados.');
          throw new Error(datos.error || `No se pudo guardar la fotografía (HTTP ${respuesta.status}).`);
        }
        nuevoEstado = { light: Boolean(datos.fotoLight), dark: Boolean(datos.fotoDark) };
        if (!nuevoEstado[tipo]) throw new Error('El servidor no confirmó el guardado de la fotografía.');
      } else {
        if (!onLocalPhoto) throw new Error('No existe un proceso donde guardar esta fotografía.');
        await onLocalPhoto(tipo, imagen);
        nuevoEstado = { ...estado, [tipo]: true };
      }
      setEstado(nuevoEstado);
      onEstadoChange?.(nuevoEstado);
      onPhotoSaved?.({ tipo, imagen, estado: nuevoEstado });
      setEditor(null);
      setMensaje({ tipo: 'exito', texto: `Fotografía ${tipo === 'light' ? 'Light' : 'Dark'} guardada con el encuadre seleccionado.` });
    } catch (error) {
      console.error('Error guardando fotografía encuadrada:', error);
      setErrorEditor(error?.message || 'No se pudo guardar la fotografía.');
    } finally {
      subidaRef.current = false;
      setSubiendo(null);
    }
  };

  return (
    <>
      <div className={compacto ? 'flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center' : 'flex flex-col gap-2 sm:flex-row sm:items-center'}>
        <span className={compacto
          ? 'block text-center text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600 md:mr-1 md:text-left md:text-[10px] md:font-black md:text-slate-400'
          : 'text-[9px] font-black uppercase tracking-wider text-slate-400 sm:mr-1 md:text-[10px]'}>
          Fotografías embalaje
        </span>
        <div className={compacto ? 'grid w-full grid-cols-2 gap-2.5 md:flex md:w-auto md:flex-wrap md:items-center md:gap-2' : 'flex flex-wrap items-center gap-2'}>
          <TarjetaFoto tipo="light" etiqueta="Embalaje Light" guardada={estado.light} cargando={subiendo === 'light'} deshabilitada={disabled || Boolean(subiendo) || preparando} onElegir={seleccionar} compacto={compacto} />
          <TarjetaFoto tipo="dark" etiqueta="Embalaje Dark" guardada={estado.dark} cargando={subiendo === 'dark'} deshabilitada={disabled || Boolean(subiendo) || preparando} onElegir={seleccionar} compacto={compacto} />
        </div>
      </div>

      {mensaje && (
        <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {mensaje.texto}
        </div>
      )}

      {confirmarTipo && !disabled && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[1px] sm:items-center" onClick={() => setConfirmarTipo(null)}>
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:w-[380px]" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></div>
            <h3 className="text-base font-black text-slate-900">Modificar fotografía</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">Ya existe una fotografía de Embalaje {confirmarTipo === 'light' ? 'Light' : 'Dark'}. ¿Deseas reemplazarla? Podrás encuadrarla antes de guardar.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmarTipo(null)} className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50">Mantener actual</button>
              <button type="button" onClick={() => { const tipo = confirmarTipo; setConfirmarTipo(null); setSelectorTipo(tipo); }} className="h-10 rounded-xl bg-[#ea580c] text-xs font-bold text-white hover:bg-[#c2410c]">Sí, modificar</button>
            </div>
          </div>
        </div>
      )}

      {selectorTipo && !disabled && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-[1px] sm:items-center" onClick={() => { if (!preparando) setSelectorTipo(null); }}>
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:w-[360px]" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fotografía de proceso</p><h3 className="text-base font-black text-slate-800">Embalaje {selectorTipo === 'light' ? 'Light' : 'Dark'}</h3></div>
              <button type="button" onClick={() => setSelectorTipo(null)} disabled={preparando} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-40" aria-label="Cerrar"><X className="h-4 w-4" /></button>
            </div>
            {preparando ? (
              <div className="flex h-20 items-center justify-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-orange-600" /> Abriendo fotografía...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="relative flex h-20 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 active:scale-[0.98]">
                  <Camera className="h-6 w-6 text-[#ea580c]" />Tomar fotografía
                  <input type="file" accept="image/*" {...(!ES_IOS ? { capture: 'environment' } : {})} aria-label="Tomar fotografía" onChange={e => elegirArchivo(e, selectorTipo)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                <label className="relative flex h-20 cursor-pointer touch-manipulation flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 active:scale-[0.98]">
                  <ImageIcon className="h-6 w-6 text-[#2563eb]" />Seleccionar imagen
                  <input type="file" accept="image/*,.heic,.heif" aria-label="Seleccionar imagen de galería" onChange={e => elegirArchivo(e, selectorTipo)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
            )}
            {mensaje?.tipo === 'error' && (
              <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-700">{mensaje.texto}</p>
            )}
            <p className="mt-3 text-center text-[10px] text-slate-400">{ES_IOS ? 'En iPhone, elige Tomar foto desde el selector nativo para evitar pantallas negras.' : 'Podrás mover y ampliar la imagen antes de guardar.'}</p>
          </div>
        </div>
      )}

      {editor && (
        <EditorEncuadre
          key={`${editor.tipo}-${editor.url}`}
          tipo={editor.tipo}
          imagen={editor.imagen}
          imagenUrl={editor.url}
          guardando={Boolean(subiendo)}
          error={errorEditor}
          onGuardar={guardarEncuadre}
          onCancelar={() => { if (!subiendo) setEditor(null); }}
          onOtraFoto={() => { if (!subiendo) { const tipo = editor.tipo; setEditor(null); setSelectorTipo(tipo); } }}
        />
      )}
    </>
  );
}

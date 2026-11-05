import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Play, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../config/api.js';

const fechaChile = () => new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).replaceAll('/', '-');
const fechaIsoChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fechaProceso = valor => {
  if (!valor) return fechaChile();
  const s = String(valor).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}-${m}-${y}`; }
  return fechaChile();
};
const claveClienteProceso = numProceso => `evap_collab_client_${numProceso}`;
const obtenerClienteProceso = numProceso => {
  const key = claveClienteProceso(numProceso);
  let id = localStorage.getItem(key);
  if (!id) { id = `collab-${numProceso}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; localStorage.setItem(key, id); }
  return id;
};
const cajaPreferidaBorrador = procesoId => {
  if (!procesoId) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(`draft_inspeccion_colab_${procesoId}`) || 'null');
    const num = Number(draft?.cajaActual?.numCaja);
    return Number.isInteger(num) && num > 0 ? num : null;
  } catch (_) { return null; }
};

export default function NuevoProceso({ usuarioActual, exportadoras = [], productores = [], variedades = [], procesosExistentes = [], onIniciarInspeccion, onAbrirMenu }) {
  const [fecha] = useState(fechaChile());
  const [verificando, setVerificando] = useState(true);
  const [procesoEnCurso, setProcesoEnCurso] = useState(null);
  const [procesosServidor, setProcesosServidor] = useState([]);
  const [numProceso, setNumProceso] = useState('');
  const [mensajeNum, setMensajeNum] = useState('');
  const [esErrorNum, setEsErrorNum] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [exportadoraSel, setExportadoraSel] = useState('');
  const [csgSel, setCsgSel] = useState('');
  const [variedadSel, setVariedadSel] = useState('');
  const [productorNombre, setProductorNombre] = useState('');
  const [huertoNombre, setHuertoNombre] = useState('');
  const [csgFiltrados, setCsgFiltrados] = useState([]);
  const hideSpinners = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
  const cajasGuardadasProceso = Number(procesoEnCurso?.cajasGuardadas ?? (Array.isArray(procesoEnCurso?.cajas) ? procesoEnCurso.cajas.length : 0));
  const maxUsuariosProceso = Number(procesoEnCurso?.maxUsuarios || 3);
  const usuariosProcesoActivos = Array.isArray(procesoEnCurso?.usuariosProceso) ? procesoEnCurso.usuariosProceso : [];
  const usuariosActivosProceso = Math.max(Number(procesoEnCurso?.usuariosActivos || 0), usuariosProcesoActivos.length);
  const usuarioYaEnProceso = usuariosProcesoActivos.some(u => (usuarioActual?.id && Number(u.usuarioId) === Number(usuarioActual.id)) || (usuarioActual?.username && String(u.username || '').toLowerCase() === String(usuarioActual.username).toLowerCase()));
  const procesoLleno = Boolean(procesoEnCurso && usuariosActivosProceso >= maxUsuariosProceso && !usuarioYaEnProceso);

  const cargarEstadoProcesos = async ({ inicial = false } = {}) => {
    if (inicial) setVerificando(true);
    try {
      const [resTodos, resActivos] = await Promise.all([
        fetch(`${API_URL}/api/inspecciones`),
        fetch(`${API_URL}/api/procesos/colaborativo/activos`)
      ]);
      const todos = resTodos.ok ? await resTodos.json() : [];
      const activos = resActivos.ok ? await resActivos.json() : [];
      const listaTodos = Array.isArray(todos) ? todos : [];
      const listaActivos = Array.isArray(activos) ? activos : [];
      setProcesosServidor(listaTodos);
      if (listaActivos.length > 1) console.error('EVAP detectó más de un proceso En curso:', listaActivos);
      const activoApi = listaActivos[0] || null;
      const activoFallback = listaTodos.find(p => p.estado === 'En curso') || null;
      const activo = activoApi || activoFallback;
      if (activo) {
        const detalle = listaTodos.find(p => Number(p.id) === Number(activo.id)) || activo;
        const cajasGuardadas = Number(activo.cajasGuardadas ?? (Array.isArray(detalle.cajas) ? detalle.cajas.length : 0));
        setProcesoEnCurso({ ...detalle, ...activo, cajasGuardadas });
        setNumProceso(String(activo.numProceso ?? detalle.numProceso ?? ''));
      } else {
        setProcesoEnCurso(null);
        setNumProceso(prev => procesoEnCurso ? '' : prev);
      }
    } catch (error) {
      console.error('Error verificando procesos activos:', error);
    } finally {
      if (inicial) setVerificando(false);
    }
  };

  useEffect(() => {
    cargarEstadoProcesos({ inicial: true });
    const timer = setInterval(() => cargarEstadoProcesos(), 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (exportadoraSel && !procesoEnCurso) {
      setCsgFiltrados(productores.filter(p => p.exportadora === exportadoraSel));
      setCsgSel(''); setProductorNombre(''); setHuertoNombre('');
    } else setCsgFiltrados([]);
  }, [exportadoraSel, productores, procesoEnCurso]);

  const handleSelectCSG = codigoCsg => {
    setCsgSel(codigoCsg);
    const encontrado = csgFiltrados.find(h => String(h.csg) === String(codigoCsg));
    setProductorNombre(encontrado?.productor || '');
    setHuertoNombre(encontrado?.huerto || encontrado?.nombre || '');
  };

  const handleNumProcesoChange = e => {
    const val = e.target.value;
    setNumProceso(val);
    if (val === '') { setMensajeNum('Campo requerido'); setEsErrorNum(true); return; }
    const num = Number(val);
    const registradosServidor = procesosServidor.some(p => Number(p.numProceso) === num);
    const registradosProps = !procesosServidor.length && procesosExistentes.some(p => Number(p?.numProceso ?? p) === num);
    if (!Number.isInteger(num) || num < 1) { setMensajeNum('El número debe ser mayor a 0.'); setEsErrorNum(true); }
    else if (registradosServidor || registradosProps) { setMensajeNum(`El proceso N° ${num} ya fue registrado. Usa un número nuevo.`); setEsErrorNum(true); }
    else { setMensajeNum(''); setEsErrorNum(false); }
  };

  const calcularSiguienteCaja = data => {
    const cajasPrevias = Array.isArray(data?.cajasPrevias) ? data.cajasPrevias : [];
    const maxGuardada = cajasPrevias.reduce((max, caja) => Math.max(max, Number(caja?.numCaja) || 0), 0);
    const calculada = maxGuardada + 1;
    const visual = Number(data?.nextCajaVisual);
    const servidor = Number(data?.nextCaja);
    if (Number.isInteger(visual) && visual > 0) return visual;
    return Number.isInteger(servidor) && servidor > 0 ? servidor : calculada;
  };

  const onSubmit = async e => {
    if (e) e.preventDefault();
    const targetNum = procesoEnCurso ? Number(procesoEnCurso.numProceso) : Number(numProceso);
    if (!Number.isInteger(targetNum) || targetNum < 1 || (!procesoEnCurso && esErrorNum)) return alert('Por favor verifica el N° de Proceso.');
    if (!procesoEnCurso && (!exportadoraSel || !csgSel || !variedadSel)) return alert('Completa Exportadora, CSG y Variedad.');
    setCargando(true);
    try {
      const horaActualStr = new Date().toISOString();
      const finalExportadora = procesoEnCurso ? procesoEnCurso.exportadora : exportadoraSel;
      const finalCsg = procesoEnCurso ? procesoEnCurso.csg : csgSel;
      const finalVariedad = procesoEnCurso ? procesoEnCurso.variedad : variedadSel;
      const finalProductor = procesoEnCurso ? procesoEnCurso.productor : productorNombre;
      const finalHuerto = procesoEnCurso ? procesoEnCurso.huerto : huertoNombre;
      const clientIdColaborativo = obtenerClienteProceso(targetNum);
      const preferredCaja = procesoEnCurso?.id ? cajaPreferidaBorrador(procesoEnCurso.id) : null;
      const response = await fetch(`${API_URL}/api/procesos/colaborativo/iniciar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numProceso: targetNum, exportadora: finalExportadora, csg: finalCsg, variedad: finalVariedad, fecha: fechaIsoChile(), horaInicio: horaActualStr, clientId: clientIdColaborativo, preferredCaja, usuarioId: usuarioActual?.id || null, username: usuarioActual?.username || 'Usuario' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        await cargarEstadoProcesos();
        return alert(`❌ Error: ${data.error || 'No se pudo iniciar/unirse al proceso.'}`);
      }
      const cajasPrevias = Array.isArray(data.cajasPrevias) ? data.cajasPrevias : [];
      onIniciarInspeccion({
        numProceso: String(targetNum), exportadoraSel: finalExportadora, csgSel: finalCsg, variedadSel: finalVariedad,
        productorNombre: finalProductor, huertoNombre: finalHuerto, procesoIdBD: data.procesoId,
        nextCajaColaborativa: calcularSiguienteCaja(data), cajasPreviasColaborativas: cajasPrevias,
        clientIdColaborativo: data.clientId || clientIdColaborativo, usuarioId: usuarioActual?.id || null, username: usuarioActual?.username || 'Usuario',
        isColaborativo: true, horaInicioAsignada: procesoEnCurso?.horaInicio || horaActualStr
      });
    } catch (error) {
      console.error('Error conectando con el backend:', error);
      alert('❌ Error de conexión. No se pudo contactar al servidor.');
    } finally { setCargando(false); }
  };

  const cancelarProcesoActivo = async () => {
    if (!procesoEnCurso?.id || descartando) return;
    const cajas = Number(procesoEnCurso.cajasGuardadas || 0);
    const mensaje = cajas > 0
      ? `¿Cancelar el proceso N° ${procesoEnCurso.numProceso}? Se conservarán las ${cajas} caja${cajas === 1 ? '' : 's'} ya guardada${cajas === 1 ? '' : 's'} en el historial, el proceso quedará como Cancelado y cualquier usuario que siga inspeccionando no podrá continuar.`
      : `¿Cancelar el proceso N° ${procesoEnCurso.numProceso}? El proceso está vacío y se eliminará para permitir iniciar una nueva inspección.`;
    if (!window.confirm(mensaje)) return;
    setDescartando(true);
    try {
      const clientId = localStorage.getItem(claveClienteProceso(procesoEnCurso.numProceso)) || null;
      let response = await fetch(`${API_URL}/api/procesos/colaborativo/descartar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ procesoId: procesoEnCurso.id, clientId, forzar: true })
      });
      if (response.status === 404) response = await fetch(`${API_URL}/api/inspecciones/${procesoEnCurso.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return alert(`❌ ${data.error || 'No se pudo cancelar el proceso.'}`);
      await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
      localStorage.removeItem(claveClienteProceso(procesoEnCurso.numProceso));
      setProcesoEnCurso(null); setNumProceso(''); setMensajeNum(''); setEsErrorNum(false);
      await cargarEstadoProcesos();
    } catch (error) {
      console.error('Error cancelando proceso:', error);
      alert('❌ No se pudo contactar al servidor.');
    } finally { setDescartando(false); }
  };

  if (verificando) return <div className="h-full w-full flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E96008]" /></div>;

  if (procesoEnCurso) return (
    <div className="h-full w-full flex flex-col justify-center items-center px-6 py-6 animate-fade-in bg-slate-50 relative">
      {onAbrirMenu && <button type="button" onClick={onAbrirMenu} className="absolute left-6 md:left-10 top-8 md:top-10 w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all flex items-center justify-center z-20 hover:scale-105 active:scale-95" title="Abrir menú"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>}
      <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-blue-100 w-full max-w-2xl flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100"><Users className="w-10 h-10" strokeWidth={2.5} /></div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Unirse a la revisión</h1>
        <p className="text-slate-500 mb-8 max-w-md">Existe una inspección en curso. EVAP permite un solo proceso activo a la vez.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl w-full p-6 text-left grid grid-cols-2 gap-y-4 gap-x-6 mb-7 shadow-inner">
          <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Fecha</span><span className="text-base font-bold text-slate-800">{fechaProceso(procesoEnCurso.fecha)}</span></div>
          <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">N° Proceso</span><span className="text-xl font-black text-[#E96008]">{procesoEnCurso.numProceso}</span></div>
          <div className="col-span-2 border-t border-slate-200 my-2" />
          <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Exportadora</span><span className="text-base font-bold text-slate-800">{procesoEnCurso.exportadora}</span></div>
          <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Huerto / Prod.</span><span className="text-base font-bold text-slate-800">{procesoEnCurso.huerto || procesoEnCurso.productor}</span></div>
          <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Variedad</span><span className="text-base font-bold text-blue-600">{procesoEnCurso.variedad}</span></div>
          <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Cajas guardadas</span><span className="text-base font-black text-slate-800">{cajasGuardadasProceso}</span></div>
          <div><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Usuarios</span><span className={`text-base font-black ${procesoLleno ? 'text-red-600' : 'text-slate-800'}`}>{usuariosActivosProceso}/{maxUsuariosProceso}</span></div>
          <div className="col-span-2"><span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-2">Usuarios en el proceso</span><div className="flex flex-wrap gap-2">{usuariosProcesoActivos.length ? usuariosProcesoActivos.slice(0, maxUsuariosProceso).map((u, i) => <span key={`${u.usuarioId || u.clientId || i}-${i}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500" />{u.username || 'Usuario'}</span>) : <span className="text-xs text-slate-400 font-medium">Sin nombres disponibles.</span>}</div></div>
        </div>
        <button onClick={onSubmit} disabled={cargando || descartando || procesoLleno} className="w-full py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black rounded-xl shadow-lg shadow-blue-500/30 text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed">{cargando ? 'Conectando...' : procesoLleno ? <><Users className="w-5 h-5" /> Máximo 3 usuarios alcanzado</> : <><Play className="w-5 h-5 fill-white" /> Unirse a inspección</>}</button>
        <button type="button" onClick={cancelarProcesoActivo} disabled={cargando || descartando} className="w-full mt-3 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"><AlertTriangle className="w-4 h-4" />{descartando ? 'Cancelando proceso...' : 'Cancelar proceso'}</button>
        <p className="text-xs text-slate-400 mt-3 max-w-lg">{cajasGuardadasProceso > 0 ? `Las ${cajasGuardadasProceso} caja${cajasGuardadasProceso === 1 ? '' : 's'} guardada${cajasGuardadasProceso === 1 ? '' : 's'} se conservarán en el historial y el proceso quedará Cancelado.` : 'El proceso vacío se eliminará y podrás iniciar una nueva inspección.'}</p>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col justify-start md:justify-center items-center px-6 py-6 animate-fade-in overflow-y-auto bg-slate-50 relative">
      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-sm border border-slate-100 w-full max-w-4xl flex flex-col relative transition-all duration-500">
        {onAbrirMenu && <button type="button" onClick={onAbrirMenu} className="absolute -left-4 md:-left-5 top-8 md:top-10 w-9 h-9 md:w-10 md:h-10 bg-white border border-slate-200 text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all flex items-center justify-center z-20 hover:scale-105 active:scale-95" title="Abrir menú de navegación"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>}
        <div className="flex items-center mb-10 shrink-0 pl-2"><div className="w-1.5 h-8 bg-[#E96008] mr-4 rounded-full" /><h1 className="text-2xl md:text-3xl font-black text-[#0F172A]">Crear nueva revisión</h1></div>
        <form onSubmit={onSubmit} className="flex flex-col gap-y-6 max-w-2xl">
          <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Fecha:</label><input type="text" readOnly value={fecha} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed outline-none" /></div>
          <div className="flex flex-col md:flex-row md:items-start"><label className="md:w-36 text-left md:text-right md:pr-6 md:mt-3 text-[15px] font-bold text-slate-700">N° Proceso:</label><div className="flex-1 w-full flex flex-col"><input type="number" min="1" required placeholder="Ej: 15" value={numProceso} onChange={handleNumProcesoChange} className={`w-full bg-white border rounded-full px-5 py-3 text-sm text-slate-800 outline-none transition-all ${esErrorNum ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-300 focus:border-[#E96008] focus:ring-2 focus:ring-orange-100'} ${hideSpinners}`} />{mensajeNum && <span className={`text-xs mt-2 pl-4 font-bold ${esErrorNum ? 'text-red-500' : 'text-blue-600'}`}>{mensajeNum}</span>}</div></div>
          <div className="flex flex-col gap-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Exportadora:</label><select required value={exportadoraSel} onChange={e => setExportadoraSel(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none cursor-pointer"><option value="">Seleccionar...</option>{exportadoras.map((e, i) => <option key={i} value={e.nombre || e}>{e.nombre || e}</option>)}</select></div>
            <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">CSG:</label><select required disabled={!exportadoraSel} value={csgSel} onChange={e => handleSelectCSG(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"><option value="">{exportadoraSel ? 'Seleccionar...' : 'Selecciona Exportadora'}</option>{csgFiltrados.map((i, idx) => <option key={idx} value={i.csg}>{i.csg} - {i.huerto || i.nombre}</option>)}</select></div>
            <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Productor:</label><input type="text" readOnly placeholder="Automático" value={productorNombre} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed font-medium outline-none" /></div>
            <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Huerto:</label><input type="text" readOnly placeholder="Automático" value={huertoNombre} className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm text-slate-500 cursor-not-allowed font-medium outline-none" /></div>
            <div className="flex flex-col md:flex-row md:items-center"><label className="md:w-36 text-left md:text-right md:pr-6 text-[15px] font-bold text-slate-700">Variedad:</label><select required value={variedadSel} onChange={e => setVariedadSel(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-full px-5 py-3 text-sm text-slate-800 outline-none focus:border-[#E96008] focus:ring-2 focus:ring-orange-100 appearance-none cursor-pointer"><option value="">Seleccionar...</option>{variedades.map((v, i) => <option key={i} value={v.nombre || v}>{v.nombre || v}</option>)}</select></div>
          </div>
          <div className="pt-6 flex justify-end gap-4 w-full"><button type="submit" disabled={esErrorNum || !numProceso || cargando} className="px-10 py-3.5 disabled:bg-slate-300 text-white font-bold rounded-full shadow-md text-sm transition-colors flex items-center justify-center min-w-[200px] gap-2 bg-[#E96008] hover:bg-[#c74c04]">{cargando ? 'Conectando...' : 'Iniciar evaluación'}</button></div>
        </form>
      </div>
    </div>
  );
}

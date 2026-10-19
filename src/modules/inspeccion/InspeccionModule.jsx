import React, { useState, useEffect, useRef } from 'react';
import {
  Check, AlertTriangle, Menu, Users, LogOut,
  Trash2, X, ArrowLeft
} from 'lucide-react';
import FotografiasProceso from './FotografiasProceso';
const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
const crearMapaDefectos = nombres => Object.fromEntries(nombres.map(nombre => [nombre, 0]));
const sincronizarMapa = (actual, nombres) => Object.fromEntries(nombres.map(nombre => [nombre, actual?.[nombre] ?? 0]));
const sumarDefectos = (mapa, nombres) => nombres.reduce((total, nombre) => total + (parseInt(mapa?.[nombre]) || 0), 0);
const numeroParametro = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const nivelPorLimite = (pct, lim1, lim2) => {
  if (lim1 === null || lim2 === null) return 1;
  return pct > lim2 ? 3 : pct > lim1 ? 2 : 1;
};
export default function InspeccionModule({
  datosProceso,
  usuarioActual,
  onFinishedInspection,
  onAbrirMenu,
  onVolver
}) {
  // 🔥 Extraemos todas las nuevas variables colaborativas inyectadas por NuevoProceso
  const {
    numProceso, exportadoraSel, csgSel, variedadSel, productorNombre, huertoNombre,
    procesoIdBD, isColaborativo, nextCajaColaborativa, cajasPreviasColaborativas, horaInicioAsignada, clientIdColaborativo
  } = datosProceso || {};
  const DRAFT_KEY = isColaborativo && procesoIdBD ? `draft_inspeccion_colab_${procesoIdBD}` : `draft_inspeccion_${numProceso}`;
  const liveClientIdRef = useRef(clientIdColaborativo || `live-${procesoIdBD || numProceso || 'proceso'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const CLIENT_STORAGE_KEY = numProceso ? `evap_collab_client_${numProceso}` : null;
  const livePayloadRef = useRef(null);
  const finalizandoLocalRef = useRef(false);
  useEffect(() => { if (CLIENT_STORAGE_KEY && liveClientIdRef.current) localStorage.setItem(CLIENT_STORAGE_KEY, liveClientIdRef.current); }, [CLIENT_STORAGE_KEY]);
  // ==========================================
  // INICIALIZACIÓN PEREZOSA (LAZY INIT)
  // ==========================================
  const getDraft = () => {
    if (!numProceso) return null;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };
  const draftInit = getDraft();
  // 🔥 MODO COLABORATIVO: Inicializamos con las cajas que vengan de la BD si nos unimos
  const [cajas, setCajas] = useState(() => {
    if (isColaborativo) return Array.isArray(cajasPreviasColaborativas) ? cajasPreviasColaborativas : [];
    if (draftInit?.cajas && draftInit.cajas.length > 0) return draftInit.cajas;
    return [];
  });
  // En colaborativo el número visible viene reservado por el servidor para este inspector.
  const numCajaInicial = isColaborativo ? (nextCajaColaborativa || 1) : (draftInit?.cajaActual?.numCaja || 1);
  const [cajaActual, setCajaActual] = useState(() => {
    const base = draftInit?.cajaActual || { frutos: '100', calibre: '', brix: '', color: '', observacion: '', defCalidad: {}, defCondicion: {} };
    return { ...base, observacion: base.observacion || '', numCaja: numCajaInicial };
  });
  const [horaInicio, setHoraInicio] = useState(draftInit?.horaInicio || horaInicioAsignada || null);
  const [tabDefectos, setTabDefectos] = useState('calidad');
  const [showModalFinalizar, setShowModalFinalizar] = useState(false);
  const [showModalCancelar, setShowModalCancelar] = useState(false);
  const [showModalExitoGuardado, setShowModalExitoGuardado] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [haVistoCondicion, setHaVistoCondicion] = useState(false);
  const [procesoCerradoRemotamente, setProcesoCerradoRemotamente] = useState(null);
  const [otrosInspectoresFinalizacion, setOtrosInspectoresFinalizacion] = useState(0);
  const [usuariosEnInspeccion, setUsuariosEnInspeccion] = useState(1);
  const [usuariosProceso, setUsuariosProceso] = useState(() => [{ username: usuarioActual?.username || datosProceso?.username || 'Usuario' }]);
  const [mostrarUsuariosProceso, setMostrarUsuariosProceso] = useState(false);
  const cajasGuardadasRef = useRef(cajas.length);
  const [fotosProceso, setFotosProceso] = useState({ light: false, dark: false });
  const [fotoLightLocal, setFotoLightLocal] = useState(null);
  const [fotoDarkLocal, setFotoDarkLocal] = useState(null);
  const [abandonando, setAbandonando] = useState(false);
  // Bloqueo de UI mientras guarda en servidor
  const [guardandoCaja, setGuardandoCaja] = useState(false);
  const [paramsCalidad, setParamsCalidad] = useState([]);
  const [paramsCondicion, setParamsCondicion] = useState([]);
  const [parametrosListos, setParametrosListos] = useState(false);
  const [errorParametros, setErrorParametros] = useState(false);
  const defectosCalidad = paramsCalidad.filter(p => p.nombre !== SUM_CALIDAD);
  const defectosCondicion = paramsCondicion.filter(p => p.nombre !== SUM_CONDICION);
  const nombresCalidad = defectosCalidad.map(p => p.nombre);
  const nombresCondicion = defectosCondicion.map(p => p.nombre);
  const crearCajaVacia = numCaja => ({
    numCaja,
    frutos: '100',
    calibre: '',
    brix: '',
    color: '',
    observacion: '',
    defCalidad: crearMapaDefectos(nombresCalidad),
    defCondicion: crearMapaDefectos(nombresCondicion)
  });
  const [cajaEnEdicion, setCajaEnEdicion] = useState(null);
  const [cajaIndexEdicion, setCajaIndexEdicion] = useState(null);
  const [tabDefectosEdicion, setTabDefectosEdicion] = useState('calidad');
  const hideSpinners = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const headerCompleto = cajaActual.frutos !== '' && cajaActual.calibre !== '' && cajaActual.color !== '' && cajaActual.brix !== '';
  const tieneDefectosCajaActual = [...Object.values(cajaActual.defCalidad || {}), ...Object.values(cajaActual.defCondicion || {})].some(v => (parseInt(v, 10) || 0) > 0);
  const cajaActualTieneDatos = cajaActual.frutos !== '100' || cajaActual.calibre !== '' || cajaActual.brix !== '' || cajaActual.color !== '' || String(cajaActual.observacion || '').trim() !== '' || tieneDefectosCajaActual;
  const requiereRevisionCondicion = cajaActualTieneDatos && !haVistoCondicion;
  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl'
    : `http://${window.location.hostname || 'localhost'}:3001`;
  const obtenerSiguienteCajaServidor = async (preferredCaja = null) => {
    if (!isColaborativo || !procesoIdBD) return null;
    const extra = Number.isInteger(Number(preferredCaja)) && Number(preferredCaja) > 0 ? `&preferredCaja=${Number(preferredCaja)}` : '';
    const res = await fetch(`${API_URL}/api/procesos/colaborativo/${procesoIdBD}/siguiente-caja?clientId=${encodeURIComponent(liveClientIdRef.current)}${extra}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo consultar la siguiente caja.');
    setUsuariosEnInspeccion(Number(data.usuariosEnProceso || data.inspectoresActivos) || 1);
    if (Array.isArray(data.usuariosProceso)) setUsuariosProceso(data.usuariosProceso.length ? data.usuariosProceso : [{ username: usuarioActual?.username || datosProceso?.username || 'Usuario' }]);
    return Number(data.nextCajaVisual || data.nextCaja) || 1;
  };
  const prepararSiguienteCaja = async fallback => {
    let siguiente = Number(fallback) || 1;
    try { siguiente = await obtenerSiguienteCajaServidor(); }
    catch (err) { console.warn('No se pudo refrescar la numeración de cajas:', err); }
    setCajaActual(crearCajaVacia(siguiente));
    setHaVistoCondicion(false); setTabDefectos('calidad');
  };
  // Aviso de borrador o unión restaurada
  useEffect(() => {
    if (draftInit && draftInit.cajas && draftInit.cajas.length > 0) {
      setMensajeExito('Borrador local restaurado (F5)');
      setTimeout(() => setMensajeExito(''), 3000);
    } else if (isColaborativo && cajasPreviasColaborativas?.length > 0) {
      setMensajeExito(`Unido al proceso. ${cajasPreviasColaborativas.length} cajas ya evaluadas por el equipo.`);
      setTimeout(() => setMensajeExito(''), 4000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cajasGuardadasRef.current = cajas.length; }, [cajas.length]);
  // Al abrir/unirse se vuelve a comprobar el número contra las cajas realmente guardadas.
  useEffect(() => {
    if (!isColaborativo || !procesoIdBD) return;
    let activo = true;
    obtenerSiguienteCajaServidor(Number(cajaActual.numCaja) || null).then(next => {
      if (activo) setCajaActual(prev => ({ ...prev, numCaja: next }));
    }).catch(err => console.warn('No se pudo sincronizar el número inicial de caja:', err));
    return () => { activo = false; };
  }, [isColaborativo, procesoIdBD]); // eslint-disable-line react-hooks/exhaustive-deps
  // Autoguardado ininterrumpido en cada cambio
  useEffect(() => {
    if (!numProceso) return;
    const draft = { cajas, cajaActual, horaInicio };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [cajas, cajaActual, horaInicio, numProceso, DRAFT_KEY]);
  const limpiarBorrador = () => {
    localStorage.removeItem(DRAFT_KEY);
  };
  const limpiarClientePersistente = () => { if (CLIENT_STORAGE_KEY) localStorage.removeItem(CLIENT_STORAGE_KEY); };
  const marcarProcesoCerradoRemotamente = estado => {
    if (finalizandoLocalRef.current) return;
    setProcesoCerradoRemotamente(estado || 'Finalizado');
    setShowModalFinalizar(false);
    setGuardandoCaja(false);
    limpiarBorrador();
    limpiarClientePersistente();
    fetch(`${API_URL}/api/live`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearClientId: liveClientIdRef.current }), keepalive: true
    }).catch(() => {});
  };
  useEffect(() => {
    if (!isColaborativo || !procesoIdBD) return;
    let activo = true;
    const revisarEstado = async () => {
      if (finalizandoLocalRef.current) return;
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/${procesoIdBD}/estado?clientId=${encodeURIComponent(liveClientIdRef.current)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!activo) return;
        if (res.ok) {
          setUsuariosEnInspeccion(Number(data.usuariosEnProceso || data.inspectoresActivos) || 1);
          if (Array.isArray(data.usuariosProceso)) setUsuariosProceso(data.usuariosProceso.length ? data.usuariosProceso : [{ username: usuarioActual?.username || datosProceso?.username || 'Usuario' }]);
          setFotosProceso({ light: Boolean(data.fotoLight), dark: Boolean(data.fotoDark) });
          const totalServidor = Number(data.cajasGuardadas);
          if (Number.isInteger(totalServidor) && totalServidor >= 0 && totalServidor !== cajasGuardadasRef.current) {
            const detalleRes = await fetch(`${API_URL}/api/procesos/colaborativo/activo-detalle`, { cache: 'no-store' });
            const detalle = await detalleRes.json().catch(() => ({}));
            if (detalleRes.ok && Array.isArray(detalle.cajas) && Number(detalle.id) === Number(procesoIdBD)) setCajas(detalle.cajas);
          }
        }
        if (res.status === 404 || (res.ok && data.estado && data.estado !== 'En curso')) marcarProcesoCerradoRemotamente(data.estado || 'Finalizado');
      } catch (_) {}
    };
    revisarEstado();
    const timer = setInterval(revisarEstado, 1200);
    const handleVisibility = () => { if (document.visibilityState === 'visible') revisarEstado(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { activo = false; clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [isColaborativo, procesoIdBD, API_URL]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cargarParametros = async () => {
      setErrorParametros(false);
      try {
        const res = await fetch(`${API_URL}/api/parametros`);
        if (!res.ok) throw new Error('No fue posible cargar los parámetros.');
        const data = await res.json();
        const calidad = Array.isArray(data.calidad) ? data.calidad : [];
        const condicion = Array.isArray(data.condicion) ? data.condicion : [];
        if (!calidad.some(p => p.nombre === SUM_CALIDAD))
          throw new Error(`Falta "${SUM_CALIDAD}" en Parámetros.`);
        if (!condicion.some(p => p.nombre === SUM_CONDICION))
          throw new Error(`Falta "${SUM_CONDICION}" en Parámetros.`);
        const nombresCal = calidad.filter(p => p.nombre !== SUM_CALIDAD).map(p => p.nombre);
        const nombresCond = condicion.filter(p => p.nombre !== SUM_CONDICION).map(p => p.nombre);
        setParamsCalidad(calidad);
        setParamsCondicion(condicion);
        setCajaActual(prev => ({
          ...prev,
          defCalidad: sincronizarMapa(prev.defCalidad, nombresCal),
          defCondicion: sincronizarMapa(prev.defCondicion, nombresCond)
        }));
        setParametrosListos(true);
      } catch (err) {
        console.error('Error obteniendo parámetros:', err);
        setErrorParametros(true);
        setParametrosListos(false);
      }
    };
    cargarParametros();
  }, [API_URL]);
  // Envío en vivo: cada tablet publica su caja actual mientras se edita, sin necesidad de guardarla.
  useEffect(() => {
    const payload = {
      clientId: liveClientIdRef.current, procesoId: procesoIdBD || null, usuarioId: usuarioActual?.id || datosProceso?.usuarioId || null, username: usuarioActual?.username || datosProceso?.username || 'Usuario', numProceso, exportadora: exportadoraSel, productor: productorNombre, huerto: huertoNombre, variedad: variedadSel, csg: csgSel,
      cajas, cajaActual: cajaActualTieneDatos ? cajaActual : null, horaInicio
    };
    livePayloadRef.current = payload;
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .catch(err => console.log('Error enviando datos en vivo:', err));
    }, 80);
    return () => clearTimeout(timer);
  }, [cajas, cajaActual, procesoIdBD, numProceso, exportadoraSel, productorNombre, huertoNombre, variedadSel, csgSel, horaInicio, API_URL, usuarioActual?.id, usuarioActual?.username, datosProceso?.usuarioId, datosProceso?.username]);
  useEffect(() => {
    const publicarLive = (suspended = document.visibilityState === 'hidden') => {
      if (!livePayloadRef.current) return;
      const payload = { ...livePayloadRef.current, suspended };
      fetch(`${API_URL}/api/live`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: suspended
      }).catch(() => {});
    };
    const heartbeat = setInterval(() => {
      if (document.visibilityState !== 'hidden') publicarLive(false);
    }, 2500);
    const handleVisibility = () => publicarLive(document.visibilityState === 'hidden');
    const handlePageShow = () => publicarLive(false);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
      fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearClientId: liveClientIdRef.current }), keepalive: true }).catch(() => {});
    };
  }, [API_URL]);
  const registrarInicioProceso = () => { if (!horaInicio) setHoraInicio(new Date().toISOString()); };
  const actualizarDefecto = (tipo, def, valor) => {
    registrarInicioProceso();
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setCajaActual(prev => ({
      ...prev, [tipo === 'calidad' ? 'defCalidad' : 'defCondicion']: { ...prev[tipo === 'calidad' ? 'defCalidad' : 'defCondicion'], [def]: val }
    }));
  };
  const calcularPctGlobalDefecto = (tipoStr, def) => {
    let tFrutos = parseInt(cajaActual.frutos) || 0;
    let tDefecto = parseInt(cajaActual[tipoStr]?.[def]) || 0;
    cajas.forEach(c => { tFrutos += parseInt(c.frutos) || 0; tDefecto += parseInt(c[tipoStr]?.[def]) || 0; });
    return tFrutos === 0 ? '0.0' : ((tDefecto / tFrutos) * 100).toFixed(1);
  };
  const totalesCaja = () => {
    const tCal = sumarDefectos(cajaActual.defCalidad, nombresCalidad);
    const tCond = sumarDefectos(cajaActual.defCondicion, nombresCondicion);
    const f = parseInt(cajaActual.frutos) || 0;
    const pCal = f ? (tCal / f) * 100 : 0;
    const pCond = f ? (tCond / f) * 100 : 0;
    return { cal: pCal.toFixed(1), cond: pCond.toFixed(1), exp: f ? Math.max(0, 100 - pCal - pCond).toFixed(1) : '100.0' };
  };
  const manejarCambioBrix = (e, esEdicion = false) => {
    if (!esEdicion) registrarInicioProceso();
    let val = e.target.value.replace(',', '.'); val = val.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) return;
    if (esEdicion) setCajaEnEdicion(prev => ({ ...prev, brix: val }));
    else setCajaActual(prev => ({ ...prev, brix: val }));
  };
  // 🔥 NUEVA LÓGICA DE GUARDADO EN TIEMPO REAL CAJA POR CAJA
  const guardarCaja = async () => {
    if (procesoCerradoRemotamente) return;
    if (!parametrosListos) return alert("Los parámetros de calificación aún no están disponibles.");
    if (!headerCompleto) return alert("Completa Muestra, Calibre, Color de embalaje y °Brix.");
    const brixVal = parseFloat(cajaActual.brix);
    if (!isNaN(brixVal) && brixVal > 30) { if (!window.confirm(`El valor de °Brix ingresado (${brixVal}) es superior a 30. ¿Estás seguro?`)) return; }
    registrarInicioProceso();
    const usuarioCajaId=usuarioActual?.id||datosProceso?.usuarioId||null;
    const usuarioCajaNombre=usuarioActual?.username||datosProceso?.username||'Usuario';
    const cajaConUsuario={...cajaActual,usuarioId:usuarioCajaId,usuario:usuarioCajaNombre};
    if (isColaborativo && procesoIdBD) {
      setGuardandoCaja(true);
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/caja`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({procesoId:procesoIdBD,caja:cajaConUsuario,clientId:liveClientIdRef.current,usuarioId:usuarioCajaId,username:usuarioCajaNombre})
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Solo después de guardar analizamos nuevamente las cajas de BD y creamos la siguiente caja visible.
          setCajas(prev => [...prev, data.cajaGuardada]);
          await prepararSiguienteCaja(data.nextCajaVisual || data.nextCaja);
          setMensajeExito('Caja guardada correctamente en el orden de registro.');
          setTimeout(() => { setMensajeExito(''); }, 2500);
        } else if (res.status === 409) {
          marcarProcesoCerradoRemotamente(data.estado || 'Finalizado');
        } else {
          alert("Error al sincronizar con el servidor: " + data.error);
        }
      } catch (e) {
        console.error(e);
        alert("Error de conexión. La caja NO fue marcada como guardada. Reintenta cuando vuelva la conexión para evitar pérdida de datos.");
      } finally {
        setGuardandoCaja(false);
      }
    } else {
      // Flujo Offline Tradicional (Si no hay red al inicio o proceso manual)
      setCajas([...cajas,{...cajaConUsuario,id:Date.now()}]);
      setCajaActual(crearCajaVacia(cajas.length + 2));
      setHaVistoCondicion(false); setTabDefectos('calidad');
      setMensajeExito('Caja guardada correctamente'); setTimeout(() => { setMensajeExito(''); }, 2500);
    }
  };
  const abrirModalEdicionCaja = (caja, index) => {
    const copia = JSON.parse(JSON.stringify(caja));
    copia.defCalidad = sincronizarMapa(copia.defCalidad, nombresCalidad);
    copia.defCondicion = sincronizarMapa(copia.defCondicion, nombresCondicion);
    setCajaEnEdicion(copia);
    setCajaIndexEdicion(index);
    setTabDefectosEdicion('calidad');
  };
  const handleEdicionCampo = (campo, valor) => setCajaEnEdicion(prev => ({ ...prev, [campo]: valor }));
  const handleEdicionDefecto = (tipoDef, def, valor) => { const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0); setCajaEnEdicion(prev => ({ ...prev, [tipoDef]: { ...prev[tipoDef], [def]: val } })); };
  const guardarCambiosCajaEditada = async () => {
    const brixVal = parseFloat(cajaEnEdicion.brix);
    if (!isNaN(brixVal) && brixVal > 30) { if (!window.confirm(`El valor de °Brix (${brixVal}) es mayor a 30. ¿Es correcto?`)) return; }
    let cajaActualizada = { ...cajaEnEdicion, observacion: String(cajaEnEdicion.observacion || '').slice(0, 60) };
    if (isColaborativo && cajaActualizada.id) {
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/caja/${cajaActualizada.id}/observacion`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observacion: cajaActualizada.observacion })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || 'No fue posible actualizar la observación de la caja.');
        cajaActualizada = { ...cajaActualizada, observacion: data.observacion || '' };
      } catch (error) {
        console.error(error);
        return alert('No fue posible sincronizar la observación con el servidor.');
      }
    }
    const nuevasCajas = [...cajas]; nuevasCajas[cajaIndexEdicion] = cajaActualizada;
    setCajas(nuevasCajas); setCajaEnEdicion(null); setCajaIndexEdicion(null);
    setMensajeExito('Caja actualizada correctamente'); setTimeout(() => setMensajeExito(''), 2500);
  };
  const eliminarCajaGuardada = async index => {
    const caja = cajas[index];
    if (!caja || !window.confirm(`¿Seguro que deseas eliminar la Caja ${index + 1}?`)) return;
    if (isColaborativo && caja.id) {
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/caja/${caja.id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || 'No fue posible eliminar la caja.');
      } catch (error) {
        console.error(error);
        return alert('No fue posible sincronizar la eliminación con el servidor.');
      }
    }
    const filtradas = cajas.filter((_, i) => i !== index);
    setCajas(filtradas);
    if (!isColaborativo) setCajaActual(prev => ({ ...prev, numCaja: filtradas.length + 1 }));
    setCajaEnEdicion(null); setCajaIndexEdicion(null);
    setMensajeExito('Caja eliminada correctamente.'); setTimeout(() => setMensajeExito(''), 2200);
  };
  const confirmarCancelarProceso = async () => {
    try {
      if (isColaborativo && procesoIdBD) {
        if (usuariosEnInspeccion > 1) {
          const resAbandonar = await fetch(`${API_URL}/api/procesos/colaborativo/abandonar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ procesoId: procesoIdBD, clientId: liveClientIdRef.current })
          });
          const dataAbandonar = await resAbandonar.json().catch(() => ({}));
          if (!resAbandonar.ok) throw new Error(dataAbandonar.error || 'No se pudo abandonar la inspección.');
        } else {
          const resCancelar = await fetch(`${API_URL}/api/procesos/colaborativo/descartar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ procesoId: procesoIdBD, clientId: liveClientIdRef.current, forzar: true })
          });
          const dataCancelar = await resCancelar.json().catch(() => ({}));
          if (!resCancelar.ok) throw new Error(dataCancelar.error || 'No se pudo cancelar el proceso.');
        }
      } else {
        await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      }
    } catch (err) {
      console.error('Error al salir de inspección colaborativa:', err);
      alert(err.message || 'No se pudo cancelar la inspección.');
      return;
    }
    limpiarBorrador(); limpiarClientePersistente();
    localStorage.removeItem('inspeccionActiva');
    setShowModalCancelar(false);
    if (onVolver) onVolver();
  };
  const abandonarInspeccion = async () => {
    if (!isColaborativo || !procesoIdBD || usuariosEnInspeccion <= 1 || abandonando) return;
    if (!window.confirm('¿Abandonar esta inspección? La caja actual no se guardará y el proceso continuará con los demás usuarios.')) return;
    setAbandonando(true);
    try {
      const res = await fetch(`${API_URL}/api/procesos/colaborativo/abandonar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procesoId: procesoIdBD, clientId: liveClientIdRef.current })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo abandonar la inspección.');
      limpiarBorrador(); limpiarClientePersistente();
      localStorage.removeItem('inspeccionActiva');
      if (onVolver) onVolver();
    } catch (error) { alert(error.message || 'No se pudo abandonar la inspección.'); }
    finally { setAbandonando(false); }
  };
  const fotosCompletas = isColaborativo ? fotosProceso.light && fotosProceso.dark : Boolean(fotoLightLocal && fotoDarkLocal);
  let acumuladoFrutos = parseInt(cajaActual.frutos) || 0;
  let acumuladoCal = sumarDefectos(cajaActual.defCalidad, nombresCalidad);
  let acumuladoCond = sumarDefectos(cajaActual.defCondicion, nombresCondicion);
  let sumBrixLight = 0, countBrixLight = 0, sumBrixDark = 0, countBrixDark = 0;
  let defCalidadMap = Object.fromEntries(
    nombresCalidad.map(nombre => [nombre, parseInt(cajaActual.defCalidad?.[nombre]) || 0])
  );
  let defCondicionMap = Object.fromEntries(
    nombresCondicion.map(nombre => [nombre, parseInt(cajaActual.defCondicion?.[nombre]) || 0])
  );
  if (cajaActual.brix && parseFloat(cajaActual.brix) > 0) {
    if (cajaActual.color === 'Light') { sumBrixLight += parseFloat(cajaActual.brix); countBrixLight++; }
    if (cajaActual.color === 'Dark') { sumBrixDark += parseFloat(cajaActual.brix); countBrixDark++; }
  }
  cajas.forEach(c => {
    acumuladoFrutos += parseInt(c.frutos) || 0;
    acumuladoCal += sumarDefectos(c.defCalidad, nombresCalidad);
    acumuladoCond += sumarDefectos(c.defCondicion, nombresCondicion);
    if (c.brix && parseFloat(c.brix) > 0) {
      if (c.color === 'Light') { sumBrixLight += parseFloat(c.brix); countBrixLight++; }
      if (c.color === 'Dark') { sumBrixDark += parseFloat(c.brix); countBrixDark++; }
    }
    nombresCalidad.forEach(nombre => {
      defCalidadMap[nombre] += parseInt(c.defCalidad?.[nombre]) || 0;
    });
    nombresCondicion.forEach(nombre => {
      defCondicionMap[nombre] += parseInt(c.defCondicion?.[nombre]) || 0;
    });
  });
  const pCalGlobal = acumuladoFrutos ? (acumuladoCal / acumuladoFrutos) * 100 : 0;
  const pCondGlobal = acumuladoFrutos ? (acumuladoCond / acumuladoFrutos) * 100 : 0;
  const pExpGlobal = acumuladoFrutos ? Math.max(0, 100 - pCalGlobal - pCondGlobal) : 100;
  let nivelCalidad = 1;
  let nivelCondicion = 1;
  if (acumuladoFrutos > 0 && parametrosListos) {
    const sumCal = paramsCalidad.find(p => p.nombre === SUM_CALIDAD);
    if (sumCal) {
      nivelCalidad = Math.max(
        nivelCalidad,
        nivelPorLimite(pCalGlobal, numeroParametro(sumCal.limAB), numeroParametro(sumCal.limBC))
      );
    }
    defectosCalidad.forEach(param => {
      const pct = ((defCalidadMap[param.nombre] || 0) / acumuladoFrutos) * 100;
      nivelCalidad = Math.max(
        nivelCalidad,
        nivelPorLimite(pct, numeroParametro(param.limAB), numeroParametro(param.limBC))
      );
    });
    const sumCond = paramsCondicion.find(p => p.nombre === SUM_CONDICION);
    if (sumCond) {
      nivelCondicion = Math.max(
        nivelCondicion,
        nivelPorLimite(pCondGlobal, numeroParametro(sumCond.lim12), numeroParametro(sumCond.lim23))
      );
    }
    defectosCondicion.forEach(param => {
      const pct = ((defCondicionMap[param.nombre] || 0) / acumuladoFrutos) * 100;
      nivelCondicion = Math.max(
        nivelCondicion,
        nivelPorLimite(pct, numeroParametro(param.lim12), numeroParametro(param.lim23))
      );
    });
  }
  const letCal = nivelCalidad === 3 ? 'C' : nivelCalidad === 2 ? 'B' : 'A';
  const numCond = String(nivelCondicion);
  const notaGlobal = acumuladoFrutos > 0 && parametrosListos ? `${letCal}${numCond}` : '-';
  const esCritico = parametrosListos && (letCal === 'C' || numCond === '3');
  const esAlerta = parametrosListos && !esCritico && (letCal === 'B' || numCond === '2');
  const estadoGlobal = acumuladoFrutos && parametrosListos ? (esCritico ? 'Objetado' : 'Aprobado') : '-';
  const colorNota = esCritico
    ? 'bg-[#fef2f2] text-[#ef4444] border-[#fecaca]'
    : esAlerta
    ? 'bg-[#fffbeb] text-[#f59e0b] border-[#fde68a]'
    : 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]';
  const promLight = countBrixLight ? (sumBrixLight / countBrixLight).toFixed(1).replace('.', ',') : '0,0';
  const promDark = countBrixDark ? (sumBrixDark / countBrixDark).toFixed(1).replace('.', ',') : '0,0';
  const totalCajasBanner = cajas.length;
  const totalDefCalidadActual = sumarDefectos(cajaActual.defCalidad, nombresCalidad);
  const totalDefCondicionActual = sumarDefectos(cajaActual.defCondicion, nombresCondicion);
  const abrirModalFinalizar = async () => {
    if (requiereRevisionCondicion) { setTabDefectos('condicion'); return; }
    if (isColaborativo && procesoIdBD) {
      try {
        const res = await fetch(`${API_URL}/api/procesos/colaborativo/${procesoIdBD}/estado?clientId=${encodeURIComponent(liveClientIdRef.current)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 || (res.ok && data.estado !== 'En curso')) return marcarProcesoCerradoRemotamente(data.estado || 'Finalizado');
        const estadoFotos = { light: Boolean(data.fotoLight), dark: Boolean(data.fotoDark) };
        setFotosProceso(estadoFotos);
        setUsuariosEnInspeccion(Number(data.inspectoresActivos) || 1);
        setOtrosInspectoresFinalizacion(Number(data.otrosInspectoresActivos) || 0);
        if (!estadoFotos.light || !estadoFotos.dark) return alert('Debes ingresar las fotografías de embalaje Light y Dark antes de finalizar el proceso.');
      } catch (_) { return alert('No fue posible verificar las fotografías y usuarios activos. Intenta nuevamente.'); }
    } else {
      setOtrosInspectoresFinalizacion(0);
      if (!fotosCompletas) return alert('Debes ingresar las fotografías de embalaje Light y Dark antes de finalizar el proceso.');
    }
    setShowModalFinalizar(true);
  };
  // Finaliza el proceso respetando revisión de Condición y trabajo concurrente del equipo.
  const enviarInspeccionAlServidor = async (forzarConfirmado = false) => {
    if (procesoCerradoRemotamente) return;
    if (!parametrosListos) return alert("No se puede finalizar sin los parámetros de calificación.");
    if (!fotosCompletas) return alert('Debes ingresar las fotografías de embalaje Light y Dark antes de finalizar el proceso.');
    if (requiereRevisionCondicion) {
      setTabDefectos('condicion');
      return alert('Antes de finalizar debes pasar por la sección Defectos de Condición de la caja actual.');
    }
    const usuarioCajaId=usuarioActual?.id||datosProceso?.usuarioId||null;
    const usuarioCajaNombre=usuarioActual?.username||datosProceso?.username||'Usuario';
    const cajaActualConUsuario={...cajaActual,usuarioId:usuarioCajaId,usuario:usuarioCajaNombre};
    let cajasFinales=headerCompleto?[...cajas,cajaActualConUsuario]:[...cajas];
    if (cajasFinales.length === 0) return alert("No has evaluado ninguna caja.");
    const horaFinCalculada = new Date().toISOString();
    const fechaExactaChile = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    try {
      if (isColaborativo && procesoIdBD) {
        let forzarFinalizacion = false;
        const estadoRes = await fetch(`${API_URL}/api/procesos/colaborativo/${procesoIdBD}/estado?clientId=${encodeURIComponent(liveClientIdRef.current)}`, { cache: 'no-store' });
        const estadoData = await estadoRes.json().catch(() => ({}));
        if (estadoRes.status === 404 || (estadoRes.ok && estadoData.estado !== 'En curso')) {
          marcarProcesoCerradoRemotamente(estadoData.estado || 'Finalizado');
          return;
        }
        const otros = Number(estadoData.otrosInspectoresActivos) || 0;
        if (otros > 0) {
          if (!forzarConfirmado) {
            const seguir = window.confirm(`Hay ${otros} usuario${otros === 1 ? '' : 's'} actualmente en otra inspección de este proceso. Si finalizas ahora, ${otros === 1 ? 'ese usuario será notificado y no podrá continuar' : 'esos usuarios serán notificados y no podrán continuar'}. ¿Deseas finalizar igualmente?`);
            if (!seguir) return;
          }
          forzarFinalizacion = true;
        }
        finalizandoLocalRef.current = true;
        if (headerCompleto) {
          const resCajaFinal = await fetch(`${API_URL}/api/procesos/colaborativo/caja`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({procesoId:procesoIdBD,caja:cajaActualConUsuario,clientId:liveClientIdRef.current,usuarioId:usuarioCajaId,username:usuarioCajaNombre})
          });
          const dataCajaFinal = await resCajaFinal.json().catch(() => ({}));
          if (!resCajaFinal.ok) {
            finalizandoLocalRef.current = false;
            if (resCajaFinal.status === 409) return marcarProcesoCerradoRemotamente(dataCajaFinal.estado || 'Finalizado');
            throw new Error(dataCajaFinal.error || 'No se pudo guardar la última caja.');
          }
        }
        const finalizar = async forzar => {
          const res = await fetch(`${API_URL}/api/procesos/colaborativo/finalizar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ procesoId: procesoIdBD, estadoGlobal: notaGlobal, horaFin: horaFinCalculada, clientId: liveClientIdRef.current, forzar })
          });
          return { res, data: await res.json().catch(() => ({})) };
        };
        let cierre = await finalizar(forzarFinalizacion);
        if (!cierre.res.ok && cierre.data.code === 'OTROS_INSPECTORES_ACTIVOS') {
          finalizandoLocalRef.current = false;
          const otrosNuevos = Number(cierre.data.inspectoresActivos) || 1;
          const seguir = window.confirm(`Se detectó ${otrosNuevos === 1 ? 'otro usuario' : `${otrosNuevos} usuarios`} inspeccionando mientras intentabas finalizar. ¿Cerrar el proceso igualmente?`);
          if (!seguir) return;
          finalizandoLocalRef.current = true;
          cierre = await finalizar(true);
        }
        if (cierre.res.ok) {
          await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          limpiarBorrador(); limpiarClientePersistente();
          setShowModalExitoGuardado(true);
        } else {
          finalizandoLocalRef.current = false;
          if (cierre.data.code === 'FOTOS_REQUERIDAS') return alert(cierre.data.error || 'Faltan fotografías de embalaje.');
          if (cierre.data.code === 'PROCESO_CERRADO' || (cierre.res.status === 409 && cierre.data.code !== 'OTROS_INSPECTORES_ACTIVOS')) return marcarProcesoCerradoRemotamente(cierre.data.estado || 'Finalizado');
          alert(`Error finalizando el proceso: ${cierre.data.error || 'Error desconocido.'}`);
        }
      } else {
        const payload = {
          numProceso, exportadora: exportadoraSel, csg: csgSel, variedad: variedadSel,
          estado: notaGlobal, cajas: cajasFinales, productor: productorNombre, huerto: huertoNombre,
          horaInicio, horaFin: horaFinCalculada, fecha: fechaExactaChile, fotoLight: fotoLightLocal, fotoDark: fotoDarkLocal, usuarioId: usuarioActual?.id || datosProceso?.usuarioId || null, username: usuarioActual?.username || datosProceso?.username || 'Usuario'
        };
        const response = await fetch(`${API_URL}/api/inspecciones`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (response.ok) {
          await fetch(`${API_URL}/api/live`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          limpiarBorrador(); setShowModalExitoGuardado(true);
        } else {
          const data = await response.json();
          alert("❌ ERROR DEL SERVIDOR: " + (data.error || "Error al guardar"));
        }
      }
    } catch (err) {
      finalizandoLocalRef.current = false;
      console.error(err);
      alert("❌ ERROR DE CONEXIÓN: No se pudo contactar al servidor Backend.");
    }
  };
  const rend = totalesCaja();
  return (
    <div className="w-full h-full bg-[#f1f5f9] overflow-y-auto custom-scrollbar relative" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", letterSpacing: '-0.01em' }}>
      {/* ================= ESTILOS INYECTADOS ================= */}
      <style>{`
        /* Entrada suave escalonada */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-1 { animation-delay: 0.05s; }
        .delay-2 { animation-delay: 0.12s; }
        .delay-3 { animation-delay: 0.18s; }
        .delay-4 { animation-delay: 0.24s; }
        /* Pulso sutil para badges e indicadores */
        @keyframes softPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.88; }
        }
        .pulse-badge { animation: softPulse 2.8s ease-in-out infinite; }
        /* Efecto de foco en inputs de defectos */
        .defect-input { transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }
        .defect-input:focus {
          outline: none;
          border-color: #ea580c;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
          transform: scale(1.02);
        }
        /* Hover en fila de defecto */
        .defect-row { transition: background-color 0.15s ease, transform 0.15s ease; border-radius: 0.5rem; padding: 0.35rem 0.5rem; }
        .defect-row:hover { background-color: #f8fafc; }
        /* Pestañas activas con línea indicadora */
        .tab-indicator { position: relative; font-weight: 700; color: #ea580c; padding-bottom: 0.35rem; }
        .tab-indicator::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2.5px;
          background-color: #ea580c;
          border-radius: 9999px;
          transition: all 0.3s ease;
        }
        /* Estilos de Botones */
        .btn-cancel {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 1.75rem; border-radius: 0.75rem;
          background-color: #1e293b; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .btn-cancel:hover { background-color: #0f172a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2); }
        .btn-cancel:active { transform: translateY(0) scale(0.97); }
        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 2rem; border-radius: 0.75rem;
          background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .btn-primary:hover { background-color: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45); }
        .btn-primary:active { transform: translateY(0) scale(0.97); }
        .btn-success {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem 1.75rem; border-radius: 0.75rem;
          background-color: #059669; color: #ffffff; font-weight: 600; font-size: 0.875rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
        }
        .btn-success:hover { background-color: #047857; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4); }
        .btn-success:active { transform: translateY(0) scale(0.97); }
        .btn-disabled { opacity: 0.6; pointer-events: none; background-color: #94a3b8 !important; box-shadow: none !important; }
      `}</style>
      {mensajeExito && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#059669] text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 border border-[#047857] text-sm animate-fade-in-up">
          <Check className="w-5 h-5" /> {mensajeExito}
        </div>
      )}
      <div className="max-w-[1600px] mx-auto flex flex-col gap-3 py-3 px-3 sm:px-6 lg:px-8 w-full pb-10">
        {errorParametros && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            No fue posible cargar el catálogo de defectos. Revisa Parámetros de Calificación o la conexión con el servidor.
          </div>
        )}
        {/* CABECERA */}
        <div className="relative z-[90] flex justify-between items-center w-full mt-1 mb-2 animate-fade-in-up delay-1">
          <div className="flex items-center gap-3">
            {onAbrirMenu && (
              <button type="button" onClick={onAbrirMenu} className="p-2 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#1e293b] rounded-xl shadow-sm transition-colors">
                <Menu className="w-6 h-6 md:w-7 md:h-7" />
              </button>
            )}
            <div>
              <h1 className="text-[19px] md:text-2xl font-bold text-[#0f172a] leading-tight tracking-tight">Inspección Producto Terminado</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-sm md:text-sm text-[#64748b] font-medium uppercase tracking-wider">
                  {huertoNombre || productorNombre || 'Ingreso en vivo'} <span className="mx-1">•</span> {variedadSel}
                </p>
                {horaInicio ? (
                  <span className="text-[#ea580c] font-bold bg-[#ffedd5] px-2 py-0.5 rounded-md border border-[#fed7aa] whitespace-nowrap text-xs shadow-sm">
                    INICIO: {new Date(horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="text-[#64748b] font-bold bg-[#f1f5f9] px-2 py-0.5 rounded-md border border-[#e2e8f0] whitespace-nowrap text-[10px] pulse-badge">
                    ESPERANDO INICIO...
                  </span>
                )}
                {isColaborativo && (
                  <div className="relative">
                    <button type="button" onClick={() => setMostrarUsuariosProceso(v => !v)} className="text-[#475569] font-bold bg-white px-2 py-0.5 rounded-md border border-[#cbd5e1] whitespace-nowrap text-xs shadow-sm flex items-center gap-1 hover:bg-slate-50 transition-colors">
                      <Users className="w-3.5 h-3.5 text-[#2563eb]" /> {usuariosEnInspeccion}/3 {usuariosEnInspeccion === 1 ? 'usuario' : 'usuarios'}
                    </button>
                    {mostrarUsuariosProceso && (
                      <div className="fixed left-4 right-4 top-[82px] sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-[230px] z-[140] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                        <div className="flex items-center justify-between gap-3 mb-2"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">Usuarios en el proceso</p><button type="button" onClick={() => setMostrarUsuariosProceso(false)} className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button></div>
                        <div className="space-y-1.5">{usuariosProceso.slice(0, 3).map((u, i) => <div key={`${u.usuarioId || u.clientId || i}-${i}`} className="text-[12px] font-semibold text-slate-700 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /><span className="truncate">{u.username || 'Usuario'}</span></div>)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <img src="/Logo_goldanda.png" alt="Logo" className="h-7 md:h-10 object-contain hidden sm:block" />
        </div>
        {/* 1. TARJETA: ACUMULADO DE PROCESO */}
        <div className="bg-[#ffffff] rounded-2xl border-t-4 border-[#ea580c] border-x border-b border-[#e2e8f0] shadow-sm px-4 md:px-6 py-3.5 mb-3 shrink-0 w-full transition-all animate-fade-in-up delay-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 md:mb-3">
            <h2 className="text-[11px] md:text-xs font-bold text-[#94a3b8] tracking-wider uppercase">Acumulado de Proceso</h2>
            <FotografiasProceso
              apiUrl={API_URL}
              procesoId={isColaborativo ? procesoIdBD : null}
              lightOk={isColaborativo ? fotosProceso.light : Boolean(fotoLightLocal)}
              darkOk={isColaborativo ? fotosProceso.dark : Boolean(fotoDarkLocal)}
              disabled={Boolean(procesoCerradoRemotamente)}
              onEstadoChange={setFotosProceso}
              onLocalPhoto={(tipo, imagen) => tipo === 'light' ? setFotoLightLocal(imagen) : setFotoDarkLocal(imagen)}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-3 md:gap-y-4 gap-x-2 text-[#0f172a]">
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Proceso</span>
              <span className="text-base md:text-[22px] font-black">{numProceso || '-'}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Cajas analizadas</span>
              <span className="text-base md:text-[22px] font-black">{totalCajasBanner}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Exportable</span>
              <span className="text-base md:text-[22px] font-black text-[#0f172a]">{acumuladoFrutos ? pExpGlobal.toFixed(1) : '100.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Sólidos (L/D)</span>
              <span className="text-base md:text-[22px] font-black">{promLight} <span className="text-[#94a3b8] font-normal mx-0.5">/</span> {promDark}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Calificación</span>
              <span className="text-base md:text-[22px] font-black">{notaGlobal}</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Def. calidad</span>
              <span className="text-base md:text-[22px] font-black text-[#ea580c]">{acumuladoFrutos ? pCalGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col border-r border-[#e2e8f0] pr-1 md:pr-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-0.5">Def. condición</span>
              <span className="text-base md:text-[22px] font-black text-[#e11d48]">{acumuladoFrutos ? pCondGlobal.toFixed(1) : '0.0'}%</span>
            </div>
            <div className="flex flex-col justify-center items-start pl-2">
              <span className="text-[11px] font-semibold text-[#64748b] mb-1">Estado</span>
              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold border ${colorNota} ${estadoGlobal === 'Aprobado' ? 'pulse-badge' : ''}`}>
                {estadoGlobal}
              </span>
            </div>
          </div>
        </div>
        {/* MINI LISTA DESPLEGABLE DE CAJAS ANALIZADAS */}
        {cajas.length > 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-2.5 px-4 shadow-sm w-full flex items-center justify-between gap-3 animate-fade-in-up delay-2 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider shrink-0">
                Editar caja guardada ({cajas.length}):
              </span>
              <select
                value=""
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && idx >= 0) {
                    abrirModalEdicionCaja(cajas[idx], idx);
                  }
                }}
                className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-lg font-medium px-3 py-1.5 outline-none focus:border-[#ea580c] cursor-pointer"
              >
                <option value="" disabled>Seleccionar caja...</option>
                {cajas.map((c, idx) => (
                  <option key={idx} value={idx}>
                    Caja {idx + 1} - {c.calibre || 'Sin Calibre'} ({c.frutos} fr. - {c.brix ? `${c.brix}°Bx` : 'Sin Bx'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {/* 2. TARJETA: EVALUANDO NUEVA CAJA */}
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-2xl p-4 md:px-6 md:py-4 shadow-sm w-full relative mb-3 animate-fade-in-up delay-3">
          {cajaEnEdicion && <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 rounded-2xl"></div>}
          <div className="flex items-center justify-between mb-3 border-b border-[#f1f5f9] pb-3">
            <span className="text-[#1e293b] font-semibold text-sm md:text-lg tracking-tight">
              Evaluando nueva caja {isColaborativo ? <span className="text-[#64748b] text-xs md:text-sm font-bold ml-2">(el orden se asigna al guardar)</span> : <span className="text-[#ea580c] text-lg md:text-xl font-bold ml-1">#{cajaActual.numCaja}</span>}
            </span>
            <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-sm font-semibold">
              <span className="text-[#64748b] hidden sm:inline">Rendimiento:</span>
              <span className="bg-[#ffedd5] text-[#ea580c] px-2 py-1 md:px-3 rounded-lg border border-[#fed7aa]">Cal: {rend.cal}%</span>
              <span className="bg-[#ffe4e6] text-[#e11d48] px-2 py-1 md:px-3 rounded-lg border border-[#fecaca]">Cond: {rend.cond}%</span>
              <span className="bg-[#ecfdf5] text-[#059669] px-2 py-1 md:px-3 rounded-lg border border-[#a7f3d0]">Exp: {rend.exp}%</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Muestra (frutos):</span>
              <input
                type="number" inputMode="numeric" onWheel={(e) => e.target.blur()} value={cajaActual.frutos}
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, frutos: e.target.value }); }}
                className={`w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all ${hideSpinners}`}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Calibre:</span>
              <select
                value={cajaActual.calibre}
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, calibre: e.target.value }); }}
                className="w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all"
              >
                <option value="">Seleccionar</option>
                <option value="L">L</option><option value="XL">XL</option><option value="J">J</option>
                <option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">Color embalaje:</span>
              <select
                value={cajaActual.color}
                onChange={(e) => { registrarInicioProceso(); setCajaActual({ ...cajaActual, color: e.target.value }); }}
                className="w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all"
              >
                <option value="">Seleccionar</option>
                <option value="Light">Light</option><option value="Dark">Dark</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#475569]">° Brix:</span>
              <input
                type="text" inputMode="decimal" value={cajaActual.brix} onChange={(e) => manejarCambioBrix(e, false)}
                className={`w-28 text-center font-semibold text-sm bg-white border border-[#e2e8f0] rounded-lg h-9 outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all`}
              />
            </div>
          </div>
        </div>
        {/* 3. TARJETA: DEFECTOS */}
        <div className={`bg-[#ffffff] border border-[#e2e8f0] rounded-2xl px-4 md:px-6 pt-2 pb-5 shadow-sm transition-all animate-fade-in-up delay-4 ${(!headerCompleto || !parametrosListos) ? 'opacity-50 pointer-events-none' : ''} ${cajaEnEdicion ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex border-b border-[#f1f5f9] mb-4 pt-1">
            <button
              onClick={() => { registrarInicioProceso(); setTabDefectos('calidad'); }}
              className={`flex-1 pb-2 font-bold text-[13px] md:text-sm flex items-center justify-center gap-2 transition-all ${tabDefectos === 'calidad' ? 'tab-indicator text-[#ea580c]' : 'text-[#64748b] border-b-[2.5px] border-transparent hover:text-[#0f172a]'}`}
            >
              Defectos de Calidad
              {totalDefCalidadActual > 0 && <span className="bg-[#ea580c] text-white text-[10px] md:text-xs px-2 py-0.5 rounded-md font-bold">{totalDefCalidadActual}</span>}
            </button>
            <button
              onClick={() => { registrarInicioProceso(); setTabDefectos('condicion'); setHaVistoCondicion(true); }}
              className={`flex-1 pb-2 pt-1.5 rounded-t-lg font-bold text-[13px] md:text-sm flex items-center justify-center gap-2 transition-all ${tabDefectos === 'condicion' ? 'tab-indicator text-[#be123c] bg-[#fff1f2]' : haVistoCondicion ? 'text-[#9f1239] bg-[#fff7f8] border-b-[2.5px] border-transparent hover:bg-[#fff1f2]' : 'text-[#be123c] bg-[#fff1f2] border-b-[2.5px] border-transparent hover:bg-[#ffe4e6]'}`}
              style={tabDefectos === 'condicion' ? { color: '#be123c', '--tw-bg-opacity': 1 } : {}}
            >
              {!haVistoCondicion && tabDefectos !== 'condicion' && <span className="w-2 h-2 rounded-full bg-[#e11d48] shadow-[0_0_0_3px_rgba(225,29,72,0.10)]" />}
              Defectos de Condición
              {totalDefCondicionActual > 0 && <span className="bg-[#e11d48] text-white text-[10px] md:text-xs px-2 py-0.5 rounded-md font-bold">{totalDefCondicionActual}</span>}
              {tabDefectos === 'condicion' && <style>{`.tab-indicator::after { background-color: #e11d48 !important; }`}</style>}
            </button>
          </div>
          {!parametrosListos && (
            <p className="text-center text-[12px] md:text-sm text-[#64748b] font-medium my-4 py-2 bg-[#f8fafc] rounded-lg">
              {errorParametros ? 'No fue posible cargar el catálogo de defectos.' : 'Cargando catálogo de defectos...'}
            </p>
          )}
          {parametrosListos && !headerCompleto && (
            <p className="text-center text-[12px] md:text-sm text-[#ea580c] font-medium my-4 py-2 bg-[#ffedd5] rounded-lg">
              Completa Muestra, Calibre, Color y °Brix en la sección superior para ingresar los defectos.
            </p>
          )}
          {parametrosListos && tabDefectos === 'calidad' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
              {defectosCalidad.map(param => {
                const def = param.nombre;
                const count = cajaActual.defCalidad?.[def] ?? 0;
                return (
                  <div key={def} className="defect-row flex items-center justify-between gap-2 border-b border-[#f1f5f9] sm:border-0">
                    <span className="text-[13px] md:text-[13.5px] font-medium text-[#334155] flex-1 truncate leading-tight">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('calidad', def, e.target.value)} className={`defect-input w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-[#f8fafc]' : 'bg-white'}`} />
                      <span className="text-[11px] md:text-xs w-10 md:w-11 text-right font-semibold text-[#94a3b8]">{calcularPctGlobalDefecto('defCalidad', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {parametrosListos && tabDefectos === 'condicion' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
              {defectosCondicion.map(param => {
                const def = param.nombre;
                const count = cajaActual.defCondicion?.[def] ?? 0;
                return (
                  <div key={def} className="defect-row flex items-center justify-between gap-2 border-b border-[#f1f5f9] sm:border-0">
                    <span className="text-[13px] md:text-[13.5px] font-medium text-[#334155] flex-1 truncate leading-tight">{def}</span>
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="numeric" disabled={!headerCompleto} onWheel={(e) => e.target.blur()} value={count === 0 ? '' : count} onChange={(e) => actualizarDefecto('condicion', def, e.target.value)} className={`defect-input w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none shadow-sm ${hideSpinners} ${!headerCompleto ? 'bg-[#f8fafc]' : 'bg-white'} focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4e6]`} />
                      <span className="text-[11px] md:text-xs w-10 md:w-11 text-right font-semibold text-[#94a3b8]">{calcularPctGlobalDefecto('defCondicion', def)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[12px] md:text-[13px] font-semibold text-[#475569]">Observación caja:</span>
              <span className="text-[10px] text-[#94a3b8] font-medium">Opcional</span>
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={60}
                value={cajaActual.observacion || ''}
                onChange={(e) => { registrarInicioProceso(); setCajaActual(prev => ({ ...prev, observacion: e.target.value.slice(0, 60) })); }}
                placeholder="Ej.: fruta deshidratada, caja húmeda, embalaje irregular..."
                className="w-full h-9 bg-white border border-[#e2e8f0] rounded-lg pl-3 pr-14 text-[12px] md:text-[13px] font-medium text-[#334155] outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-all placeholder:text-[#cbd5e1]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#94a3b8]">{String(cajaActual.observacion || '').length}/60</span>
            </div>
          </div>
        </div>
        {/* 4. BOTONES DE ACCIÓN */}
        <div className="pt-2 pb-6 md:pb-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full animate-fade-in-up delay-4">
          <button onClick={() => setShowModalCancelar(true)} disabled={cajaEnEdicion !== null || guardandoCaja} className={`btn-cancel group ${cajaEnEdicion !== null || guardandoCaja ? 'btn-disabled' : ''}`}>
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Cancelar</span>
          </button>
          {isColaborativo && usuariosEnInspeccion > 1 && (
            <button onClick={abandonarInspeccion} disabled={cajaEnEdicion !== null || guardandoCaja || abandonando} className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#cbd5e1] bg-white text-[#475569] font-semibold text-sm hover:bg-[#f8fafc] hover:text-[#0f172a] transition-all ${cajaEnEdicion !== null || guardandoCaja || abandonando ? 'opacity-50 pointer-events-none' : ''}`}>
              <LogOut className="w-4 h-4" /> {abandonando ? 'Abandonando...' : 'Abandonar inspección'}
            </button>
          )}
          <button onClick={guardarCaja} disabled={!headerCompleto || !parametrosListos || cajaEnEdicion !== null || !haVistoCondicion || guardandoCaja} className={`btn-primary group ${(!headerCompleto || !parametrosListos || cajaEnEdicion !== null || !haVistoCondicion || guardandoCaja) ? 'btn-disabled' : ''}`}>
            {guardandoCaja ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Sincronizando...
              </span>
            ) : (
              <span>{(!haVistoCondicion && headerCompleto && cajaEnEdicion === null) ? 'Revisa Condición para Guardar' : 'Guardar y Siguiente'}</span>
            )}
          </button>
          <button onClick={abrirModalFinalizar} disabled={cajaEnEdicion !== null || guardandoCaja || !parametrosListos || requiereRevisionCondicion || !fotosCompletas || procesoCerradoRemotamente} className={`btn-success group shrink-0 ${cajaEnEdicion !== null || guardandoCaja || !parametrosListos || requiereRevisionCondicion || !fotosCompletas || procesoCerradoRemotamente ? 'btn-disabled' : ''}`}>
            <Check className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
            <span>{!fotosCompletas ? 'Faltan fotografías' : requiereRevisionCondicion ? 'Revisa Condición para Finalizar' : 'Finalizar Proceso'}</span>
          </button>
        </div>
      </div>
      {/* MODAL DE EDICIÓN DE CAJA */}
      {cajaEnEdicion && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 md:p-8 flex flex-col gap-4 border border-[#e2e8f0] relative custom-scrollbar">
            <div className="flex justify-between items-center border-b border-[#f1f5f9] pb-3">
              <h3 className="font-black text-[#0f172a] text-base md:text-xl tracking-tight">Corrigiendo Caja {Number(cajaIndexEdicion) + 1}</h3>
              <button onClick={() => setCajaEnEdicion(null)} className="p-1.5 rounded-lg bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[#f1f5f9]">
              <div><label className="text-xs font-semibold text-[#475569] block mb-1">Muestra (frutos)</label><input type="number" value={cajaEnEdicion.frutos ?? ''} onChange={(e) => handleEdicionCampo('frutos', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors" /></div>
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1">Calibre</label>
                <select value={cajaEnEdicion.calibre ?? ''} onChange={(e) => handleEdicionCampo('calibre', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors"><option value="">Seleccionar</option><option value="L">L</option><option value="XL">XL</option><option value="J">J</option><option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option></select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#475569] block mb-1">Color</label>
                <select value={cajaEnEdicion.color ?? ''} onChange={(e) => handleEdicionCampo('color', e.target.value)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors"><option value="">Seleccionar</option><option value="Light">Light</option><option value="Dark">Dark</option></select>
              </div>
              <div><label className="text-xs font-semibold text-[#475569] block mb-1">° Brix</label><input type="text" inputMode="decimal" value={cajaEnEdicion.brix ?? ''} onChange={(e) => manejarCambioBrix(e, true)} className="w-full h-9 text-center font-semibold text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] transition-colors" /></div>
            </div>
            <div className="flex border-b border-[#f1f5f9] mt-2">
              <button type="button" onClick={() => setTabDefectosEdicion('calidad')} className={`flex-1 pb-2 font-bold text-[13px] md:text-sm transition-all ${tabDefectosEdicion === 'calidad' ? 'tab-indicator text-[#ea580c]' : 'border-b-[2.5px] border-transparent text-[#64748b] hover:text-[#0f172a]'}`}>Defectos de Calidad</button>
              <button type="button" onClick={() => setTabDefectosEdicion('condicion')} className={`flex-1 pb-2 font-bold text-[13px] md:text-sm transition-all ${tabDefectosEdicion === 'condicion' ? 'tab-indicator text-[#e11d48]' : 'border-b-[2.5px] border-transparent text-[#64748b] hover:text-[#0f172a]'}`} style={tabDefectosEdicion === 'condicion' ? { color: '#e11d48' } : {}}>Defectos de Condición</button>
            </div>
            {tabDefectosEdicion === 'calidad' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pt-2">
                {defectosCalidad.map(param => { const def = param.nombre; return <div key={def} className="flex justify-between items-center p-1 border-b border-[#f1f5f9]"><span className="text-[13px] md:text-sm font-medium text-[#334155]">{def}</span><input type="number" value={cajaEnEdicion.defCalidad?.[def] || ''} onChange={(e) => handleEdicionDefecto('defCalidad', def, e.target.value)} className="w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none focus:border-[#ea580c]" /></div>; })}
              </div>
            )}
            {tabDefectosEdicion === 'condicion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pt-2">
                {defectosCondicion.map(param => { const def = param.nombre; return <div key={def} className="flex justify-between items-center p-1 border-b border-[#f1f5f9]"><span className="text-[13px] md:text-sm font-medium text-[#334155]">{def}</span><input type="number" value={cajaEnEdicion.defCondicion?.[def] || ''} onChange={(e) => handleEdicionDefecto('defCondicion', def, e.target.value)} className="w-14 h-9 border border-[#cbd5e1] rounded-lg text-center font-semibold text-sm outline-none focus:border-[#e11d48]" /></div>; })}
              </div>
            )}
            <div className="pt-3 mt-1 border-t border-[#f1f5f9]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#475569]">Observación caja <span className="font-normal text-[#94a3b8]">(opcional)</span></label>
                <span className="text-[10px] font-semibold text-[#94a3b8]">{String(cajaEnEdicion.observacion || '').length}/60</span>
              </div>
              <input type="text" maxLength={60} value={cajaEnEdicion.observacion || ''} onChange={(e) => handleEdicionCampo('observacion', e.target.value.slice(0, 60))} placeholder="Observación breve de esta caja" className="w-full h-9 px-3 font-medium text-sm bg-white border border-[#cbd5e1] rounded-lg outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ffedd5] transition-colors" />
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#f1f5f9] mt-2">
              <button onClick={() => eliminarCajaGuardada(cajaIndexEdicion)} className="flex items-center gap-1.5 px-4 py-2 bg-[#fef2f2] text-[#e11d48] hover:bg-[#ffe4e6] font-semibold rounded-lg text-sm transition-colors"><Trash2 className="w-4 h-4" /> Eliminar caja</button>
              <div className="flex gap-3">
                <button onClick={() => setCajaEnEdicion(null)} className="px-5 py-2 bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] hover:text-[#0f172a] font-semibold rounded-lg text-sm transition-colors">Cancelar</button>
                <button onClick={guardarCambiosCajaEditada} className="px-6 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"><Check className="w-4 h-4" /> Aplicar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-md p-6 md:p-8 border border-[#e2e8f0]">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#fef2f2] text-[#e11d48] rounded-full flex items-center justify-center mb-5"><AlertTriangle className="w-7 h-7" /></div>
              <h3 className="text-xl font-bold text-[#0f172a] mb-2">Cancelar Inspección</h3>
              <p className="text-[#64748b] mb-8 text-sm leading-relaxed">{isColaborativo ? usuariosEnInspeccion > 1 ? <>La caja actual no se guardará y abandonarás esta inspección. El proceso <span className="font-bold text-[#0f172a]">continuará activo</span> para los demás usuarios.</> : <>La caja actual no se guardará. Si existen cajas guardadas, se conservarán en el historial y el proceso quedará <span className="font-bold text-[#e11d48]">Cancelado</span>. Si todavía está vacío, se eliminará automáticamente. En ambos casos podrás iniciar una nueva inspección.</> : <>¿Estás seguro de cancelar la inspección y volver al menú principal? Los datos de esta caja <span className="font-bold text-[#0f172a]">no se guardarán</span>.</>}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowModalCancelar(false)} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-[#334155] font-semibold hover:bg-[#f8fafc] text-sm transition-colors">Continuar editando</button>
                <button onClick={confirmarCancelarProceso} className="flex-1 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold shadow-sm text-sm transition-colors">Sí, salir</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModalFinalizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-md p-6 md:p-8 border border-[#e2e8f0]">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#fff7ed] text-[#ea580c] rounded-full flex items-center justify-center mb-5"><Check className="w-7 h-7" strokeWidth={3} /></div>
              <h3 className="text-xl font-bold text-[#0f172a] mb-2">Finalizar Inspección</h3>
              <p className="text-[#64748b] mb-4 text-sm leading-relaxed">¿Deseas concluir el registro de la inspección n° {numProceso} y sellar el proceso en el servidor?</p>
              {otrosInspectoresFinalizacion > 0 && <div className="w-full mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-left"><span className="font-bold">Atención:</span> hay {otrosInspectoresFinalizacion} usuario{otrosInspectoresFinalizacion === 1 ? '' : 's'} inspeccionando otra caja. Si finalizas, {otrosInspectoresFinalizacion === 1 ? 'recibirá' : 'recibirán'} un aviso y no {otrosInspectoresFinalizacion === 1 ? 'podrá' : 'podrán'} continuar.</div>}
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowModalFinalizar(false)} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-[#334155] font-semibold hover:bg-[#f8fafc] text-sm transition-colors">Revisar más</button>
                <button onClick={() => { setShowModalFinalizar(false); enviarInspeccionAlServidor(otrosInspectoresFinalizacion > 0); }} className={`flex-1 py-2.5 rounded-lg text-white font-semibold shadow-sm text-sm transition-colors ${otrosInspectoresFinalizacion > 0 ? 'bg-[#d97706] hover:bg-[#b45309]' : 'bg-[#059669] hover:bg-[#047857]'}`}>{otrosInspectoresFinalizacion > 0 ? 'Finalizar igualmente' : 'Sí, sellar proceso'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {procesoCerradoRemotamente && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/70 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 md:p-8 border border-red-200 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5"><AlertTriangle className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-[#0f172a] mb-2">{procesoCerradoRemotamente === 'Cancelado' ? 'Proceso cancelado por otro usuario' : 'Proceso finalizado por otro usuario'}</h3>
            <p className="text-[#64748b] text-sm leading-relaxed mb-7">El proceso n° <span className="font-bold text-[#0f172a]">{numProceso}</span> {procesoCerradoRemotamente === 'Cancelado' ? 'fue cancelado' : `ya fue cerrado (${procesoCerradoRemotamente})`}. La caja que estabas inspeccionando no puede continuar ni guardarse.</p>
            <button onClick={() => { limpiarBorrador(); if (onVolver) onVolver(); }} className="w-full py-3 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold shadow-sm text-sm transition-colors">Aceptar y volver</button>
          </div>
        </div>
      )}
      {/* === MODAL DE ÉXITO === */}
      {showModalExitoGuardado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-[#ffffff] rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] w-full max-w-sm p-6 md:p-8 text-center border border-[#e2e8f0]">
            <div className="w-20 h-20 bg-[#ecfdf5] text-[#059669] rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-black text-[#0f172a] mb-2 tracking-tight">¡Éxito!</h3>
            <p className="text-[#475569] mb-8 text-[15px] leading-relaxed">
              La inspección del proceso n° <span className="font-bold text-[#0f172a]">{numProceso}</span> ha sido finalizada y guardada correctamente.
            </p>
            <button
              onClick={() => {
                setShowModalExitoGuardado(false);
                if (onFinishedInspection) onFinishedInspection(parseInt(numProceso, 10));
              }}
              className="w-full py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-semibold shadow-md text-sm md:text-base transition-all active:scale-[0.98]"
            >
              Aceptar y Salir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';

import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const STOPWORDS_OBS=new Set(['de','del','la','las','el','los','un','una','unos','unas','en','con','por','para','y','o','a','al','se','que','muy','caja','cajas','fruta','presenta','presentan','observa','observan','aprecia','aprecian','detecta','detectan']);
const normalizarObs=texto=>String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ\s]/gi,' ').replace(/\s+/g,' ').trim();
const limpiarObs=texto=>String(texto||'').replace(/\s+/g,' ').trim().replace(/^(se\s+)?(observa|observan|aprecia|aprecian|detecta|detectan|presenta|presentan)\s+/i,'').replace(/^caja\s+(con|presenta)?\s*/i,'').replace(/[.;,:]+$/,'').trim();
const tokensObs=texto=>[...new Set(normalizarObs(texto).split(' ').filter(p=>p.length>2&&!STOPWORDS_OBS.has(p)))];
const similitudObs=(a,b)=>{const A=new Set(tokensObs(a)),B=new Set(tokensObs(b));if(!A.size||!B.size)return normalizarObs(a)===normalizarObs(b)?1:0;let inter=0;A.forEach(x=>{if(B.has(x))inter++;});const union=new Set([...A,...B]).size;return union?inter/union:0;};
const capitalizarObs=texto=>texto?texto.charAt(0).toUpperCase()+texto.slice(1):texto;
const analizarObservaciones=cajas=>{const registros=(Array.isArray(cajas)?cajas:[]).map((caja,index)=>({numCaja:caja.numero??caja.numCaja??index+1,texto:limpiarObs(caja.observacion)})).filter(x=>x.texto);if(!registros.length)return '';const grupos=[];registros.forEach(reg=>{let mejor=null,mejorScore=0;grupos.forEach(grupo=>{const score=similitudObs(reg.texto,grupo.representante);if(score>mejorScore){mejor=grupo;mejorScore=score;}});if(mejor&&(mejorScore>=0.5||normalizarObs(mejor.representante)===normalizarObs(reg.texto))){mejor.items.push(reg);if(reg.texto.length<mejor.representante.length)mejor.representante=reg.texto;}else grupos.push({representante:reg.texto,items:[reg]});});grupos.sort((a,b)=>b.items.length-a.items.length||a.representante.localeCompare(b.representante,'es'));const principales=grupos.slice(0,3);let resumen;if(principales.some(g=>g.items.length>1))resumen=principales.map(g=>`${capitalizarObs(g.representante)}${g.items.length>1?` (${g.items.length} cajas)`:''}`).join('; ');else resumen=`Observaciones puntuales: ${principales.map(g=>limpiarObs(g.representante).toLowerCase()).join('; ')}`;if(grupos.length>3)resumen+=`; además ${grupos.length-3} observación${grupos.length-3===1?'':'es'} adicional${grupos.length-3===1?'':'es'}`;resumen=resumen.replace(/\s+/g,' ').trim();if(!/[.!?]$/.test(resumen))resumen+='.';return resumen.length>180?`${resumen.slice(0,177).trimEnd()}...`:resumen;};

const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';
const API_URL = window.location.hostname.includes('goldanda.cl')
  ? 'https://evap.maq.goldanda.cl'
  : `http://${window.location.hostname || 'localhost'}:3001`;

const numeroParametro = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const nivelPorLimite = (pct, lim1, lim2) => {
  if (lim1 === null || lim2 === null) return 1;
  return pct > lim2 ? 3 : pct > lim1 ? 2 : 1;
};

// Función para capitalizar la primera letra de cada palabra (Title Case)

const formatearNombre = (texto) => {

  if (!texto || texto === '-') return '-';

  return texto

    .toLowerCase()

    .split(' ')

    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))

    .join(' ');

};

// ================= CORRECCIÓN BUG HORA =================

const formatearHora = (horaIsoStr) => {

  if (!horaIsoStr) return null;

  try {

    const d = new Date(horaIsoStr);

    if (isNaN(d.getTime())) return null;

    // Al guardar en PostgreSQL sin TimeZone, Node sumó horas extra al enviarla al navegador.

    // Para revertirlo y mostrar la hora real, restamos el desfase exacto del navegador local.

    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true });

  } catch (e) {

    return null;

  }

};

// ================= COMPONENTE ENCABEZADO DE MÓDULO =================

const TituloModulo = ({ numero, titulo, width = "w-[120px]" }) => (

  <div className="relative pb-1.5 mb-2 border-b border-slate-100 flex items-center shrink-0">

    <div className={`absolute left-0 bottom-[-1px] h-[2px] ${width} bg-orange-500`}></div>

    <div className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold mr-2 shrink-0">

      {numero}.

    </div>

    <h3 className="text-xs font-black text-slate-800">{titulo}</h3>

  </div>

);

// ================= COMPONENTE DE GRÁFICO DE DONA =================

const Donut = ({ percentage, color, label, pillColor }) => {

  const strokeDasharray = `${percentage} ${100 - percentage}`;

  return (

    <div className="flex flex-col items-center justify-center w-full">

      <span className="text-[11px] text-slate-800 mb-1 font-black">{label}</span>

      <div className="relative w-[82px] h-[82px]">

        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">

          <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />

          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={strokeDasharray} strokeLinecap="round" />

        </svg>

        <div className="absolute inset-0 flex items-center justify-center font-black text-slate-800 text-[16px]">

          {percentage.toFixed(1).replace('.', ',')}%

        </div>

      </div>

      <div className="w-6 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: pillColor || color, opacity: 0.3 }}></div>

    </div>

  );

};

// ================= COMPONENTE DE BARRA DE DEFECTO =================

const DefectoBar = ({ label, value, type }) => {

  const isZero = value === 0;

  const barColor = type === 'calidad' ? '#f97316' : '#ef4444'; 

  return (

    <div className="flex flex-col gap-1 w-full">

      <div className="flex justify-between text-[10px] items-center">

        <span className={isZero ? "text-slate-400" : "text-slate-700 font-bold"}>{label}</span>

        <span className={isZero ? "text-slate-300" : "font-black text-slate-900"}>{value.toFixed(1).replace('.', ',')}%</span>

      </div>

      <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">

        <div className="h-full rounded-full" style={{ width: `${value > 0 ? Math.max(value * 3, 5) : 0}%`, backgroundColor: barColor }}></div>

      </div>

    </div>

  );

};

// ================= PLANTILLA PRINCIPAL =================

const PlantillaInforme = React.forwardRef(({ datos, parametros: parametrosProp }, ref) => {
  const [parametrosActuales, setParametrosActuales] = useState({ calidad: [], condicion: [] });
  const snapshot = datos?.parametrosSnapshot || datos?.parametros_snapshot || null;
  const tieneSnapshot = !!(snapshot?.calidad?.length || snapshot?.condicion?.length);

  useEffect(() => {
    if (tieneSnapshot || parametrosProp) return;
    fetch(`${API_URL}/api/parametros`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setParametrosActuales({
        calidad: Array.isArray(data?.calidad) ? data.calidad : [],
        condicion: Array.isArray(data?.condicion) ? data.condicion : []
      }))
      .catch(() => setParametrosActuales({ calidad: [], condicion: [] }));
  }, [tieneSnapshot, parametrosProp]);

  if (!datos) return null;

  const parametros = tieneSnapshot ? snapshot : (parametrosProp || parametrosActuales);
  const parametrosCalidad = Array.isArray(parametros?.calidad) ? parametros.calidad : [];
  const parametrosCondicion = Array.isArray(parametros?.condicion) ? parametros.condicion : [];
  const defectosCalidad = parametrosCalidad.filter(p => p.nombre && p.nombre !== SUM_CALIDAD);
  const defectosCondicion = parametrosCondicion.filter(p => p.nombre && p.nombre !== SUM_CONDICION);

  // 1. FORMATEO DE VARIABLES PRINCIPALES

  const numProceso = datos.numProceso || datos.id || '-';

  const exportadora = datos.exportadora || '-';

  const planta = datos.planta || 'Maquehua';

  const csg = datos.csg || '-';

  const variedad = datos.variedad || '-';
  const fotoLight = typeof (datos.fotoLight ?? datos.foto_light) === 'string' && (datos.fotoLight ?? datos.foto_light).startsWith('data:image/') ? (datos.fotoLight ?? datos.foto_light) : null;
  const fotoDark = typeof (datos.fotoDark ?? datos.foto_dark) === 'string' && (datos.fotoDark ?? datos.foto_dark).startsWith('data:image/') ? (datos.fotoDark ?? datos.foto_dark) : null;

  const productorRaw = datos.productor || datos.huerto || '-';

  const huertoRaw = datos.huerto || datos.productor || '-';

  const productor = formatearNombre(productorRaw);

  const huerto = formatearNombre(huertoRaw);

  let fechaStr = '-';

  const fechaRaw = datos.created_at || datos.createdAt || datos.fecha || datos.fecha_creacion || datos.date;

  if (fechaRaw) {

    try {

      const d = new Date(fechaRaw);

      if (!isNaN(d.getTime())) {

        fechaStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

      }

    } catch (e) {}

  }

  // === GENERACIÓN DEL FORMATO DE HORA (Inicio - Fin) ===

  const inicioStr = formatearHora(datos.horaInicio);

  const finStr = formatearHora(datos.horaFin);

  const horaInspeccion = (inicioStr && finStr) ? `${inicioStr} - ${finStr}` : '-';

  // 2. CÁLCULO DE DATOS MATEMÁTICOS
  const cajas = Array.isArray(datos.cajas) ? datos.cajas : [];
  const resumenObservacionesCajas = analizarObservaciones(cajas);
  let totalFrutos = 0, totalCal = 0, totalCond = 0;
  let sumBrixLight = 0, countLight = 0, sumBrixDark = 0, countDark = 0;
  const acumuladoCal = Object.fromEntries(defectosCalidad.map(p => [p.nombre, 0]));
  const acumuladoCond = Object.fromEntries(defectosCondicion.map(p => [p.nombre, 0]));
  const brixCount = { '< 14': { Light: 0, Dark: 0 }, '14 - 16': { Light: 0, Dark: 0 }, '16 - 18': { Light: 0, Dark: 0 }, '> 18': { Light: 0, Dark: 0 } };

  cajas.forEach(c => {
    totalFrutos += parseInt(c.frutos) || 0;

    Object.entries(c.defCalidad || {}).forEach(([nombre, cantidad]) => {
      if (nombre === SUM_CALIDAD) return;
      const v = parseInt(cantidad) || 0;
      totalCal += v;
      acumuladoCal[nombre] = (acumuladoCal[nombre] || 0) + v;
    });

    Object.entries(c.defCondicion || {}).forEach(([nombre, cantidad]) => {
      if (nombre === SUM_CONDICION) return;
      const v = parseInt(cantidad) || 0;
      totalCond += v;
      acumuladoCond[nombre] = (acumuladoCond[nombre] || 0) + v;
    });

    if (c.brix && parseFloat(c.brix) > 0) {
      const b = parseFloat(c.brix);
      const rango = b < 14 ? '< 14' : b < 16 ? '14 - 16' : b <= 18 ? '16 - 18' : '> 18';
      if (c.color === 'Light') { sumBrixLight += b; countLight++; brixCount[rango].Light++; }
      if (c.color === 'Dark') { sumBrixDark += b; countDark++; brixCount[rango].Dark++; }
    }
  });

  const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
  const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
  const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;

  const getLimitesCalidad = nombre => {
    const p = parametrosCalidad.find(x => x.nombre === nombre);
    return p ? { lim1: numeroParametro(p.limAB), lim2: numeroParametro(p.limBC) } : { lim1: null, lim2: null };
  };

  const getLimitesCondicion = nombre => {
    const p = parametrosCondicion.find(x => x.nombre === nombre);
    return p ? { lim1: numeroParametro(p.lim12), lim2: numeroParametro(p.lim23) } : { lim1: null, lim2: null };
  };

  let nivelCalidad = 1, nivelCondicion = 1;
  const parametrosDisponibles = parametrosCalidad.length > 0 && parametrosCondicion.length > 0;

  if (totalFrutos && parametrosDisponibles) {
    const limSumCal = getLimitesCalidad(SUM_CALIDAD);
    nivelCalidad = Math.max(nivelCalidad, nivelPorLimite(pCal, limSumCal.lim1, limSumCal.lim2));
    defectosCalidad.forEach(p => {
      const pct = ((acumuladoCal[p.nombre] || 0) / totalFrutos) * 100;
      const lim = getLimitesCalidad(p.nombre);
      nivelCalidad = Math.max(nivelCalidad, nivelPorLimite(pct, lim.lim1, lim.lim2));
    });

    const limSumCond = getLimitesCondicion(SUM_CONDICION);
    nivelCondicion = Math.max(nivelCondicion, nivelPorLimite(pCond, limSumCond.lim1, limSumCond.lim2));
    defectosCondicion.forEach(p => {
      const pct = ((acumuladoCond[p.nombre] || 0) / totalFrutos) * 100;
      const lim = getLimitesCondicion(p.nombre);
      nivelCondicion = Math.max(nivelCondicion, nivelPorLimite(pct, lim.lim1, lim.lim2));
    });
  }

  const notaGuardada = [datos.nota, datos.estado, datos.nota_estado]
    .map(v => String(v || '').trim().toUpperCase())
    .find(v => /^[ABC][123]$/.test(v));
  const notaCalculada = totalFrutos && parametrosDisponibles
    ? `${nivelCalidad === 3 ? 'C' : nivelCalidad === 2 ? 'B' : 'A'}${nivelCondicion}`
    : null;
  const nota = notaCalculada || notaGuardada || '-';
  const estado = nota !== '-'
    ? (nota.includes('C') || nota.includes('3') ? 'Objetado' : 'Aprobado')
    : (datos.estado === 'Objetado' ? 'Objetado' : 'Aprobado');

  const promLight = countLight ? (sumBrixLight / countLight).toFixed(1).replace('.', ',') : '0,0';
  const promDark = countDark ? (sumBrixDark / countDark).toFixed(1).replace('.', ',') : '0,0';

  // Mantiene defectos históricos aunque ya no estén activos en el catálogo actual.
  const nombresCalidad = [...new Set([...defectosCalidad.map(p => p.nombre), ...Object.keys(acumuladoCal)])];
  const nombresCondicion = [...new Set([...defectosCondicion.map(p => p.nombre), ...Object.keys(acumuladoCond)])];
  const arrDefCal = nombresCalidad.map(label => {
    const v = totalFrutos ? ((acumuladoCal[label] || 0) / totalFrutos) * 100 : 0;
    const lim = getLimitesCalidad(label);
    return { label, v, nivel: nivelPorLimite(v, lim.lim1, lim.lim2), ...lim };
  });
  const arrDefCond = nombresCondicion.map(label => {
    const v = totalFrutos ? ((acumuladoCond[label] || 0) / totalFrutos) * 100 : 0;
    const lim = getLimitesCondicion(label);
    return { label, v, nivel: nivelPorLimite(v, lim.lim1, lim.lim2), ...lim };
  });

  const brixDataArr = [
    { name: '< 14', Light: countLight ? (brixCount['< 14'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['< 14'].Dark / countDark) * 100 : 0 },
    { name: '14 - 16', Light: countLight ? (brixCount['14 - 16'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['14 - 16'].Dark / countDark) * 100 : 0 },
    { name: '16 - 18', Light: countLight ? (brixCount['16 - 18'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['16 - 18'].Dark / countDark) * 100 : 0 },
    { name: '> 18', Light: countLight ? (brixCount['> 18'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['> 18'].Dark / countDark) * 100 : 0 }
  ];

  // Motivos de calificación: SOLO reglas que efectivamente superan los límites
  // definidos en el snapshot de Parámetros del proceso (o en Parámetros actuales
  // cuando no existe snapshot). Nunca se usa un defecto solo por tener incidencia.
  const nivelNotaCalidad = nota && /^[ABC][123]$/.test(nota)
    ? (nota[0] === 'C' ? 3 : nota[0] === 'B' ? 2 : 1)
    : 1;
  const nivelNotaCondicion = nota && /^[ABC][123]$/.test(nota)
    ? Number(nota[1])
    : 1;

  // Los motivos se obtienen contra el límite que explica la calificación final,
  // no por incidencia. Para A2 se compara contra A1→A2 y para A3 contra A1→A3.
  const crearMotivoSegunNota = (label, v, lim1, lim2, tipo) => {
    let limite = null;
    let textoLimite = '';
    let nivelObjetivo = 1;

    if (tipo === 'condicion') {
      if (nivelNotaCondicion === 2) {
        limite = lim1;
        nivelObjetivo = 2;
        textoLimite = 'límite A1→A2';
      } else if (nivelNotaCondicion === 3) {
        limite = lim2;
        nivelObjetivo = 3;
        textoLimite = 'límite A1→A3';
      } else return null;
    } else {
      if (nivelNotaCalidad === 2) {
        limite = lim1;
        nivelObjetivo = 2;
        textoLimite = 'límite A→B';
      } else if (nivelNotaCalidad === 3) {
        limite = lim2;
        nivelObjetivo = 3;
        textoLimite = 'límite A→C';
      } else return null;
    }

    if (limite === null || limite === undefined || !(v > limite)) return null;
    return { label, v, nivel: nivelObjetivo, tipo, limite, exceso: v - limite, textoLimite };
  };

  const candidatosMotivos = [
    ...arrDefCal.map(d => crearMotivoSegunNota(d.label, d.v, d.lim1, d.lim2, 'calidad')),
    ...arrDefCond.map(d => crearMotivoSegunNota(d.label, d.v, d.lim1, d.lim2, 'condicion'))
  ].filter(Boolean);

  const motivosPrincipales = candidatosMotivos.sort((a, b) => b.exceso - a.exceso || b.v - a.v).slice(0, 2);
  const tituloMotivosCalificacion = 'Disminución de calificación por:';

  return (

    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .informe-inter, .informe-inter * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
      `}</style>
      <div ref={ref} className="informe-inter bg-white px-2 pt-3 pb-3 text-slate-800 flex flex-col box-border" style={{ width: '816px', height: '1056px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'geometricPrecision', fontSynthesis: 'none' }}>

      {/* ENCABEZADO */}

      <div className="flex justify-between items-center mb-2.5 shrink-0 px-2">

        <div className="flex items-center gap-3">

          <div className="w-1.5 h-10 bg-orange-500 rounded-full"></div>

          <div>

            <h1 className="text-[22px] font-black text-slate-800">Informe resumen inspección de calidad</h1>

            <h2 className="text-orange-500 font-bold text-base mt-0.5">

              Proceso N°. {numProceso} 

              <span className="text-slate-300 mx-2">|</span> 

              <span className="text-slate-500">Productor:</span> <span className="text-slate-700">{productor}</span>

            </h2>

          </div>

        </div>

        <div className="flex flex-col items-end gap-1">

          <img src="/Logo_goldanda.png" alt="Logo Empresa" crossOrigin="anonymous" className="h-11 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />

        </div>

      </div>

      {/* 1. INFORMACIÓN GENERAL CON NUEVO CAMPO "HORA INSPECCIÓN" */}

      <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-2 shadow-sm shrink-0">

        <TituloModulo numero="1" titulo="Información general" width="w-[140px]" />

        <div className="grid grid-cols-4 gap-y-2 gap-x-4">

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Fecha de proceso</p>

            <p className="font-bold text-xs text-slate-700">{fechaStr}</p>

          </div>

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Exportadora</p>

            <p className="font-bold text-xs text-slate-700 truncate">{exportadora}</p>

          </div>

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Planta</p>

            <p className="font-bold text-xs text-slate-700">{planta}</p>

          </div>

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">CSG</p>

            <p className="font-bold text-xs text-slate-700">{csg}</p>

          </div>

          <div className="col-span-1">

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Huerto</p>

            <p className="font-bold text-xs text-slate-700 truncate">{huerto}</p>

          </div>

          <div className="col-span-1">

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Hora Inspección</p>

            <p className="font-bold text-xs text-slate-700 truncate">{horaInspeccion}</p>

          </div>

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Variedad</p>

            <p className="font-bold text-xs text-slate-700">{variedad}</p>

          </div>

          <div>

            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Cajas Analizadas</p>

            <p className="font-bold text-xs text-slate-700">{cajas.length}</p>

          </div>

        </div>

      </div>

      {/* 2. RESUMEN DE CALIDAD E IMÁGENES */}

      <div className="flex gap-3 mb-2 shrink-0 items-stretch">

        {/* Lado Izquierdo: Resumen general */}

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 w-[40%] shadow-sm flex flex-col justify-between">

          <TituloModulo numero="2" titulo="Resumen general" width="w-[120px]" />

          {/* BANNER VERDE */}

          <div className={`${estado === 'Objetado' ? 'bg-red-50/50 border-red-100 divide-red-100' : 'bg-emerald-50/40 border-emerald-100 divide-emerald-100'} border-2 rounded-xl py-[18px] flex justify-between items-center w-full mb-1 shrink-0 divide-x`}>

            <div className="flex flex-col items-center justify-center flex-1 gap-1 px-1">

              <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider">Calificación</p>

              <p className={`${estado === 'Objetado' ? 'text-red-600' : 'text-[#00A859]'} font-black text-base leading-none`}>{nota}</p>

            </div>

            <div className="flex flex-col items-center justify-center flex-1 gap-1 px-1">

              <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider">Estado</p>

              <p className={`${estado === 'Objetado' ? 'text-red-600' : 'text-[#00A859]'} font-black text-base leading-none`}>{estado}</p>

            </div>

            <div className="flex flex-col items-center justify-center flex-1 gap-1 px-1">

              <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider">S.S. Light</p>

              <p className={`${estado === 'Objetado' ? 'text-red-600' : 'text-[#00A859]'} font-black text-base leading-none`}>{promLight}</p>

            </div>

            <div className="flex flex-col items-center justify-center flex-1 gap-1 px-1">

              <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider">S.S. Dark</p>

              <p className={`${estado === 'Objetado' ? 'text-red-600' : 'text-[#00A859]'} font-black text-base leading-none`}>{promDark}</p>

            </div>

          </div>

          <div className="flex justify-around items-center flex-1 divide-x divide-slate-100">

            <Donut percentage={pExp} color={pExp >= 90 ? "#00A859" : "#ef4444"} label="Exportable" pillColor={pExp >= 90 ? "#86efac" : "#fca5a5"} />

            <Donut percentage={pCal} color="#f97316" label="Calidad" pillColor="#fdba74" />

            <Donut percentage={pCond} color="#ef4444" label="Condición" pillColor="#fca5a5" />

          </div>

        </div>

        {/* Lado Derecho: Imágenes */}

        <div className="flex gap-3 w-[60%] justify-center">

          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex-1 shadow-sm flex flex-col">

            <h3 className="text-[11px] font-black text-slate-800 mb-1.5 shrink-0">Embalaje Light</h3>

            <div className="flex-1 w-full border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center text-slate-400 bg-slate-50/50 min-h-[275px]">
              {fotoLight ? (
                <img src={fotoLight} alt="Embalaje Light" decoding="sync" className="w-full h-full min-h-[275px] object-contain" style={{ imageRendering: 'auto' }} />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2"/><path d="m21 15-5-5L5 21" strokeWidth="2"/>
                  </svg>
                  <span className="text-[10px] font-bold">Sin imagen</span>
                </div>
              )}
            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex-1 shadow-sm flex flex-col">

            <h3 className="text-[11px] font-black text-slate-800 mb-1.5 shrink-0">Embalaje Dark</h3>

            <div className="flex-1 w-full border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center text-slate-400 bg-slate-50/50 min-h-[275px]">
              {fotoDark ? (
                <img src={fotoDark} alt="Embalaje Dark" decoding="sync" className="w-full h-full min-h-[275px] object-contain" style={{ imageRendering: 'auto' }} />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2"/><path d="m21 15-5-5L5 21" strokeWidth="2"/>
                  </svg>
                  <span className="text-[10px] font-bold">Sin imagen</span>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* 3. DEFECTOS DE CALIDAD */}

      <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-2 shadow-sm shrink-0">

        <TituloModulo numero="3" titulo="Principales defectos de calidad" width="w-[200px]" />

        <div className="grid grid-cols-4 gap-x-4 gap-y-2">

          {arrDefCal.map((def, i) => (

            <DefectoBar key={i} label={def.label} value={def.v} type="calidad" />

          ))}

        </div>

      </div>

      {/* 4. DEFECTOS DE CONDICIÓN */}

      <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-2 shadow-sm shrink-0">

        <TituloModulo numero="4" titulo="Principales defectos de condición" width="w-[200px]" />

        <div className="grid grid-cols-4 gap-x-4 gap-y-2">

          {arrDefCond.map((def, i) => (

            <DefectoBar key={i} label={def.label} value={def.v} type="condicion" />

          ))}

        </div>

      </div>

      {/* 5 y 6. SÓLIDOS SOLUBLES Y OBSERVACIONES */}

      <div className="flex gap-3 shrink-0 mt-auto">

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex-[1] shadow-sm flex flex-col h-[140px]">

          <TituloModulo numero="5" titulo="Distribución de sólidos solubles (°Brix)" width="w-[240px]" />

          <div className="flex-1 w-full min-h-[60px]">

            <ResponsiveContainer width="100%" height="100%">

              {/* padding: 12px distribuye las etiquetas más cerca del borde, y left: -35 elimina el desfase del Eje Y */}

              <BarChart data={brixDataArr} margin={{ top: 15, right: 5, left: -35, bottom: -5 }}>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'Inter, sans-serif', fontWeight: 500 }} tickMargin={5} interval={0} padding={{ left: 12, right: 12 }} />

                <Bar dataKey="Light" fill="#fca5a5" isAnimationActive={false} barSize={16} radius={[2,2,0,0]} 

                  label={{ position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif', formatter: (val) => val > 0 ? `${parseFloat(val).toFixed(0)}%` : '' }} 

                />

                <Bar dataKey="Dark" fill="#650a0a" isAnimationActive={false} barSize={16} radius={[2,2,0,0]} 

                  label={{ position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif', formatter: (val) => val > 0 ? `${parseFloat(val).toFixed(0)}%` : '' }} 

                />

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="flex justify-center gap-4 mt-0.5 text-[10px] text-slate-500 shrink-0 font-bold">

            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#fca5a5] rounded-sm"></div> Light</div>

            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[#650a0a] rounded-sm"></div> Dark</div>

          </div>

        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex-[1.2] shadow-sm flex flex-col h-[140px]">

          <TituloModulo numero="6" titulo="Observaciones" width="w-[100px]" />

          <div className="bg-orange-50/60 border border-orange-100/80 rounded-lg p-2.5 text-[11px] text-slate-700 flex-1 overflow-hidden flex flex-col justify-start">

            {motivosPrincipales.length > 0 ? (
              <div className="px-1 text-[10px] leading-[1.35]">
                <p className="text-slate-800"><span className="font-bold text-orange-800">{tituloMotivosCalificacion}</span>{' '}{motivosPrincipales.map((motivo,idx)=><React.Fragment key={`${motivo.label}-${idx}`}><span className="font-semibold">{motivo.label}</span>{' '}<span className="font-bold text-orange-600">{motivo.v.toFixed(1).replace('.',',')}%</span>{idx<motivosPrincipales.length-1?'; ':'.'}</React.Fragment>)}</p>
                {resumenObservacionesCajas&&<p className="mt-1 pt-1 border-t border-orange-100 text-slate-800 break-words"><span className="font-bold text-orange-800">Resumen observaciones:</span>{' '}<span className="font-medium">{resumenObservacionesCajas}</span></p>}
              </div>
            ) : (

              <div className="text-emerald-700 text-center px-1">

                <p className="font-bold text-[11px] leading-snug">Proceso conforme según normativa de calidad.</p>

              </div>

            )}

          </div>

        </div>

      </div>

      </div>
    </>

  );

});

export default PlantillaInforme;
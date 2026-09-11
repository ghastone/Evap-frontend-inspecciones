import React, { useState, useEffect } from 'react';

export default function EvaluacionInspeccion({ 
  datosProceso, 
  onFinalizar, 
  onCancelar,
  parametrosCalidad = [],
  parametrosCondicion = []
}) {
  const [cajaActual, setCajaActual] = useState(1);
  const [cajasGuardadas, setCajasGuardadas] = useState([]);

  const [cajaInfo, setCajaInfo] = useState({ numFrutos: '', colorEmbalaje: '', brix: '' });
  const [defectosCalidad, setDefectosCalidad] = useState({});
  const [defectosCondicion, setDefectosCondicion] = useState({});

  const handleDefectoCalidadChange = (defecto, valor) => {
    setDefectosCalidad({ ...defectosCalidad, [defecto]: valor });
  };

  const handleDefectoCondicionChange = (defecto, valor) => {
    setDefectosCondicion({ ...defectosCondicion, [defecto]: valor });
  };

  const calcularTotalDefectos = (defectosObj) => {
    return Object.values(defectosObj).reduce((acc, curr) => acc + (parseInt(curr, 10) || 0), 0);
  };

  const totalFrutosCaja = parseInt(cajaInfo.numFrutos, 10) || 0;
  const totalCalidadCaja = calcularTotalDefectos(defectosCalidad);
  const totalCondicionCaja = calcularTotalDefectos(defectosCondicion);
  
  const pctCalidadCaja = totalFrutosCaja > 0 ? (totalCalidadCaja / totalFrutosCaja * 100) : 0;
  const pctCondicionCaja = totalFrutosCaja > 0 ? (totalCondicionCaja / totalFrutosCaja * 100) : 0;
  const pctExportableCaja = totalFrutosCaja > 0 ? (100 - pctCalidadCaja - pctCondicionCaja) : 100;

  const formatoCaja = (cantidad) => {
    if (totalFrutosCaja === 0 || !cantidad) return "0,0%";
    return ((parseInt(cantidad, 10) / totalFrutosCaja) * 100).toFixed(1).replace('.', ',') + "%";
  };

  let sumBrixLight = 0, countLight = 0;
  let sumBrixDark = 0, countDark = 0;
  let totalFrutosAcc = 0;

  const contadorDefectosCalidadAcc = {};
  const contadorDefectosCondicionAcc = {};

  const acumularDefectos = (origen, destino) => {
    Object.entries(origen).forEach(([def, val]) => {
      const num = parseInt(val, 10) || 0;
      destino[def] = (destino[def] || 0) + num;
    });
  };

  // Sumar histórico de cajas anteriores
  cajasGuardadas.forEach(c => {
    const brix = parseFloat(c.brix) || 0;
    if (c.colorEmbalaje === 'Light' && brix > 0) { sumBrixLight += brix; countLight++; }
    if (c.colorEmbalaje === 'Dark' && brix > 0) { sumBrixDark += brix; countDark++; }

    totalFrutosAcc += parseInt(c.numFrutos, 10) || 0;
    acumularDefectos(c.defectosCalidad || {}, contadorDefectosCalidadAcc);
    acumularDefectos(c.defectosCondicion || {}, contadorDefectosCondicionAcc);
  });

  // Sumar la caja actual en pantalla (en tiempo real)
  const brixActual = parseFloat(cajaInfo.brix) || 0;
  if (cajaInfo.colorEmbalaje === 'Light' && brixActual > 0) { sumBrixLight += brixActual; countLight++; }
  if (cajaInfo.colorEmbalaje === 'Dark' && brixActual > 0) { sumBrixDark += brixActual; countDark++; }

  totalFrutosAcc += totalFrutosCaja;
  acumularDefectos(defectosCalidad, contadorDefectosCalidadAcc);
  acumularDefectos(defectosCondicion, contadorDefectosCondicionAcc);

  const promLight = countLight > 0 ? (sumBrixLight / countLight).toFixed(1) : '0.0';
  const promDark = countDark > 0 ? (sumBrixDark / countDark).toFixed(1) : '0.0';

  const sumTotalCalidadAcc = Object.values(contadorDefectosCalidadAcc).reduce((a, b) => a + b, 0);
  const sumTotalCondicionAcc = Object.values(contadorDefectosCondicionAcc).reduce((a, b) => a + b, 0);

  const pctCalidadAcc = totalFrutosAcc > 0 ? (sumTotalCalidadAcc / totalFrutosAcc * 100) : 0;
  const pctCondicionAcc = totalFrutosAcc > 0 ? (sumTotalCondicionAcc / totalFrutosAcc * 100) : 0;
  const pctExportableAcc = totalFrutosAcc > 0 ? (100 - pctCalidadAcc - pctCondicionAcc) : 100;

  const cajasAnalizadasTotal = cajasGuardadas.length + (totalFrutosCaja > 0 ? 1 : 0);

  // Lógica de calificación
  let notaCalidad = 'A';
  let notaCondicion = '1';

  if (totalFrutosAcc > 0) {
    let esC_Calidad = false;
    let esB_Calidad = false;

    parametrosCalidad.forEach(p => {
      const cantidad = p.esSumatoria ? sumTotalCalidadAcc : (contadorDefectosCalidadAcc[p.nombre] || 0);
      const pct = (cantidad / totalFrutosAcc) * 100;

      if (pct > p.limBC) esC_Calidad = true;
      else if (pct >= p.limAB) esB_Calidad = true;
    });

    if (esC_Calidad) notaCalidad = 'C';
    else if (esB_Calidad) notaCalidad = 'B';
    else notaCalidad = 'A';

    let es3_Condicion = false;
    let es2_Condicion = false;

    parametrosCondicion.forEach(p => {
      const cantidad = p.esSumatoria ? sumTotalCondicionAcc : (contadorDefectosCondicionAcc[p.nombre] || 0);
      const pct = (cantidad / totalFrutosAcc) * 100;

      if (pct > p.lim23) es3_Condicion = true;
      else if (pct >= p.lim12) es2_Condicion = true;
    });

    if (es3_Condicion) notaCondicion = '3';
    else if (es2_Condicion) notaCondicion = '2';
    else notaCondicion = '1';
  }

  const notaFinalCombined = `${notaCalidad}${notaCondicion}`;
  const esObjetado = notaCalidad === 'C' || notaCondicion === '3';
  const estadoFinalText = esObjetado ? 'Objetado' : 'Aprobado';

  // ---> TRANSMISIÓN EN TIEMPO REAL AL MONITOR <---
  useEffect(() => {
    const channel = new BroadcastChannel('qc_dashboard_sync');
    
    const formatTop = (contador, parametros, limiteType1, limiteType2) => {
      return Object.entries(contador)
        .map(([nombre, cantidad]) => {
           const param = parametros.find(p => p.nombre === nombre);
           if(!param) return null;
           const pct = totalFrutosAcc > 0 ? (cantidad / totalFrutosAcc) * 100 : 0;
           return { nombre, pct, lim1: param[limiteType1], lim2: param[limiteType2] };
        })
        .filter(item => item !== null && item.pct > 0)
        .sort((a, b) => b.pct - a.pct); 
    };

    const topCal = formatTop(contadorDefectosCalidadAcc, parametrosCalidad, 'limAB', 'limBC');
    const topCond = formatTop(contadorDefectosCondicionAcc, parametrosCondicion, 'lim12', 'lim23');

    const safeTopCal = topCal.length > 0 ? topCal : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }];
    const safeTopCond = topCond.length > 0 ? topCond : [{ nombre: 'Sin registros', pct: 0, lim1: 0, lim2: 0 }];

    const payload = {
      numProceso: datosProceso?.numProceso || '1',
      huerto: datosProceso?.huerto || 'Desconocido',
      variedad: datosProceso?.variedad || 'Desconocida',
      cajasEvaluadas: cajasAnalizadasTotal,
      exportable: pctExportableAcc,
      pctCalidad: pctCalidadAcc,
      pctCondicion: pctCondicionAcc,
      estado: estadoFinalText,
      calificacion: notaFinalCombined,
      solidos: {
        light: { prom: parseFloat(promLight), count: countLight },
        dark: { prom: parseFloat(promDark), count: countDark }
      },
      topCalidad: safeTopCal,
      topCondicion: safeTopCond
    };

    // GUARDAMOS EN LOCALSTORAGE PRIMERO PARA EVITAR LA CONDICIÓN DE CARRERA
    localStorage.setItem('qc_live_data', JSON.stringify(payload));
    
    // Y LUEGO EMITIMOS AL CANAL PARA LA ACTUALIZACIÓN EN VIVO
    channel.postMessage(payload);

    return () => channel.close();
  });

  const handleGuardarNuevaCaja = () => {
    if (!cajaInfo.numFrutos) {
      alert("Debes ingresar la cantidad de frutos de muestra (N° frutos) para evaluar la caja.");
      return;
    }

    setCajasGuardadas([
      ...cajasGuardadas,
      {
        numero: cajaActual,
        ...cajaInfo,
        defectosCalidad,
        defectosCondicion
      }
    ]);

    setCajaActual(cajaActual + 1);
    setCajaInfo({ numFrutos: '', colorEmbalaje: '', brix: '' });
    setDefectosCalidad({});
    setDefectosCondicion({});
  };

  return (
    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100 max-w-6xl mx-auto space-y-6">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Inspección producto terminado</h2>
      </div>

      <div className="bg-[#FF5500] text-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-base mb-3">Acumulado de proceso</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-y-3 text-sm">
          <div><span className="opacity-80">Proceso:</span> <strong className="ml-1">{datosProceso?.numProceso || '1'}</strong></div>
          <div><span className="opacity-80">Cajas analizadas:</span> <strong className="ml-1">{cajasAnalizadasTotal}</strong></div>
          <div><span className="opacity-80">Sólidos (L/D):</span> <strong className="ml-1">{promLight.replace('.', ',')} / {promDark.replace('.', ',')}</strong></div>
          <div><span className="opacity-80">Def. calidad:</span> <strong className="ml-1">{pctCalidadAcc.toFixed(1).replace('.', ',')}%</strong></div>
          <div><span className="opacity-80">Def. condición:</span> <strong className="ml-1">{pctCondicionAcc.toFixed(1).replace('.', ',')}%</strong></div>
          
          <div><span className="opacity-80">Muestra (Und):</span> <strong className="ml-1">{totalFrutosAcc}</strong></div>
          <div><span className="opacity-80">Exportable:</span> <strong className="ml-1">{pctExportableAcc.toFixed(1).replace('.', ',')}%</strong></div>
          <div><span className="opacity-80">Nota:</span> <strong className="ml-1">{notaFinalCombined}</strong></div>
          <div><span className="opacity-80">Estado:</span> <strong className="ml-1">{estadoFinalText}</strong></div>
        </div>
      </div>

      <div className="border border-slate-200/70 rounded-2xl p-5 space-y-5">
        <h3 className="text-lg font-medium text-slate-700">
          Evaluando caja N°: <span className="font-bold text-[#FF5500] text-xl">{cajaActual}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pb-2">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Muestra (N° frutos):</label>
            <input
              type="number"
              min="1"
              value={cajaInfo.numFrutos}
              onChange={(e) => setCajaInfo({ ...cajaInfo, numFrutos: e.target.value })}
              placeholder="N° frutos"
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-full px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">Color embalaje:</label>
            <select
              value={cajaInfo.colorEmbalaje}
              onChange={(e) => setCajaInfo({ ...cajaInfo, colorEmbalaje: e.target.value })}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            >
              <option value="">Seleccionar...</option>
              <option value="Light">Light</option>
              <option value="Dark">Dark</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-700 whitespace-nowrap">° Brix:</label>
            <input
              type="number"
              step="0.1"
              value={cajaInfo.brix}
              onChange={(e) => setCajaInfo({ ...cajaInfo, brix: e.target.value })}
              placeholder="° Brix"
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-full px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-bold text-slate-800">Rendimiento caja analizada:</span>
            <span>Calidad: <strong className="text-[#FF5500]">{pctCalidadCaja.toFixed(1).replace('.', ',')}%</strong></span>
            <span>Condición: <strong className="text-[#FF5500]">{pctCondicionCaja.toFixed(1).replace('.', ',')}%</strong></span>
            <span>Exportable: <strong className="text-emerald-600">{pctExportableCaja.toFixed(1).replace('.', ',')}%</strong></span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200/70 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-[#FF5500] rounded-full"></div>
          <h3 className="font-bold text-slate-900 text-lg">Defectos de calidad</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-4">
          {parametrosCalidad.filter(p => !p.esSumatoria).map((item) => (
            <div key={item.nombre} className="flex items-center justify-between">
              <span className="text-slate-600 text-[13px] font-medium truncate mr-2">{item.nombre}</span>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  type="number"
                  min="0"
                  value={defectosCalidad[item.nombre] || ''}
                  onChange={(e) => handleDefectoCalidadChange(item.nombre, e.target.value)}
                  className="w-14 bg-[#F8FAFC] border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                />
                <span className="text-xs text-slate-400 font-medium w-10 text-right">
                  {formatoCaja(defectosCalidad[item.nombre])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-slate-200/70 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-6 bg-[#FF5500] rounded-full"></div>
          <h3 className="font-bold text-slate-900 text-lg">Defectos de condición</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-4">
          {parametrosCondicion.filter(p => !p.esSumatoria).map((item) => (
            <div key={item.nombre} className="flex items-center justify-between">
              <span className="text-slate-600 text-[13px] font-medium truncate mr-2">{item.nombre}</span>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  type="number"
                  min="0"
                  value={defectosCondicion[item.nombre] || ''}
                  onChange={(e) => handleDefectoCondicionChange(item.nombre, e.target.value)}
                  className="w-14 bg-[#F8FAFC] border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                />
                <span className="text-xs text-slate-400 font-medium w-10 text-right">
                  {formatoCaja(defectosCondicion[item.nombre])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 pt-6 pb-2">
        <button
          onClick={handleGuardarNuevaCaja}
          className="px-8 py-3.5 bg-[#FF5500] hover:bg-[#e04b00] text-white font-bold rounded-full text-sm shadow-md transition-all"
        >
          Guardar y nueva caja
        </button>
        <button
          onClick={onFinalizar}
          className="px-8 py-3.5 bg-[#FF5500] hover:bg-[#e04b00] text-white font-bold rounded-full text-sm shadow-md transition-all"
        >
          Finalizar inspección
        </button>
        <button
          onClick={onCancelar}
          className="px-8 py-3.5 bg-[#5D636B] hover:bg-[#4d5259] text-white font-bold rounded-full text-sm shadow-sm transition-all"
        >
          Cancelar y volver
        </button>
      </div>

    </div>
  );
}
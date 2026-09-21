import React from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

// Función para capitalizar la primera letra de cada palabra (Title Case)
const formatearNombre = (texto) => {
  if (!texto || texto === '-') return '-';
  return texto
    .toLowerCase()
    .split(' ')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
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
const PlantillaInforme = React.forwardRef(({ datos }, ref) => {
  if (!datos) return null;

  // 1. FORMATEO DE VARIABLES PRINCIPALES
  const numProceso = datos.numProceso || datos.id || '-';
  const exportadora = datos.exportadora || '-';
  const planta = datos.planta || 'Maquehua';
  const csg = datos.csg || '-';
  const variedad = datos.variedad || '-';
  
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

  // 2. CÁLCULO DE DATOS MATEMÁTICOS
  const cajas = Array.isArray(datos.cajas) ? datos.cajas : [];
  let totalFrutos = 0, totalCal = 0, totalCond = 0;
  
  const defCalidadBase = { 'Frutos deformes / dobles': 0, 'Daños de trips': 0, 'Golpe de sol': 0, 'Manchas': 0, 'Sutura (severa)': 0, 'Herida cicatrizada': 0, 'Desuniformidad de color': 0, 'Russet': 0, 'Fruta sin pedicelo': 0, 'Falta de color': 0, 'Bajo calibre': 0, 'Sobre calibre': 0 };
  const defCondicionBase = { 'Pudrición': 0, 'Mancha parda': 0, 'Herida de insecto': 0, 'Herida de pájaro': 0, 'Herida abierta': 0, 'Partidura por agua': 0, 'Virosis': 0, 'Partiduras laterales': 0, 'Partiduras apicales': 0, 'Machucón': 0, 'Pitting severo': 0, 'Fruta blanda': 0, 'Sobre madurez': 0, 'Quemado de sol': 0, 'Desgarro pedicelar': 0, 'Medias lunas': 0, 'Pitting leve': 0, 'Piel de lagarto': 0 };

  let sumBrixLight = 0, countLight = 0, sumBrixDark = 0, countDark = 0;
  const brixCount = { '< 14': { Light: 0, Dark: 0 }, '14 - 16': { Light: 0, Dark: 0 }, '16 - 18': { Light: 0, Dark: 0 }, '> 18': { Light: 0, Dark: 0 } };

  cajas.forEach(c => {
    const f = parseInt(c.frutos) || 0;
    totalFrutos += f;

    if (c.defCalidad) {
      Object.keys(defCalidadBase).forEach(key => {
        const val = parseInt(c.defCalidad[key]) || 0;
        defCalidadBase[key] += val;
        totalCal += val;
      });
    }
    if (c.defCondicion) {
      Object.keys(defCondicionBase).forEach(key => {
        const val = parseInt(c.defCondicion[key]) || 0;
        defCondicionBase[key] += val;
        totalCond += val;
      });
    }

    if (c.brix && parseFloat(c.brix) > 0) {
      const b = parseFloat(c.brix);
      let rango = '';
      if (b < 14) rango = '< 14';
      else if (b >= 14 && b < 16) rango = '14 - 16';
      else if (b >= 16 && b <= 18) rango = '16 - 18';
      else rango = '> 18';

      if (c.color === 'Light') { sumBrixLight += b; countLight++; brixCount[rango].Light++; }
      if (c.color === 'Dark') { sumBrixDark += b; countDark++; brixCount[rango].Dark++; }
    }
  });

  const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
  const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
  const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;

  const califLetter = pCal <= 5 ? 'A' : pCal <= 10 ? 'B' : 'C';
  const califNum = pCond <= 5 ? '1' : pCond <= 10 ? '2' : '3';
  const nota = totalFrutos ? `${califLetter}${califNum}` : '-';
  const estado = totalFrutos ? ((califLetter === 'C' || califNum === '3') ? 'Objetado' : 'Aprobado') : 'Aprobado';

  const promLight = countLight ? (sumBrixLight / countLight).toFixed(1).replace('.', ',') : '0,0';
  const promDark = countDark ? (sumBrixDark / countDark).toFixed(1).replace('.', ',') : '0,0';

  const arrDefCal = Object.keys(defCalidadBase).map(label => ({ label, v: totalFrutos ? (defCalidadBase[label] / totalFrutos) * 100 : 0 }));
  const arrDefCond = Object.keys(defCondicionBase).map(label => ({ label, v: totalFrutos ? (defCondicionBase[label] / totalFrutos) * 100 : 0 }));

  const brixDataArr = [
    { name: '< 14', Light: countLight ? (brixCount['< 14'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['< 14'].Dark / countDark) * 100 : 0 },
    { name: '14 - 16', Light: countLight ? (brixCount['14 - 16'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['14 - 16'].Dark / countDark) * 100 : 0 },
    { name: '16 - 18', Light: countLight ? (brixCount['16 - 18'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['16 - 18'].Dark / countDark) * 100 : 0 },
    { name: '> 18', Light: countLight ? (brixCount['> 18'].Light / countLight) * 100 : 0, Dark: countDark ? (brixCount['> 18'].Dark / countDark) * 100 : 0 }
  ];

  // ================= CÁLCULO TOP 3 DEFECTOS =================
  let observacionesCriticas = [];
  arrDefCal.forEach(d => { if (d.v > 1.5) observacionesCriticas.push({ def: d.label, val: d.v }); });
  arrDefCond.forEach(d => { if (d.v > 1.0) observacionesCriticas.push({ def: d.label, val: d.v }); });
  
  // Ordenar de mayor a menor y extraer solo los 3 primeros
  observacionesCriticas.sort((a, b) => b.val - a.val);
  const top3Observaciones = observacionesCriticas.slice(0, 3);

  return (
    <div ref={ref} className="bg-white px-2 pt-3 pb-3 font-sans text-slate-800 flex flex-col box-border" style={{ width: '816px', height: '1056px' }}>
      
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

      {/* 1. INFORMACIÓN GENERAL */}
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
          <div className="col-span-2">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-black mb-0.5">Huerto</p>
            <p className="font-bold text-xs text-slate-700 truncate">{huerto}</p>
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
          
          {/* BANNER VERDE: Aumentado de py-4 a py-[18px] (aprox. 10%) */}
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
            <div className="flex-1 w-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 min-h-[275px]">
              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2"/><path d="m21 15-5-5L5 21" strokeWidth="2"/>
              </svg>
              <span className="text-[10px] font-bold">Sin imagen</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex-1 shadow-sm flex flex-col">
            <h3 className="text-[11px] font-black text-slate-800 mb-1.5 shrink-0">Embalaje Dark</h3>
            <div className="flex-1 w-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 min-h-[275px]">
              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2"/><path d="m21 15-5-5L5 21" strokeWidth="2"/>
              </svg>
              <span className="text-[10px] font-bold">Sin imagen</span>
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
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickMargin={5} interval={0} padding={{ left: 12, right: 12 }} />
                <Bar dataKey="Light" fill="#fca5a5" isAnimationActive={false} barSize={16} radius={[2,2,0,0]} 
                  label={{ position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 'bold', formatter: (val) => val > 0 ? `${parseFloat(val).toFixed(0)}%` : '' }} 
                />
                <Bar dataKey="Dark" fill="#650a0a" isAnimationActive={false} barSize={16} radius={[2,2,0,0]} 
                  label={{ position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 'bold', formatter: (val) => val > 0 ? `${parseFloat(val).toFixed(0)}%` : '' }} 
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
          <div className="bg-orange-50/60 border border-orange-100/80 rounded-lg p-2.5 text-[11px] text-slate-700 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center">
            
            {nota === 'A1' ? (
              <div className="text-emerald-700 text-center px-1">
                <p className="font-bold text-[11px] leading-snug">Proceso aprobado. Los parámetros evaluados cumplen óptimamente con los criterios de calidad y condición establecidos.</p>
              </div>
            ) : top3Observaciones.length > 0 ? (
              <div>
                <p className="font-bold mb-1 text-orange-800">Principales factores de objeción:</p>
                <ul className="list-disc pl-4 space-y-1 font-medium text-slate-800">
                  {top3Observaciones.map((obs, idx) => (
                    <li key={idx} className="leading-tight">
                      <span className="font-bold">{obs.def}</span> con un <span className="text-orange-600 font-bold">{obs.val.toFixed(1).replace('.', ',')}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-slate-500 text-center px-1">
                <p className="font-medium text-[11px] leading-snug">No se registraron defectos críticos que superen el umbral límite esperado.</p>
              </div>
            )}

          </div>
        </div>
      </div>

    </div>
  );
});

export default PlantillaInforme;
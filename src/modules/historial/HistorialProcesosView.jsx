import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Filter, MoreVertical, Edit3, Trash2, 
  BarChart2, ChevronLeft, ChevronRight, ArrowLeft, Save, AlertTriangle, Plus, X, Check, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import PlantillaInforme from './PlantillaInforme';

const defectosCalidadBase = {
  'Frutos deformes / dobles': 0, 'Daños de trips': 0, 'Golpe de sol': 0, 'Manchas': 0, 'Sutura (severa)': 0, 'Herida cicatrizada': 0,
  'Desuniformidad de color': 0, 'Russet': 0, 'Fruta sin pedicelo': 0, 'Falta de color': 0, 'Bajo calibre': 0, 'Sobre calibre': 0
};
const defectosCondicionBase = {
  'Pudrición': 0, 'Mancha parda': 0, 'Herida de insecto': 0, 'Herida de pájaro': 0, 'Herida abierta': 0, 'Partidura por agua': 0,
  'Virosis': 0, 'Partiduras laterales': 0, 'Partiduras apicales': 0, 'Machucón': 0, 'Pitting severo': 0, 'Fruta blanda': 0,
  'Sobre madurez': 0, 'Quemado de sol': 0, 'Desgarro pedicelar': 0, 'Medias lunas': 0, 'Pitting leve': 0, 'Piel de lagarto': 0
};

export default function HistorialProcesosView({ onVerResumen }) {
  const [procesos, setProcesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState(null);

  // Estados de Búsqueda y Filtros
  const [filtroNumProceso, setFiltroNumProceso] = useState('');
  const [filtroCsgHuerto, setFiltroCsgHuerto] = useState('');
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [filtroVariedad, setFiltroVariedad] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroCalificacion, setFiltroCalificacion] = useState('');

  // Listas maestras
  const [exportadoras, setExportadoras] = useState([]);
  const [variedades, setVariedades] = useState([]);
  const [huertos, setHuertos] = useState([]);

  // Menús y modales
  const [menuProcesoAbiertoId, setMenuProcesoAbiertoId] = useState(null);
  const [procesoAEliminar, setProcesoAEliminar] = useState(null);

  // Paginación de lista
  const [paginaActual, setPaginaActual] = useState(1);
  const procesosPorPagina = 10;

  // Vistas: 'lista' | 'editar'
  const [vistaActual, setVistaActual] = useState('lista');
  const [procesoEnEdicion, setProcesoEnEdicion] = useState(null);
  const [cajaIndexEditandoModal, setCajaIndexEditandoModal] = useState(null);
  const [tabDefectosModal, setTabDefectosModal] = useState('calidad');

  // ================= ESTADOS PARA REPORTE PDF Y VISTA PREVIA =================
  const [datosReporte, setDatosReporte] = useState(null);
  const [generandoReporteId, setGenerandoReporteId] = useState(null);
  const [datosVistaPrevia, setDatosVistaPrevia] = useState(null);
  const [cargandoVistaPreviaId, setCargandoVistaPreviaId] = useState(null);
  const reporteRef = useRef();
  // ==============================================================================

  // 👇 NUEVO: Variable inteligente que detecta si está en Producción o Desarrollo
  const API_URL = import.meta.env.PROD 
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [inspRes, expRes, varRes, hueRes] = await Promise.all([
        fetch(`${API_URL}/api/inspecciones`).catch(() => null),
        fetch(`${API_URL}/api/exportadoras`).catch(() => null),
        fetch(`${API_URL}/api/variedades`).catch(() => null),
        fetch(`${API_URL}/api/huertos`).catch(() => null)
      ]);

      if (inspRes && inspRes.ok) {
        const data = await inspRes.json();
        setProcesos(Array.isArray(data) ? data.reverse() : []);
      }
      if (expRes && expRes.ok) {
        const dataExp = await expRes.json();
        setExportadoras(Array.isArray(dataExp) ? dataExp : []);
      }
      if (varRes && varRes.ok) {
        const dataVar = await varRes.json();
        setVariedades(Array.isArray(dataVar) ? dataVar : []);
      }
      if (hueRes && hueRes.ok) {
        const dataHue = await hueRes.json();
        setHuertos(Array.isArray(dataHue) ? dataHue : []);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroNumProceso, filtroCsgHuerto, filtroVariedad, filtroFecha, filtroCalificacion]);

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return 'Sin fecha';
    try {
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return 'Sin fecha';
      
      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      return `${dia}-${mes}-${anio}`;
    } catch (e) {
      return 'Sin fecha';
    }
  };

  const calcularMetricas = (proceso) => {
    if (!proceso) {
      return { pExp: '100.0', pExpNum: 100, pCal: '0.0', pCond: '0.0', nota: '-', estado: 'Aprobado', promLight: '0,0', promDark: '0,0', acumuladoFrutos: 0 };
    }
    
    let totalFrutos = 0, totalCal = 0, totalCond = 0;
    let sumBrixLight = 0, countBrixLight = 0, sumBrixDark = 0, countBrixDark = 0;

    const listaCajas = Array.isArray(proceso.cajas) ? proceso.cajas : [];

    listaCajas.forEach(c => {
      if (!c) return;
      const f = parseInt(c.frutos) || 0;
      totalFrutos += f;

      Object.values(c.defCalidad || {}).forEach(v => totalCal += (parseInt(v) || 0));
      Object.values(c.defCondicion || {}).forEach(v => totalCond += (parseInt(v) || 0));

      if (c.brix && parseFloat(c.brix) > 0) {
        if (c.color === 'Light') { sumBrixLight += parseFloat(c.brix); countBrixLight++; }
        if (c.color === 'Dark') { sumBrixDark += parseFloat(c.brix); countBrixDark++; }
      }
    });

    const pCal = totalFrutos ? (totalCal / totalFrutos) * 100 : 0;
    const pCond = totalFrutos ? (totalCond / totalFrutos) * 100 : 0;
    const pExp = totalFrutos ? Math.max(0, 100 - pCal - pCond) : 100;

    const califLetter = pCal <= 5 ? 'A' : pCal <= 10 ? 'B' : 'C';
    const califNum = pCond <= 5 ? '1' : pCond <= 10 ? '2' : '3';
    const nota = totalFrutos ? `${califLetter}${califNum}` : '-';
    const estado = totalFrutos ? ((califLetter === 'C' || califNum === '3') ? 'Objetado' : 'Aprobado') : 'Aprobado';

    const promLight = countBrixLight ? (sumBrixLight / countBrixLight).toFixed(1).replace('.', ',') : '0,0';
    const promDark = countBrixDark ? (sumBrixDark / countBrixDark).toFixed(1).replace('.', ',') : '0,0';

    return {
      pExp: pExp.toFixed(1).replace('.', ','),
      pExpNum: pExp,
      pCal: pCal.toFixed(1),
      pCond: pCond.toFixed(1),
      nota,
      estado,
      promLight,
      promDark,
      acumuladoFrutos: totalFrutos
    };
  };

  const calcularTotalesCaja = (caja) => {
    if (!caja) return { tCal: 0, tCond: 0, pCal: '0.0', pCond: '0.0', pExp: '100.0' };
    const tCal = Object.values(caja.defCalidad || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const tCond = Object.values(caja.defCondicion || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const f = parseInt(caja.frutos) || 0;
    const pCal = f ? ((tCal / f) * 100).toFixed(1) : '0.0';
    const pCond = f ? ((tCond / f) * 100).toFixed(1) : '0.0';
    const pExp = f ? Math.max(0, 100 - (tCal / f) * 100 - (tCond / f) * 100).toFixed(1) : '100.0';
    return { tCal, tCond, pCal, pCond, pExp };
  };

  // ================= FUNCIONES PARA INFORME PDF Y VISTA PREVIA =================
  
  // 1. ABRIR VISTA PREVIA (Usando los datos que ya están en la tabla)
  const abrirVistaPrevia = (procesoId) => {
    // Busca el proceso directamente de la lista ya cargada
    const procesoEncontrado = procesos.find(p => p.id === procesoId || p._id === procesoId);
    setDatosVistaPrevia(procesoEncontrado);
  };

  // 2. DESCARGAR PDF ROBUSTO (Usando los datos locales)
  const descargarPDF = async (procesoId) => {
    setGenerandoReporteId(procesoId);
    try {
      const procesoEncontrado = procesos.find(p => p.id === procesoId || p._id === procesoId);
      setDatosReporte(procesoEncontrado);

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!reporteRef.current) throw new Error("El componente PDF no se pudo montar.");

      const canvas = await html2canvas(reporteRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'letter');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Informe_Proceso_${procesoEncontrado.numProceso || procesoId}.pdf`);

    } catch (error) {
      console.error("Error exacto al generar PDF:", error);
      alert(`Error técnico: ${error.message}`);
    } finally {
      setDatosReporte(null);
      setGenerandoReporteId(null);
      setMenuProcesoAbiertoId(null);
    }
  };

  const abrirEdicionProceso = (proceso) => {
    if (!proceso) return;
    const listaCajas = Array.isArray(proceso.cajas) ? proceso.cajas : [];
    
    const cajasNormalizadas = listaCajas.map((c, i) => ({
      numCaja: c?.numCaja || i + 1,
      frutos: c?.frutos ?? '100',
      calibre: c?.calibre || '',
      color: c?.color || '',
      brix: c?.brix ?? '',
      defCalidad: { ...defectosCalidadBase, ...(c?.defCalidad || {}) },
      defCondicion: { ...defectosCondicionBase, ...(c?.defCondicion || {}) }
    }));

    setProcesoEnEdicion({
      ...proceso,
      numProceso: proceso.numProceso || '',
      exportadora: proceso.exportadora || '',
      csg: proceso.csg || '',
      productor: proceso.productor || '',
      variedad: proceso.variedad || '',
      cajas: cajasNormalizadas.length > 0 ? cajasNormalizadas : [{
        numCaja: 1, frutos: '100', calibre: '', color: '', brix: '',
        defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase }
      }]
    });
    setVistaActual('editar');
    setMenuProcesoAbiertoId(null);
  };

  const cerrarEdicion = () => {
    setProcesoEnEdicion(null);
    setCajaIndexEditandoModal(null);
    setVistaActual('lista');
  };

  const guardarCambiosProceso = async () => {
    if (!procesoEnEdicion) return;
    const metricas = calcularMetricas(procesoEnEdicion);

    try {
      const payload = {
        numProceso: procesoEnEdicion.numProceso,
        exportadora: procesoEnEdicion.exportadora,
        csg: procesoEnEdicion.csg,
        variedad: procesoEnEdicion.variedad,
        estado: metricas.estado,
        cajas: procesoEnEdicion.cajas || []
      };

      const response = await fetch(`${API_URL}/api/inspecciones/${procesoEnEdicion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("¡Proceso e inspecciones actualizados exitosamente!");
        cerrarEdicion();
        cargarDatos();
      } else {
        const data = await response.json().catch(() => ({}));
        alert("❌ Error al guardar: " + (data.error || "No se pudo actualizar el proceso."));
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error de conexión al servidor backend.");
    }
  };

  const handleCSGChange = (codigoCsg) => {
    const encontrado = huertos.find(h => h.csg === codigoCsg);
    setProcesoEnEdicion(prev => ({
      ...prev,
      csg: codigoCsg,
      productor: encontrado ? encontrado.productor : prev.productor
    }));
  };

  const handleCajaCampoModalChange = (campo, valor) => {
    if (cajaIndexEditandoModal === null) return;
    setProcesoEnEdicion(prev => {
      const nuevasCajas = [...prev.cajas];
      nuevasCajas[cajaIndexEditandoModal] = {
        ...nuevasCajas[cajaIndexEditandoModal],
        [campo]: valor
      };
      return { ...prev, cajas: nuevasCajas };
    });
  };

  const handleDefectoModalChange = (tipoDef, defectoNombre, valor) => {
    if (cajaIndexEditandoModal === null) return;
    const val = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    setProcesoEnEdicion(prev => {
      const nuevasCajas = [...prev.cajas];
      const caja = nuevasCajas[cajaIndexEditandoModal];
      nuevasCajas[cajaIndexEditandoModal] = {
        ...caja,
        [tipoDef]: {
          ...(caja[tipoDef] || {}),
          [defectoNombre]: val
        }
      };
      return { ...prev, cajas: nuevasCajas };
    });
  };

  const agregarNuevaCaja = () => {
    setProcesoEnEdicion(prev => {
      const listaPrev = Array.isArray(prev?.cajas) ? prev.cajas : [];
      const proximoNum = listaPrev.length + 1;
      const nuevaCaja = {
        numCaja: proximoNum, frutos: '100', calibre: '', color: '', brix: '',
        defCalidad: { ...defectosCalidadBase }, defCondicion: { ...defectosCondicionBase }
      };
      return {
        ...prev,
        cajas: [...listaPrev, nuevaCaja]
      };
    });
    setCajaIndexEditandoModal(procesoEnEdicion?.cajas ? procesoEnEdicion.cajas.length : 0);
    setTabDefectosModal('calidad');
  };

  const eliminarCaja = (index) => {
    const listaCajas = Array.isArray(procesoEnEdicion?.cajas) ? procesoEnEdicion.cajas : [];
    if (listaCajas.length <= 1) return alert("El proceso debe contener al menos una caja.");
    if (!window.confirm(`¿Eliminar Caja N° ${listaCajas[index]?.numCaja || index + 1}?`)) return;

    setProcesoEnEdicion(prev => {
      const filtradas = (prev.cajas || []).filter((_, i) => i !== index);
      const reordenadas = filtradas.map((c, i) => ({ ...c, numCaja: i + 1 }));
      return { ...prev, cajas: reordenadas };
    });
    if (cajaIndexEditandoModal === index) setCajaIndexEditandoModal(null);
  };

  const solicitarEliminarProceso = (proceso) => {
    setProcesoAEliminar(proceso);
    setMenuProcesoAbiertoId(null);
  };

  const ejecutarEliminacionProceso = async () => {
    if (!procesoAEliminar) return;
    const id = procesoAEliminar.id || procesoAEliminar._id;

    try {
      const response = await fetch(`${API_URL}/api/inspecciones/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProcesos(prev => prev.filter(p => (p.id || p._id) !== id));
        if (procesoSeleccionado?.id === id) setProcesoSeleccionado(null);
        setProcesoAEliminar(null);
      } else {
        const data = await response.json().catch(() => ({}));
        alert("❌ Error del servidor: " + (data.error || "No se pudo eliminar."));
      }
    } catch (err) {
      console.error(err);
      alert('❌ Error de conexión al intentar eliminar el proceso.');
    }
  };

  const filtrados = procesos.filter(p => {
    if (!p) return false;
    const numP = (p.numProceso || '').toString().toLowerCase();
    const queryNumP = filtroNumProceso.toLowerCase();
    if (queryNumP && !numP.includes(queryNumP)) return false;

    const csgStr = (p.csg || '').toLowerCase();
    const prodStr = (p.productor || '').toLowerCase();
    const queryHuerto = filtroCsgHuerto.toLowerCase();
    if (queryHuerto && !csgStr.includes(queryHuerto) && !prodStr.includes(queryHuerto)) return false;

    if (filtroVariedad && p.variedad !== filtroVariedad) return false;

    if (filtroFecha) {
      const fechaDB = p.created_at || p.createdAt || p.fecha || p.fecha_creacion || p.date;
      if (!fechaDB) return false;
      const d = new Date(fechaDB);
      if (isNaN(d.getTime())) return false;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      const fechaDBStr = `${anio}-${mes}-${dia}`;
      if (fechaDBStr !== filtroFecha) return false;
    }

    if (filtroCalificacion) {
      const met = calcularMetricas(p);
      if (met.nota !== filtroCalificacion) return false;
    }

    return true;
  });

  const totalPaginas = Math.ceil(filtrados.length / procesosPorPagina) || 1;
  const procesosPaginados = filtrados.slice((paginaActual - 1) * procesosPorPagina, paginaActual * procesosPorPagina);

  // ================= VISTA 1: LISTA PRINCIPAL =================
  if (vistaActual === 'lista') {
    return (
      <div 
        className="w-full h-full bg-[#F4F7FA] p-4 md:p-8 overflow-y-auto animate-fade-in font-sans relative"
        onClick={() => setMenuProcesoAbiertoId(null)}
      >
        <div className="max-w-[1400px] mx-auto bg-white rounded-[2.5rem] p-6 md:p-10 border border-slate-100 shadow-sm flex flex-col gap-6">
          
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center">
                <div className="w-1.5 h-7 bg-[#E96008] rounded-full mr-3"></div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900">Historial de procesos finalizados</h1>
              </div>
              <p className="text-slate-400 text-sm font-medium mt-1 pl-4">Módulo de gestión y revisión de procesos sincronizados</p>
            </div>
          </div>

          {/* ÁREA DE BUSCADORES Y FILTROS */}
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col md:flex-row gap-3">
              
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar N° proceso..."
                  value={filtroNumProceso}
                  onChange={(e) => setFiltroNumProceso(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 outline-none focus:border-[#E96008] transition-all"
                />
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar Huerto o CSG..."
                  value={filtroCsgHuerto}
                  onChange={(e) => setFiltroCsgHuerto(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 outline-none focus:border-[#E96008] transition-all"
                />
              </div>

              <button
                onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                className={`h-12 px-6 flex items-center justify-center gap-2 border rounded-2xl font-bold text-sm transition-colors shrink-0 ${
                  mostrarFiltrosAvanzados 
                  ? 'bg-[#E96008] border-[#E96008] text-white' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-5 h-5" />
                Filtros
              </button>
            </div>

            {mostrarFiltrosAvanzados && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 animate-fade-in shadow-inner">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Variedad</label>
                  <select 
                    value={filtroVariedad} 
                    onChange={e => setFiltroVariedad(e.target.value)} 
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-[#E96008] bg-white"
                  >
                    <option value="">Todas las variedades</option>
                    {variedades.map((v, i) => (
                      <option key={v.id || i} value={v.nombre || v}>{v.nombre || v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Fecha de Proceso</label>
                  <input 
                    type="date" 
                    value={filtroFecha} 
                    onChange={e => setFiltroFecha(e.target.value)} 
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-[#E96008] bg-white text-slate-700" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Calificación</label>
                  <select 
                    value={filtroCalificacion} 
                    onChange={e => setFiltroCalificacion(e.target.value)} 
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:border-[#E96008] bg-white"
                  >
                    <option value="">Todas las calificaciones</option>
                    {['A1','A2','A3','B1','B2','B3','C1','C2','C3'].map(nota => (
                      <option key={nota} value={nota}>{nota}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 text-[13px] font-bold">
                    <th className="py-4 px-6 text-center">Fecha</th>
                    <th className="py-4 px-6 text-center">N° Proceso</th>
                    <th className="py-4 px-6">CSG</th>
                    <th className="py-4 px-6">Huerto</th>
                    <th className="py-4 px-6">Variedad</th>
                    <th className="py-4 px-6 text-center">Cajas</th>
                    <th className="py-4 px-6 text-center">% Exp.</th>
                    <th className="py-4 px-6 text-center">Calificación</th>
                    <th className="py-4 px-6 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {cargando ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">Sincronizando procesos con PostgreSQL...</td>
                    </tr>
                  ) : procesosPaginados.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">No se encontraron procesos registrados con esos filtros.</td>
                    </tr>
                  ) : (
                    procesosPaginados.map((proc) => {
                      const metricas = calcularMetricas(proc);
                      const isSelected = procesoSeleccionado?.id === proc.id;
                      const fechaMostrar = proc.created_at || proc.createdAt || proc.fecha || proc.fecha_creacion || proc.date;

                      return (
                        <tr 
                          key={proc.id || proc.numProceso} 
                          onClick={() => setProcesoSeleccionado(proc)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-orange-50/60' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-max mx-auto shadow-sm">
                              <span className={`text-[11px] font-bold ${fechaMostrar ? 'text-slate-700' : 'text-slate-400'}`}>
                                {formatearFecha(fechaMostrar)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-bold text-slate-800">{proc.numProceso}</td>
                          <td className="py-4 px-6 font-semibold text-slate-600">{proc.csg || '-'}</td>
                          <td className="py-4 px-6 font-bold text-slate-800 uppercase">{proc.productor || '-'}</td>
                          <td className="py-4 px-6">
                            <span className="bg-purple-100 text-purple-600 font-bold px-3 py-1 rounded-full text-xs">
                              {proc.variedad || '-'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center font-bold text-slate-700">{proc.cajas ? proc.cajas.length : 0}</td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-800 text-xs mb-1">{metricas.pExp}%</span>
                              <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${metricas.pExpNum >= 90 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                  style={{ width: `${Math.min(100, metricas.pExpNum)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-black ${
                              metricas.nota.includes('C') || metricas.nota.includes('3') 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {metricas.nota}
                            </span>
                          </td>
                          
                          <td className="py-4 px-6 text-right relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuProcesoAbiertoId(menuProcesoAbiertoId === proc.id ? null : proc.id);
                              }} 
                              className="p-1.5 hover:bg-slate-200/60 rounded-full text-slate-400 focus:outline-none"
                              title="Opciones del proceso"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuProcesoAbiertoId === proc.id && (
                              <div 
                                className="absolute right-6 top-10 w-52 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-30 flex flex-col animate-fade-in text-left divide-y divide-slate-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button 
                                  onClick={() => abrirEdicionProceso(proc)} 
                                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4 text-blue-600" />
                                  <span>Editar proceso</span>
                                </button>

                                {/* BOTÓN VISTA PREVIA */}
                                <button 
                                  onClick={() => {
                                    setMenuProcesoAbiertoId(null);
                                    abrirVistaPrevia(proc.id);
                                  }} 
                                  disabled={cargandoVistaPreviaId === proc.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-orange-50 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <BarChart2 className="w-4 h-4 text-[#E96008]" />
                                  <span>{cargandoVistaPreviaId === proc.id ? 'Cargando...' : 'Ver resumen de proceso'}</span>
                                </button>

                                {/* BOTÓN DESCARGAR PDF */}
                                <button 
                                  onClick={() => descargarPDF(proc.id)} 
                                  disabled={generandoReporteId === proc.id}
                                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-green-50 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Download className="w-4 h-4 text-green-600" />
                                  <span>{generandoReporteId === proc.id ? 'Generando...' : 'Descargar Informe PDF'}</span>
                                </button>
                                
                                <button 
                                  onClick={() => solicitarEliminarProceso(proc)} 
                                  className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                  <span>Eliminar proceso</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-white">
              <span>Mostrando {procesosPaginados.length} de {filtrados.length} registros</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="w-7 h-7 border border-[#E96008] text-[#E96008] font-bold rounded-lg flex items-center justify-center">
                  {paginaActual}
                </span>
                <button 
                  onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual === totalPaginas}
                  className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* MODAL CONFIRMACIÓN ELIMINAR PROCESO */}
        {procesoAEliminar && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-6 md:p-8 border border-red-100 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100 shadow-sm">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Eliminar Inspección</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                ¿Estás seguro de eliminar el proceso N° <span className="font-black text-slate-900">{procesoAEliminar.numProceso}</span>? Esta acción eliminará permanentemente toda su inspeccion.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setProcesoAEliminar(null)} 
                  className="flex-1 py-3 px-4 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={ejecutarEliminacionProceso} 
                  className="flex-1 py-3 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

{/* ================= MODAL DE VISTA PREVIA DEL INFORME ================= */}
        {datosVistaPrevia && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">
              
              {/* Encabezado del Modal */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white z-10">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Vista Previa del Informe</h3>
                  <p className="text-xs text-slate-500">Proceso N° {datosVistaPrevia.numProceso || datosVistaPrevia.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => descargarPDF(datosVistaPrevia.id || datosVistaPrevia._id)}
                    disabled={generandoReporteId === (datosVistaPrevia.id || datosVistaPrevia._id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" /> 
                    {generandoReporteId === (datosVistaPrevia.id || datosVistaPrevia._id) ? 'Generando...' : 'Descargar PDF'}
                  </button>
                  <button 
                    onClick={() => setDatosVistaPrevia(null)} 
                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenedor escroleable donde se muestra la Plantilla */}
              <div className="flex-1 overflow-auto bg-slate-200 p-6 flex justify-center custom-scrollbar">
                <div className="shadow-2xl">
                  <PlantillaInforme datos={datosVistaPrevia} />
                </div>
              </div>
              
            </div>
          </div>
        )}
        {/* ==================================================================== */}

        {/* ================= COMPONENTE OCULTO PARA EL PDF ================= */}
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -1000, opacity: 0.01, pointerEvents: 'none' }}>
          {datosReporte && (
            <PlantillaInforme ref={reporteRef} datos={datosReporte} />
          )}
        </div>
        {/* ================================================================== */}

      </div>
    );
  }

  // ================= VISTA 2: EDICIÓN COMPLETA =================
  const metricasLive = calcularMetricas(procesoEnEdicion);
  const listaCajasEnEdicion = Array.isArray(procesoEnEdicion?.cajas) ? procesoEnEdicion.cajas : [];
  const cajaEditandoModal = cajaIndexEditandoModal !== null ? listaCajasEnEdicion[cajaIndexEditandoModal] : null;

  return (
    <div className="w-full h-full bg-[#F4F7FA] overflow-y-auto custom-scrollbar animate-fade-in relative pb-28">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5 py-6 px-4 md:px-8 font-sans w-full">
        
        {/* CABECERA Y BOTONES ACCIÓN */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={cerrarEdicion} className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-full transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">
                Editando Proceso N° #{procesoEnEdicion?.numProceso || '-'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Modifica los datos del proceso y gestiona la lista de cajas inspeccionadas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={cerrarEdicion} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-full text-xs transition-colors hidden md:block">
              Cancelar
            </button>
            <button onClick={guardarCambiosProceso} className="px-6 py-2.5 bg-[#00A859] hover:bg-[#008f4c] text-white font-bold rounded-full text-xs shadow-md transition-all flex items-center gap-2">
              <Save className="w-4 h-4" /> <span className="hidden sm:inline">Guardar Todo el Proceso</span>
            </button>
          </div>
        </div>

        {/* SECCIÓN 1: DATOS GENERALES DEL PROCESO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
            1. Datos Generales del Proceso
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">N° Proceso</label>
              <input 
                type="number" 
                value={procesoEnEdicion?.numProceso || ''} 
                onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, numProceso: e.target.value })}
                className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-sm outline-none focus:border-[#E96008]" 
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Exportadora</label>
              <select 
                value={procesoEnEdicion?.exportadora || ''} 
                onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, exportadora: e.target.value })}
                className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]"
              >
                {exportadoras.map((e, idx) => (
                  <option key={idx} value={e.nombre || e}>{e.nombre || e}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">CSG / Huerto</label>
              <select 
                value={procesoEnEdicion?.csg || ''} 
                onChange={(e) => handleCSGChange(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]"
              >
                {huertos.map((h, idx) => (
                  <option key={idx} value={h.csg}>{h.csg} - {h.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Productor</label>
              <input 
                type="text" readOnly 
                value={procesoEnEdicion?.productor || ''} 
                className="w-full h-10 bg-slate-100 border border-slate-200 rounded-xl px-3 font-medium text-slate-500 text-xs cursor-not-allowed" 
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Variedad</label>
              <select 
                value={procesoEnEdicion?.variedad || ''} 
                onChange={(e) => setProcesoEnEdicion({ ...procesoEnEdicion, variedad: e.target.value })}
                className="w-full h-10 border border-slate-300 rounded-xl px-3 font-bold text-xs bg-white outline-none focus:border-[#E96008]"
              >
                {variedades.map((v, idx) => (
                  <option key={idx} value={v.nombre || v}>{v.nombre || v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* BANNER RECALCULADO EN TIEMPO REAL */}
        <div className="bg-[#E96008] rounded-2xl px-5 py-4 text-white shadow-md w-full">
          <h2 className="font-extrabold mb-3 text-xs md:text-sm tracking-wide uppercase opacity-95">Resumen de Proceso en Tiempo Real</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 text-xs md:text-sm">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center"><span className="opacity-80">Proceso:</span> <span className="font-black text-base">#{procesoEnEdicion?.numProceso || '-'}</span></div>
              <div className="flex justify-between items-center"><span className="opacity-80">Muestra:</span> <span className="font-black text-base">{metricasLive.acumuladoFrutos}</span></div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center"><span className="opacity-80">Cajas:</span> <span className="font-black text-base">{listaCajasEnEdicion.length}</span></div>
              <div className="flex justify-between items-center"><span className="opacity-80">Exportable:</span> <span className="font-black text-base">{metricasLive.pExp}%</span></div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center"><span className="opacity-80">Sólidos (L/D):</span> <span className="font-black text-base">{metricasLive.promLight} / {metricasLive.promDark}</span></div>
              <div className="flex justify-between items-center"><span className="opacity-80">Calificación:</span> <span className="font-black text-base">{metricasLive.nota}</span></div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center"><span className="opacity-80">Def. calidad:</span> <span className="font-black text-base">{metricasLive.pCal}%</span></div>
              <div className="flex justify-between items-center">
                <span className="opacity-80">Estado:</span> 
                <span className={`font-black px-2 py-0.5 rounded text-xs ${metricasLive.estado === 'Objetado' ? 'bg-red-900/40 text-red-200' : 'text-white'}`}>
                  {metricasLive.estado}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center"><span className="opacity-80">Def. condición:</span> <span className="font-black text-base">{metricasLive.pCond}%</span></div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: TABLA DE CAJAS ANALIZADAS CON ACCIONES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              2. Cajas Analizadas ({listaCajasEnEdicion.length})
            </h2>
            <button 
              onClick={agregarNuevaCaja}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Agregar Nueva Caja
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">N° Caja</th>
                    <th className="py-3 px-4">Muestra</th>
                    <th className="py-3 px-4">Calibre</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">°Brix</th>
                    <th className="py-3 px-4 text-center">Def. Calidad</th>
                    <th className="py-3 px-4 text-center">Def. Condición</th>
                    <th className="py-3 px-4 text-center">% Exportable</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {listaCajasEnEdicion.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400 font-medium">
                        No hay cajas registradas en este proceso. Presiona "Agregar Nueva Caja".
                      </td>
                    </tr>
                  ) : (
                    listaCajasEnEdicion.map((c, idx) => {
                      const totales = calcularTotalesCaja(c);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900">
                            Caja #{c.numCaja || idx + 1}
                          </td>
                          <td className="py-3 px-4 font-medium">{c.frutos} frutos</td>
                          <td className="py-3 px-4 font-bold text-[#E96008]">{c.calibre || '-'}</td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{c.color || '-'}</span>
                          </td>
                          <td className="py-3 px-4 font-bold">{c.brix ? `${c.brix}°` : '-'}</td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">
                            {totales.tCal} ({totales.pCal}%)
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-slate-700">
                            {totales.tCond} ({totales.pCond}%)
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-black ${parseFloat(totales.pExp) >= 90 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {totales.pExp}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setCajaIndexEditandoModal(idx);
                                  setTabDefectosModal('calidad');
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-[#E96008] text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1"
                                title="Editar inspección de esta caja"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Editar
                              </button>
                              <button
                                onClick={() => eliminarCaja(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar caja"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL DETALLADO PARA EDITAR LA REVISIÓN DE UNA CAJA */}
      {cajaEditandoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-5 border border-slate-100 relative">
            
            {/* CABECERA DEL MODAL */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg md:text-xl">
                  Editando Caja #{cajaEditandoModal.numCaja || (cajaIndexEditandoModal + 1)}
                </h3>
                <p className="text-xs text-slate-400 font-medium">Ajusta los parámetros técnicos y conteo de defectos para esta caja</p>
              </div>
              <button 
                onClick={() => setCajaIndexEditandoModal(null)} 
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PARAMETROS TÉCNICOS DE LA CAJA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Muestra (frutos)</label>
                <input 
                  type="number" 
                  value={cajaEditandoModal.frutos ?? ''} 
                  onChange={(e) => handleCajaCampoModalChange('frutos', e.target.value)}
                  className="w-full h-10 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Calibre</label>
                <select 
                  value={cajaEditandoModal.calibre ?? ''} 
                  onChange={(e) => handleCajaCampoModalChange('calibre', e.target.value)}
                  className="w-full h-10 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]"
                >
                  <option value="">Seleccionar</option>
                  <option value="L">L</option><option value="XL">XL</option><option value="J">J</option>
                  <option value="2J">2J</option><option value="3J">3J</option><option value="4J">4J</option><option value="5J">5J</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Color Embalaje</label>
                <select 
                  value={cajaEditandoModal.color ?? ''} 
                  onChange={(e) => handleCajaCampoModalChange('color', e.target.value)}
                  className="w-full h-10 text-center font-bold text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]"
                >
                  <option value="">Seleccionar</option>
                  <option value="Light">Light</option>
                  <option value="Dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">° Brix (Sólidos)</label>
                <input 
                  type="number" step="0.1" 
                  value={cajaEditandoModal.brix ?? ''} 
                  onChange={(e) => handleCajaCampoModalChange('brix', e.target.value)}
                  className="w-full h-10 text-center font-bold text-sm bg-white border border-slate-300 rounded-xl outline-none focus:border-[#E96008]" 
                />
              </div>
            </div>

            {/* PESTAÑAS DE DEFECTOS */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setTabDefectosModal('calidad')}
                className={`flex-1 py-3 font-extrabold text-xs md:text-sm border-b-2 transition-all ${
                  tabDefectosModal === 'calidad' 
                    ? 'border-[#E96008] text-[#E96008] bg-orange-50/50 rounded-t-xl' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Defectos de Calidad
              </button>
              <button
                type="button"
                onClick={() => setTabDefectosModal('condicion')}
                className={`flex-1 py-3 font-extrabold text-xs md:text-sm border-b-2 transition-all ${
                  tabDefectosModal === 'condicion' 
                    ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-xl' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Defectos de Condición
              </button>
            </div>

            {/* GRILLA DE DEFECTOS */}
            {tabDefectosModal === 'calidad' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(defectosCalidadBase).map(def => {
                  const cant = cajaEditandoModal.defCalidad?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1.5 border-b border-slate-100">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input 
                        type="number" 
                        value={cant === 0 ? '' : cant} 
                        onChange={(e) => handleDefectoModalChange('defCalidad', def, e.target.value)}
                        className="w-16 h-9 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-[#E96008]" 
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {tabDefectosModal === 'condicion' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(defectosCondicionBase).map(def => {
                  const cant = cajaEditandoModal.defCondicion?.[def] ?? 0;
                  return (
                    <div key={def} className="flex items-center justify-between p-1.5 border-b border-slate-100">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{def}</span>
                      <input 
                        type="number" 
                        value={cant === 0 ? '' : cant} 
                        onChange={(e) => handleDefectoModalChange('defCondicion', def, e.target.value)}
                        className="w-16 h-9 border border-slate-300 rounded-lg text-center font-bold text-sm bg-white outline-none focus:border-red-500" 
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* PIE DEL MODAL DE CAJA */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setCajaIndexEditandoModal(null)}
                className="px-6 py-2.5 bg-[#E96008] hover:bg-[#c74c04] text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Listo (Aplicar Cambios)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
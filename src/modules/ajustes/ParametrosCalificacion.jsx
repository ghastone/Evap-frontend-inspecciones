import React, { useEffect, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';


// Valores iniciales si la base de datos aún no tiene configuración.
const defectosCalidadBase = [
  { id: 998, nombre: 'Sumatoria de calidad', limAB: 15, limBC: 20 },
  { id: 1, nombre: 'Frutos deformes / dobles', limAB: 3, limBC: 6 },
  { id: 11, nombre: 'Bajo calibre', limAB: 5, limBC: 10 },
  { id: 12, nombre: 'Sobre calibre', limAB: 5, limBC: 10 },
  { id: 2, nombre: 'Daños de trips', limAB: 6, limBC: 10 },
  { id: 13, nombre: 'Daños de insecto (otros)', limAB: 6, limBC: 10 },
  { id: 3, nombre: 'Golpe de sol', limAB: 6, limBC: 10 },
  { id: 4, nombre: 'Manchas', limAB: 6, limBC: 10 },
  { id: 5, nombre: 'Sutura (severa)', limAB: 6, limBC: 10 },
  { id: 6, nombre: 'Herida cicatrizada', limAB: 6, limBC: 10 },
  { id: 7, nombre: 'Desuniformidad de color', limAB: 6, limBC: 10 },
  { id: 8, nombre: 'Russet', limAB: 6, limBC: 15 },
  { id: 9, nombre: 'Fruta sin pedicelo', limAB: 8, limBC: 16 },
  { id: 10, nombre: 'Falta de color', limAB: 10, limBC: 20 }
];

const defectosCondicionBase = [
  { id: 999, nombre: 'Sumatoria de condición', lim12: 10, lim23: 15 },
  { id: 101, nombre: 'Pudrición', lim12: 0, lim23: 0.4 },
  { id: 102, nombre: 'Mancha parda', lim12: 0, lim23: 0.4 },
  { id: 103, nombre: 'Herida de insecto', lim12: 0, lim23: 0.4 },
  { id: 104, nombre: 'Herida de pájaro', lim12: 0, lim23: 0.4 },
  { id: 105, nombre: 'Herida abierta', lim12: 1, lim23: 3 },
  { id: 106, nombre: 'Partidura de agua', lim12: 2, lim23: 4 },
  { id: 107, nombre: 'Virosis', lim12: 2, lim23: 4 },
  { id: 108, nombre: 'Partiduras laterales', lim12: 2, lim23: 5 },
  { id: 109, nombre: 'Partiduras apicales', lim12: 2, lim23: 5 },
  { id: 110, nombre: 'Machucones', lim12: 2, lim23: 5 },
  { id: 111, nombre: 'Pitting severo', lim12: 2, lim23: 5 },
  { id: 112, nombre: 'Fruta blanda', lim12: 2, lim23: 5 },
  { id: 113, nombre: 'Sobre madurez (f. negros/ deshidratación)', lim12: 2, lim23: 5 },
  { id: 115, nombre: 'Desgarro pedicelar', lim12: 3, lim23: 6 },
  { id: 116, nombre: 'Medias lunas (anillo > 50%)', lim12: 5, lim23: 8 },
  { id: 117, nombre: 'Pitting leve', lim12: 5, lim23: 8 },
  { id: 118, nombre: 'Piel de lagarto (severa)', lim12: 5, lim23: 8 }
];

const SUM_CALIDAD = 'Sumatoria de calidad';
const SUM_CONDICION = 'Sumatoria de condición';

const API_URL = window.location.hostname.includes('goldanda.cl')
  ? 'https://evap.maq.goldanda.cl'
  : `http://${window.location.hostname || 'localhost'}:3001`;


// Helpers.
const parseNum = (valor) => {
  if (valor === null || valor === undefined) return NaN;

  const texto = String(valor).trim();
  if (!texto) return NaN;

  return Number(texto.replace(',', '.'));
};

const validDecimal = (valor) => /^\d*([.,]\d*)?$/.test(valor);

const normalizarNombre = (valor = '') =>
  valor.trim().toLocaleLowerCase('es');

const clonar = (arr) =>
  arr.map(item => ({ ...item }));

const nuevoId = () =>
  Date.now() + Math.floor(Math.random() * 10000);


export default function ParametrosCalificacion() {

  const [calidadLocal, setCalidadLocal] = useState([]);
  const [condicionLocal, setCondicionLocal] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [nuevoCalidad, setNuevoCalidad] = useState({
    nombre: '',
    limAB: '',
    limBC: ''
  });

  const [nuevoCondicion, setNuevoCondicion] = useState({
    nombre: '',
    lim12: '',
    lim23: ''
  });


  const mostrarMensaje = (tipo, texto) => {
    setMensaje({ tipo, texto });

    if (tipo === 'exito') {
      setTimeout(() => setMensaje(null), 3000);
    }
  };


  // Garantiza que las dos sumatorias siempre existan.
  const asegurarSumatoria = (lista, tipo) => {
    const copia = clonar(lista || []);

    const nombre =
      tipo === 'calidad'
        ? SUM_CALIDAD
        : SUM_CONDICION;

    const base =
      tipo === 'calidad'
        ? defectosCalidadBase[0]
        : defectosCondicionBase[0];

    if (!copia.some(item => item.nombre === nombre)) {
      copia.unshift({ ...base });
    }

    return copia;
  };


  // Carga inicial.
  useEffect(() => {

    const cargarParametros = async () => {

      try {

        const res = await fetch(`${API_URL}/api/parametros`);

        if (!res.ok) {
          throw new Error('Error al obtener parámetros');
        }

        const data = await res.json();

        const calidad =
          data?.calidad?.length
            ? data.calidad
            : defectosCalidadBase;

        const condicion =
          data?.condicion?.length
            ? data.condicion
            : defectosCondicionBase;

        setCalidadLocal(
          asegurarSumatoria(calidad, 'calidad')
        );

        setCondicionLocal(
          asegurarSumatoria(condicion, 'condicion')
        );

      } catch (error) {

        console.error(error);

        setCalidadLocal(
          clonar(defectosCalidadBase)
        );

        setCondicionLocal(
          clonar(defectosCondicionBase)
        );

        mostrarMensaje(
          'error',
          'No fue posible cargar los parámetros del servidor.'
        );

      } finally {

        setCargando(false);

      }
    };


    cargarParametros();

  }, []);


  const nombreExiste = (nombre) => {

    const buscado =
      normalizarNombre(nombre);

    return [
      ...calidadLocal,
      ...condicionLocal
    ].some(
      item =>
        normalizarNombre(item.nombre) === buscado
    );

  };


  // Edición de calidad.
  const handleCalidadChange = (index, campo, valor) => {

    if (
      campo !== 'nombre' &&
      !validDecimal(valor)
    ) return;

    if (
      campo === 'nombre' &&
      calidadLocal[index]?.nombre === SUM_CALIDAD
    ) return;

    setCalidadLocal(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [campo]: valor }
          : item
      )
    );
  };


  // Edición de condición.
  const handleCondicionChange = (index, campo, valor) => {

    if (
      campo !== 'nombre' &&
      !validDecimal(valor)
    ) return;

    if (
      campo === 'nombre' &&
      condicionLocal[index]?.nombre === SUM_CONDICION
    ) return;

    setCondicionLocal(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [campo]: valor }
          : item
      )
    );
  };


  const agregarDefectoCalidad = (e) => {

    e.preventDefault();

    const nombre =
      nuevoCalidad.nombre.trim();

    const limAB =
      parseNum(nuevoCalidad.limAB);

    const limBC =
      parseNum(nuevoCalidad.limBC);


    if (!nombre) {
      return mostrarMensaje(
        'error',
        'Ingresa el nombre del defecto.'
      );
    }

    if (nombreExiste(nombre)) {
      return mostrarMensaje(
        'error',
        `El defecto "${nombre}" ya existe.`
      );
    }

    if (
      !Number.isFinite(limAB) ||
      !Number.isFinite(limBC)
    ) {
      return mostrarMensaje(
        'error',
        'Ingresa ambas tolerancias.'
      );
    }

    if (
      limAB < 0 ||
      limAB > 100 ||
      limBC < 0 ||
      limBC > 100
    ) {
      return mostrarMensaje(
        'error',
        'Las tolerancias deben estar entre 0% y 100%.'
      );
    }

    if (limAB > limBC) {
      return mostrarMensaje(
        'error',
        'A-B no puede ser mayor que B-C.'
      );
    }


    setCalidadLocal(prev => [
      ...prev,
      {
        id: nuevoId(),
        nombre,
        limAB,
        limBC
      }
    ]);


    setNuevoCalidad({
      nombre: '',
      limAB: '',
      limBC: ''
    });
  };


  const agregarDefectoCondicion = (e) => {

    e.preventDefault();

    const nombre =
      nuevoCondicion.nombre.trim();

    const lim12 =
      parseNum(nuevoCondicion.lim12);

    const lim23 =
      parseNum(nuevoCondicion.lim23);


    if (!nombre) {
      return mostrarMensaje(
        'error',
        'Ingresa el nombre del defecto.'
      );
    }

    if (nombreExiste(nombre)) {
      return mostrarMensaje(
        'error',
        `El defecto "${nombre}" ya existe.`
      );
    }

    if (
      !Number.isFinite(lim12) ||
      !Number.isFinite(lim23)
    ) {
      return mostrarMensaje(
        'error',
        'Ingresa ambas tolerancias.'
      );
    }

    if (
      lim12 < 0 ||
      lim12 > 100 ||
      lim23 < 0 ||
      lim23 > 100
    ) {
      return mostrarMensaje(
        'error',
        'Las tolerancias deben estar entre 0% y 100%.'
      );
    }

    if (lim12 > lim23) {
      return mostrarMensaje(
        'error',
        '1-2 no puede ser mayor que 2-3.'
      );
    }


    setCondicionLocal(prev => [
      ...prev,
      {
        id: nuevoId(),
        nombre,
        lim12,
        lim23
      }
    ]);


    setNuevoCondicion({
      nombre: '',
      lim12: '',
      lim23: ''
    });
  };


  const eliminarCalidad = (index) => {

    const item =
      calidadLocal[index];

    if (
      !item ||
      item.nombre === SUM_CALIDAD
    ) return;

    if (
      window.confirm(
        `¿Eliminar el defecto "${item.nombre}"?`
      )
    ) {
      setCalidadLocal(prev =>
        prev.filter((_, i) => i !== index)
      );
    }
  };


  const eliminarCondicion = (index) => {

    const item =
      condicionLocal[index];

    if (
      !item ||
      item.nombre === SUM_CONDICION
    ) return;

    if (
      window.confirm(
        `¿Eliminar el defecto "${item.nombre}"?`
      )
    ) {
      setCondicionLocal(prev =>
        prev.filter((_, i) => i !== index)
      );
    }
  };


  const validarParametros = () => {

    const nombres =
      new Set();


    for (const item of calidadLocal) {

      const nombre =
        item.nombre?.trim();

      const lim1 =
        parseNum(item.limAB);

      const lim2 =
        parseNum(item.limBC);


      if (!nombre) {
        return 'Existe un defecto de calidad sin nombre.';
      }

      const normalizado =
        normalizarNombre(nombre);

      if (nombres.has(normalizado)) {
        return `El defecto "${nombre}" está repetido.`;
      }

      nombres.add(normalizado);


      if (
        !Number.isFinite(lim1) ||
        !Number.isFinite(lim2)
      ) {
        return `Revisa las tolerancias de "${nombre}".`;
      }

      if (
        lim1 < 0 ||
        lim1 > 100 ||
        lim2 < 0 ||
        lim2 > 100
      ) {
        return `Las tolerancias de "${nombre}" deben estar entre 0% y 100%.`;
      }

      if (lim1 > lim2) {
        return `En "${nombre}", A-B no puede ser mayor que B-C.`;
      }
    }


    for (const item of condicionLocal) {

      const nombre =
        item.nombre?.trim();

      const lim1 =
        parseNum(item.lim12);

      const lim2 =
        parseNum(item.lim23);


      if (!nombre) {
        return 'Existe un defecto de condición sin nombre.';
      }

      const normalizado =
        normalizarNombre(nombre);

      if (nombres.has(normalizado)) {
        return `El defecto "${nombre}" está repetido.`;
      }

      nombres.add(normalizado);


      if (
        !Number.isFinite(lim1) ||
        !Number.isFinite(lim2)
      ) {
        return `Revisa las tolerancias de "${nombre}".`;
      }

      if (
        lim1 < 0 ||
        lim1 > 100 ||
        lim2 < 0 ||
        lim2 > 100
      ) {
        return `Las tolerancias de "${nombre}" deben estar entre 0% y 100%.`;
      }

      if (lim1 > lim2) {
        return `En "${nombre}", 1-2 no puede ser mayor que 2-3.`;
      }
    }


    return null;
  };


  const guardarTodo = async () => {

    const error =
      validarParametros();

    if (error) {
      mostrarMensaje(
        'error',
        error
      );
      return;
    }


    const calidad =
      calidadLocal.map(item => ({
        ...item,
        nombre: item.nombre.trim(),
        limAB: parseNum(item.limAB),
        limBC: parseNum(item.limBC)
      }));


    const condicion =
      condicionLocal.map(item => ({
        ...item,
        nombre: item.nombre.trim(),
        lim12: parseNum(item.lim12),
        lim23: parseNum(item.lim23)
      }));


    setGuardando(true);
    setMensaje(null);


    try {

      const res = await fetch(
        `${API_URL}/api/parametros`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            calidad,
            condicion
          })
        }
      );


      if (!res.ok) {

        const data = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error ||
          'Error al guardar parámetros.'
        );
      }


      setCalidadLocal(calidad);
      setCondicionLocal(condicion);


      mostrarMensaje(
        'exito',
        'Parámetros actualizados correctamente.'
      );


    } catch (error) {

      console.error(error);

      mostrarMensaje(
        'error',
        error.message ||
        'No fue posible guardar los parámetros.'
      );


    } finally {

      setGuardando(false);

    }
  };


  // Clases compartidas.
  const inputNombre = `
    w-full h-9 bg-transparent border border-transparent rounded-lg px-2
    text-[11px] md:text-xs font-semibold text-slate-700 outline-none transition-all
    hover:bg-white hover:border-slate-200 focus:bg-white
  `;

  const inputNumero = `
    w-full h-9 bg-white border border-slate-200 rounded-lg px-2 pr-6
    text-center text-[11px] md:text-xs font-bold text-slate-800 outline-none transition-all
  `;


  if (cargando) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold">
        Cargando parámetros de calificación...
      </div>
    );
  }


  return (

    <div className="bg-white rounded-[2rem] p-5 md:p-7 shadow-sm border border-slate-100 max-w-[1500px] mx-auto space-y-4 animate-fade-in">


      {/* Mensaje */}
      {mensaje && (

        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl font-bold shadow-xl flex items-center gap-2 ${
            mensaje.tipo === 'exito'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >

          {mensaje.tipo === 'exito'
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />
          }

          <span className="text-sm">
            {mensaje.texto}
          </span>

        </div>

      )}


      {/* Encabezado */}
      <div className="pb-1">

        <div className="flex items-center gap-3">

          <div className="w-1.5 h-8 bg-[#E96008] rounded-full" />

          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            Tolerancias y Calificación
          </h2>

        </div>

        <p className="text-sm text-slate-500 mt-1 ml-4 font-medium">
          Administra los defectos utilizados en las inspecciones y define sus tolerancias de calificación.
        </p>

      </div>


      {/* ====================================================
          DOS COLUMNAS
      ==================================================== */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">


        {/* ==================================================
            CALIDAD
        ================================================== */}

        <div className="bg-slate-50/50 px-4 py-4 rounded-2xl border border-slate-100 min-w-0">

          <div className="flex items-center justify-between mb-2">

            <h3 className="font-black text-[#E96008] text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E96008]" />
              Defectos de Calidad
            </h3>

            <span className="text-[11px] font-semibold text-slate-400">
              {Math.max(0, calidadLocal.length - 1)} defectos
            </span>

          </div>


          {/* Cabecera */}
          <div className="grid grid-cols-12 gap-2 text-[9px] font-black text-slate-400 uppercase tracking-wider pb-2 px-2 border-b border-slate-200">

            <div className="col-span-5">
              Defecto
            </div>

            <div className="col-span-3 text-center">
              A - B (%)
            </div>

            <div className="col-span-3 text-center">
              B - C (%)
            </div>

            <div className="col-span-1" />

          </div>


          {/* Lista calidad */}
          <div className="divide-y divide-slate-100">

            {calidadLocal.map((item, index) => {

              const esSumatoria =
                item.nombre === SUM_CALIDAD;

              return (

                <div
                  key={item.id ?? `cal-${index}`}
                  className={`grid grid-cols-12 gap-2 items-center px-2 py-1 ${
                    esSumatoria
                      ? 'bg-orange-50/80 rounded-xl border border-orange-100 my-1.5'
                      : 'hover:bg-white'
                  }`}
                >


                  {/* Nombre */}
                  <div className="col-span-5 min-w-0">

                    {esSumatoria ? (

                      <div className="h-9 flex items-center px-2">

                        <span className="font-black text-[11px] md:text-xs text-slate-800 truncate">
                          {item.nombre}
                        </span>

                      </div>

                    ) : (

                      <input
                        type="text"
                        value={item.nombre}
                        onChange={e =>
                          handleCalidadChange(
                            index,
                            'nombre',
                            e.target.value
                          )
                        }
                        className={`${inputNombre} focus:border-[#E96008] focus:ring-2 focus:ring-orange-100`}
                      />

                    )}

                  </div>


                  {/* A-B */}
                  <div className="col-span-3 relative">

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.limAB}
                      onChange={e =>
                        handleCalidadChange(
                          index,
                          'limAB',
                          e.target.value
                        )
                      }
                      className={`${inputNumero} focus:border-[#E96008] focus:ring-2 focus:ring-orange-100`}
                    />

                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      %
                    </span>

                  </div>


                  {/* B-C */}
                  <div className="col-span-3 relative">

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.limBC}
                      onChange={e =>
                        handleCalidadChange(
                          index,
                          'limBC',
                          e.target.value
                        )
                      }
                      className={`${inputNumero} focus:border-[#E96008] focus:ring-2 focus:ring-orange-100`}
                    />

                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      %
                    </span>

                  </div>


                  {/* Eliminar */}
                  <div className="col-span-1 flex justify-end">

                    {!esSumatoria && (

                      <button
                        type="button"
                        onClick={() =>
                          eliminarCalidad(index)
                        }
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar defecto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    )}

                  </div>

                </div>

              );

            })}

          </div>


          {/* Agregar calidad */}
          <form
            onSubmit={agregarDefectoCalidad}
            className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t border-slate-200"
          >

            <input
              type="text"
              placeholder="Nuevo defecto..."
              value={nuevoCalidad.nombre}
              onChange={e =>
                setNuevoCalidad({
                  ...nuevoCalidad,
                  nombre: e.target.value
                })
              }
              className="col-span-5 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] font-semibold outline-none focus:border-[#E96008]"
            />

            <input
              type="text"
              inputMode="decimal"
              placeholder="A-B"
              value={nuevoCalidad.limAB}
              onChange={e => {

                if (validDecimal(e.target.value)) {

                  setNuevoCalidad({
                    ...nuevoCalidad,
                    limAB: e.target.value
                  });

                }

              }}
              className="col-span-3 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-center font-bold outline-none focus:border-[#E96008]"
            />

            <input
              type="text"
              inputMode="decimal"
              placeholder="B-C"
              value={nuevoCalidad.limBC}
              onChange={e => {

                if (validDecimal(e.target.value)) {

                  setNuevoCalidad({
                    ...nuevoCalidad,
                    limBC: e.target.value
                  });

                }

              }}
              className="col-span-3 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-center font-bold outline-none focus:border-[#E96008]"
            />

            <button
              type="submit"
              className="col-span-1 h-9 bg-[#E96008] hover:bg-[#d95506] text-white rounded-lg flex items-center justify-center transition-colors"
              title="Agregar defecto"
            >
              <Plus className="w-4 h-4" />
            </button>

          </form>

        </div>


        {/* ==================================================
            CONDICIÓN
        ================================================== */}

        <div className="bg-slate-50/50 px-4 py-4 rounded-2xl border border-slate-100 min-w-0">

          <div className="flex items-center justify-between mb-2">

            <h3 className="font-black text-red-600 text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              Defectos de Condición
            </h3>

            <span className="text-[11px] font-semibold text-slate-400">
              {Math.max(0, condicionLocal.length - 1)} defectos
            </span>

          </div>


          {/* Cabecera */}
          <div className="grid grid-cols-12 gap-2 text-[9px] font-black text-slate-400 uppercase tracking-wider pb-2 px-2 border-b border-slate-200">

            <div className="col-span-5">
              Defecto
            </div>

            <div className="col-span-3 text-center">
              1 - 2 (%)
            </div>

            <div className="col-span-3 text-center">
              2 - 3 (%)
            </div>

            <div className="col-span-1" />

          </div>


          {/* Lista condición */}
          <div className="divide-y divide-slate-100">

            {condicionLocal.map((item, index) => {

              const esSumatoria =
                item.nombre === SUM_CONDICION;

              return (

                <div
                  key={item.id ?? `cond-${index}`}
                  className={`grid grid-cols-12 gap-2 items-center px-2 py-1 ${
                    esSumatoria
                      ? 'bg-red-50/80 rounded-xl border border-red-100 my-1.5'
                      : 'hover:bg-white'
                  }`}
                >


                  {/* Nombre */}
                  <div className="col-span-5 min-w-0">

                    {esSumatoria ? (

                      <div className="h-9 flex items-center px-2">

                        <span className="font-black text-[11px] md:text-xs text-slate-800 truncate">
                          {item.nombre}
                        </span>

                      </div>

                    ) : (

                      <input
                        type="text"
                        value={item.nombre}
                        onChange={e =>
                          handleCondicionChange(
                            index,
                            'nombre',
                            e.target.value
                          )
                        }
                        className={`${inputNombre} focus:border-red-500 focus:ring-2 focus:ring-red-100`}
                      />

                    )}

                  </div>


                  {/* 1-2 */}
                  <div className="col-span-3 relative">

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.lim12}
                      onChange={e =>
                        handleCondicionChange(
                          index,
                          'lim12',
                          e.target.value
                        )
                      }
                      className={`${inputNumero} focus:border-red-500 focus:ring-2 focus:ring-red-100`}
                    />

                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      %
                    </span>

                  </div>


                  {/* 2-3 */}
                  <div className="col-span-3 relative">

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.lim23}
                      onChange={e =>
                        handleCondicionChange(
                          index,
                          'lim23',
                          e.target.value
                        )
                      }
                      className={`${inputNumero} focus:border-red-500 focus:ring-2 focus:ring-red-100`}
                    />

                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      %
                    </span>

                  </div>


                  {/* Eliminar */}
                  <div className="col-span-1 flex justify-end">

                    {!esSumatoria && (

                      <button
                        type="button"
                        onClick={() =>
                          eliminarCondicion(index)
                        }
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar defecto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    )}

                  </div>

                </div>

              );

            })}

          </div>


          {/* Agregar condición */}
          <form
            onSubmit={agregarDefectoCondicion}
            className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t border-slate-200"
          >

            <input
              type="text"
              placeholder="Nuevo defecto..."
              value={nuevoCondicion.nombre}
              onChange={e =>
                setNuevoCondicion({
                  ...nuevoCondicion,
                  nombre: e.target.value
                })
              }
              className="col-span-5 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] font-semibold outline-none focus:border-red-500"
            />

            <input
              type="text"
              inputMode="decimal"
              placeholder="1-2"
              value={nuevoCondicion.lim12}
              onChange={e => {

                if (validDecimal(e.target.value)) {

                  setNuevoCondicion({
                    ...nuevoCondicion,
                    lim12: e.target.value
                  });

                }

              }}
              className="col-span-3 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-center font-bold outline-none focus:border-red-500"
            />

            <input
              type="text"
              inputMode="decimal"
              placeholder="2-3"
              value={nuevoCondicion.lim23}
              onChange={e => {

                if (validDecimal(e.target.value)) {

                  setNuevoCondicion({
                    ...nuevoCondicion,
                    lim23: e.target.value
                  });

                }

              }}
              className="col-span-3 h-9 bg-white border border-slate-200 rounded-lg px-2 text-[11px] text-center font-bold outline-none focus:border-red-500"
            />

            <button
              type="submit"
              className="col-span-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-colors"
              title="Agregar defecto"
            >
              <Plus className="w-4 h-4" />
            </button>

          </form>

        </div>

      </div>


      {/* Guardar ambas secciones */}
      <div className="flex justify-end pt-1">

        <button
          type="button"
          onClick={guardarTodo}
          disabled={guardando}
          className="flex items-center gap-2 px-6 py-3 bg-[#E96008] hover:bg-[#c74c04] disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl text-sm shadow-md transition-all"
        >

          <Save className="w-4 h-4" />

          {guardando
            ? 'Guardando...'
            : 'Guardar cambios'
          }

        </button>

      </div>

    </div>
  );
}
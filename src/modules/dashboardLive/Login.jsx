import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, EyeOff, Eye, Building2, ShieldCheck, Check } from 'lucide-react';
import { API_URL } from '../../config/api.js';

// Estos nombres identifican la planta; NO seleccionan una API ni una base de datos.
// La direccion de todas las solicitudes proviene exclusivamente de config/api.js.
const NOMBRES_PLANTA = Object.freeze({ MAQ: 'Maquehua', ROS: 'Rosario' });
const PLANTA_POR_HOST = Object.freeze({
  'evap.maq.goldanda.cl': 'MAQ',
  '192.168.0.10': 'MAQ',
  'evap.ros.goldanda.cl': 'ROS',
  '192.168.10.10': 'ROS',
});
const TIEMPO_ESPERA_MS = 15000;

/** Solicita JSON a la API seleccionada, sin cambiar de planta ni seguir redirecciones. */
async function solicitarJson(ruta, opciones = {}, signalExterno) {
  const controller = new AbortController();
  let tiempoAgotado = false;
  const abortar = () => controller.abort();
  if (signalExterno?.aborted) controller.abort();
  signalExterno?.addEventListener('abort', abortar, { once: true });
  const temporizador = setTimeout(() => {
    tiempoAgotado = true;
    controller.abort();
  }, TIEMPO_ESPERA_MS);

  try {
    const response = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch (err) {
      if (controller.signal.aborted) throw err;
      throw new Error(
        `El servidor no devolvió JSON válido en ${ruta} (HTTP ${response.status}). Revisa el backend y el proxy /api.`
      );
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`La respuesta de ${ruta} no tiene el formato esperado.`);
    }
    return { response, data };
  } catch (err) {
    if (tiempoAgotado && !signalExterno?.aborted) {
      throw new Error('El servidor demoró demasiado en responder. Comprueba la conexión e inténtalo nuevamente.');
    }
    if (controller.signal.aborted) throw err;
    if (err instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor backend. Revisa la conexión y la configuración de la API.');
    }
    throw err;
  } finally {
    clearTimeout(temporizador);
    signalExterno?.removeEventListener('abort', abortar);
  }
}

/** Confirma la identidad declarada por el backend; no consulta credenciales ni PostgreSQL. */
async function consultarPlanta(signal) {
  const { response, data } = await solicitarJson('/api/planta', { method: 'GET' }, signal);
  if (!response.ok) {
    throw new Error(`No se pudo verificar la planta (HTTP ${response.status}). Comprueba que el backend tenga disponible /api/planta.`);
  }
  const plantaId = String(data.plantaId || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(NOMBRES_PLANTA, plantaId)) {
    throw new Error('El backend no informó una planta válida: debe indicar MAQ o ROS.');
  }
  const hostname = window.location.hostname.toLowerCase().replace(/\.$/, '');
  const esperada = Object.prototype.hasOwnProperty.call(PLANTA_POR_HOST, hostname)
    ? PLANTA_POR_HOST[hostname]
    : null;
  if (esperada && esperada !== plantaId) {
    throw new Error(`Esta dirección corresponde a ${NOMBRES_PLANTA[esperada]}, pero el backend informa ${NOMBRES_PLANTA[plantaId]}. No se enviaron credenciales. Revisa el proxy y PLANTA_ID.`);
  }
  // En localhost o en otro equipo de desarrollo, la planta la declara el backend.
  return { plantaId, plantaNombre: NOMBRES_PLANTA[plantaId] };
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recordarSesion, setRecordarSesion] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [planta, setPlanta] = useState(null);
  const [errorPlanta, setErrorPlanta] = useState('');
  const [verificandoPlanta, setVerificandoPlanta] = useState(true);
  const solicitudLoginRef = useRef(null);

  useEffect(() => {
    let activo = true;
    const controller = new AbortController();
    consultarPlanta(controller.signal)
      .then((resultado) => {
        if (!activo) return;
        setPlanta(resultado);
        setErrorPlanta('');
      })
      .catch((err) => {
        if (!activo || controller.signal.aborted) return;
        setPlanta(null);
        setErrorPlanta(err.message || 'No se pudo identificar la planta.');
      })
      .finally(() => {
        if (activo) setVerificandoPlanta(false);
      });
    return () => {
      activo = false;
      controller.abort();
      solicitudLoginRef.current?.abort();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (verificandoPlanta || solicitudLoginRef.current) return;
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }
    const controller = new AbortController();
    solicitudLoginRef.current = controller;
    setCargando(true);
    setErrorPlanta('');

    try {
      // Se vuelve a comprobar ANTES de enviar usuario y clave. Un fallo permite
      // reintentar con el mismo boton; nunca se busca un backend de otra planta.
      let plantaConfirmada;
      try {
        plantaConfirmada = await consultarPlanta(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) setPlanta(null);
        throw err;
      }
      if (controller.signal.aborted) return;
      setPlanta(plantaConfirmada);
      if (planta && planta.plantaId !== plantaConfirmada.plantaId) {
        setError(`El backend cambió de ${planta.plantaNombre} a ${plantaConfirmada.plantaNombre}. Revisa la planta mostrada y pulsa Ingresar nuevamente. No se enviaron credenciales.`);
        return;
      }

      const { response, data } = await solicitarJson('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se conserva el contrato y el tratamiento de espacios del backend actual.
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (response.ok && data.success === true) {
        if (!data.user || typeof data.user !== 'object' || Array.isArray(data.user)) {
          throw new Error('El servidor confirmó el acceso, pero no devolvió los datos del usuario.');
        }
        // App.jsx sigue recibiendo exactamente el objeto de usuario del backend.
        onLogin(data.user);
      } else {
        setError(typeof data.message === 'string' && data.message
          ? data.message
          : 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Error al iniciar sesión:', err);
        setError(err.message || 'No se pudo conectar con el servidor backend.');
      }
    } finally {
      if (solicitudLoginRef.current === controller) solicitudLoginRef.current = null;
      if (!controller.signal.aborted) setCargando(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#F3F6F9] overflow-hidden font-sans">
      
      {/* FONDO DECORATIVO */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[#F4F7FA] overflow-hidden">
        
        {/* Patrón de puntos superior izquierdo */}
        <svg className="absolute top-12 left-12 opacity-[0.2]" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotGridTL" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="2.5" fill="#64748B" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGridTL)" />
        </svg>

        {/* Patrón de puntos inferior derecho */}
        <svg className="absolute bottom-12 right-12 opacity-[0.2]" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotGridBR" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="2.5" fill="#64748B" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGridBR)" />
        </svg>

        {/* Grupo de Ondas Suaves Superpuestas */}
        <div className="absolute inset-0 opacity-80">
          
          <svg className="absolute top-0 left-0 w-full h-[65%] object-cover object-left-top" viewBox="0 0 1440 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#FFFFFF" d="M0,0 L0,350 C300,450 450,250 850,300 C1150,337 1300,200 1440,150 L1440,0 Z"></path>
            <path fill="none" stroke="#E2E8F0" strokeWidth="2" d="M0,350 C300,450 450,250 850,300 C1150,337 1300,200 1440,150"></path>
          </svg>

          <svg className="absolute bottom-0 right-0 w-full h-[75%] object-cover object-right-bottom" viewBox="0 0 1440 600" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F1F5F9" opacity="0.6" d="M1440,600 L1440,200 C1050,100 900,450 450,400 C200,370 80,480 0,550 L0,600 Z"></path>
            <path fill="#FFFFFF" opacity="0.9" d="M1440,600 L1440,300 C1100,250 950,550 500,500 C250,475 100,580 0,600 Z"></path>
            <path fill="none" stroke="#E2E8F0" strokeWidth="3" opacity="0.7" d="M1440,300 C1100,250 950,550 500,500 C250,475 100,580 0,600"></path>
          </svg>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white rounded-full blur-[100px] opacity-70"></div>
          
        </div>
      </div>

      {/* TARJETA DE LOGIN (Glassmorphism sutil) */}
      <div className="relative z-10 bg-white/95 backdrop-blur-xl w-full max-w-[420px] rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-white/60 p-10 mx-4">
        
        {/* Encabezado: Logo y Título */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/Logo_goldanda.png" 
            alt="Gold Anda Logo" 
            className="h-16 w-auto object-contain mb-5"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-[26px] font-light text-slate-800 tracking-wide">
            Qc Evap <span className="font-semibold text-[#E96008]">+</span>
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Input Usuario */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-[18px] w-[18px] text-slate-400 group-focus-within:text-[#E96008] transition-colors duration-300" />
            </div>
            <input
              type="text"
              placeholder="Usuario"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-medium text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#E96008] focus:ring-4 focus:ring-[#E96008]/10 transition-all duration-300"
            />
          </div>

          {/* Input Contraseña */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-[18px] w-[18px] text-slate-400 group-focus-within:text-[#E96008] transition-colors duration-300" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-12 py-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-[14px] font-medium text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#E96008] focus:ring-4 focus:ring-[#E96008]/10 transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#E96008] focus:outline-none transition-colors"
            >
              {showPassword ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
          </div>

          {/* Input Planta / Ubicación */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Building2 className="h-[18px] w-[18px] text-slate-400 opacity-60" />
            </div>
            <input
              type="text"
              value={planta?.plantaNombre || (verificandoPlanta ? 'Verificando planta...' : 'No disponible')}
              readOnly
              className="w-full pl-11 pr-4 py-3.5 bg-slate-100/60 border border-slate-200/50 rounded-2xl text-[14px] font-medium text-slate-500 focus:outline-none cursor-not-allowed select-none"
            />
          </div>

          {/* Error de validación */}
          {(error || errorPlanta) && <p className="text-red-500 text-[13px] text-center font-bold bg-red-50 py-2 rounded-xl border border-red-100 animate-fade-in">{error || errorPlanta}</p>}

          {/* Opciones extra */}
          <div className="flex items-center justify-between pt-1 pb-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-[16px] h-[16px] border rounded flex items-center justify-center transition-all duration-200 ${recordarSesion ? 'bg-[#E96008] border-[#E96008]' : 'bg-white border-slate-300 group-hover:border-[#E96008]'}`}>
                <Check className={`w-3 h-3 text-white transition-opacity ${recordarSesion ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
              </div>
              {/* Ocultamos el checkbox real */}
              <input 
                type="checkbox" 
                className="hidden" 
                checked={recordarSesion} 
                onChange={() => setRecordarSesion(!recordarSesion)} 
              />
              <span className="text-[12px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors">Recordar sesión</span>
            </label>
            <a href="#" className="text-[12px] font-bold text-[#E96008] hover:text-[#C44D06] transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={cargando || verificandoPlanta}
            className="w-full bg-gradient-to-r from-[#E96008] to-[#d95604] hover:shadow-lg hover:shadow-[#E96008]/25 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white text-[15px] font-bold py-3.5 rounded-full active:scale-[0.98] transition-all duration-300 flex items-center justify-center"
          >
            {cargando ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando sesión...
              </span>
            ) : 'Ingresar'}
          </button>
        </form>

        {/* Divisor con punto central */}
        <div className="mt-8 flex items-center justify-center gap-3 opacity-60">
          <div className="h-px bg-slate-200 flex-1"></div>
          <div className="w-1.5 h-1.5 rounded-full border-2 border-slate-300 bg-white"></div>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        {/* Pie de tarjeta */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          <span className="text-[12px] font-bold tracking-wide">Acceso Seguro</span>
        </div>

      </div>

      {/* INDICADOR DE VERSIÓN (Esquina inferior derecha) */}
      <div className="absolute bottom-3 right-4 z-20 text-[10px] text-slate-400/80 font-black tracking-widest uppercase select-none">
        beta 1.10
      </div>

    </div>
  );
}
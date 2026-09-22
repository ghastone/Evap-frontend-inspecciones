import React, { useState } from 'react';
import { User, Lock, EyeOff, Eye, Building2, ShieldCheck } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setCargando(true);

    try {
      // Detección automática de la API (Producción vs Desarrollo)
      const API_URL = import.meta.env.PROD 
        ? 'https://evap.maq.goldanda.cl' 
        : `http://${window.location.hostname || 'localhost'}:3001`;

      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password.trim() 
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Pasa todo el objeto del usuario devuelto por PostgreSQL (id, username, role, permisos)
        onLogin(data.user);
      } else {
        setError(data.message || 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setError('No se pudo conectar con el servidor backend.');
    } finally {
      setCargando(false);
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

      {/* TARJETA DE LOGIN */}
      <div className="relative z-10 bg-white w-full max-w-[420px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-10 mx-4">
        
        {/* Encabezado: Logo y Título */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/Logo_goldanda.png" 
            alt="Gold Anda Logo" 
            className="h-16 w-auto object-contain mb-5"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 className="text-[26px] font-light text-slate-800 tracking-wide">
            Qc Evap <span className="font-extralight text-slate-500">+</span>
          </h1>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Input Usuario */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-[18px] w-[18px] text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="usuario"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-[14px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#E96008] focus:ring-1 focus:ring-[#E96008] transition-colors"
            />
          </div>

          {/* Input Contraseña */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-[18px] w-[18px] text-slate-400" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl text-[14px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#E96008] focus:ring-1 focus:ring-[#E96008] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showPassword ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
          </div>

          {/* Input Planta / Ubicación */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Building2 className="h-[18px] w-[18px] text-slate-400" />
            </div>
            <input
              type="text"
              defaultValue="Maquehua"
              readOnly
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-[14px] text-slate-700 focus:outline-none cursor-default"
            />
          </div>

          {/* Error de validación */}
          {error && <p className="text-red-500 text-[13px] text-center font-medium animate-pulse">{error}</p>}

          {/* Opciones extra */}
          <div className="flex items-center justify-between pt-1 pb-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="w-[16px] h-[16px] border border-slate-300 rounded flex items-center justify-center group-hover:border-[#E96008] transition-colors">
                <input type="checkbox" className="hidden" />
              </div>
              <span className="text-[12px] text-slate-500">Recordar sesión</span>
            </label>
            <a href="#" className="text-[12px] text-[#E96008] hover:text-[#C44D06] transition-colors">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-[#E96008] hover:bg-[#D45607] disabled:opacity-60 text-white text-[15px] font-bold py-3.5 rounded-full shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center"
          >
            {cargando ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>

        {/* Divisor con punto central */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="h-px bg-slate-100 flex-1"></div>
          <div className="w-1.5 h-1.5 rounded-full border-2 border-slate-200 bg-white"></div>
          <div className="h-px bg-slate-100 flex-1"></div>
        </div>

        {/* Pie de tarjeta */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
          <span className="text-[12px] font-medium">Acceso seguro</span>
        </div>

      </div>
    </div>
  );
}
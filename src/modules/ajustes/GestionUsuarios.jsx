import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit3, Trash2, Key, Users, ShieldCheck, User, CheckSquare, Square } from 'lucide-react';
import { API_URL } from '../../config/api.js';
const PLANTAS = { MAQ: 'Maquehua', ROS: 'Rosario' };
const PLANTA_POR_HOST = { 'evap.maq.goldanda.cl': 'MAQ', 'evap.ros.goldanda.cl': 'ROS', '192.168.0.10': 'MAQ', '192.168.10.10': 'ROS' };
const verificarPlanta = async () => {
  const res = await fetch(`${API_URL}/api/planta`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No fue posible verificar la identidad de la planta.');
  const data = await res.json();
  const id = String(data?.plantaId || '').trim().toUpperCase();
  if (!PLANTAS[id]) throw new Error('El backend no informó una planta válida.');
  const host = window.location.hostname.toLowerCase().replace(/\.$/, '');
  const esperada = PLANTA_POR_HOST[host];
  if (esperada && esperada !== id) throw new Error(`El sitio corresponde a ${PLANTAS[esperada]}, pero el backend informa ${PLANTAS[id]}.`);
  return { id, nombre: PLANTAS[id] };
};
export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planta, setPlanta] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  // Estado para el modal de Crear/Editar
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const getPermisosPorDefecto = (role) => {
    if (role === 'admin') return { crear_proceso: true, editar_informes: true, ver_dashboard: true, ver_historial: true, acceder_digitacion: true, eliminar_procesos: true, gestionar_ajustes: true };
    if (role === 'qc_avanzado') return { crear_proceso: true, editar_informes: true, ver_dashboard: true, ver_historial: true, acceder_digitacion: true, eliminar_procesos: true, gestionar_ajustes: false };
    if (role === 'gerencia') return { crear_proceso: false, editar_informes: false, ver_dashboard: true, ver_historial: true, acceder_digitacion: false, eliminar_procesos: false, gestionar_ajustes: false };
    return { crear_proceso: true, editar_informes: true, ver_dashboard: true, ver_historial: true, acceder_digitacion: false, eliminar_procesos: false, gestionar_ajustes: false };
  };
  const [formData, setFormData] = useState({
    id: null,
    username: '',
    password: '',
    role: 'qc',
    permisos: getPermisosPorDefecto('qc')
  });
  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    setErrorCarga('');
    setPlanta(null);
    try {
      const identidad = await verificarPlanta();
      const response = await fetch(`${API_URL}/api/usuarios`, { cache: 'no-store' });
      if (!response.ok) throw new Error('No fue posible cargar los usuarios del servidor.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('La respuesta del servidor no contiene una lista de usuarios válida.');
      setUsuarios(data);
      setPlanta(identidad);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setUsuarios([]);
      setErrorCarga(error.message || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setFormData({
      ...formData,
      role: newRole,
      permisos: getPermisosPorDefecto(newRole) // Actualiza el checklist automáticamente
    });
  };
  const togglePermiso = (llavePermiso) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [llavePermiso]: !prev.permisos[llavePermiso]
      }
    }));
  };
  const abrirModalCrear = () => {
    setIsEditing(false);
    setFormData({
      id: null,
      username: '',
      password: '',
      role: 'qc',
      permisos: getPermisosPorDefecto('qc')
    });
    setShowModal(true);
  };
  const abrirModalEditar = (user) => {
    setIsEditing(true);
    setFormData({
      id: user.id || user._id,
      username: user.username,
      password: '',
      role: user.role,
      permisos: { ...getPermisosPorDefecto(user.role), ...(user.permisos || {}) }
    });
    setShowModal(true);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!planta || guardando || eliminandoId !== null) return;
    if (!formData.username.trim() || (!isEditing && !formData.password.trim())) {
      alert('Por favor, completa el usuario y contraseña.');
      return;
    }
    if (isEditing && (formData.id === null || formData.id === undefined)) {
      alert('No se pudo identificar al usuario para editar.');
      return;
    }
    setGuardando(true);
    try {
      const identidad = await verificarPlanta();
      if (identidad.id !== planta.id) throw new Error('Cambió la planta del servidor. Recarga los usuarios antes de continuar.');
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${API_URL}/api/usuarios/${formData.id}` : `${API_URL}/api/usuarios`;
      const payload = { username: formData.username.trim(), role: formData.role, permisos: formData.permisos };
      if (formData.password.trim()) payload.password = formData.password.trim();
      const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'No se pudo guardar el usuario.');
      }
      setShowModal(false);
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      alert(error.message || 'Error de red al conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  };
  const eliminarUsuario = async (id, username) => {
    if (!planta || guardando || eliminandoId !== null) return;
    if (usuarios.some(u => String(u.id ?? u._id) === String(id) && u.role === 'admin')) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${username}"?`)) return;
    setEliminandoId(id);
    try {
      const identidad = await verificarPlanta();
      if (identidad.id !== planta.id) throw new Error('Cambió la planta del servidor. Recarga los usuarios antes de continuar.');
      const response = await fetch(`${API_URL}/api/usuarios/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Error al intentar eliminar el usuario.');
      }
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      alert(error.message || 'Error de red al conectar con el servidor.');
    } finally {
      setEliminandoId(null);
    }
  };
  const formatRole = (role) => {
    if (role === 'admin') return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">Administrador</span>;
    if (role === 'qc_avanzado') return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">Control Calidad (QC) avanzado</span>;
    if (role === 'qc') return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">Control Calidad (QC)</span>;
    if (role === 'gerencia') return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">Gerencia</span>;
    return role;
  };
  const usuariosFiltrados = usuarios.filter(u =>
    String(u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Users className="w-7 h-7 text-[#E96008]" /> Gestión de Usuarios
          </h2>
          <p className="text-slate-500 text-sm mt-1">Crea cuentas y personaliza los permisos de plataforma.</p>
          {planta && <p className="text-xs font-semibold text-slate-400 mt-1">Planta: {planta.nombre}</p>}
        </div>
        <button
          onClick={abrirModalCrear}
          disabled={!planta || loading || guardando || eliminandoId !== null}
          className="flex items-center justify-center gap-2 bg-[#E96008] hover:bg-[#c74c04] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors"
        >
          <Plus className="w-5 h-5" /> Nuevo Usuario
        </button>
      </div>
      {errorCarga && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700">
          <span>{errorCarga} No se pueden gestionar usuarios hasta restablecer la conexión.</span>
          <button type="button" onClick={cargarUsuarios} className="font-bold underline underline-offset-2">Reintentar</button>
        </div>
      )}
      {/* BUSCADOR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nombre de usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full outline-none text-slate-700 bg-transparent font-medium"
        />
      </div>
      {/* TABLA DE USUARIOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-black">Usuario</th>
                <th className="p-4 font-black">Nivel de Acceso</th>
                <th className="p-4 font-black text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-slate-500 font-medium">Cargando usuarios...</td>
                </tr>
              ) : errorCarga ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-red-600 font-medium">No se pudo verificar la lista de usuarios de esta planta.</td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-slate-500 font-medium">No se encontraron usuarios.</td>
                </tr>
              ) : (
                usuariosFiltrados.map((user) => (
                  <tr key={user.id || user._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      {user.username}
                    </td>
                    <td className="p-4">
                      {formatRole(user.role)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirModalEditar(user)}
                          disabled={!planta || guardando || eliminandoId !== null}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => eliminarUsuario(user.id || user._id, user.username)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Eliminar usuario"
                          disabled={!planta || user.role === 'admin' || guardando || eliminandoId !== null} // Evita borrar administradores desde la interfaz
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
          {/* Se añadió max-h-[90vh] y overflow-y-auto para evitar que el modal sobrepase la pantalla */}
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 shrink-0 rounded-t-3xl">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                {isEditing ? <Edit3 className="w-6 h-6 text-[#E96008]" /> : <ShieldCheck className="w-6 h-6 text-[#E96008]" />}
                {isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </h3>
            </div>
            {/* Contenedor escroleable */}
            <div className="overflow-y-auto custom-scrollbar flex-1">
              <form id="userForm" onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* 1. Datos de Acceso */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de Usuario (Login)</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-slate-700 font-medium outline-none focus:border-[#E96008] focus:ring-1 focus:ring-[#E96008]"
                        placeholder="Ej. juan.perez"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Contraseña {isEditing && <span className="text-slate-400 text-[10px] normal-case ml-2">(Dejar en blanco para no cambiar)</span>}
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        autoComplete="new-password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-slate-700 font-medium outline-none focus:border-[#E96008] focus:ring-1 focus:ring-[#E96008]"
                        placeholder="Escriba la clave..."
                        required={!isEditing}
                      />
                    </div>
                  </div>
                </div>
                {/* 2. Selector Rápido de Rol */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perfil Base</label>
                  <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'admin' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="role" value="admin" checked={formData.role === 'admin'} onChange={handleRoleChange} className="w-4 h-4 text-purple-600 focus:ring-purple-500" />
                      <div>
                        <p className="font-bold text-sm text-slate-800">Administrador</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Activa todos los permisos por defecto.</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'qc_avanzado' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="role" value="qc_avanzado" checked={formData.role === 'qc_avanzado'} onChange={handleRoleChange} className="w-4 h-4 text-orange-600 focus:ring-orange-500" />
                      <div>
                        <p className="font-bold text-sm text-slate-800">Control Calidad (QC) avanzado</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Incluye digitación y permiso para eliminar procesos.</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'qc' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="role" value="qc" checked={formData.role === 'qc'} onChange={handleRoleChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                      <div>
                        <p className="font-bold text-sm text-slate-800">Control Calidad (QC)</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Permite crear procesos y ver historial.</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.role === 'gerencia' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="role" value="gerencia" checked={formData.role === 'gerencia'} onChange={handleRoleChange} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                      <div>
                        <p className="font-bold text-sm text-slate-800">Gerencia</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Solo lectura para dashboards e historial.</p>
                      </div>
                    </label>
                  </div>
                </div>
                {/* 3. Checklist de Permisos Personalizados */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Permisos Específicos (Avanzado)</label>
                  <div className="space-y-2">
                    <button type="button" onClick={() => togglePermiso('crear_proceso')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.crear_proceso ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.crear_proceso ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede crear nuevas inspecciones</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('editar_informes')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.editar_informes ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.editar_informes ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede editar informes existentes</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('ver_dashboard')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.ver_dashboard ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.ver_dashboard ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede ver Dashboard en vivo</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('ver_historial')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.ver_historial ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.ver_historial ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede acceder al Historial de procesos</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('acceder_digitacion')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.acceder_digitacion ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.acceder_digitacion ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede acceder a Digitación / Temperatura en línea</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('eliminar_procesos')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.eliminar_procesos ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.eliminar_procesos ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Puede eliminar procesos</span>
                    </button>
                    <button type="button" onClick={() => togglePermiso('gestionar_ajustes')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.gestionar_ajustes ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.gestionar_ajustes ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Acceso total a ajustes</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
            {/* Footer Fijo con botones */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3 rounded-b-3xl">
              <button type="button" onClick={() => setShowModal(false)} disabled={guardando} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 bg-white border border-slate-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" form="userForm" disabled={guardando || !planta} className="flex-1 py-3 bg-[#E96008] hover:bg-[#c74c04] text-white font-bold rounded-xl shadow-md transition-colors">
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

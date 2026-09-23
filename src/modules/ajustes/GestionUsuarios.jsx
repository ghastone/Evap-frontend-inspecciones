import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, Key, Users, ShieldCheck, User, CheckSquare, Square } from 'lucide-react';

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para el modal de Crear/Editar
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Función para obtener los permisos predeterminados según el rol
  const getPermisosPorDefecto = (role) => {
    if (role === 'admin') {
      return { crear_proceso: true, editar_informes: true, ver_dashboard: true, ver_historial: true, gestionar_ajustes: true };
    }
    if (role === 'gerencia') {
      return { crear_proceso: false, editar_informes: false, ver_dashboard: true, ver_historial: true, gestionar_ajustes: false };
    }
    // Control Calidad (QC) por defecto
    return { crear_proceso: true, editar_informes: true, ver_dashboard: true, ver_historial: true, gestionar_ajustes: false };
  };

  const [formData, setFormData] = useState({
    id: null,
    username: '',
    password: '',
    role: 'qc',
    permisos: getPermisosPorDefecto('qc')
  });

  const API_URL = window.location.hostname.includes('goldanda.cl')
    ? 'https://evap.maq.goldanda.cl' 
    : `http://${window.location.hostname || 'localhost'}:3001`;

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/usuarios`);
      if (response.ok) {
        const data = await response.json();
        setUsuarios(data);
      } else {
        console.error("Error al cargar usuarios");
      }
    } catch (error) {
      console.error("Error de conexión:", error);
    } finally {
      setLoading(false);
    }
  };

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
      // Si el usuario ya tiene permisos guardados en BD, los usamos, sino usamos los por defecto de su rol
      permisos: user.permisos || getPermisosPorDefecto(user.role)
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || (!isEditing && !formData.password.trim())) {
      alert("Por favor, completa el usuario y contraseña.");
      return;
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${API_URL}/api/usuarios/${formData.id}` : `${API_URL}/api/usuarios`;
      
      const payload = {
        username: formData.username.trim(),
        role: formData.role,
        permisos: formData.permisos // Enviamos el checklist a la base de datos
      };

      if (formData.password.trim() !== '') {
        payload.password = formData.password.trim();
      }

      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowModal(false);
        cargarUsuarios(); 
      } else {
        const data = await response.json();
        alert(`Error: ${data.message || 'No se pudo guardar el usuario'}`);
      }
    } catch (error) {
      alert("Error de red al conectar con el servidor.");
    }
  };

  const eliminarUsuario = async (id, username) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${username}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/usuarios/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUsuarios(usuarios.filter(u => (u.id !== id && u._id !== id)));
      } else {
        alert("Error al intentar eliminar el usuario.");
      }
    } catch (error) {
      alert("Error de red al conectar con el servidor.");
    }
  };

  const formatRole = (role) => {
    if (role === 'admin') return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">Administrador</span>;
    if (role === 'qc') return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">Control Calidad</span>;
    if (role === 'gerencia') return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">Gerencia</span>;
    return role;
  };

  const usuariosFiltrados = usuarios.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
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
        </div>
        <button 
          onClick={abrirModalCrear}
          className="flex items-center justify-center gap-2 bg-[#E96008] hover:bg-[#c74c04] text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors"
        >
          <Plus className="w-5 h-5" /> Nuevo Usuario
        </button>
      </div>

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
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => eliminarUsuario(user.id || user._id, user.username)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Eliminar usuario"
                          disabled={user.role === 'admin'} // Evitamos que un admin se borre por error
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
                        type="text"
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

                    <button type="button" onClick={() => togglePermiso('gestionar_ajustes')} className="flex items-center w-full gap-3 text-left">
                      {formData.permisos.gestionar_ajustes ? <CheckSquare className="w-5 h-5 text-[#E96008] shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                      <span className={`text-sm ${formData.permisos.gestionar_ajustes ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>Acceso total a ajustes y eliminación de datos</span>
                    </button>

                  </div>
                </div>

              </form>
            </div>

            {/* Footer Fijo con botones */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3 rounded-b-3xl">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 bg-white border border-slate-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" form="userForm" className="flex-1 py-3 bg-[#E96008] hover:bg-[#c74c04] text-white font-bold rounded-xl shadow-md transition-colors">
                {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
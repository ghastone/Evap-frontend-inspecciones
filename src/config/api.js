/**
 * EVAP - Direccion compartida de la API para Maquehua y Rosario.
 * Archivo del FRONTEND: src/config/api.js. No contiene claves PostgreSQL.
 *
 * Reglas de esta instalacion:
 * - Sitios HTTPS: usar el mismo origen; el proxy debe enviar /api al backend local.
 * - Dominios EVAP abiertos por HTTP: usar HTTPS en ESE MISMO dominio.
 * - IP, localhost o nombre de equipo por HTTP: usar ese mismo host en puerto 3001.
 * - Nunca intentar conectarse a la otra planta si el servidor no responde.
 *
 * API_URL NO incluye /api. Los modulos conservan sus rutas `${API_URL}/api/...`.
 * Esta configuracion solo afecta a los modulos que la importen.
 */
const DOMINIOS_EVAP = new Set([
  'evap.maq.goldanda.cl',
  'evap.ros.goldanda.cl',
]);
const PUERTO_BACKEND_LOCAL = '3001';

/**
 * Resuelve la base de la API sin consultar la red ni la base de datos.
 * No deduce a que base esta conectado Node.js: eso depende del .env del backend.
 * @param {string | Location | URL} ubicacion URL completa o ubicacion del navegador.
 * @returns {string} Origen de la API, sin barra final ni ruta /api.
 */
export function resolverApiUrl(ubicacion) {
  const href = typeof ubicacion === 'string' ? ubicacion : ubicacion?.href;
  if (typeof href !== 'string' || !href.trim()) {
    throw new Error('[EVAP] No se pudo determinar la direccion del frontend.');
  }

  let pagina;
  try {
    pagina = new URL(href);
  } catch {
    throw new Error('[EVAP] La direccion del frontend no es una URL valida.');
  }

  if (pagina.protocol !== 'http:' && pagina.protocol !== 'https:') {
    throw new Error('[EVAP] Abre el frontend mediante HTTP o HTTPS, no como archivo local.');
  }

  // HTTPS mantiene protocolo, host y puerto; requiere proxy /api en ese origen.
  if (pagina.protocol === 'https:') return pagina.origin;

  const hostname = pagina.hostname.toLowerCase().replace(/\.$/, '');
  if (DOMINIOS_EVAP.has(hostname)) {
    pagina.protocol = 'https:';
    pagina.port = '';
    return pagina.origin;
  }

  // Acceso HTTP por LAN o desarrollo: mismo computador/servidor, puerto 3001.
  // Incluye 192.168.0.10 (MAQ), 192.168.10.10 (ROS), localhost e IPv6.
  pagina.port = PUERTO_BACKEND_LOCAL;
  return pagina.origin;
}

// App.jsx ya depende del navegador y de localStorage. No requiere Vite ni otra
// convencion de variables de entorno del frontend para resolver esta direccion.
export const API_URL = resolverApiUrl(window.location);

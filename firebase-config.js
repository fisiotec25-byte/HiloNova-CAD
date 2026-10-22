// ============================================================
// Configuración del proyecto — RELLENAR antes de publicar
// ============================================================

// 1) Firebase Console → Configuración del proyecto → Tus apps → Web
export const FIREBASE_CONFIG = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'TU_PROYECTO.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

// 2) URL pública del servidor de pagos en Railway (sin diagonal final)
export const API_URL = 'https://hilonova-pagos.up.railway.app';

// 3) Textos de venta (el cobro real lo define el servidor con PRECIO_MXN)
export const PLAN = {
  nombre: 'Licencia HiloNova CAD',
  precio: 1490,
  moneda: 'MXN',
  periodo: 'pago único', // o 'por año' si el servidor usa MODO_PAGO=subscription
  incluye: [
    'Patronaje 2D con bases paramétricas (blusa, falda, pantalón)',
    'Graduación automática y manual por reglas de punto',
    'Trazo con acomodo automático, eficiencia y consumo',
    'Ficha técnica y costeo por prenda en PDF',
    'Exportación DXF-AAMA, PDF 1:1 en mosaico y para plotter',
    'Proyectos guardados en la nube',
  ],
};

export const WHATSAPP = '522361207101';

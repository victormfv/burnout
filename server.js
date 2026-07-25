/**
 * Servidor autoalojado — Encuesta de Burnout (MBI-HSS) UMF 19 Plus
 * ------------------------------------------------------------------
 * Guarda cada respuesta como un registro independiente en
 * data/responses.json y calcula automáticamente los puntajes.
 *
 * ADVERTENCIA (discrepancia en el protocolo original): el apartado
 * 7.8 (Análisis estadístico) usa Despersonalización ALTA >= 10, pero
 * el Anexo 1 usa >= 12. Aquí se usa por default el criterio del
 * Anexo 1 (DP_MEDIO_MAX = 11). Cambien ese valor abajo si su asesora
 * confirma el otro criterio.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cambia-esta-clave';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

// ---------- Configuración de puntuación MBI-HSS (editable) ----------
const CONFIG = {
  AE_ITEMS: [1, 2, 3, 6, 8, 13, 14, 16, 20],
  DP_ITEMS: [5, 10, 11, 15, 22],
  RP_ITEMS: [4, 7, 9, 12, 17, 18, 19, 21],
  AE_BAJO_MAX: 18,
  AE_MEDIO_MAX: 26,
  DP_BAJO_MAX: 5,
  DP_MEDIO_MAX: 11,  // cambiar a 9 si se usa el criterio del apartado 7.8 (alto >=10)
  RP_BAJO_MAX: 33,
  RP_MEDIO_MAX: 39,
};

function clasificar(suma, dim) {
  if (dim === 'AE') {
    if (suma <= CONFIG.AE_BAJO_MAX) return 'Bajo';
    if (suma <= CONFIG.AE_MEDIO_MAX) return 'Medio';
    return 'Alto';
  }
  if (dim === 'DP') {
    if (suma <= CONFIG.DP_BAJO_MAX) return 'Bajo';
    if (suma <= CONFIG.DP_MEDIO_MAX) return 'Medio';
    return 'Alto';
  }
  if (dim === 'RP') {
    if (suma <= CONFIG.RP_BAJO_MAX) return 'Bajo';
    if (suma <= CONFIG.RP_MEDIO_MAX) return 'Medio';
    return 'Alto';
  }
  return '';
}

function sumaItems(mbi, items) {
  return items.reduce((acc, n) => acc + (Number(mbi && mbi[n]) || 0), 0);
}

function leerRespuestas() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch (e) {
    console.error('No se pudo leer responses.json:', e.message);
    return [];
  }
}

function guardarRespuestas(lista) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2), 'utf8');
}

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function requiereAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave de administrador inválida o ausente.' });
  }
  next();
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/responses', (req, res) => {
  try {
    const body = req.body || {};
    const mbi = body.mbi || {};
    const demografico = body.demografico || {};
    const consent = body.consent || {};

    const respondidos = Object.keys(mbi).length;
    if (respondidos < 22) {
      return res.status(400).json({ error: 'Faltan respuestas del MBI-HSS (se recibieron ' + respondidos + ' de 22).' });
    }

    const AE = sumaItems(mbi, CONFIG.AE_ITEMS);
    const DP = sumaItems(mbi, CONFIG.DP_ITEMS);
    const RP = sumaItems(mbi, CONFIG.RP_ITEMS);
    const nivelAE = clasificar(AE, 'AE');
    const nivelDP = clasificar(DP, 'DP');
    const nivelRP = clasificar(RP, 'RP');
    const severo = (nivelAE === 'Alto' && nivelDP === 'Alto' && nivelRP === 'Bajo') ? 'Presente' : 'Ausente';

    const registro = {
      codigo: generarCodigo(),
      guardadoEn: new Date().toISOString(),
      consent: { aceptado: true, iniciales: consent.initials || null },
      demografico,
      mbi,
      puntajes: {
        agotamiento_emocional: { suma: AE, nivel: nivelAE },
        despersonalizacion: { suma: DP, nivel: nivelDP },
        realizacion_personal: { suma: RP, nivel: nivelRP },
        burnout_severo: severo
      }
    };

    const lista = leerRespuestas();
    lista.push(registro);
    guardarRespuestas(lista);

    res.json({ ok: true, codigo: registro.codigo });
  } catch (err) {
    console.error('Error guardando respuesta:', err);
    res.status(500).json({ error: 'No se pudo guardar la respuesta en el servidor.' });
  }
});

app.get('/api/count', requiereAdmin, (req, res) => {
  res.json({ total: leerRespuestas().length });
});

app.get('/api/export', requiereAdmin, (req, res) => {
  const lista = leerRespuestas();
  const demoCols = ['edad', 'sexo', 'estadoCivil', 'tieneHijos', 'numHijos4', 'perfil',
    'antiguedadUMF', 'antiguedadIMSS', 'turno', 'contratacion', 'otroEmpleo',
    'tienePareja', 'tieneHijos12', 'numHijos12', 'edadMenor', 'hijosViven'];
  const header = ['codigo', 'guardado_en', 'iniciales_consentimiento',
    ...demoCols,
    ...Array.from({ length: 22 }, (_, i) => 'item_' + (i + 1)),
    'AE_suma', 'AE_nivel', 'DP_suma', 'DP_nivel', 'RP_suma', 'RP_nivel', 'Burnout_severo'];

  const escape = v => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const rows = [header.join(',')];
  lista.forEach(r => {
    const line = [
      r.codigo, r.guardadoEn, r.consent && r.consent.iniciales,
      ...demoCols.map(c => r.demografico && r.demografico[c]),
      ...Array.from({ length: 22 }, (_, i) => r.mbi && r.mbi[i + 1]),
      r.puntajes.agotamiento_emocional.suma, r.puntajes.agotamiento_emocional.nivel,
      r.puntajes.despersonalizacion.suma, r.puntajes.despersonalizacion.nivel,
      r.puntajes.realizacion_personal.suma, r.puntajes.realizacion_personal.nivel,
      r.puntajes.burnout_severo
    ].map(escape).join(',');
    rows.push(line);
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="burnout_respuestas.csv"');
  res.send(rows.join('\n'));
});

app.listen(PORT, () => {
  console.log('Servidor de encuesta de burnout escuchando en el puerto ' + PORT);
  if (ADMIN_KEY === 'cambia-esta-clave') {
    console.log('⚠️  Estás usando la clave de administrador POR DEFAULT. Cámbiala con la variable de entorno ADMIN_KEY antes de usarlo con participantes reales.');
  }
});

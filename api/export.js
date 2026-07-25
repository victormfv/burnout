const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cambia-esta-clave';

const DEMO_COLS = [
  'edad', 'sexo', 'estadoCivil', 'tieneHijos', 'numHijos4', 'perfil',
  'antiguedadUMF', 'antiguedadIMSS', 'turno', 'contratacion', 'otroEmpleo',
  'tienePareja', 'tieneHijos12', 'numHijos12', 'edadMenor', 'hijosViven'
];
const MBI_ITEMS = Array.from({ length: 22 }, (_, i) => i + 1);

const escape = value => {
  if (value == null) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const parseJson = raw => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const fetchAllRecords = async () => {
  const records = [];
  let offset;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Respuestas`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Airtable export failed');
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
};

module.exports = async (req, res) => {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE) {
    return res.status(500).json({ error: 'Faltan variables de entorno de Airtable.' });
  }

  try {
    const records = await fetchAllRecords();
    const headers = [
      'codigo', 'guardado_en', 'iniciales_consentimiento',
      ...DEMO_COLS,
      ...MBI_ITEMS.map(i => `item_${i}`),
      'AE_suma', 'AE_nivel', 'DP_suma', 'DP_nivel', 'RP_suma', 'RP_nivel', 'Burnout_severo'
    ];

    const rows = [headers.join(',')];

    records.forEach(record => {
      const fields = record.fields || {};
      const demografico = parseJson(fields.demografico);
      const mbi = parseJson(fields.mbi);
      const row = [
        fields.codigo,
        fields.guardadoEn,
        fields.iniciales,
        ...DEMO_COLS.map(col => demografico[col]),
        ...MBI_ITEMS.map(item => mbi[item]),
        fields.AE_suma,
        fields.AE_nivel,
        fields.DP_suma,
        fields.DP_nivel,
        fields.RP_suma,
        fields.RP_nivel,
        fields.Burnout_severo
      ].map(escape).join(',');
      rows.push(row);
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=burnout_respuestas.csv');
    res.send(rows.join('\r\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

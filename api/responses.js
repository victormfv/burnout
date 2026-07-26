const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE;

const AE_ITEMS = [1, 2, 3, 6, 8, 13, 14, 16, 20];
const DP_ITEMS = [5, 10, 11, 15, 22];
const RP_ITEMS = [4, 7, 9, 12, 17, 18, 19, 21];

const generarCodigo = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomChars = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${randomChars.slice(0, 3)}-${randomChars.slice(3)}`;
};

const sumaItems = (mbi, items) => items.reduce((acc, n) => acc + (Number(mbi[n]) || 0), 0);
const clasificar = (valor, dim) => {
  if (dim === 'AE') {
    if (valor <= 18) return 'Bajo';
    if (valor <= 26) return 'Medio';
    return 'Alto';
  }
  if (dim === 'DP') {
    if (valor <= 5) return 'Bajo';
    if (valor <= 11) return 'Medio';
    return 'Alto';
  }
  if (dim === 'RP') {
    if (valor <= 33) return 'Bajo';
    if (valor <= 39) return 'Medio';
    return 'Alto';
  }
  return '';
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE) {
    return res.status(500).json({ error: 'Faltan variables de entorno de Airtable.' });
  }

  const body = req.body || {};
  const mbi = body.mbi || {};
  const demografico = body.demografico || {};
  const consent = body.consent || {};

  const responded = Object.keys(mbi).length;
  if (responded < 22) {
    return res.status(400).json({ error: 'Faltan respuestas del MBI-HSS (se recibieron ' + responded + ' de 22).' });
  }

  const AE = sumaItems(mbi, AE_ITEMS);
  const DP = sumaItems(mbi, DP_ITEMS);
  const RP = sumaItems(mbi, RP_ITEMS);
  const nivelAE = clasificar(AE, 'AE');
  const nivelDP = clasificar(DP, 'DP');
  const nivelRP = clasificar(RP, 'RP');
  const burnoutSevero = (nivelAE === 'Alto' && nivelDP === 'Alto' && nivelRP === 'Bajo') ? 'Presente' : 'Ausente';
  const fecha = new Date().toISOString();
  const codigo = generarCodigo();

  const payload = {
    records: [
      {
        fields: {
          codigo,
          fecha,
          iniciales: consent.initials || '',
          demografico: JSON.stringify(demografico),
          mbi: JSON.stringify(mbi),
          AE_suma: AE,
          AE_nivel: nivelAE,
          DP_suma: DP,
          DP_nivel: nivelDP,
          RP_suma: RP,
          RP_nivel: nivelRP,
          Burnout_severo: burnoutSevero
        }
      }
    ]
  };

  try {
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Respuestas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return res.status(500).json({ error: errorBody.error || 'Airtable save failed' });
    }

    res.json({ ok: true, codigo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Metodo non supportato' });

  const token = process.env.HF_API_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'HF_API_TOKEN mancante su Vercel' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ ok: false, error: 'prompt mancante' });

  try {
    const hf = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
    });

    if (hf.status === 503) return res.status(503).json({ ok: false, status: 'loading', error: 'Modello in avvio' });
    if (!hf.ok) return res.status(hf.status).json({ ok: false, error: await hf.text() });

    const buf = await hf.buffer();
    const b64 = buf.toString('base64');
    const ct = hf.headers.get('content-type') || 'image/jpeg';
    return res.status(200).json({ ok: true, b64, ct });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

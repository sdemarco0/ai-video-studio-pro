const fetch = require('node-fetch');

const MODELS = {
  standard: 'THUDM/CogVideoX-2b',
  cinematic: 'Lightricks/LTX-Video'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', error: 'Metodo non supportato' });

  const token = process.env.HF_API_TOKEN;
  if (!token) return res.status(500).json({ status: 'error', error: 'HF_API_TOKEN mancante su Vercel' });

  const { prompt, quality } = req.body;
  if (!prompt) return res.status(400).json({ status: 'error', error: 'prompt mancante' });

  const model = MODELS[quality] || MODELS.standard;

  try {
    const hf = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: quality === 'cinematic' ? 50 : 30,
          guidance_scale: quality === 'cinematic' ? 7.5 : 6.0,
          num_frames: quality === 'cinematic' ? 81 : 49
        }
      })
    });

    if (hf.status === 503) return res.status(503).json({ status: 'loading', message: 'Modello in avvio' });
    if (!hf.ok) return res.status(hf.status).json({ status: 'error', error: await hf.text() });

    const buf = await hf.buffer();
    const b64 = buf.toString('base64');
    const ct = hf.headers.get('content-type') || 'video/mp4';
    return res.status(200).json({ status: 'succeeded', video_base64: b64, content_type: ct, model_used: model });
  } catch (e) {
    return res.status(500).json({ status: 'error', error: e.message });
  }
};

/* ============================================================
   Vercel Edge Function — /api/hf-video
   Proxy verso Hugging Face per generazione video.
   Token HF_API_TOKEN configurato su Vercel — mai esposto.
   Modelli:
   - standard  → THUDM/CogVideoX-2b
   - cinematic → Lightricks/LTX-Video
   ============================================================ */
export const config = { runtime: 'edge' };

const MODELS = {
  standard:  'THUDM/CogVideoX-2b',
  cinematic: 'Lightricks/LTX-Video'
};

export default async function handler(req) {
  const token = process.env.HF_API_TOKEN;

  const origin = req.headers.get('origin') || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Metodo non supportato' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!token) {
    return new Response(JSON.stringify({ error: 'HF_API_TOKEN non configurato su Vercel. Vai su Vercel → Settings → Environment Variables e aggiungi HF_API_TOKEN' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { prompt, quality } = await req.json();

    if (!prompt) return new Response(JSON.stringify({ error: 'prompt obbligatorio' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const model = MODELS[quality] || MODELS.standard;

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${token}`,
        'Content-Type':     'application/json',
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: quality === 'cinematic' ? 50 : 30,
          guidance_scale:      quality === 'cinematic' ? 7.5 : 6.0,
          num_frames:          quality === 'cinematic' ? 81  : 49,
        }
      })
    });

    if (!hfRes.ok) {
      const err = await hfRes.text();
      if (hfRes.status === 503) {
        return new Response(JSON.stringify({ status: 'loading', message: 'Modello in avvio — riprova tra 20 secondi' }), {
          status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: err }), { status: hfRes.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const buf  = await hfRes.arrayBuffer();
    const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const ct   = hfRes.headers.get('content-type') || 'video/mp4';

    return new Response(JSON.stringify({
      status:       'succeeded',
      video_base64: b64,
      content_type: ct,
      model_used:   model,
      quality:      quality || 'standard'
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}

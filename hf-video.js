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
  if (!token) return new Response(JSON.stringify({ status: 'error', error: 'HF_API_TOKEN mancante su Vercel' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const { prompt, quality } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ status: 'error', error: 'prompt mancante' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    const model = MODELS[quality] || MODELS.standard;
    const hf = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Wait-For-Model': 'true' },
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: quality === 'cinematic' ? 50 : 30, guidance_scale: quality === 'cinematic' ? 7.5 : 6.0, num_frames: quality === 'cinematic' ? 81 : 49 } })
    });
    if (hf.status === 503) return new Response(JSON.stringify({ status: 'loading', message: 'Modello in avvio — riprova' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!hf.ok) return new Response(JSON.stringify({ status: 'error', error: await hf.text() }), { status: hf.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const buf = await hf.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return new Response(JSON.stringify({ status: 'succeeded', video_base64: b64, content_type: hf.headers.get('content-type') || 'video/mp4', model_used: model }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}

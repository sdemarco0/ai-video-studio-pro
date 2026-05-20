export const config = { runtime: 'edge' };

export default async function handler(req) {
  const token = process.env.HF_API_TOKEN;
  const origin = req.headers.get('origin') || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!token) return new Response(JSON.stringify({ ok: false, error: 'HF_API_TOKEN mancante su Vercel' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const { prompt } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ ok: false, error: 'prompt mancante' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    const hf = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Wait-For-Model': 'true' },
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
    });
    if (hf.status === 503) return new Response(JSON.stringify({ ok: false, status: 'loading', error: 'Modello in avvio' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!hf.ok) return new Response(JSON.stringify({ ok: false, error: await hf.text() }), { status: hf.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const buf = await hf.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return new Response(JSON.stringify({ ok: true, b64, ct: hf.headers.get('content-type') || 'image/jpeg' }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}

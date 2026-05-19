/* ============================================================
   Vercel Edge Function — /api/hf-image
   Proxy verso HF per generazione immagini FLUX.1-schnell.
   Risolve il problema CORS — il browser non chiama HF direttamente.
   ============================================================ */
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
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Metodo non supportato' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!token) {
    return new Response(JSON.stringify({ error: 'HF_API_TOKEN non configurato su Vercel' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { prompt, steps } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: 'prompt obbligatorio' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const hfRes = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${token}`,
        'Content-Type':     'application/json',
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { num_inference_steps: steps || 4, guidance_scale: 0 }
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

    /* HF ritorna l'immagine come blob — la convertiamo in base64 */
    const buf = await hfRes.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const ct  = hfRes.headers.get('content-type') || 'image/jpeg';

    return new Response(JSON.stringify({
      status:        'succeeded',
      image_base64:  b64,
      content_type:  ct
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}

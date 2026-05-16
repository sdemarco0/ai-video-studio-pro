/* ============================================================
   Vercel Edge Function — /api/lipsync
   Proxy sicuro verso Replicate: kwaivgi/kling-lip-sync
   La chiave REPLICATE_API_TOKEN non è mai esposta al browser.
   ============================================================ */
export const config = { runtime: 'edge' };

const REP_BASE = 'https://api.replicate.com/v1';

export default async function handler(req) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        return new Response(JSON.stringify({ error: 'REPLICATE_API_TOKEN non configurato su Vercel' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    const origin = req.headers.get('origin') || '*';
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const predId = url.searchParams.get('id');

    /* GET — polling stato prediction */
    if (req.method === 'GET' && predId) {
        const res = await fetch(`${REP_BASE}/predictions/${predId}`, {
            headers: { 'Authorization': `Token ${token}` }
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    /* POST — crea nuova prediction Kling LipSync */
    if (req.method === 'POST') {
        const body = await req.json();
        /* body atteso: { video_url, text, language } */
        const { video_url, text, language } = body;

        if (!video_url || !text) {
            return new Response(JSON.stringify({ error: 'video_url e text sono obbligatori' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const res = await fetch(`${REP_BASE}/models/kwaivgi/kling-lip-sync/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait=5'
            },
            body: JSON.stringify({
                input: {
                    video: video_url,
                    text:  text,
                    voice_language: language || 'auto'
                }
            })
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'Metodo non supportato' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

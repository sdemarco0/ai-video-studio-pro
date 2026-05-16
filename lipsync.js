/* ============================================================
   Vercel Serverless Function — /api/lipsync
   Proxy sicuro verso Replicate: kwaivgi/kling-lip-sync
   ============================================================ */
const REP_BASE = 'https://api.replicate.com/v1';

module.exports = async function handler(req, res) {
    const token = process.env.REPLICATE_API_TOKEN;

    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { return res.status(204).end(); }

    if (!token) {
        return res.status(500).json({ error: 'REPLICATE_API_TOKEN non configurato su Vercel' });
    }

    const headers = {
        'Authorization': 'Token ' + token,
        'Content-Type':  'application/json'
    };

    /* GET — polling */
    if (req.method === 'GET') {
        const predId = req.query.id;
        if (!predId) return res.status(400).json({ error: 'id mancante' });

        const upstream = await fetch(REP_BASE + '/predictions/' + predId, { headers });
        const data     = await upstream.json();
        return res.status(upstream.status).json(data);
    }

    /* POST — crea prediction Kling LipSync */
    if (req.method === 'POST') {
        const { video_url, text, language } = req.body;
        if (!video_url || !text) {
            return res.status(400).json({ error: 'video_url e text sono obbligatori' });
        }

        const upstream = await fetch(REP_BASE + '/models/kwaivgi/kling-lip-sync/predictions', {
            method:  'POST',
            headers: { ...headers, 'Prefer': 'wait=5' },
            body:    JSON.stringify({
                input: {
                    video:          video_url,
                    text:           text,
                    voice_language: language || 'auto'
                }
            })
        });
        const data = await upstream.json();
        return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ error: 'Metodo non supportato' });
};

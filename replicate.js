/* ============================================================
   Vercel Serverless Function — /api/replicate
   Proxy sicuro verso Replicate API (video AI).
   REPLICATE_API_TOKEN vive solo nelle env vars Vercel.
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

    /* GET — polling prediction */
    if (req.method === 'GET') {
        const predId = req.query.id;
        if (!predId) return res.status(400).json({ error: 'id mancante' });

        const upstream = await fetch(REP_BASE + '/predictions/' + predId, { headers });
        const data     = await upstream.json();
        return res.status(upstream.status).json(data);
    }

    /* POST — crea prediction */
    if (req.method === 'POST') {
        const { owner, name, input } = req.body;
        if (!owner || !name || !input) {
            return res.status(400).json({ error: 'owner, name e input sono obbligatori' });
        }

        const upstream = await fetch(REP_BASE + '/models/' + owner + '/' + name + '/predictions', {
            method:  'POST',
            headers: { ...headers, 'Prefer': 'wait=5' },
            body:    JSON.stringify({ input })
        });
        const data = await upstream.json();
        return res.status(upstream.status).json(data);
    }

    return res.status(405).json({ error: 'Metodo non supportato' });
};

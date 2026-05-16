/* ============================================================
   Vercel Serverless Function — /api/stripe-webhook
   Riceve eventi Stripe e aggiorna il piano utente su Supabase.
   Richiede env: STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
   ============================================================ */
const crypto = require('crypto');

/* Disabilita il body parser di Vercel — Stripe richiede il raw body */
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non supportato' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl   = process.env.SUPABASE_URL;
    const supabaseKey   = process.env.SUPABASE_SERVICE_KEY;

    if (!webhookSecret || !supabaseUrl || !supabaseKey) {
        console.error('Variabili d\'ambiente mancanti per il webhook Stripe');
        return res.status(500).json({ error: 'Configurazione server incompleta' });
    }

    /* Leggi il body raw */
    const rawBody = await new Promise(function (resolve, reject) {
        let data = '';
        req.on('data', function (chunk) { data += chunk; });
        req.on('end',  function () { resolve(data); });
        req.on('error', reject);
    });

    /* Verifica firma Stripe */
    const sigHeader = req.headers['stripe-signature'];
    const isValid   = verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!isValid) {
        console.error('Firma Stripe non valida');
        return res.status(400).json({ error: 'Firma non valida' });
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch (e) {
        return res.status(400).json({ error: 'JSON non valido' });
    }

    /* Aggiorna Supabase in base all'evento */
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId  = session.client_reference_id || (session.metadata && session.metadata.user_id);
        if (userId) {
            await updateUserPlan(supabaseUrl, supabaseKey, userId, 'pro', 99999);
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const sub    = event.data.object;
        const userId = sub.metadata && sub.metadata.user_id;
        if (userId) {
            await updateUserPlan(supabaseUrl, supabaseKey, userId, 'free', 3);
        }
    }

    return res.status(200).json({ received: true });
};

/* Aggiorna user_credits su Supabase via REST API */
async function updateUserPlan(supabaseUrl, supabaseKey, userId, plan, credits) {
    try {
        await fetch(supabaseUrl + '/rest/v1/user_credits?user_id=eq.' + userId, {
            method:  'PATCH',
            headers: {
                'apikey':        supabaseKey,
                'Authorization': 'Bearer ' + supabaseKey,
                'Content-Type':  'application/json',
                'Prefer':        'return=minimal'
            },
            body: JSON.stringify({ plan, credits, updated_at: new Date().toISOString() })
        });
    } catch (e) {
        console.error('Errore aggiornamento Supabase:', e.message);
    }
}

/* Verifica HMAC-SHA256 della firma Stripe */
function verifyStripeSignature(payload, sigHeader, secret) {
    try {
        const parts    = {};
        sigHeader.split(',').forEach(function (part) {
            const idx = part.indexOf('=');
            parts[part.slice(0, idx)] = part.slice(idx + 1);
        });

        const signedPayload = parts['t'] + '.' + payload;
        const expected      = crypto
            .createHmac('sha256', secret)
            .update(signedPayload, 'utf8')
            .digest('hex');

        return expected === parts['v1'];
    } catch (e) {
        return false;
    }
}

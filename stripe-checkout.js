/* ============================================================
   Vercel Serverless Function — /api/stripe-checkout
   Crea una Stripe Checkout Session e restituisce l'URL.
   Richiede env: STRIPE_SECRET_KEY
   ============================================================ */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { return res.status(204).end(); }
    if (req.method !== 'POST')    { return res.status(405).json({ error: 'Metodo non supportato' }); }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurato' });
    }

    const origin = req.headers.origin || 'https://ai-video-studio-pro.vercel.app';

    try {
        const { priceId, userId, email } = req.body;
        if (!priceId || !userId || !email) {
            return res.status(400).json({ error: 'priceId, userId ed email sono obbligatori' });
        }

        const params = new URLSearchParams({
            'mode':                             'subscription',
            'payment_method_types[]':           'card',
            'line_items[0][price]':             priceId,
            'line_items[0][quantity]':          '1',
            'customer_email':                   email,
            'client_reference_id':              userId,
            'success_url':                      origin + '/?payment=success',
            'cancel_url':                       origin + '/?payment=cancelled',
            'metadata[user_id]':                userId,
            'allow_promotion_codes':            'true',
            'billing_address_collection':       'auto'
        });

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method:  'POST',
            headers: {
                'Authorization': 'Bearer ' + stripeKey,
                'Content-Type':  'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const session = await stripeRes.json();
        if (!stripeRes.ok) {
            throw new Error(session.error ? session.error.message : 'Stripe error ' + stripeRes.status);
        }

        return res.status(200).json({ url: session.url });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

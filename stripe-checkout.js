/* ============================================================
   Vercel Edge Function — /api/stripe-checkout
   Crea una Stripe Checkout Session e restituisce l'URL.
   Richiede env: STRIPE_SECRET_KEY
   ============================================================ */
export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Metodo non supportato' }), { status: 405 });
    }

    var stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
        return new Response(JSON.stringify({ error: 'Stripe non configurato' }), { status: 500 });
    }

    var origin = req.headers.get('origin') || 'https://tuodominio.vercel.app';

    try {
        var { priceId, userId, email } = await req.json();

        /* Crea Checkout Session via Stripe REST API */
        var params = new URLSearchParams({
            'mode':                                 'subscription',
            'payment_method_types[]':               'card',
            'line_items[0][price]':                 priceId,
            'line_items[0][quantity]':              '1',
            'customer_email':                       email,
            'client_reference_id':                  userId,
            'success_url':                          origin + '/?payment=success',
            'cancel_url':                           origin + '/?payment=cancelled',
            'metadata[user_id]':                    userId,
            'allow_promotion_codes':                'true',
            'billing_address_collection':           'auto',
        });

        var res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization':  'Bearer ' + stripeKey,
                'Content-Type':   'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        var session = await res.json();
        if (!res.ok) throw new Error(session.error?.message || 'Stripe error');

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

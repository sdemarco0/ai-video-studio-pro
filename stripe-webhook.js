/* ============================================================
   Vercel Edge Function — /api/stripe-webhook
   Riceve eventi Stripe (checkout.session.completed) e
   aggiorna il piano utente su Supabase.
   Richiede env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY,
                 SUPABASE_URL, SUPABASE_SERVICE_KEY
   ============================================================ */
export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    var supabaseUrl   = process.env.SUPABASE_URL;
    var supabaseKey   = process.env.SUPABASE_SERVICE_KEY; /* service role — solo server */

    if (!webhookSecret || !supabaseUrl || !supabaseKey) {
        return new Response('Missing env vars', { status: 500 });
    }

    var payload   = await req.text();
    var sigHeader = req.headers.get('stripe-signature');

    /* Verifica firma Stripe — fondamentale per sicurezza */
    var verified = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!verified) {
        return new Response('Invalid signature', { status: 400 });
    }

    var event = JSON.parse(payload);

    if (event.type === 'checkout.session.completed') {
        var session = event.data.object;
        var userId  = session.client_reference_id || session.metadata?.user_id;

        if (userId) {
            /* Aggiorna piano su Supabase tramite REST API diretta */
            await fetch(supabaseUrl + '/rest/v1/user_credits?user_id=eq.' + userId, {
                method:  'PATCH',
                headers: {
                    'apikey':        supabaseKey,
                    'Authorization': 'Bearer ' + supabaseKey,
                    'Content-Type':  'application/json',
                    'Prefer':        'return=minimal'
                },
                body: JSON.stringify({ plan: 'pro', credits: 99999 })
            });
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        /* Abbonamento cancellato — torna a free */
        var sub    = event.data.object;
        var userId = sub.metadata?.user_id;
        if (userId) {
            await fetch(supabaseUrl + '/rest/v1/user_credits?user_id=eq.' + userId, {
                method:  'PATCH',
                headers: {
                    'apikey':        supabaseKey,
                    'Authorization': 'Bearer ' + supabaseKey,
                    'Content-Type':  'application/json',
                    'Prefer':        'return=minimal'
                },
                body: JSON.stringify({ plan: 'free', credits: 3 })
            });
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/* Verifica HMAC-SHA256 della firma Stripe */
async function verifyStripeSignature(payload, sigHeader, secret) {
    try {
        var parts    = sigHeader.split(',').reduce(function (acc, part) {
            var [k, v] = part.split('=');
            acc[k]     = v;
            return acc;
        }, {});

        var timestamp  = parts['t'];
        var signature  = parts['v1'];
        var signedPayload = timestamp + '.' + payload;

        var key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
        var hex = Array.from(new Uint8Array(sig)).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');

        return hex === signature;
    } catch (e) {
        return false;
    }
}

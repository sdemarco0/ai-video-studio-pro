/* ============================================================
   AI Video Studio Pro — config.js
   ⚠️  QUESTO FILE VA COMPILATO CON I TUOI DATI.
   Non committare mai questo file con valori reali su GitHub
   (è già in .gitignore).

   Come trovare i valori:
   - SUPABASE: dashboard.supabase.com → Project Settings → API
   - STRIPE:   dashboard.stripe.com → Developers → API keys
               + Products → crea prodotto "Pro" → copia Price ID
   ============================================================ */
window.APP_CONFIG = {

    /* ── Supabase ─────────────────────────────────────── */
    supabaseUrl:  'https://XXXXXXXXXXXXXXXX.supabase.co',
    supabaseAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',   /* anon/public key */

    /* ── Stripe Price IDs ─────────────────────────────── */
    stripePriceIds: {
        pro_monthly:  'price_XXXXXXXXXXXXXXXX',   /* €14.99/mese */
        pro_yearly:   'price_XXXXXXXXXXXXXXXX'    /* €99/anno (opzionale) */
    },

    /* ── Impostazioni app ────────────────────────────── */
    appName:      'AI Video Studio Pro',
    freeCredits:  3    /* video gratuiti per i nuovi utenti */
};

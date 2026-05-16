/* ============================================================
   AI Video Studio Pro — stripe.js
   Gestione abbonamenti Stripe Checkout.
   Il checkout avviene su stripe.com (sicuro), nessun dato
   carta transita per il nostro server.
   ============================================================ */

/* ============================================================
   PAYWALL — controllo crediti prima di ogni generazione
   ============================================================ */
async function checkCreditsOrBlock(feature) {
    /* Se Supabase non è configurato, lascia sempre passare (modalità demo) */
    var sb = getSupabase();
    if (!sb) return true;

    var credits = await sbGetCredits();
    if (!credits) return true;

    /* Piano Pro — nessun blocco */
    if (credits.plan === 'pro') return true;

    /* Piano Free — controlla crediti */
    if (credits.credits <= 0) {
        showUpgradeModal(feature);
        return false;
    }

    return true;
}

/* ============================================================
   MODAL UPGRADE
   ============================================================ */
function showUpgradeModal(feature) {
    var modal = document.getElementById('upgradeModal');
    if (!modal) return;
    var msg = document.getElementById('upgradeMsg');
    if (msg) {
        msg.textContent = feature
            ? 'Hai esaurito i crediti gratuiti. Passa a Pro per ' + feature + ' illimitati.'
            : 'Hai esaurito i 3 video gratuiti. Passa a Pro per continuare.';
    }
    modal.classList.add('active');
}

function closeUpgradeModal() {
    var modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.remove('active');
}

/* ============================================================
   STRIPE CHECKOUT
   Reindirizza alla pagina di pagamento Stripe.
   Il PRICE_ID è configurato in config.js dall'operatore.
   ============================================================ */
async function startCheckout(planKey) {
    var config = window.APP_CONFIG;
    if (!config || !config.stripePriceIds) {
        toast('error', 'Pagamenti non configurati', 'Contatta il supporto');
        return;
    }

    var priceId = config.stripePriceIds[planKey];
    if (!priceId) {
        toast('error', 'Piano non valido', '');
        return;
    }

    var user = await sbGetUser();
    if (!user) {
        toast('error', 'Devi essere loggato', 'Accedi prima di procedere al pagamento');
        return;
    }

    /* Chiama la nostra Edge Function /api/stripe-checkout
       che crea la session e restituisce l'URL di Stripe */
    try {
        var res = await fetch('/api/stripe-checkout', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ priceId, userId: user.id, email: user.email })
        });
        var data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Errore checkout');
        }
    } catch (e) {
        toast('error', 'Errore pagamento', e.message);
    }
}

/* ============================================================
   VISUALIZZA CREDITI NELLA UI
   ============================================================ */
async function loadAndShowCredits() {
    var sb = getSupabase();
    if (!sb) return;

    var credits = await sbGetCredits();
    if (!credits) return;

    var el = document.getElementById('creditsDisplay');
    if (!el) return;

    if (credits.plan === 'pro') {
        el.innerHTML = '<span style="color:var(--accent);font-weight:700;">⭐ Pro</span> — video illimitati';
    } else {
        el.innerHTML = '<span style="color:var(--warning);font-weight:700;">' +
            credits.credits + ' video</span> rimanenti · ' +
            '<a href="#" onclick="showUpgradeModal(\'video\'); return false;" ' +
            'style="color:var(--accent);">Passa a Pro</a>';
    }
}

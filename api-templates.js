/* ============================================================
   AI Video Studio Pro — api-templates.js
   API Key management + Templates

   ARCHITETTURA COSTI MINIMI:
   ─ Immagini  → HF Inference API (FLUX.1-schnell) — FREE tier mensile
   ─ Video     → Replicate (CogVideoX-2B) — ~$0.003–0.006/video
                 oppure Replicate (LTX-Video) — ~$0.01/video (qualità migliore)

   L'utente finale porta le proprie chiavi → i costi ricadono su di lui,
   non sull'operatore della piattaforma.
   ============================================================ */

/* ============================================================
   API KEY MODAL
   ============================================================ */
function showApiModal() {
    document.getElementById('apiModal').classList.add('active');
    if (state.apiKeys.hf)        document.getElementById('hfKey').value        = state.apiKeys.hf;
    if (state.apiKeys.replicate) document.getElementById('replicateKey').value = state.apiKeys.replicate;
    if (state.apiKeys.eleven)    document.getElementById('elevenKey').value     = state.apiKeys.eleven;
    if (state.apiKeys.sync)      document.getElementById('syncKey').value       = state.apiKeys.sync;
}

function closeApiModal() {
    document.getElementById('apiModal').classList.remove('active');
}

function saveApiKeys() {
    state.apiKeys = {
        hf:     (document.getElementById('hfKey').value    || '').trim(),
        eleven: (document.getElementById('elevenKey').value || '').trim(),
        sync:   (document.getElementById('syncKey').value   || '').trim()
    };

    var badge     = document.getElementById('apiStatusBadge');
    var badgeText = document.getElementById('apiStatusText');

    if (state.apiKeys.hf) {
        badge.className       = 'api-status ok';
        badgeText.textContent = 'HF Attivo';
    } else {
        badge.className       = 'api-status warn';
        badgeText.textContent = 'Demo Mode';
    }

    closeApiModal();
    toast('success', 'API Salvate',
        state.apiKeys.hf ? 'HF pronto — immagini gratuite attive' : 'Inserisci HF Token per le immagini');
}

/* ============================================================
   TEMPLATES
   ============================================================ */
function showTemplates() {
    document.getElementById('templateModal').classList.add('active');
}

function closeTemplateModal() {
    document.getElementById('templateModal').classList.remove('active');
}

var TEMPLATES = {
    news:     {
        char:   'Professional news anchor, elegant suit, serious expression, 35 years old',
        dialog: 'Welcome to tonight\'s news. Today we\'re covering...',
        env:    'Professional TV studio with blue LED screens and desk',
        moves:  'Sits at desk, looks directly at camera, minimal gestures'
    },
    tutorial: {
        char:   'Friendly teacher, 30 years old, glasses, casual sweater, warm smile',
        dialog: 'In this tutorial we\'ll learn how to use this platform step by step...',
        env:    'Desk with monitor, bookshelf background, natural light',
        moves:  'Gestures with hands, points at screen, smiles'
    },
    promo:    {
        char:   'Enthusiastic salesperson, 40 years old, blue suit, wide smile',
        dialog: 'Discover our special offer! Only for today...',
        env:    'Colorful background with dynamic graphics and lights',
        moves:  'Walks back and forth, points at product, raises hands'
    },
    vlog:     {
        char:   'Young content creator, 25 years old, casual style, energetic',
        dialog: 'Hey guys! Today I\'m taking you to this amazing place...',
        env:    'Bedroom with RGB lights, posters on the wall',
        moves:  'Moves freely, expressive gestures, laughs'
    },
    product:  {
        char:   'Professional model, well-groomed hands, neutral expression',
        dialog: 'This revolutionary product will change your life...',
        env:    'Minimal white background, glass table, soft lighting',
        moves:  'Shows product from different angles, rotates it'
    },
    gaming:   {
        char:   'Gamer, 22 years old, headset, tech shirt, focused expression',
        dialog: 'Guys, today we\'re trying out this insane new game!',
        env:    'Gaming setup with RGB LEDs, multiple monitors, gaming posters',
        moves:  'Reacts to game, gestures with controller, cheers'
    }
};

function loadTemplate(type) {
    closeTemplateModal();
    var t = TEMPLATES[type];
    if (!t) return;
    document.getElementById('videoCharPrompt').value   = t.char;
    document.getElementById('videoDialogPrompt').value = t.dialog;
    document.getElementById('videoEnvPrompt').value    = t.env;
    document.getElementById('videoMovePrompt').value   = t.moves;
    switchAIPanel('video');
    toast('success', 'Template caricato', type.charAt(0).toUpperCase() + type.slice(1));
}

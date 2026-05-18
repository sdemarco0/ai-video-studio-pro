/* ============================================================
   AI Video Studio Pro — api-templates.js
   Modal API semplificato — solo HF Token (gratis)
   Rimosso: Replicate, ElevenLabs, Sync.so
   ============================================================ */

function showApiModal() {
  document.getElementById('apiModal').classList.add('active');
  if (state.apiKeys.hf) document.getElementById('hfKey').value = state.apiKeys.hf;
}

function closeApiModal() {
  document.getElementById('apiModal').classList.remove('active');
}

function saveApiKeys() {
  var hfKey = (document.getElementById('hfKey').value || '').trim();
  state.apiKeys.hf = hfKey;

  var badge     = document.getElementById('apiStatusBadge');
  var badgeText = document.getElementById('apiStatusText');

  if (hfKey) {
    badge.className       = 'api-status ok';
    badgeText.textContent = 'HF Attivo';
    toast('success', '✅ Token salvato', 'Hugging Face attivo — immagini e video pronti');
  } else {
    badge.className       = 'api-status warn';
    badgeText.textContent = 'Token mancante';
    toast('error', 'Token mancante', 'Inserisci il tuo token HF per generare contenuti');
  }
  closeApiModal();
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
  news: {
    char:   'Presentatore professionista, completo elegante, espressione seria, 35 anni',
    dialog: 'Benvenuti al telegiornale. Oggi vi parliamo di...',
    env:    'Studio TV professionale con schermi LED blu e scrivania',
    moves:  'Seduto alla scrivania, guarda in camera, gesti minimi'
  },
  tutorial: {
    char:   'Insegnante simpatico, 30 anni, occhiali, maglione casual, sorriso caldo',
    dialog: 'In questo tutorial impareremo passo passo come usare la piattaforma...',
    env:    'Scrivania con monitor, libreria sullo sfondo, luce naturale',
    moves:  'Gesticola con le mani, indica lo schermo, sorride'
  },
  promo: {
    char:   'Venditore entusiasta, 40 anni, giacca blu, sorriso ampio',
    dialog: 'Scopri la nostra offerta speciale! Solo per oggi...',
    env:    'Sfondo colorato con grafiche dinamiche e luci',
    moves:  'Cammina avanti e indietro, indica il prodotto, alza le mani'
  },
  vlog: {
    char:   'Content creator giovane, 25 anni, stile casual, energico',
    dialog: 'Ciao ragazzi! Oggi vi porto in questo posto fantastico...',
    env:    'Camera con luci RGB, poster sul muro',
    moves:  'Si muove liberamente, gesti espressivi, ride'
  },
  product: {
    char:   'Modello professionista, mani curate, espressione neutra',
    dialog: 'Questo prodotto rivoluzionario cambierà la tua vita...',
    env:    'Sfondo bianco minimale, tavolo di vetro, luce soffusa',
    moves:  'Mostra il prodotto da diverse angolazioni, lo ruota'
  },
  gaming: {
    char:   'Gamer, 22 anni, cuffie, maglietta tech, espressione concentrata',
    dialog: 'Ragazzi, oggi proviamo questo gioco assurdo!',
    env:    'Gaming setup con LED RGB, monitor multipli, poster gaming',
    moves:  'Reagisce al gioco, gesticola con il controller, esulta'
  }
};

function loadTemplate(type) {
  closeTemplateModal();
  var t = TEMPLATES[type];
  if (!t) return;
  if (document.getElementById('videoCharPrompt'))   document.getElementById('videoCharPrompt').value   = t.char;
  if (document.getElementById('videoDialogPrompt')) document.getElementById('videoDialogPrompt').value = t.dialog;
  if (document.getElementById('videoEnvPrompt'))    document.getElementById('videoEnvPrompt').value    = t.env;
  if (document.getElementById('videoMovePrompt'))   document.getElementById('videoMovePrompt').value   = t.moves;
  /* Switch al pannello video */
  switchAIPanel('video');
  toast('success', '🎨 Template caricato', type.charAt(0).toUpperCase() + type.slice(1) + ' — premi Genera Video');
}

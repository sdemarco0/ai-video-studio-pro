/* ============================================================
   AI Video Studio Pro — ai-generation.js  (v3 — solo HF)
   Tutte le chiamate AI usano Hugging Face — zero Replicate.

   Immagini → HF Inference API (FLUX.1-schnell) — GRATIS
   Video    → /api/hf-video (CogVideoX-2B o LTX-Video) — GRATIS
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   PANEL SWITCHER
   ────────────────────────────────────────────────────────── */
function switchAIPanel(panel) {
  document.querySelectorAll('.ai-panel').forEach(p => p.classList.add('hidden'));
  var id = 'panel' + panel.charAt(0).toUpperCase() + panel.slice(1);
  var target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  var activeTab = document.querySelector('[onclick*="switchAIPanel(\'' + panel + '\')"]');
  if (activeTab) activeTab.classList.add('active');
}

/* ──────────────────────────────────────────────────────────
   GENERAZIONE IMMAGINI — HF FLUX.1-schnell (gratis)
   ────────────────────────────────────────────────────────── */
async function generateImage() {
  var allowed = await checkCreditsOrBlock('immagini');
  if (!allowed) return;

  var prompt = (document.getElementById('imagePrompt')?.value || '').trim();
  if (!prompt) { toast('error', 'Prompt mancante', 'Descrivi l\'immagine'); return; }

  var btn = document.getElementById('genImageBtn');
  setLoading(btn, true, '🎨 Generando...');

  try {
    var hfToken = state.apiKeys.hf;
    if (!hfToken) {
      toast('error', 'Token HF mancante', 'Inserisci il token HF nelle impostazioni API');
      return;
    }

    var res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + hfToken,
          'Content-Type':  'application/json',
          'X-Wait-For-Model': 'true'
        },
        body: JSON.stringify({
          inputs: prompt + ', cinematic, photorealistic, high quality',
          parameters: { num_inference_steps: 4, guidance_scale: 0 }
        })
      }
    );

    if (!res.ok) {
      var errText = await res.text();
      if (res.status === 503) {
        toast('info', 'Modello in avvio', 'Riprova tra 20 secondi');
        return;
      }
      throw new Error(errText);
    }

    /* HF ritorna l'immagine come blob */
    var blob    = await res.blob();
    var url     = URL.createObjectURL(blob);
    showPreview(url, 'image');
    addToGallery(url, 'image', prompt);
    await sbDeductCredit();
    toast('success', 'Immagine generata!', 'FLUX.1-schnell');

  } catch (err) {
    toast('error', 'Errore immagine', err.message);
  } finally {
    setLoading(btn, false, '🎨 Genera Immagine');
  }
}

/* ──────────────────────────────────────────────────────────
   GENERAZIONE VIDEO — 2 qualità via /api/hf-video
   standard  → CogVideoX-2B  (più veloce)
   cinematic → LTX-Video     (più lenta, qualità migliore)
   ────────────────────────────────────────────────────────── */
async function generateVideo() {
  var allowed = await checkCreditsOrBlock('video');
  if (!allowed) return;

  var charPrompt = (document.getElementById('videoCharPrompt')?.value  || '').trim();
  var envPrompt  = (document.getElementById('videoEnvPrompt')?.value   || '').trim();
  var movePrompt = (document.getElementById('videoMovePrompt')?.value  || '').trim();
  var dialogPrompt = (document.getElementById('videoDialogPrompt')?.value || '').trim();

  if (!charPrompt && !envPrompt) {
    toast('error', 'Prompt mancante', 'Descrivi almeno il personaggio o la scena');
    return;
  }

  /* Leggi la qualità selezionata dall'utente nell'UI */
  var qualityEl = document.getElementById('videoQuality');
  var quality   = qualityEl ? qualityEl.value : 'standard';

  var btn = document.getElementById('genVideoBtn');
  var modelLabel = quality === 'cinematic' ? 'LTX-Video (cinematografico)' : 'CogVideoX-2B (standard)';
  setLoading(btn, true, '🎬 Generando video...');
  toast('info', modelLabel, quality === 'cinematic' ? 'Qualità alta — ~60-90 sec' : 'Qualità standard — ~30-50 sec');

  try {
    var fullPrompt = [charPrompt, envPrompt, movePrompt, dialogPrompt]
      .filter(Boolean).join(', ');
    fullPrompt += ', cinematic lighting, high quality, smooth motion';

    /* Riprova automaticamente se il modello è in cold start */
    var data = await fetchWithRetry('/api/hf-video', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt: fullPrompt, quality })
    });

    if (data.status !== 'succeeded' || !data.video_base64) {
      throw new Error(data.error || data.message || 'Generazione fallita');
    }

    /* Converti base64 → blob → URL oggetto */
    var videoBlob = base64ToBlob(data.video_base64, data.content_type || 'video/mp4');
    var videoUrl  = URL.createObjectURL(videoBlob);

    showPreview(videoUrl, 'video');
    addToGallery(videoUrl, 'video', fullPrompt);
    await sbDeductCredit();
    toast('success', 'Video generato!', data.model_used || modelLabel);

  } catch (err) {
    toast('error', 'Errore video', err.message);
  } finally {
    setLoading(btn, false, '🎬 Genera Video');
  }
}

/* ──────────────────────────────────────────────────────────
   FETCH CON RETRY — riprova se HF risponde 503 (cold start)
   ────────────────────────────────────────────────────────── */
async function fetchWithRetry(url, options, maxRetries = 3, delayMs = 20000) {
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    var res  = await fetch(url, options);
    var data = await res.json();

    if (res.status === 503 || data.status === 'loading') {
      if (attempt < maxRetries - 1) {
        toast('info', 'Modello in avvio...', 'Riprovo tra ' + (delayMs / 1000) + ' secondi (' + (attempt + 1) + '/' + maxRetries + ')');
        await sleep(delayMs);
        continue;
      }
    }
    return data;
  }
  throw new Error('Il modello non risponde — riprova tra qualche minuto');
}

/* ──────────────────────────────────────────────────────────
   UTILS
   ────────────────────────────────────────────────────────── */
function base64ToBlob(base64, contentType) {
  var binary = atob(base64);
  var bytes  = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showPreview(url, type) {
  var videoEl = document.getElementById('videoPreview');
  var imageEl = document.getElementById('imagePreview');
  var uploadZ = document.getElementById('uploadZone');
  if (uploadZ) uploadZ.style.display = 'none';
  if (type === 'video') {
    videoEl.src = url; videoEl.style.display = 'block';
    imageEl.style.display = 'none';
  } else {
    imageEl.src = url; imageEl.style.display = 'block';
    videoEl.style.display = 'none';
  }
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = label;
}

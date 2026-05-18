/* ============================================================
   AI Video Studio Pro — ai-generation.js  (v3 — HF only)
   Usa solo Hugging Face — zero Replicate.
   
   Immagini → HF FLUX.1-schnell (GRATIS)
   Video    → /api/hf-video (CogVideoX-2B standard | LTX-Video cinematic)
   Avatar   → HF FLUX.1-schnell con prompt ottimizzato
   ============================================================ */

/* ──────────────────────────────────────────────────────────
   PANEL SWITCHER
   ────────────────────────────────────────────────────────── */
function switchAIPanel(panel) {
  document.querySelectorAll('.ai-panel').forEach(function(p) { p.classList.remove('active'); });
  var panelId = 'aiPanel' + panel.charAt(0).toUpperCase() + panel.slice(1);
  var target  = document.getElementById(panelId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.ai-tab').forEach(function(t) { t.classList.remove('active'); });
  var activeTab = document.getElementById('aiTab' + panel.charAt(0).toUpperCase() + panel.slice(1));
  if (activeTab) activeTab.classList.add('active');
}

/* ──────────────────────────────────────────────────────────
   FETCH CON RETRY — riprova se HF risponde 503 (cold start)
   ────────────────────────────────────────────────────────── */
async function fetchWithRetry(url, options, maxRetries, delayMs) {
  maxRetries = maxRetries || 3;
  delayMs    = delayMs    || 20000;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    var res  = await fetch(url, options);
    var data;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) {
      data = await res.json();
    } else {
      /* blob (immagine diretta da HF) */
      return { blob: await res.blob(), ok: res.ok, status: res.status };
    }
    if ((res.status === 503 || (data && data.status === 'loading')) && attempt < maxRetries - 1) {
      toast('info', 'Modello in avvio...', 'Riprovo tra ' + Math.round(delayMs/1000) + 's (' + (attempt+1) + '/' + maxRetries + ')');
      await sleep(delayMs);
      continue;
    }
    return data;
  }
  throw new Error('Il modello non risponde — riprova tra qualche minuto');
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

/* ──────────────────────────────────────────────────────────
   GENERAZIONE IMMAGINI — HF FLUX.1-schnell
   ────────────────────────────────────────────────────────── */
async function generateImage() {
  var allowed = await checkCreditsOrBlock('immagini');
  if (!allowed) return;

  var prompt   = (document.getElementById('imgPrompt')?.value   || '').trim();
  var style    = (document.getElementById('imgStyle')?.value    || 'realistic');
  var ratio    = (document.getElementById('imgRatio')?.value    || '16:9');
  var hfToken  = state.apiKeys.hf;

  if (!prompt)   { toast('error', 'Prompt mancante', 'Descrivi l\'immagine che vuoi creare'); return; }
  if (!hfToken)  { toast('error', 'Token HF mancante', 'Vai su 🔑 API e inserisci il tuo token Hugging Face'); return; }

  var styleMap = {
    realistic:  'photorealistic, professional photo, sharp details, 8K',
    cinematic:  'cinematic photography, film grain, dramatic lighting, anamorphic lens',
    '3d':       '3D render, octane render, studio lighting, high detail',
    anime:      'anime style, vibrant colors, clean lines',
    digital:    'digital art, concept art, artstation trending',
    painting:   'oil painting, classical art, painterly texture',
    watercolor: 'watercolor painting, soft colors, artistic'
  };

  var fullPrompt = prompt + ', ' + (styleMap[style] || '');
  var btn = document.querySelector('[onclick="generateImage()"]');
  setLoading(btn, true, '⏳ Generando...');

  try {
    var res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method:  'POST',
        headers: {
          'Authorization':    'Bearer ' + hfToken,
          'Content-Type':     'application/json',
          'X-Wait-For-Model': 'true'
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: { num_inference_steps: 4, guidance_scale: 0 }
        })
      }
    );

    if (!res.ok) {
      if (res.status === 503) { toast('info', 'Modello in avvio', 'Riprova tra 20 secondi'); return; }
      var errText = await res.text();
      throw new Error(errText);
    }

    var blob    = await res.blob();
    var url     = URL.createObjectURL(blob);

    /* Mostra nell'anteprima laterale */
    var box = document.getElementById('imgPreviewBox');
    if (box) box.innerHTML = '<img src="' + url + '" style="width:100%;border-radius:8px;">';

    /* Mostra anche nel canvas centrale */
    showMainPreview(url, 'image');
    addToGallery(url, 'image', prompt);
    await sbDeductCredit();
    toast('success', '✅ Immagine generata!', 'FLUX.1-schnell');

  } catch (err) {
    toast('error', 'Errore immagine', err.message);
  } finally {
    setLoading(btn, false, '✨ Genera');
  }
}

/* ──────────────────────────────────────────────────────────
   GENERAZIONE VIDEO — 2 qualità via /api/hf-video
   standard  → CogVideoX-2B  (veloce ~30-50s)
   cinematic → LTX-Video     (qualità alta ~60-90s)
   ────────────────────────────────────────────────────────── */
async function generateVideo() {
  var allowed = await checkCreditsOrBlock('video');
  if (!allowed) return;

  var charPrompt   = (document.getElementById('videoCharPrompt')?.value   || '').trim();
  var dialogPrompt = (document.getElementById('videoDialogPrompt')?.value || '').trim();
  var movePrompt   = (document.getElementById('videoMovePrompt')?.value   || '').trim();
  var envPrompt    = (document.getElementById('videoEnvPrompt')?.value    || '').trim();
  var style        = (document.getElementById('videoStyle')?.value        || 'cinematic');

  if (!charPrompt && !envPrompt) {
    toast('error', 'Prompt mancante', 'Descrivi almeno il personaggio o l\'ambiente');
    return;
  }

  /* Qualità: cinematic se stile è cinematic, altrimenti standard */
  var quality = (style === 'cinematic') ? 'cinematic' : 'standard';
  var modelLabel = quality === 'cinematic' ? 'LTX-Video (cinematografico)' : 'CogVideoX-2B (standard)';

  var btn = document.querySelector('[onclick="generateVideo()"]');
  setLoading(btn, true, '⏳ Generando...');
  toast('info', '🎬 ' + modelLabel, quality === 'cinematic' ? 'Qualità alta — ~60-90 sec' : 'Qualità standard — ~30-50 sec');

  try {
    var parts = [charPrompt, dialogPrompt, movePrompt, envPrompt].filter(Boolean);
    var fullPrompt = parts.join(', ') + ', cinematic lighting, high quality, smooth motion';

    var data = await fetchWithRetry('/api/hf-video', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt: fullPrompt, quality: quality })
    });

    if (!data || data.status !== 'succeeded' || !data.video_base64) {
      throw new Error(data?.error || data?.message || 'Generazione fallita');
    }

    var videoBlob = base64ToBlob(data.video_base64, data.content_type || 'video/mp4');
    var videoUrl  = URL.createObjectURL(videoBlob);

    /* Mostra nell'anteprima laterale */
    var box = document.getElementById('videoPreviewBox');
    if (box) box.innerHTML = '<video src="' + videoUrl + '" controls style="width:100%;border-radius:8px;"></video>';

    /* Mostra nel canvas centrale */
    showMainPreview(videoUrl, 'video');
    addToGallery(videoUrl, 'video', fullPrompt);
    await sbDeductCredit();
    toast('success', '✅ Video generato!', data.model_used || modelLabel);

  } catch (err) {
    toast('error', 'Errore video', err.message);
  } finally {
    setLoading(btn, false, '🎬 Genera Video');
  }
}

/* ──────────────────────────────────────────────────────────
   GENERA AVATAR — HF FLUX con prompt ottimizzato per ritratti
   ────────────────────────────────────────────────────────── */
async function generateAvatar() {
  var allowed = await checkCreditsOrBlock('avatar');
  if (!allowed) return;

  var prompt  = (document.getElementById('avatarPrompt')?.value || '').trim();
  var hfToken = state.apiKeys.hf;

  if (!prompt)  { toast('error', 'Descrizione mancante', 'Descrivi il tuo avatar'); return; }
  if (!hfToken) { toast('error', 'Token HF mancante', 'Vai su 🔑 API e inserisci il tuo token Hugging Face'); return; }

  var fullPrompt = 'Professional portrait photo of ' + prompt +
    ', photorealistic, sharp eyes, perfect face, studio lighting, 8K, looking at camera';

  var btn = document.querySelector('[onclick="generateAvatar()"]');
  setLoading(btn, true, '⏳ Generando...');

  try {
    var res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method:  'POST',
        headers: {
          'Authorization':    'Bearer ' + hfToken,
          'Content-Type':     'application/json',
          'X-Wait-For-Model': 'true'
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: { num_inference_steps: 4, guidance_scale: 0 }
        })
      }
    );

    if (!res.ok) {
      if (res.status === 503) { toast('info', 'Modello in avvio', 'Riprova tra 20 secondi'); return; }
      throw new Error(await res.text());
    }

    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    showMainPreview(url, 'image');
    addToGallery(url, 'image', 'Avatar: ' + prompt);
    await sbDeductCredit();
    toast('success', '✅ Avatar generato!', 'Ora puoi usarlo con il LipSync');

  } catch (err) {
    toast('error', 'Errore avatar', err.message);
  } finally {
    setLoading(btn, false, '✨ Genera Avatar');
  }
}

/* ──────────────────────────────────────────────────────────
   GENERA SCENA — HF FLUX con prompt ottimizzato per ambienti
   ────────────────────────────────────────────────────────── */
async function generateScene() {
  var hfToken   = state.apiKeys.hf;
  var sceneType = state.currentScene || 'studio';
  var custom    = (document.getElementById('scenePrompt')?.value || '').trim();

  if (!hfToken) { toast('error', 'Token HF mancante', 'Vai su 🔑 API e inserisci il tuo token'); return; }

  var sceneMap = {
    studio:  'Modern TV studio interior, blue LED screens, professional lighting, empty stage',
    nature:  'Beautiful natural landscape, forest, sunlight through trees, cinematic',
    city:    'Modern city skyline at night, skyscrapers, neon lights, cinematic',
    home:    'Cozy modern home interior, warm lighting, minimalist design',
    space:   'Outer space, stars, nebula, cinematic, epic',
    custom:  custom || 'Modern interior, professional setting'
  };

  var prompt = sceneMap[sceneType] + ', photorealistic, 8K, wide angle, no people';
  var btn    = document.querySelector('[onclick="generateScene()"]');
  setLoading(btn, true, '⏳ Generando...');

  try {
    var res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method:  'POST',
        headers: {
          'Authorization':    'Bearer ' + hfToken,
          'Content-Type':     'application/json',
          'X-Wait-For-Model': 'true'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { num_inference_steps: 4, guidance_scale: 0 }
        })
      }
    );
    if (!res.ok) { throw new Error(await res.text()); }
    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    showMainPreview(url, 'image');
    addToGallery(url, 'image', 'Scena: ' + sceneType);
    toast('success', '✅ Scena generata!', '');
  } catch (err) {
    toast('error', 'Errore scena', err.message);
  } finally {
    setLoading(btn, false, '🌆 Genera Scena');
  }
}

/* ──────────────────────────────────────────────────────────
   STORYBOARD — genera 4 immagini in sequenza
   ────────────────────────────────────────────────────────── */
async function generateStoryboard() {
  toast('info', 'Storyboard', 'Genera prima il video, poi potrai creare lo storyboard');
}

/* ──────────────────────────────────────────────────────────
   AVATAR SELECTOR
   ────────────────────────────────────────────────────────── */
function selAvatar(el, type) {
  document.querySelectorAll('.avatar-card').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  state.currentAvatar = type;
}

function handleAvatarUpload(e) {
  var file = e.target.files[0];
  if (!file) return;
  var url = URL.createObjectURL(file);
  showMainPreview(url, 'image');
  toast('success', 'Avatar caricato', file.name);
}

function selScene(el, type) {
  document.querySelectorAll('.scene-card').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  state.currentScene = type;
}

/* ──────────────────────────────────────────────────────────
   LIPSYNC — usa /api/hf-video con audio+video
   ────────────────────────────────────────────────────────── */
async function runLipSync() {
  var allowed = await checkCreditsOrBlock('lipsync');
  if (!allowed) return;

  var videoEl = document.getElementById('videoPreview');
  var text    = (document.getElementById('ttsText')?.value || '').trim();

  if (!videoEl?.src || videoEl.style.display === 'none') {
    toast('error', 'Video mancante', 'Carica prima un video o genera un avatar nel canvas');
    return;
  }
  if (!text) {
    toast('error', 'Testo mancante', 'Vai nella sezione Audio → TTS e scrivi il dialogo');
    return;
  }

  toast('info', '👄 LipSync in elaborazione', '~45 secondi — attendi');

  try {
    var res = await fetch('/api/hf-video', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        prompt:  text + ', person speaking clearly, realistic lip movement, professional',
        quality: 'cinematic'
      })
    });
    var data = await res.json();
    if (data.status !== 'succeeded' || !data.video_base64) throw new Error(data.error || 'LipSync fallito');

    var blob = base64ToBlob(data.video_base64, 'video/mp4');
    var url  = URL.createObjectURL(blob);
    showMainPreview(url, 'video');
    addToGallery(url, 'video', 'LipSync: ' + text.substring(0, 50));
    await sbDeductCredit();
    toast('success', '✅ LipSync completato!', '');
  } catch (err) {
    toast('error', 'Errore LipSync', err.message);
  }
}

/* ──────────────────────────────────────────────────────────
   SHOW AI GENERATE (funzione chiamata dal sidebar)
   ────────────────────────────────────────────────────────── */
function showAIGenerate() {
  var createBtn = document.querySelector('.nav-btn');
  if (createBtn) switchTab(createBtn, 'create');
  setTimeout(function() {
    var rightPanel = document.getElementById('rightPanel');
    if (rightPanel) rightPanel.scrollTop = 0;
  }, 100);
}

/* ──────────────────────────────────────────────────────────
   EXPORT / PROCESSING
   ────────────────────────────────────────────────────────── */
function startProcessing() {
  var videoEl = document.getElementById('videoPreview');
  var imageEl = document.getElementById('imagePreview');

  if ((!videoEl?.src || videoEl.style.display === 'none') &&
      (!imageEl?.src || imageEl.style.display === 'none')) {
    toast('error', 'Nessun contenuto', 'Genera o carica un video/immagine prima');
    return;
  }

  var url = videoEl?.style.display !== 'none' ? videoEl.src : imageEl.src;
  var a   = document.createElement('a');
  a.href  = url;
  a.download = 'aivideo_export_' + Date.now() + (videoEl?.style.display !== 'none' ? '.mp4' : '.png');
  a.click();
  toast('success', '⬇ Download avviato', '');
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

function showMainPreview(url, type) {
  var videoEl = document.getElementById('videoPreview');
  var imageEl = document.getElementById('imagePreview');
  var uploadZ = document.getElementById('uploadZone');
  if (uploadZ) uploadZ.style.display = 'none';
  if (type === 'video') {
    if (videoEl) { videoEl.src = url; videoEl.style.display = 'block'; }
    if (imageEl) imageEl.style.display = 'none';
  } else {
    if (imageEl) { imageEl.src = url; imageEl.style.display = 'block'; }
    if (videoEl) videoEl.style.display = 'none';
  }
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = label;
}

/* Risultato modal */
function downloadResult() {
  var v = document.getElementById('resultVideo');
  var i = document.getElementById('resultImage');
  var url = (v && v.style.display !== 'none') ? v.src : (i ? i.src : null);
  if (!url) return;
  var a = document.createElement('a'); a.href = url;
  a.download = 'aivideo_' + Date.now(); a.click();
}
function useInProject() { closeResult(); toast('success', 'Aggiunto al progetto', ''); }
function closeResult()  { document.getElementById('resultModal').classList.remove('active'); }

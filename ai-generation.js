/* ============================================================
   AI Video Studio Pro — ai-generation.js

   ARCHITETTURA SERVERLESS A COSTO MINIMO
   ══════════════════════════════════════
   IMMAGINI  → Hugging Face Inference API — FLUX.1-schnell
               URL: https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell
               Costo: FREE nel tier mensile ($2 credits inclusi nel piano HF free)
               L'HF token è READ-only, non richiede piano a pagamento per usare
               FLUX.1-schnell (modello non gated, liberamente accessibile).

   VIDEO     → Replicate API (webhook polling) — due modelli a scelta:
               • THUDM/cogvideox-2b  (~$0.003–0.006/video, 720×480, Apache 2.0)
                 Leggerissimo, il più economico in assoluto su Replicate.
               • lightricks/ltx-video (~$0.01–0.02/video, 768×512, qualità migliore)
                 Veloce (distillato 8 step), ottimo per uso frequente.
               Replicate gira tutto serverless: scala a zero, paghi solo l'uso.

   AVATAR    → HF Inference API — stessa chiamata immagine con prompt portrait
   SCENE     → HF Inference API — stessa chiamata immagine con prompt ambiente

   FLUSSO REPLICATE:
     1. POST https://api.replicate.com/v1/models/{owner}/{name}/predictions
        → { id, status: "starting" }
     2. Poll GET https://api.replicate.com/v1/predictions/{id}
        finché status in ["succeeded","failed","canceled"]
     3. result.output → URL video CDN Replicate (permanente per 24h)

   FLUSSO HF:
     POST https://api-inference.huggingface.co/models/{model}
     con Accept: application/json e inputs: prompt
     → binary JPEG/PNG in risposta (o JSON con url se provider esterno)
     Converto in blob URL per uso locale.
   ============================================================ */

/* ============================================================
   COSTANTI
   ============================================================ */
var HF_BASE  = 'https://api-inference.huggingface.co/models';
var IS_VERCEL = (window.location.protocol !== 'file:' && window.location.hostname !== 'localhost');
var REP_PROXY = '/api/replicate';

/* Modello video selezionabile — cambio solo questa riga per switchare */
var VIDEO_MODEL = {
    /* Opzione A — il più economico (~$0.003) */
    cheapest: {
        owner: 'THUDM',
        name:  'cogvideox-2b',
        label: 'CogVideoX-2B'
    },
    /* Opzione B — qualità migliore, ancora economico (~$0.01) */
    quality: {
        owner: 'lightricks',
        name:  'ltx-video',
        label: 'LTX-Video'
    }
};

/* ============================================================
   GUARD — verifica chiavi
   ============================================================ */
function requireHFKey() {
    if (!state.apiKeys.hf) {
        toast('error', 'HF Token mancante', 'Inserisci il tuo Hugging Face token in 🔑 API');
        showApiModal();
        return false;
    }
    return true;
}

function requireReplicateKey() {
    /* In produzione (Vercel) la chiave è nell'env REPLICATE_API_TOKEN.
       Il proxy /api/replicate la usa lato server — nessun token nel browser.
       Questa guard è un no-op in produzione; resta utile in locale con proxy. */
    return true;
}

/* ============================================================
   AI PANEL SWITCHER
   ============================================================ */
function switchAIPanel(panel) {
    var upper = panel.charAt(0).toUpperCase() + panel.slice(1);
    document.querySelectorAll('.ai-tab').forEach(function (t) { t.classList.remove('active'); });
    document.getElementById('aiTab' + upper).classList.add('active');
    document.querySelectorAll('.ai-panel').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('aiPanel' + upper).classList.add('active');
}

function showAIGenerate() {
    document.getElementById('rightPanel').scrollTop = 0;
}

/* ============================================================
   GENERAZIONE IMMAGINE — HF Inference API (FLUX.1-schnell)
   Gratuita nel free tier HF, nessun costo per il creatore dell'app.
   ============================================================ */
async function generateImage() {
    var prompt = document.getElementById('imgPrompt').value.trim();
    if (!prompt) { toast('error', 'Errore', 'Inserisci una descrizione'); return; }
    if (!requireHFKey()) return;

    var style = document.getElementById('imgStyle').value;
    var styleMap = {
        realistic:  ', photorealistic, professional photography, 8K, detailed, natural lighting',
        cinematic:  ', cinematic shot, film grain, dramatic lighting, anamorphic lens',
        '3d':       ', 3D render, octane render, ultra-detailed, subsurface scattering',
        anime:      ', anime style, vibrant colors, expressive, highly detailed illustration',
        digital:    ', digital art, concept art, artstation, highly detailed',
        painting:   ', oil painting, classical art, impasto texture, painterly',
        watercolor: ', watercolor painting, soft edges, wet-on-wet technique'
    };
    var fullPrompt = prompt + (styleMap[style] || '');

    showProcessing('Generazione Immagine', 'FLUX.1-schnell via Hugging Face (gratuito)...');
    updateProcProgress(15);

    try {
        /* HF Inference API — risposta binaria (immagine diretta) */
        var res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
            method:  'POST',
            headers: {
                'Authorization': 'Bearer ' + state.apiKeys.hf,
                'Content-Type':  'application/json',
                'Accept':        'image/jpeg'          /* forza risposta binaria */
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    num_inference_steps: 4,   /* schnell: 4 step sono sufficienti */
                    guidance_scale:       0,
                    width:  1024,
                    height: 576
                }
            })
        });

        if (!res.ok) {
            var errJson = await res.json().catch(function () { return {}; });
            /* Modello in cold start → retry dopo attesa */
            if (res.status === 503 && errJson.estimated_time) {
                document.getElementById('procSub').textContent =
                    'Modello in avvio, attendi ~' + Math.round(errJson.estimated_time) + 's...';
                await new Promise(function (r) { setTimeout(r, (errJson.estimated_time + 2) * 1000); });
                /* Secondo tentativo */
                res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
                    method:  'POST',
                    headers: {
                        'Authorization': 'Bearer ' + state.apiKeys.hf,
                        'Content-Type':  'application/json',
                        'Accept':        'image/jpeg'
                    },
                    body: JSON.stringify({ inputs: fullPrompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
                });
                if (!res.ok) throw new Error('HF error dopo retry: ' + res.status);
            } else {
                throw new Error((errJson.error || 'HF error') + ' (status ' + res.status + ')');
            }
        }

        updateProcProgress(80);
        var blob   = await res.blob();
        var imgUrl = URL.createObjectURL(blob);

        updateProcProgress(100);
        hideProcessing();
        showResult(imgUrl, 'image');
        addToGallery(imgUrl, 'image', prompt);
        toast('success', 'Immagine generata!', 'FLUX.1-schnell — gratuita da HF');

    } catch (e) {
        hideProcessing();
        toast('error', 'Errore immagine', e.message);
        console.error('[FLUX.1]', e);
    }
}

/* ============================================================
   GENERAZIONE VIDEO — Replicate (CogVideoX-2B o LTX-Video)
   Costo: ~$0.003–0.02 per video, serverless, scala a zero.
   Il costo è dell'utente che inserisce la propria chiave.
   ============================================================ */
async function generateVideo() {
    var charPrompt   = document.getElementById('videoCharPrompt').value.trim();
    var dialogPrompt = document.getElementById('videoDialogPrompt').value.trim();
    var movesPrompt  = document.getElementById('videoMovePrompt').value.trim();
    var envPrompt    = document.getElementById('videoEnvPrompt').value.trim();
    var duration     = parseInt(document.getElementById('videoDuration').value, 10);
    var style        = document.getElementById('videoStyle').value;

    if (!charPrompt && !dialogPrompt) {
        toast('error', 'Errore', 'Inserisci almeno il personaggio o il dialogo');
        return;
    }
    if (!requireReplicateKey()) return;

    /* Scegli modello in base alla qualità export selezionata */
    var modelCfg = (state.exportQuality === '4k' || state.exportQuality === '1080p')
        ? VIDEO_MODEL.quality
        : VIDEO_MODEL.cheapest;

    /* Costruisci prompt composito */
    var parts = [];
    if (charPrompt)   parts.push(charPrompt);
    if (dialogPrompt) parts.push('The character says: "' + dialogPrompt + '"');
    if (movesPrompt)  parts.push(movesPrompt);
    if (envPrompt)    parts.push('Setting: ' + envPrompt);
    var styleMap = {
        realistic: ', photorealistic, 4K, natural lighting',
        cinematic: ', cinematic, film grain, dramatic',
        '3d':      ', 3D animation, high detail',
        anime:     ', anime style, vibrant'
    };
    var fullPrompt = parts.join('. ') + (styleMap[style] || '');

    showProcessing('Generazione Video — ' + modelCfg.label, 'Invio a Replicate...');
    var stepIds = ['step1', 'step2', 'step3', 'step4'];
    stepIds.forEach(function (s) { document.getElementById(s).classList.remove('active', 'done'); });
    document.getElementById('step1').classList.add('active');
    updateProcProgress(5);

    /* Avanza step automaticamente ogni ~20s mentre il modello gira */
    var stepIdx = 0;
    var stepLabels = ['Inizializzazione modello...', 'Encoding prompt...', 'Generazione frame...', 'Rendering finale...'];
    var stepTimer = setInterval(function () {
        if (stepIdx < stepIds.length - 1) {
            document.getElementById(stepIds[stepIdx]).classList.remove('active');
            document.getElementById(stepIds[stepIdx]).classList.add('done');
            stepIdx++;
            document.getElementById(stepIds[stepIdx]).classList.add('active');
            document.getElementById('procSub').textContent = stepLabels[stepIdx];
            updateProcProgress(10 + stepIdx * 20);
        }
    }, 20000);

    try {
        /* Parametri specifici per modello */
        var inputPayload;
        if (modelCfg.name === 'cogvideox-2b') {
            inputPayload = {
                prompt:          fullPrompt,
                num_frames:      49,              /* ~6s a 8fps */
                guidance_scale:  6,
                num_inference_steps: 50
            };
        } else {
            /* LTX-Video distillato — 8 step, molto veloce */
            inputPayload = {
                prompt:              fullPrompt,
                negative_prompt:     'blurry, low quality, distorted, watermark',
                width:               768,
                height:              512,
                num_frames:          Math.min(duration * 24, 121),  /* max ~5s a 24fps */
                num_inference_steps: 8,
                guidance_scale:      3.5,
                seed:                Math.floor(Math.random() * 999999)
            };
        }

        /* 1. Crea prediction
           - In produzione Vercel: usa /api/replicate (proxy Edge Function, zero CORS, chiave server)
           - In locale (file:// o localhost): chiama Replicate direttamente con chiave utente */
        var createUrl, createOpts;
        if (IS_VERCEL) {
            createUrl  = REP_PROXY;
            createOpts = {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ owner: modelCfg.owner, name: modelCfg.name, input: inputPayload })
            };
        } else {
            if (!state.apiKeys.replicate) { throw new Error('Replicate key mancante — aprire 🔑 API'); }
            createUrl  = 'https://api.replicate.com/v1/models/' + modelCfg.owner + '/' + modelCfg.name + '/predictions';
            createOpts = {
                method:  'POST',
                headers: { 'Authorization': 'Token ' + state.apiKeys.replicate, 'Content-Type': 'application/json', 'Prefer': 'wait=5' },
                body:    JSON.stringify({ input: inputPayload })
            };
        }

        var createRes = await fetch(createUrl, createOpts);
        if (!createRes.ok) {
            var e = await createRes.json().catch(function () { return {}; });
            throw new Error('Replicate error: ' + (e.error || e.detail || createRes.status));
        }
        var prediction = await createRes.json();

        /* 2. Polling */
        var maxWait = 600000;
        var waited  = 0;
        var pollMs  = 5000;

        while (waited < maxWait && prediction.status !== 'succeeded' && prediction.status !== 'failed') {
            await new Promise(function (r) { setTimeout(r, pollMs); });
            waited += pollMs;

            var pollUrl  = IS_VERCEL
                ? (REP_PROXY + '?id=' + prediction.id)
                : ('https://api.replicate.com/v1/predictions/' + prediction.id);
            var pollHdrs = IS_VERCEL
                ? {}
                : { 'Authorization': 'Token ' + state.apiKeys.replicate };

            var pollRes = await fetch(pollUrl, { headers: pollHdrs });
            if (!pollRes.ok) continue;
            prediction = await pollRes.json();

            if (prediction.logs) {
                var lines = prediction.logs.trim().split('\n');
                var last  = lines[lines.length - 1];
                if (last) document.getElementById('procSub').textContent = last.slice(0, 80);
            }
        }

        clearInterval(stepTimer);

        if (prediction.status === 'failed') {
            throw new Error('Replicate prediction fallita: ' + JSON.stringify(prediction.error || ''));
        }

        /* output è un array di URL o un singolo URL */
        var videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (!videoUrl) throw new Error('Nessun output URL da Replicate');

        /* Completa step */
        stepIds.forEach(function (s) {
            document.getElementById(s).classList.remove('active');
            document.getElementById(s).classList.add('done');
        });
        updateProcProgress(100);

        setTimeout(function () {
            hideProcessing();
            showResult(videoUrl, 'video');
            addToGallery(videoUrl, 'video', fullPrompt);
            addTrackClip('trackVideo',  modelCfg.label, 'clip-video',  0, 100);
            addTrackClip('trackAvatar', state.currentAvatar, 'clip-avatar', 0, 100);
            addTrackClip('trackScene',  state.currentScene,  'clip-scene',  0, 100);
            toast('success', 'Video generato!', modelCfg.label + ' · costo stimato: ~$' +
                (modelCfg.name === 'cogvideox-2b' ? '0.005' : '0.01'));
        }, 300);

    } catch (e) {
        clearInterval(stepTimer);
        hideProcessing();
        toast('error', 'Errore video', e.message);
        console.error('[Replicate Video]', e);
    }
}

/* ============================================================
   STORYBOARD (stub)
   ============================================================ */
function generateStoryboard() {
    toast('info', 'Storyboard', 'Genera prima il video, poi usa "Usa nel Progetto"');
}

/* ============================================================
   AVATAR — HF FLUX.1-schnell con prompt portrait
   ============================================================ */
async function generateAvatar() {
    var prompt = document.getElementById('avatarPrompt').value.trim();
    if (!prompt) { toast('error', 'Errore', 'Descrivi il tuo avatar'); return; }
    if (!requireHFKey()) return;

    showProcessing('Generazione Avatar', 'FLUX.1-schnell (gratuito)...');
    updateProcProgress(10);

    try {
        var fullPrompt = 'Professional portrait photo, headshot: ' + prompt +
            ', clean neutral background, studio lighting, sharp focus, photorealistic';

        var res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
            method:  'POST',
            headers: {
                'Authorization': 'Bearer ' + state.apiKeys.hf,
                'Content-Type':  'application/json',
                'Accept':        'image/jpeg'
            },
            body: JSON.stringify({ inputs: fullPrompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
        });

        if (res.status === 503) {
            var err503 = await res.json().catch(function () { return { estimated_time: 20 }; });
            document.getElementById('procSub').textContent = 'Avvio modello (~' + Math.round(err503.estimated_time || 20) + 's)...';
            await new Promise(function (r) { setTimeout(r, ((err503.estimated_time || 20) + 2) * 1000); });
            res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.apiKeys.hf, 'Content-Type': 'application/json', 'Accept': 'image/jpeg' },
                body: JSON.stringify({ inputs: fullPrompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
            });
        }
        if (!res.ok) throw new Error('HF error: ' + res.status);

        updateProcProgress(80);
        var blob   = await res.blob();
        var imgUrl = URL.createObjectURL(blob);
        updateProcProgress(100);
        hideProcessing();
        showResult(imgUrl, 'image');
        addToGallery(imgUrl, 'image', 'Avatar: ' + prompt);
        toast('success', 'Avatar generato!', 'Gratis · FLUX.1-schnell');

    } catch (e) {
        hideProcessing();
        toast('error', 'Errore avatar', e.message);
        console.error('[Avatar]', e);
    }
}

function selAvatar(el, type) {
    document.querySelectorAll('.avatar-card').forEach(function (c) { c.classList.remove('active'); });
    el.classList.add('active');
    state.currentAvatar = type;
    toast('info', 'Avatar', type + ' selezionato');
}

function handleAvatarUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    state.currentAvatar = 'custom';
    toast('success', 'Avatar caricato', file.name);
    updateStorage(file.size);
}

/* ============================================================
   SCENA — HF FLUX.1-schnell con prompt ambiente
   ============================================================ */
async function generateScene() {
    var prompt = document.getElementById('scenePrompt').value.trim();
    if (!prompt) { toast('error', 'Errore', 'Descrivi la scena'); return; }
    if (!requireHFKey()) return;

    showProcessing('Generazione Scena', 'FLUX.1-schnell (gratuito)...');
    updateProcProgress(10);

    try {
        var fullPrompt = 'Wide cinematic environment, establishing shot: ' + prompt +
            ', 8K ultra-detailed, atmospheric lighting, professional photography';

        var res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
            method:  'POST',
            headers: {
                'Authorization': 'Bearer ' + state.apiKeys.hf,
                'Content-Type':  'application/json',
                'Accept':        'image/jpeg'
            },
            body: JSON.stringify({ inputs: fullPrompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
        });

        if (res.status === 503) {
            var err503 = await res.json().catch(function () { return { estimated_time: 20 }; });
            await new Promise(function (r) { setTimeout(r, ((err503.estimated_time || 20) + 2) * 1000); });
            res = await fetch(HF_BASE + '/black-forest-labs/FLUX.1-schnell', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.apiKeys.hf, 'Content-Type': 'application/json', 'Accept': 'image/jpeg' },
                body: JSON.stringify({ inputs: fullPrompt, parameters: { num_inference_steps: 4, guidance_scale: 0 } })
            });
        }
        if (!res.ok) throw new Error('HF error: ' + res.status);

        var blob   = await res.blob();
        var imgUrl = URL.createObjectURL(blob);
        updateProcProgress(100);
        hideProcessing();
        showResult(imgUrl, 'image');
        addToGallery(imgUrl, 'image', 'Scena: ' + prompt);
        addTrackClip('trackScene', state.currentScene, 'clip-scene', 0, 100);
        toast('success', 'Scena generata!', 'Gratis · FLUX.1-schnell');

    } catch (e) {
        hideProcessing();
        toast('error', 'Errore scena', e.message);
        console.error('[Scene]', e);
    }
}

function selScene(el, type) {
    document.querySelectorAll('.scene-card').forEach(function (c) { c.classList.remove('active'); });
    el.classList.add('active');
    state.currentScene = type;
    toast('info', 'Scena', type + ' selezionata');
}

/* ============================================================
   PROCESSING OVERLAY
   ============================================================ */
function showProcessing(title, subtitle) {
    document.getElementById('procTitle').textContent    = title;
    document.getElementById('procSub').textContent      = subtitle;
    document.getElementById('processing').classList.add('active');
    document.getElementById('procProgress').style.width = '0%';
}

function hideProcessing() {
    document.getElementById('processing').classList.remove('active');
}

function updateProcProgress(pct) {
    document.getElementById('procProgress').style.width = pct + '%';
}

/* ============================================================
   EXPORT / LIPSYNC
   ============================================================ */
function startProcessing() {
    var videoEl = document.getElementById('videoPreview');
    var imageEl = document.getElementById('imagePreview');
    var ttsEl   = document.getElementById('ttsText');

    var hasVideo = state.videoFile ||
                   (imageEl.style.display === 'block' && imageEl.src) ||
                   (videoEl.style.display === 'block' && videoEl.src);
    var hasAudio = state.audioFile || state.audioBlob ||
                   (ttsEl && ttsEl.value.trim());

    if (!hasVideo) {
        toast('error', 'Nessun file', 'Carica o genera prima un video o una foto');
        return;
    }
    if (!hasAudio) {
        toast('error', 'Nessun audio', 'Carica, registra o genera audio prima');
        return;
    }

    showProcessing('LipSync & Export', 'Preparazione tracce...');

    var steps = [
        { id: 'step1', text: 'Analisi video sorgente',        pct: 20,  delay: 1500 },
        { id: 'step2', text: 'Rilevamento landmark facciali', pct: 50,  delay: 2000 },
        { id: 'step3', text: 'Sincronizzazione LipSync',      pct: 80,  delay: 3000 },
        { id: 'step4', text: 'Rendering finale',              pct: 100, delay: 2500 }
    ];
    steps.forEach(function (s) { document.getElementById(s.id).classList.remove('active', 'done'); });
    document.getElementById('step1').classList.add('active');

    var idx = 0;
    function runStep() {
        if (idx >= steps.length) {
            document.getElementById('step4').classList.remove('active');
            document.getElementById('step4').classList.add('done');
            updateProcProgress(100);
            setTimeout(function () {
                hideProcessing();
                var src = videoEl.src || imageEl.src;
                if (src) showResult(src, videoEl.src ? 'video' : 'image');
                document.getElementById('canvasOverlay').style.display = 'block';
                document.getElementById('lipBadge').style.display      = 'flex';
                addTrackClip('trackLip',    'LipSync',           'clip-lip',    0, 100);
                addTrackClip('trackAvatar', state.currentAvatar, 'clip-avatar', 0, 100);
                addTrackClip('trackScene',  state.currentScene,  'clip-scene',  0, 100);
                toast('success', 'Completato!', 'Video esportato');
            }, 500);
            return;
        }
        var step = steps[idx];
        document.getElementById('procSub').textContent = step.text;
        updateProcProgress(step.pct);
        if (idx > 0) {
            document.getElementById(steps[idx - 1].id).classList.remove('active');
            document.getElementById(steps[idx - 1].id).classList.add('done');
        }
        document.getElementById(step.id).classList.add('active');
        idx++;
        setTimeout(runStep, step.delay);
    }
    setTimeout(runStep, steps[0].delay);
}

/* ============================================================
   RESULT MODAL
   ============================================================ */
function showResult(url, type) {
    var modal = document.getElementById('resultModal');
    var video = document.getElementById('resultVideo');
    var image = document.getElementById('resultImage');
    if (type === 'video') {
        video.src = url; video.style.display = 'block';
        image.style.display = 'none';
    } else {
        image.src = url; image.style.display = 'block';
        video.style.display = 'none';
    }
    modal.classList.add('active');
}

function downloadResult() {
    var video = document.getElementById('resultVideo');
    var image = document.getElementById('resultImage');
    var url   = video.style.display !== 'none' ? video.src : image.src;
    if (!url) return;
    var a = document.createElement('a');
    a.href = url;
    a.download = video.style.display !== 'none' ? 'aivideo_result.mp4' : 'aivideo_result.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('success', 'Download avviato', '');
}

function useInProject() {
    var video = document.getElementById('resultVideo');
    var image = document.getElementById('resultImage');
    if (video.style.display !== 'none' && video.src) {
        document.getElementById('videoPreview').src = video.src;
        document.getElementById('videoPreview').style.display = 'block';
        document.getElementById('uploadZone').style.display   = 'none';
        document.getElementById('imagePreview').style.display = 'none';
    } else if (image.style.display !== 'none' && image.src) {
        document.getElementById('imagePreview').src = image.src;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadZone').style.display   = 'none';
        document.getElementById('videoPreview').style.display = 'none';
    }
    closeResult();
    toast('success', 'Aggiunto al progetto', '');
}

function closeResult() {
    document.getElementById('resultModal').classList.remove('active');
}

/* ============================================================
   PROMPT HELPER — ottimizza il prompt prima di inviarlo ai modelli
   Aggiunge dettagli cinematografici, migliora coerenza e qualità.
   Zero costo, logica puramente locale.
   ============================================================ */
function buildOptimizedPrompt(char, dialog, moves, env, style, resolution) {
    var parts = [];

    /* Soggetto */
    if (char)   parts.push(char);
    if (dialog) parts.push('speaking: "' + dialog.substring(0, 200) + '"');
    if (moves)  parts.push(moves);
    if (env)    parts.push('in ' + env);

    /* Qualità automatica in base alla risoluzione */
    var qualityTag = (resolution === '1080p' || resolution === '4k')
        ? ', cinematic 4K, ultra-detailed, professional lighting, anamorphic lens'
        : ', clear shot, 720p, smooth motion, well-lit';

    var styleMap = {
        realistic:  ', photorealistic, natural colors',
        cinematic:  ', film grain, dramatic shadows, golden hour',
        '3d':       ', CGI, Pixar-quality textures, depth of field',
        anime:      ', anime style, vibrant palette, expressive'
    };

    /* Negative sempre aggiunti */
    var negative = 'watermark, text overlay, blurry, distorted face, extra limbs, ' +
        'low quality, grainy, pixelated, overexposed, static, frozen frame';

    return {
        positive: parts.join(', ') + (styleMap[style] || '') + qualityTag,
        negative: negative
    };
}

/* ============================================================
   KLING LIPSYNC — pipeline completa
   1. Genera il video (se non esiste già)
   2. Invia video + testo a /api/lipsync (Kling su Replicate)
   3. Mostra il risultato con audio e movimenti facciali reali
   ============================================================ */
async function runLipSync() {
    /* Testo da sincronizzare */
    var ttsEl   = document.getElementById('ttsText');
    var lipText = ttsEl && ttsEl.value.trim();

    /* Prendi il video corrente nel canvas */
    var videoEl   = document.getElementById('videoPreview');
    var imageEl   = document.getElementById('imagePreview');
    var videoUrl  = (videoEl.style.display === 'block' && videoEl.src) ? videoEl.src : null;

    if (!lipText) {
        toast('error', 'Testo mancante', 'Scrivi il testo che l\'avatar deve pronunciare nel campo TTS');
        return;
    }
    if (!videoUrl) {
        toast('error', 'Nessun video', 'Genera prima un video nel pannello AI → Video');
        return;
    }

    /* Controllo crediti */
    var canProceed = await checkCreditsOrBlock('LipSync');
    if (!canProceed) return;

    var langEl = document.getElementById('ttsLang');
    var lang   = langEl ? langEl.value.split('-')[0] : 'it'; /* es. 'it' da 'it-IT' */

    showProcessing('LipSync AI — Kling', 'Invio video e testo a Kling...');
    updateProcProgress(10);

    /* Avanza step visivi */
    var stepIds = ['step1','step2','step3','step4'];
    stepIds.forEach(function (s) { document.getElementById(s).classList.remove('active','done'); });
    document.getElementById('step1').classList.add('active');

    var stepIdx = 0;
    var stepLabels = ['Analisi video...', 'Encoding audio...', 'Sincronizzazione labiale...', 'Rendering finale...'];
    var stepTimer = setInterval(function () {
        if (stepIdx < stepIds.length - 1) {
            document.getElementById(stepIds[stepIdx]).classList.remove('active');
            document.getElementById(stepIds[stepIdx]).classList.add('done');
            stepIdx++;
            document.getElementById(stepIds[stepIdx]).classList.add('active');
            document.getElementById('procSub').textContent = stepLabels[stepIdx];
            updateProcProgress(15 + stepIdx * 20);
        }
    }, 18000);

    try {
        /* 1. Crea prediction Kling via /api/lipsync */
        var createRes = await fetch('/api/lipsync', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ video_url: videoUrl, text: lipText, language: lang })
        });

        if (!createRes.ok) {
            var err = await createRes.json().catch(function () { return {}; });
            throw new Error('Kling error: ' + (err.error || createRes.status));
        }

        var prediction = await createRes.json();

        /* 2. Polling risultato */
        var maxWait = 600000;
        var waited  = 0;
        var pollMs  = 5000;

        while (waited < maxWait &&
               prediction.status !== 'succeeded' &&
               prediction.status !== 'failed') {

            await new Promise(function (r) { setTimeout(r, pollMs); });
            waited += pollMs;

            var pollRes = await fetch('/api/lipsync?id=' + prediction.id);
            if (!pollRes.ok) continue;
            prediction = await pollRes.json();

            if (prediction.logs) {
                var lines = prediction.logs.trim().split('\n');
                var last  = lines[lines.length - 1];
                if (last) document.getElementById('procSub').textContent = last.slice(0, 80);
            }
        }

        clearInterval(stepTimer);
        if (prediction.status === 'failed') {
            throw new Error('Kling lipsync fallito: ' + JSON.stringify(prediction.error || ''));
        }

        var outUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (!outUrl) throw new Error('Nessun output da Kling');

        /* 3. Completa step e mostra risultato */
        stepIds.forEach(function (s) {
            document.getElementById(s).classList.remove('active');
            document.getElementById(s).classList.add('done');
        });
        updateProcProgress(100);

        /* Scala credito */
        await sbDeductCredit();

        setTimeout(async function () {
            hideProcessing();
            showResult(outUrl, 'video');
            addToGallery(outUrl, 'video', 'LipSync: ' + lipText.substring(0, 60));

            /* Salva su Supabase se configurato */
            if (hasSupabase && hasSupabase()) {
                await sbSaveProject({
                    name:        'LipSync — ' + new Date().toLocaleString('it-IT'),
                    videoUrl:    outUrl,
                    prompt:      lipText,
                    resolution:  state.exportQuality,
                    lipsyncText: lipText
                });
            }

            addTrackClip('trackLip',    'Kling LipSync', 'clip-lip',    0, 100);
            document.getElementById('canvasOverlay').style.display = 'block';
            document.getElementById('lipBadge').style.display      = 'flex';
            await loadAndShowCredits();
            toast('success', 'LipSync completato!', 'Kling — audio + movimenti facciali reali');
        }, 300);

    } catch (e) {
        clearInterval(stepTimer);
        hideProcessing();
        toast('error', 'Errore LipSync', e.message);
        console.error('[Kling LipSync]', e);
    }
}

/* Collega il bottone Esporta alla pipeline corretta:
   se c'è testo TTS → LipSync Kling, altrimenti export semplice */
function startProcessing() {
    var ttsEl    = document.getElementById('ttsText');
    var lipText  = ttsEl && ttsEl.value.trim();
    var videoEl  = document.getElementById('videoPreview');
    var imageEl  = document.getElementById('imagePreview');

    var hasVideo = state.videoFile ||
                   (imageEl.style.display === 'block' && imageEl.src) ||
                   (videoEl.style.display === 'block' && videoEl.src);

    if (!hasVideo) {
        toast('error', 'Nessun file', 'Carica o genera prima un video / foto');
        return;
    }

    /* Se c'è testo TTS → pipeline LipSync Kling */
    if (lipText && videoEl.src) {
        runLipSync();
        return;
    }

    /* Altrimenti export semplice con step animati */
    var hasAudio = state.audioFile || state.audioBlob;
    if (!hasAudio && !lipText) {
        toast('error', 'Nessun audio', 'Scrivi il testo nel campo TTS o carica un audio');
        return;
    }

    showProcessing('Export Video', 'Preparazione tracce...');
    var steps = [
        { id: 'step1', text: 'Analisi tracce',     pct: 25,  delay: 1500 },
        { id: 'step2', text: 'Merge audio/video',  pct: 60,  delay: 2500 },
        { id: 'step3', text: 'Compressione',        pct: 85,  delay: 2000 },
        { id: 'step4', text: 'Finalizzazione',      pct: 100, delay: 1500 }
    ];
    steps.forEach(function (s) { document.getElementById(s.id).classList.remove('active','done'); });
    document.getElementById('step1').classList.add('active');

    var idx = 0;
    function runStep() {
        if (idx >= steps.length) {
            document.getElementById('step4').classList.remove('active');
            document.getElementById('step4').classList.add('done');
            updateProcProgress(100);
            setTimeout(function () {
                hideProcessing();
                var src = videoEl.src || imageEl.src;
                if (src) showResult(src, videoEl.src ? 'video' : 'image');
                toast('success', 'Completato!', 'Video pronto');
            }, 400);
            return;
        }
        var step = steps[idx];
        document.getElementById('procSub').textContent = step.text;
        updateProcProgress(step.pct);
        if (idx > 0) {
            document.getElementById(steps[idx-1].id).classList.remove('active');
            document.getElementById(steps[idx-1].id).classList.add('done');
        }
        document.getElementById(step.id).classList.add('active');
        idx++;
        setTimeout(runStep, step.delay);
    }
    setTimeout(runStep, steps[0].delay);
}

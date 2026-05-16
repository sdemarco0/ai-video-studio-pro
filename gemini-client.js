/* ============================================================
   AI Video Studio Pro — gemini-client.js
   Chiama /api/gemini per ottimizzare prompt con Gemini 1.5 Flash.
   Gratuito fino a 15 richieste/minuto (Google AI Studio).
   ============================================================ */

async function optimizePrompt(fieldId) {
    var field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
        toast('error', 'Prompt vuoto', 'Scrivi prima una descrizione da ottimizzare');
        return;
    }

    var originalText = field.value;
    var btn = event.target;
    btn.disabled  = true;
    btn.innerHTML = '⏳ Ottimizzazione...';

    try {
        var type = fieldId.includes('img') || fieldId.includes('scene') || fieldId.includes('avatar')
            ? 'image_prompt'
            : 'optimize_prompt';

        var res = await fetch('/api/gemini', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ prompt: originalText, type: type })
        });

        if (!res.ok) {
            var err = await res.json().catch(function () { return {}; });
            throw new Error(err.error || 'Errore Gemini ' + res.status);
        }

        var data = await res.json();
        if (data.text) {
            field.value = data.text;
            toast('success', 'Prompt ottimizzato!', 'Gemini 1.5 Flash');
        } else {
            throw new Error('Risposta vuota da Gemini');
        }
    } catch (e) {
        field.value = originalText; /* ripristina */
        if (e.message.includes('GEMINI_API_KEY')) {
            toast('error', 'Gemini non configurato', 'Aggiungi GEMINI_API_KEY nelle variabili Vercel');
        } else {
            toast('error', 'Errore Gemini', e.message);
        }
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '✨ Ottimizza con Gemini';
    }
}

/* ============================================================
   PUNTO 4 — Gestione foto/avatar: mostra dove va il file
   Aggiorna il feedback visivo quando si carica un'immagine
   ============================================================ */
function showUploadDestination(filename, destination) {
    toast('info', 'File caricato: ' + filename, 'Usato come: ' + destination);
}

/* Override handleAvatarUpload per mostrare destinazione */
var _originalHandleAvatarUpload = typeof handleAvatarUpload !== 'undefined' ? handleAvatarUpload : null;
function handleAvatarUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    state.currentAvatar = 'custom';

    /* Mostra anteprima nella card avatar */
    var reader = new FileReader();
    reader.onload = function (ev) {
        var uploadCard = document.querySelector('.avatar-upload .avatar-img');
        if (uploadCard) {
            uploadCard.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        }
        /* Salva in state per uso nella generazione */
        state.customAvatarDataUrl = ev.target.result;
    };
    reader.readAsDataURL(file);

    updateStorage(file.size);
    showUploadDestination(file.name, 'Avatar personalizzato per il tuo video');
    toast('success', 'Avatar caricato ✅', file.name + ' → usato come avatar nel video');
}

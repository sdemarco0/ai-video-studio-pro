/* ============================================================
   AI Video Studio Pro — media.js
   File upload, drag-and-drop, video/audio playback, timeline
   ============================================================ */

/* ============================================================
   UPLOAD
   ============================================================ */
function triggerUpload() {
    document.getElementById('fileInput').click();
}

function handleFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    state.videoFile = file;
    var url = URL.createObjectURL(file);

    var uploadZone   = document.getElementById('uploadZone');
    var videoPreview = document.getElementById('videoPreview');
    var imagePreview = document.getElementById('imagePreview');
    uploadZone.style.display = 'none';

    if (file.type.indexOf('video/') === 0) {
        videoPreview.src = url;
        videoPreview.style.display = 'block';
        imagePreview.style.display = 'none';
        videoPreview.onloadedmetadata = function () {
            state.duration = videoPreview.duration;
            updateTimeDisplay();
            addTrackClip('trackVideo', file.name, 'clip-video', 0, 100);
            toast('success', 'Video caricato', file.name + ' (' + formatTime(state.duration) + ')');
        };
    } else {
        imagePreview.src = url;
        imagePreview.style.display = 'block';
        videoPreview.style.display = 'none';
        state.duration = 5;
        updateTimeDisplay();
        addTrackClip('trackVideo', file.name, 'clip-video', 0, 100);
        toast('success', 'Immagine caricata', file.name);
    }
    updateStorage(file.size);
}

/* ---------- Drag & Drop ---------- */
(function initDragDrop() {
    /* Run after DOM is ready */
    document.addEventListener('DOMContentLoaded', function () {
        var canvasWrapper = document.getElementById('canvasWrapper');
        if (!canvasWrapper) return;

        canvasWrapper.addEventListener('dragover', function (e) {
            e.preventDefault();
            document.getElementById('uploadZone').classList.add('dragover');
        });
        canvasWrapper.addEventListener('dragleave', function () {
            document.getElementById('uploadZone').classList.remove('dragover');
        });
        canvasWrapper.addEventListener('drop', function (e) {
            e.preventDefault();
            document.getElementById('uploadZone').classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile({ target: { files: [e.dataTransfer.files[0]] } });
            }
        });
    });
})();

/* ============================================================
   AUDIO UPLOAD
   ============================================================ */
function handleAudio(e) {
    var file = e.target.files[0];
    if (!file) return;
    state.audioFile = file;
    state.audioBlob = file;
    document.getElementById('audioName').textContent   = '✓ ' + file.name;
    document.getElementById('audioName').style.display = 'block';
    document.getElementById('audioDropText').textContent = 'Audio caricato';
    document.getElementById('audioDrop').classList.add('has-file');
    addTrackClip('trackAudio', file.name, 'clip-audio', 0, 100);
    toast('success', 'Audio caricato', file.name);
}

/* ============================================================
   RECORDING
   ============================================================ */
function toggleRec() {
    var btn    = document.getElementById('recBtn');
    var status = document.getElementById('recStatus');

    if (!state.isRecording) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            state.mediaRecorder   = new MediaRecorder(stream);
            state.recordedChunks  = [];

            state.mediaRecorder.ondataavailable = function (e) {
                if (e.data.size > 0) state.recordedChunks.push(e.data);
            };
            state.mediaRecorder.onstop = function () {
                var blob = new Blob(state.recordedChunks, { type: 'audio/webm' });
                state.audioBlob = blob;
                state.audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
                addTrackClip('trackAudio', '🎤 Registrazione', 'clip-audio', 0, 100);
                toast('success', 'Registrazione completata', 'Audio salvato');
                btn.innerHTML          = '🔴 Inizia Registrazione';
                btn.style.background   = '';
                status.textContent     = '';
                state.isRecording      = false;
            };

            state.mediaRecorder.start();
            state.isRecording  = true;
            btn.innerHTML      = '⏹ Ferma Registrazione';
            btn.style.background = 'var(--error)';
            status.textContent = '🔴 In registrazione...';
            toast('info', 'Registrazione', 'Parla nel microfono');
        }).catch(function () {
            toast('error', 'Errore', 'Permesso microfono negato');
        });
    } else {
        state.mediaRecorder.stop();
        state.mediaRecorder.stream.getTracks().forEach(function (t) { t.stop(); });
    }
}

function handleClone(e) {
    var file = e.target.files[0];
    if (!file) return;
    toast('info', 'Voice Clone', 'Sample caricato. Richiede API ElevenLabs.');
}

/* ============================================================
   TTS
   ============================================================ */
function onTTSInput() {
    document.getElementById('ttsBtn').disabled = document.getElementById('ttsText').value.trim().length === 0;
}

function generateTTS() {
    var text = document.getElementById('ttsText').value.trim();
    if (!text) return;
    var btn = document.getElementById('ttsBtn');
    btn.disabled  = true;
    btn.innerHTML = '⏳ Generazione...';

    if (window.speechSynthesis) {
        var utterance  = new SpeechSynthesisUtterance(text);
        utterance.lang = document.getElementById('ttsLang').value;
        utterance.onend = function () {
            addTrackClip('trackAudio', 'TTS: ' + text.substring(0, 20) + '...', 'clip-audio', 0, 100);
            toast('success', 'TTS Generato', 'Voce sintetizzata');
            btn.disabled  = false;
            btn.innerHTML = '🎙️ Genera Voce';
        };
        utterance.onerror = function () {
            toast('error', 'Errore TTS', 'Errore durante la sintesi');
            btn.disabled  = false;
            btn.innerHTML = '🎙️ Genera Voce';
        };
        window.speechSynthesis.speak(utterance);
    } else {
        toast('error', 'Errore', 'TTS non supportato dal browser');
        btn.disabled  = false;
        btn.innerHTML = '🎙️ Genera Voce';
    }
}

/* ============================================================
   VOICE PANEL SWITCHER
   ============================================================ */
/* Map lowercase method names → panel element IDs */
var VOICE_PANEL_IDS = {
    upload: 'grpUpload',
    tts:    'grpTTS',
    record: 'grpRecord',
    clone:  'grpClone'
};

function selVoice(el, method) {
    var cards = document.querySelectorAll('.voice-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('active');
    }
    el.classList.add('active');

    Object.keys(VOICE_PANEL_IDS).forEach(function (key) {
        document.getElementById(VOICE_PANEL_IDS[key]).classList.add('hidden');
    });

    var panelId = VOICE_PANEL_IDS[method];
    if (panelId) document.getElementById(panelId).classList.remove('hidden');
}

function showTTS() {
    selVoice(document.getElementById('vc-tts'), 'tts');
    document.getElementById('rightPanel').scrollTop = document.getElementById('rightPanel').scrollHeight;
}

function showRecord() {
    selVoice(document.getElementById('vc-record'), 'record');
}

/* ============================================================
   TIMELINE
   ============================================================ */
function addTrackClip(trackId, name, className, start, width) {
    var track    = document.getElementById(trackId);
    var existing = track.querySelector('.track-clip');
    if (existing) existing.remove();

    var clip = document.createElement('div');
    clip.className   = 'track-clip ' + className;
    clip.style.left  = start + '%';
    clip.style.width = width + '%';
    clip.textContent = name;
    clip.title       = name;
    track.appendChild(clip);
}

/* ---------- Playback ---------- */
function togglePlay() {
    var video = document.getElementById('videoPreview');
    var btn   = document.getElementById('playBtn');
    if (video.style.display === 'block' && video.src) {
        if (video.paused) {
            video.play();
            btn.textContent  = '⏸';
            state.isPlaying  = true;
        } else {
            video.pause();
            btn.textContent  = '▶';
            state.isPlaying  = false;
        }
    } else {
        toast('info', 'Nessun video', 'Carica un video prima');
    }
}

function skipBack() {
    var v = document.getElementById('videoPreview');
    if (v.src) v.currentTime = Math.max(0, v.currentTime - 5);
}

function skipForward() {
    var v = document.getElementById('videoPreview');
    if (v.src) v.currentTime = Math.min(v.duration, v.currentTime + 5);
}

function onVideoTimeUpdate() {
    var video = document.getElementById('videoPreview');
    state.currentTime = video.currentTime;
    updateTimeDisplay();
    if (video.duration) {
        document.getElementById('tlProgress').style.left = (video.currentTime / video.duration * 100) + '%';
    }
}

function onVideoEnded() {
    document.getElementById('playBtn').textContent = '▶';
    state.isPlaying = false;
}

function updateTimeDisplay() {
    var v = document.getElementById('videoPreview');
    document.getElementById('timeDisplay').textContent =
        formatTime(v.currentTime || 0) + ' / ' + formatTime(state.duration || 0);
}

function formatTime(s) {
    if (!s || isNaN(s)) return '00:00:00';
    var h   = Math.floor(s / 3600);
    var m   = Math.floor((s % 3600) / 60);
    var sec = Math.floor(s % 60);
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
}

function pad(n) { return n.toString().padStart(2, '0'); }

function zoomIn()  { toast('info', 'Zoom', 'In avvicinamento'); }
function zoomOut() { toast('info', 'Zoom', 'In allontanamento'); }

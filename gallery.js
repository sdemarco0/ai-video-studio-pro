/* ============================================================
   AI Video Studio Pro — gallery.js
   Gallery: add, load, filter, use, download, delete items
   ============================================================ */

function addToGallery(url, type, prompt) {
    var item = { id: Date.now(), url: url, type: type, prompt: prompt, date: new Date().toISOString() };
    state.generatedContent.unshift(item);
    updateStorage(1024 * 1024 * 2); // +2 MB estimated
}

function loadGallery() {
    var grid = document.getElementById('galleryGrid');
    if (!grid) return;

    if (state.generatedContent.length === 0) {
        grid.innerHTML =
            '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3);">' +
                '<div style="font-size:48px;margin-bottom:12px;">🎨</div>' +
                '<div style="font-size:16px;font-weight:600;">Nessun contenuto generato</div>' +
                '<div style="font-size:13px;margin-top:4px;">Inizia creando immagini o video con l\'AI</div>' +
            '</div>';
        return;
    }
    grid.innerHTML = buildGalleryHTML(state.generatedContent);
}

function filterGallery(type) {
    var items = state.generatedContent.filter(function (item) {
        return type === 'all' || item.type === type;
    });
    var grid = document.getElementById('galleryGrid');
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3);">Nessun risultato</div>';
        return;
    }
    grid.innerHTML = buildGalleryHTML(items);
}

function buildGalleryHTML(items) {
    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += '<div class="gallery-item">';
        if (item.type === 'video') {
            html += '<video src="' + item.url + '" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>';
        } else {
            html += '<img src="' + item.url + '" loading="lazy">';
        }
        html +=
            '<div class="gallery-overlay">' +
                '<div class="gallery-action" onclick="useGalleryItem(' + item.id + ')" title="Usa">🎬</div>' +
                '<div class="gallery-action" onclick="downloadGalleryItem(' + item.id + ')" title="Scarica">⬇</div>' +
                '<div class="gallery-action" onclick="deleteGalleryItem(' + item.id + ')" title="Elimina">🗑</div>' +
            '</div></div>';
    }
    return html;
}

function _findById(id) {
    for (var i = 0; i < state.generatedContent.length; i++) {
        if (state.generatedContent[i].id === id) return state.generatedContent[i];
    }
    return null;
}

function useGalleryItem(id) {
    var item = _findById(id);
    if (!item) return;
    if (item.type === 'video') {
        document.getElementById('videoPreview').src   = item.url;
        document.getElementById('videoPreview').style.display = 'block';
        document.getElementById('imagePreview').style.display = 'none';
    } else {
        document.getElementById('imagePreview').src   = item.url;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('videoPreview').style.display = 'none';
    }
    document.getElementById('uploadZone').style.display = 'none';
    var createBtn = document.querySelector('.nav-btn');
    switchTab(createBtn, 'create');
    toast('success', 'Aggiunto al progetto', '');
}

function downloadGalleryItem(id) {
    var item = _findById(id);
    if (!item) return;
    var a      = document.createElement('a');
    a.href     = item.url;
    a.download = 'aivideo_' + item.type + '_' + id + '.' + (item.type === 'video' ? 'mp4' : 'png');
    a.click();
}

function deleteGalleryItem(id) {
    state.generatedContent = state.generatedContent.filter(function (item) { return item.id !== id; });
    loadGallery();
    toast('info', 'Eliminato', 'Contenuto rimosso dalla galleria');
}

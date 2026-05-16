/* ============================================================
   AI Video Studio Pro — ui.js
   Toast notifications, Navigation, Projects, Toolbar
   ============================================================ */

/* ============================================================
   TOAST
   ============================================================ */
function toast(type, title, msg) {
    var wrap = document.getElementById('toastWrap');
    var t = document.createElement('div');
    t.className = 'toast';
    var icons = { success: '&#10003;', error: '&#10005;', info: '&#8505;' };
    var cls   = { success: 'toast-ok', error: 'toast-err', info: 'toast-info' };
    t.innerHTML =
        '<div class="toast-icon ' + cls[type] + '">' + icons[type] + '</div>' +
        '<div>' +
            '<div style="font-weight:600;font-size:14px;">' + title + '</div>' +
            '<div style="font-size:13px;color:var(--text-3);">' + msg + '</div>' +
        '</div>';
    wrap.appendChild(t);
    setTimeout(function () {
        t.style.opacity = '0';
        t.style.transform = 'translateX(20px)';
        setTimeout(function () { t.remove(); }, 300);
    }, 4000);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function switchTab(btn, tab) {
    var btns = document.querySelectorAll('.nav-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    btn.classList.add('active');
    state.currentTab = tab;

    document.getElementById('workspaceCreate').classList.toggle('hidden', tab !== 'create');
    document.getElementById('workspaceGallery').classList.toggle('hidden', tab !== 'gallery');

    if (tab === 'templates') showTemplates();
    if (tab === 'library')   toast('info', 'Libreria', 'Sezione in sviluppo');
    if (tab === 'gallery')   loadGallery();
}

/* ============================================================
   PROJECTS
   ============================================================ */
function newProject() {
    var name = prompt('Nome del nuovo progetto:', 'Progetto ' + (state.projects.length + 1));
    if (!name) return;
    var proj = {
        name: name,
        date: 'Oggi, ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        active: true
    };
    for (var i = 0; i < state.projects.length; i++) {
        state.projects[i].active = false;
    }
    state.projects.unshift(proj);
    renderProjects();
    toast('success', 'Progetto creato', name);
}

function renderProjects() {
    var list = document.getElementById('projectList');
    var html = '';
    for (var i = 0; i < state.projects.length; i++) {
        var p = state.projects[i];
        html +=
            '<div class="project-item ' + (p.active ? 'active' : '') + '" onclick="selProject(this,' + i + ')">' +
                '<div class="project-thumb">' + (i === 0 ? '🎬' : '▶') + '</div>' +
                '<div>' +
                    '<div style="font-weight:600;font-size:13px;">' + p.name + '</div>' +
                    '<div style="font-size:11px;color:var(--text-3);">' + p.date + '</div>' +
                '</div>' +
            '</div>';
    }
    list.innerHTML = html;
}

function selProject(el, idx) {
    var items = document.querySelectorAll('.project-item');
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
    el.classList.add('active');
    for (var i = 0; i < state.projects.length; i++) {
        state.projects[i].active = (i === idx);
    }
    toast('info', 'Progetto selezionato', state.projects[idx].name);
}

/* ============================================================
   TOOLBAR
   ============================================================ */
function selTool(btn) {
    var btns = document.querySelectorAll('.tool-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    btn.classList.add('active');
}

function undo() { toast('info', 'Undo', 'Azione annullata'); }
function redo() { toast('info', 'Redo', 'Azione ripristinata'); }

function toggleFullscreen() {
    var wrapper = document.getElementById('canvasWrapper');
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(function () {});
    } else {
        document.exitFullscreen();
    }
}

/* ============================================================
   STORAGE DISPLAY
   ============================================================ */
function updateStorage(bytes) {
    state.storageUsed += bytes / (1024 * 1024 * 1024);
    updateStorageDisplay();
}

function updateStorageDisplay() {
    var used  = state.storageUsed.toFixed(1);
    var total = (state.user && state.user.plan === 'pro') ? 50 : 5;
    var pct   = Math.min((state.storageUsed / total) * 100, 100);
    document.getElementById('storageUsed').textContent  = used;
    document.getElementById('storageTotal').textContent = total;
    document.getElementById('storageBar').style.width   = pct + '%';
}

/* ============================================================
   SLIDER
   ============================================================ */
function updateSlider(slider, valId) {
    document.getElementById(valId).textContent = slider.value + '%';
}

/* ============================================================
   EXPORT
   ============================================================ */
function selExport(el, quality) {
    var opts = document.querySelectorAll('.export-opt');
    for (var i = 0; i < opts.length; i++) {
        opts[i].classList.remove('active');
    }
    el.classList.add('active');
    state.exportQuality = quality;
    toast('info', 'Qualità', 'Esportazione: ' + quality);
}

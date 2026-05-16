/* ============================================================
   AI Video Studio Pro — auth.js
   Login/Register con Supabase (reale) + fallback locale (demo).
   Se Supabase non è configurato in config.js, funziona
   esattamente come prima in modalità demo locale.
   ============================================================ */

/* ---------- Determina se Supabase è disponibile ---------- */
function hasSupabase() {
    var cfg = window.APP_CONFIG;
    return cfg &&
        cfg.supabaseUrl  && !cfg.supabaseUrl.includes('XXXXXXXX') &&
        cfg.supabaseAnon && !cfg.supabaseAnon.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6...');
}

/* ---------- Login Tab Switch ---------- */
function switchLoginTab(el, tab) {
    document.querySelectorAll('.login-tab').forEach(function (t) { t.classList.remove('active'); });
    el.classList.add('active');
    document.getElementById('loginForm').classList.toggle('active',    tab === 'login');
    document.getElementById('registerForm').classList.toggle('active', tab === 'register');
}

/* ---------- Login ---------- */
async function doLogin() {
    var email    = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) { toast('error', 'Errore', 'Inserisci email e password'); return; }

    var btn = document.querySelector('#loginForm .btn-primary');
    btn.disabled  = true;
    btn.innerHTML = '⏳ Accesso...';

    try {
        if (hasSupabase()) {
            /* Auth reale Supabase */
            var user = await sbSignIn(email, password);
            state.user = { name: user.user_metadata?.full_name || email.split('@')[0], email: user.email, id: user.id, plan: 'free' };
        } else {
            /* Fallback demo */
            state.user = { name: email.split('@')[0], email: email, id: 'demo_' + Date.now(), plan: 'free' };
        }
        await showApp();
        toast('success', 'Bentornato!', 'Ciao ' + state.user.name);
    } catch (e) {
        toast('error', 'Login fallito', e.message || 'Credenziali errate');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '🔐 Accedi';
    }
}

/* ---------- Register ---------- */
async function doRegister() {
    var name      = document.getElementById('regName').value.trim();
    var email     = document.getElementById('regEmail').value.trim();
    var password  = document.getElementById('regPassword').value;
    var password2 = document.getElementById('regPassword2').value;

    if (!name || !email || !password) { toast('error', 'Errore', 'Compila tutti i campi'); return; }
    if (password.length < 8)          { toast('error', 'Errore', 'Password minimo 8 caratteri'); return; }
    if (password !== password2)        { toast('error', 'Errore', 'Le password non coincidono'); return; }

    var btn = document.querySelector('#registerForm .btn-primary');
    btn.disabled  = true;
    btn.innerHTML = '⏳ Registrazione...';

    try {
        if (hasSupabase()) {
            var user = await sbSignUp(email, password, name);
            state.user = { name, email, id: user.id, plan: 'free' };
            /* Crea riga crediti per il nuovo utente */
            var sb = getSupabase();
            if (sb) {
                await sb.from('user_credits').insert({
                    user_id: user.id,
                    credits: (window.APP_CONFIG && window.APP_CONFIG.freeCredits) || 3,
                    plan:    'free'
                });
            }
        } else {
            state.user = { name, email, id: 'demo_' + Date.now(), plan: 'free' };
        }
        await showApp();
        toast('success', 'Account creato!', 'Benvenuto ' + name + ' — hai 3 video gratis');
    } catch (e) {
        toast('error', 'Registrazione fallita', e.message);
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '✨ Crea Account';
    }
}

/* ---------- Social Login ---------- */
async function socialLogin(provider) {
    var sb = getSupabase();
    if (!sb) { toast('info', provider, 'Configura Supabase per il login social'); return; }
    var { error } = await sb.auth.signInWithOAuth({
        provider: provider.toLowerCase(),
        options:  { redirectTo: window.location.origin }
    });
    if (error) toast('error', 'Errore login', error.message);
}

/* ---------- Show App ---------- */
async function showApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('mainApp').style.display    = 'flex';

    if (state.user) {
        document.getElementById('userName').textContent   = state.user.name;
        document.getElementById('userAvatar').textContent = state.user.name.charAt(0).toUpperCase();
    }

    renderProjects();
    updateStorageDisplay();

    /* Carica crediti e progetti da Supabase se disponibile */
    if (hasSupabase()) {
        await loadAndShowCredits();
        var projects = await sbGetProjects();
        if (projects.length) {
            state.projects = projects.map(function (p) {
                return { name: p.name, date: new Date(p.created_at).toLocaleDateString('it-IT'), active: false };
            });
            state.projects[0].active = true;
            renderProjects();
        }
    }

    /* Gestisci redirect da Stripe */
    var params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
        toast('success', '🎉 Abbonamento attivato!', 'Benvenuto in Pro — video illimitati');
        window.history.replaceState({}, '', window.location.pathname);
        await loadAndShowCredits();
    }
    if (params.get('payment') === 'cancelled') {
        toast('info', 'Pagamento annullato', 'Sei ancora nel piano Free');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

/* ---------- Logout ---------- */
async function doLogout() {
    if (hasSupabase()) await sbSignOut();
    state.user = null;
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('mainHeader').style.display = 'none';
    document.getElementById('mainApp').style.display    = 'none';
    document.getElementById('userMenu').classList.remove('active');
    toast('info', 'Logout', 'A presto!');
}

/* ---------- User Menu ---------- */
function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('active');
}

/* ---------- Profile Modal ---------- */
async function showProfile() {
    document.getElementById('userMenu').classList.remove('active');
    document.getElementById('profileModal').classList.add('active');
    if (state.user) {
        document.getElementById('profileName').textContent  = state.user.name;
        document.getElementById('profileEmail').textContent = state.user.email;
        document.getElementById('editName').value  = state.user.name;
        document.getElementById('editEmail').value = state.user.email;
    }
    var videos = 0, images = 0;
    state.generatedContent.forEach(function (i) { if (i.type === 'video') videos++; else images++; });
    document.getElementById('statProjects').textContent = state.projects.length;
    document.getElementById('statVideos').textContent   = videos;
    document.getElementById('statImages').textContent   = images;
}

function closeProfileModal() { document.getElementById('profileModal').classList.remove('active'); }

function saveProfile() {
    if (state.user) {
        state.user.name  = document.getElementById('editName').value;
        state.user.email = document.getElementById('editEmail').value;
        document.getElementById('userName').textContent   = state.user.name;
        document.getElementById('userAvatar').textContent = state.user.name.charAt(0).toUpperCase();
    }
    closeProfileModal();
    toast('success', 'Profilo aggiornato', '');
}

/* ---------- Settings / Billing ---------- */
function showSettings() { document.getElementById('userMenu').classList.remove('active'); showApiModal(); }

function showBilling() {
    document.getElementById('userMenu').classList.remove('active');
    document.getElementById('billingModal').classList.add('active');
}
function closeBillingModal() { document.getElementById('billingModal').classList.remove('active'); }

/* ---------- Auto-login se sessione Supabase attiva ---------- */
document.addEventListener('DOMContentLoaded', async function () {
    if (!hasSupabase()) return;
    var user = await sbGetUser();
    if (user) {
        state.user = {
            name:  user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            id:    user.id,
            plan:  'free'
        };
        await showApp();
    }
});

/* ============================================================
   AI Video Studio Pro — auth.js
   ============================================================ */

/* Email dell'amministratore — le Impostazioni API appaiono SOLO a questo utente */
var ADMIN_EMAIL = window.APP_CONFIG && window.APP_CONFIG.adminEmail
    ? window.APP_CONFIG.adminEmail
    : 'sdemarco0@gmail.com'; /* <-- metti qui la tua email */

function hasSupabase() {
    var cfg = window.APP_CONFIG;
    return cfg &&
        cfg.supabaseUrl  && !cfg.supabaseUrl.includes('XXXXXXXX') &&
        cfg.supabaseAnon && !cfg.supabaseAnon.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6...');
}

function isAdmin() {
    return state.user && state.user.email === ADMIN_EMAIL;
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
            var user = await sbSignIn(email, password);
            state.user = {
                name:  user.user_metadata && user.user_metadata.full_name
                    ? user.user_metadata.full_name
                    : email.split('@')[0],
                email: user.email,
                id:    user.id,
                plan:  'free',
                avatar: user.user_metadata && user.user_metadata.avatar_url
                    ? user.user_metadata.avatar_url : null
            };
        } else {
            state.user = { name: email.split('@')[0], email: email, id: 'demo_' + Date.now(), plan: 'free', avatar: null };
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
            state.user = { name, email, id: user.id, plan: 'free', avatar: null };
            var sb = getSupabase();
            if (sb) {
                await sb.from('user_credits').insert({
                    user_id: user.id,
                    credits: (window.APP_CONFIG && window.APP_CONFIG.freeCredits) || 3,
                    plan:    'free'
                });
            }
        } else {
            state.user = { name, email, id: 'demo_' + Date.now(), plan: 'free', avatar: null };
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
    if (!sb) {
        toast('error', 'Configurazione mancante', 'Supabase non configurato — usa email e password');
        return;
    }

    /* Per Google: devi abilitare il provider Google in Supabase
       Dashboard Supabase → Authentication → Providers → Google → Enable */
    var providerKey = provider.toLowerCase();
    try {
        var result = await sb.auth.signInWithOAuth({
            provider: providerKey,
            options: {
                redirectTo: window.location.origin,
                queryParams: providerKey === 'google' ? {
                    access_type: 'offline',
                    prompt: 'consent'
                } : {}
            }
        });
        if (result.error) throw result.error;
        /* Il redirect avviene automaticamente — Supabase reindirizza alla pagina */
    } catch (e) {
        if (e.message && e.message.includes('provider is not enabled')) {
            toast('error', 'Google Login', 'Abilita Google in Supabase → Authentication → Providers');
        } else {
            toast('error', 'Errore login ' + provider, e.message || 'Errore sconosciuto');
        }
    }
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

    /* Mostra voce Impostazioni SOLO all'admin */
    var settingsItem = document.getElementById('menuItemSettings');
    if (settingsItem) {
        settingsItem.style.display = isAdmin() ? 'flex' : 'none';
    }

    renderProjects();
    updateStorageDisplay();

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

        /* Foto profilo */
        var avatarEl = document.getElementById('profileAvatarImg');
        if (avatarEl) {
            if (state.user.avatar) {
                avatarEl.src = state.user.avatar;
                avatarEl.style.display = 'block';
                document.getElementById('profileAvatarPlaceholder').style.display = 'none';
            } else {
                avatarEl.style.display = 'none';
                document.getElementById('profileAvatarPlaceholder').style.display = 'flex';
            }
        }
    }

    var videos = 0, images = 0;
    state.generatedContent.forEach(function (i) { if (i.type === 'video') videos++; else images++; });
    document.getElementById('statProjects').textContent = state.projects.length;
    document.getElementById('statVideos').textContent   = videos;
    document.getElementById('statImages').textContent   = images;

    /* Carica ultime 6 fatture da Stripe via Supabase (stub — mostra placeholder se non configurato) */
    loadInvoices();
}

async function loadInvoices() {
    var list = document.getElementById('invoiceList');
    if (!list) return;

    /* Se Supabase non configurato, mostra messaggio */
    if (!hasSupabase()) {
        list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:12px;">Nessuna fattura disponibile</div>';
        return;
    }

    /* Prova a leggere fatture dalla tabella invoices su Supabase */
    var sb   = getSupabase();
    var user = await sbGetUser();
    if (!sb || !user) {
        list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:12px;">Nessuna fattura disponibile</div>';
        return;
    }

    try {
        var { data } = await sb
            .from('invoices')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6);

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:12px;">Nessuna fattura ancora</div>';
            return;
        }

        list.innerHTML = data.map(function (inv) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">' +
                '<div>' +
                    '<div style="font-size:13px;font-weight:600;">' + new Date(inv.created_at).toLocaleDateString('it-IT') + '</div>' +
                    '<div style="font-size:11px;color:var(--text-3);">€' + (inv.amount / 100).toFixed(2) + ' · ' + inv.plan + '</div>' +
                '</div>' +
                '<a href="' + (inv.invoice_url || '#') + '" target="_blank" ' +
                   'style="font-size:11px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--accent);border-radius:6px;">⬇ Scarica</a>' +
            '</div>';
        }).join('');
    } catch (e) {
        list.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:12px;">Errore caricamento fatture</div>';
    }
}

/* Carica foto profilo dal file */
function handleProfilePhoto(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
        state.user.avatar = ev.target.result;
        var avatarEl = document.getElementById('profileAvatarImg');
        var placeholder = document.getElementById('profileAvatarPlaceholder');
        if (avatarEl) {
            avatarEl.src = ev.target.result;
            avatarEl.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        /* Aggiorna anche l'avatar nella navbar */
        document.getElementById('userAvatar').innerHTML =
            '<img src="' + ev.target.result + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        toast('success', 'Foto aggiornata', '');
    };
    reader.readAsDataURL(file);
}

function closeProfileModal() { document.getElementById('profileModal').classList.remove('active'); }

function saveProfile() {
    if (state.user) {
        state.user.name  = document.getElementById('editName').value;
        state.user.email = document.getElementById('editEmail').value;
        document.getElementById('userName').textContent   = state.user.name;
        if (!state.user.avatar) {
            document.getElementById('userAvatar').textContent = state.user.name.charAt(0).toUpperCase();
        }
    }
    closeProfileModal();
    toast('success', 'Profilo aggiornato', '');
}

/* ---------- Settings — solo admin ---------- */
function showSettings() {
    document.getElementById('userMenu').classList.remove('active');
    if (!isAdmin()) {
        toast('error', 'Accesso negato', 'Solo l\'amministratore può accedere alle impostazioni');
        return;
    }
    showApiModal();
}

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
            name:   user.user_metadata && user.user_metadata.full_name
                ? user.user_metadata.full_name
                : user.email.split('@')[0],
            email:  user.email,
            id:     user.id,
            plan:   'free',
            avatar: user.user_metadata && user.user_metadata.avatar_url
                ? user.user_metadata.avatar_url : null
        };
        await showApp();
    }
});

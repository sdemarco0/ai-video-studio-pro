/* ============================================================
   AI Video Studio Pro — supabase.js
   Client Supabase via CDN (nessun npm).
   SUPABASE_URL e SUPABASE_ANON_KEY vengono iniettati
   dal file config.js che l'utente compila con i propri valori.
   ============================================================ */

/* Queste due variabili vengono sovrascritte da config.js */
var SUPABASE_URL      = window.APP_CONFIG && window.APP_CONFIG.supabaseUrl  || '';
var SUPABASE_ANON_KEY = window.APP_CONFIG && window.APP_CONFIG.supabaseAnon || '';

var _supabase = null;

function getSupabase() {
    if (_supabase) return _supabase;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _supabase;
}

/* ============================================================
   AUTH
   ============================================================ */
async function sbSignUp(email, password, name) {
    var sb = getSupabase();
    if (!sb) throw new Error('Supabase non configurato');
    var { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
    });
    if (error) throw error;
    return data.user;
}

async function sbSignIn(email, password) {
    var sb = getSupabase();
    if (!sb) throw new Error('Supabase non configurato');
    var { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
}

async function sbSignOut() {
    var sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
}

async function sbGetUser() {
    var sb = getSupabase();
    if (!sb) return null;
    var { data } = await sb.auth.getUser();
    return data && data.user ? data.user : null;
}

/* ============================================================
   PROGETTI — salva/leggi/elimina
   ============================================================ */
async function sbSaveProject(project) {
    var sb   = getSupabase();
    if (!sb) return null;
    var user = await sbGetUser();
    if (!user) return null;

    var { data, error } = await sb
        .from('projects')
        .insert({
            user_id:     user.id,
            name:        project.name,
            video_url:   project.videoUrl   || null,
            image_url:   project.imageUrl   || null,
            prompt:      project.prompt     || '',
            resolution:  project.resolution || '720p',
            duration:    project.duration   || 5,
            lipsync_text: project.lipsyncText || null
        })
        .select()
        .single();

    if (error) { console.error('[Supabase] saveProject:', error); return null; }
    return data;
}

async function sbGetProjects() {
    var sb   = getSupabase();
    if (!sb) return [];
    var user = await sbGetUser();
    if (!user) return [];

    var { data, error } = await sb
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) { console.error('[Supabase] getProjects:', error); return []; }
    return data || [];
}

async function sbDeleteProject(id) {
    var sb = getSupabase();
    if (!sb) return;
    await sb.from('projects').delete().eq('id', id);
}

/* ============================================================
   CREDITI — lettura e scalare
   ============================================================ */
async function sbGetCredits() {
    var sb   = getSupabase();
    if (!sb) return null;
    var user = await sbGetUser();
    if (!user) return null;

    var { data } = await sb
        .from('user_credits')
        .select('credits, plan')
        .eq('user_id', user.id)
        .single();

    return data || { credits: 3, plan: 'free' };
}

async function sbDeductCredit() {
    var sb   = getSupabase();
    if (!sb) return true; /* se non configurato, lascia passare */
    var user = await sbGetUser();
    if (!user) return false;

    var { data } = await sb
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single();

    if (!data || data.credits <= 0) return false;

    await sb.from('user_credits')
        .update({ credits: data.credits - 1 })
        .eq('user_id', user.id);

    return true;
}

/* ============================================================
   STORAGE — upload video/immagine su bucket Supabase
   ============================================================ */
async function sbUploadMedia(blob, filename, bucket) {
    var sb   = getSupabase();
    if (!sb) return null;
    var user = await sbGetUser();
    if (!user) return null;

    var path = user.id + '/' + Date.now() + '_' + filename;
    var { error } = await sb.storage.from(bucket).upload(path, blob, {
        contentType: blob.type,
        upsert: false
    });
    if (error) { console.error('[Supabase] uploadMedia:', error); return null; }

    var { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : null;
}

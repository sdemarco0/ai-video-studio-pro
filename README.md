# AI Video Studio Pro — SaaS

Generatore di video AI con LipSync facciale reale, avatar, scene e abbonamenti.
Deploy su Vercel in 5 minuti — zero server da gestire.

---

## Struttura progetto

```
ai-video-studio-pro/
│
├── index.html                  # App completa (SPA)
├── config.js                   # ⚠️ DA COMPILARE — credenziali Supabase + Stripe
├── vercel.json                 # Routing + Edge Functions
├── .env.example                # Template variabili d'ambiente Vercel
├── .gitignore                  # Protegge config.js e .env da GitHub
│
├── api/                        # Edge Functions Vercel (serverless)
│   ├── replicate.js            # Proxy video AI (CogVideoX, LTX-Video)
│   ├── lipsync.js              # Proxy Kling LipSync
│   ├── stripe-checkout.js      # Crea sessione pagamento Stripe
│   └── stripe-webhook.js       # Riceve conferma pagamento → aggiorna DB
│
├── css/
│   └── style.css
│
└── js/
    ├── state.js                # Stato globale
    ├── supabase.js             # Client Supabase (auth, DB, storage)
    ├── stripe.js               # Paywall crediti + checkout
    ├── auth.js                 # Login/register (Supabase reale + fallback demo)
    ├── ui.js                   # Toast, navigazione, toolbar
    ├── media.js                # Upload, TTS, registrazione, timeline
    ├── ai-generation.js        # HF immagini + Replicate video + Kling LipSync
    ├── gallery.js              # Galleria contenuti
    └── api-templates.js        # Gestione chiavi UI + template
```

---

## Pipeline AI (costi per operazione)

| Operazione | Modello | Costo |
|---|---|---|
| Immagine / Avatar / Scena | FLUX.1-schnell (HF) | **Gratis** |
| Video 720p | CogVideoX-2B (Replicate) | **~$0.005** |
| Video 1080p | LTX-Video (Replicate) | **~$0.015** |
| LipSync facciale + voce | Kling Lip-Sync (Replicate) | **~$0.02** |

---

## Deploy su Vercel — Guida passo passo

### Passo 1 — Prepara config.js
Apri `config.js` e inserisci:
- URL e chiave pubblica Supabase (da dashboard.supabase.com)
- Price ID Stripe del piano Pro (da dashboard.stripe.com)

### Passo 2 — Carica su GitHub
1. Vai su github.com → crea account → New repository → "ai-video-studio-pro"
2. Carica tutti i file (incluso `config.js` compilato — il .gitignore lo protegge solo in locale)
3. Clicca "Commit changes"

### Passo 3 — Deploy su Vercel
1. Vai su vercel.com → Sign up with GitHub
2. "Add New Project" → seleziona "ai-video-studio-pro"
3. Clicca Deploy (nessuna configurazione build necessaria)

### Passo 4 — Variabili d'ambiente su Vercel
Settings → Environment Variables — aggiungi queste 5 variabili:

| Nome | Dove trovarlo |
|---|---|
| `REPLICATE_API_TOKEN` | replicate.com/account/api-tokens |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com/webhooks |
| `SUPABASE_URL` | dashboard.supabase.com → Settings → API |
| `SUPABASE_SERVICE_KEY` | dashboard.supabase.com → Settings → API → service_role |

### Passo 5 — Crea il database Supabase
Vai su dashboard.supabase.com → SQL Editor → esegui:

```sql
-- Tabella progetti utente
CREATE TABLE projects (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  video_url    text,
  image_url    text,
  prompt       text,
  resolution   text DEFAULT '720p',
  duration     int  DEFAULT 5,
  lipsync_text text,
  created_at   timestamptz DEFAULT now()
);

-- Tabella crediti utente
CREATE TABLE user_credits (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  credits   int  DEFAULT 3,
  plan      text DEFAULT 'free',
  updated_at timestamptz DEFAULT now()
);

-- Abilita Row Level Security
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Policy: ogni utente vede solo i propri dati
CREATE POLICY "own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own credits" ON user_credits
  FOR ALL USING (auth.uid() = user_id);
```

### Passo 6 — Configura Stripe Webhook
1. dashboard.stripe.com → Developers → Webhooks → "Add endpoint"
2. URL: `https://TUO-PROGETTO.vercel.app/api/stripe-webhook`
3. Seleziona eventi: `checkout.session.completed`, `customer.subscription.deleted`
4. Copia il "Signing secret" → mettilo in Vercel come `STRIPE_WEBHOOK_SECRET`

### Passo 7 — Rideploy
Su Vercel → Deployments → clicca ⋯ → Redeploy

---

## Funzionalità SaaS

- ✅ Auth reale (Supabase) con auto-login al refresh
- ✅ 3 video gratis per i nuovi utenti
- ✅ Paywall automatico al superamento dei crediti
- ✅ Checkout Stripe sicuro (carta non transita per il nostro server)
- ✅ Webhook Stripe → aggiornamento piano automatico
- ✅ Galleria video persistente nel cloud (Supabase)
- ✅ LipSync facciale reale con Kling (audio + movimenti)
- ✅ Chiavi API mai esposte al browser

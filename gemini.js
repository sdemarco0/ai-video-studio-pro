/* ============================================================
   Vercel Serverless Function — /api/gemini
   Proxy sicuro verso Google Gemini API.
   Richiede env: GEMINI_API_KEY
   Usa: gemini-1.5-flash (gratuito fino a 15 RPM)
   ============================================================ */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Metodo non supportato' });

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY non configurata su Vercel' });

    try {
        var { prompt, type } = req.body;
        /* type: 'text' | 'image_prompt' | 'optimize_prompt' */

        var systemInstruction = '';
        if (type === 'optimize_prompt') {
            systemInstruction = 'Sei un esperto di prompt engineering per modelli AI di generazione video. ' +
                'Ottimizza il prompt dell\'utente rendendolo più dettagliato, cinematografico e efficace. ' +
                'Rispondi SOLO con il prompt ottimizzato, senza spiegazioni.';
        } else if (type === 'image_prompt') {
            systemInstruction = 'Sei un esperto di prompt per modelli di generazione immagini (FLUX, Stable Diffusion). ' +
                'Trasforma la descrizione dell\'utente in un prompt ottimizzato in inglese. ' +
                'Rispondi SOLO con il prompt in inglese, senza spiegazioni.';
        } else {
            systemInstruction = 'Sei un assistente utile e professionale. Rispondi in italiano.';
        }

        var body = {
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature:     0.7,
                maxOutputTokens: 1024,
                topP:            0.9
            }
        };

        var geminiRes = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
            {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body)
            }
        );

        if (!geminiRes.ok) {
            var errData = await geminiRes.json();
            throw new Error(errData.error ? errData.error.message : 'Gemini error ' + geminiRes.status);
        }

        var data = await geminiRes.json();
        var text = data.candidates &&
                   data.candidates[0] &&
                   data.candidates[0].content &&
                   data.candidates[0].content.parts &&
                   data.candidates[0].content.parts[0]
            ? data.candidates[0].content.parts[0].text
            : '';

        return res.status(200).json({ text });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

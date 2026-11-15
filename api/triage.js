// POST /api/triage  { photoUrl }
// 1. Google Lens (via SerpApi) -> top visual match titles
// 2. Gemini looks at the photo + those titles -> triage JSON
// Keys stay on the server. If Lens fails, Gemini answers alone.

import { loadLocalEnv } from './_env.js';

loadLocalEnv();

export const config = { maxDuration: 60 };

const ANIMAL_TYPES = ['bird', 'small_mammal', 'rabies_vector', 'deer', 'reptile', 'amphibian', 'other'];
const AGES = ['baby', 'juvenile', 'adult', 'unknown'];
const VERDICTS = ['leave_it', 'watch', 'needs_help'];
const URGENCIES = ['low', 'medium', 'high'];
const CAUSES = ['vehicle', 'cat_or_dog', 'fell_from_nest', 'window_strike', 'entanglement', 'fire', 'weather', 'unknown'];
const MIN_CONFIDENCE = 0.6;

const PROMPT = (titles) => `You are helping a member of the public who found a wild animal in Central Texas.
${titles.length
    ? `A reverse image search returned these page titles (evidence, may be wrong):\n${titles.map((t) => `- ${t}`).join('\n')}`
    : 'No reverse image search results are available.'}

Confirm the species from the image itself, then judge whether the animal needs help.
Be conservative: many young animals that look abandoned are fine (feathered fledglings on
the ground, fawns lying still, baby rabbits in a nest). Only say needs_help when you see a
real sign: visible injury, bleeding, a hit by a car, caught by a cat or dog, flies or
maggots, an unfeathered or eyes-closed baby out of the nest, or an adult that cannot move away.

Answer with ONLY a JSON object, no markdown, with exactly these keys:
{
  "is_wild_animal": boolean,          // false if the photo is not a wild animal
  "species": string,                  // common name, or "Unknown"
  "animal_type": ${ANIMAL_TYPES.map((t) => `"${t}"`).join(' | ')},
  "confidence": number,               // 0 to 1, your confidence in species AND verdict
  "age_stage": "baby" | "juvenile" | "adult" | "unknown",
  "verdict": "leave_it" | "watch" | "needs_help",
  "urgency": "low" | "medium" | "high",
  "cause": ${CAUSES.map((c) => `"${c}"`).join(' | ')},
                                      // most likely cause of harm; "vehicle" only if the scene shows a road or roadside
                                      // or injuries typical of being hit; otherwise "unknown"
  "reasons": string[],                // what you see in the photo, 1 to 3 short items
  "do_now": string[],                 // safe steps for the finder, 2 to 4 short items
  "do_not": string[],                 // 2 to 4 short items
  "handling_warning": string,         // empty string if none
  "facts": string[]                   // REQUIRED whenever you can name the species: at least 3 and at most 5
                                      // interesting, well-established facts about it for a curious member of the
                                      // public. Go for the memorable: an unusual ability or habit, what it eats,
                                      // how to recognise it, its role in nature. One sentence each. Only return
                                      // an empty list if the species is unknown.
}

Rules:
- animal_type "rabies_vector" means bats, raccoons, skunks, foxes, coyotes. For these the
  handling_warning must say never to touch with bare hands.
- For needs_help, do_now should include: put it in a box with air holes, keep it dark and
  quiet, and give no food or water.
- Never include phone numbers, organization names, addresses or links. The app supplies those.
- Only state facts you are sure of. Leave out anything you would have to guess, and give no numbers you are unsure of.
- When you are unsure of the species or the verdict, lower the confidence number.`;

async function lensTitles(photoUrl) {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { titles: [], error: 'SERPAPI_KEY not set' };
  const params = new URLSearchParams({
    engine: 'google_lens',
    url: photoUrl,
    type: 'visual_matches',
    country: 'us',
    api_key: key,
  });
  try {
    const r = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json();
    if (data.error) return { titles: [], error: data.error };
    const titles = (data.visual_matches || [])
      .map((m) => m.title)
      .filter(Boolean)
      .slice(0, 5);
    return { titles, error: null };
  } catch (e) {
    return { titles: [], error: String(e.message || e) };
  }
}

async function askGemini(imageBase64, mimeType, titles) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: PROMPT(titles) },
            ],
          },
        ],
        // No temperature/top_p: current Gemini models reject the old sampling params.
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(40000),
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini HTTP ${r.status}`);
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('');
  if (!text) throw new Error('Gemini returned no text');
  return parseJson(text);
}

export function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const clean = (s) => String(s ?? '').replace(PHONE, '[call a licensed rehabber]').trim();
const list = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean).slice(0, 5) : []);
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

// Never trust the model's shape: clamp every field to what the UI expects.
export function normalize(raw) {
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const out = {
    is_wild_animal: raw.is_wild_animal !== false,
    species: clean(raw.species) || 'Unknown',
    animal_type: oneOf(raw.animal_type, ANIMAL_TYPES, 'other'),
    confidence,
    age_stage: oneOf(raw.age_stage, AGES, 'unknown'),
    verdict: oneOf(raw.verdict, VERDICTS, 'watch'),
    urgency: oneOf(raw.urgency, URGENCIES, 'medium'),
    cause: oneOf(raw.cause, CAUSES, 'unknown'),
    reasons: list(raw.reasons),
    do_now: list(raw.do_now),
    do_not: list(raw.do_not),
    handling_warning: clean(raw.handling_warning),
    facts: list(raw.facts),
  };
  out.low_confidence = confidence < MIN_CONFIDENCE || !out.is_wild_animal;
  if (out.animal_type === 'rabies_vector' && !out.handling_warning) {
    out.handling_warning =
      'Never touch bats, raccoons, skunks, foxes or coyotes with bare hands. If anyone was bitten or scratched, call a doctor.';
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const photoUrl = req.body?.photoUrl;
  const base = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const allowedPrefix = `${base}/storage/v1/object/public/photos/`;
  // Only fetch images from our own bucket, so this endpoint can't be pointed at other servers.
  if (!base || typeof photoUrl !== 'string' || !photoUrl.startsWith(allowedPrefix)) {
    return res.status(400).json({ error: 'photoUrl must be a photo in this app\'s bucket' });
  }

  try {
    const [lens, img] = await Promise.all([
      lensTitles(photoUrl),
      fetch(photoUrl, { signal: AbortSignal.timeout(15000) }),
    ]);
    if (!img.ok) return res.status(400).json({ error: 'Could not read the photo' });
    const mimeType = (img.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const imageBase64 = Buffer.from(await img.arrayBuffer()).toString('base64');

    const raw = await askGemini(imageBase64, mimeType, lens.titles);
    const triage = normalize(raw);

    return res.status(200).json({
      triage,
      lens: { titles: lens.titles, error: lens.error },
      identified_with: lens.titles.length ? 'Google Lens + AI' : 'AI only',
    });
  } catch (e) {
    console.error('triage failed', e);
    return res.status(502).json({ error: 'Triage failed. Try again or call a rehabber.', detail: String(e.message || e) });
  }
}

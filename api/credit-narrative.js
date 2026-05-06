/* ── Vercel serverless function — AI Credit Narrative Generator ──────────────
   POST /api/credit-narrative
   Receives a property assessment result and returns a Claude-generated
   credit committee narrative paragraph. Server-side only — API key never
   exposed to browser.
*/

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = 'anthropic/claude-haiku-4-5';

function buildPrompt(data) {
  const {
    address, propertyType, subtype, areaSqft,
    mv_low, mv_high, dv_low, dv_high,
    rpi, ttl_low, ttl_high,
    confidence, ltvBand, verdict,
    circleRatePerSqft, zoneConfidence,
    ageBand, occupancy, legalStatus,
    flags = [], drivers = [],
    collateralHealthScore,
  } = data;

  const fmt = v => v >= 10000000
    ? `₹${(v / 10000000).toFixed(2)} Cr`
    : `₹${(v / 100000).toFixed(1)} L`;

  const topDrivers = drivers.slice(0, 4).map(d =>
    `${d.label} (${d.dir >= 0 ? '+' : ''}${d.impact}%)`).join(', ');

  const flagSummary = flags.length > 0
    ? flags.map(f => `[${f.severity.toUpperCase()}] ${f.text}`).join('\n')
    : 'No significant flags detected.';

  const confPct = Math.round((confidence || 0) * 100);

  return `You are a senior credit analyst at a leading Indian NBFC writing a collateral assessment memo for the credit committee.

PROPERTY DATA:
- Address: ${address || 'Not provided'}
- Type: ${propertyType} / ${subtype}
- Area: ${areaSqft?.toLocaleString('en-IN')} sqft
- Market Value Range: ${fmt(mv_low)} – ${fmt(mv_high)}
- Distress Sale Value: ${fmt(dv_low)} – ${fmt(dv_high)}
- Circle Rate: ₹${circleRatePerSqft?.toLocaleString('en-IN')}/sqft (${zoneConfidence} zone confidence)
- Resale Potential Index: ${rpi}/100
- Time to Liquidate: ${ttl_low}–${ttl_high} days
- Confidence Score: ${confPct}% (${confPct >= 68 ? 'adequate' : confPct >= 52 ? 'moderate' : 'low'})
- Recommended LTV Band: ${ltvBand}
- Verdict: ${verdict}
- Collateral Health Score: ${collateralHealthScore}/820
- Asset Age Band: ${ageBand || 'not specified'}
- Occupancy: ${occupancy || 'not specified'}
- Legal Status: ${legalStatus || 'not specified'}
- Key Value Drivers: ${topDrivers}
- Risk Flags:
${flagSummary}

Write a SINGLE concise paragraph (4–6 sentences) for the credit committee file. Requirements:
1. Open with the property type, location, and market value range.
2. Mention the key value driver (location premium or discount).
3. Comment on ONE significant legal or structural risk if present.
4. State the RPI and what it means for exit certainty.
5. Close with the LTV recommendation and any condition.
Use plain professional English. No bullet points. No subheadings. Do not use the word "collateral" more than once. Do not repeat the address verbatim. Avoid phrases like "based on the above" or "in summary".`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI narrative service not configured',
      fallback: true,
    });
  }

  const assessmentData = req.body || {};

  try {
    const response = await fetch(OPENROUTER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://collatiq.vercel.app',
        'X-Title': 'Collatiq Credit Narrative',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: buildPrompt(assessmentData),
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[credit-narrative] OpenRouter error:', err);
      return res.status(502).json({ error: 'AI service returned an error', fallback: true });
    }

    const json  = await response.json();
    const text  = json.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI', fallback: true });
    }

    return res.status(200).json({ narrative: text, model: MODEL });

  } catch (err) {
    console.error('[credit-narrative] exception:', err);
    return res.status(500).json({ error: 'Internal error', fallback: true });
  }
}

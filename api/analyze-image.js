/* Vercel serverless function — proxies image analysis to OpenRouter.
   The API key is read from process.env.OPENROUTER_API_KEY (server-side only).
   It is never exposed to the browser bundle. */

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = 'anthropic/claude-haiku-4-5';

const PROMPT = `You are a property analyst. Examine this property photograph and extract observable signals relevant to collateral valuation for an Indian NBFC.

Return a JSON object with these fields (only include fields you can confidently observe):
{
  "constructionQuality": "premium" | "good" | "average" | "poor",
  "maintenanceCondition": "well-maintained" | "average" | "needs-repair" | "dilapidated",
  "propertyType": "apartment" | "villa" | "independent-house" | "commercial" | "plot" | "unknown",
  "visibleAmenities": ["list of amenities visible, e.g. parking, garden, security booth"],
  "redFlags": ["list of visible concerns, e.g. water damage, structural cracks, encroachment"],
  "positiveSignals": ["list of positive signals, e.g. modern facade, gated community, landscaping"],
  "confidenceAdjustment": number between -0.15 and +0.10,
  "summary": "one sentence summary of key observation"
}

Be conservative. Only report what is clearly visible. Do not invent signals. Respond with only the JSON object.`;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Image analysis service not configured' });
    }

    const { imageBase64, mediaType } = req.body || {};

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    // ~10 MB limit: base64 is ~4/3 the binary size
    if (typeof imageBase64 !== 'string' || imageBase64.length > 13631488) {
      return res.status(413).json({ error: 'Image too large' });
    }

    const dataUrl = `data:${mediaType};base64,${imageBase64}`;

    const body = {
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    };

    const upstream = await fetch(OPENROUTER_API, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer':  'https://collatiq.vercel.app',
        'X-Title':       'Collatiq',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[analyze-image] upstream error:', upstream.status, errText);
      return res.status(502).json({ error: 'Analysis service error', message: errText });
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Analysis service error', message: 'Invalid response format' });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return res.status(200).json(analysis);

  } catch (err) {
    console.error('[analyze-image] unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

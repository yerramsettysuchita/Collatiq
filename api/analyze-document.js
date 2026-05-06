/* ── Vercel serverless function — Document OCR via Claude Vision ──────────────
   POST /api/analyze-document
   Accepts a property document image (title deed, EC, tax receipt, building
   plan, or khata) and returns structured extracted fields.
   API key is server-side only — never exposed to the browser.
*/

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = 'anthropic/claude-haiku-4-5';

const PROMPTS = {
  titleDeed: `You are a senior property lawyer in India reading a sale deed or title deed document image for an NBFC collateral assessment.

Extract the following fields as a JSON object. Only include fields you can clearly read. Do not guess or invent values.

{
  "documentType": "sale_deed" | "gift_deed" | "partition_deed" | "power_of_attorney" | "unknown",
  "ownerName": "full name of the registered owner or buyer",
  "propertyAddress": "property address as written in the document",
  "surveyOrPlotNumber": "survey number, plot number, or khata number if visible",
  "registrationDate": "date of registration in DD-MM-YYYY or as written",
  "saleConsideration": number or null (amount paid, in rupees),
  "registrationOffice": "name of sub-registrar office",
  "encumbrancesOrCharges": "any encumbrances, liabilities, or charges mentioned — exact text",
  "encumbranceMentioned": true or false,
  "stampDutyPaid": true or false or null,
  "isClearTitle": true or false (your assessment based on the document),
  "documentStatus": "verified" | "unclear" | "not_a_title_deed",
  "extractionConfidence": number between 0 and 1,
  "flags": ["list any anomalies, inconsistencies, or concerns you notice"]
}

Be conservative. Only report what is clearly legible. Respond with only the JSON object.`,

  ec: `You are a senior property lawyer in India reading an Encumbrance Certificate (EC) issued by the Sub-Registrar's office.

Extract the following fields as a JSON object. Only include fields you can clearly read.

{
  "documentType": "encumbrance_certificate" | "not_an_ec",
  "propertyReference": "property description or reference number from the EC",
  "periodFrom": "start date of EC search period",
  "periodTo": "end date of EC search period",
  "issuingOffice": "sub-registrar office name",
  "encumbrances": [
    {
      "type": "mortgage" | "charge" | "sale" | "partition" | "other",
      "party": "name of party",
      "date": "date of transaction",
      "amount": number or null,
      "details": "brief description"
    }
  ],
  "isClear": true or false (true = no encumbrances in the period),
  "totalEncumbrances": number,
  "documentStatus": "verified" | "unclear" | "not_an_ec",
  "extractionConfidence": number between 0 and 1,
  "flags": ["list any concerns — e.g. recent mortgage, disputed entry, short search period"]
}

Respond with only the JSON object.`,

  taxReceipt: `You are reading an Indian property tax receipt or khata extract issued by a municipal corporation.

Extract the following fields as a JSON object. Only include fields you can clearly read.

{
  "documentType": "property_tax_receipt" | "khata_extract" | "not_a_tax_receipt",
  "propertyId": "property ID or assessment number",
  "ownerName": "owner name on the receipt",
  "propertyAddress": "property address on the receipt",
  "periodCovered": "tax period e.g. 2023-24",
  "amountPaid": number or null (in rupees),
  "paymentDate": "date of payment",
  "pendingDues": number or null (any dues shown as pending),
  "issuingAuthority": "municipal corporation or authority name",
  "taxPaidUpToDate": true or false,
  "documentStatus": "verified" | "unclear" | "not_a_tax_receipt",
  "extractionConfidence": number between 0 and 1,
  "flags": ["any concerns — overdue amounts, name mismatch, very old receipt"]
}

Respond with only the JSON object.`,

  buildingPlan: `You are reading an approved building plan sanction letter or building plan approval document from an Indian local authority.

Extract the following fields as a JSON object. Only include fields you can clearly read.

{
  "documentType": "building_plan_approval" | "commencement_certificate" | "occupancy_certificate" | "not_a_building_plan",
  "approvedArea": number or null (total approved built-up area in square feet or square metres — note unit),
  "approvedAreaUnit": "sqft" | "sqm" | null,
  "numberOfFloors": number or null,
  "groundCoverage": number or null (percentage),
  "usageType": "residential" | "commercial" | "mixed" | "industrial" | null,
  "approvalAuthority": "name of the approving authority (BBMP/BDA/GHMC/CMDA etc.)",
  "approvalDate": "date of approval",
  "applicationNumber": "plan approval number or application reference",
  "setbacks": "setback details if mentioned",
  "conditionsOrViolations": "any conditions or violations noted on the document",
  "isApproved": true or false,
  "documentStatus": "verified" | "unclear" | "not_a_building_plan",
  "extractionConfidence": number between 0 and 1,
  "flags": ["any concerns — unapproved deviations, conditions not met, very old approval"]
}

Respond with only the JSON object.`,

  khata: `You are reading a Khata Certificate or Khata Extract issued by BBMP, BDA, or a municipal panchayat in Karnataka or another Indian state.

Extract the following fields as a JSON object. Only include fields you can clearly read.

{
  "documentType": "khata_certificate" | "khata_extract" | "patta" | "not_a_khata",
  "khataNumber": "khata number",
  "khataType": "A" | "B" | "unknown",
  "ownerName": "owner name on the khata",
  "propertyAddress": "property address",
  "siteArea": number or null (area of the site in square feet or square metres — note unit),
  "siteAreaUnit": "sqft" | "sqm" | null,
  "ward": "ward name or number",
  "issuingAuthority": "BBMP / BDA / Gram Panchayat / other",
  "issueDate": "date of issue",
  "isBKhata": true or false,
  "hasLayoutApproval": true or false or null,
  "documentStatus": "verified" | "unclear" | "not_a_khata",
  "extractionConfidence": number between 0 and 1,
  "flags": ["any concerns — B-khata, unapproved layout, panchayat khata in urban area"]
}

Respond with only the JSON object.`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Document analysis service not configured', fallback: true });
  }

  const { documentBase64, mediaType, documentType } = req.body || {};

  if (!documentBase64 || !mediaType || !documentType) {
    return res.status(400).json({ error: 'Missing required fields: documentBase64, mediaType, documentType' });
  }

  const prompt = PROMPTS[documentType];
  if (!prompt) {
    return res.status(400).json({ error: `Unknown documentType: ${documentType}. Must be one of: ${Object.keys(PROMPTS).join(', ')}` });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mediaType)) {
    return res.status(400).json({ error: `Unsupported media type: ${mediaType}` });
  }

  // ~12 MB limit
  if (typeof documentBase64 !== 'string' || documentBase64.length > 16777216) {
    return res.status(413).json({ error: 'Document image too large — maximum 12 MB' });
  }

  try {
    const dataUrl  = `data:${mediaType};base64,${documentBase64}`;
    const response = await fetch(OPENROUTER_API, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer':  'https://collatiq.vercel.app',
        'X-Title':       'Collatiq Document OCR',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 800,
        temperature: 0.1, // low temperature for factual extraction
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text',      text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[analyze-document] upstream error:', response.status, errText);
      return res.status(502).json({ error: 'Document analysis service error', fallback: true });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Could not parse document analysis response', fallback: true });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ documentType, extracted, model: MODEL });

  } catch (err) {
    console.error('[analyze-document] error:', err.message);
    return res.status(500).json({ error: 'Internal error', fallback: true });
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzePropertyImage(file) {
  try {
    const imageBase64 = await fileToBase64(file);
    const mediaType   = file.type || 'image/jpeg';

    const res = await fetch('/api/analyze-image', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64, mediaType }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[imageEngine] proxy error:', res.status, err);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error('[imageEngine] fetch error:', e);
    return null;
  }
}

/* ── DOCUMENT OCR ──────────────────────────────────────────────────────────
   Sends a document image to Claude Vision and extracts structured fields.
   documentType: 'titleDeed' | 'ec' | 'taxReceipt' | 'buildingPlan' | 'khata'
*/
export async function analyzeDocument(file, documentType) {
  try {
    const documentBase64 = await fileToBase64(file);
    const mediaType      = file.type || 'image/jpeg';

    const res = await fetch('/api/analyze-document', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ documentBase64, mediaType, documentType }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[imageEngine] document analysis error:', res.status, err);
      return null;
    }

    const data = await res.json();
    return data.fallback ? null : data;
  } catch (e) {
    console.error('[imageEngine] analyzeDocument error:', e);
    return null;
  }
}

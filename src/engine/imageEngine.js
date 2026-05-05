function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:<mediaType>;base64,<b64>" — strip the prefix
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mediaType }),
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

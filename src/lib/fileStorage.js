/* ── FILE STORAGE (IndexedDB) ───────────────────────────────────────────────
   Persists property images and document blobs linked to assessment IDs.
   IndexedDB quota: 250 MB+ (browser-managed, far beyond localStorage's 5 MB).
   Files survive page refresh, tab close, and browser restart.
   Schema version: 1
*/

const DB_NAME = 'collatiq_files_v1';
const STORE   = 'files';
const VERSION = 1;

/* ── Open / init the database ────────────────────────────────────────────── */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB not available')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by_assessment', 'assessmentId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ── Generate a compressed JPEG thumbnail from an image File ─────────────── */
function generateThumbnail(file, maxDim = 220) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) { resolve(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio   = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas  = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ── Save all images + documents for a completed assessment ──────────────── */
export async function saveFilesForAssessment(assessmentId, imageFiles = [], documents = {}) {
  if (!assessmentId) return false;
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    // ── Images ──
    for (let i = 0; i < imageFiles.length; i++) {
      const img = imageFiles[i];
      if (!img?.file) continue;
      const thumbnail = await generateThumbnail(img.file);
      store.put({
        id:           `${assessmentId}_img_${i}`,
        assessmentId,
        category:     'image',
        docKey:       'photo',
        index:        i,
        blob:         img.file,
        name:         img.file.name || `photo_${i + 1}.jpg`,
        mimeType:     img.file.type,
        thumbnail,
        analysis:     img.analysis  || null,
        size:         img.file.size,
        timestamp:    Date.now(),
      });
    }

    // ── Documents ──
    for (const [docKey, files] of Object.entries(documents)) {
      if (!Array.isArray(files)) continue;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!(f instanceof File)) continue;
        store.put({
          id:           `${assessmentId}_doc_${docKey}_${i}`,
          assessmentId,
          category:     'document',
          docKey,
          index:        i,
          blob:         f,
          name:         f.name,
          mimeType:     f.type,
          thumbnail:    null,
          analysis:     null,
          size:         f.size,
          timestamp:    Date.now(),
        });
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror    = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[fileStorage] save error:', err.message);
    return false;
  }
}

/* ── Load all images + documents for an assessment ───────────────────────── */
export async function loadFilesForAssessment(assessmentId) {
  const empty = { images: [], documents: {} };
  if (!assessmentId) return empty;
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readonly');
    const idx   = tx.objectStore(STORE).index('by_assessment');

    const records = await new Promise((resolve, reject) => {
      const req = idx.getAll(assessmentId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
    db.close();

    // Rebuild imageFiles state array
    const images = records
      .filter(r => r.category === 'image')
      .sort((a, b) => a.index - b.index)
      .map(r => ({
        id:       r.id,
        file:     r.blob,
        // Thumbnail base64 is always displayable; fall back to blob URL
        preview:  r.thumbnail || URL.createObjectURL(r.blob),
        analysis: r.analysis,
        loading:  false,
        _fromStorage: true,
      }));

    // Rebuild documents state object {key: File[]}
    const docRecords = records.filter(r => r.category === 'document');
    const documents  = {};
    for (const r of docRecords) {
      if (!documents[r.docKey]) documents[r.docKey] = [];
      documents[r.docKey][r.index] = new File([r.blob], r.name, { type: r.mimeType });
    }
    for (const key of Object.keys(documents)) {
      documents[key] = documents[key].filter(Boolean); // remove sparse holes
    }

    return { images, documents };
  } catch (err) {
    console.warn('[fileStorage] load error:', err.message);
    return empty;
  }
}

/* ── Delete all files linked to one assessment ───────────────────────────── */
export async function deleteFilesForAssessment(assessmentId) {
  if (!assessmentId) return;
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const idx   = store.index('by_assessment');

    const keys = await new Promise((resolve, reject) => {
      const req = idx.getAllKeys(assessmentId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
    for (const key of keys) store.delete(key);

    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror    = () => { db.close(); resolve(); };
    });
  } catch {}
}

/* ── Wipe everything (used with clearAllAssessments) ────────────────────── */
export async function clearAllFiles() {
  try {
    const db  = await openDB();
    const tx  = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror    = () => { db.close(); resolve(); };
    });
  } catch {}
}

/* ── Storage usage estimate ──────────────────────────────────────────────── */
export async function getStorageStats() {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);

    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
    db.close();

    const totalBytes = all.reduce((s, r) => s + (r.size || 0), 0);
    return {
      fileCount:  all.length,
      totalBytes,
      totalMB:    (totalBytes / (1024 * 1024)).toFixed(1),
      images:     all.filter(r => r.category === 'image').length,
      documents:  all.filter(r => r.category === 'document').length,
    };
  } catch {
    return { fileCount: 0, totalBytes: 0, totalMB: '0.0', images: 0, documents: 0 };
  }
}

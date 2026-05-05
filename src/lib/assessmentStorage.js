/* ── ASSESSMENT STORAGE SERVICE ────────────────────────────────────────────
   Persists the last 10 collateral assessments to localStorage.
   Works entirely anonymously — no auth required.
   Schema version: 1
*/

import { deleteFilesForAssessment, clearAllFiles } from './fileStorage';

const KEY = 'collatiq_assessments_v1';
const MAX = 10;

/* ── Schema migration ────────────────────────────────────────────────────── */

export function validateSavedAssessment(entry) {
  return !!(entry && typeof entry === 'object' && entry.id && entry.timestamp);
}

export function migrateSavedAssessmentSchema(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    id:                    entry.id,
    timestamp:             entry.timestamp              || new Date().toISOString(),
    address:               entry.address                || '',
    city:                  entry.city                   || '',
    propertyType:          entry.propertyType           || '',
    subtype:               entry.subtype                || '',
    areaSqft:              entry.areaSqft               ?? 0,
    age:                   entry.age                    || '',
    legal:                 entry.legal                  || '',
    mv_low:                entry.mv_low                 ?? null,
    mv_high:               entry.mv_high                ?? null,
    dv_low:                entry.dv_low                 ?? null,
    dv_high:               entry.dv_high                ?? null,
    rpi:                   entry.rpi                    ?? null,
    ttl_low:               entry.ttl_low                ?? null,
    ttl_high:              entry.ttl_high               ?? null,
    confidenceScore:       entry.confidenceScore        ?? null,
    confidenceTier:        entry.confidenceTier         ?? null,
    collateralHealthScore: entry.collateralHealthScore  ?? null,
    verdict:               entry.verdict                || '',
    ltvBand:               entry.ltvBand                || '',
    verdictCode:           entry.verdictCode            || '',
    topFlags:              Array.isArray(entry.topFlags) ? entry.topFlags : [],
    inputs:                entry.inputs                 || {},
    notes:                 entry.notes                  || '',
    // v13 extended fields (default for older assessments)
    yearOfConstruction:    entry.yearOfConstruction      || '',
    constructionType:      entry.constructionType        || '',
    facing:                entry.facing                  || '',
    ocStatus:              entry.ocStatus                || '',
    ecStatus:              entry.ecStatus                || '',
    planApproval:          entry.planApproval            || '',
    existingLoan:          entry.existingLoan            || '',
    amenities:             Array.isArray(entry.amenities) ? entry.amenities : [],
    // v14 extended fields
    khataType:             entry.khataType               || '',
    bhkConfig:             entry.bhkConfig               || '',
    propertyCondition:     entry.propertyCondition       || '',
    roadWidth:             entry.roadWidth               || '',
    litigation:            entry.litigation              || '',
    // v14 file counts
    imageCount:            entry.imageCount              ?? 0,
    docCount:              entry.docCount                ?? 0,
    // full result snapshot for "View full report"
    fullResult:            entry.fullResult              || null,
  };
}

/* ── Safe reader ─────────────────────────────────────────────────────────── */

export function safeLoadAssessments() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validateSavedAssessment)
      .map(migrateSavedAssessmentSchema)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Save a completed assessment result.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 */
export function saveAssessment(results, formInputs) {
  try {
    const entry = {
      id:                  results.valuationId || `col_${Date.now()}`,
      timestamp:           results.timestamp   || new Date().toISOString(),
      // Location
      address:             results.address     || formInputs?.address || '',
      city:                extractCity(results.address || formInputs?.address || ''),
      // Property
      propertyType:        results.propertyType || formInputs?.type    || '',
      subtype:             results.subtype      || formInputs?.subtype || '',
      areaSqft:            results.areaSqft     || parseFloat(formInputs?.area) || 0,
      age:                 formInputs?.age      || '',
      legal:               formInputs?.legal    || '',
      // Key output metrics
      mv_low:              results.mv_low,
      mv_high:             results.mv_high,
      dv_low:              results.dv_low,
      dv_high:             results.dv_high,
      rpi:                 results.rpi,
      ttl_low:             results.ttl_low,
      ttl_high:            results.ttl_high,
      confidenceScore:     results.confidenceScore,
      confidenceTier:      results.confidenceTier,
      collateralHealthScore: results.collateralHealthScore,
      // Decision
      verdict:             results.verdictLabel  || results.verdict || '',
      ltvBand:             results.ltvBand       || results.ltv_band || '',
      verdictCode:         results.verdictCode   || '',
      // Top flags (max 3, serialised lightly)
      topFlags:            (results.fraudFlags || []).slice(0, 3).map(f => ({
        text:     f.text     || f.reason || '',
        severity: f.severity || 'info',
      })),
      // Inputs snapshot for re-run
      inputs:              formInputs || {},
      // Notes (user-editable, added later)
      notes:               '',
      // File counts (stored here so cards can show badges without reading IndexedDB)
      imageCount: (formInputs?._imageFiles || []).length,
      docCount:   Object.values(formInputs?.documents || {})
                    .reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0),
      // Full result snapshot so "View full report" shows complete data
      fullResult: results,
    };

    const existing = readAll();
    const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

    // Find an existing record for the same property (same address + type + area)
    const dupeIdx = existing.findIndex(e =>
      norm(e.address) === norm(entry.address) &&
      (e.propertyType || '') === (entry.propertyType || '') &&
      (e.areaSqft     || 0)  === (entry.areaSqft     || 0)
    );

    let updated;
    if (dupeIdx !== -1) {
      // Update in place — keep original ID and any user notes
      const kept = existing[dupeIdx];
      const merged = { ...entry, id: kept.id, notes: kept.notes || '' };
      updated = [merged, ...existing.filter((_, i) => i !== dupeIdx)];
    } else {
      updated = [entry, ...existing.filter(e => e.id !== entry.id)];
    }

    const ok = writeAll(updated);
    return { ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Return all saved assessments, newest first, schema-migrated. */
export function getAllAssessments() {
  return safeLoadAssessments();
}

/** Reset file counts on an entry after files are cleared. */
export function updateFileCounts(id, imageCount, docCount) {
  const items   = readAll();
  const updated = items.map(e => e.id === id ? { ...e, imageCount, docCount } : e);
  writeAll(updated);
}

/** Delete one entry by id — also removes its files from IndexedDB. */
export function deleteAssessment(id) {
  const updated = readAll().filter(e => e.id !== id);
  writeAll(updated);
  deleteFilesForAssessment(id).catch(() => {}); // fire-and-forget
}

/** Clear everything — wipes both localStorage and IndexedDB files. */
export function clearAllAssessments() {
  try { localStorage.removeItem(KEY); } catch {}
  clearAllFiles().catch(() => {}); // fire-and-forget
}

/** Update notes on a saved entry. */
export function updateNotes(id, notes) {
  const items   = readAll();
  const updated = items.map(e => e.id === id ? { ...e, notes } : e);
  writeAll(updated);
}

/** Extract a short city label from a full address string. */
function extractCity(address) {
  if (!address) return '';
  const lower = address.toLowerCase();
  const cities = [
    ['bengaluru', 'Bengaluru'], ['bangalore', 'Bengaluru'],
    ['mumbai', 'Mumbai'],       ['bombay', 'Mumbai'],
    ['hyderabad', 'Hyderabad'],
    ['chennai', 'Chennai'],     ['madras', 'Chennai'],
    ['pune', 'Pune'],
    ['delhi', 'Delhi'],         ['new delhi', 'Delhi'],
    ['gurgaon', 'Gurgaon'],     ['gurugram', 'Gurgaon'],
    ['noida', 'Noida'],
    ['kolkata', 'Kolkata'],
    ['ahmedabad', 'Ahmedabad'],
  ];
  for (const [key, label] of cities) {
    if (lower.includes(key)) return label;
  }
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 2] || parts[parts.length - 1] || '';
}

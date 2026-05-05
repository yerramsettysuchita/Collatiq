import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAllAssessments, deleteAssessment, clearAllAssessments,
  updateNotes, updateFileCounts,
} from '../lib/assessmentStorage';
import { deleteFilesForAssessment, getStorageStats } from '../lib/fileStorage';
import './RecentAssessments.css';

/* ── Formatting helpers ──────────────────────────────────────────────────── */
function fmt(val) {
  if (!val && val !== 0) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function verdictClass(code) {
  if (!code) return '';
  const lc = (code || '').toLowerCase();
  if (lc.includes('sanction'))    return 'verdict--green';
  if (lc.includes('conditional')) return 'verdict--amber';
  return 'verdict--red';
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState({ onAssess }) {
  return (
    <div className="ra-empty">
      <div className="ra-empty-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="14" width="32" height="26" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M16 8h16M20 8v6M28 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M16 24h16M16 30h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h3 className="ra-empty-title">No recent assessments</h3>
      <p className="ra-empty-sub">
        Your collateral assessments will appear here. Run an assessment to get started.
      </p>
      <button className="ra-assess-btn" onClick={onAssess}>
        Assess a property
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Assessment card ─────────────────────────────────────────────────────── */
function AssessmentCard({ entry, onViewResult, onRerun, onDelete, onFilesCleared, compareMode, selected, onToggleCompare }) {
  const [editingNotes,   setEditingNotes]   = useState(false);
  const [notesValue,     setNotesValue]     = useState(entry.notes || '');
  const [expanded,       setExpanded]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [clearingFiles,  setClearingFiles]  = useState(false);
  const [localImgCount,  setLocalImgCount]  = useState(entry.imageCount ?? 0);
  const [localDocCount,  setLocalDocCount]  = useState(entry.docCount   ?? 0);

  const hasFiles = localImgCount > 0 || localDocCount > 0;

  const saveNotes = () => {
    updateNotes(entry.id, notesValue);
    setEditingNotes(false);
  };

  const handleClearFiles = async () => {
    setClearingFiles(true);
    await deleteFilesForAssessment(entry.id).catch(() => {});
    updateFileCounts(entry.id, 0, 0);
    setLocalImgCount(0);
    setLocalDocCount(0);
    setClearingFiles(false);
    onFilesCleared?.();
  };

  const vclass = verdictClass(entry.verdictCode || entry.verdict);

  const handleHeaderClick = () => {
    if (compareMode) {
      onToggleCompare(entry.id);
    } else {
      setExpanded(e => !e);
      setConfirmDelete(false);
    }
  };

  return (
    <motion.div
      className={`ra-card${compareMode && selected ? ' ra-card--selected' : ''}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="ra-card-header" onClick={handleHeaderClick}>
        <div className="ra-card-left">
          <div className="ra-address">{entry.address || 'Unknown address'}</div>
          <div className="ra-meta">
            {entry.city && <span className="ra-city">{entry.city}</span>}
            {entry.propertyType && (
              <span className="ra-type">
                {entry.propertyType}{entry.subtype ? ` · ${entry.subtype}` : ''}
              </span>
            )}
            {entry.areaSqft > 0 && (
              <span className="ra-area">{entry.areaSqft.toLocaleString('en-IN')} sq ft</span>
            )}
          </div>
          {/* Metric chips — always visible */}
          <div className="ra-chips">
            {entry.rpi != null && (
              <span className="ra-chip">RPI {entry.rpi}</span>
            )}
            {entry.ttl_low != null && (
              <span className="ra-chip">TTL {entry.ttl_low}–{entry.ttl_high}d</span>
            )}
            {entry.confidenceScore != null && (
              <span className="ra-chip">Conf {entry.confidenceScore}%</span>
            )}
            {entry.collateralHealthScore != null && (
              <span className="ra-chip">Health {entry.collateralHealthScore}</span>
            )}
            {/* File storage badges */}
            {localImgCount > 0 && (
              <span className="ra-chip ra-chip--file" title={`${localImgCount} photo${localImgCount !== 1 ? 's' : ''} stored`}>
                📷 {localImgCount}
              </span>
            )}
            {localDocCount > 0 && (
              <span className="ra-chip ra-chip--file" title={`${localDocCount} document${localDocCount !== 1 ? 's' : ''} stored`}>
                📄 {localDocCount}
              </span>
            )}
          </div>
        </div>

        <div className="ra-card-right">
          {compareMode ? (
            <div className={`ra-compare-check${selected ? ' ra-compare-check--on' : ''}`}>
              {selected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ) : null}
          <span className={`ra-verdict ${vclass}`}>{entry.verdict || '—'}</span>
          <span className="ra-date">{fmtDate(entry.timestamp)}</span>
          {!compareMode && (
            <svg className={`ra-chevron ${expanded ? 'open' : ''}`}
              width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>

      {/* Expanded body — only in normal mode */}
      <AnimatePresence>
        {!compareMode && expanded && (
          <motion.div
            className="ra-card-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Key metrics grid */}
            <div className="ra-metrics">
              <div className="ra-metric">
                <div className="ra-metric-label">Market value</div>
                <div className="ra-metric-val">{fmt(entry.mv_low)} – {fmt(entry.mv_high)}</div>
              </div>
              <div className="ra-metric">
                <div className="ra-metric-label">Distress value</div>
                <div className="ra-metric-val">{fmt(entry.dv_low)} – {fmt(entry.dv_high)}</div>
              </div>
              <div className="ra-metric">
                <div className="ra-metric-label">RPI</div>
                <div className="ra-metric-val">{entry.rpi ?? '—'} / 100</div>
              </div>
              <div className="ra-metric">
                <div className="ra-metric-label">Time to liquidate</div>
                <div className="ra-metric-val">{entry.ttl_low ?? '—'} – {entry.ttl_high ?? '—'} days</div>
              </div>
              <div className="ra-metric">
                <div className="ra-metric-label">Confidence</div>
                <div className="ra-metric-val">
                  {entry.confidenceScore != null ? `${entry.confidenceScore}%` : '—'}
                </div>
              </div>
              <div className="ra-metric">
                <div className="ra-metric-label">LTV band</div>
                <div className="ra-metric-val">{entry.ltvBand || '—'}</div>
              </div>
            </div>

            {/* Top flags */}
            {entry.topFlags?.length > 0 && (
              <div className="ra-flags">
                {entry.topFlags.map((f, i) => (
                  <span key={i} className={`ra-flag ra-flag--${f.severity}`}>
                    {f.severity === 'critical' ? '⛔' : f.severity === 'warning' ? '⚠' : 'ℹ'} {f.text}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="ra-notes-section">
              {editingNotes ? (
                <div className="ra-notes-edit">
                  <textarea
                    className="ra-notes-input"
                    value={notesValue}
                    onChange={e => setNotesValue(e.target.value)}
                    placeholder="Add your notes here…"
                    rows={2}
                    autoFocus
                  />
                  <div className="ra-notes-actions">
                    <button className="ra-notes-save" onClick={saveNotes}>Save note</button>
                    <button className="ra-notes-cancel" onClick={() => {
                      setEditingNotes(false);
                      setNotesValue(entry.notes || '');
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="ra-notes-trigger" onClick={() => setEditingNotes(true)}>
                  {notesValue ? `📝 ${notesValue}` : '+ Add note'}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="ra-actions">
              <button className="ra-btn ra-btn--primary" onClick={() => onViewResult(entry)}>
                View full report
              </button>
              <button className="ra-btn ra-btn--ghost" onClick={() => onRerun(entry)}>
                Re-run with edits
              </button>

              {/* Clear files only — keeps scores, wipes photos + docs */}
              {hasFiles && !confirmDelete && (
                <button
                  className="ra-btn ra-btn--clear-files"
                  onClick={handleClearFiles}
                  disabled={clearingFiles}
                  title="Remove stored photos and documents. Assessment scores are kept."
                >
                  {clearingFiles ? 'Clearing…' : `🗑 Clear files (📷${localImgCount} 📄${localDocCount})`}
                </button>
              )}

              {/* Delete with confirmation step */}
              {!confirmDelete ? (
                <button className="ra-btn ra-btn--danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              ) : (
                <div className="ra-delete-confirm">
                  <span className="ra-delete-confirm-text">
                    {hasFiles
                      ? `Deletes scores + ${localImgCount} photo${localImgCount!==1?'s':''} + ${localDocCount} doc${localDocCount!==1?'s':''}. Cannot undo.`
                      : 'Delete this assessment? Cannot undo.'}
                  </span>
                  <button className="ra-btn ra-btn--danger" onClick={() => onDelete(entry.id)}>
                    Yes, delete
                  </button>
                  <button className="ra-btn ra-btn--ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function RecentAssessments({ onBack, onAssess, onViewResult, onRerun, onCompare }) {
  const [entries,           setEntries]          = useState([]);
  const [cleared,           setCleared]          = useState(false);
  const [compareMode,       setCompareMode]      = useState(false);
  const [selectedIds,       setSelectedIds]      = useState([]);
  const [searchQuery,       setSearchQuery]      = useState('');
  const [storageStats,      setStorageStats]     = useState(null);

  useEffect(() => {
    setEntries(getAllAssessments());
    getStorageStats().then(setStorageStats).catch(() => {});
  }, []);

  /* ── Filter ── */
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(e =>
      (e.city || '').toLowerCase().includes(q) ||
      (e.propertyType || '').toLowerCase().includes(q) ||
      (e.subtype || '').toLowerCase().includes(q) ||
      (e.address || '').toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  /* ── Handlers ── */
  const handleDelete = (id) => {
    deleteAssessment(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    getStorageStats().then(setStorageStats).catch(() => {});
  };

  const handleFilesCleared = () => {
    getStorageStats().then(setStorageStats).catch(() => {});
  };

  const handleClearAll = () => {
    clearAllAssessments();
    setEntries([]);
    setSelectedIds([]);
    setCleared(true);
    setStorageStats(null);
  };

  const toggleCompareMode = () => {
    setCompareMode(m => !m);
    setSelectedIds([]);
  };

  const handleToggleCompare = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(sid => sid !== id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, id];
    });
  };

  const handleCompareSelected = () => {
    const selected = selectedIds
      .map(id => entries.find(e => e.id === id))
      .filter(Boolean);
    if (selected.length === 2 && onCompare) {
      onCompare(selected);
    }
  };

  const canCompare = entries.length >= 2;

  return (
    <div className="ra-screen">
      {/* Topbar */}
      <div className="ra-topbar">
        <button className="ra-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div className="ra-topbar-center">
          <span className="ra-topbar-title">Recent assessments</span>
          {entries.length > 0 && (
            <span className="ra-topbar-count">{entries.length} saved on this device</span>
          )}
        </div>
        <div className="ra-topbar-actions">
          {canCompare && (
            <button
              className={`ra-compare-btn${compareMode ? ' ra-compare-btn--active' : ''}`}
              onClick={toggleCompareMode}
            >
              {compareMode ? 'Cancel' : 'Compare'}
            </button>
          )}
          {storageStats && storageStats.fileCount > 0 && (
            <span className="ra-storage-badge" title={`${storageStats.images} photos · ${storageStats.documents} docs`}>
              💾 {storageStats.totalMB} MB
            </span>
          )}
          {entries.length > 0 && !compareMode && (
            <button className="ra-clear-btn" onClick={handleClearAll}>Clear all</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {entries.length > 2 && !compareMode && (
        <div className="ra-search-wrap">
          <svg className="ra-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            className="ra-search-input"
            type="text"
            placeholder="Filter by city, type or address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="ra-search-clear" onClick={() => setSearchQuery('')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.3"
                  strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Compare mode hint */}
      <AnimatePresence>
        {compareMode && (
          <motion.div
            className="ra-compare-hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {selectedIds.length < 2
              ? `Select ${2 - selectedIds.length} more assessment${selectedIds.length === 1 ? '' : 's'} to compare`
              : '2 assessments selected — ready to compare'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="ra-body">
        {cleared || entries.length === 0 ? (
          <EmptyState onAssess={onAssess} />
        ) : filtered.length === 0 ? (
          <div className="ra-no-results">
            No assessments match <strong>{searchQuery}</strong>.
            <button className="ra-no-results-clear" onClick={() => setSearchQuery('')}>
              Clear filter
            </button>
          </div>
        ) : (
          <div className="ra-list">
            <AnimatePresence mode="popLayout">
              {filtered.map(entry => (
                <AssessmentCard
                  key={entry.id}
                  entry={entry}
                  onViewResult={onViewResult}
                  onRerun={onRerun}
                  onDelete={handleDelete}
                  onFilesCleared={handleFilesCleared}
                  compareMode={compareMode}
                  selected={selectedIds.includes(entry.id)}
                  onToggleCompare={handleToggleCompare}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="ra-footer-note">
        Assessment scores are stored in localStorage. Photos and documents are stored in IndexedDB (browser storage, this device only).
        Use <strong>Clear files</strong> on a card to free space while keeping scores, or <strong>Delete</strong> to remove everything for that assessment.
      </div>

      {/* Compare action bar */}
      <AnimatePresence>
        {compareMode && selectedIds.length === 2 && (
          <motion.div
            className="ra-compare-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
            exit={{ y: 80, opacity: 0, transition: { duration: 0.2 } }}
          >
            <span className="ra-compare-bar-label">2 assessments selected</span>
            <button className="ra-compare-bar-btn" onClick={handleCompareSelected}>
              Compare side-by-side
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

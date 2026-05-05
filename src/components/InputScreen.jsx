import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './InputScreen.css';
import AddressAutocomplete from './AddressAutocomplete';
import { getCircleRateForLocation } from '../engine/geoEngine';
import { analyzePropertyImage } from '../engine/imageEngine';
import { useFormValidation } from '../hooks/useFormValidation';
import { loadFilesForAssessment } from '../lib/fileStorage';

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════ */
const SCORE_WEIGHTS = [
  { label: 'Location',       pct: 25 },
  { label: 'Legal clarity',  pct: 20 },
  { label: 'Configuration',  pct: 15 },
  { label: 'Market demand',  pct: 15 },
  { label: 'Construction',   pct: 10 },
  { label: 'Asset age',      pct: 10 },
  { label: 'Documentation',  pct: 5  },
];

const OUTPUT_SIGNALS = [
  { key: 'mv',      label: 'Market value range' },
  { key: 'dv',      label: 'Distress sale value' },
  { key: 'rpi',     label: 'Resale potential index' },
  { key: 'ttl',     label: 'Time to liquidate' },
  { key: 'conf',    label: 'Confidence score' },
  { key: 'verdict', label: 'Verdict and recommended LTV' },
];

const TYPE_OPTIONS = [
  { id: 'residential', label: 'Residential', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12L12 3l9 9v9H3v-9z" strokeLinejoin="round"/>
      <path d="M9 21v-6h6v6"/>
    </svg>
  )},
  { id: 'commercial', label: 'Commercial', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="1"/>
      <path d="M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" strokeLinejoin="round"/>
      <path d="M8 12h8M8 16h5"/>
    </svg>
  )},
  { id: 'industrial', label: 'Industrial', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="10" width="20" height="11" rx="1"/>
      <path d="M2 10l6-7h8l6 7"/><path d="M9 21v-5h6v5"/>
    </svg>
  )},
];

const SUBTYPES = {
  residential: ['Apartment', 'Villa', 'Plot', 'Row House', 'Duplex', 'Independent House', 'Penthouse', 'Studio', 'Builder Floor'],
  commercial:  ['Shop', 'Office', 'Showroom', 'Warehouse', 'Mall Space', 'Co-working Space'],
  industrial:  ['Factory', 'Warehouse', 'Industrial Land', 'Shed', 'Industrial Plot'],
};

const BHK_OPTIONS = [
  { id: 'studio', label: 'Studio' },
  { id: '1bhk',   label: '1 BHK' },
  { id: '2bhk',   label: '2 BHK' },
  { id: '3bhk',   label: '3 BHK' },
  { id: '4bhk',   label: '4 BHK' },
  { id: '4plus',  label: '4+ BHK' },
];

const RES_BHK_SUBTYPES = new Set(['apartment', 'villa', 'row_house', 'duplex', 'independent_house', 'penthouse', 'builder_floor']);

const CONSTRUCTION_TYPES = [
  { id: 'rcc_frame',    label: 'RCC Frame',    sub: 'Concrete column-beam' },
  { id: 'load_bearing', label: 'Load Bearing', sub: 'Brick/masonry walls' },
  { id: 'steel',        label: 'Steel Frame',  sub: 'Structural steel' },
  { id: 'prefab',       label: 'Prefab',       sub: 'Factory-built' },
];

const CONDITION_OPTIONS = [
  { id: 'excellent', label: 'Excellent', sub: '+10%' },
  { id: 'good',      label: 'Good',      sub: 'Baseline' },
  { id: 'fair',      label: 'Fair',      sub: '−12%' },
  { id: 'poor',      label: 'Poor',      sub: '−25%' },
];

const FACING_OPTIONS = [
  'North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West',
];

const ROAD_WIDTH_OPTIONS = [
  { id: 'lt_20',   label: 'Under 20 ft',  sub: '−12%' },
  { id: '20_40',   label: '20–40 ft',     sub: 'Baseline' },
  { id: '40_60',   label: '40–60 ft',     sub: '+12%' },
  { id: 'gt_60',   label: 'Above 60 ft',  sub: '+22%' },
];

const OCCUPANCY_OPTIONS = [
  { id: 'self',   label: 'Self-occupied' },
  { id: 'rented', label: 'Rented' },
  { id: 'vacant', label: 'Vacant' },
];

const OWNERSHIP_OPTIONS = [
  { id: 'freehold',  label: 'Freehold' },
  { id: 'leasehold', label: 'Leasehold' },
  { id: 'strata',    label: 'Strata Title' },
];

const KHATA_OPTIONS = [
  { id: 'a_khata',  label: 'A-Khata',         sub: 'Approved layout' },
  { id: 'b_khata',  label: 'B-Khata',         sub: '−28% penalty' },
  { id: 'no_khata', label: 'No Khata',         sub: '−40% penalty' },
  { id: 'na',       label: 'Not Applicable',   sub: 'Other states' },
];

const OC_OPTIONS   = [
  { id: 'present', label: 'OC Available' },
  { id: 'absent',  label: 'No OC',       warn: true },
  { id: 'na',      label: 'N/A' },
];
const EC_OPTIONS   = [
  { id: 'clear',        label: 'EC Clear (13 yrs)' },
  { id: 'charges',      label: 'Has Charges',      warn: true },
  { id: 'not_obtained', label: 'Not Obtained',     warn: true },
];
const PLAN_OPTIONS = [
  { id: 'approved',     label: 'Plan Approved' },
  { id: 'not_approved', label: 'Not Approved',  warn: true },
  { id: 'unknown',      label: 'Unknown' },
];
const TAX_OPTIONS  = [
  { id: 'paid',    label: 'Paid Up-to-date' },
  { id: 'pending', label: 'Dues Pending',    warn: true },
  { id: 'na',      label: 'N/A' },
];
const RERA_OPTIONS = [
  { id: 'registered',     label: 'RERA Registered' },
  { id: 'not_registered', label: 'Not Registered' },
  { id: 'na',             label: 'N/A' },
];
const LOAN_OPTIONS = [
  { id: 'no',      label: 'No existing loan' },
  { id: 'yes',     label: 'Has existing loan', warn: true },
  { id: 'unknown', label: 'Unknown' },
];
const LITIGATION_OPTIONS = [
  { id: 'none',       label: 'No litigation' },
  { id: 'active',     label: 'Active litigation',  warn: true },
  { id: 'injunction', label: 'Court injunction',   warn: true },
  { id: 'unknown',    label: 'Unknown' },
];

const AMENITY_OPTIONS = [
  'Car Parking', 'Lift / Elevator', '24hr Security', 'Power Backup',
  'Generator', 'Gymnasium', 'Swimming Pool', 'Club House',
  'CCTV Surveillance', 'Intercom', 'Rain Water Harvesting', 'Piped Gas',
];

const DOC_DEFS = [
  { key: 'titleDeed',    label: 'Title Deed / Sale Deed',   critical: true  },
  { key: 'ec',           label: 'Encumbrance Certificate',  critical: true  },
  { key: 'taxReceipt',   label: 'Property Tax Receipt',     critical: true  },
  { key: 'buildingPlan', label: 'Approved Building Plan',   critical: false },
  { key: 'khata',        label: 'Khata / Property Card',    critical: false },
];

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════ */
function SectionLabel({ label }) {
  return (
    <div className="form-section-label">
      <span className="form-section-text">{label}</span>
      <div className="form-section-rule" />
    </div>
  );
}

function fmtEditDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function estimateConfidence(form, imageFiles) {
  let c = 45;
  if (form.address?.length > 10)              c += 10;
  if (form.lat && form.lng)                   c += 7;
  if (parseFloat(form.area) > 0)              c += 7;
  if (form.yearOfConstruction)                c += 4;
  if (form.occupancy)                         c += 4;
  if (form.constructionType)                  c += 3;
  if (form.propertyCondition)                 c += 3;
  if (form.facing)                            c += 2;
  if (form.bhkConfig)                         c += 2;
  if (form.ownershipType)                     c += 3;
  if (form.khataType === 'a_khata')           c += 6;
  if (form.khataType === 'b_khata')           c -= 8;
  if (form.khataType === 'no_khata')          c -= 12;
  if (form.ocStatus === 'present')            c += 6;
  if (form.ocStatus === 'absent')             c -= 4;
  if (form.ecStatus === 'clear')              c += 7;
  if (form.ecStatus === 'charges')            c -= 10;
  if (form.planApproval === 'approved')       c += 4;
  if (form.planApproval === 'not_approved')   c -= 6;
  if (form.existingLoan === 'no')             c += 2;
  if (form.existingLoan === 'yes')            c -= 4;
  if (form.litigation === 'none')             c += 3;
  if (form.litigation === 'active')           c -= 15;
  if (form.litigation === 'injunction')       c -= 20;
  if ((form.amenities || []).length > 2)      c += 2;

  const totalDocs = Object.values(form.documents || {}).reduce((s, a) => s + (a || []).length, 0);
  c += Math.min(10, totalDocs * 2);

  const imgArr = imageFiles || [];
  c += Math.min(5, imgArr.length * 1.2);
  const analyses = imgArr.filter(i => i.analysis);
  if (analyses.length > 0) {
    const avg = analyses.reduce((s, i) => s + (i.analysis.confidenceAdjustment || 0), 0) / analyses.length;
    c += avg > 0 ? 4 : avg < 0 ? -3 : 0;
  }
  return Math.min(97, Math.max(20, Math.round(c)));
}

function countInputs(form) {
  return [
    form.type, form.subtype, form.area, form.floor,
    form.yearOfConstruction || form.age,
    form.occupancy, form.constructionType, form.propertyCondition,
    form.facing, form.ownershipType, form.khataType,
    form.ocStatus, form.ecStatus, form.planApproval,
    form.existingLoan, form.litigation,
    form.bhkConfig, form.roadWidth,
  ].filter(Boolean).length;
}

/* ══════════════════════════════════════════════════════════════════════════
   CROSS-FIELD VALIDATION
══════════════════════════════════════════════════════════════════════════ */
function getCrossValidationErrors(form) {
  const errs = [];
  if (form.carpetArea && form.area && parseFloat(form.carpetArea) > parseFloat(form.area))
    errs.push('Carpet area cannot exceed built-up area.');
  if (form.floor && form.totalFloors && parseInt(form.floor) > parseInt(form.totalFloors))
    errs.push('Floor number cannot exceed total floors in the building.');
  const yr = parseInt(form.yearOfConstruction);
  if (yr && yr > new Date().getFullYear())
    errs.push('Year of construction cannot be in the future.');
  return errs;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function InputScreen({ onSubmit, onBack, prefill, onDiscardEdit }) {
  const editingFrom = prefill?._editingFrom || null;

  const [form, setForm] = useState({
    address:            prefill?.address            || '',
    type:               prefill?.type               || '',
    subtype:            prefill?.subtype             || '',
    bhkConfig:          prefill?.bhkConfig           || '',
    area:               prefill?.area               || '',
    carpetArea:         prefill?.carpetArea          || '',
    floor:              prefill?.floor              || '',
    totalFloors:        prefill?.totalFloors         || '',
    yearOfConstruction: prefill?.yearOfConstruction  || '',
    constructionType:   prefill?.constructionType    || '',
    propertyCondition:  prefill?.propertyCondition   || '',
    facing:             prefill?.facing             || '',
    cornerProperty:     prefill?.cornerProperty      || false,
    roadWidth:          prefill?.roadWidth           || '',
    age:                prefill?.age                || '',
    occupancy:          prefill?.occupancy          || '',
    rentalIncome:       prefill?.rentalIncome        || '',
    legal:              prefill?.legal              || '',
    ownershipType:      prefill?.ownershipType       || '',
    khataType:          prefill?.khataType           || '',
    ocStatus:           prefill?.ocStatus           || '',
    ecStatus:           prefill?.ecStatus           || '',
    taxStatus:          prefill?.taxStatus          || '',
    planApproval:       prefill?.planApproval        || '',
    reraStatus:         prefill?.reraStatus          || '',
    existingLoan:       prefill?.existingLoan        || '',
    litigation:         prefill?.litigation          || '',
    amenities:          prefill?.amenities           || [],
    documents: {
      titleDeed:    [], ec: [], taxReceipt: [], buildingPlan: [], khata: [],
    },
    lat:  prefill?.lat  ?? null,
    lng:  prefill?.lng  ?? null,
  });

  const [imageFiles,    setImageFiles]    = useState([]);  // [{id,file,preview,analysis,loading}]
  const [carouselIdx,   setCarouselIdx]   = useState(null);
  const [liveConf,      setLiveConf]      = useState(45);
  const [addressError,  setAddressError]  = useState(false);
  const [formError,     setFormError]     = useState('');
  const [geoData,       setGeoData]       = useState(null);
  const { errors: valErrors, validate, clearField } = useFormValidation();
  const errorBannerRef = useRef(null);
  const imgInputRef    = useRef(null);
  const tileRefs       = useRef([]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── handlers ── */
  const handleTypeSelect = (id) => {
    set('type', id);
    set('subtype', '');
    set('bhkConfig', '');
    set('cornerProperty', false);
    set('roadWidth', '');
  };

  const handleTileKeyDown = useCallback((e, idx) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % TYPE_OPTIONS.length;
      tileRefs.current[next]?.focus();
      handleTypeSelect(TYPE_OPTIONS[next].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + TYPE_OPTIONS.length) % TYPE_OPTIONS.length;
      tileRefs.current[prev]?.focus();
      handleTypeSelect(TYPE_OPTIONS[prev].id);
    }
  }, []); // eslint-disable-line

  const handleAddressSelect = ({ address, lat, lng }) => {
    setForm(f => ({ ...f, address, lat, lng }));
    setAddressError(false);
    setGeoData(getCircleRateForLocation(lat, lng));
  };

  const handleAddressChange = (val) => {
    set('address', val);
    setAddressError(false);
    clearField('address');
    if (geoData) { setGeoData(null); setForm(f => ({ ...f, lat: null, lng: null })); }
  };

  const toggleAmenity = (item) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(item)
        ? f.amenities.filter(a => a !== item)
        : [...f.amenities, item],
    }));
  };

  /* ── multi-image ── */
  const handleImageAdd = async (files) => {
    const slots = 6 - imageFiles.length;
    if (slots <= 0) return;
    const toAdd = Array.from(files).slice(0, slots);
    const newEntries = toAdd.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      analysis: null,
      loading: true,
    }));
    setImageFiles(prev => [...prev, ...newEntries]);
    newEntries.forEach(async entry => {
      try {
        const analysis = await analyzePropertyImage(entry.file);
        setImageFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, analysis, loading: false } : f
        ));
      } catch {
        setImageFiles(prev => prev.map(f =>
          f.id === entry.id ? { ...f, loading: false } : f
        ));
      }
    });
  };

  const removeImageAt = (idx) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    if (carouselIdx === idx)         setCarouselIdx(null);
    else if (carouselIdx > idx)      setCarouselIdx(c => c - 1);
  };

  /* ── multi-doc ── */
  const handleDocAdd = (docKey, files) => {
    const newFiles = Array.from(files);
    setForm(f => ({
      ...f,
      documents: {
        ...f.documents,
        [docKey]: [...(f.documents[docKey] || []), ...newFiles],
      },
    }));
  };

  const removeDocFile = (docKey, fileIdx) => {
    setForm(f => ({
      ...f,
      documents: {
        ...f.documents,
        [docKey]: (f.documents[docKey] || []).filter((_, i) => i !== fileIdx),
      },
    }));
  };

  /* ── geo pre-fill ── */
  useEffect(() => {
    if (prefill?.lat && prefill?.lng)
      setGeoData(getCircleRateForLocation(prefill.lat, prefill.lng));
  }, []); // eslint-disable-line

  /* ── Restore images + documents from IndexedDB when editing a saved assessment ── */
  useEffect(() => {
    const aid = prefill?._assessmentId;
    if (!aid) return;
    loadFilesForAssessment(aid).then(({ images, documents }) => {
      if (images.length > 0)            setImageFiles(images);
      if (Object.keys(documents).length > 0)
        setForm(f => ({ ...f, documents: { ...f.documents, ...documents } }));
    }).catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    setLiveConf(estimateConfidence(form, imageFiles));
  }, [form, imageFiles]); // eslint-disable-line

  /* ── cross-field errors (live) ── */
  const crossErrors = getCrossValidationErrors(form);

  /* ── submit ── */
  const handleSubmit = () => {
    if (crossErrors.length > 0) {
      setFormError(crossErrors[0]);
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const isValid = validate(form);
    if (!isValid) {
      const firstMsg = Object.values(valErrors)[0] || 'Please fix the errors below.';
      setFormError(firstMsg);
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (!form.address.trim()) { setAddressError(true); setTimeout(() => setAddressError(false), 600); }
      return;
    }
    setFormError('');
    const finalForm = { ...form };
    if (geoData) finalForm.circleRateData = geoData;
    if (imageFiles.length > 0) {
      const best = imageFiles.filter(i => i.analysis)[0];
      if (best) finalForm.imageAnalysis = best.analysis;
      finalForm.imageCount   = imageFiles.length;
      finalForm._imageFiles  = imageFiles; // full array — saved to IndexedDB after valuation
    }
    const yr = parseInt(form.yearOfConstruction);
    if (yr > 1900) {
      const age = new Date().getFullYear() - yr;
      finalForm._derivedAge = age < 5 ? 'new' : age < 15 ? 'mid' : 'old';
    }
    onSubmit(finalForm);
  };

  /* ── derived ── */
  const filledCount  = countInputs(form);
  const totalFields  = 18;
  const showBHK      = form.type === 'residential' && RES_BHK_SUBTYPES.has(form.subtype);
  const showRoadWidth = form.type === 'commercial';
  const showRERA     = form.type === 'residential';

  const zoneStyle = geoData ? {
    bg:    geoData.confidence === 'high' ? '#F0FDF4' : geoData.confidence === 'medium' ? '#FFFBEB' : '#FEF2F2',
    color: geoData.confidence === 'high' ? '#16A34A' : geoData.confidence === 'medium' ? '#D97706' : '#DC2626',
  } : null;

  const totalDocsCount = Object.values(form.documents).reduce((s, a) => s + a.length, 0);

  return (
    <div className="input-screen">
      {/* ── Editing banner ── */}
      <AnimatePresence>
        {editingFrom && (
          <motion.div className="input-edit-banner"
            initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.6" fill="currentColor"/>
            </svg>
            <span>Editing saved assessment from {fmtEditDate(editingFrom)}</span>
            {onDiscardEdit && (
              <button className="input-edit-discard" onClick={onDiscardEdit}>Discard</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {formError && (
          <motion.div ref={errorBannerRef} className="form-error-banner"
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }} transition={{ duration:0.25 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L2 12h10L7 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M7 6v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7" cy="10.5" r="0.55" fill="currentColor"/>
            </svg>
            {formError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Topbar ── */}
      <div className="input-topbar">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="input-topbar-title">{editingFrom ? 'Edit assessment' : 'New assessment'}</span>
        <div className="input-progress">
          <span className="input-progress-label">
            {filledCount + (form.address ? 1 : 0)} of {totalFields + 1} fields
          </span>
          <div className="input-progress-bar">
            <div className="input-progress-fill"
              style={{ width: `${((filledCount + (form.address?1:0)) / (totalFields+1)) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="input-body">
        {/* ═══════════════════════ LEFT ═══════════════════════════════════ */}
        <div className="input-left">

          {/* 1 — Location */}
          <div className="input-section">
            <div className={addressError ? 'shake' : ''}>
              <AddressAutocomplete
                value={form.address}
                onChange={handleAddressChange}
                onSelect={handleAddressSelect}
                placeholder="Search any property address across India"
              />
            </div>
            <AnimatePresence>
              {addressError && (
                <motion.p className="field-error" initial={{ opacity:0, y:-4 }}
                  animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  We need the property address to start the geospatial analysis.
                </motion.p>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {geoData && form.lat != null && !addressError && (
                <motion.div className="geo-preview"
                  initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0, y:-4 }} transition={{ duration:0.3 }}>
                  <span className="geo-preview-zone"
                    style={{ background: zoneStyle.bg, color: zoneStyle.color }}>
                    {geoData.zone}
                  </span>
                  <span className="geo-preview-rate">
                    Circle rate ₹{geoData.ratePerSqft.toLocaleString('en-IN')} per sqft
                  </span>
                  <span className="geo-preview-source"
                    style={{ color: geoData.confidence === 'high' ? '#64748B' : '#D97706' }}>
                    {geoData.confidence === 'high' ? 'Govt. circle rate verified — 19 city database'
                      : geoData.confidence === 'medium' ? 'Estimated rate (zone not in direct registry)'
                      : 'Outside our current 19-city coverage area'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="address-helper">
              Include the locality, city, and pincode for the most accurate geospatial analysis.
            </p>
          </div>

          {/* 2 — Classification */}
          <SectionLabel label="Property Classification" />

          <div className="input-section">
            <div className="field-label">Property type</div>
            <div className="type-tiles" role="radiogroup" aria-label="Property type">
              {TYPE_OPTIONS.map((t, idx) => (
                <button key={t.id}
                  ref={el => { tileRefs.current[idx] = el; }}
                  className={`type-tile ${form.type === t.id ? 'selected' : ''}`}
                  onClick={() => handleTypeSelect(t.id)}
                  onKeyDown={e => handleTileKeyDown(e, idx)}
                  role="radio" aria-checked={form.type === t.id}>
                  <div className="type-tile-icon">{t.icon}</div>
                  <span className="type-tile-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {form.type && (
              <motion.div className="input-section"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <div className="field-label">Sub-type</div>
                <div className="chip-row chip-row--wrap">
                  {SUBTYPES[form.type].map(s => (
                    <button key={s}
                      className={`chip ${form.subtype === s.toLowerCase().replace(/ /g,'_') ? 'selected' : ''}`}
                      onClick={() => { set('subtype', s.toLowerCase().replace(/ /g,'_')); set('bhkConfig',''); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BHK — residential only */}
          <AnimatePresence>
            {showBHK && (
              <motion.div className="input-section"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <div className="field-label">BHK configuration</div>
                <div className="chip-row">
                  {BHK_OPTIONS.map(b => (
                    <button key={b.id}
                      className={`chip ${form.bhkConfig === b.id ? 'selected' : ''}`}
                      onClick={() => set('bhkConfig', b.id)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Corner — commercial only */}
          <AnimatePresence>
            {form.type === 'commercial' && (
              <motion.div className="input-section"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <div className="field-label">Corner property <span className="field-label-optional">+10% premium</span></div>
                <div className="chip-row">
                  <button className={`chip ${form.cornerProperty ? 'selected':''}`}
                    onClick={() => set('cornerProperty', true)}>Yes, corner plot</button>
                  <button className={`chip ${!form.cornerProperty ? 'selected':''}`}
                    onClick={() => set('cornerProperty', false)}>No, not a corner</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3 — Size */}
          <SectionLabel label="Size & Configuration" />

          <div className="input-section two-col">
            <div>
              <label className="field-label">Built-up area (sq ft)</label>
              <input className={`text-input${valErrors.area ? ' text-input--error':''}`}
                type="number" inputMode="numeric" placeholder="e.g. 1200" min="100"
                value={form.area}
                onChange={e => { set('area', e.target.value); clearField('area'); }} />
              {valErrors.area && <p className="field-error field-error--inline">{valErrors.area}</p>}
            </div>
            <div>
              <label className="field-label">Carpet area (sq ft) <span className="field-label-optional">optional</span></label>
              <input className="text-input" type="number" inputMode="numeric"
                placeholder="e.g. 950" min="50" value={form.carpetArea}
                onChange={e => set('carpetArea', e.target.value)} />
            </div>
          </div>

          {/* Carpet > built-up warning */}
          <AnimatePresence>
            {form.carpetArea && form.area && parseFloat(form.carpetArea) > parseFloat(form.area) && (
              <motion.div className="cross-val-warn"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }}>
                ⚠ Carpet area cannot exceed built-up area. Please recheck.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="input-section two-col">
            <div>
              <label className="field-label">Floor number</label>
              <input className={`text-input${valErrors.floor ? ' text-input--error':''}`}
                type="number" inputMode="numeric" placeholder="e.g. 3" min="0"
                value={form.floor}
                onChange={e => { set('floor', e.target.value); clearField('floor'); }} />
              {valErrors.floor && <p className="field-error field-error--inline">{valErrors.floor}</p>}
            </div>
            <div>
              <label className="field-label">Total floors in building <span className="field-label-optional">optional</span></label>
              <input className="text-input" type="number" inputMode="numeric"
                placeholder="e.g. 12" min="1" value={form.totalFloors}
                onChange={e => set('totalFloors', e.target.value)} />
            </div>
          </div>

          {/* Floor > total floors warning */}
          <AnimatePresence>
            {form.floor && form.totalFloors &&
              parseInt(form.floor) > parseInt(form.totalFloors) && (
              <motion.div className="cross-val-warn"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }}>
                ⚠ Floor number cannot exceed total floors in the building.
              </motion.div>
            )}
          </AnimatePresence>

          {/* 4 — Construction Details */}
          <SectionLabel label="Construction Details" />

          <div className="input-section two-col">
            <div>
              <label className="field-label">Year of construction</label>
              <input className="text-input" type="number" inputMode="numeric"
                placeholder="e.g. 2010" min="1900" max={new Date().getFullYear()}
                value={form.yearOfConstruction}
                onChange={e => set('yearOfConstruction', e.target.value)} />
              {form.yearOfConstruction && parseInt(form.yearOfConstruction) <= new Date().getFullYear() && (
                <p className="field-helper-note">
                  Age: {new Date().getFullYear() - parseInt(form.yearOfConstruction)} yrs
                </p>
              )}
            </div>
            <div>
              <label className="field-label">Facing direction <span className="field-label-optional">optional</span></label>
              <select className="text-input" value={form.facing}
                onChange={e => set('facing', e.target.value)}>
                <option value="">Select facing</option>
                {FACING_OPTIONS.map(f => (
                  <option key={f} value={f.toLowerCase().replace(/-/g,'_')}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-section">
            <div className="field-label">Construction type <span className="field-label-optional">optional</span></div>
            <div className="chip-row">
              {CONSTRUCTION_TYPES.map(c => (
                <button key={c.id}
                  className={`chip chip-tall ${form.constructionType === c.id ? 'selected':''}`}
                  onClick={() => set('constructionType', form.constructionType === c.id ? '' : c.id)}>
                  <span className="chip-main">{c.label}</span>
                  <span className="chip-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-section">
            <div className="field-label">Property condition <span className="field-label-optional">affects value directly</span></div>
            <div className="chip-row">
              {CONDITION_OPTIONS.map(c => (
                <button key={c.id}
                  className={`chip chip-tall ${form.propertyCondition === c.id ? 'selected':''}`}
                  onClick={() => set('propertyCondition', form.propertyCondition === c.id ? '' : c.id)}>
                  <span className="chip-main">{c.label}</span>
                  <span className="chip-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Road width — commercial only */}
          <AnimatePresence>
            {showRoadWidth && (
              <motion.div className="input-section"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <div className="field-label">Road width in front <span className="field-label-optional">major impact for commercial</span></div>
                <div className="chip-row">
                  {ROAD_WIDTH_OPTIONS.map(r => (
                    <button key={r.id}
                      className={`chip chip-tall ${form.roadWidth === r.id ? 'selected':''}`}
                      onClick={() => set('roadWidth', form.roadWidth === r.id ? '' : r.id)}>
                      <span className="chip-main">{r.label}</span>
                      <span className="chip-sub">{r.sub}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5 — Occupancy */}
          <SectionLabel label="Occupancy" />

          <div className="input-section">
            <div className="field-label">Occupancy status</div>
            <div className="chip-row">
              {OCCUPANCY_OPTIONS.map(o => (
                <button key={o.id}
                  className={`chip ${form.occupancy === o.id ? 'selected':''}`}
                  onClick={() => set('occupancy', o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {form.occupancy === 'rented' && (
              <motion.div className="input-section"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <label className="field-label">Monthly rental income (₹) <span className="field-label-optional">optional — yield crosscheck</span></label>
                <input className="text-input" type="number" inputMode="numeric"
                  placeholder="e.g. 35000" value={form.rentalIncome}
                  onChange={e => set('rentalIncome', e.target.value)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 6 — Legal & Ownership */}
          <SectionLabel label="Legal & Ownership" />

          <div className="input-section">
            <div className="field-label">Ownership type</div>
            <div className="chip-row">
              {OWNERSHIP_OPTIONS.map(o => (
                <button key={o.id} className={`chip ${form.ownershipType === o.id ? 'selected':''}`}
                  onClick={() => set('ownershipType', o.id)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className="input-section">
            <div className="field-label">
              Khata type
              <span className="field-label-optional"> critical in Karnataka — affects LTV severely</span>
            </div>
            <div className="chip-row">
              {KHATA_OPTIONS.map(o => (
                <button key={o.id}
                  className={`chip chip-tall ${form.khataType === o.id ? 'selected':''} ${o.id === 'b_khata' || o.id === 'no_khata' ? 'chip-warn':''}`}
                  onClick={() => set('khataType', o.id)}>
                  <span className="chip-main">{o.label}</span>
                  <span className="chip-sub">{o.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <ChipGroup label="Occupancy Certificate (OC)" options={OC_OPTIONS}
            value={form.ocStatus} onChange={v => set('ocStatus', v)} />
          <ChipGroup label="Encumbrance Certificate (EC)" options={EC_OPTIONS}
            value={form.ecStatus} onChange={v => set('ecStatus', v)} />
          <ChipGroup label="Building plan approval" options={PLAN_OPTIONS}
            value={form.planApproval} onChange={v => set('planApproval', v)} />
          <ChipGroup label="Property tax payment" options={TAX_OPTIONS}
            value={form.taxStatus} onChange={v => set('taxStatus', v)} />

          <AnimatePresence>
            {showRERA && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                <ChipGroup label="RERA registration" options={RERA_OPTIONS}
                  value={form.reraStatus} onChange={v => set('reraStatus', v)} />
              </motion.div>
            )}
          </AnimatePresence>

          <ChipGroup label="Existing loan on this property" options={LOAN_OPTIONS}
            value={form.existingLoan} onChange={v => set('existingLoan', v)} />

          <div className="input-section">
            <div className="field-label">Litigation / court order</div>
            <div className="chip-row chip-row--wrap">
              {LITIGATION_OPTIONS.map(o => (
                <button key={o.id}
                  className={`chip ${form.litigation === o.id ? 'selected':''} ${o.warn ? 'chip-warn':''}`}
                  onClick={() => set('litigation', o.id)}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Litigation block warning */}
          <AnimatePresence>
            {(form.litigation === 'active' || form.litigation === 'injunction') && (
              <motion.div className="cross-val-warn cross-val-warn--critical"
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                exit={{ opacity:0, height:0 }}>
                ⛔ {form.litigation === 'injunction'
                  ? 'Court injunction detected — lending on this property carries extreme legal risk.'
                  : 'Active litigation detected — this property cannot be legally mortgaged until resolved.'}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 7 — Amenities */}
          <SectionLabel label="Amenities" />

          <div className="input-section">
            <div className="field-label">Select all that apply <span className="field-label-optional">optional</span></div>
            <div className="chip-row chip-row--wrap">
              {AMENITY_OPTIONS.map(a => (
                <button key={a}
                  className={`chip chip-amenity ${form.amenities.includes(a) ? 'selected':''}`}
                  onClick={() => toggleAmenity(a)}>
                  {form.amenities.includes(a) && <span className="chip-check">✓ </span>}{a}
                </button>
              ))}
            </div>
            {form.amenities.length > 0 && (
              <p className="field-helper-note">
                {form.amenities.length} amenit{form.amenities.length===1?'y':'ies'} selected, adding up to +{Math.min(10, form.amenities.length * 2)}% to the estimated value
              </p>
            )}
          </div>

          {/* 8 — Documents */}
          <SectionLabel label="Supporting Documents" />

          <div className="input-section">
            <div className="field-label">
              Upload documents <span className="field-label-optional">each slot accepts multiple files including PDFs and images</span>
            </div>
            <div className="doc-upload-grid">
              {DOC_DEFS.map(doc => (
                <MultiDocSlot
                  key={doc.key}
                  docKey={doc.key}
                  label={doc.label}
                  critical={doc.critical}
                  files={form.documents[doc.key] || []}
                  onAdd={handleDocAdd}
                  onRemove={removeDocFile}
                />
              ))}
            </div>
            {totalDocsCount > 0 && (
              <p className="field-helper-note">
                {totalDocsCount} file{totalDocsCount !== 1 ? 's' : ''} uploaded, adding +{Math.min(10, totalDocsCount * 2)} points to your confidence score
              </p>
            )}
          </div>

          {/* 9 — Property Photos */}
          <SectionLabel label="Property Photos" />

          <div className="input-section">
            <div className="field-label">
              Up to 6 photos <span className="field-label-optional">exterior, interior and surroundings are each analyzed for condition signals</span>
            </div>
            <ImageGallery
              images={imageFiles}
              onAdd={handleImageAdd}
              onRemove={removeImageAt}
              onCarousel={setCarouselIdx}
              imgInputRef={imgInputRef}
            />
          </div>

          <button className="run-btn" onClick={handleSubmit}>
            Run the Estimate
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ═══════════════════════ RIGHT ══════════════════════════════════ */}
        <div className="input-right">
          <ConfidencePreview confidence={liveConf} />

          <div className="preview-section">
            <div className="preview-heading">What the engine will compute</div>
            <div className="signal-list">
              {OUTPUT_SIGNALS.map(s => (
                <div className="signal-row" key={s.key}>
                  <div className="signal-dot" />
                  <span className="signal-label">{s.label}</span>
                  <span className="signal-placeholder">—</span>
                </div>
              ))}
            </div>
          </div>

          <div className="preview-section">
            <div className="preview-heading">How the model weighs your inputs</div>
            <div className="weight-chart">
              {SCORE_WEIGHTS.map((w, i) => (
                <motion.div className="weight-row" key={w.label}
                  initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }}
                  transition={{ delay: i*0.05+0.2 }}>
                  <span className="weight-label">{w.label}</span>
                  <div className="weight-bar-track">
                    <motion.div className="weight-bar-fill"
                      initial={{ width:0 }} animate={{ width: `${w.pct*3}%` }}
                      transition={{ delay: i*0.08+0.4, duration:0.6, ease:[0.16,1,0.3,1] }} />
                  </div>
                  <span className="weight-pct">{w.pct}%</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="preview-section">
            <div className="preview-heading">Your inputs so far</div>
            <div className="summary-card">
              <SR label="Address"       v={form.address || 'Not yet entered'}   e={!form.address} />
              <SR label="Type"          v={form.type ? form.type.charAt(0).toUpperCase()+form.type.slice(1) : 'Not selected'} e={!form.type} />
              <SR label="Sub type"       v={form.subtype ? form.subtype.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()) : 'Not selected'} e={!form.subtype} />
              {showBHK && <SR label="BHK"  v={form.bhkConfig?.toUpperCase() || 'Not selected'} e={!form.bhkConfig} />}
              <SR label="Built-up area" v={form.area ? `${form.area} sq ft` : 'Not entered'} e={!form.area} />
              <SR label="Year built"    v={form.yearOfConstruction || 'Not entered'} e={!form.yearOfConstruction} />
              <SR label="Condition"     v={form.propertyCondition ? form.propertyCondition.charAt(0).toUpperCase()+form.propertyCondition.slice(1) : 'Not selected'} e={!form.propertyCondition} />
              <SR label="Construction"  v={CONSTRUCTION_TYPES.find(c=>c.id===form.constructionType)?.label || 'Not selected'} e={!form.constructionType} />
              <SR label="Occupancy"     v={OCCUPANCY_OPTIONS.find(o=>o.id===form.occupancy)?.label || 'Not selected'} e={!form.occupancy} />
              <SR label="Khata type"    v={KHATA_OPTIONS.find(o=>o.id===form.khataType)?.label || 'Not selected'} e={!form.khataType} />
              <SR label="OC status"     v={OC_OPTIONS.find(o=>o.id===form.ocStatus)?.label || 'Not selected'} e={!form.ocStatus} />
              <SR label="EC status"     v={EC_OPTIONS.find(o=>o.id===form.ecStatus)?.label || 'Not selected'} e={!form.ecStatus} />
              <SR label="Plan approval" v={PLAN_OPTIONS.find(o=>o.id===form.planApproval)?.label || 'Not selected'} e={!form.planApproval} />
              <SR label="Existing loan" v={LOAN_OPTIONS.find(o=>o.id===form.existingLoan)?.label || 'Not selected'} e={!form.existingLoan} />
              <SR label="Litigation"    v={LITIGATION_OPTIONS.find(o=>o.id===form.litigation)?.label || 'Not selected'} e={!form.litigation} />
              <SR label="Amenities"     v={form.amenities.length > 0 ? `${form.amenities.length} selected` : 'None'} e={!form.amenities.length} />
              <SR label="Documents"     v={totalDocsCount > 0 ? `${totalDocsCount} file${totalDocsCount!==1?'s':''}` : 'None uploaded'} e={!totalDocsCount} />
              <SR label="Photos"        v={imageFiles.length > 0 ? `${imageFiles.length} photo${imageFiles.length!==1?'s':''}` : 'None'} e={!imageFiles.length} />
            </div>
          </div>

          <div className="preview-section fallback-note">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L2 12h10L7 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M7 6v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="7" cy="10.5" r="0.5" fill="currentColor"/>
            </svg>
            <p>EC status, Khata type, and litigation together account for up to 40% of confidence score variance. Fill these for the tightest estimate.</p>
          </div>
        </div>
      </div>

      {/* ── Image Carousel Overlay ── */}
      <AnimatePresence>
        {carouselIdx !== null && imageFiles[carouselIdx] && (
          <ImageCarousel
            images={imageFiles}
            idx={carouselIdx}
            onChange={setCarouselIdx}
            onClose={() => setCarouselIdx(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHIP GROUP HELPER
══════════════════════════════════════════════════════════════════════════ */
function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="input-section">
      <div className="field-label">{label}</div>
      <div className="chip-row chip-row--wrap">
        {options.map(o => (
          <button key={o.id}
            className={`chip ${value === o.id ? 'selected':''} ${o.warn ? 'chip-warn':''}`}
            onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   IMAGE GALLERY
══════════════════════════════════════════════════════════════════════════ */
function ImageGallery({ images, onAdd, onRemove, onCarousel, imgInputRef }) {
  const localRef = useRef(null);
  const ref = imgInputRef || localRef;

  return (
    <div className="img-gallery">
      {images.map((img, idx) => (
        <div key={img.id} className="img-thumb-wrap" onClick={() => onCarousel(idx)}>
          <img src={img.preview} alt={`Photo ${idx+1}`} className="img-thumb" />
          {img.loading && (
            <div className="img-thumb-loading"><div className="img-spinner" /></div>
          )}
          {img.analysis && !img.loading && (
            <div className="img-thumb-badge">
              {img.analysis.confidenceAdjustment > 0 ? '✓' : img.analysis.confidenceAdjustment < 0 ? '⚠' : ''}
            </div>
          )}
          <button
            className="img-thumb-remove"
            onClick={e => { e.stopPropagation(); onRemove(idx); }}
            aria-label="Remove photo">
            ×
          </button>
        </div>
      ))}
      {images.length < 6 && (
        <button
          className="img-add-btn"
          onClick={() => ref.current?.click()}
          title={`Add photos (${images.length}/6 used)`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>{images.length === 0 ? 'Add photos' : `Add more (${6-images.length} left)`}</span>
          <input
            ref={ref}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value=''; } }}
          />
        </button>
      )}
      {images.length > 0 && (
        <p className="field-helper-note" style={{ marginTop:8 }}>
          {images.length} of 6 photos added. Click any photo to see a larger preview.
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   IMAGE CAROUSEL (LIGHTBOX)
══════════════════════════════════════════════════════════════════════════ */
function ImageCarousel({ images, idx, onChange, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  onChange(i => Math.min(i+1, images.length-1));
      if (e.key === 'ArrowLeft')   onChange(i => Math.max(i-1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length]); // eslint-disable-line

  const cur = images[idx];
  if (!cur) return null;

  return (
    <motion.div
      className="carousel-overlay"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.2 }}
      onClick={onClose}>
      <button className="carousel-close" onClick={onClose} aria-label="Close">×</button>

      <div className="carousel-main-wrap" onClick={e => e.stopPropagation()}>
        <motion.img
          key={idx}
          src={cur.preview}
          alt={`Photo ${idx+1}`}
          className="carousel-main-img"
          initial={{ opacity:0, scale:0.96 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ duration:0.2 }}
        />
        {cur.analysis && (
          <div className="carousel-analysis">
            {cur.analysis.constructionQuality && <span>Build quality is {cur.analysis.constructionQuality}</span>}
            {cur.analysis.maintenanceCondition && <span> and condition appears {cur.analysis.maintenanceCondition}</span>}
          </div>
        )}
      </div>

      <div className="carousel-controls" onClick={e => e.stopPropagation()}>
        <button className="carousel-nav-btn" onClick={() => onChange(i => Math.max(i-1,0))}
          disabled={idx === 0} aria-label="Previous">‹</button>
        <span className="carousel-counter">{idx+1} / {images.length}</span>
        <button className="carousel-nav-btn" onClick={() => onChange(i => Math.min(i+1, images.length-1))}
          disabled={idx === images.length-1} aria-label="Next">›</button>
      </div>

      <div className="carousel-thumbs" onClick={e => e.stopPropagation()}>
        {images.map((img, i) => (
          <img key={img.id} src={img.preview} alt={`${i+1}`}
            className={`carousel-thumb ${i === idx ? 'carousel-thumb--active':''}`}
            onClick={() => onChange(i)} />
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MULTI-FILE DOCUMENT SLOT
══════════════════════════════════════════════════════════════════════════ */
function MultiDocSlot({ docKey, label, critical, files, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const hasFiles = files.length > 0;

  return (
    <div className={`doc-slot ${hasFiles ? 'doc-slot--done':''}`}>
      <button className="doc-slot-header" onClick={() => inputRef.current?.click()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ color: hasFiles ? '#16A34A' : 'var(--ink-4)', flexShrink:0 }}>
          {hasFiles
            ? <><circle cx="7" cy="7" r="6" fill="#F0FDF4"/>
                <path d="M4 7l2.5 2.5L10 4" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></>
            : <><path d="M7 10V4M4 7l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>
          }
        </svg>
        <span className="doc-slot-label">{label}</span>
        {critical && !hasFiles && <span className="doc-slot-critical">Key doc</span>}
        {hasFiles && <span className="doc-slot-count">{files.length} file{files.length!==1?'s':''}</span>}
        <span className="doc-slot-add-hint">{hasFiles ? '+ Add more' : 'Upload'}</span>
      </button>

      {hasFiles && (
        <ul className="doc-file-list">
          {files.map((f, i) => (
            <li key={i} className="doc-file-row">
              <span className="doc-file-icon">
                {f.type === 'application/pdf' ? '📄' : '🖼'}
              </span>
              <span className="doc-file-name" title={f.name}>
                {f.name.length > 28 ? f.name.slice(0,25)+'…' : f.name}
              </span>
              <button className="doc-file-remove" onClick={() => onRemove(docKey, i)}>×</button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        style={{ display:'none' }}
        onChange={e => { if (e.target.files) { onAdd(docKey, e.target.files); e.target.value=''; } }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONFIDENCE PREVIEW
══════════════════════════════════════════════════════════════════════════ */
function ConfidencePreview({ confidence }) {
  const r=30, start=120, total=300, filled=(confidence/100)*total;
  const ac = confidence>=75 ? '#16A34A' : confidence>=55 ? '#D97706' : '#DC2626';
  const msg = confidence>=75
    ? { text:'Strong data quality. An accurate estimate is expected.', color:'#16A34A' }
    : confidence>=55
    ? { text:'Moderate data quality. Add legal and document details to improve.', color:'#D97706' }
    : { text:'Limited data provided. Confidence in the estimate will be low.', color:'#DC2626' };
  const toRad = d => (d-90)*(Math.PI/180);
  const arc = (cx,cy,r2,s,e) => {
    const sx=cx+r2*Math.cos(toRad(s)), sy=cy+r2*Math.sin(toRad(s));
    const ex=cx+r2*Math.cos(toRad(e)), ey=cy+r2*Math.sin(toRad(e));
    return `M ${sx} ${sy} A ${r2} ${r2} 0 ${e-s>180?1:0} 1 ${ex} ${ey}`;
  };
  return (
    <div className="preview-section conf-preview-section">
      <div className="preview-heading">Estimated confidence</div>
      <div className="conf-preview-wrap">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <path d={arc(40,40,r,start,start+total)} fill="none" stroke="#E8E7E1" strokeWidth="5" strokeLinecap="round"/>
          <path d={arc(40,40,r,start,start+filled)} fill="none" stroke={ac} strokeWidth="5" strokeLinecap="round"/>
          <text x="40" y="37" textAnchor="middle"
            style={{ fontFamily:'var(--mono)', fontSize:'12px', fill:ac, fontWeight:500 }}>{confidence}%</text>
          <text x="40" y="50" textAnchor="middle"
            style={{ fontFamily:'var(--mono)', fontSize:'7px', fill:'#9B9B95', letterSpacing:'0.06em' }}>CONF</text>
        </svg>
        <div className="conf-preview-right">
          <p className="conf-preview-msg" style={{ color:msg.color }}>{msg.text}</p>
        </div>
      </div>
    </div>
  );
}

function SR({ label, v, e }) {
  return (
    <div className="summary-row">
      <span className="summary-key">{label}</span>
      <span className={`summary-val ${e?'empty':''}`}>{v}</span>
    </div>
  );
}

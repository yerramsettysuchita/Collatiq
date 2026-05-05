/* ── INPUT HYDRATION ───────────────────────────────────────────────────────
   Maps a saved assessment entry back to the full form input shape.
   Handles missing fields gracefully — only fills what is available.
   Covers all fields from Phase 11 (basic) + Phase 13 (expanded) forms.
*/

export function hydrateInputFromSavedAssessment(savedAssessment) {
  if (!savedAssessment) return {};

  const inputs = savedAssessment.inputs || {};

  return {
    // ── Core location ──
    address:   inputs.address   || savedAssessment.address   || '',
    lat:       inputs.lat       ?? null,
    lng:       inputs.lng       ?? null,

    // ── Classification ──
    type:      inputs.type      || '',
    subtype:   inputs.subtype   || '',

    // ── Size ──
    area:       inputs.area       || (savedAssessment.areaSqft > 0 ? String(savedAssessment.areaSqft) : ''),
    carpetArea: inputs.carpetArea || '',
    floor:      inputs.floor      || '',
    totalFloors: inputs.totalFloors || '',

    // ── Construction ──
    yearOfConstruction: inputs.yearOfConstruction || '',
    constructionType:   inputs.constructionType   || '',
    facing:             inputs.facing             || '',
    cornerProperty:     inputs.cornerProperty     || false,

    // ── Occupancy ──
    age:          inputs.age      || inputs.ageBand || savedAssessment.age || '',
    occupancy:    inputs.occupancy || '',
    rentalIncome: inputs.rentalIncome || '',

    // ── Legal (legacy) ──
    legal: inputs.legal || savedAssessment.legal || '',

    // ── Legal (expanded) ──
    ownershipType: inputs.ownershipType || '',
    khataType:     inputs.khataType     || '',
    ocStatus:      inputs.ocStatus      || '',
    ecStatus:      inputs.ecStatus      || '',
    taxStatus:     inputs.taxStatus     || '',
    planApproval:  inputs.planApproval  || '',
    reraStatus:    inputs.reraStatus    || '',
    existingLoan:  inputs.existingLoan  || '',
    litigation:    inputs.litigation    || '',

    // ── Physical condition (Phase 14) ──
    bhkConfig:         inputs.bhkConfig         || '',
    propertyCondition: inputs.propertyCondition  || '',
    roadWidth:         inputs.roadWidth          || '',

    // ── Amenities ──
    amenities: Array.isArray(inputs.amenities) ? inputs.amenities : [],

    // ── Documents ── (file objects can't be restored, keep empty)
    documents: {},

    // ── Metadata ──
    _editingFrom:   savedAssessment.timestamp || null,
    _sourceId:      savedAssessment.id        || null,
    _assessmentId:  savedAssessment.id        || null, // used to load files from IndexedDB
  };
}

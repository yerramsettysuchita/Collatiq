/* ── SCENARIO PRESETS ───────────────────────────────────────────────────────
   One-click scenario chips for the sensitivity dial.
   Each preset adjusts the slider state and explains its purpose.
*/

export const SCENARIO_PRESETS = [
  {
    id:          'base',
    label:       'Base Case',
    description: 'Standard inputs as entered. No adjustments applied.',
    icon:        '○',
    sensitivity: { legal: 0, occupancy: 0, demand: 0 },
  },
  {
    id:          'conservative',
    label:       'Conservative',
    description: 'Slight demand reduction reflects slower market absorption.',
    icon:        '▽',
    sensitivity: { legal: 0, occupancy: 0, demand: 0.3 },
  },
  {
    id:          'legal_risk',
    label:       'Legal Risk',
    description: 'Partial title complexity applied. Confidence and LTV drop.',
    icon:        '⚠',
    sensitivity: { legal: 0.6, occupancy: 0, demand: 0 },
  },
  {
    id:          'weak_demand',
    label:       'Weak Demand',
    description: 'Distressed market condition with low buyer activity.',
    icon:        '↓',
    sensitivity: { legal: 0, occupancy: 0, demand: 0.7 },
  },
  {
    id:          'fast_exit',
    label:       'Fast Exit',
    description: 'Best-case scenario: clear legal status, strong demand.',
    icon:        '↑',
    sensitivity: { legal: 0, occupancy: 0, demand: 0 },
  },
  {
    id:          'worst_case',
    label:       'Stress Case',
    description: 'Vacant property with legal complexity in a weak market.',
    icon:        '⛔',
    sensitivity: { legal: 0.8, occupancy: 0.6, demand: 0.8 },
  },
];

/** Rule-based explanation for what changed when sliders move. */
export function explainChanges(prevSensitivity, nextSensitivity) {
  const lines = [];
  const dl = (nextSensitivity.legal    || 0) - (prevSensitivity.legal    || 0);
  const do_ = (nextSensitivity.occupancy || 0) - (prevSensitivity.occupancy || 0);
  const dd = (nextSensitivity.demand   || 0) - (prevSensitivity.demand   || 0);

  if (Math.abs(dl) > 0.05) {
    if (dl > 0) lines.push('Greater legal uncertainty widens the value band and increases the distress discount.');
    else        lines.push('Improved legal clarity tightens the value band and reduces the distress discount.');
  }
  if (Math.abs(do_) > 0.05) {
    if (do_ > 0) lines.push('Vacancy or tenancy complications reduce occupancy confidence and compress the RPI.');
    else         lines.push('Stable occupancy improves confidence in near-term market value.');
  }
  if (Math.abs(dd) > 0.05) {
    if (dd > 0) lines.push('Weaker demand reduces the Resale Potential Index and extends the time to liquidate.');
    else        lines.push('Stronger demand compresses the liquidation timeline and improves exit value.');
  }
  if (lines.length === 0) lines.push('No material change applied.');
  return lines;
}

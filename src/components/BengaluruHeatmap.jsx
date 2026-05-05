import { useEffect, useRef, useState } from 'react';
import { BENGALURU_ZONES } from '../engine/geoEngine';
import 'leaflet/dist/leaflet.css';
import './BengaluruHeatmap.css';

function zoneColor(rate) {
  if (rate > 10000) return { fill: '#1A1A18', opacity: 0.75 };
  if (rate > 8000)  return { fill: '#5B6EF5', opacity: 0.70 };
  if (rate > 6000)  return { fill: '#16A34A', opacity: 0.65 };
  if (rate > 4000)  return { fill: '#D97706', opacity: 0.60 };
  return              { fill: '#DC2626', opacity: 0.55 };
}

function typicalRPI(rate) {
  if (rate > 10000) return '78–88';
  if (rate > 8000)  return '65–78';
  if (rate > 6000)  return '54–66';
  if (rate > 4000)  return '42–55';
  return '30–44';
}

function typicalTTL(rate) {
  if (rate > 10000) return '30–50 days';
  if (rate > 8000)  return '45–70 days';
  if (rate > 6000)  return '65–95 days';
  if (rate > 4000)  return '90–130 days';
  return '120–180 days';
}

function localityTier(rate) {
  if (rate > 10000) return 'Premium';
  if (rate > 8000)  return 'Established';
  if (rate > 6000)  return 'Developing';
  if (rate > 4000)  return 'Emerging';
  return 'Peripheral';
}

const LEGEND_TIERS = [
  { label: '> ₹10,000/sqft', color: '#1A1A18' },
  { label: '₹8,001–10,000',  color: '#5B6EF5' },
  { label: '₹6,001–8,000',   color: '#16A34A' },
  { label: '₹4,001–6,000',   color: '#D97706' },
  { label: '< ₹4,000',       color: '#DC2626' },
];

export default function BengaluruHeatmap({ onAssess }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const circlesRef    = useRef([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    const L = require('leaflet');

    const map = L.map(containerRef.current, {
      center:             [12.9716, 77.5946],
      zoom:               11,
      zoomControl:        true,
      attributionControl: true,
      scrollWheelZoom:    false,
      dragging:           false,
      keyboard:           false,
      tap:                false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data © OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    BENGALURU_ZONES.forEach(zone => {
      const { fill, opacity } = zoneColor(zone.ratePerSqft);
      const circle = L.circle([zone.lat, zone.lng], {
        radius:      1200,
        color:       fill,
        fillColor:   fill,
        fillOpacity: opacity,
        weight:      1,
        opacity:     0.7,
      }).addTo(map);

      circle.bindTooltip(
        `<div class="bhm-tip"><strong>${zone.name}</strong><br/>₹${zone.ratePerSqft.toLocaleString('en-IN')}/sqft</div>`,
        { sticky: true }
      );

      circle.on('click', () => setSelectedZone(zone));
      circlesRef.current.push(circle);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      circlesRef.current = [];
    };
  }, []); // eslint-disable-line

  const handleActivate = () => {
    if (!mapRef.current || active) return;
    mapRef.current.dragging.enable();
    mapRef.current.scrollWheelZoom.enable();
    mapRef.current.keyboard.enable();
    setActive(true);
  };

  const handleDeactivate = () => {
    if (!mapRef.current || !active) return;
    mapRef.current.dragging.disable();
    mapRef.current.scrollWheelZoom.disable();
    mapRef.current.keyboard.disable();
    setActive(false);
  };

  const handleAssessZone = () => {
    if (!selectedZone || !onAssess) return;
    onAssess(`${selectedZone.name} Bengaluru India`);
  };

  return (
    <div className="bhm-wrap">
      <div
        className="bhm-map-container"
        onMouseEnter={handleActivate}
        onMouseLeave={handleDeactivate}
      >
        <div ref={containerRef} className="bhm-map" />

        {!active && (
          <div className="bhm-overlay" onClick={handleActivate}>
            <span className="bhm-overlay-hint">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Click to interact with map
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="bhm-legend">
          <div className="bhm-legend-title">Circle rate</div>
          {LEGEND_TIERS.map((t, i) => (
            <div key={i} className="bhm-legend-item">
              <span className="bhm-legend-swatch" style={{ background: t.color }} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Zone side panel */}
        {selectedZone && (
          <div className="bhm-panel">
            <button className="bhm-panel-close" onClick={() => setSelectedZone(null)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="bhm-panel-zone">{selectedZone.name}</div>
            <div className="bhm-panel-rate">
              ₹{selectedZone.ratePerSqft.toLocaleString('en-IN')}
              <span className="bhm-panel-rate-unit">/sqft</span>
            </div>
            <div className="bhm-panel-metrics">
              <div className="bhm-panel-metric">
                <div className="bhm-pm-label">Typical RPI range</div>
                <div className="bhm-pm-val">{typicalRPI(selectedZone.ratePerSqft)}</div>
              </div>
              <div className="bhm-panel-metric">
                <div className="bhm-pm-label">Typical TTL</div>
                <div className="bhm-pm-val">{typicalTTL(selectedZone.ratePerSqft)}</div>
              </div>
              <div className="bhm-panel-metric">
                <div className="bhm-pm-label">Locality tier</div>
                <div className="bhm-pm-val">{localityTier(selectedZone.ratePerSqft)}</div>
              </div>
            </div>
            <button className="bhm-panel-assess-btn" onClick={handleAssessZone}>
              Assess property in this zone
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

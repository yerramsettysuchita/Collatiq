import { useEffect, useRef, useState, useCallback } from 'react';
import { ALL_CITY_ZONES } from '../engine/geoEngine';
import 'leaflet/dist/leaflet.css';
import './IndiaCitiesMap.css';

/* ── Helpers ─────────────────────────────────────────────── */
function zoneColor(rate) {
  if (rate > 18000) return { fill: '#0C0C0B', opacity: 0.80 };
  if (rate > 12000) return { fill: '#1A1A18', opacity: 0.75 };
  if (rate > 8000)  return { fill: '#5B6EF5', opacity: 0.70 };
  if (rate > 6000)  return { fill: '#16A34A', opacity: 0.65 };
  if (rate > 4000)  return { fill: '#D97706', opacity: 0.60 };
  return                   { fill: '#DC2626', opacity: 0.55 };
}
function typicalRPI(r) {
  if (r > 18000) return '82–92'; if (r > 12000) return '75–85';
  if (r > 8000)  return '65–78'; if (r > 6000)  return '54–67';
  if (r > 4000)  return '42–55'; return '30–44';
}
function typicalTTL(r) {
  if (r > 18000) return '20–40 days'; if (r > 12000) return '30–50 days';
  if (r > 8000)  return '45–70 days'; if (r > 6000)  return '65–95 days';
  if (r > 4000)  return '90–130 days'; return '120–180 days';
}
function localityTier(r) {
  if (r > 18000) return 'Ultra Premium'; if (r > 12000) return 'Premium';
  if (r > 8000)  return 'Established';  if (r > 6000)  return 'Developing';
  if (r > 4000)  return 'Emerging';     return 'Peripheral';
}

const LEGEND_TIERS = [
  { label: '> ₹18,000/sqft', color: '#0C0C0B' },
  { label: '₹12,001–18,000', color: '#1A1A18' },
  { label: '₹8,001–12,000',  color: '#5B6EF5' },
  { label: '₹6,001–8,000',   color: '#16A34A' },
  { label: '₹4,001–6,000',   color: '#D97706' },
  { label: '< ₹4,000',       color: '#DC2626' },
];

/* ── Component ───────────────────────────────────────────── */
export default function IndiaCitiesMap({ onAssess }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const layerRef     = useRef(null);   // LayerGroup for zone circles
  const [cityIdx,       setCityIdx]       = useState(0);
  const [selectedZone,  setSelectedZone]  = useState(null);
  const [active,        setActive]        = useState(false);
  const [mapReady,      setMapReady]      = useState(false);

  /* Init map once */
  useEffect(() => {
    if (mapRef.current) return;
    const L = require('leaflet');

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: false,
      keyboard: false,
      tap: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    // Layer group to manage zone circles
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []); // eslint-disable-line

  /* Draw zones whenever city or map changes */
  const drawCity = useCallback((idx) => {
    const L = require('leaflet');
    const map   = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    setSelectedZone(null);

    const city = ALL_CITY_ZONES[idx];
    city.zones.forEach(zone => {
      const { fill, opacity } = zoneColor(zone.ratePerSqft);
      const circle = L.circle([zone.lat, zone.lng], {
        radius:      zone.radiusKm * 1000,
        color:       fill,
        fillColor:   fill,
        fillOpacity: opacity,
        weight:      1.2,
        opacity:     0.8,
      });
      circle.bindTooltip(
        `<div class="icm-tip"><strong>${zone.name}</strong><br/>₹${zone.ratePerSqft.toLocaleString('en-IN')}/sqft · ${localityTier(zone.ratePerSqft)}</div>`,
        { sticky: true }
      );
      circle.on('click', () => setSelectedZone(zone));
      group.addLayer(circle);
    });

    map.flyTo(city.center, city.zoom, { duration: 1.2 });
  }, []);

  useEffect(() => {
    if (mapReady) drawCity(cityIdx);
  }, [mapReady, cityIdx, drawCity]);

  /* Map interaction */
  const enableMap = () => {
    if (!mapRef.current || active) return;
    mapRef.current.dragging.enable();
    mapRef.current.scrollWheelZoom.enable();
    mapRef.current.keyboard.enable();
    setActive(true);
  };
  const disableMap = () => {
    if (!mapRef.current || !active) return;
    mapRef.current.dragging.disable();
    mapRef.current.scrollWheelZoom.disable();
    mapRef.current.keyboard.disable();
    setActive(false);
  };

  const handleAssessZone = () => {
    if (!selectedZone || !onAssess) return;
    onAssess(`${selectedZone.name}, ${ALL_CITY_ZONES[cityIdx].name}, India`);
  };

  return (
    <div className="icm-wrap">
      {/* City tabs */}
      <div className="icm-tabs" role="tablist">
        {ALL_CITY_ZONES.map((city, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={cityIdx === i}
            className={`icm-tab ${cityIdx === i ? 'icm-tab--active' : ''}`}
            onClick={() => setCityIdx(i)}
          >
            <span className="icm-tab-abbr">{city.abbr}</span>
            <span className="icm-tab-name">{city.name}</span>
          </button>
        ))}
      </div>

      {/* Map container */}
      <div
        className="icm-map-container"
        onMouseEnter={enableMap}
        onMouseLeave={disableMap}
      >
        <div ref={containerRef} className="icm-map" />

        {!active && (
          <div className="icm-overlay" onClick={enableMap}>
            <span className="icm-overlay-hint">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Click to interact
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="icm-legend">
          <div className="icm-legend-title">Circle rate</div>
          {LEGEND_TIERS.map((t, i) => (
            <div key={i} className="icm-legend-item">
              <span className="icm-legend-swatch" style={{ background: t.color }} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Zone panel */}
        {selectedZone && (
          <div className="icm-panel">
            <button className="icm-panel-close" onClick={() => setSelectedZone(null)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="icm-panel-city">{ALL_CITY_ZONES[cityIdx].name}</div>
            <div className="icm-panel-zone">{selectedZone.name}</div>
            <div className="icm-panel-rate">
              ₹{selectedZone.ratePerSqft.toLocaleString('en-IN')}
              <span className="icm-panel-rate-unit">/sqft</span>
            </div>
            <div className="icm-panel-tier">{localityTier(selectedZone.ratePerSqft)}</div>
            <div className="icm-panel-metrics">
              <div className="icm-pm">
                <div className="icm-pm-label">Typical RPI</div>
                <div className="icm-pm-val">{typicalRPI(selectedZone.ratePerSqft)}</div>
              </div>
              <div className="icm-pm">
                <div className="icm-pm-label">Time to liquidate</div>
                <div className="icm-pm-val">{typicalTTL(selectedZone.ratePerSqft)}</div>
              </div>
            </div>
            <button className="icm-panel-btn" onClick={handleAssessZone}>
              Assess property here →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

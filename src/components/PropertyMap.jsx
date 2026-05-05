import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import './PropertyMap.css';

/*
  Queries are tuned for Indian OSM data:
  - Schools:   amenity=school/college + building=school  (radius 8 km)
  - Hospitals: amenity=hospital/clinic + healthcare=*    (radius 8 km)
  - Transit:   highway=bus_stop (primary India tag) + railway stations (radius 10 km)
*/
const FACILITIES = [
  {
    id: 'schools',
    label: 'Schools',
    color: '#3B82F6',
    radius: 8000,
    query: (lat, lng, r) =>
      `[out:json][timeout:25];` +
      `(node["amenity"~"^(school|college|university|kindergarten|secondary_school|primary_school)$"](around:${r},${lat},${lng});` +
      `way["amenity"~"^(school|college|university|kindergarten)$"](around:${r},${lat},${lng});` +
      `node["building"="school"](around:${r},${lat},${lng});` +
      `way["building"="school"](around:${r},${lat},${lng});` +
      `node["education"~".*"](around:${Math.round(r * 0.5)},${lat},${lng}););` +
      `out center 40;`,
  },
  {
    id: 'hospitals',
    label: 'Hospitals',
    color: '#EF4444',
    radius: 8000,
    query: (lat, lng, r) =>
      `[out:json][timeout:25];` +
      `(node["amenity"~"^(hospital|clinic|pharmacy|doctors|health_post|nursing_home|dentist)$"](around:${r},${lat},${lng});` +
      `way["amenity"~"^(hospital|clinic|pharmacy|doctors|nursing_home)$"](around:${r},${lat},${lng});` +
      `node["healthcare"](around:${r},${lat},${lng});` +
      `way["healthcare"](around:${Math.round(r * 0.6)},${lat},${lng});` +
      `node["building"="hospital"](around:${r},${lat},${lng}););` +
      `out center 40;`,
  },
  {
    id: 'metro',
    label: 'Metro / Transit',
    color: '#8B5CF6',
    radius: 10000,
    query: (lat, lng, r) =>
      `[out:json][timeout:25];` +
      `(node["highway"="bus_stop"](around:${Math.round(r * 0.5)},${lat},${lng});` +
      `node["amenity"~"^(bus_station|bus_stop)$"](around:${r},${lat},${lng});` +
      `node["railway"~"^(station|halt|tram_stop|subway_entrance)$"](around:${r},${lat},${lng});` +
      `node["station"="subway"](around:${r},${lat},${lng});` +
      `way["railway"~"^(station|halt)$"](around:${r},${lat},${lng}););` +
      `out center 40;`,
  },
];

export default function PropertyMap({ lat, lng, address, rpi, zone }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const groupsRef    = useRef({});
  const fetchedRef   = useRef({});   // false | 'loading' | true
  const ctrlRef      = useRef({});   // per-layer AbortController

  const [activeLayers,  setActiveLayers]  = useState(new Set());
  const [loadingLayer,  setLoadingLayer]  = useState(null);
  const [layerCounts,   setLayerCounts]   = useState({});   // id → number
  const [mapActive,     setMapActive]     = useState(false);

  // ── Map initialisation (once) ──────────────────────────────────────────────
  useEffect(() => {
    if (!lat || !lng || mapRef.current) return;

    const L = window.L || require('leaflet');

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: false,
      tap: false,
      keyboard: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data © OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Subject property pin
    const subjectIcon = L.divIcon({
      className: '',
      html: `<div class="pm-subject-pin"><div class="pm-subject-dot"></div></div>`,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });
    L.marker([lat, lng], { icon: subjectIcon })
      .addTo(map)
      .bindTooltip(
        `<div class="pm-tooltip"><strong>${address || 'Subject property'}</strong><br/>RPI: ${rpi ?? '—'} / 100${zone ? `<br/>Zone: ${zone}` : ''}</div>`,
        { permanent: false, direction: 'top', offset: [0, -36] }
      );

    // 1 km influence circle (wider for rural context)
    L.circle([lat, lng], {
      radius: 1000,
      color: '#5B6EF5',
      fillColor: '#5B6EF5',
      fillOpacity: 0.06,
      weight: 1.5,
      opacity: 0.35,
      dashArray: '5 5',
    }).addTo(map);

    // Comparable buildings fetch
    const compIcon = L.divIcon({
      className: '',
      html: '<div class="pm-comp-dot"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    const compQuery = `[out:json][timeout:8];(way["building"~"residential|apartments|commercial|yes"](around:1000,${lat},${lng});relation["building"~"residential|apartments|commercial"](around:1000,${lat},${lng}););out center;`;
    const compCtrl = new AbortController();
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(compQuery)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: compCtrl.signal,
    })
      .then(r => r.json())
      .then(data => {
        (data.elements || []).forEach(el => {
          const clat = el.center?.lat || el.lat;
          const clng = el.center?.lon || el.lon;
          if (clat && clng) L.marker([clat, clng], { icon: compIcon }).addTo(map);
        });
      })
      .catch(() => {});

    FACILITIES.forEach(f => {
      groupsRef.current[f.id] = L.layerGroup();
    });

    return () => {
      compCtrl.abort();
      Object.values(ctrlRef.current).forEach(c => c?.abort());
      map.remove();
      mapRef.current     = null;
      groupsRef.current  = {};
      fetchedRef.current = {};
    };
  }, [lat, lng]); // eslint-disable-line

  // ── Facility layer toggle ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = window.L || require('leaflet');

    FACILITIES.forEach(f => {
      const group = groupsRef.current[f.id];
      if (!group) return;

      if (activeLayers.has(f.id)) {
        if (!map.hasLayer(group)) group.addTo(map);

        if (!fetchedRef.current[f.id]) {
          fetchedRef.current[f.id] = 'loading';
          setLoadingLayer(f.id);

          const ctrl = new AbortController();
          ctrlRef.current[f.id] = ctrl;

          const poiIcon = L.divIcon({
            className: '',
            html: `<div class="pm-poi" style="--fc:${f.color}"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(f.query(lat, lng, f.radius))}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: ctrl.signal,
          })
            .then(r => r.json())
            .then(data => {
              const elements = (data.elements || []).slice(0, 30);
              let count = 0;
              elements.forEach(el => {
                const plat = el.center?.lat || el.lat;
                const plng = el.center?.lon || el.lon;
                const name = el.tags?.name || f.label.replace(' / Transit', '');
                if (plat && plng) {
                  count++;
                  L.marker([plat, plng], { icon: poiIcon })
                    .bindTooltip(
                      `<div class="pm-tooltip"><strong>${name}</strong><br/><span style="color:#9B9B95;font-size:11px">${f.label}</span></div>`,
                      { direction: 'top', offset: [0, -11] }
                    )
                    .addTo(group);
                }
              });
              fetchedRef.current[f.id] = true;
              setLayerCounts(prev => ({ ...prev, [f.id]: count }));
              setLoadingLayer(prev => (prev === f.id ? null : prev));

              // Auto-zoom out slightly so newly added pins are visible
              if (count > 0 && map.getZoom() > 12) {
                map.setZoom(12, { animate: true });
              }
            })
            .catch(() => {
              fetchedRef.current[f.id] = false;
              setLoadingLayer(prev => (prev === f.id ? null : prev));
            });
        }
      } else {
        if (map.hasLayer(group)) map.removeLayer(group);
      }
    });
  }, [activeLayers, lat, lng]); // eslint-disable-line

  const enableMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || mapActive) return;
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.keyboard.enable();
    setMapActive(true);
  }, [mapActive]);

  const disableMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapActive) return;
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.keyboard.disable();
    setMapActive(false);
  }, [mapActive]);

  const toggleLayer = id => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!lat || !lng) return null;

  /* No-results chips — shown after fetch completes with 0 results */
  const noResultLayers = FACILITIES.filter(
    f => activeLayers.has(f.id) && fetchedRef.current[f.id] === true && layerCounts[f.id] === 0
  );

  return (
    <div className="pm-wrap">
      {/* Amenities toggle bar */}
      <div className="pm-layer-bar">
        <span className="pm-layer-bar-label">Amenities</span>
        {FACILITIES.map(f => {
          const count   = layerCounts[f.id];
          const isActive = activeLayers.has(f.id);
          const isLoading = loadingLayer === f.id;
          return (
            <button
              key={f.id}
              className={`pm-layer-btn ${isActive ? 'active' : ''}`}
              style={{ '--fc': f.color }}
              onClick={() => toggleLayer(f.id)}
              disabled={isLoading}
            >
              <span className="pm-layer-dot" />
              {isLoading
                ? 'Searching…'
                : isActive && count != null
                  ? `${f.label} (${count})`
                  : f.label}
            </button>
          );
        })}
      </div>

      <div
        className="pm-map-container"
        onMouseLeave={disableMap}
      >
        <div ref={containerRef} className="pm-map" />
        {!mapActive && (
          <div className="pm-overlay" onClick={enableMap}>
            <span className="pm-overlay-hint">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Click to interact
            </span>
          </div>
        )}
      </div>

      {/* No-results notice */}
      {noResultLayers.length > 0 && (
        <div className="pm-no-results">
          {noResultLayers.map(f => (
            <span key={f.id} className="pm-no-result-chip" style={{ '--fc': f.color }}>
              <span className="pm-layer-dot" />
              No {f.label.toLowerCase()} found within {(f.radius / 1000).toFixed(0)} km
            </span>
          ))}
        </div>
      )}

      {/* Dynamic legend */}
      <div className="pm-legend">
        <div className="pm-legend-item">
          <span className="pm-legend-dot pm-legend-dot--subject" />
          <span>Subject property</span>
        </div>
        <div className="pm-legend-item">
          <span className="pm-legend-dot pm-legend-dot--comp" />
          <span>Comparable properties</span>
        </div>
        {FACILITIES.filter(f => activeLayers.has(f.id) && layerCounts[f.id] > 0).map(f => (
          <div key={f.id} className="pm-legend-item">
            <span className="pm-legend-dot" style={{ background: f.color }} />
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

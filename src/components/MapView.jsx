import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { AUSTIN, FIRE_ZONE_M } from '../lib/constants.js';
import { FIRE_COLORS, REPORT_COLORS } from './MapLegend.jsx';
import { HAZARDS } from '../lib/hazards.js';
import { rainTileUrl } from '../lib/rain.js';

const HEAT_URL = (date) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_Land_Surface_Temp_Daily_Day/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;

const FIRE_LABEL = { h: 'Almost certainly a fire', n: 'Probably a fire', l: 'Possibly a fire' };
// FIRMS reports confidence as l / n / h (sometimes spelled out).
const fireLevel = (c) => ({ h: 'h', l: 'l' }[String(c || 'n').trim().toLowerCase()[0]] || 'n');
const PIN_SIZE = { high: 20, medium: 16, low: 13 };

// One Leaflet map for everything. Circle markers only, so there are no
// marker image files to break in the bundler.
//   center     {lat,lng}
//   reports    rows from the reports table
//   fires      [{lat,lng,acquired,...}] from /api/fires
//   pin        {lat,lng} draggable-by-tap pin (finder)
//   onPick     called with {lat,lng} when the map is tapped
//   radius     {lat,lng,km} volunteer coverage circle
//   heatDate   'YYYY-MM-DD' to show the NASA land surface temperature layer
//   alerts     weather alerts from /api/alerts; ones with an outline are drawn
//   hotspots   road danger spots from lib/roads.js
//   rain       time of the NASA rain image to show, or null
export default function MapView({ center, reports, fires, pin, onPick, radius, heatDate, alerts, hotspots, rain, height = 320 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true }).setView(
      [center?.lat ?? AUSTIN.lat, center?.lng ?? AUSTIN.lng],
      11
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(m);
    m.on('click', (e) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layers.current = {
      alerts: L.layerGroup().addTo(m),
      roads: L.layerGroup().addTo(m),
      fires: L.layerGroup().addTo(m),
      reports: L.layerGroup().addTo(m),
      extra: L.layerGroup().addTo(m),
    };
    map.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (center && map.current) map.current.setView([center.lat, center.lng]);
  }, [center?.lat, center?.lng]);

  // Road danger spots: yellow road-sign diamonds with the number of animals hit
  useEffect(() => {
    const g = layers.current.roads;
    if (!g) return;
    g.clearLayers();
    for (const h of hotspots || []) {
      const label = document.createElement('div');
      label.textContent = `${h.example ? 'Example road danger spot' : 'Road danger spot'}: ${h.count} animals hit by vehicles reported near here.`;
      L.marker([h.lat, h.lng], {
        icon: L.divIcon({ className: 'road-pin', iconSize: [30, 30], html: `<span><b>${Number(h.count)}</b></span>` }),
        zIndexOffset: 500,
      })
        .bindPopup(label)
        .addTo(g);
    }
  }, [hotspots]);

  // Weather alert areas (only alerts that come with an outline)
  useEffect(() => {
    const g = layers.current.alerts;
    if (!g) return;
    g.clearLayers();
    for (const a of alerts || []) {
      if (!a.geometry) continue;
      const hazard = HAZARDS[a.category];
      const color = hazard?.color || '#555';
      const label = document.createElement('div');
      label.textContent = `${hazard?.icon || ''} ${a.example ? 'Example: ' : ''}${a.event}. ${hazard?.label || ''}.`;
      L.geoJSON(a.geometry, {
        style: { color, weight: 2.5, dashArray: '6 6', fillColor: color, fillOpacity: a.example ? 0.3 : 0.22 },
      })
        .bindPopup(label)
        .addTo(g);
    }
  }, [alerts]);

  useEffect(() => {
    const g = layers.current.fires;
    if (!g) return;
    g.clearLayers();
    for (const f of fires || []) {
      const level = fireLevel(f.confidence);
      const color = FIRE_COLORS[level];
      const popup =
        `<b>Check here: ${(f.label || FIRE_LABEL[level]).toLowerCase()}</b><br>` +
        `Detected by NASA satellites ${f.acquired ? f.acquired.replace('T', ' at ').replace('Z', ' UTC') : ''}. ` +
        'Animals may be displaced or burned nearby. This is not a confirmed sighting.';
      // Translucent zone (true size on the ground) plus a solid dot that stays visible when zoomed out.
      L.circle([f.lat, f.lng], { radius: FIRE_ZONE_M, color, weight: 2, fillColor: color, fillOpacity: 0.3 })
        .bindPopup(popup)
        .addTo(g);
      L.circleMarker([f.lat, f.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 })
        .bindPopup(popup)
        .addTo(g);
    }
  }, [fires]);

  useEffect(() => {
    const g = layers.current.reports;
    if (!g) return;
    g.clearLayers();
    for (const r of reports || []) {
      const size = PIN_SIZE[r.urgency] || PIN_SIZE.medium;
      const color = REPORT_COLORS[r.urgency] || REPORT_COLORS.medium;
      // Blue diamonds, so reports never blend into the warm fire and heat colours.
      const marker = L.marker([r.lat, r.lng], {
        icon: L.divIcon({
          className: 'report-pin',
          iconSize: [size, size],
          html: `<span style="background:${color}"></span>`,
        }),
      });
      const div = document.createElement('div');
      div.textContent = `${r.species || 'Animal'}, ${r.urgency || 'unknown'} urgency, ${r.status}${r.near_fire ? ', near recent fire' : ''}`;
      marker.bindPopup(div).addTo(g);
    }
  }, [reports]);

  useEffect(() => {
    const g = layers.current.extra;
    if (!g) return;
    g.clearLayers();
    if (radius) {
      L.circle([radius.lat, radius.lng], {
        radius: radius.km * 1000,
        color: '#1f5c3f',
        weight: 1,
        fillOpacity: 0.06,
      }).addTo(g);
    }
    if (pin) {
      L.circleMarker([pin.lat, pin.lng], {
        radius: 11,
        color: '#fff',
        weight: 3,
        fillColor: '#1565c0',
        fillOpacity: 1,
      }).addTo(g);
    }
  }, [pin?.lat, pin?.lng, radius?.lat, radius?.lng, radius?.km]);

  useEffect(() => {
    if (!map.current || !heatDate) return;
    const heat = L.tileLayer(HEAT_URL(heatDate), {
      opacity: 0.62,
      maxNativeZoom: 7,
      maxZoom: 19,
      attribution: 'NASA GIBS',
    }).addTo(map.current);
    return () => heat.remove();
  }, [heatDate]);

  // Rain rate from NASA's GPM satellites (IMERG). `rain` is the image time to
  // show, as found by lib/rain.js, or null for off.
  useEffect(() => {
    if (!map.current || !rain) return;
    const layer = L.tileLayer(rainTileUrl(rain), {
      opacity: 0.75,
      maxNativeZoom: 6,
      maxZoom: 19,
      attribution: 'NASA GPM IMERG',
    }).addTo(map.current);
    return () => layer.remove();
  }, [rain]);

  return <div ref={el} className="map" style={{ height }} />;
}

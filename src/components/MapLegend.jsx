// The key for the map. Colours here must match MapView.jsx.
// Heat colours and temperatures come from NASA's own colour table for the
// MODIS land surface temperature layer (converted from kelvin, rounded).
import { HAZARDS } from '../lib/hazards.js';

export const FIRE_COLORS = { h: '#c2185b', n: '#f4511e', l: '#ffb300' };
export const REPORT_COLORS = { high: '#1a237e', medium: '#3b4fd1', low: '#8c9eff' };

const HEAT_STOPS = [
  { f: 25, rgb: '58,255,120' },
  { f: 50, rgb: '142,255,0' },
  { f: 70, rgb: '230,255,0' },
  { f: 95, rgb: '255,211,0' },
  { f: 120, rgb: '255,139,0' },
  { f: 145, rgb: '255,70,0' },
];

export default function MapLegend({ heat = false, radius = false, alerts = [], roads = false, rain = false, fireMode = 'live' }) {
  const alertKinds = [...new Set(alerts.filter((a) => a.geometry).map((a) => a.category))];
  return (
    <div className="legend" aria-label="Map key">
      <p className="legend-title">Map key</p>

      {/* Layers the person just switched on come first, right under the map. */}
      {heat && (
        <div className="legend-group">
          <p className="legend-head">Ground temperature (hotter than the air on sunny days)</p>
          <div
            className="heat-bar"
            style={{ background: `linear-gradient(to right, ${HEAT_STOPS.map((s) => `rgb(${s.rgb})`).join(', ')})` }}
          />
          <div className="heat-labels">
            {HEAT_STOPS.map((s) => <span key={s.f}>{s.f}°F</span>)}
          </div>
          <p className="fine">Orange and red mark the hottest ground. Blank patches are clouds.</p>
        </div>
      )}
      {rain && (
        <div className="legend-group">
          <p className="legend-head">Rain (NASA GPM satellites)</p>
          <div className="rain-bar" />
          <div className="heat-labels"><span>Light rain</span><span>Moderate</span><span>Heavy rain</span></div>
          <p className="fine">
            Green is light rain, yellow is moderate and red is heavy. Blue and purple are snow.
            Heavy rain can flood nests, burrows and dens. The image is several hours old, not live radar.
          </p>
        </div>
      )}


      <div className="legend-group">
        <p className="legend-head">Fires seen by NASA satellites: check these areas</p>
        {fireMode === 'history' ? (
          <ul>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.h }} /> Seen by both satellites (MODIS and VIIRS)</li>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.n }} /> Seen by VIIRS only</li>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.l }} /> Seen by MODIS only</li>
          </ul>
        ) : (
          <ul>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.h }} /> Almost certainly a fire</li>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.n }} /> Probably a fire</li>
            <li><span className="swatch fire" style={{ background: FIRE_COLORS.l }} /> Possibly a fire</li>
          </ul>
        )}
        <p className="fine">Each circle is about 2.5 miles across, centred on the fire. Tap one for the date.</p>
      </div>

      <div className="legend-group">
        <p className="legend-head">Animals reported by finders</p>
        <ul>
          <li><span className="swatch pin big" style={{ background: REPORT_COLORS.high }} /> High urgency</li>
          <li><span className="swatch pin" style={{ background: REPORT_COLORS.medium }} /> Medium urgency</li>
          <li><span className="swatch pin small" style={{ background: REPORT_COLORS.low }} /> Low urgency</li>
        </ul>
      </div>

      {roads && (
        <div className="legend-group">
          <p className="legend-head">Road danger spots</p>
          <ul>
            <li>
              <span className="swatch road"><b>3</b></span>
              A place where 2 or more animals hit by vehicles were reported within about a quarter mile. The number is how many.
            </li>
          </ul>
        </div>
      )}

      {alertKinds.length > 0 && (
        <div className="legend-group">
          <p className="legend-head">Weather alert areas (shaded, dashed outline)</p>
          <ul>
            {alertKinds.map((k) => (
              <li key={k}><span className="swatch zone" style={{ borderColor: HAZARDS[k].color, background: `${HAZARDS[k].color}22` }} /> {HAZARDS[k].icon} {HAZARDS[k].label}</li>
            ))}
          </ul>
        </div>
      )}

      {radius && (
        <div className="legend-group">
          <ul>
            <li><span className="swatch area" /> Your pickup area</li>
          </ul>
        </div>
      )}

    </div>
  );
}

# CritterLift

**Found a wild animal? Take a photo. CritterLift tells you whether it needs help, and if it does, gets it a ride to a rehabber.**

Built at RiverHacks 2026 by Pedro Neves. It is a mobile web app: no install, opens from a link or QR code.

![CritterLift logo](public/logo.svg)

## The problem

People who find a baby bird or an injured turtle usually guess what to do. Many healthy young animals get "rescued" when they should be left alone, and animals that are hurt wait while the finder makes phone calls. Fires, freezes, floods and heat make it worse, and nobody tells volunteers where to look.

## What it does

**For someone who finds an animal**

- Take a photo. Google Lens (through SerpApi) suggests the species, and Gemini looks at the photo and decides: **Leave it**, **Watch it**, or **Needs help now**.
- Low-confidence answers say "Not sure. Call a rehabber" instead of guessing.
- If it needs help, a pop-up offers who to contact: nearby volunteers (in the app), Austin Wildlife Rescue, or Austin Animal Services through 3-1-1, with call buttons and a ready-made message.
- Drop a map pin and send a report. The finder then watches the status change as a volunteer accepts, picks up and delivers.

**For volunteers**

- Sign up once with a home area, a pickup radius and the animals you can handle.
- Get a live alert when a matching report lands in your area, plus alerts for new fires and weather warnings there.
- Accept, mark picked up, mark delivered.

**Where to look (Risk map)**

- Recent fires from NASA satellites, colour-coded by confidence.
- Ground temperature and rain layers from NASA.
- Live National Weather Service alerts for freezes, heat, floods, storms and fire weather, each with what it means for wildlife.
- Road danger spots: places where several animals hit by vehicles were reported, with a drafted request to ask the City of Austin for a wildlife crossing sign.
- A map key that explains every colour.

**Fire calendar (NASA Space Apps challenge)**

- A burning-activity calendar that puts NASA's two fire records, MODIS and VIIRS, on one scale. See below.

## NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots

The challenge asks for a web app that harmonizes the two sensors' fire records into a burning activity calendar, so people can study historical patterns, unusual conditions and critical periods in a chosen area.

MODIS sees fire in 1 km pixels and VIIRS in 375 m pixels. One fire that MODIS reports once can appear as several VIIRS detections, and VIIRS catches small fires MODIS misses, so raw counts can't be compared or added.

What CritterLift does (code in `src/lib/fireCalendar.js`):

1. Drops low-confidence detections from both sensors.
2. Snaps every detection to the same 0.01 degree grid (about 1 km) and counts **burning cells per day**. Several VIIRS pixels in one cell count once, like one MODIS pixel.
3. Over the days both sensors recorded, measures how many burning cells VIIRS sees per MODIS cell. On days with only MODIS, its cells are scaled by that ratio, so the whole calendar reads in the same units.
4. Flags unusual days: those well above normal for the same calendar month in the other years on record.
5. Ranks the months to show critical periods.

The page shows the working: the VIIRS-to-MODIS ratio before and after gridding, how often the two agree, and the scaling factor used.

How it serves the rescue mission: the busiest months tell volunteers when they are most likely to be needed, and a volunteer can set their own pickup area as the area of interest.

Limits, stated on the page too: a hot spot is a satellite observation, not a count of fires; the harmonization is one ratio, not a full cross-calibration; and it describes the past, it does not forecast.

## Data sources

| Data | Source | Used for |
|---|---|---|
| Active fire hot spots (MODIS, VIIRS) | NASA FIRMS | Live fire zones, fire alerts, the fire calendar |
| Land surface temperature (MODIS) | NASA GIBS | Heat layer |
| Rain rate (GPM IMERG) | NASA GIBS | Rain layer |
| Weather alerts | U.S. National Weather Service | Freeze, heat, flood, storm and fire-weather cards |
| Species suggestions | Google Lens through SerpApi | Photo identification |
| Photo triage | Google Gemini | Verdict, urgency, first steps |
| Map tiles | OpenStreetMap | Base map |
| Rescue contacts | City of Austin, Texas Parks and Wildlife | Phone numbers in the help pop-up |
| Photos | U.S. Fish and Wildlife Service (public domain) | Home screen |

## How it's built

- **Frontend:** React and Vite, Leaflet for maps.
- **Server functions:** Vercel serverless functions in `api/`, which keep the keys off the phone.
- **Database, photo storage, live updates:** Supabase.

| Path | What |
|---|---|
| `api/triage.js` | Lens plus Gemini photo triage |
| `api/fires.js` | NASA FIRMS proxy with a 30 minute cache |
| `api/alerts.js` | National Weather Service alerts for a point |
| `scripts/build-fire-calendar.mjs` | Downloads the MODIS and VIIRS record and builds the calendar data |
| `src/pages/Finder.jsx` | Photo, verdict, help pop-up, report, live status |
| `src/pages/Volunteer.jsx` | Sign-up, live list and map, alerts |
| `src/pages/RiskMap.jsx` | Fires, heat, rain, weather alerts, road danger spots |
| `src/pages/FireCalendar.jsx` | The harmonized burning-activity calendar |
| `src/lib/fireCalendar.js` | The harmonization method |
| `src/lib/geo.js`, `roads.js`, `hazards.js` | Matching, road spots, hazard guidance |

## Run it yourself

You need Node.js and free accounts with Supabase, Google AI Studio, SerpApi and NASA FIRMS.

1. **Database:** create a Supabase project, open the SQL Editor, paste `supabase/schema.sql` and run it.
2. **Keys:** copy `.env.example` to `.env.local` and fill in all five values.
3. **Install:**
   ```
   npm install
   npm install -g vercel
   ```
4. **Build the fire calendar** (a few minutes; it waits if NASA rate-limits the key and resumes if stopped):
   ```
   npm run fire-calendar
   ```
5. **Start:**
   ```
   vercel dev
   ```
   Open `http://localhost:3000`. If asked to pull environment variables into `.env.local`, answer no.
6. **Deploy:** `vercel --prod`, then add the same five variables under the Vercel project's Environment Variables and redeploy. Phones need the deployed HTTPS address for the camera and location.

On Windows, turn on Developer Mode first (Settings, System, For developers), or `vercel dev` fails with a symlink error.

## Demo in three minutes

1. Open the app on two phones: A is the finder, B is on the Volunteer tab.
2. Risk map: fires, weather alerts and the map key. Fire calendar: unusual days and busiest months.
3. Phone A: photo of a healthy fledgling. Verdict: leave it.
4. Phone A: photo of an injured animal. The help pop-up appears; choose "Alert nearby volunteers", drop the pin, send.
5. Phone B: the alert appears. Accept, pick up, deliver, and watch phone A's status change.

## Known limits

- Alerts only arrive while the Volunteer page is open.
- The database is open to anyone with the link, for the demo only. Photos are stored at public links.
- The rehab list (`supabase/seed_rehabs.sql`) must be filled in from the Texas Parks and Wildlife list; until then reports show no matching rehab.
- Road danger spots come only from this app's own reports.
- Volunteers are not verified.

## What's next

- Partner with licensed rehabbers to verify volunteers and review the guidance.
- Put rescue reports on the fire calendar to show how reports change around unusual fire days.
- Push notifications with the page closed, and a Spanish version.
- Expand beyond Austin.

## Credits

Fire, temperature and rain data courtesy of NASA (FIRMS, GIBS, GPM). Weather alerts from the U.S. National Weather Service. Photos from the U.S. Fish and Wildlife Service media library, public domain: Aubry Buzek/USFWS, Courtney Celley/USFWS, Samantha Little/Audubon Center for Birds of Prey. Map data from OpenStreetMap contributors.

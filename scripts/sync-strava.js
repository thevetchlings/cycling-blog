// Pulls new rides from Strava and merges them into strava-rides.json.
// Run locally with env vars set, or via the GitHub Actions workflow
// (.github/workflows/sync-strava.yml) which supplies them from secrets.
//
// Requires Node 18+ (built-in fetch).

const fs = require('fs');
const path = require('path');

const RIDES_FILE = path.join(__dirname, '..', 'strava-rides.json');

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

// Which Strava activity types count as "a ride" for this log.
const RIDE_TYPES = new Set([
  'Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'VirtualRide'
]);

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadExisting() {
  if (!fs.existsSync(RIDES_FILE)) {
    return { last_synced: 0, rides: [] };
  }
  return JSON.parse(fs.readFileSync(RIDES_FILE, 'utf8'));
}

async function getAccessToken() {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN
    })
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function fetchActivitiesSince(accessToken, afterEpoch) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Activity fetch failed: ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return all;
}

function toEntry(activity) {
  return {
    id: activity.id,
    type: 'ride',
    date: activity.start_date_local.slice(0, 10),
    title: activity.name,
    body: [],
    stats: {
      distance: `${(activity.distance / 1000).toFixed(1)} km`,
      elevation: `${Math.round(activity.total_elevation_gain)} m`,
      time: formatDuration(activity.moving_time)
    },
    strava_url: `https://www.strava.com/activities/${activity.id}`
  };
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN env vars.');
    process.exit(1);
  }

  const existing = loadExisting();
  const accessToken = await getAccessToken();
  const activities = await fetchActivitiesSince(accessToken, existing.last_synced || 0);

  const rides = activities
    .filter(a => RIDE_TYPES.has(a.type) || RIDE_TYPES.has(a.sport_type))
    .map(toEntry);

  const existingIds = new Set(existing.rides.map(r => r.id));
  const newRides = rides.filter(r => !existingIds.has(r.id));

  const merged = {
    last_synced: Math.floor(Date.now() / 1000),
    rides: [...existing.rides, ...newRides]
  };

  fs.writeFileSync(RIDES_FILE, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Synced. ${newRides.length} new ride(s) added, ${merged.rides.length} total.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

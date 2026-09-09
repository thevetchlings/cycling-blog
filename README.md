# Waypoints — your riding & life log

A tiny static site. No build step, no server, no database — just three files that
work together: `index.html`, `style.css`, `app.js`, and a `posts.json` file that
holds all your entries.

## Adding a new entry

Open `posts.json` in any text editor and add a new block to the array (copy an
existing one as a starting point). Fields:

- `type`: `"ride"` or `"life"`
- `date`: `"YYYY-MM-DD"`
- `title`: short title
- `body`: an array of paragraph strings
- `stats` (rides only, optional): `{ "distance": "42 km", "elevation": "380 m", "time": "1h 48m" }`
- `strava_embed_url` (optional): see below
- `komoot_url` (optional): a link to a public Komoot tour

Entries sort by date automatically — newest first — so you don't need to worry
about ordering.

## Adding a Strava ride

Strava doesn't require login for this — every public activity has a free embed
widget:

1. Open the activity on strava.com (desktop web, not the app)
2. Click the **share** icon on the activity → **Embed**
3. Strava gives you an `<iframe>` snippet. Copy just the `src="..."` URL from
   inside it
4. Paste that URL as the `strava_embed_url` value for that entry

This shows the map, splits, and stats right in the post. No account
connection or API keys needed.

## Auto-syncing all your Strava rides

This site can pull in every new ride automatically, no manual copy-pasting.
It works via a script (`scripts/sync-strava.js`) that runs once a day for
free using GitHub Actions, and writes results to `strava-rides.json` — a
separate file from `posts.json`, so your own manual entries are never
touched or overwritten.

This only works if the site is on GitHub (Netlify Drop can't run scheduled
scripts). One-time setup, about 10 minutes:

**1. Create a Strava API application**
- Go to https://www.strava.com/settings/api and create an app (any name,
  website can be anything, e.g. `http://localhost`)
- Note the **Client ID** and **Client Secret** shown there

**2. Get a refresh token (one-time, via your browser + terminal)**
- Visit this URL in your browser, replacing `YOUR_CLIENT_ID`:
  ```
  https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
  ```
- Click Authorize. You'll land on a `localhost` page that fails to load —
  that's fine, copy the `code=...` value out of the browser's address bar
- Exchange it for a refresh token by running this in a terminal (replace the
  three placeholders):
  ```
  curl -X POST https://www.strava.com/oauth/token \
    -d client_id=YOUR_CLIENT_ID \
    -d client_secret=YOUR_CLIENT_SECRET \
    -d code=YOUR_CODE \
    -d grant_type=authorization_code
  ```
- The response includes a `refresh_token` — save it

**3. Push this project to a GitHub repo** (if you haven't already)

**4. Add three repo secrets**
In the repo: Settings → Secrets and variables → Actions → New repository
secret. Add:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

**5. Done**
The workflow in `.github/workflows/sync-strava.yml` runs daily at 06:00 UTC
and can also be triggered any time from the repo's **Actions** tab → "Sync
Strava rides" → **Run workflow**. Each run fetches anything new since the
last sync, appends it to `strava-rides.json`, and commits it — which
triggers GitHub Pages to redeploy automatically.

Only cycling activity types are pulled in (Ride, Gravel, MTB, E-bike,
Virtual) — runs, walks, etc. are ignored. Each synced ride shows distance,
elevation, time, and a link back to the activity on Strava (the API doesn't
expose the map-embed widget, only a plain link — you can still add the full
embed by hand for any ride via `strava_embed_url` in `posts.json`).

Don't hand-edit `strava-rides.json` — it gets overwritten on every sync. Use
`posts.json` for anything you want to write or adjust yourself.

## Adding a Komoot route

Komoot doesn't offer the same embeddable widget for individuals, so the
simplest reliable option is linking out: copy the public URL of your tour and
paste it as `komoot_url`. It'll show as a "View route on Komoot" link on the
entry.

## Previewing locally

Because the page loads `posts.json` via `fetch`, opening `index.html` directly
from disk won't work in most browsers (they block local file fetches). Run a
tiny local server instead, from inside this folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Publishing it for free

Easiest option — **Netlify Drop**:
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page
3. You get a live URL immediately (e.g. `yoursite.netlify.app`)
4. To update later, just drag the folder again after editing `posts.json`

Alternative — **GitHub Pages** (better if you want version history of your
posts over time):
1. Create a new GitHub repository and upload these files
2. In the repo's Settings → Pages, set the source to the main branch
3. Your site appears at `yourusername.github.io/reponame`

Either way, a custom domain (yoursite.com) can be pointed at it later for
about £10–12/year from a registrar like Namecheap or Cloudflare — no code
changes needed.

## Customizing

- Colors and fonts live at the top of `style.css` (see the `:root` block)
- The wordmark and subtitle text are in `index.html`

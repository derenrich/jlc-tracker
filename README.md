# jlc-tracker

Price history for JLCPCB assembly parts, in the spirit of camelcamelcamel: paste a part
number or an LCSC / JLCPCB product URL, get a price graph.

Tracks the **basic + preferred extended** libraries (~1,600 parts — the set shown on
[jlcpcb.com/parts/basic_parts](https://jlcpcb.com/parts/basic_parts)). The full extended
library is >7M parts, which doesn't fit a daily snapshot on a free tier.

## How it works

- **Ingest** ([ingest/src/ingest.mjs](ingest/src/ingest.mjs)) — fetches all pages from
  JLCPCB's parts-search API, archives the raw responses to `data/raw/YYYY-MM-DD.json.br`
  (so other fields can be extracted later), and upserts Firestore. The archive is
  brotli-compressed (`brotli -d` or Node's `zlib` to read) with one lossy exception:
  query strings are stripped from signed OSS URLs, which expire ~30 minutes after
  fetch and would otherwise be half the archive's bytes.
- **Cron** — a GitHub Actions workflow ([.github/workflows/ingest.yml](.github/workflows/ingest.yml))
  runs the ingest daily and commits the raw archive. Firebase's Spark plan has no Cloud
  Functions/Scheduler, so this keeps the whole thing at $0.
- **Web** ([web/](web/)) — Vite + React on Firebase Hosting, reading Firestore directly
  from the browser (public read-only rules).
- **Deploys** — pushes to `main` that touch `web/` or the Firebase config redeploy
  hosting and rules automatically ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)),
  reusing the same `FIREBASE_SERVICE_ACCOUNT` secret as the ingest.

### Firestore layout

| Document | Contents |
| --- | --- |
| `parts/{code}` | Latest snapshot: name, brand, category, package, stock, price breaks, attributes, links, inline thumbnail |
| `parts/{code}/history/{year}` | `entries: [{d, p, s}]` — date, unit price (lowest qty break, USD), stock |
| `meta/status` | Last run date and part count |

One doc read loads a part, one or two more load its whole graph. A daily run costs
~1.6k reads + ~3.2k writes, comfortably inside the Spark quota (50k reads / 20k
writes per day). Part images sit behind expiring signed URLs, so thumbnails (~3.5&nbsp;KB)
are downloaded once at ingest and stored inline on the part doc.

## Collecting before launch

The ingest runs archive-only when no Firebase credentials are configured, so data
collection can start before the site (or the Firebase project) exists:

1. Push this repo to GitHub. The daily workflow needs no secrets to collect — it
   archives a snapshot to `data/raw/` and commits it.
2. Whenever you're ready to launch, do the Firebase setup below, then replay the
   accumulated archives into Firestore:

   ```sh
   cd ingest && npm run backfill
   ```

   Backfill assembles each part's full history locally and writes it in one shot
   (~3k writes total, regardless of how many days were collected). Part images
   can't be recovered from archives — their URLs expire — so the next daily
   ingest run downloads any that are missing.

## Setup

1. Create a Firebase project (Spark plan is fine). Enable **Firestore** and **Hosting**,
   and register a **web app**.
2. Put your project id in [.firebaserc](.firebaserc), then deploy the rules:
   `firebase deploy --only firestore:rules`
3. Web app config: `cp web/.env.example web/.env.local` and fill in the values from the
   Firebase console.
4. Service account for the ingest: Firebase console → project settings → service
   accounts → generate new private key.
5. First run, locally:

   ```sh
   cd ingest && npm install
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run ingest
   ```

   (`npm run ingest:dry` fetches and archives without touching Firestore.)
6. Build and deploy the site:

   ```sh
   cd web && npm install && npm run build
   firebase deploy --only hosting
   ```

7. Cron: push this repo to GitHub and add the service-account JSON as a repository
   secret named `FIREBASE_SERVICE_ACCOUNT`. The workflow runs daily at 02:47 UTC and
   can be triggered manually from the Actions tab. (Without the secret it still runs,
   archive-only — see above.)

## Notes

- The ingest query lives in `DEFAULT_QUERY` in [ingest/src/jlc.mjs](ingest/src/jlc.mjs);
  widen it there if you ever want a different slice of the catalog (mind the write quota).
- `run.sh` / `run.json` at the repo root are the original captured API call and sample
  response the project was built from.

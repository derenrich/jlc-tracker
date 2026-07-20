// Daily snapshot of JLCPCB basic / preferred-extended parts.
//
//   node src/ingest.mjs             fetch, archive raw JSON, write Firestore
//   node src/ingest.mjs --dry-run   fetch and archive only (no credentials needed)
//
// Credentials: set FIREBASE_SERVICE_ACCOUNT to the service-account JSON
// itself, or GOOGLE_APPLICATION_CREDENTIALS to a path to it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

import { computeIndexSeries } from './index-series.mjs';
import { DEFAULT_QUERY, fetchAllComponents, fetchImageDataUri } from './jlc.mjs';
import { historyEntry, partDoc } from './part-doc.mjs';

const dryRun = process.argv.includes('--dry-run');
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const today = new Date().toISOString().slice(0, 10); // UTC

function log(msg) {
  console.log(`[ingest] ${msg}`);
}

// --- fetch ---------------------------------------------------------------

const { pages, components } = await fetchAllComponents(DEFAULT_QUERY, { log });
log(`fetched ${components.length} components`);
if (components.length < 100) {
  throw new Error(`suspiciously few components (${components.length}); aborting before overwriting anything`);
}

// --- raw archive ---------------------------------------------------------

// Signed OSS URLs (images, datasheets) expire ~30 minutes after fetch, so
// their token query strings are dead weight in an archive — and being
// high-entropy they dominate its compressed size. Keep just the path, which
// still identifies the file.
function stripSignedUrls(value) {
  if (typeof value === 'string') {
    return /[?&]x-oss-/.test(value) ? value.split('?')[0] : value;
  }
  if (Array.isArray(value)) return value.map(stripSignedUrls);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripSignedUrls(v)]));
  }
  return value;
}

const rawDir = join(repoRoot, 'data', 'raw');
mkdirSync(rawDir, { recursive: true });
const rawPath = join(rawDir, `${today}.json.br`);
const archiveJson = JSON.stringify({
  fetchedAt: new Date().toISOString(),
  query: DEFAULT_QUERY,
  pages: stripSignedUrls(pages),
});
writeFileSync(
  rawPath,
  brotliCompressSync(archiveJson, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(archiveJson),
    },
  })
);
log(`archived raw responses to ${rawPath}`);

if (dryRun) {
  log('dry run: skipping Firestore writes');
  process.exit(0);
}

// No credentials → archive-only mode. This lets the daily cron collect data
// before the Firebase project exists; run backfill.mjs once it does.
if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  log('no Firebase credentials configured: archive-only run, skipping Firestore writes');
  process.exit(0);
}

// --- firestore -----------------------------------------------------------

const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = process.env.FIREBASE_SERVICE_ACCOUNT
  ? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
  : initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

// One read pass over existing docs so part images (behind expiring signed
// URLs, so stored inline once) are only downloaded when missing.
const partRefs = components.map((c) => db.collection('parts').doc(c.componentCode));
const existing = new Map();
for (let i = 0; i < partRefs.length; i += 300) {
  const snaps = await db.getAll(...partRefs.slice(i, i + 300), { fieldMask: ['image'] });
  for (const snap of snaps) existing.set(snap.id, snap.exists ? snap.data() : null);
}

const needImage = components.filter((c) => !existing.get(c.componentCode)?.image);
log(`${needImage.length} parts need an image`);
const images = new Map();
for (let i = 0; i < needImage.length; i += 8) {
  const batch = needImage.slice(i, i + 8);
  const results = await Promise.all(batch.map((c) => fetchImageDataUri(c.minImageAccessIdUrl)));
  batch.forEach((c, j) => results[j] && images.set(c.componentCode, results[j]));
}
log(`downloaded ${images.size} images`);

const year = today.slice(0, 4);
const writer = db.bulkWriter();
for (const item of components) {
  const ref = db.collection('parts').doc(item.componentCode);
  const doc = partDoc(item, today);
  const image = images.get(item.componentCode);
  if (image) doc.image = image;
  writer.set(ref, doc, { merge: true });

  writer.set(
    ref.collection('history').doc(year),
    { entries: FieldValue.arrayUnion(historyEntry(item, today)) },
    { merge: true }
  );
}
// The overall price index is recomputed from all archives (this run's
// snapshot included) — needs an up-to-date data/raw, which the CI checkout
// always has.
const indexSeries = computeIndexSeries(rawDir);
writer.set(db.collection('meta').doc('index'), { entries: indexSeries });

writer.set(db.collection('meta').doc('status'), {
  lastRun: new Date().toISOString(),
  date: today,
  partCount: components.length,
});
await writer.close();
log(`wrote ${components.length} parts + history + ${indexSeries.length}-day index for ${today}`);

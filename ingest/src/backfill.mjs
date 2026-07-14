// Rebuilds Firestore from the raw archives in data/raw — for when collection
// ran archive-only for a while before the Firebase project existed.
//
//   node src/backfill.mjs             read all archives, write Firestore
//   node src/backfill.mjs --dry-run   just report what would be written
//
// History docs are assembled locally and written whole, so a backfill costs
// ~2 writes per part regardless of how many days were collected. History
// docs are replaced (deterministic rebuild); part docs are merged so images
// already fetched by a daily ingest survive. Images themselves can't be
// backfilled — archived image URLs are expired — so the next daily ingest
// fills in any that are missing.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { historyEntry, partDoc } from './part-doc.mjs';

const dryRun = process.argv.includes('--dry-run');
const rawDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'raw');

function log(msg) {
  console.log(`[backfill] ${msg}`);
}

const files = readdirSync(rawDir)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.(br|gz)$/.test(f))
  .sort(); // filename sort == date order
if (files.length === 0) throw new Error(`no archives found in ${rawDir}`);
log(`${files.length} archives: ${files[0]} … ${files[files.length - 1]}`);

// parts: code -> { latestItem, latestDate, entriesByYear: year -> Map(date -> entry) }
const parts = new Map();
for (const file of files) {
  const date = file.slice(0, 10);
  const buf = readFileSync(join(rawDir, file));
  const archive = JSON.parse(file.endsWith('.br') ? brotliDecompressSync(buf) : gunzipSync(buf));
  const seen = new Set();
  for (const page of archive.pages) {
    for (const item of page.data.componentPageInfo.list) {
      const code = item.componentCode;
      if (seen.has(code)) continue;
      seen.add(code);
      let part = parts.get(code);
      if (!part) parts.set(code, (part = { entriesByYear: new Map() }));
      part.latestItem = item;
      part.latestDate = date;
      const year = date.slice(0, 4);
      if (!part.entriesByYear.has(year)) part.entriesByYear.set(year, new Map());
      part.entriesByYear.get(year).set(date, historyEntry(item, date));
    }
  }
  log(`${file}: ${seen.size} parts`);
}

const historyDocCount = [...parts.values()].reduce((n, p) => n + p.entriesByYear.size, 0);
log(`${parts.size} parts, ${historyDocCount} history docs to write`);

if (dryRun) {
  const sample = parts.get([...parts.keys()][0]);
  log(`dry run: sample part doc:\n${JSON.stringify(partDoc(sample.latestItem, sample.latestDate), null, 2)}`);
  const sampleYear = [...sample.entriesByYear.values()][0];
  log(`dry run: sample history entries: ${JSON.stringify([...sampleYear.values()].slice(0, 3))}`);
  process.exit(0);
}

const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

const app = process.env.FIREBASE_SERVICE_ACCOUNT
  ? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
  : initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

const latestDate = files[files.length - 1].slice(0, 10);
const writer = db.bulkWriter();
for (const [code, part] of parts) {
  const ref = db.collection('parts').doc(code);
  writer.set(ref, partDoc(part.latestItem, part.latestDate), { merge: true });
  for (const [year, byDate] of part.entriesByYear) {
    writer.set(ref.collection('history').doc(year), { entries: [...byDate.values()] });
  }
}
writer.set(db.collection('meta').doc('status'), {
  lastRun: new Date().toISOString(),
  date: latestDate,
  partCount: [...parts.values()].filter((p) => p.latestDate === latestDate).length,
});
await writer.close();
log(`backfilled ${parts.size} parts from ${files.length} archives`);

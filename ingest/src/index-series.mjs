// Builds the overall price-index series from the raw archives.
//
// The index is an equal-weighted geometric mean of day-over-day unit-price
// ratios (a chained Jevons index, as used for CPI elementary aggregates),
// based at 100 on the first tracked day. Chaining means parts that enter or
// leave the catalog don't jump the index — each day only compares parts
// present on both days.
//
// Recomputed from scratch on every run (a few seconds even for years of
// archives) and written to the single doc meta/index, so the whole series
// costs one document read.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { tierPrices } from './part-doc.mjs';

function median(sortedValues) {
  const n = sortedValues.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

export function computeIndexSeries(rawDir) {
  const files = readdirSync(rawDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.(br|gz)$/.test(f))
    .sort();

  const series = [];
  let prevPrices = null;
  let index = 100;

  for (const file of files) {
    const date = file.slice(0, 10);
    const buf = readFileSync(join(rawDir, file));
    const archive = JSON.parse(file.endsWith('.br') ? brotliDecompressSync(buf) : gunzipSync(buf));

    const prices = new Map(); // code -> unit price at lowest qty break
    let stock = 0;
    for (const page of archive.pages) {
      for (const item of page.data.componentPageInfo.list) {
        const code = item.componentCode;
        if (prices.has(code) || code === undefined) continue;
        const p = tierPrices(item)[0]?.price;
        prices.set(code, p > 0 ? p : null);
        stock += item.stockCount ?? 0;
      }
    }

    if (prevPrices) {
      let logSum = 0;
      let n = 0;
      for (const [code, p] of prices) {
        const q = prevPrices.get(code);
        if (p > 0 && q > 0) {
          logSum += Math.log(p / q);
          n++;
        }
      }
      if (n > 0) index *= Math.exp(logSum / n);
    }

    const priced = [...prices.values()].filter((p) => p > 0).sort((a, b) => a - b);
    series.push({
      d: date,
      i: Number(index.toFixed(3)),
      m: Number(median(priced)?.toFixed(6) ?? 0) || null,
      n: prices.size,
      s: stock,
    });
    prevPrices = prices;
  }

  return series;
}

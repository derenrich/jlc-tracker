import { collection, doc, getDoc, getDocs } from 'firebase/firestore/lite';
import { getDb } from '../firebase';

const DEMO = import.meta.env.VITE_DEMO === '1';

export interface PriceTier {
  qty: number;
  price: number;
}

export interface Part {
  code: string;
  model: string;
  brand: string;
  description: string;
  category: string;
  subcategory: string;
  package: string;
  libraryType: 'base' | 'expand';
  stock: number;
  minOrder: number;
  prices: PriceTier[];
  attributes: { name: string; value: string }[];
  lcscUrl: string;
  jlcUrl: string;
  datasheetUrl: string;
  image?: string;
  updatedAt: string;
}

export interface HistoryPoint {
  d: string; // YYYY-MM-DD
  p: number | null; // unit price (lowest qty tier), USD
  s: number; // stock
}

export interface Status {
  date: string;
  partCount: number;
}

// One day of the overall price index (see ingest/src/index-series.mjs):
// chained equal-weighted geometric index (100 = first tracked day), median
// unit price, part count, total stock.
export interface IndexPoint {
  d: string;
  i: number;
  m: number | null;
  n: number;
  s: number;
}

export async function getPart(code: string): Promise<Part | null> {
  if (DEMO) return (await import('./demo')).getDemoPart(code);
  const snap = await getDoc(doc(getDb(), 'parts', code));
  return snap.exists() ? (snap.data() as Part) : null;
}

// History is stored one doc per year; entries may contain multiple points for
// a date if both price and stock changed intra-day — keep the latest.
export async function getHistory(code: string): Promise<HistoryPoint[]> {
  if (DEMO) return (await import('./demo')).getDemoHistory(code);
  const snap = await getDocs(collection(getDb(), 'parts', code, 'history'));
  const byDate = new Map<string, HistoryPoint>();
  for (const yearDoc of snap.docs) {
    for (const entry of (yearDoc.data().entries ?? []) as HistoryPoint[]) {
      byDate.set(entry.d, entry);
    }
  }
  return [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d));
}

export async function getIndexSeries(): Promise<IndexPoint[]> {
  if (DEMO) return (await import('./demo')).getDemoIndexSeries();
  const snap = await getDoc(doc(getDb(), 'meta', 'index'));
  const entries = (snap.data()?.entries ?? []) as IndexPoint[];
  return entries.sort((a, b) => a.d.localeCompare(b.d));
}

export async function getStatus(): Promise<Status | null> {
  if (DEMO) return (await import('./demo')).getDemoStatus();
  const snap = await getDoc(doc(getDb(), 'meta', 'status'));
  return snap.exists() ? (snap.data() as Status) : null;
}

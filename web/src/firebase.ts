import { FirebaseApp, initializeApp } from 'firebase/app';
// The lite client only does one-shot reads — all this app needs — and is a
// fraction of the size of the full realtime SDK.
import { Firestore, getFirestore } from 'firebase/firestore/lite';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

// Lazy so demo mode (VITE_DEMO=1) never needs Firebase config. Values come
// from web/.env.local (see .env.example); all of them are public identifiers —
// access control lives in firestore.rules.
function getApp(): FirebaseApp {
  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    });
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getApp());
  return db;
}

// Google Analytics, only when a measurement id is configured (it isn't in
// demo mode or local dev). Loaded dynamically so the GA code stays out of the
// main bundle. page_view events for route changes are auto-collected.
export function initAnalytics(): void {
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return;
  import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) getAnalytics(getApp());
    })
    .catch(() => {});
}

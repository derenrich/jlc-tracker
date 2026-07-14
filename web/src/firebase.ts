import { initializeApp } from 'firebase/app';
// The lite client only does one-shot reads — all this app needs — and is a
// fraction of the size of the full realtime SDK.
import { Firestore, getFirestore } from 'firebase/firestore/lite';

let db: Firestore | undefined;

// Lazy so demo mode (VITE_DEMO=1) never needs Firebase config. Values come
// from web/.env.local (see .env.example); all of them are public identifiers —
// access control lives in firestore.rules.
export function getDb(): Firestore {
  if (!db) {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    db = getFirestore(app);
  }
  return db;
}

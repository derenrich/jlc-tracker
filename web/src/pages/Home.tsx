import { useEffect, useState } from 'react';
import SearchBox from '../components/SearchBox';
import { getStatus, Status } from '../lib/data';

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
  }, []);

  return (
    <main className="home">
      <h1>JLC Parts Tracker</h1>
      <p className="tagline">
        Daily price history for JLCPCB assembly parts — basic and preferred extended libraries.
      </p>
      <SearchBox large autoFocus />
      <p className="hint">
        Try <a href="/p/C1002">C1002</a>, or paste a product page URL from LCSC or JLCPCB.
      </p>
      {status && (
        <p className="status">
          Tracking {status.partCount.toLocaleString()} parts · last updated {status.date}
        </p>
      )}
    </main>
  );
}

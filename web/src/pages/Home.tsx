import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchBox from '../components/SearchBox';
import { JLC_HOME } from '../lib/links';
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
        Daily price history for <a href={JLC_HOME}>JLCPCB</a> assembly parts — basic and
        preferred extended libraries.
      </p>
      <SearchBox large autoFocus />
      <p className="hint">
        Try <a href="/p/C1002">C1002</a>, or paste a product page URL from LCSC or{' '}
        <a href={JLC_HOME}>JLCPCB</a>.
      </p>
      <p className="hint">
        Or see the <Link to="/trends">overall price index</Link>.
      </p>
      {status && (
        <p className="status">
          Tracking {status.partCount.toLocaleString()} parts · last updated {status.date}
        </p>
      )}
    </main>
  );
}

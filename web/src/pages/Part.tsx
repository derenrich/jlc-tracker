import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PriceChart, { ChartPoint } from '../components/PriceChart';
import SearchBox from '../components/SearchBox';
import { getHistory, getPart, HistoryPoint, Part } from '../lib/data';

// Up to 5 decimals so closely spaced chart axis ticks stay distinguishable.
const usd = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`;
const count = (v: number) => v.toLocaleString();

const RANGES = [
  { label: '3m', days: 92 },
  { label: '1y', days: 366 },
  { label: 'all', days: Infinity },
] as const;

type Metric = 'price' | 'stock';

export default function PartPage() {
  const { code = '' } = useParams();
  const [part, setPart] = useState<Part | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[2]);
  const [metric, setMetric] = useState<Metric>('price');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPart(null);
    setHistory([]);
    Promise.all([getPart(code), getHistory(code)])
      .then(([p, h]) => {
        if (cancelled) return;
        setPart(p);
        setHistory(h);
        setState(p ? 'ready' : 'missing');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const points: ChartPoint[] = useMemo(() => {
    const cutoff =
      range.days === Infinity
        ? ''
        : new Date(Date.now() - range.days * 86_400_000).toISOString().slice(0, 10);
    return history
      .filter((h) => h.d >= cutoff && (metric === 'stock' || h.p !== null))
      .map((h) => ({ d: h.d, v: metric === 'price' ? (h.p as number) : h.s }));
  }, [history, range, metric]);

  const priceStats = useMemo(() => {
    const prices = history.map((h) => h.p).filter((p): p is number => p !== null);
    if (prices.length === 0) return null;
    return {
      current: prices[prices.length - 1],
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
    };
  }, [history]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="wordmark">
          JLC Parts Tracker
        </Link>
        <SearchBox />
      </header>
      <main className="part">
        {state === 'loading' && <p className="notice">Loading {code}…</p>}
        {state === 'error' && <p className="notice">Couldn’t load {code}. Try again in a moment.</p>}
        {state === 'missing' && (
          <div className="notice">
            <p>
              <strong>{code}</strong> isn’t tracked here. Only JLCPCB’s basic and preferred
              extended parts (about 1,600 components) are followed.
            </p>
            <p>
              <a href={`https://jlcpcb.com/parts/componentSearch?searchTxt=${code}`}>
                Look it up on JLCPCB
              </a>
            </p>
          </div>
        )}
        {state === 'ready' && part && (
          <>
            <div className="part-head">
              {part.image && <img className="part-image" src={part.image} alt={part.model} />}
              <div>
                <h1>{part.model}</h1>
                <p className="part-sub">
                  {part.brand} · <span className="mono">{part.code}</span> ·{' '}
                  {part.libraryType === 'base' ? 'Basic' : 'Extended'} library
                </p>
                <p className="part-desc">{part.description}</p>
                <p className="part-sub">
                  {part.category}
                  {part.subcategory && part.subcategory !== part.category
                    ? ` — ${part.subcategory}`
                    : ''}
                  {part.package ? ` · ${part.package}` : ''}
                </p>
                <p className="part-links">
                  {part.lcscUrl && (
                    <a href={part.lcscUrl} target="_blank" rel="noreferrer">
                      LCSC
                    </a>
                  )}
                  {part.jlcUrl && (
                    <a href={part.jlcUrl} target="_blank" rel="noreferrer">
                      JLCPCB
                    </a>
                  )}
                  {part.datasheetUrl && (
                    <a href={part.datasheetUrl} target="_blank" rel="noreferrer">
                      Datasheet
                    </a>
                  )}
                </p>
              </div>
            </div>

            {priceStats && (
              <div className="stats">
                <div className="stat">
                  <span className="stat-label">Current</span>
                  <span className="stat-value">{usd(priceStats.current)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Lowest</span>
                  <span className="stat-value">{usd(priceStats.lowest)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Highest</span>
                  <span className="stat-value">{usd(priceStats.highest)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">In stock</span>
                  <span className="stat-value">{count(part.stock)}</span>
                </div>
              </div>
            )}

            <section className="card">
              <div className="chart-controls">
                <div className="seg" role="group" aria-label="metric">
                  {(['price', 'stock'] as Metric[]).map((m) => (
                    <button key={m} className={m === metric ? 'active' : ''} onClick={() => setMetric(m)}>
                      {m === 'price' ? 'Unit price' : 'Stock'}
                    </button>
                  ))}
                </div>
                <div className="seg" role="group" aria-label="range">
                  {RANGES.map((r) => (
                    <button
                      key={r.label}
                      className={r.label === range.label ? 'active' : ''}
                      onClick={() => setRange(r)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart points={points} format={metric === 'price' ? usd : count} />
            </section>

            <div className="detail-grid">
              {part.prices.length > 0 && (
                <section className="card">
                  <h2>Price breaks</h2>
                  <table>
                    <tbody>
                      {part.prices.map((t) => (
                        <tr key={t.qty}>
                          <td>{count(t.qty)}+</td>
                          <td className="num">{usd(t.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {part.minOrder > 1 && <p className="fineprint">Minimum order {count(part.minOrder)} pcs.</p>}
                </section>
              )}
              {part.attributes.length > 0 && (
                <section className="card">
                  <h2>Attributes</h2>
                  <table>
                    <tbody>
                      {part.attributes.map((a) => (
                        <tr key={a.name}>
                          <td>{a.name}</td>
                          <td className="num">{a.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
            <p className="fineprint">Prices in USD at the lowest quantity break. Updated {part.updatedAt}.</p>
          </>
        )}
      </main>
    </>
  );
}

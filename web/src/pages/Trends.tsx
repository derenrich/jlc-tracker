import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PriceChart, { ChartPoint } from '../components/PriceChart';
import SearchBox from '../components/SearchBox';
import { getIndexSeries, IndexPoint } from '../lib/data';
import { compact, count, usd } from '../lib/format';

const indexFmt = (v: number) => v.toFixed(1);

const METRICS = [
  { key: 'index', label: 'Index', pick: (p: IndexPoint) => p.i, format: indexFmt, axisFormat: indexFmt },
  { key: 'median', label: 'Median price', pick: (p: IndexPoint) => p.m, format: usd, axisFormat: usd },
  { key: 'stock', label: 'Total stock', pick: (p: IndexPoint) => p.s, format: count, axisFormat: compact },
] as const;

export default function Trends() {
  const [series, setSeries] = useState<IndexPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [metric, setMetric] = useState<(typeof METRICS)[number]>(METRICS[0]);

  useEffect(() => {
    getIndexSeries()
      .then((s) => {
        setSeries(s);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  const points: ChartPoint[] = useMemo(
    () =>
      series
        .map((p) => ({ d: p.d, v: metric.pick(p) }))
        .filter((p): p is ChartPoint => p.v !== null),
    [series, metric]
  );

  const latest = series[series.length - 1];
  const first = series[0];
  const changePct =
    series.length > 1 ? ((latest.i / first.i - 1) * 100).toFixed(2) : null;
  const spanDays =
    series.length > 1
      ? (new Date(latest.d).getTime() - new Date(first.d).getTime()) / 86_400_000
      : 0;
  const annualizedPct =
    spanDays > 0 ? ((Math.pow(latest.i / first.i, 365 / spanDays) - 1) * 100).toFixed(1) : null;

  return (
    <>
      <header className="topbar">
        <Link to="/" className="wordmark">
          JLC Parts Tracker
        </Link>
        <SearchBox />
      </header>
      <main className="part">
        <h1>Price index</h1>
        <p className="part-sub">
          Equal-weighted index of unit prices across all tracked parts, chained daily. 100 =
          first tracked day.
        </p>

        {state === 'loading' && <p className="notice">Loading…</p>}
        {state === 'error' && <p className="notice">Couldn’t load the index. Try again in a moment.</p>}
        {state === 'ready' && latest && (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat-label">Index</span>
                <span className="stat-value">{indexFmt(latest.i)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Since start</span>
                <span className="stat-value">
                  {changePct === null ? '—' : `${Number(changePct) >= 0 ? '+' : ''}${changePct}%`}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Annualized</span>
                <span className="stat-value">
                  {annualizedPct === null
                    ? '—'
                    : `${Number(annualizedPct) >= 0 ? '+' : ''}${annualizedPct}%`}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Median unit price</span>
                <span className="stat-value">{latest.m === null ? '—' : usd(latest.m)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Parts tracked</span>
                <span className="stat-value">{count(latest.n)}</span>
              </div>
            </div>

            <section className="card">
              <div className="chart-controls">
                <div className="seg" role="group" aria-label="metric">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      className={m.key === metric.key ? 'active' : ''}
                      onClick={() => setMetric(m)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart points={points} format={metric.format} axisFormat={metric.axisFormat} />
            </section>
            <p className="fineprint">
              Recomputed daily from the full snapshot archive. Median price is across all
              tracked parts at their lowest quantity break, in USD.
            </p>
          </>
        )}
      </main>
    </>
  );
}

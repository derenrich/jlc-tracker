import { useLayoutEffect, useRef, useState } from 'react';
import { niceTicks } from '../lib/ticks';

export interface ChartPoint {
  d: string; // YYYY-MM-DD
  v: number;
}

interface Props {
  points: ChartPoint[];
  format: (v: number) => string;
  // Optional tighter formatter for y-axis labels (e.g. 800M); the hover
  // readout keeps the full-precision `format`.
  axisFormat?: (v: number) => string;
}

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 56 };

const dateMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default function PriceChart({ points, format, axisFormat = format }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return <div className="chart-empty">No data yet.</div>;
  }

  const t0 = dateMs(points[0].d);
  const t1 = Math.max(dateMs(points[points.length - 1].d), t0 + 1);
  const values = points.map((p) => p.v);
  const vTicks = niceTicks(Math.min(...values), Math.max(...values));
  const v0 = vTicks[0];
  const v1 = vTicks[vTicks.length - 1];

  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + ((dateMs(d) - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - v0) / (v1 - v0 || 1)) * innerH;

  // Step-after path: a price holds until the next observation.
  let path = `M ${x(points[0].d)} ${y(points[0].v)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` H ${x(points[i].d)} V ${y(points[i].v)}`;
  }

  // X ticks: at most ~6, evenly spaced across the observations.
  const stride = Math.max(1, Math.ceil(points.length / 6));
  const xTicks = points.filter((_, i) => i % stride === 0);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left - PAD.left) / innerW) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(dateMs(points[i].d) - t) < Math.abs(dateMs(points[best].d) - t)) best = i;
    }
    setHover(best);
  }

  const h = hover !== null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="chart">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="price history chart"
        >
          {vTicks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="chart-label" x={PAD.left - 8} y={y(t) + 3} textAnchor="end">
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {xTicks.map((p) => (
            <text key={p.d} className="chart-label" x={x(p.d)} y={HEIGHT - 6} textAnchor="middle">
              {new Date(`${p.d}T00:00:00Z`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </text>
          ))}
          <path className="chart-line" d={path} fill="none" />
          {h && (
            <g>
              <line className="chart-cursor" x1={x(h.d)} x2={x(h.d)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
              <circle className="chart-dot" cx={x(h.d)} cy={y(h.v)} r={3} />
            </g>
          )}
        </svg>
      )}
      <div className="chart-readout">
        {h ? `${shortDate(h.d)} — ${format(h.v)}` : ' '}
      </div>
    </div>
  );
}

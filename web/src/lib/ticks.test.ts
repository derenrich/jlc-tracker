import { describe, expect, it } from 'vitest';
import { niceTicks } from './ticks';

describe('niceTicks', () => {
  it('always brackets the data range', () => {
    // Regression: C1548's price range 0.0051–0.0087 produced ticks 0.006–0.008,
    // clipping the plotted line entirely outside the chart.
    const cases: [number, number][] = [
      [0.0051, 0.0087],
      [0.0187, 0.0188],
      [0, 1_722_602],
      [42, 42],
      [-3.2, 7.9],
    ];
    for (const [min, max] of cases) {
      const ticks = niceTicks(min, max);
      expect(ticks[0]).toBeLessThanOrEqual(min);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      expect(ticks.length).toBeLessThanOrEqual(12);
    }
  });

  it('produces evenly spaced rounded steps', () => {
    const ticks = niceTicks(0.0051, 0.0087);
    const steps = ticks.slice(1).map((t, i) => t - ticks[i]);
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 10);
    expect(ticks[0]).toBeCloseTo(0.005, 10);
    expect(ticks[ticks.length - 1]).toBeCloseTo(0.009, 10);
  });
});

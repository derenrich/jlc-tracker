// Rounded axis tick values covering [min, max]: the first tick is <= min and
// the last is >= max, so plotted values never fall outside the axis range.
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / count)));
  const err = (max - min) / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = step * mult;
  // Multiply by index (not accumulate) to avoid float drift, and widen by one
  // step if rounding still leaves an endpoint outside.
  let nLo = Math.floor(min / s);
  let nHi = Math.ceil(max / s);
  if (nLo * s > min) nLo--;
  if (nHi * s < max) nHi++;
  const ticks: number[] = [];
  for (let n = nLo; n <= nHi; n++) ticks.push(n * s);
  return ticks;
}

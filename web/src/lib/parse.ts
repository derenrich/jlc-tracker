// Turns whatever the user pastes — a part number ("C1002", "1002") or an
// LCSC/JLCPCB product URL — into a canonical part code, or null.
export function extractPartCode(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  // Bare part number, with or without the leading C.
  const exact = /^[Cc]?(\d{1,8})$/.exec(s);
  if (exact) return `C${exact[1]}`;

  // URLs: both LCSC (…_C1002.html) and JLCPCB (…/C1002) embed the code as the
  // last C+digits token in the path.
  if (/lcsc\.com|jlcpcb\.com|^https?:\/\//i.test(s)) {
    const matches = s.match(/C(\d{1,8})(?![\d])/gi);
    if (matches) return matches[matches.length - 1].toUpperCase();
  }

  return null;
}

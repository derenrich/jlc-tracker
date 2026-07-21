// All links out to jlcpcb.com carry the referral code.
const REFERRAL_CODE = 'VBTFNLJVJBDMPYA';

export const JLC_HOME = `https://jlcpcb.com/?from=${REFERRAL_CODE}`;

export function withReferral(jlcUrl: string): string {
  try {
    const u = new URL(jlcUrl);
    u.searchParams.set('from', REFERRAL_CODE);
    return u.toString();
  } catch {
    return jlcUrl;
  }
}

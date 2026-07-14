import { describe, expect, it } from 'vitest';
import { extractPartCode } from './parse';

describe('extractPartCode', () => {
  it('accepts part numbers', () => {
    expect(extractPartCode('C1002')).toBe('C1002');
    expect(extractPartCode('c1002')).toBe('C1002');
    expect(extractPartCode(' 1002 ')).toBe('C1002');
  });

  it('parses LCSC product URLs', () => {
    expect(
      extractPartCode('https://www.lcsc.com/product-detail/inductors-smd_sunlord-sdfl2012q1r0ktf_C1042.html')
    ).toBe('C1042');
  });

  it('parses JLCPCB part detail URLs', () => {
    expect(extractPartCode('https://jlcpcb.com/partdetail/Sunlord-SDFL2012Q1R0KTF/C1042')).toBe('C1042');
  });

  it('takes the code from the path, not the model name', () => {
    expect(extractPartCode('https://jlcpcb.com/partdetail/St-STM32C011F4P6/C22315054')).toBe('C22315054');
  });

  it('rejects junk', () => {
    expect(extractPartCode('')).toBeNull();
    expect(extractPartCode('resistor')).toBeNull();
    expect(extractPartCode('https://example.com/nothing')).toBeNull();
  });
});

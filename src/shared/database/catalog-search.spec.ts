import { catalogSearchPattern } from './catalog-search';

describe('catalog search literals', () => {
  it('normalizes Portuguese accents and case while escaping SQL LIKE wildcards', () => {
    expect(catalogSearchPattern('  REVISÃO Óleo_100%  ')).toBe(
      '%revisao oleo\\_100\\%%',
    );
    expect(catalogSearchPattern('a\\b')).toBe('%a\\\\b%');
    expect(catalogSearchPattern("x' OR true --")).toBe("%x' or true --%");
  });
});

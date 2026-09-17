import { resolveCorsOrigins } from './cors';

describe('resolveCorsOrigins', () => {
  it('keeps configured web origins and appends Capacitor origins', () => {
    expect(resolveCorsOrigins('https://fish-life.cc.cd')).toEqual([
      'https://fish-life.cc.cd',
      'https://localhost',
      'capacitor://localhost',
    ]);
  });

  it('supports multiple configured web origins without duplicates', () => {
    expect(
      resolveCorsOrigins(
        'https://fish-life.cc.cd, https://preview.example.com, https://localhost',
      ),
    ).toEqual([
      'https://fish-life.cc.cd',
      'https://preview.example.com',
      'https://localhost',
      'capacitor://localhost',
    ]);
  });

  it('uses local web defaults when CORS_ORIGIN is unset', () => {
    expect(resolveCorsOrigins()).toEqual([
      'http://localhost:5173',
      'http://localhost:3000',
      'https://localhost',
      'capacitor://localhost',
    ]);
  });
});

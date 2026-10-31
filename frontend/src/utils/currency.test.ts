import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExchangeRate,
  convertMonetaryAmount,
} from './currency';

describe('Currency and Exchange Rate Utilities', () => {
  beforeEach(() => {
    delete window.__EXCHANGE_RATES__;
  });

  afterEach(() => {
    delete window.__EXCHANGE_RATES__;
  });

  it('returns rate 1.0 when from and to currencies match', () => {
    expect(getExchangeRate('USD', 'USD')).toBe(1.0);
    expect(getExchangeRate('INR', 'INR')).toBe(1.0);
    expect(getExchangeRate('EUR', 'EUR')).toBe(1.0);
  });

  it('returns null when no exchange rate is configured for the currency pair', () => {
    // Default project environment has no fixed FX rates
    expect(getExchangeRate('USD', 'INR')).toBeNull();
    expect(getExchangeRate('INR', 'USD')).toBeNull();
  });

  it('indicates conversion unavailable when FX rate is missing and does not alter numbers', () => {
    const result = convertMonetaryAmount(299.0, 'USD', 'INR');
    expect(result.isAvailable).toBe(false);
    expect(result.amount).toBeNull();
    expect(result.formatted).toContain('Unavailable');
    expect(result.symbol).toBe('₹');
    expect(result.currency).toBe('INR');
  });

  it('preserves native amounts when target matches base currency', () => {
    const result = convertMonetaryAmount(299.0, 'USD', 'USD');
    expect(result.isAvailable).toBe(true);
    expect(result.amount).toBe(299.0);
    expect(result.formatted).toBe('$299.00 USD');
    expect(result.symbol).toBe('$');
    expect(result.currency).toBe('USD');
  });

  it('accurately converts amounts when an exchange rate is configured', () => {
    window.__EXCHANGE_RATES__ = {
      USD_INR: 85.0,
      INR_USD: 1 / 85.0,
    };

    const inrResult = convertMonetaryAmount(100.0, 'USD', 'INR');
    expect(inrResult.isAvailable).toBe(true);
    expect(inrResult.amount).toBe(8500.0);
    expect(inrResult.formatted).toBe('₹8500.00 INR');
    expect(inrResult.symbol).toBe('₹');

    // Convert back from INR to USD
    const usdResult = convertMonetaryAmount(8500.0, 'INR', 'USD');
    expect(usdResult.isAvailable).toBe(true);
    expect(usdResult.amount).toBeCloseTo(100.0, 2);
    expect(usdResult.formatted).toBe('$100.00 USD');
  });
});

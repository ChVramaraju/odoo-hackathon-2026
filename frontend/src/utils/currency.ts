/**
 * Brightloop Currency & Exchange Rate Utilities
 *
 * Implements strict data integrity rules:
 * - Base prices from API / mocks remain untouched.
 * - Does NOT invent uncontracted fixed exchange rates.
 * - If no authoritative FX rate source is configured, explicitly indicates
 *   that conversion is unavailable instead of showing misleading converted numbers.
 * - Supports runtime/configured FX rates when provided.
 */

export type SupportedCurrency = 'USD' | 'INR' | 'EUR';

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['USD', 'INR', 'EUR'];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
};

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: 'USD ($) — US Dollar',
  INR: 'INR (₹) — Indian Rupee',
  EUR: 'EUR (€) — Euro',
};

declare global {
  interface Window {
    __EXCHANGE_RATES__?: Record<string, number>;
  }
}

/**
 * Look up the exchange rate between two currency codes.
 * Returns 1.0 when from === to.
 * Checks runtime window.__EXCHANGE_RATES__ and VITE_EXCHANGE_RATES env variable.
 * Returns null if no reliable exchange rate is configured in the project.
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return 1.0;

  // 1. Check window runtime override (useful for testing and backend injection)
  if (typeof window !== 'undefined' && window.__EXCHANGE_RATES__) {
    const pair = `${from}_${to}`;
    if (typeof window.__EXCHANGE_RATES__[pair] === 'number') {
      return window.__EXCHANGE_RATES__[pair];
    }
    // Check reciprocal
    const reversePair = `${to}_${from}`;
    if (typeof window.__EXCHANGE_RATES__[reversePair] === 'number' && window.__EXCHANGE_RATES__[reversePair] > 0) {
      return 1 / window.__EXCHANGE_RATES__[reversePair];
    }
  }

  // 2. Check Vite environment variable if configured
  try {
    const envRates = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_EXCHANGE_RATES;
    if (envRates) {
      const parsed = typeof envRates === 'string' ? JSON.parse(envRates) : envRates;
      const pair = `${from}_${to}`;
      if (typeof parsed[pair] === 'number') {
        return parsed[pair];
      }
      const reversePair = `${to}_${from}`;
      if (typeof parsed[reversePair] === 'number' && parsed[reversePair] > 0) {
        return 1 / parsed[reversePair];
      }
    }
  } catch {
    // Malformed env configuration, fall through to null
  }

  // No configured exchange rate found
  return null;
}

export interface ConvertedPrice {
  amount: number | null;
  formatted: string;
  isAvailable: boolean;
  rateUsed: number | null;
  currency: SupportedCurrency;
  symbol: string;
}

/**
 * Converts a base monetary amount into the target currency.
 * If no exchange rate is available, returns isAvailable: false with an explicit label.
 */
export function convertMonetaryAmount(
  baseAmount: number,
  baseCurrency: string,
  targetCurrency: SupportedCurrency
): ConvertedPrice {
  const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency;

  if (baseCurrency.toUpperCase() === targetCurrency.toUpperCase()) {
    return {
      amount: baseAmount,
      formatted: `${symbol}${baseAmount.toFixed(2)} ${targetCurrency}`,
      isAvailable: true,
      rateUsed: 1.0,
      currency: targetCurrency,
      symbol,
    };
  }

  const rate = getExchangeRate(baseCurrency, targetCurrency);
  if (rate === null) {
    return {
      amount: null,
      formatted: `Unavailable (${targetCurrency} FX not configured)`,
      isAvailable: false,
      rateUsed: null,
      currency: targetCurrency,
      symbol,
    };
  }

  const converted = baseAmount * rate;
  return {
    amount: converted,
    formatted: `${symbol}${converted.toFixed(2)} ${targetCurrency}`,
    isAvailable: true,
    rateUsed: rate,
    currency: targetCurrency,
    symbol,
  };
}


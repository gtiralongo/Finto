/**
 * Markets API — APIs de mercado para precios de activos
 * TradingView (acciones, cedears, bonos, ON, crypto-global)
 * CriptoYa (crypto-ars)
 * Argentinadatos (fondos FCI)
 */

// ── Constants ──
const TV_BASE = 'https://scanner.tradingview.com';
const CRIPTOYA_BASE = 'https://criptoya.com/api';
const CRIPTOYA_EXCHANGE = 'letsbit';
const CRIPTOYA_FEE = '0.1';
const ARGDATOS_BASE = 'https://api.argentinadatos.com';

const TV_COLS = ['name', 'close', 'change', 'currency'];

const UNIT_MULTIPLIER = {
  bonos: 1,
  on: 1,
  letras: 1,
  fondos: 1,
  acciones: 1,
  cedears: 1,
  'crypto-ars': 1,
  'crypto-global': 1
};

// ── TradingView Scanner ──

async function fetchTV(endpoint, tickers = []) {
  const resp = await fetch(`${TV_BASE}/${endpoint}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      symbols: { query: { types: [] }, tickers },
      columns: TV_COLS
    })
  });
  if (!resp.ok) throw new Error(`TV HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.data) throw new Error('TV sin datos');
  return json.data;
}

function parseTVSymbol(s) {
  const idx = s.indexOf(':');
  return idx >= 0 ? s.substring(idx + 1) : s;
}

function tvDataToMap(data) {
  const map = {};
  for (const item of data) {
    const ticker = parseTVSymbol(item.s);
    const d = item.d;
    if (d && d.length >= 2 && d[1] != null) {
      map[ticker] = {
        close: d[1],
        change: d.length > 2 ? d[2] : null,
        currency: d.length > 3 ? d[3] : null
      };
    }
  }
  return map;
}

async function fetchTVArgentina(tickers = []) {
  const data = await fetchTV('argentina', tickers);
  return tvDataToMap(data);
}

async function fetchTVBonds(tickers = []) {
  const data = await fetchTV('bond', tickers);
  return tvDataToMap(data);
}

async function fetchTVCrypto() {
  const data = await fetchTV('crypto');
  return tvDataToMap(data);
}

// ── CriptoYa (Crypto ARS) ──

async function fetchCriptoyaPrices(symbols) {
  const prices = {};
  const entries = Object.entries(
    symbols.reduce((acc, s) => { acc[s.toUpperCase()] = true; return acc; }, {})
  );
  const results = await Promise.allSettled(
    entries.map(([sym]) =>
      fetch(`${CRIPTOYA_BASE}/${CRIPTOYA_EXCHANGE}/${sym}/ARS/${CRIPTOYA_FEE}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(d => { prices[sym] = d.ask; })
        .catch(() => { prices[sym] = null; })
    )
  );
  return prices;
}

async function fetchCriptoyaSinglePrice(symbol) {
  const sym = symbol.toUpperCase();
  try {
    const r = await fetch(`${CRIPTOYA_BASE}/${CRIPTOYA_EXCHANGE}/${sym}/ARS/${CRIPTOYA_FEE}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.ask ?? null;
  } catch {
    return null;
  }
}

// ── Argentinadatos (Fondos FCI) ──

async function fetchFciByCategory(category) {
  const url = `${ARGDATOS_BASE}/v1/finanzas/fci/${category}/ultimo`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FCI ${category} HTTP ${r.status}`);
  const datos = await r.json();
  return datos.filter(f => f.vcp != null);
}

async function fetchAllFci() {
  const cats = ['mercadoDinero', 'rentaFija', 'rentaVariable', 'rentaMixta'];
  const results = await Promise.all(cats.map(c => fetchFciByCategory(c)));
  return results.flat();
}

function fciToMap(fciData) {
  const map = {};
  for (const f of fciData) {
    if (f.fondo && f.vcp != null) {
      map[f.fondo.toUpperCase()] = { vcp: f.vcp };
    }
  }
  return map;
}

// ── Exchange Rate ──

async function fetchArsUsdRate() {
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares');
    if (!r.ok) return null;
    const data = await r.json();
    const latest = data.filter(d => d.casa === 'bolsa').pop();
    return latest?.venta ?? null;
  } catch {
    return null;
  }
}

// ── Unified Service ──

async function fetchAllMarketPrices(cryptoSymbols = [], argentinaTickers = [], bondTickers = []) {
  const [argentina, crypto, bonds, criptoya, fci, rate] = await Promise.allSettled([
    fetchTVArgentina(argentinaTickers),
    fetchTVCrypto(),
    bondTickers.length > 0
      ? fetchTVBonds(bondTickers)
      : Promise.resolve({}),
    cryptoSymbols.length > 0
      ? fetchCriptoyaPrices(cryptoSymbols)
      : Promise.resolve({}),
    fetchAllFci(),
    fetchArsUsdRate()
  ]);

  return {
    argentina: argentina.status === 'fulfilled' ? argentina.value : {},
    'crypto-global': crypto.status === 'fulfilled' ? crypto.value : {},
    bonds: bonds.status === 'fulfilled' ? bonds.value : {},
    'crypto-ars': criptoya.status === 'fulfilled' ? criptoya.value : {},
    fondos: fci.status === 'fulfilled' ? fciToMap(fci.value) : {},
    arsUsdRate: rate.status === 'fulfilled' ? rate.value : null
  };
}

function getPrice(asset, category, prices) {
  const ticker = asset.toUpperCase();

  switch (category) {
    case 'acciones':
    case 'cedears':
    case 'bonos':
    case 'on':
    case 'letras': {
      const item = prices.bonds?.[ticker];
      if (item?.close != null) return item.close / 100;
      const fallback = prices.argentina?.[ticker];
      return fallback?.close ?? null;
    }
    case 'crypto-ars':
      return prices['crypto-ars']?.[ticker] ?? null;
    case 'crypto-global': {
      const pair = ticker.endsWith('USDT') ? ticker : `${ticker}USDT`;
      const item = prices['crypto-global']?.[pair.toUpperCase()];
      return item?.close ?? null;
    }
    case 'fondos': {
      const item = prices.fondos?.[ticker];
      const vcp = item?.vcp;
      return vcp != null ? vcp / 1000 : null;
    }
    default:
      return null;
  }
}

// ── Expose globally for script.js ──
window.TV_COLS = TV_COLS;
window.UNIT_MULTIPLIER = UNIT_MULTIPLIER;
window.fetchTVArgentina = fetchTVArgentina;
window.fetchTVBonds = fetchTVBonds;
window.fetchTVCrypto = fetchTVCrypto;
window.fetchArsUsdRate = fetchArsUsdRate;
window.fetchCriptoyaPrices = fetchCriptoyaPrices;
window.fetchCriptoyaSinglePrice = fetchCriptoyaSinglePrice;
window.fetchAllFci = fetchAllFci;
window.fetchAllMarketPrices = fetchAllMarketPrices;
window.getPrice = getPrice;

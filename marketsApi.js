/**
 * Markets API — APIs de mercado para precios de activos
 * --------------------------------------------------------------
 *  - Binance (crypto-global):      https://api.binance.com
 *  - CriptoYa (crypto-ars):        https://api.criptoya.com
 *  - Rava (bonos, ON, letras):    https://mercado.rava.com
 *  - Argentinadatos (fondos):    https://api.argentinadatos.com
 */

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const CRIPTOYA_BASE = 'https://api.criptoya.com';
const RAVA_BASE = 'https://mercado.rava.com';
const ARGDATOS_BASE = 'https://api.argentinadatos.com';
const corsProxy = (url) => `https://api.codetabs.com/v1/proxy?quest=${url}`;

export const UNIT_MULTIPLIER = {
  bonos: 1000,
  on: 1000,
  letras: 1000,
  fondos: 1000,
  acciones: 1,
  cedears: 1,
  'crypto-ars': 1,
  'crypto-global': 1
};

export const CATEGORY_SOURCE = {
  'crypto-ars': 'criptoya',
  'crypto-global': 'binance',
  acciones: 'rava',
  cedears: 'rava',
  bonos: 'rava',
  on: 'rava',
  letras: 'rava',
  fondos: 'argentinadatos'
};

// ----------------------------------------------------------------------------
// BINANCE — Crypto Global (USDT)
// ----------------------------------------------------------------------------

export async function fetchBinanceAllPrices() {
  const r = await fetch(`${BINANCE_BASE}/ticker/price`);
  if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
  const data = await r.json();
  const prices = {};
  for (const item of data) {
    if (item.symbol.endsWith('USDT')) {
      prices[item.symbol] = parseFloat(item.price);
    }
  }
  return prices;
}

export async function fetchBinancePrices(symbols) {
  const symbolsUpper = symbols.map(s => s.toUpperCase());
  const prices = {};
  
  for (const symbol of symbolsUpper) {
    const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    try {
      const r = await fetch(`${BINANCE_BASE}/ticker/price?symbol=${pair}`);
      if (r.ok) {
        const data = await r.json();
        prices[symbol] = parseFloat(data.price);
      }
    } catch (e) {
      prices[symbol] = null;
    }
  }
  return prices;
}

export async function fetchBinanceSinglePrice(symbol) {
  const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
  const r = await fetch(`${BINANCE_BASE}/ticker/price?symbol=${pair}`);
  if (!r.ok) return null;
  const data = await r.json();
  return parseFloat(data.price);
}

// ----------------------------------------------------------------------------
// CRIPTOYA — Crypto en Pesos (ARS)
// ----------------------------------------------------------------------------

export async function fetchCriptoyaAllPrices() {
  const r = await fetch(`${CRIPTOYA_BASE}/coins`);
  if (!r.ok) throw new Error(`CriptoYa HTTP ${r.status}`);
  const data = await r.json();
  const prices = {};
  for (const [symbol, quote] of Object.entries(data)) {
    if (quote.ars) {
      prices[symbol.toUpperCase()] = quote.ars;
    }
  }
  return prices;
}

export async function fetchCriptoyaPrices(symbols) {
  const allPrices = await fetchCriptoyaAllPrices();
  const symbolsUpper = symbols.map(s => s.toUpperCase());
  const prices = {};
  for (const symbol of symbolsUpper) {
    prices[symbol] = allPrices[symbol] ?? null;
  }
  return prices;
}

export async function fetchCriptoyaSinglePrice(symbol) {
  const r = await fetch(`${CRIPTOYA_BASE}/coin/${symbol.toUpperCase()}`);
  if (!r.ok) return null;
  const data = await r.json();
  return data.ars ?? null;
}

// ----------------------------------------------------------------------------
// RAVA — Bonos, ON, Letras, Acciones, CEDEARs
// ----------------------------------------------------------------------------

export async function fetchBonosRava() {
  const r = await fetch(corsProxy(`${RAVA_BASE}/api/prices/bonos`));
  if (!r.ok) throw new Error(`Rava bonos HTTP ${r.status}`);
  const j = await r.json();
  return j.datos ?? [];
}

export async function fetchOnRava() {
  const r = await fetch(corsProxy(`${RAVA_BASE}/api/prices/ons`));
  if (!r.ok) {
    const arg = await fetch(corsProxy(`${RAVA_BASE}/api/prices/arg`));
    const j = await arg.json();
    return (j.datos ?? []).filter(i => i.simbolo?.startsWith('ON'));
  }
  const j = await r.json();
  return j.datos ?? [];
}

export async function fetchLetrasRava() {
  const r = await fetch(corsProxy(`${ARGDATOS_BASE}/v1/finanzas/letras`));
  if (!r.ok) return [];
  const j = await r.json();
  return j.datos ?? [];
}

export async function fetchAccionesRava(symbols = []) {
  const [def, mkt] = await Promise.all([
    fetch(corsProxy(`${RAVA_BASE}/api/prices/defaults`)).then(r => r.json()),
    fetch(corsProxy(`${RAVA_BASE}/api/prices/arg`)).then(r => r.json()),
  ]);
  
  const especies = new Set(def.acciones?.especies ?? []);
  let data = mkt.datos.filter(i => especies.has(i.simbolo));
  
  if (symbols.length > 0) {
    const wanted = new Set(symbols.map(s => s.toUpperCase()));
    data = data.filter(i => wanted.has(i.simbolo));
  }
  return data;
}

export async function fetchCedearsRava(symbols = []) {
  const [def, mkt] = await Promise.all([
    fetch(corsProxy(`${RAVA_BASE}/api/prices/defaults`)).then(r => r.json()),
    fetch(corsProxy(`${RAVA_BASE}/api/prices/arg`)).then(r => r.json()),
  ]);
  
  const especies = new Set(def.cedears?.especies ?? []);
  let data = mkt.datos.filter(i => especies.has(i.simbolo));
  
  if (symbols.length > 0) {
    const wanted = new Set(symbols.map(s => s.toUpperCase()));
    data = data.filter(i => wanted.has(i.simbolo));
  }
  return data;
}

// ----------------------------------------------------------------------------
// ARGENTINADATOS — Fondos FCI (proxy CORS)
// ----------------------------------------------------------------------------

export async function fetchFciByCategory(category) {
  const url = corsProxy(`${ARGDATOS_BASE}/v1/finanzas/fci/${category}/ultimo`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FCI ${category} HTTP ${r.status}`);
  const datos = await r.json();
  return datos.filter(f => f.vcp != null);
}

export async function fetchAllFci() {
  const cats = ['mercadoDinero', 'rentaFija', 'rentaVariable', 'rentaMixta'];
  const results = await Promise.all(cats.map(c => fetchFciByCategory(c)));
  return results.flat();
}

// ----------------------------------------------------------------------------
// SERVICIO UNIFICADO
// ----------------------------------------------------------------------------

export async function fetchAllMarketPrices() {
  const [binance, criptoya, bonos, on, letras, acciones, cedears, fci] = await Promise.allSettled([
    fetchBinanceAllPrices(),
    fetchCriptoyaAllPrices(),
    fetchBonosRava(),
    fetchOnRava(),
    fetchLetrasRava(),
    fetchAccionesRava(),
    fetchCedearsRava(),
    fetchAllFci()
  ]);

  return {
    cryptoGlobal: binance.status === 'fulfilled' ? binance.value : {},
    cryptoARS: criptoya.status === 'fulfilled' ? criptoya.value : {},
    bonos: bonos.status === 'fulfilled' ? bonos.value : [],
    on: on.status === 'fulfilled' ? on.value : [],
    letras: letras.status === 'fulfilled' ? letras.value : [],
    acciones: acciones.status === 'fulfilled' ? acciones.value : [],
    cedears: cedears.status === 'fulfilled' ? cedears.value : [],
    fondos: fci.status === 'fulfilled' ? fci.value : []
  };
}

export function getPrice(asset, category, prices) {
  const ticker = asset.toUpperCase();
  
  switch (category) {
    case 'crypto-global': {
      const pair = ticker.endsWith('USDT') ? ticker : `${ticker}USDT`;
      return prices.cryptoGlobal?.[pair] ?? null;
    }
    case 'crypto-ars':
      return prices.cryptoARS?.[ticker] ?? null;
    case 'bonos': {
      const b = prices.bonos?.find(i => i.simbolo === ticker);
      return b?.ultimo ?? null;
    }
    case 'on': {
      const o = prices.on?.find(i => i.simbolo === ticker);
      return o?.ultimo ?? null;
    }
    case 'letras': {
      const l = prices.letras?.find(i => i.simbolo === ticker);
      return l?.vpv ?? l?.precio ?? null;
    }
    case 'fondos': {
      const f = prices.fondos?.find(i => i.codigo === ticker);
      return f?.vcp ?? null;
    }
    case 'acciones':
    case 'cedears': {
      const a = prices.acciones?.find(i => i.simbolo === ticker) ||
               prices.cedears?.find(i => i.simbolo === ticker);
      return a?.ultimo ?? null;
    }
    default:
      return null;
  }
}
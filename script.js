// ===== DOM ELEMENTS =====
const balance = document.getElementById('balance');
const money_plus = document.getElementById('money-plus');
const money_minus = document.getElementById('money-minus');
const savingsRate = document.getElementById('savings-rate');
const incomeCount = document.getElementById('income-count');
const expenseCount = document.getElementById('expense-count');
const savingsLabel = document.getElementById('savings-label');

const list = document.getElementById('list');                 // History list
const recentList = document.getElementById('recent-list');   // Dashboard mini list
const emptyMsg = document.getElementById('empty-msg');

const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item, .mobile-nav-center, .btn-link');
const viewSections = document.querySelectorAll('.view-section');
const viewTitle = document.getElementById('view-title');
const headerSubtitle = document.getElementById('header-subtitle');

const filterYear = document.getElementById('filter-year');
const filterMonth = document.getElementById('filter-month');
const dashboardFilters = document.getElementById('dashboard-filters');

const incomeForm = document.getElementById('income-form');
const expenseForm = document.getElementById('expense-form');
const incomeList = document.getElementById('income-list');
const expenseList = document.getElementById('expense-list');

const searchInput = document.getElementById('search-input');
const savingsSearchInput = document.getElementById('savings-search-input');

// ===== STATE =====
var transactions = JSON.parse(localStorage.getItem('transactions')) || [];
var savings = JSON.parse(localStorage.getItem('savings')) || [];
var closedTrades = JSON.parse(localStorage.getItem('closedTrades')) || [];
var platforms = JSON.parse(localStorage.getItem('platforms')) || [
  { id: 1, name: 'Efectivo', initialBalance: 0 },
  { id: 2, name: 'Mercado Pago', initialBalance: 0 },
  { id: 3, name: 'Banco', initialBalance: 0 }
];
let currentPrices = JSON.parse(localStorage.getItem('latest_prices')) || {};

async function refreshMarketPrices() {
  if (typeof fetchAllMarketPrices !== 'function') return;
  try {
    const cryptoSymbols = [...new Set(
      savings.filter(s => s.category === 'crypto-ars').map(s => s.asset)
    )];
    const argentinaTickers = [...new Set(
      savings.filter(s => ['acciones', 'cedears'].includes(s.category)).map(s => `BCBA:${s.asset}`)
    )];
    const bondTickers = [...new Set(
      savings.filter(s => ['bonos', 'on', 'letras'].includes(s.category)).map(s => `BCBA:${s.asset}`)
    )];
    const prices = await fetchAllMarketPrices(cryptoSymbols, argentinaTickers, bondTickers);
    currentPrices = prices;
    localStorage.setItem('latest_prices', JSON.stringify(prices));
  } catch (e) {
    console.warn('Error fetching market prices:', e);
  }
  if (document.getElementById('savings-view')?.style.display !== 'none') {
    updateSavingsUI();
  }
}
let currentFilter = 'all';
let currentSearchQuery = '';
let savingsSearchQuery = '';
let tradesSearchQuery = '';
let savingsFilterPlatform = '';
let savingsFilterCategory = '';
let platformViewMode = localStorage.getItem('platformViewMode') || 'cards';
let platformSortColumn = localStorage.getItem('platformSortColumn') || 'name';
let platformSortDirection = parseInt(localStorage.getItem('platformSortDirection')) || 1;

// Chart Instances
let monthlyChartInstance = null;

// ===== HELPERS =====
function fmt(amount) {
  const formatted = Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '---';
  // Handle DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parts.join('-') + 'T12:00:00').toLocaleDateString('es-AR');
      return new Date(parts[2], parts[1] - 1, parts[0]).toLocaleDateString('es-AR');
    }
  }
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR');
}

function parseCSVNumber(val) {
  if (!val) return 0;
  // Remove currency symbols and non-numeric except , and .
  let clean = val.replace(/[^\d,.-]/g, '');

  // Detect if it uses comma as decimal: e.g. "1.234,56" or "1234,56"
  if (clean.includes(',') && (!clean.includes('.') || clean.indexOf('.') < clean.indexOf(','))) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format/plain dots e.g. "1,234.56" or "1234.56"
    clean = clean.replace(/,/g, '');
  }
  return parseFloat(clean) || 0;
}

function generateID() {
  return Math.floor(Math.random() * 100000000);
}

// ===== NAVIGATION =====
const viewTitles = {
  'dashboard': ['Panel', 'Resumen financiero'],
  'transactions-form': ['Movimientos', 'Registrar ingresos y gastos'],
  'history': ['Historial', 'Todos los movimientos'],
  'savings': ['Ahorros', 'Gestión de activos y capital'],
  'platforms': ['Cuentas', 'Mis cuentas y balances']
};

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.getAttribute('data-view');
    if (!view) return;
    switchView(view);
  });
});

function switchView(view) {
  // Update active nav
  navItems.forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll(`[data-view="${view}"]`).forEach(nav => nav.classList.add('active'));

  // Switch sections
  viewSections.forEach(section => section.style.display = 'none');
  const targetView = document.getElementById(`${view}-view`);
  if (targetView) targetView.style.display = 'block';

  // Update title
  const titles = viewTitles[view] || [view, ''];
  viewTitle.innerText = titles[0];
  if (headerSubtitle) headerSubtitle.innerText = titles[1];

  // Toggle dashboard filters
  if (dashboardFilters) {
    dashboardFilters.style.display = view === 'dashboard' ? 'flex' : 'none';
  }

  if (view === 'dashboard') {
    populateYearFilter();
    updateDashboard();
  }

  if (view === 'transactions-form') {
    updateFormSideStats();
  }

  if (view === 'savings') {
    updateSavingsUI();
    refreshMarketPrices();
  }

  if (view === 'platforms') {
    updatePlatformsUI();
  }
}

// ===== FORM TABS =====
// User Menu Toggle
const userMenuToggle = document.getElementById('user-menu-toggle');
const userDropdown = document.getElementById('user-dropdown');
const logoutBtnMobile = document.getElementById('logout-btn-mobile');

if (userMenuToggle && userDropdown) {
  userMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    userDropdown.classList.remove('show');
  });
}

if (logoutBtnMobile) {
  logoutBtnMobile.addEventListener('click', () => auth.signOut());
}

// Sync Mobile Filters
const mobileYearFilter = document.getElementById('filter-year-mobile');
const mobileMonthFilter = document.getElementById('filter-month-mobile');
const desktopYearFilter = document.getElementById('filter-year');
const desktopMonthFilter = document.getElementById('filter-month');

if (mobileYearFilter && desktopYearFilter) {
  mobileYearFilter.addEventListener('change', (e) => {
    desktopYearFilter.value = e.target.value;
    updateDashboard();
  });
}

if (mobileMonthFilter && desktopMonthFilter) {
  mobileMonthFilter.addEventListener('change', (e) => {
    desktopMonthFilter.value = e.target.value;
    updateDashboard();
  });
}

// Sync Desktop to Mobile (optional, but good for consistency)
if (desktopYearFilter && mobileYearFilter) {
  desktopYearFilter.addEventListener('change', () => {
    mobileYearFilter.value = desktopYearFilter.value;
  });
}
if (desktopMonthFilter && mobileMonthFilter) {
  desktopMonthFilter.addEventListener('change', () => {
    mobileMonthFilter.value = desktopMonthFilter.value;
  });
}

// Tabs Logic (Restored)
const formTabs = document.querySelectorAll('.form-tab');
formTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    formTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabName = tab.getAttribute('data-tab');
    document.getElementById('expense-panel').style.display = tabName === 'expense' ? 'grid' : 'none';
    document.getElementById('income-panel').style.display = tabName === 'income' ? 'grid' : 'none';
    const transferPanel = document.getElementById('transfer-panel');
    if (transferPanel) transferPanel.style.display = tabName === 'transfer' ? 'grid' : 'none';
  });
});

// Internal Tabs (Investments)
const internalTabs = document.querySelectorAll('[data-tab-internal]');
internalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    internalTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const panelName = tab.getAttribute('data-tab-internal');
    document.getElementById('portfolio-panel').style.display = panelName === 'portfolio' ? 'block' : 'none';
    document.getElementById('trades-panel').style.display = panelName === 'trades' ? 'block' : 'none';

    // Ensure data is refreshed on tab switch
  if (typeof updateSavingsUI === 'function') updateSavingsUI();
  if (panelName === 'portfolio') refreshMarketPrices();
  });
});

// ===== FILTER HELPERS =====
function getDashboardFilteredTransactions() {
  return transactions.filter(t => {
    const tDate = new Date(t.date + 'T00:00:00');
    const tYear = tDate.getFullYear().toString();
    const tMonth = (tDate.getMonth() + 1).toString().padStart(2, '0');
    const yearMatch = filterYear.value === 'all' || tYear === filterYear.value;
    const monthMatch = filterMonth.value === 'all' || tMonth === filterMonth.value;
    return yearMatch && monthMatch;
  });
}

function getDashboardFilteredSavings() {
  return savings.filter(s => {
    const sDate = new Date(s.date + 'T00:00:00');
    const sYear = sDate.getFullYear().toString();
    const sMonth = (sDate.getMonth() + 1).toString().padStart(2, '0');
    const yearMatch = filterYear.value === 'all' || sYear === filterYear.value;
    const monthMatch = filterMonth.value === 'all' || sMonth === filterMonth.value;
    return yearMatch && monthMatch;
  });
}

function getDashboardFilteredTrades() {
  return closedTrades.filter(t => {
    const tDate = new Date(t.date + 'T00:00:00');
    const tYear = tDate.getFullYear().toString();
    const tMonth = (tDate.getMonth() + 1).toString().padStart(2, '0');
    const yearMatch = filterYear.value === 'all' || tYear === filterYear.value;
    const monthMatch = filterMonth.value === 'all' || tMonth === filterMonth.value;
    return yearMatch && monthMatch;
  });
}

function populateYearFilter() {
  const allDates = [
    ...transactions.map(t => t.date),
    ...savings.map(s => s.date),
    ...closedTrades.map(t => t.date)
  ].filter(d => d);
  const years = [...new Set(allDates.map(d => new Date(d + 'T00:00:00').getFullYear()))].sort((a, b) => b - a);

  const filterYear = document.getElementById('filter-year');
  const filterYearMobile = document.getElementById('filter-year-mobile');

  if (filterYear) {
    const currentSelection = filterYear.value;
    filterYear.innerHTML = '<option value="all">Todos los años</option>';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      filterYear.appendChild(option);
    });
    if (years.includes(parseInt(currentSelection))) filterYear.value = currentSelection;
  }

  if (filterYearMobile) {
    const currentSelection = filterYearMobile.value;
    filterYearMobile.innerHTML = '<option value="all">Año: Todos</option>';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      filterYearMobile.appendChild(option);
    });
    if (years.includes(parseInt(currentSelection))) filterYearMobile.value = currentSelection;
  }
}


// ===== KPI UPDATE =====
function updateKPIs(displayTransactions, displaySavings, displayTrades) {
  // Available Cash (Transactions) - ALWAYS use all transactions to show REAL TOTAL
  const initialARS = platforms.reduce((acc, p) => acc + (parseFloat(p.initialBalance) || 0), 0);
  const initialUSD = platforms.reduce((acc, p) => acc + (parseFloat(p.initialBalanceUSD) || 0), 0);

  const allTransactionsARS = transactions.filter(t => (t.currency || 'ARS') === 'ARS');
  const allTransactionsUSD = transactions.filter(t => (t.currency || 'ARS') === 'USD');

  const totalARS = initialARS + allTransactionsARS.reduce((acc, t) => acc + t.amount, 0);
  const totalUSD = initialUSD + allTransactionsUSD.reduce((acc, t) => acc + t.amount, 0);

  // For generic Income/Expense KPIs, we use FILTERED transactions (of the selected period)
  const transactionsARS = displayTransactions.filter(t => (t.currency || 'ARS') === 'ARS');
  const incomeARS = transactionsARS.filter(t => t.amount > 0 && !t.isTransfer && !t.isInvestment).reduce((acc, t) => acc + t.amount, 0);
  const expenseARS = Math.abs(transactionsARS.filter(t => t.amount < 0 && !t.isTransfer && !t.isInvestment).reduce((acc, t) => acc + t.amount, 0));

  balance.innerText = fmt(totalARS);
  balance.style.color = totalARS >= 0 ? 'var(--income-light)' : 'var(--expense-light)';

  const balanceUsdEl = document.getElementById('balance-usd');
  const balanceUsdContainer = document.getElementById('balance-usd-container');
  if (balanceUsdEl && balanceUsdContainer) {
    if (totalUSD !== 0) {
      balanceUsdEl.innerText = `$${totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
      balanceUsdContainer.style.display = 'flex';
    } else {
      balanceUsdContainer.style.display = 'none';
    }
  }

  money_plus.innerText = '+' + fmt(incomeARS);
  money_minus.innerText = '-' + fmt(expenseARS);

  if (incomeCount) incomeCount.innerText = `${transactionsARS.filter(t => t.amount > 0 && !t.isTransfer && !t.isInvestment).length} mov. ARS`;
  if (expenseCount) expenseCount.innerText = `${transactionsARS.filter(t => t.amount < 0 && !t.isTransfer && !t.isInvestment).length} mov. ARS`;

  // USD income/expense for dashboard hero
  const transactionsUSD = displayTransactions.filter(t => (t.currency || 'ARS') === 'USD');
  const incomeUSD = transactionsUSD.filter(t => t.amount > 0 && !t.isTransfer && !t.isInvestment).reduce((acc, t) => acc + t.amount, 0);
  const expenseUSD = Math.abs(transactionsUSD.filter(t => t.amount < 0 && !t.isTransfer && !t.isInvestment).reduce((acc, t) => acc + t.amount, 0));
  const dashIncomeUsd = document.getElementById('dash-income-usd');
  const dashExpenseUsd = document.getElementById('dash-expense-usd');
  if (dashIncomeUsd) {
    dashIncomeUsd.innerText = incomeUSD > 0 ? `U$D +${incomeUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '';
    dashIncomeUsd.style.color = incomeUSD > 0 ? 'var(--income-light)' : 'var(--text-muted)';
  }
  if (dashExpenseUsd) {
    dashExpenseUsd.innerText = expenseUSD > 0 ? `U$D ${expenseUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '';
    dashExpenseUsd.style.color = expenseUSD > 0 ? 'var(--expense-light)' : 'var(--text-muted)';
  }

  const fmtSav = (val, symbol) => `${symbol}${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  // ── Portfolio Market Value & Return per Currency ──
  const rate = currentPrices?.arsUsdRate || 1;
  const mkByCur = {};
  const costByCur = {};
  (displaySavings || savings).forEach(s => {
    const cur = (s.currency || 'ARS').toUpperCase();
    const cost = parseFloat(s.price) || 0;
    costByCur[cur] = (costByCur[cur] || 0) + cost;
    const cat = s.category || '';
    const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[cat]) || 1;
    const raw = typeof getPrice === 'function' ? getPrice(s.asset, cat, currentPrices) : null;
    let curPrice = raw;
    if (raw != null && cur === 'USD' && ['bonos','on','letras'].includes(cat) && rate > 0) {
      curPrice = raw / rate;
    }
    if (curPrice != null) {
      mkByCur[cur] = (mkByCur[cur] || 0) + s.quantity * curPrice * mult;
    }
  });
  // ARS
  const costArs = costByCur['ARS'] || 0;
  const mkArs = mkByCur['ARS'] || 0;
  const retArs = costArs > 0 ? ((mkArs - costArs) / costArs) * 100 : 0;
  const mkArsEl = document.getElementById('savings-ars-market-val');
  const costArsEl = document.getElementById('savings-ars-cost');
  const retArsEl = document.getElementById('savings-ars-return');
  if (mkArsEl) mkArsEl.innerText = mkArs > 0 ? fmtSav(mkArs, '$') : '$0,00';
  if (costArsEl) {
    costArsEl.innerText = `Invertido: ${fmtSav(costArs, '$')}`;
    costArsEl.style.display = costArs > 0 ? 'block' : 'none';
  }
  if (retArsEl) {
    if (costArs > 0) {
      retArsEl.innerText = `Retorno: ${retArs >= 0 ? '+' : ''}${retArs.toFixed(2)}%`;
      retArsEl.style.color = retArs >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
      retArsEl.style.display = 'block';
    } else {
      retArsEl.style.display = 'none';
    }
  }
  // USD
  const costUsd = (costByCur['USD'] || 0) + (costByCur['USDT'] || 0);
  const mkUsd = (mkByCur['USD'] || 0) + (mkByCur['USDT'] || 0);
  const retUsd = costUsd > 0 ? ((mkUsd - costUsd) / costUsd) * 100 : 0;
  const mkUsdEl = document.getElementById('savings-usd-market-val');
  const costUsdEl = document.getElementById('savings-usd-cost');
  const retUsdEl = document.getElementById('savings-usd-return');
  if (mkUsdEl) mkUsdEl.innerText = mkUsd > 0 ? fmtSav(mkUsd, 'U$D ') : 'U$D 0,00';
  if (costUsdEl) {
    costUsdEl.innerText = `Invertido: ${fmtSav(costUsd, 'U$D ')}`;
    costUsdEl.style.display = costUsd > 0 ? 'block' : 'none';
  }
  if (retUsdEl) {
    if (costUsd > 0) {
      retUsdEl.innerText = `Retorno: ${retUsd >= 0 ? '+' : ''}${retUsd.toFixed(2)}%`;
      retUsdEl.style.color = retUsd >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
      retUsdEl.style.display = 'block';
    } else {
      retUsdEl.style.display = 'none';
    }
  }

  // ── Realized P&L (Dashboard KPIs) ──
  const tradesARS = (displayTrades || []).filter(t => (t.currency || 'ARS') === 'ARS');
  const pnlARS = tradesARS.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const costARS = tradesARS.reduce((acc, t) => acc + (t.costBasis || 0), 0);
  const pnlPctARS = costARS > 0 ? (pnlARS / costARS) * 100 : 0;
  const pnlArsEl = document.getElementById('pnl-realized-ars');
  const pnlPctArsEl = document.getElementById('pnl-percent-ars');
  if (pnlArsEl) {
    pnlArsEl.innerText = fmt(pnlARS);
    pnlArsEl.style.color = pnlARS >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }
  if (pnlPctArsEl) {
    pnlPctArsEl.innerText = `${pnlPctARS >= 0 ? '+' : ''}${pnlPctARS.toFixed(2)}% pnl`;
    pnlPctArsEl.style.color = pnlPctARS >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }
  const tradesUSD = (displayTrades || []).filter(t => (t.currency || 'ARS') === 'USD' || (t.currency || 'ARS') === 'USDT');
  const pnlUSD = tradesUSD.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const costUSD = tradesUSD.reduce((acc, t) => acc + (t.costBasis || 0), 0);
  const pnlPctUSD = costUSD > 0 ? (pnlUSD / costUSD) * 100 : 0;
  const pnlUsdEl = document.getElementById('pnl-realized-usd');
  const pnlPctUsdEl = document.getElementById('pnl-percent-usd');
  if (pnlUsdEl) {
    pnlUsdEl.innerText = `U$D ${pnlUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    pnlUsdEl.style.color = pnlUSD >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }
  if (pnlPctUsdEl) {
    pnlPctUsdEl.innerText = `${pnlPctUSD >= 0 ? '+' : ''}${pnlPctUSD.toFixed(2)}% pnl`;
    pnlPctUsdEl.style.color = pnlPctUSD >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }

  // ── Dashboard Hero Portfolio cards + Rendimiento ──
  const dashPortArs = document.getElementById('dash-portfolio-ars');
  const dashPortArsCost = document.getElementById('dash-portfolio-ars-cost');
  const dashPortArsRet = document.getElementById('dash-portfolio-ars-return');
  const dashPortUsd = document.getElementById('dash-portfolio-usd');
  const dashPortUsdCost = document.getElementById('dash-portfolio-usd-cost');
  const dashPortUsdRet = document.getElementById('dash-portfolio-usd-return');

  if (dashPortArs) dashPortArs.innerText = mkArs > 0 ? fmtSav(mkArs, '$') : '$0,00';
  if (dashPortArsCost) {
    dashPortArsCost.innerText = `Invertido: ${fmtSav(costArs, '$')}`;
    dashPortArsCost.style.display = costArs > 0 ? 'inline' : 'none';
  }
  if (dashPortArsRet) {
    if (costArs > 0) {
      dashPortArsRet.innerText = `Retorno: ${retArs >= 0 ? '+' : ''}${retArs.toFixed(2)}%`;
      dashPortArsRet.style.color = retArs >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
      dashPortArsRet.style.display = 'inline';
    } else {
      dashPortArsRet.style.display = 'none';
    }
  }

  if (dashPortUsd) dashPortUsd.innerText = mkUsd > 0 ? fmtSav(mkUsd, 'U$D ') : 'U$D 0,00';
  if (dashPortUsdCost) {
    dashPortUsdCost.innerText = `Invertido: ${fmtSav(costUsd, 'U$D ')}`;
    dashPortUsdCost.style.display = costUsd > 0 ? 'inline' : 'none';
  }
  if (dashPortUsdRet) {
    if (costUsd > 0) {
      dashPortUsdRet.innerText = `Retorno: ${retUsd >= 0 ? '+' : ''}${retUsd.toFixed(2)}%`;
      dashPortUsdRet.style.color = retUsd >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
      dashPortUsdRet.style.display = 'inline';
    } else {
      dashPortUsdRet.style.display = 'none';
    }
  }
}

// ===== CHARTS =====
let balanceEvolutionChartInstance = null;
let dashSavingsChartInstance = null;
let dashSavingsQtyChartInstance = null;
let pnlByAssetChartInstance = null;

function updateCharts(displayTransactions, displaySavings) {
  const monthlyCanvas = document.getElementById('monthlyChart');
  const dashSavingsCanvas = document.getElementById('dashSavingsChart');
  const dashSavingsQtyCanvas = document.getElementById('dashSavingsQtyChart');

  if (!monthlyCanvas) return;
  const palette = ['#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

  // Monthly Bar Chart
  const monthlyData = {};
  displayTransactions.forEach(t => {
    if (t.isTransfer || t.isInvestment) return;
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
    if (t.amount > 0) monthlyData[month].income += t.amount;
    else monthlyData[month].expense += Math.abs(t.amount);
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleString('es-ES', {
      month: 'short',
      year: filterYear.value === 'all' ? '2-digit' : undefined
    });
  });

  if (monthlyChartInstance) monthlyChartInstance.destroy();
  if (sortedMonths.length > 0) {
    monthlyChartInstance = new Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'Ingresos',
            data: sortedMonths.map(m => monthlyData[m].income),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderRadius: 8,
            borderSkipped: false
          },
          {
            label: 'Gastos',
            data: sortedMonths.map(m => monthlyData[m].expense),
            backgroundColor: 'rgba(244, 63, 94, 0.8)',
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(6,9,20,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            padding: 14,
            cornerRadius: 12,
            displayColors: true,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 11, family: 'Inter' } },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#64748b',
              font: { size: 10, family: 'Inter' },
              callback: (v) => '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
            },
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            border: { display: false }
          }
        },
        interaction: { intersect: false, mode: 'index' },
        datasets: { bar: { maxBarThickness: 36, categoryPercentage: 0.6, barPercentage: 0.85 } }
      }
    });
  }

  // ── Rendimiento por Activo (% ganancia no realizada) ──
  if (dashSavingsCanvas) {
    const rate = currentPrices?.arsUsdRate || 1;
    const assetAgg = {};
    (displaySavings || savings).forEach(s => {
      const cost = parseFloat(s.price) || 0;
      const cat = s.category || '';
      const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[cat]) || 1;
      const cur = (s.currency || 'ARS').toUpperCase();
      const raw = typeof getPrice === 'function' ? getPrice(s.asset, cat, currentPrices) : null;
      let curPrice = raw;
      if (raw != null && cur === 'USD' && ['bonos','on','letras'].includes(cat) && rate > 0) {
        curPrice = raw / rate;
      }
      if (!assetAgg[s.asset]) assetAgg[s.asset] = { cost: 0, mktVal: 0 };
      assetAgg[s.asset].cost += cost;
      if (curPrice != null) {
        assetAgg[s.asset].mktVal += s.quantity * curPrice * mult;
      } else {
        assetAgg[s.asset].mktVal += cost;
      }
    });

    if (dashSavingsChartInstance) dashSavingsChartInstance.destroy();

    const entries = Object.entries(assetAgg).map(([asset, d]) => ({
      asset,
      val: d.mktVal - d.cost,
      pct: d.cost > 0 ? ((d.mktVal - d.cost) / d.cost) * 100 : 0
    })).filter(e => e.val !== 0);
    const labels = entries.map(e => `${e.asset} (${e.pct >= 0 ? '+' : ''}${e.pct.toFixed(1)}%)`);
    const values = entries.map(e => Math.abs(e.val));
    const barColors = entries.map(e => e.val >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(244, 63, 94, 0.8)');

    if (labels.length > 0) {
      dashSavingsChartInstance = new Chart(dashSavingsCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: barColors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(6,9,20,0.95)',
              callbacks: {
                label: (ctx) => ` ${ctx.label}`
              }
            }
          },
          cutout: '72%'
        }
      });
    }
  }

  // Portfolio Distribution by Asset Type (%)
  if (dashSavingsQtyCanvas) {
    const categoryNames = {
      'crypto-ars': 'Crypto (ARS)',
      'acciones': 'Acciones',
      'bonos': 'Bonos',
      'fondos': 'Fondos',
      'crypto-global': 'Crypto Global'
    };

    const categoryData = {};
    (displaySavings || savings).forEach(s => {
      const val = parseFloat(s.price) || 0;
      categoryData[s.category] = (categoryData[s.category] || 0) + val;
    });

    const labels = Object.keys(categoryData).map(c => categoryNames[c] || c);
    const values = Object.values(categoryData);
    const total = values.reduce((a, b) => a + b, 0);
    const percentages = total > 0 ? values.map(v => ((v / total) * 100).toFixed(1)) : values.map(() => '0');

    if (dashSavingsQtyChartInstance) dashSavingsQtyChartInstance.destroy();

    if (labels.length > 0) {
      dashSavingsQtyChartInstance = new Chart(dashSavingsQtyCanvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: percentages,
            backgroundColor: palette,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(6,9,20,0.95)',
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`
              }
            }
          },
          cutout: '72%'
        }
      });
    }
  }
}

// ===== P&L POR ACTIVO CHART =====
function updatePnLByAssetChart(displayTrades) {
  const canvas = document.getElementById('pnlByAssetChart');
  if (!canvas) return;
  if (pnlByAssetChartInstance) pnlByAssetChartInstance.destroy();

  const trades = displayTrades || [];
  if (trades.length === 0) {
    if (pnlByAssetChartInstance) pnlByAssetChartInstance.destroy();
    return;
  }

  const pnlByAsset = {};
  trades.forEach(t => {
    const asset = t.asset || 'S/T';
    pnlByAsset[asset] = (pnlByAsset[asset] || 0) + (t.pnl || 0);
  });

  let entries = Object.entries(pnlByAsset).sort((a, b) => a[1] - b[1]);
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  pnlByAssetChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(244, 63, 94, 0.8)'),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(6,9,20,0.95)',
          padding: 14,
          cornerRadius: 12,
          callbacks: {
            label: (ctx) => ` $${ctx.parsed.x.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'Inter' },
            callback: (v) => '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
          },
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          border: { display: false }
        },
        y: {
          ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter' } },
          grid: { display: false },
          border: { display: false }
        }
      },
      datasets: { bar: { maxBarThickness: 24 } }
    }
  });
}

// ===== BALANCE EVOLUTION CHART =====
function updateBalanceEvolutionChart(displayTransactions) {
  const canvas = document.getElementById('balanceEvolutionChart');
  if (!canvas) return;

  // Determine date range based on filters
  let startDate = null;
  let endDate = null;

  if (filterYear.value !== 'all') {
    const year = parseInt(filterYear.value);
    if (filterMonth.value !== 'all') {
      const month = parseInt(filterMonth.value) - 1;
      startDate = new Date(year, month, 1, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }
  } else if (filterMonth.value !== 'all') {
    const month = parseInt(filterMonth.value) - 1;
    const year = new Date().getFullYear();
    startDate = new Date(year, month, 1, 0, 0, 0);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  } else {
    // No filter: use all transactions
    startDate = new Date('2000-01-01');
    endDate = new Date();
  }

  // Filter transactions within date range
  const history = transactions
    .filter(t => {
      const tDate = new Date(t.date + 'T00:00:00');
      return tDate >= startDate && tDate <= endDate;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (history.length === 0) {
    if (balanceEvolutionChartInstance) balanceEvolutionChartInstance.destroy();
    return;
  }

  // Build evolution data
  const evolution = {};
  let runningBalance = 0;
  history.forEach(t => {
    runningBalance += t.amount;
    evolution[t.date] = runningBalance;
  });

  const labels = Object.keys(evolution);
  const data = Object.values(evolution);

  if (balanceEvolutionChartInstance) balanceEvolutionChartInstance.destroy();
  if (labels.length > 0) {
    balanceEvolutionChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.map(d => fmtDate(d)),
        datasets: [{
          label: 'Evolución de Saldo',
          data: data,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHitRadius: 10,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            left: 0,
            right: 0,
            top: 10,
            bottom: 0
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(6,9,20,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` Saldo: $${ctx.parsed.y.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            display: false,
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (v) => '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false }
          }
        }
      }
    });
  }
}


// ===== SAVINGS LOGIC =====
const saveForm = document.getElementById('savings-form');
const saveAsset = document.getElementById('savings-asset');
const savePlatform = document.getElementById('savings-platform-select');
const saveQuantity = document.getElementById('savings-quantity');
const saveAmount = document.getElementById('savings-amount');
const saveDate = document.getElementById('savings-date');
const savePriceDisplay = document.getElementById('savings-price-display');
const saveTableBody = document.querySelector('tbody'); // We'll find it by context if multiple
let savingsAssetChartInstance = null;
let savingsQtyChartInstance = null;
let savingsAssetDonutInstance = null;
let selectedSavingsIds = [];

if (saveQuantity && saveAmount) {
  [saveQuantity, saveAmount].forEach(input => {
    input.addEventListener('input', () => {
      const q = parseFloat(saveQuantity.value) || 0;
      const a = parseFloat(saveAmount.value) || 0;
      const p = q > 0 ? a / q : 0;
      savePriceDisplay.value = fmt(p);
    });
  });
}

// FCI search
const saveCategory = document.getElementById('savings-category');
const btnSearchFci = document.getElementById('btn-search-fci');
const fciResults = document.getElementById('fci-search-results');
let allFciData = null;

function toggleFciSearchBtn() {
  if (btnSearchFci) {
    btnSearchFci.style.display = saveCategory?.value === 'fondos' ? 'inline-block' : 'none';
  }
  if (fciResults) fciResults.style.display = 'none';
}

if (saveCategory) {
  saveCategory.addEventListener('change', toggleFciSearchBtn);
}

if (btnSearchFci) {
  btnSearchFci.addEventListener('click', async () => {
    if (!fciResults) return;
    fciResults.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;text-align:center;">Cargando...</div>';
    fciResults.style.display = 'block';
    try {
      if (!allFciData) {
        if (typeof fetchAllFci === 'function') {
          allFciData = await fetchAllFci();
        }
      }
      if (!allFciData || allFciData.length === 0) {
        fciResults.innerHTML = '<div style="padding:8px;color:var(--expense-light);font-size:0.8rem;text-align:center;">Sin datos disponibles</div>';
        return;
      }
      const names = allFciData.map(f => f.fondo).filter(Boolean);
      renderFciResults(names, '');
    } catch (e) {
      fciResults.innerHTML = '<div style="padding:8px;color:var(--expense-light);font-size:0.8rem;text-align:center;">Error al obtener datos</div>';
    }
  });
}

function renderFciResults(names, filter) {
  if (!fciResults) return;
  const q = filter.toLowerCase().trim();
  const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;

  // Build filter bar only once
  if (!fciResults.querySelector('#fci-filter-input')) {
    const bar = document.createElement('div');
    bar.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;';
    bar.innerHTML = '<input type="text" id="fci-filter-input" placeholder="Filtrar fondos..." style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:0.8rem;box-sizing:border-box;">';
    fciResults.prepend(bar);
    bar.querySelector('#fci-filter-input').addEventListener('input', (e) => {
      renderFciResults(names, e.target.value);
    });
    bar.querySelector('#fci-filter-input').focus();
  }

  // Build results list
  const listContainer = document.createElement('div');
  listContainer.className = 'fci-list';
  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;text-align:center;">Sin resultados</div>';
  } else {
    const max = 80;
    const list = filtered.slice(0, max);
    for (const name of list) {
      const display = name.length > 60 ? name.substring(0, 57) + '...' : name;
      const el = document.createElement('div');
      el.className = 'fci-result-item';
      el.dataset.name = name;
      el.textContent = display;
      el.style.cssText = 'padding:6px 8px;cursor:pointer;border-radius:4px;font-size:0.8rem;color:var(--text);';
      el.addEventListener('click', () => {
        if (saveAsset) saveAsset.value = el.dataset.name;
        fciResults.style.display = 'none';
      });
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.05)');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
      listContainer.appendChild(el);
    }
    if (filtered.length > max) {
      const more = document.createElement('div');
      more.style.cssText = 'padding:6px 8px;font-size:0.7rem;color:var(--text-muted);text-align:center;';
      more.textContent = `... y ${filtered.length - max} más`;
      listContainer.appendChild(more);
    }
  }

  // Replace old list
  const oldList = fciResults.querySelector('.fci-list');
  if (oldList) oldList.remove();
  fciResults.appendChild(listContainer);
}

// Also toggle on page load
toggleFciSearchBtn();

// ── Edit form FCI search ──
const editCategory = document.getElementById('edit-savings-category');
const btnEditSearchFci = document.getElementById('btn-edit-search-fci');
const editFciResults = document.getElementById('edit-fci-search-results');

function toggleEditFciSearchBtn() {
  if (btnEditSearchFci) {
    btnEditSearchFci.style.display = editCategory?.value === 'fondos' ? 'inline-block' : 'none';
  }
  if (editFciResults) editFciResults.style.display = 'none';
}

if (editCategory) {
  editCategory.addEventListener('change', toggleEditFciSearchBtn);
}

if (btnEditSearchFci) {
  btnEditSearchFci.addEventListener('click', async () => {
    if (!editFciResults) return;
    editFciResults.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;text-align:center;">Cargando...</div>';
    editFciResults.style.display = 'block';
    try {
      if (!allFciData) {
        if (typeof fetchAllFci === 'function') {
          allFciData = await fetchAllFci();
        }
      }
      if (!allFciData || allFciData.length === 0) {
        editFciResults.innerHTML = '<div style="padding:8px;color:var(--expense-light);font-size:0.8rem;text-align:center;">Sin datos disponibles</div>';
        return;
      }
      const names = allFciData.map(f => f.fondo).filter(Boolean);
      renderEditFciResults(names, '');
    } catch (e) {
      editFciResults.innerHTML = '<div style="padding:8px;color:var(--expense-light);font-size:0.8rem;text-align:center;">Error al obtener datos</div>';
    }
  });
}

function renderEditFciResults(names, filter) {
  if (!editFciResults) return;
  const q = filter.toLowerCase().trim();
  const filtered = q ? names.filter(n => n.toLowerCase().includes(q)) : names;

  if (!editFciResults.querySelector('#edit-fci-filter-input')) {
    const bar = document.createElement('div');
    bar.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:4px;';
    bar.innerHTML = '<input type="text" id="edit-fci-filter-input" placeholder="Filtrar fondos..." style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:0.8rem;box-sizing:border-box;">';
    editFciResults.prepend(bar);
    bar.querySelector('#edit-fci-filter-input').addEventListener('input', (e) => {
      renderEditFciResults(names, e.target.value);
    });
    bar.querySelector('#edit-fci-filter-input').focus();
  }

  const listContainer = document.createElement('div');
  listContainer.className = 'edit-fci-list';
  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;text-align:center;">Sin resultados</div>';
  } else {
    const max = 80;
    const list = filtered.slice(0, max);
    for (const name of list) {
      const display = name.length > 60 ? name.substring(0, 57) + '...' : name;
      const el = document.createElement('div');
      el.className = 'edit-fci-result-item';
      el.dataset.name = name;
      el.textContent = display;
      el.style.cssText = 'padding:6px 8px;cursor:pointer;border-radius:4px;font-size:0.8rem;color:var(--text);';
      el.addEventListener('click', () => {
        const editAsset = document.getElementById('edit-savings-asset');
        if (editAsset) editAsset.value = el.dataset.name;
        editFciResults.style.display = 'none';
      });
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.05)');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
      listContainer.appendChild(el);
    }
    if (filtered.length > max) {
      const more = document.createElement('div');
      more.style.cssText = 'padding:6px 8px;font-size:0.7rem;color:var(--text-muted);text-align:center;';
      more.textContent = `... y ${filtered.length - max} más`;
      listContainer.appendChild(more);
    }
  }

  const oldList = editFciResults.querySelector('.edit-fci-list');
  if (oldList) oldList.remove();
  editFciResults.appendChild(listContainer);
}

// Patch openEditModal to toggle search btn after setting category
const origOpenEditModal = openEditModal;
openEditModal = function(id) {
  origOpenEditModal(id);
  // Use a small delay to let the DOM update
  setTimeout(toggleEditFciSearchBtn, 0);
};

// Sale Modal Preview Logic
const saleQtyInput = document.getElementById('sale-savings-quantity');
const saleAmountInput = document.getElementById('sale-savings-amount');
const saleCurrencySelect = document.getElementById('sale-savings-currency');
const pnlPreview = document.getElementById('pnl-preview');
const pnlAmountDisplay = document.getElementById('pnl-amount-display');
const pnlPercentDisplay = document.getElementById('pnl-percent-display');

function updateSalePNL() {
  const id = parseInt(document.getElementById('sale-savings-id').value);
  const item = savings.find(s => s.id === id);
  if (!item) return;

  const sellQty = parseFloat(saleQtyInput.value) || 0;
  const sellAmount = parseFloat(saleAmountInput.value) || 0;

  if (sellQty > 0 && sellAmount > 0) {
    const costBasisPerUnit = item.price / item.quantity;
    const costOfSoldPortion = costBasisPerUnit * sellQty;
    const pnl = sellAmount - costOfSoldPortion;
    const pnlPercent = (pnl / costOfSoldPortion) * 100;

    pnlPreview.style.display = 'block';
    pnlAmountDisplay.innerText = fmt(pnl);
    pnlPercentDisplay.innerText = (pnl >= 0 ? '+' : '') + pnlPercent.toFixed(2) + '%';

    const color = pnl >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    pnlAmountDisplay.style.color = color;
    pnlPercentDisplay.style.color = color;
    pnlPreview.style.borderColor = pnl >= 0 ? 'var(--income)' : 'var(--expense)';
    pnlPreview.style.background = pnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';
  } else {
    pnlPreview.style.display = 'none';
  }
}

if (saleQtyInput && saleAmountInput) {
  [saleQtyInput, saleAmountInput].forEach(input => {
    input.addEventListener('input', updateSalePNL);
  });
}

if (saveForm) {
  saveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = parseFloat(saveQuantity.value) || 0;
    const a = parseFloat(saveAmount.value) || 0;
    const p = q > 0 ? a / q : 0;

    const item = {
      id: generateID(),
      asset: saveAsset.value.toUpperCase(),
      platform: document.getElementById('savings-platform-select').value,
      category: document.getElementById('savings-category').value,
      quantity: q,
      price: a, // now stores Total Amount
      currency: document.getElementById('savings-currency').value || 'ARS',
      date: saveDate.value
    };
    savings.push(item);

    // Create expense transaction to deduct from available balance
    const expenseTransaction = {
      id: generateID(),
      text: `Inversión en ${saveAsset.value.toUpperCase()}`,
      amount: -a, // Negative amount for expense
      date: saveDate.value,
      platform: document.getElementById('savings-platform-select').value,
      currency: document.getElementById('savings-currency').value || 'ARS',
      isInvestment: true
    };
    transactions.push(expenseTransaction);

    updateLocalStorage();
    saveForm.reset();
    saveDate.valueAsDate = new Date();
    savePriceDisplay.value = '$0,00';
    updateSavingsUI();
    updateDashboard();
  });
}

function openSaleModal(id) {
  const item = savings.find(s => s.id === id);
  if (!item) return;

  document.getElementById('sale-savings-id').value = item.id;
  document.getElementById('sale-asset-name').innerText = item.asset;
  document.getElementById('sale-max-qty').innerText = `${item.quantity} uds.`;

  const costBasis = item.price / item.quantity;
  document.getElementById('sale-cost-basis').innerText = `${fmt(costBasis)} (${item.currency})`;

  document.getElementById('sale-savings-quantity').value = item.quantity;
  document.getElementById('sale-savings-amount').value = '';
  document.getElementById('sale-savings-currency').value = item.currency;
  document.getElementById('sale-savings-date').valueAsDate = new Date();

  document.getElementById('pnl-preview').style.display = 'none';
  document.getElementById('sale-savings-modal').style.display = 'flex';
}

function closeSaleModal() {
  document.getElementById('sale-savings-modal').style.display = 'none';
}

const saleForm = document.getElementById('sale-savings-form');
if (saleForm) {
  saleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('sale-savings-id').value);
    const sellQty = parseFloat(document.getElementById('sale-savings-quantity').value);
    const sellAmount = parseFloat(document.getElementById('sale-savings-amount').value);
    const sellDate = document.getElementById('sale-savings-date').value;
    const sellCurrency = document.getElementById('sale-savings-currency').value;

    const index = savings.findIndex(s => s.id === id);
    if (index === -1) return;

    const item = savings[index];

    // Calculate PNL for history text
    const costBasisPerUnit = item.price / item.quantity;
    const costOfSoldPortion = costBasisPerUnit * sellQty;
    const pnl = sellAmount - costOfSoldPortion;
    const pnlPercent = (pnl / costOfSoldPortion) * 100;

    // 1. Record the Sale as a Closed Trade (NOT as general income)
    const closedTrade = {
      id: generateID(),
      asset: item.asset,
      quantitySold: sellQty,
      receivedAmount: sellAmount,
      costBasis: costOfSoldPortion,
      pnl: pnl,
      pnlPercent: pnlPercent,
      date: sellDate,
      platform: item.platform,
      currency: item.currency // Use original purchase currency
    };
    closedTrades.push(closedTrade);

    // 2. Record capital return (cost basis) + realized gain/loss
    transactions.push({
      id: generateID(),
      text: `Retorno capital - ${item.asset}`,
      amount: costOfSoldPortion,
      date: sellDate,
      platform: item.platform,
      currency: sellCurrency,
      isInvestment: true
    });
    if (pnl !== 0) {
      transactions.push({
        id: generateID(),
        text: pnl > 0 ? `Ganancia venta ${item.asset}` : `Pérdida venta ${item.asset}`,
        amount: pnl,
        date: sellDate,
        platform: item.platform,
        currency: sellCurrency
      });
    }

    // 3. Update Savings (Active Portfolio)
    if (sellQty >= item.quantity) {
      savings.splice(index, 1);
    } else {
      const remainingRatio = (item.quantity - sellQty) / item.quantity;
      item.price = item.price * remainingRatio;
      item.quantity = item.quantity - sellQty;
    }

    updateLocalStorage();
    updateSavingsUI();
    updateDashboard();
    closeSaleModal();
  });
}


function updateSavingsUI() {
  const tableBody = document.getElementById('inv-table-body'); // Still using this ID from template
  if (!tableBody) return;
  tableBody.innerHTML = '';

  let sorted = [...savings].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted = applySavingsFilters(sorted);

  // Populate platform filter dropdown with real data
  updateSavingsFilterPlatformDropdown();

  let totalValueByCurrency = {};
  const assetsData = {};
  const assetsQtyData = {};
  const assetsCurrencyData = {};
  const assetsCategoryData = {};

  sorted.forEach(s => {
    const costTotal = parseFloat(s.price) || 0;
    const cur = (s.currency || 'ARS').toUpperCase();

    totalValueByCurrency[cur] = (totalValueByCurrency[cur] || 0) + costTotal;
    assetsData[s.asset] = (assetsData[s.asset] || 0) + costTotal;
    assetsQtyData[s.asset] = (assetsQtyData[s.asset] || 0) + s.quantity;
    assetsCurrencyData[s.asset] = cur;
    assetsCategoryData[s.asset] = s.category || '';

    const category = s.category || '';
    const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[category]) || 1;
    const rawPrice = currentPrices && typeof getPrice === 'function' ? getPrice(s.asset, category, currentPrices) : null;
    const currentPrice = rawPrice != null && s.currency === 'USD' && ['bonos','on','letras'].includes(category) && currentPrices?.arsUsdRate
      ? rawPrice / currentPrices.arsUsdRate : rawPrice;
    const currentValue = currentPrice != null ? s.quantity * currentPrice * mult : null;
    const gainLoss = (currentValue != null && costTotal) ? currentValue - costTotal : null;

    const priceDecimals = category === 'fondos' ? 4 : 2;
    const priceFmt = currentPrice != null
      ? `$${currentPrice.toLocaleString('es-AR', { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}`
      : '<span style="color:var(--text-muted)">—</span>';
    const valueFmt = currentValue != null ? fmt(currentValue) : '<span style="color:var(--text-muted)">—</span>';
    const gainPct = (gainLoss != null && costTotal > 0) ? (gainLoss / costTotal) * 100 : null;
    const gainColor = gainLoss != null ? (gainLoss >= 0 ? 'var(--income-light)' : 'var(--expense-light)') : 'var(--text-muted)';
    const gainSign = gainLoss != null ? (gainLoss >= 0 ? '+' : '') : '';
    const gainFmt = gainLoss != null
      ? `<span style="color:${gainColor};font-weight:600;">${gainSign}${fmt(gainLoss)}</span><br><span style="color:${gainColor};font-size:0.7rem;">${gainPct != null ? `${gainSign}${gainPct.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2})}%` : ''}</span><span style="font-size:0.5rem;font-weight:700;padding:1px 3px;border-radius:2px;margin-left:3px;${(s.currency || 'ARS') === 'USD' ? 'background:rgba(16,185,129,0.15);color:var(--income-light);' : 'background:rgba(99,102,241,0.15);color:#818cf8;'}">${(s.currency || 'ARS') === 'USD' ? 'USD' : 'ARS'}</span>`
      : '<span style="color:var(--text-muted)">—</span>';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';

    // Category Badge
    const catLabel = s.category ? s.category.replace('-', ' ') : 'S/T';
    const catClass = s.category ? '' : 'warning';

    const isSelected = selectedSavingsIds.includes(s.id);
    if (isSelected) tr.classList.add('selected');

    const days = getDaysHeld(s.date);
    const daysColor = getDaysColor(days);
    const daysDisplay = days >= 0
      ? `<span style="font-size:0.65rem;color:${daysColor};font-weight:700;margin-left:4px;">${days}d</span>`
      : '';

    tr.innerHTML = `
            <td style="padding: 1rem;">
                <input type="checkbox" class="custom-checkbox row-checkbox" data-id="${s.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td style="padding: 1rem; white-space: nowrap;">${fmtDate(s.date)}${daysDisplay}</td>
            <td style="padding: 1rem; font-weight: 700; color: var(--primary-light);">${s.asset}</td>
            <td style="padding: 1rem;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span class="category-badge ${catClass}" style="width:fit-content;">${catLabel}</span>
                    <span style="font-size:0.75rem; color:var(--text-soft); font-weight:600;">${s.platform || 'S/P'}</span>
                </div>
            </td>
            <td style="padding: 1rem; text-align: right;">${s.quantity}</td>
            <td style="padding: 1rem; text-align: right; font-weight: 700;">${fmt(costTotal)}</td>
            <td style="padding: 1rem; text-align: right;">${priceFmt}</td>
            <td style="padding: 1rem; text-align: right;">${valueFmt}</td>
            <td style="padding: 1rem; text-align: right;">${gainFmt}</td>
            <td style="padding: 1.25rem 1rem; display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                <button class="btn-icon" style="color: var(--income-light);" onclick="openSaleModal(${s.id})" title="Informar Venta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                </button>
                <button class="btn-icon" onclick="openEditModal(${s.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                <button class="delete-table-btn" onclick="removeSavings(${s.id})">✕</button>
            </td>
        `;

    // Add checkbox listener
    const cb = tr.querySelector('.row-checkbox');
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      if (e.target.checked) {
        if (!selectedSavingsIds.includes(id)) selectedSavingsIds.push(id);
      } else {
        selectedSavingsIds = selectedSavingsIds.filter(sid => sid !== id);
      }
      updateBulkToolbar();
      updateSavingsUI(); // Refresh to update "Select All" state if needed
    });

    tableBody.appendChild(tr);
  });

  updateBulkToolbar();

  // Aggregate stats strings for currency separation
  const fmtCurrencyMap = (map) => {
    const entries = Object.entries(map);
    if (entries.length === 0) return '$0,00';
    return entries.map(([cur, val]) => {
      const symbol = cur === 'USD' ? 'U$D ' : '$';
      return `${symbol}${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }).join(' / ');
  };

  const fmtSimple = (val, symbol) => `${symbol}${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  // Populate New KPI Cards
  const kpiTotalArs = document.getElementById('savings-kpi-total-ars');
  const kpiTotalUsd = document.getElementById('savings-kpi-total-usd');
  const kpiActualArs = document.getElementById('savings-kpi-actual-ars');
  const kpiActualUsd = document.getElementById('savings-kpi-actual-usd');
  const kpiPnlArs = document.getElementById('savings-kpi-pnl-ars');
  const kpiPnlUsd = document.getElementById('savings-kpi-pnl-usd');
  const kpiCount = document.getElementById('savings-kpi-count');

  // Build filtered savings/trades for hero banner (respects dashboard year/month filters + savings table filters)
  const dashFilterYear = document.getElementById('filter-year');
  const dashFilterMonth = document.getElementById('filter-month');
  const filteredSavings = applySavingsFilters([...savings]).filter(s => {
    if (!dashFilterYear || !dashFilterMonth) return true;
    const sDate = new Date(s.date + 'T00:00:00');
    const sYear = sDate.getFullYear().toString();
    const sMonth = (sDate.getMonth() + 1).toString().padStart(2, '0');
    const yearMatch = dashFilterYear.value === 'all' || sYear === dashFilterYear.value;
    const monthMatch = dashFilterMonth.value === 'all' || sMonth === dashFilterMonth.value;
    return yearMatch && monthMatch;
  });

  // Total Invertido (filter-aware)
  if (kpiTotalArs) {
    const filteredTotalArs = filteredSavings.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0);
    const totalArs = totalValueByCurrency['ARS'] || 0;
    kpiTotalArs.innerText = fmtSimple(dashFilterYear?.value !== 'all' ? filteredTotalArs : totalArs, '$');
  }
  if (kpiTotalUsd) {
    const filteredTotalUsd = filteredSavings.reduce((acc, s) => {
      const cur = (s.currency || 'ARS').toUpperCase();
      return cur === 'USD' || cur === 'USDT' ? acc + (parseFloat(s.price) || 0) : acc;
    }, 0);
    const totalUsd = totalValueByCurrency['USD'] || 0;
    kpiTotalUsd.innerText = fmtSimple(dashFilterYear?.value !== 'all' ? filteredTotalUsd : totalUsd, 'U$D ');
  }

  // Valor Actual (market value) — filtered by dashboard filters
  let actualByCurrency = {};
  filteredSavings.forEach(s => {
    const cur = (s.currency || 'ARS').toUpperCase();
    const costTotal = parseFloat(s.price) || 0;
    const category = s.category || '';
    const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[category]) || 1;
    const rawPrice = currentPrices && typeof getPrice === 'function' ? getPrice(s.asset, category, currentPrices) : null;
    const currentPrice = rawPrice != null && cur === 'USD' && ['bonos','on','letras'].includes(category) && currentPrices?.arsUsdRate
      ? rawPrice / currentPrices.arsUsdRate : rawPrice;
    if (currentPrice != null) {
      const currentValue = s.quantity * currentPrice * mult;
      actualByCurrency[cur] = (actualByCurrency[cur] || 0) + currentValue;
    } else {
      actualByCurrency[cur] = (actualByCurrency[cur] || 0) + costTotal;
    }
  });
  if (kpiActualArs) kpiActualArs.innerText = fmtSimple(actualByCurrency['ARS'] || 0, '$');
  if (kpiActualUsd) kpiActualUsd.innerText = fmtSimple(actualByCurrency['USD'] || 0, 'U$D ');

  if (kpiCount) {
    const uniqueAssets = [...new Set(filteredSavings.map(s => s.asset))];
    kpiCount.innerText = uniqueAssets.length;
  }

  if (kpiPnlArs || kpiPnlUsd) {
    const closedFiltered = closedTrades.filter(t => {
      if (!dashFilterYear || !dashFilterMonth) return true;
      const tDate = new Date(t.date + 'T00:00:00');
      const tYear = tDate.getFullYear().toString();
      const tMonth = (tDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMatch = dashFilterYear.value === 'all' || tYear === dashFilterYear.value;
      const monthMatch = dashFilterMonth.value === 'all' || tMonth === dashFilterMonth.value;
      return yearMatch && monthMatch;
    });
    const pnlByCurrencyTotal = {};
    closedFiltered.forEach(t => {
      const cur = (t.currency || 'ARS').toUpperCase();
      const pVal = parseFloat(t.pnl) || 0;
      pnlByCurrencyTotal[cur] = (pnlByCurrencyTotal[cur] || 0) + pVal;
    });

    if (kpiPnlArs) {
      const v = pnlByCurrencyTotal['ARS'] || 0;
      kpiPnlArs.innerText = fmtSimple(v, '$');
      kpiPnlArs.style.color = v >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    }
    if (kpiPnlUsd) {
      const v = pnlByCurrencyTotal['USD'] || 0;
      kpiPnlUsd.innerText = fmtSimple(v, 'U$D ');
      kpiPnlUsd.style.color = v >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    }
  }

  // Unrealized P&L
  const kpiUnrealizedArs = document.getElementById('savings-kpi-unrealized-ars');
  const kpiUnrealizedUsd = document.getElementById('savings-kpi-unrealized-usd');
  const kpiReturnArs = document.getElementById('savings-kpi-return-ars');
  const kpiReturnUsd = document.getElementById('savings-kpi-return-usd');

  let unrealizedByCurrency = {};
  let totalCostByCurrency = {};
  filteredSavings.forEach(s => {
    const cur = (s.currency || 'ARS').toUpperCase();
    const costTotal = parseFloat(s.price) || 0;
    const category = s.category || '';
    const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[category]) || 1;
    const rawPrice = currentPrices && typeof getPrice === 'function' ? getPrice(s.asset, category, currentPrices) : null;
    const currentPrice = rawPrice != null && cur === 'USD' && ['bonos','on','letras'].includes(category) && currentPrices?.arsUsdRate
      ? rawPrice / currentPrices.arsUsdRate : rawPrice;
    if (currentPrice != null) {
      const currentValue = s.quantity * currentPrice * mult;
      const gain = currentValue - costTotal;
      unrealizedByCurrency[cur] = (unrealizedByCurrency[cur] || 0) + gain;
    }
    totalCostByCurrency[cur] = (totalCostByCurrency[cur] || 0) + costTotal;
  });

  if (kpiUnrealizedArs) {
    const v = unrealizedByCurrency['ARS'] || 0;
    kpiUnrealizedArs.innerText = fmtSimple(v, '$');
    kpiUnrealizedArs.style.color = v >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }
  if (kpiUnrealizedUsd) {
    const v = unrealizedByCurrency['USD'] || 0;
    kpiUnrealizedUsd.innerText = fmtSimple(v, 'U$D ');
    kpiUnrealizedUsd.style.color = v >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }
  function fmtPct(pct) {
    if (pct == null) return '—';
    return `${pct >= 0 ? '+' : ''}${pct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  function setPctEl(el, pct, prefix) {
    if (!el) return;
    if (pct != null) {
      el.innerText = prefix + fmtPct(pct);
      el.style.color = pct >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    } else {
      el.innerText = '—';
      el.style.color = 'var(--text-muted)';
    }
  }
  const costArs = totalCostByCurrency['ARS'] || 0;
  const costUsd = totalCostByCurrency['USD'] || 0;
  const unrlArs = unrealizedByCurrency['ARS'] || 0;
  const unrlUsd = unrealizedByCurrency['USD'] || 0;
  setPctEl(kpiReturnArs, costArs > 0 ? (unrlArs / costArs) * 100 : null, '');
  setPctEl(kpiReturnUsd, costUsd > 0 ? (unrlUsd / costUsd) * 100 : null, 'U$D ');

  // Summary List
  const summaryEl = document.getElementById('savings-asset-summary');
  const countBadge = document.getElementById('asset-count-badge');

  if (summaryEl) {
    summaryEl.innerHTML = '';
    const assetsEntries = Object.entries(assetsData).sort((a, b) => b[1] - a[1]);

    if (countBadge) countBadge.innerText = `${assetsEntries.length} activo${assetsEntries.length !== 1 ? 's' : ''}`;

    assetsEntries.forEach(([asset, val]) => {
      const qty = assetsQtyData[asset] || 0;
      const cur = assetsCurrencyData[asset] || 'ARS';
      const category = assetsCategoryData[asset] || '';
      const mult = (typeof UNIT_MULTIPLIER !== 'undefined' && UNIT_MULTIPLIER[category]) || 1;
      const rawPrice = currentPrices && typeof getPrice === 'function' ? getPrice(asset, category, currentPrices) : null;
      const currentPrice = rawPrice != null && cur === 'USD' && ['bonos','on','letras'].includes(category) && currentPrices?.arsUsdRate
        ? rawPrice / currentPrices.arsUsdRate : rawPrice;
      const currentValue = currentPrice != null ? qty * currentPrice * mult : null;
      const gainLoss = currentValue != null ? currentValue - val : null;
      const gainPct = gainLoss != null && val > 0 ? (gainLoss / val) * 100 : null;
      const gainColor = gainLoss != null ? (gainLoss >= 0 ? 'var(--income-light)' : 'var(--expense-light)') : 'var(--text-muted)';
      const gainSign = gainLoss != null ? (gainLoss >= 0 ? '+' : '') : '';
      const symbol = cur === 'USD' ? 'U$D ' : '$';

      const item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:12px; align-items:center; border: 1px solid rgba(255,255,255,0.05);';
      item.innerHTML = `
          <div style="display:flex; flex-direction:column; gap: 2px;">
            <span style="font-weight:700; color: var(--text); font-size: 0.9rem;">${asset}</span>
            <span style="font-size:0.7rem; color:var(--primary-light); background: rgba(124, 58, 237, 0.1); padding: 1px 6px; border-radius: 4px; width: fit-content;">
                ${qty.toLocaleString('es-AR', { maximumFractionDigits: 4 })} uds.
            </span>
          </div>
          <div style="text-align: right;">
            <span style="font-weight:800; font-size: 0.75rem; color: var(--text-soft); display: block;">${symbol}${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            ${gainPct != null
              ? `<span style="font-size:0.8rem;font-weight:700;color:${gainColor};">${gainSign}${gainPct.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2})}%</span>`
              : '<span style="font-size:0.7rem;color:var(--text-muted)">—</span>'}
          </div>
        `;
      summaryEl.appendChild(item);
    });
  }

  // Render Closed Trades Table
  renderClosedTradesTable();

  // Visual Charts
  updateSavingsAssetChart(assetsData);
  updateSavingsQtyChart(assetsQtyData);
}

function renderClosedTradesTable() {
  const tableBody = document.getElementById('closed-trades-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  let filtered = [...closedTrades];
  if (tradesSearchQuery) {
    filtered = filtered.filter(t =>
      t.asset.toLowerCase().includes(tradesSearchQuery) ||
      (t.platform || '').toLowerCase().includes(tradesSearchQuery)
    );
  }
  const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  let totalCashARS = 0;
  let totalCashUSD = 0;

  sorted.forEach(t => {
    const isUSD = (t.currency === 'USD');
    if (isUSD) totalCashUSD += t.receivedAmount;
    else totalCashARS += t.receivedAmount;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    const pnlColor = t.pnl >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    const symbol = isUSD ? 'U$D ' : '$';

    const unitPriceSold = t.quantitySold > 0 ? t.receivedAmount / t.quantitySold : 0;
    const unitPriceBought = t.quantitySold > 0 && t.costBasis ? t.costBasis / t.quantitySold : 0;

    tr.innerHTML = `
      <td style="padding: 1rem;">${fmtDate(t.date)}</td>
      <td style="padding: 1rem; font-weight: 700;">${t.asset}</td>
      <td style="padding: 1rem; text-align: right;">${t.quantitySold.toLocaleString('es-AR')}</td>
      <td style="padding: 1rem; text-align: right;">${symbol}${unitPriceBought.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 1rem; text-align: right;">${symbol}${unitPriceSold.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 1rem; text-align: right;">${symbol}${t.receivedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 1rem; text-align: right; color: ${pnlColor}; font-weight: 700;">
        ${t.pnl >= 0 ? '+' : '-'}${symbol}${Math.abs(t.pnl).toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${t.pnlPercent ? t.pnlPercent.toFixed(2) : '---'}%)
      </td>
      <td style="padding: 1rem; text-align: right;">
        <button class="delete-table-btn" onclick="removeClosedTrade(${t.id})">✕</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const countEl = document.getElementById('closed-trades-count');
  const totalCount = closedTrades.length;
  const shownCount = sorted.length;
  if (countEl) countEl.innerText = tradesSearchQuery ? `${shownCount} de ${totalCount} operacion${totalCount !== 1 ? 'es' : ''}` : `${totalCount} operacion${totalCount !== 1 ? 'es' : ''}`;

  const cashEl = document.getElementById('investment-cash-total');
  if (cashEl) {
    const cashByCur = {};
    closedTrades.forEach(t => {
      const cur = (t.currency || 'ARS').toUpperCase();
      cashByCur[cur] = (cashByCur[cur] || 0) + (parseFloat(t.receivedAmount) || 0);
    });

    const cashParts = Object.entries(cashByCur).map(([cur, val]) => {
      const symbol = (cur === 'USD' || cur === 'USDT') ? 'U$D ' : '$';
      return `${symbol}${val.toLocaleString('es-AR')}`;
    });

    cashEl.innerText = cashParts.length > 0 ? cashParts.join(' / ') : '$0,00';
  }

  const emptyEl = document.getElementById('closed-trades-empty');
  if (emptyEl) {
    emptyEl.style.display = sorted.length === 0 ? 'block' : 'none';
    if (tradesSearchQuery && closedTrades.length > 0) {
      emptyEl.innerText = `No se encontraron operaciones para "${tradesSearchQuery}"`;
    } else {
      emptyEl.innerText = 'No hay ventas registradas en el historial.';
    }
  }
}

function removeClosedTrade(id) {
  if (confirm('¿Eliminar este registro de venta del historial?')) {
    closedTrades = closedTrades.filter(t => t.id !== id);
    updateLocalStorage();
    updateSavingsUI();
  }
}

function updateSavingsAssetChart(assetsData) {
  const canvas = document.getElementById('savingsAssetChart');
  if (!canvas) return;

  const labels = Object.keys(assetsData);
  const values = Object.values(assetsData);
  const colors = ['#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

  if (savingsAssetChartInstance) savingsAssetChartInstance.destroy();

  if (labels.length > 0) {
    savingsAssetChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(6,9,20,0.95)',
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString('es-AR')}`
            }
          }
        },
        cutout: '75%'
      }
    });
  }
}

function updateSavingsQtyChart(assetsQtyData) {
  const canvas = document.getElementById('savingsQtyChart');
  if (!canvas) return;

  const labels = Object.keys(assetsQtyData);
  const values = Object.values(assetsQtyData);
  const colors = ['#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#7c3aed', '#10b981', '#f43f5e'];

  if (savingsQtyChartInstance) savingsQtyChartInstance.destroy();

  if (labels.length > 0) {
    savingsQtyChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(6,9,20,0.95)',
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString('es-AR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} uds.`
            }
          }
        },
        cutout: '75%'
      }
    });
  }
}

function removeSavings(id) {
  if (confirm('¿Estás seguro de eliminar este registro?')) {
    savings = savings.filter(s => s.id !== id);
    updateLocalStorage();
    updateSavingsUI();
    updateDashboard();
  }
}

// Modal Logic
function openEditModal(id) {
  const item = savings.find(s => s.id === id);
  if (!item) return;

  document.getElementById('edit-savings-id').value = item.id;
  document.getElementById('edit-savings-asset').value = item.ticker || item.asset;
  document.getElementById('edit-savings-platform-select').value = item.platform;
  document.getElementById('edit-savings-quantity').value = item.quantity;
  document.getElementById('edit-savings-amount').value = (item.price || item.amount || 0).toFixed(2);
  document.getElementById('edit-savings-date').value = item.date;
  document.getElementById('edit-savings-category').value = item.category || 'acciones';
  document.getElementById('edit-savings-currency').value = item.currency || 'ARS';

  document.getElementById('edit-savings-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-savings-modal').style.display = 'none';
  document.getElementById('edit-savings-form').reset();
}

const cancelEditBtn = document.getElementById('cancel-edit-savings');
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

const cancelSaleBtn = document.getElementById('cancel-sale-savings');
if (cancelSaleBtn) cancelSaleBtn.addEventListener('click', closeSaleModal);

const editSavingsForm = document.getElementById('edit-savings-form');
if (editSavingsForm) {
  editSavingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-savings-id').value);
    const index = savings.findIndex(s => s.id === id);

    if (index !== -1) {
      const q = parseFloat(document.getElementById('edit-savings-quantity').value) || 0;
      const a = parseFloat(document.getElementById('edit-savings-amount').value) || 0;
      savings[index] = {
        id: id,
        asset: document.getElementById('edit-savings-asset').value.toUpperCase(),
        platform: document.getElementById('edit-savings-platform-select').value,
        category: document.getElementById('edit-savings-category').value,
        quantity: q,
        price: a,
        currency: document.getElementById('edit-savings-currency').value,
        date: document.getElementById('edit-savings-date').value
      };
      updateLocalStorage();
      updateSavingsUI();
      updateDashboard();
      closeEditModal();
    }
  });
}


// Central savings filter helper — used by both updateSavingsUI and getVisibleSavingsInTable
function applySavingsFilters(list) {
  let result = list;
  if (savingsSearchQuery) {
    result = result.filter(s =>
      s.asset.toLowerCase().includes(savingsSearchQuery) ||
      (s.platform || '').toLowerCase().includes(savingsSearchQuery)
    );
  }
  if (savingsFilterPlatform) {
    result = result.filter(s => (s.platform || '') === savingsFilterPlatform);
  }
  if (savingsFilterCategory) {
    result = result.filter(s => (s.category || '') === savingsFilterCategory);
  }
  return result;
}

function getVisibleSavingsInTable() {
  let sorted = [...savings].sort((a, b) => new Date(b.date) - new Date(a.date));
  return applySavingsFilters(sorted);
}

function updateSavingsFilterPlatformDropdown() {
  const sel = document.getElementById('savings-filter-platform');
  if (!sel) return;
  const current = sel.value;
  // Keep first default option, rebuild the rest
  sel.innerHTML = '<option value="">Todas las cuentas</option>';
  const used = [...new Set(savings.map(s => s.platform).filter(Boolean))].sort();
  used.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function updateSavingsFilterClearBtn() {
  const btn = document.getElementById('savings-filter-clear');
  if (!btn) return;
  const hasFilter = savingsSearchQuery || savingsFilterPlatform || savingsFilterCategory;
  btn.style.display = hasFilter ? 'inline-flex' : 'none';
}

function getDaysHeld(dateStr) {
  const bought = new Date(dateStr);
  const now = new Date();
  const diff = now - bought;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysColor(days) {
  if (days < 30) return 'var(--income)';
  if (days < 90) return 'var(--savings)';
  if (days < 180) return '#f97316';
  return 'var(--expense)';
}

// BULK ACTIONS LOGIC
function updateBulkToolbar() {
  const toolbar = document.getElementById('bulk-actions-toolbar');
  const countEl = document.getElementById('selected-count');
  const selectAllCb = document.getElementById('select-all-savings');

  if (!toolbar) return;

  const count = selectedSavingsIds.length;
  if (count > 0) {
    toolbar.style.display = 'flex';
    if (countEl) countEl.innerText = count;
  } else {
    toolbar.style.display = 'none';
  }

  // Update Select All checkbox state
  if (selectAllCb) {
    const visibleIds = getVisibleSavingsInTable().map(s => s.id);
    selectAllCb.checked = visibleIds.length > 0 && visibleIds.every(id => selectedSavingsIds.includes(id));
  }
}

// Select All functionality
const selectAllCb = document.getElementById('select-all-savings');
if (selectAllCb) {
  selectAllCb.addEventListener('change', (e) => {
    const visibleIds = getVisibleSavingsInTable().map(s => s.id);
    if (e.target.checked) {
      visibleIds.forEach(id => {
        if (!selectedSavingsIds.includes(id)) selectedSavingsIds.push(id);
      });
    } else {
      selectedSavingsIds = selectedSavingsIds.filter(id => !visibleIds.includes(id));
    }
    updateSavingsUI();
  });
}

// Toolbar Buttons
const btnBulkCancel = document.getElementById('btn-bulk-cancel');
if (btnBulkCancel) {
  btnBulkCancel.addEventListener('click', () => {
    selectedSavingsIds = [];
    updateSavingsUI();
  });
}

const btnBulkDelete = document.getElementById('btn-bulk-delete');
if (btnBulkDelete) {
  btnBulkDelete.addEventListener('click', () => {
    if (confirm(`¿Estás seguro de eliminar ${selectedSavingsIds.length} registros?`)) {
      savings = savings.filter(s => !selectedSavingsIds.includes(s.id));
      selectedSavingsIds = [];
      updateLocalStorage();
      updateSavingsUI();
      updateDashboard();
    }
  });
}

const btnBulkEdit = document.getElementById('btn-bulk-edit');
const bulkEditModal = document.getElementById('bulk-edit-modal');
if (btnBulkEdit) {
  btnBulkEdit.addEventListener('click', () => {
    document.getElementById('bulk-edit-count').innerText = selectedSavingsIds.length;
    bulkEditModal.style.display = 'flex';
  });
}

// Bulk Modal Logic
const closeBulkEdit = document.getElementById('close-bulk-edit');
const cancelBulkEdit = document.getElementById('cancel-bulk-edit');
const bulkEditForm = document.getElementById('bulk-edit-form');

const hideBulkEdit = () => { if (bulkEditModal) bulkEditModal.style.display = 'none'; };
if (closeBulkEdit) closeBulkEdit.addEventListener('click', hideBulkEdit);
if (cancelBulkEdit) cancelBulkEdit.addEventListener('click', hideBulkEdit);

if (bulkEditForm) {
  bulkEditForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPlatform = document.getElementById('bulk-platform-select').value;
    const newCategory = document.getElementById('bulk-category-select').value;
    const newAsset = document.getElementById('bulk-asset-name').value.trim();
    const findText = document.getElementById('bulk-find-text').value;
    const replaceText = document.getElementById('bulk-replace-text').value;

    savings.forEach(s => {
      if (selectedSavingsIds.includes(s.id)) {
        if (newPlatform !== 'no-change') s.platform = newPlatform;
        if (newCategory !== 'no-change') s.category = newCategory;
        if (newAsset) s.asset = newAsset.toUpperCase();
        else if (findText) {
          s.asset = s.asset.replaceAll(findText, replaceText);
        }
      }
    });

    updateLocalStorage();
    selectedSavingsIds = [];
    updateSavingsUI();
    updateDashboard();
    hideBulkEdit();
    bulkEditForm.reset();
  });
}

// Bulk rename preview
document.getElementById('btn-bulk-rename-preview')?.addEventListener('click', () => {
  const previewEl = document.getElementById('bulk-rename-preview');
  if (!previewEl) return;
  const findText = document.getElementById('bulk-find-text').value;
  const replaceText = document.getElementById('bulk-replace-text').value;
  const newAsset = document.getElementById('bulk-asset-name').value.trim();

  const selected = savings.filter(s => selectedSavingsIds.includes(s.id));
  if (selected.length === 0) {
    previewEl.innerHTML = '<div style="padding:4px;color:var(--text-muted);font-size:0.75rem;">Sin registros seleccionados</div>';
    previewEl.style.display = 'block';
    return;
  }

  let html = '';
  for (const s of selected) {
    let newName;
    if (newAsset) newName = newAsset.toUpperCase();
    else if (findText) newName = s.asset.replaceAll(findText, replaceText);
    else newName = s.asset;

    if (newName !== s.asset) {
      html += `<div style="padding:3px 6px;font-size:0.75rem;border-bottom:1px solid var(--border);">
        <span style="color:var(--text-muted);text-decoration:line-through;">${s.asset}</span>
        <span style="color:var(--income-light);"> → ${newName}</span>
      </div>`;
    }
  }

  if (!html) {
    html = '<div style="padding:4px;color:var(--text-muted);font-size:0.75rem;">Ningún cambio</div>';
  }
  previewEl.innerHTML = html;
  previewEl.style.display = 'block';
});

// BULK SALE LOGIC
const btnBulkSell = document.getElementById('btn-bulk-sell');
const bulkSaleModal = document.getElementById('bulk-sale-modal');
const bulkSaleForm = document.getElementById('bulk-sale-form');
const bulkSaleAmount = document.getElementById('bulk-sale-amount');
const bulkSaleCurrency = document.getElementById('bulk-sale-currency');
const bulkSaleDate = document.getElementById('bulk-sale-date');
const bulkPnlPreview = document.getElementById('bulk-pnl-preview');
const bulkPnlAmount = document.getElementById('bulk-pnl-amount');
const bulkPnlPercent = document.getElementById('bulk-pnl-percent');

function openBulkSaleModal() {
  const selected = savings.filter(s => selectedSavingsIds.includes(s.id));
  if (selected.length === 0) return;

  document.getElementById('bulk-sale-count').innerText = selected.length;

  const totalCostBasis = selected.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  const summaryEl = document.getElementById('bulk-sale-summary');
  summaryEl.innerHTML = selected.map(s =>
    `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.8rem;">
      <span><strong style="color:var(--primary-light);">${s.asset}</strong> <span style="color:var(--text-soft);">× ${s.quantity}</span></span>
      <span style="font-weight:600;">${fmt(s.price)}</span>
    </div>`
  ).join('') +
    `<div style="display:flex;justify-content:space-between;padding:6px 0 0;margin-top:4px;border-top:1px solid var(--border);font-size:0.85rem;">
    <span style="font-weight:700;">Costo Total</span>
    <span style="font-weight:800;">${fmt(totalCostBasis)}</span>
  </div>`;

  // Determine common currency or default to ARS
  const currencies = [...new Set(selected.map(s => s.currency || 'ARS'))];
  bulkSaleCurrency.value = currencies.length === 1 ? currencies[0] : 'ARS';

  bulkSaleAmount.value = '';
  bulkPnlPreview.style.display = 'none';
  bulkSaleDate.valueAsDate = new Date();
  bulkSaleModal.style.display = 'flex';
}

function closeBulkSaleModal() {
  bulkSaleModal.style.display = 'none';
}

function updateBulkSalePNL() {
  const selected = savings.filter(s => selectedSavingsIds.includes(s.id));
  const totalAmount = parseFloat(bulkSaleAmount.value) || 0;
  const totalCostBasis = selected.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

  if (totalAmount > 0 && totalCostBasis > 0) {
    const pnl = totalAmount - totalCostBasis;
    const pnlPerc = (pnl / totalCostBasis) * 100;

    bulkPnlPreview.style.display = 'block';
    bulkPnlAmount.innerText = fmt(pnl);
    bulkPnlPercent.innerText = (pnl >= 0 ? '+' : '') + pnlPerc.toFixed(2) + '%';

    const color = pnl >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
    bulkPnlAmount.style.color = color;
    bulkPnlPercent.style.color = color;
    bulkPnlPreview.style.borderColor = pnl >= 0 ? 'var(--income)' : 'var(--expense)';
    bulkPnlPreview.style.background = pnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';
  } else {
    bulkPnlPreview.style.display = 'none';
  }
}

if (btnBulkSell) {
  btnBulkSell.addEventListener('click', openBulkSaleModal);
}

if (bulkSaleAmount) {
  bulkSaleAmount.addEventListener('input', updateBulkSalePNL);
}

// Close bulk sale modal
['close-bulk-sale', 'cancel-bulk-sale'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', closeBulkSaleModal);
});

if (bulkSaleForm) {
  bulkSaleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const totalAmount = parseFloat(bulkSaleAmount.value);
    const currency = bulkSaleCurrency.value;
    const saleDate = bulkSaleDate.value;

    if (!totalAmount || totalAmount <= 0) return;

    const selected = savings.filter(s => selectedSavingsIds.includes(s.id));
    const totalCostBasis = selected.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

    selected.forEach((item) => {
      const proportion = totalCostBasis > 0 ? (parseFloat(item.price) || 0) / totalCostBasis : 1 / selected.length;
      const receivedAmount = totalAmount * proportion;
      const costBasis = parseFloat(item.price) || 0;
      const pnl = receivedAmount - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      closedTrades.push({
        id: generateID(),
        asset: item.asset,
        quantitySold: item.quantity,
        receivedAmount: receivedAmount,
        costBasis: costBasis,
        pnl: pnl,
        pnlPercent: pnlPercent,
        date: saleDate,
        platform: item.platform,
        currency: item.currency
      });
    });

    // Record capital return + realized gain/loss
    const first = selected[0];
    const totalPnl = totalAmount - totalCostBasis;
    const assetNames = selected.map(s => s.asset).join(', ');
    transactions.push({
      id: generateID(),
      text: `Retorno capital - ${assetNames}`,
      amount: totalCostBasis,
      date: saleDate,
      platform: first ? first.platform : '',
      currency: currency,
      isInvestment: true
    });
    if (totalPnl !== 0) {
      transactions.push({
        id: generateID(),
        text: totalPnl > 0 ? `Ganancia venta ${assetNames}` : `Pérdida venta ${assetNames}`,
        amount: totalPnl,
        date: saleDate,
        platform: first ? first.platform : '',
        currency: currency
      });
    }

    // Remove all sold items from savings
    savings = savings.filter(s => !selectedSavingsIds.includes(s.id));
    selectedSavingsIds = [];

    updateLocalStorage();
    closeBulkSaleModal();
    updateSavingsUI();
    updateDashboard();
  });
}

// Set initial date
if (saveDate) saveDate.valueAsDate = new Date();

// ===== RECENT LIST =====
function updateRecentList(displayTransactions) {
  if (!recentList) return;
  recentList.innerHTML = '';
  const sorted = [...displayTransactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  if (sorted.length === 0) {
    recentList.innerHTML = '<li style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align:center;">Sin movimientos</li>';
    return;
  }

  sorted.forEach(t => {
    const sign = t.amount < 0 ? 'minus' : 'plus';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="mini-dot ${sign}"></span>
      <div class="mini-info">
        <div class="mini-desc">${t.text}</div>
        <div class="mini-date">${fmtDate(t.date)} · ${t.platform}</div>
      </div>
      <span class="mini-amount ${sign}">${t.amount > 0 ? '+' : ''}${fmt(t.amount)}</span>
    `;
    recentList.appendChild(li);
  });
}

function updateDashboard() {
  const displayTransactions = getDashboardFilteredTransactions();
  const displaySavings = getDashboardFilteredSavings();
  const displayTrades = getDashboardFilteredTrades();
  updateKPIs(displayTransactions, displaySavings, displayTrades);
  updateCharts(displayTransactions, displaySavings);
  updatePnLByAssetChart(displayTrades);
  updateBalanceEvolutionChart(displayTransactions);
  updateRecentList(displayTransactions);
  updateSavingsUI();
}

// ===== HISTORY LIST =====
function renderHistoryList() {
  if (!list) return;
  list.innerHTML = '';

  let filtered = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (currentFilter === 'income') filtered = filtered.filter(t => t.amount > 0);
  if (currentFilter === 'expense') filtered = filtered.filter(t => t.amount < 0);

  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.platform.toLowerCase().includes(q)
    );
  }

  // Update summary
  const historyCount = document.getElementById('history-count');
  const historyTotal = document.getElementById('history-total');
  if (historyCount) historyCount.innerText = `${filtered.length} movimiento${filtered.length !== 1 ? 's' : ''}`;
  if (historyTotal) {
    const total = filtered.reduce((acc, t) => acc + t.amount, 0);
    historyTotal.innerText = `Total: ${total >= 0 ? '+' : ''}${fmt(total)}`;
    historyTotal.style.color = total >= 0 ? 'var(--income-light)' : 'var(--expense-light)';
  }

  if (filtered.length === 0) {
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  filtered.forEach(t => addTransactionToHistory(t));
}

function addTransactionToHistory(t) {
  const sign = t.amount < 0 ? 'minus' : 'plus';
  const li = document.createElement('li');
  li.classList.add(sign);
  li.innerHTML = `
    <div class="tx-type-dot ${sign}">${t.amount < 0 ? '↓' : '↑'}</div>
    <div class="tx-info">
      <div class="tx-desc">${t.text}</div>
      <div class="tx-meta">
        <span class="tx-date">${fmtDate(t.date)}</span>
        <span class="tx-platform">${t.platform}</span>
      </div>
    </div>
    <span class="tx-amount ${sign}">${t.amount > 0 ? '+' : ''}${fmt(t.amount)}</span>
    <button class="delete-btn" onclick="removeTransaction(${t.id})">✕</button>
  `;
  list.appendChild(li);
}

// ===== FORM SIDE STATS =====
function updateFormSideStats() {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Expenses
  const allExpenses = sorted.filter(t => t.amount < 0 && !t.isTransfer && !t.isInvestment);
  const expMonth = allExpenses.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const expYear = allExpenses.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === thisYear);

  const expMonthTotal = expMonth.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const expYearTotal = expYear.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const expMonthsCount = [...new Set(allExpenses.map(t => t.date.substring(0, 7)))].length || 1;
  const expAvg = allExpenses.reduce((acc, t) => acc + Math.abs(t.amount), 0) / expMonthsCount;

  const fmtEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = fmt(val); };
  fmtEl('form-expense-month', expMonthTotal);
  fmtEl('form-expense-year', expYearTotal);
  fmtEl('form-expense-avg', expAvg);

  // Incomes
  const allIncomes = sorted.filter(t => t.amount > 0 && !t.isTransfer && !t.isInvestment);
  const incMonth = allIncomes.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const incYear = allIncomes.filter(t => new Date(t.date + 'T00:00:00').getFullYear() === thisYear);

  const incMonthTotal = incMonth.reduce((acc, t) => acc + t.amount, 0);
  const incYearTotal = incYear.reduce((acc, t) => acc + t.amount, 0);
  const incMonthsCount = [...new Set(allIncomes.map(t => t.date.substring(0, 7)))].length || 1;
  const incAvg = allIncomes.reduce((acc, t) => acc + t.amount, 0) / incMonthsCount;

  fmtEl('form-income-month', incMonthTotal);
  fmtEl('form-income-year', incYearTotal);

  const transferCountEl = document.getElementById('transfer-platforms-count');
  if (transferCountEl) transferCountEl.innerText = platforms.length;
  // Mini lists
  if (expenseList) {
    expenseList.innerHTML = '';
    allExpenses.slice(0, 5).forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
          <span class="mini-dot minus"></span>
          <div class="mini-info"><div class="mini-desc">${t.text}</div><div class="mini-date">${fmtDate(t.date)}</div></div>
          <span class="mini-amount minus">${fmt(t.amount)}</span>
        `;
      expenseList.appendChild(li);
    });
  }

  if (incomeList) {
    incomeList.innerHTML = '';
    allIncomes.slice(0, 5).forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
          <span class="mini-dot plus"></span>
          <div class="mini-info"><div class="mini-desc">${t.text}</div><div class="mini-date">${fmtDate(t.date)}</div></div>
          <span class="mini-amount plus">+${fmt(t.amount)}</span>
        `;
      incomeList.appendChild(li);
    });
  }
}


// ===== ADD TRANSACTION =====
function createTransactionFromForm(textVal, amountVal, sign, dateVal, platformVal, isSaving = false, isDeposit = false, qty = 1, targetPlatform = '', assetTicker = '', currency = 'ARS', category = 'acciones', mainCurrency = 'ARS') {
  const amount = sign * Math.abs(+amountVal);
  const transaction = {
    id: generateID(),
    text: textVal,
    amount: amount,
    date: dateVal,
    platform: platformVal,
    currency: mainCurrency // Apply main currency to available balance
  };
  if (isSaving && amount < 0) transaction.isInvestment = true;
  transactions.push(transaction);

  // Auto-savings
  if (isSaving && amount < 0) {
    const assetName = assetTicker || (textVal && textVal.includes('BTC') ? 'BTC' : (textVal || 'Activo'));
    savings.push({
      id: generateID(),
      asset: assetName.toUpperCase(),
      platform: platformVal || 'Binance',
      category: category,
      quantity: qty || 1,
      price: Math.abs(amount), // Store Total Amount
      currency: currency,
      date: dateVal
    });
    updateSavingsUI();
  }

  updateLocalStorage();
  updateFormSideStats();
  updateDashboard();
  renderHistoryList();
}


// ===== REMOVE TRANSACTION =====
function removeTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateLocalStorage();
  renderHistoryList();
  updateDashboard();
  updateFormSideStats();
}

// ===== FIREBASE SYNC =====
// updateLocalStorage is defined in firebase-config.js

if (expenseForm) {
  // Toggle conditional fields
  const isSavingCheck = document.getElementById('expense-is-saving');
  const savingField = document.getElementById('expense-saving-field');

  if (isSavingCheck) {
    const savingField = document.getElementById('expense-saving-field');
    const qtyField = document.getElementById('expense-qty-field');
    const currencyField = document.getElementById('expense-currency-field');

    isSavingCheck.addEventListener('change', () => {
      const show = isSavingCheck.checked ? 'block' : 'none';
      if (savingField) savingField.style.display = show;
      if (qtyField) qtyField.style.display = show;
      if (currencyField) currencyField.style.display = show;
    });
  }

  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('expense-text').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;
    const platform = document.getElementById('expense-platform-select').value;
    const isSaving = isSavingCheck ? isSavingCheck.checked : false;
    const qty = document.getElementById('expense-qty') ? (parseFloat(document.getElementById('expense-qty').value) || 1) : 1;
    const assetTicker = document.getElementById('expense-asset-ticker') ? document.getElementById('expense-asset-ticker').value : '';
    const category = document.getElementById('expense-savings-category') ? document.getElementById('expense-savings-category').value : 'acciones';
    const currency = document.getElementById('expense-currency') ? document.getElementById('expense-currency').value : 'ARS';

    const mainCurrency = document.getElementById('expense-main-currency').value;

    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, -1, date, platform, isSaving, false, qty, '', assetTicker, currency, category, mainCurrency);
    expenseForm.reset();
    document.getElementById('expense-date').valueAsDate = new Date();

    // Show success feedback
    const btn = expenseForm.querySelector('.btn-submit');
    btn.innerText = '✓ Gasto registrado';
    setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Confirmar Gasto'; }, 2000);
  });
}

if (incomeForm) {
  incomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('income-text').value;
    const amount = document.getElementById('income-amount').value;
    const date = document.getElementById('income-date').value;
    const platform = document.getElementById('income-platform-select').value;
    const mainCurrency = document.getElementById('income-main-currency').value;
    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, 1, date, platform, false, false, 1, '', '', 'ARS', 'acciones', mainCurrency);
    incomeForm.reset();
    document.getElementById('income-date').valueAsDate = new Date();
    const btn = incomeForm.querySelector('.btn-submit');
    btn.innerText = '✓ Ingreso registrado';
    setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg> Confirmar Ingreso'; }, 2000);
  });
}

// ===== FILTER PILLS (History) =====
const filterPills = document.querySelectorAll('.pill');
filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    renderHistoryList();
  });
});

// ===== SEARCH =====
if (searchInput) {
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.trim();
    renderHistoryList();
  });
}

if (savingsSearchInput) {
  savingsSearchInput.addEventListener('input', () => {
    savingsSearchQuery = savingsSearchInput.value.trim().toLowerCase();
    updateSavingsFilterClearBtn();
    updateSavingsUI();
  });
}

const tradesSearchInput = document.getElementById('trades-search-input');
if (tradesSearchInput) {
  tradesSearchInput.addEventListener('input', () => {
    tradesSearchQuery = tradesSearchInput.value.trim().toLowerCase();
    renderClosedTradesTable();
  });
}

const savingsFilterPlatformEl = document.getElementById('savings-filter-platform');
if (savingsFilterPlatformEl) {
  savingsFilterPlatformEl.addEventListener('change', () => {
    savingsFilterPlatform = savingsFilterPlatformEl.value;
    updateSavingsFilterClearBtn();
    updateSavingsUI();
  });
}

const savingsFilterCategoryEl = document.getElementById('savings-filter-category');
if (savingsFilterCategoryEl) {
  savingsFilterCategoryEl.addEventListener('change', () => {
    savingsFilterCategory = savingsFilterCategoryEl.value;
    updateSavingsFilterClearBtn();
    updateSavingsUI();
  });
}

const savingsFilterClearBtn = document.getElementById('savings-filter-clear');
if (savingsFilterClearBtn) {
  savingsFilterClearBtn.addEventListener('click', () => {
    savingsSearchQuery = '';
    savingsFilterPlatform = '';
    savingsFilterCategory = '';
    if (savingsSearchInput) savingsSearchInput.value = '';
    if (savingsFilterPlatformEl) savingsFilterPlatformEl.value = '';
    if (savingsFilterCategoryEl) savingsFilterCategoryEl.value = '';
    updateSavingsFilterClearBtn();
    updateSavingsUI();
  });
}

// ===== DASHBOARD FILTERS =====
filterYear.addEventListener('change', () => updateDashboard());
filterMonth.addEventListener('change', () => updateDashboard());

// ===== SET DEFAULT DATES =====
const expDateEl = document.getElementById('expense-date');
const incDateEl = document.getElementById('income-date');
if (expDateEl) expDateEl.valueAsDate = new Date();
if (incDateEl) incDateEl.valueAsDate = new Date();

// ===== SETTINGS LOGIC =====
const sidebarUserInfo = document.getElementById('sidebar-user-info');
const settingsPopover = document.getElementById('settings-popover');
const closeSettingsBtn = document.getElementById('close-settings');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const settingsNameInput = document.getElementById('settings-name');
const saveSettingsNameBtn = document.getElementById('save-settings-name');
const logoutSettingsBtn = document.getElementById('logout-settings');

// Toggle Popover
sidebarUserInfo.addEventListener('click', (e) => {
  // Prevent toggle if clicking inside the popover itself (unless it's the close button)
  if (e.target.closest('.settings-popover') && !e.target.closest('.close-popover')) {
    return;
  }
  settingsPopover.classList.toggle('active');

  // Pre-fill name if available
  const currentName = document.getElementById('sidebar-email').innerText;
  if (currentName && !currentName.includes('@')) {
    settingsNameInput.value = currentName;
  }
});

// Close Button
closeSettingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.classList.remove('active');
});

// Click Outside to close
document.addEventListener('click', (e) => {
  if (!sidebarUserInfo.contains(e.target)) {
    settingsPopover.classList.remove('active');
  }
});

// Dark Mode Logic
const isDarkMode = localStorage.getItem('theme') !== 'light';
darkModeToggle.checked = !isDarkMode; // Switch is "Dark Mode Toggle", but logic is often inverted or straightforward
// Wait, the toggle label is "Tema Oscuro". If checked, it should be dark.
// But the app is dark by default. So if checked = Dark, unchecked = Light.
darkModeToggle.checked = isDarkMode;
if (!isDarkMode) document.body.classList.add('light-mode');

darkModeToggle.addEventListener('change', () => {
  if (darkModeToggle.checked) {
    document.body.classList.remove('light-mode');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.classList.add('light-mode');
    localStorage.setItem('theme', 'light');
  }
});

// Save Name Logic
saveSettingsNameBtn.addEventListener('click', () => {
  const newName = settingsNameInput.value.trim();
  if (!newName) return;

  const user = auth.currentUser;
  if (user) {
    user.updateProfile({
      displayName: newName
    }).then(() => {
      // Update UI
      document.getElementById('sidebar-email').innerText = newName;
      document.getElementById('sidebar-avatar').innerText = newName[0].toUpperCase();

      // Visual feedback
      saveSettingsNameBtn.innerText = '✓';
      setTimeout(() => { saveSettingsNameBtn.innerText = 'Guardar Nombre'; }, 2000); // Revert text
    }).catch(err => alert(err.message));
  }
});

// Logout from settings
logoutSettingsBtn.addEventListener('click', () => {
  auth.signOut();
});

// ===== BULK IMPORT =====
const btnBulkImport = document.getElementById('btn-bulk-import');
const bulkImportInput = document.getElementById('bulk-import-input');

if (btnBulkImport && bulkImportInput) {
  btnBulkImport.addEventListener('click', () => bulkImportInput.click());

  bulkImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target.result;
      processCSV(csv);
    };
    reader.readAsText(file);
    bulkImportInput.value = ''; // Reset for next use
  });
}

function processCSV(csv) {
  // 1. Auto-detect separator (comma vs semicolon)
  const firstLine = csv.split('\n')[0];
  const separator = firstLine.includes(';') ? ';' : ',';

  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return;

  // Clean headers: remove quotes and spaces, set uppercase
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, '').toUpperCase());

  const getCol = (data, keys) => {
    const keyMatch = Object.keys(data).find(k => keys.some(ki => k.includes(ki)));
    return data[keyMatch] || '';
  };

  let addedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    // Clean fields: remove quotes and spaces
    const line = lines[i].split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (line.length < 4) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = line[idx] || '';
    });

    const isVenta = (getCol(row, ['TIPO']) || '').toUpperCase() === 'VENTA';

    // Smart number parsing for Argentina/Standard formats
    const parseSmart = (val) => {
      if (!val || val === '') return 0;
      let n = val.toString().trim();

      // Remove currency symbols and spaces
      n = n.replace(/[^\d,.-]/g, '');

      // Scenario A: Both dot and comma exist (e.g. 1.234,56 or 1,234.56)
      if (n.includes(',') && n.includes('.')) {
        // If dot is before comma, dot is thousands (AR/ES format)
        if (n.indexOf('.') < n.indexOf(',')) n = n.replace(/\./g, '').replace(',', '.');
        // If comma is before dot, comma is thousands (US/UK format)
        else n = n.replace(/,/g, '');
      }
      // Scenario B: Only comma exists (e.g. 1234,56) -> comma is decimal
      else if (n.includes(',')) {
        n = n.replace(',', '.');
      }
      // Scenario C: Only dot exists (e.g. 1.234) 
      // This is ambiguous. In JS/US it's 1.234. In AR it's 1234.
      // Financial rule: If there are exactly 3 digits after the dot, and it's not the only dot, 
      // or if we are in AR context, treat as thousands if number is large?
      // Let's use a heuristic: if we have "X.YYY" where YYY is 3 digits, and no decimal part 
      // (no comma), and context is ARS, it's very likely thousands.
      // But for tickers like BTC it could be 0.123.
      // Revised Scenario C: Trust standard JS parseFloat unless it has multiple dots.
      else if (n.match(/\.\d{3}$/) && n.split('.').length > 1 && parseFloat(n) < 100) {
        // If it ends in .XXX and the resulting number would be small, but it has multiple sections, it's definitely thousands
        // But actually, simple rule: if there are multiple dots, it's thousands.
      }

      if (n.split('.').length > 2) n = n.replace(/\./g, ''); // 1.500.000 -> 1500000

      return parseFloat(n) || 0;
    };

    const qty = parseSmart(getCol(row, ['CANTIDAD', 'CANT.', 'QUANTITY', 'QTY']));
    const amount = parseSmart(getCol(row, ['MONTO_TOTAL', 'MONTO_VENTA', 'TOTAL_VENTA', 'TOTAL', 'IMPORTE', 'RECIBIDO']));

    // Total Cost headers (explicitly total)
    const costBasisComp = parseSmart(getCol(row, ['COSTO_TOTAL', 'TOTAL_COMPRA', 'INVERSION_TOTAL', 'PURCHASE_TOTAL', 'MONTO_COMPRA']));

    // Unit Cost headers (explicitly unit or ambiguous)
    let unitCost = parseSmart(getCol(row, ['PRECIO_COMPRA', 'COSTO_ORIGINAL', 'COSTO_COMPRA', 'P_COMPRA', 'UNIT_COST', 'COSTO_UNITARIO', 'P.COMPRA']));

    const asset = (getCol(row, ['ACTIVO', 'TICKER', 'INSTRUMENTO', 'SYMBOL']) || '---').toUpperCase();
    const platform = getCol(row, ['PLATAFORMA', 'BROKER', 'ORIGEN', 'PLATFORM']) || 'Importado';

    // Clean currency - ensures no numbers/spaces remain
    let currency = (getCol(row, ['MONEDA']) || 'ARS').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 3);
    if (currency.length < 2) currency = 'ARS';

    // Normalize date to YYYY-MM-DD
    let rawDate = (getCol(row, ['FECHA']) || new Date().toISOString().split('T')[0]);
    if (rawDate.includes('/')) {
      const p = rawDate.split('/');
      if (p.length === 3) {
        // Assume DD/MM/YYYY if year is at the end
        if (p[2].length === 4) {
          rawDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        // Assume YYYY/MM/DD if year is at the start
        else if (p[0].length === 4) {
          rawDate = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
        }
      }
    }

    if (isVenta) {
      // Use total cost if found, otherwise calculate from unit cost
      let totalCostBasis = 0;
      if (costBasisComp > 0) {
        totalCostBasis = costBasisComp;
      } else if (unitCost > 0) {
        totalCostBasis = unitCost * qty;
      }

      const pnl = totalCostBasis > 0 ? (amount - totalCostBasis) : 0;
      const pnlPerc = totalCostBasis > 0 ? (pnl / totalCostBasis) * 100 : 0;

      closedTrades.push({
        id: generateID(),
        asset: asset,
        quantitySold: qty,
        receivedAmount: amount,
        costBasis: totalCostBasis,
        pnl: pnl,
        pnlPercent: pnlPerc,
        date: rawDate,
        platform: platform,
        currency: currency
      });
    } else {
      savings.push({
        id: generateID(),
        asset: asset,
        platform: platform,
        quantity: qty,
        price: amount,
        currency: currency,
        date: rawDate
      });
    }
    addedCount++;
  }

  updateLocalStorage();
  updateSavingsUI();
  updateDashboard();
  alert(`${addedCount} registros procesados correctamente.`);
}

function seedPersonalSavings() {
  const seedData = [{ "id": 37158155, "asset": "SPY", "platform": "IOL", "quantity": 1.0, "price": 49500.0, "date": "2026-03-17" }, { "id": 21140851, "asset": "FSLR", "platform": "IOL", "quantity": 12.0, "price": 191400.0, "date": "2026-03-10" }, { "id": 25501307, "asset": "GOOGL", "platform": "IOL", "quantity": 25.0, "price": 193750.0, "date": "2026-02-13" }, { "id": 75846083, "asset": "FXI", "platform": "IOL", "quantity": 12.0, "price": 144000.0, "date": "2026-01-30" }, { "id": 70934678, "asset": "F", "platform": "IOL", "quantity": 7.0, "price": 143780.0, "date": "2026-01-27" }, { "id": 81669968, "asset": "SHOP", "platform": "IOL", "quantity": 75.0, "price": 145200.0, "date": "2026-01-26" }, { "id": 10377480, "asset": "SPY", "platform": "IOL", "quantity": 6.0, "price": 315600.0, "date": "2026-01-26" }, { "id": 68914973, "asset": "QCOM", "platform": "IOL", "quantity": 6.0, "price": 129900.0, "date": "2026-01-22" }, { "id": 20287443, "asset": "PYPL", "platform": "IOL", "quantity": 16.0, "price": 168000.0, "date": "2026-01-20" }, { "id": 77122218, "asset": "MA", "platform": "IOL", "quantity": 6.0, "price": 150000.0, "date": "2026-01-15" }, { "id": 76759041, "asset": "NIOD", "platform": "IOL", "quantity": 120.0, "price": 150.0, "date": "2026-01-13" }, { "id": 15153854, "asset": "SONY", "platform": "IOL", "quantity": 22.0, "price": 105380.0, "date": "2026-01-12" }, { "id": 48835800, "asset": "AAPL", "platform": "IOL", "quantity": 10.0, "price": 197000.0, "date": "2026-01-09" }, { "id": 71805320, "asset": "AVGO", "platform": "IOL", "quantity": 20.0, "price": 268800.0, "date": "2026-01-07" }, { "id": 73637071, "asset": "TSLA", "platform": "IOL", "quantity": 4.0, "price": 178000.0, "date": "2026-01-07" }, { "id": 19935659, "asset": "TXAR", "platform": "IOL", "quantity": 42.0, "price": 31710.0, "date": "2026-01-07" }, { "id": 80575966, "asset": "NKE", "platform": "IOL", "quantity": 5.0, "price": 36850.0, "date": "2025-12-23" }, { "id": 66279136, "asset": "BABA", "platform": "IOL", "quantity": 8.0, "price": 207360.0, "date": "2025-12-22" }, { "id": 43673307, "asset": "OZC7O", "platform": "IOL", "quantity": 157000.0, "price": 157000.0, "date": "2025-12-18" }, { "id": 54662699, "asset": "TXAR", "platform": "IOL", "quantity": 275.0, "price": 203500.0, "date": "2025-12-18" }, { "id": 83747445, "asset": "AMZN", "platform": "IOL", "quantity": 30.0, "price": 72450.0, "date": "2025-12-17" }, { "id": 15877896, "asset": "MSFT", "platform": "IOL", "quantity": 6.0, "price": 147600.0, "date": "2025-12-17" }, { "id": 84615107, "asset": "GLD", "platform": "IOL", "quantity": 10.0, "price": 118500.0, "date": "2025-12-12" }, { "id": 78463327, "asset": "FXI", "platform": "IOL", "quantity": 10.0, "price": 118100.0, "date": "2025-12-11" }, { "id": 80282313, "asset": "NFLX", "platform": "IOL", "quantity": 35.0, "price": 105000.0, "date": "2025-12-09" }, { "id": 33857992, "asset": "SPOT", "platform": "IOL", "quantity": 2.0, "price": 62920.0, "date": "2025-12-09" }, { "id": 89955360, "asset": "XLU", "platform": "IOL", "quantity": 10.0, "price": 42800.0, "date": "2025-12-09" }, { "id": 55696975, "asset": "NVDA", "platform": "IOL", "quantity": 20.0, "price": 228400.0, "date": "2025-11-26" }, { "id": 91703308, "asset": "ARKK", "platform": "IOL", "quantity": 10.0, "price": 116000.0, "date": "2025-11-13" }, { "id": 64690175, "asset": "XROX", "platform": "IOL", "quantity": 30.0, "price": 127800.0, "date": "2025-11-13" }, { "id": 14562534, "asset": "IBIT", "platform": "IOL", "quantity": 24.0, "price": 211680.0, "date": "2025-11-05" }, { "id": 86357220, "asset": "YM41D", "platform": "IOL", "quantity": 150.0, "price": 150.0, "date": "2025-10-08" }, { "id": 86030994, "asset": "MELI", "platform": "IOL", "quantity": 7.0, "price": 197960.0, "date": "2025-10-03" }, { "id": 82971779, "asset": "RVS1O", "platform": "IOL", "quantity": 45956.0, "price": 44990.92, "date": "2025-04-30" }, { "id": 83475356, "asset": "IBIT", "platform": "IOL", "quantity": 8.0, "price": 49440.0, "date": "2025-03-21" }, { "id": 24504051, "asset": "PAMP", "platform": "IOL", "quantity": 1.0, "price": 4250.0, "date": "2025-03-21" }, { "id": 57179668, "asset": "COME", "platform": "IOL", "quantity": 240.0, "price": 39960.0, "date": "2025-03-10" }, { "id": 63911217, "asset": "IBIT", "platform": "IOL", "quantity": 20.0, "price": 109800.0, "date": "2025-03-10" }, { "id": 67815354, "asset": "HSAT", "platform": "IOL", "quantity": 43.0, "price": 9374.0, "date": "2025-01-20" }, { "id": 79717201, "asset": "IBIT", "platform": "IOL", "quantity": 13.0, "price": 99710.0, "date": "2025-01-20" }, { "id": 91136652, "asset": "PRPEDOB", "platform": "IOL", "quantity": 7.368, "price": 10.86, "date": "2025-01-16" }, { "id": 28937829, "asset": "HSAT", "platform": "IOL", "quantity": 135.0, "price": 30341.25, "date": "2025-01-14" }, { "id": 33255164, "asset": "ALUA", "platform": "IOL", "quantity": 2.0, "price": 1786.0, "date": "2025-01-13" }, { "id": 96823732, "asset": "IBIT", "platform": "IOL", "quantity": 2.0, "price": 12500.0, "date": "2025-01-13" }, { "id": 39865311, "asset": "ALUA", "platform": "IOL", "quantity": 3.0, "price": 2772.0, "date": "2025-01-10" }, { "id": 88546013, "asset": "PRPEDOB", "platform": "IOL", "quantity": 3.878, "price": 5.77, "date": "2025-01-10" }, { "id": 41389524, "asset": "PRPEDOB", "platform": "IOL", "quantity": 8.214, "price": 12.3, "date": "2025-01-09" }, { "id": 21855569, "asset": "PRPEDOB", "platform": "IOL", "quantity": 4.241, "price": 6.35, "date": "2025-01-09" }, { "id": 99322015, "asset": "ALUA", "platform": "IOL", "quantity": 1.0, "price": 900.0, "date": "2025-01-03" }, { "id": 81195895, "asset": "IBIT", "platform": "IOL", "quantity": 2.0, "price": 13100.0, "date": "2025-01-03" }, { "id": 26452636, "asset": "DGCU2", "platform": "IOL", "quantity": 51.0, "price": 99450.0, "date": "2025-01-02" }, { "id": 32646666, "asset": "IBIT", "platform": "IOL", "quantity": 2.0, "price": 12640.0, "date": "2024-12-30" }, { "id": 11134897, "asset": "ALUA", "platform": "IOL", "quantity": 3.0, "price": 2715.0, "date": "2024-12-27" }, { "id": 91386113, "asset": "CELU", "platform": "IOL", "quantity": 30.0, "price": 28950.0, "date": "2024-12-27" }, { "id": 15446318, "asset": "IBIT", "platform": "IOL", "quantity": 5.0, "price": 32600.0, "date": "2024-12-27" }, { "id": 71773270, "asset": "AL29", "platform": "IOL", "quantity": 55.0, "price": 50957.5, "date": "2024-12-20" }, { "id": 94885458, "asset": "EAC3D", "platform": "IOL", "quantity": 140.0, "price": 140.0, "date": "2024-12-20" }, { "id": 62197670, "asset": "IBIT", "platform": "IOL", "quantity": 14.0, "price": 94500.0, "date": "2024-12-19" }, { "id": 55021853, "asset": "TZXD7", "platform": "IOL", "quantity": 70931.0, "price": 101040.6, "date": "2024-12-19" }, { "id": 75630623, "asset": "ETHA", "platform": "IOL", "quantity": 1.0, "price": 6900.0, "date": "2024-12-17" }, { "id": 67534775, "asset": "IBIT", "platform": "IOL", "quantity": 2.0, "price": 13920.0, "date": "2024-12-17" }, { "id": 66100888, "asset": "PRERMDB", "platform": "IOL", "quantity": 5.298, "price": 5.0, "date": "2024-12-16" }, { "id": 60433398, "asset": "AL30", "platform": "IOL", "quantity": 12.0, "price": 9370.8, "date": "2024-12-13" }, { "id": 41128322, "asset": "GD30", "platform": "IOL", "quantity": 76.0, "price": 59637.2, "date": "2024-12-13" }, { "id": 51685635, "asset": "TX26", "platform": "IOL", "quantity": 3169.0, "price": 52177.59, "date": "2024-12-06" }, { "id": 13136996, "asset": "COME", "platform": "IOL", "quantity": 371.0, "price": 88390.75, "date": "2024-12-03" }, { "id": 64998073, "asset": "YMCIO", "platform": "IOL", "quantity": 46.0, "price": 54178.8, "date": "2024-12-02" }, { "id": 77072917, "asset": "IOLDOLD", "platform": "IOL", "quantity": 494.209, "price": 500.0, "date": "2024-11-21" }, { "id": 60019627, "asset": "IOLDOLD", "platform": "IOL", "quantity": 16.255, "price": 16.43, "date": "2024-11-14" }, { "id": 28533498, "asset": "PRERMDB", "platform": "IOL", "quantity": 11.554, "price": 10.99, "date": "2024-11-14" }, { "id": 18102557, "asset": "PRPEDOB", "platform": "IOL", "quantity": 23.455, "price": 32.95, "date": "2024-11-14" }, { "id": 42609578, "asset": "IOLDOLD", "platform": "IOL", "quantity": 182.072, "price": 183.34, "date": "2024-11-12" }, { "id": 12418074, "asset": "QCOM", "platform": "IOL", "quantity": 5.0, "price": 94125.0, "date": "2024-10-17" }, { "id": 79055745, "asset": "CARP", "platform": "IOL", "quantity": 17.0, "price": 202640.0, "date": "2024-10-07" }, { "id": 92696541, "asset": "VIST", "platform": "IOL", "quantity": 5.0, "price": 96375.0, "date": "2024-10-02" }, { "id": 62286185, "asset": "YMCOO", "platform": "IOL", "quantity": 38.0, "price": 36191.2, "date": "2024-09-11" }, { "id": 86018516, "asset": "KO", "platform": "IOL", "quantity": 2.0, "price": 35650.0, "date": "2024-08-19" }, { "id": 56921102, "asset": "BP", "platform": "IOL", "quantity": 2.0, "price": 17560.0, "date": "2024-08-16" }, { "id": 33269928, "asset": "PFE", "platform": "IOL", "quantity": 2.0, "price": 18120.0, "date": "2024-08-16" }, { "id": 90763576, "asset": "AL30", "platform": "IOL", "quantity": 100.0, "price": 71500.0, "date": "2024-07-12" }, { "id": 41188748, "asset": "MGCEO", "platform": "IOL", "quantity": 58.0, "price": 54050.2, "date": "2024-07-10" }, { "id": 42906252, "asset": "PRERMDB", "platform": "IOL", "quantity": 62.185, "price": 50.0, "date": "2024-07-03" }, { "id": 67997162, "asset": "PRPEDOB", "platform": "IOL", "quantity": 48.474, "price": 50.0, "date": "2024-07-03" }, { "id": 76468123, "asset": "TZXD7", "platform": "IOL", "quantity": 17818.0, "price": 24588.84, "date": "2024-07-01" }, { "id": 92094085, "asset": "GLOB", "platform": "IOL", "quantity": 1.0, "price": 10887.0, "date": "2024-05-16" }, { "id": 76767331, "asset": "GLOB", "platform": "IOL", "quantity": 2.0, "price": 23111.0, "date": "2024-05-03" }, { "id": 36192085, "asset": "MELI", "platform": "IOL", "quantity": 2.0, "price": 30820.0, "date": "2024-05-03" }];

  // Combine with existing, add defaults for missing fields
  savings = [...savings, ...seedData.map(s => ({ ...s, category: s.category || 'cedears', currency: s.currency || 'ARS' }))];

  // Update store and UI
  updateLocalStorage();
  updateSavingsUI();
  updateDashboard();
}

// ===== INIT =====
function init() {
  populateYearFilter();
  updateDashboard();
  renderHistoryList();
  updateFormSideStats();
  initPlatformTableSorting();
  updatePlatformsUI();

  if (typeof updateSavingsUI === 'function') updateSavingsUI();

  refreshMarketPrices();

  // Savings filter platform dropdown initial population
  updateSavingsFilterPlatformDropdown();

  // One-time seed for user data
  if (!localStorage.getItem('finto_savings_imported_v2')) {
    seedPersonalSavings();
    localStorage.setItem('finto_savings_imported_v2', 'true');
  }
}


// Ensure chart resizes
window.addEventListener('resize', () => {
});

// ===== PLATFORMS LOGIC =====
function calculatePlatformBalance(platformName, currency = 'ARS') {
  const platformObj = platforms.find(p => p.name === platformName);
  let initial = 0;

  if (platformObj) {
    if (currency === 'ARS') initial = parseFloat(platformObj.initialBalance) || 0;
    else if (currency === 'USD') initial = parseFloat(platformObj.initialBalanceUSD) || 0;
  }

  const platformTransactions = transactions.filter(t => t.platform === platformName && (t.currency || 'ARS') === currency);
  const movementTotal = platformTransactions.reduce((acc, t) => acc + t.amount, 0);

  return initial + movementTotal;
}

function updatePlatformsUI() {
  renderPlatformsList();
  renderPlatformsCards();
  populatePlatformsDropdowns();
  updateViewToggleUI();
}

function updateViewToggleUI() {
  const cardsBtn = document.getElementById('view-cards-btn');
  const tableBtn = document.getElementById('view-table-btn');
  const cardsContainer = document.getElementById('platforms-cards-container');
  const tableContainer = document.getElementById('platforms-table-container');

  if (!cardsBtn || !tableBtn) return;

  if (platformViewMode === 'cards') {
    cardsBtn.classList.add('active');
    tableBtn.classList.remove('active');
    if (cardsContainer) cardsContainer.style.display = 'grid';
    if (tableContainer) tableContainer.style.display = 'none';
  } else {
    cardsBtn.classList.remove('active');
    tableBtn.classList.add('active');
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
  }
}

// Toggle event listeners
document.addEventListener('click', (e) => {
  if (e.target.closest('#view-cards-btn')) {
    platformViewMode = 'cards';
    localStorage.setItem('platformViewMode', 'cards');
    updateViewToggleUI();
  }
  if (e.target.closest('#view-table-btn')) {
    platformViewMode = 'table';
    localStorage.setItem('platformViewMode', 'table');
    updateViewToggleUI();
  }
});

function renderPlatformsCards() {
  const container = document.getElementById('platforms-cards-container');
  if (!container) return;
  container.innerHTML = '';

  platforms.forEach(p => {
    const availableARS = calculatePlatformBalance(p.name, 'ARS');
    const availableUSD = calculatePlatformBalance(p.name, 'USD');
    const investmentBalances = calculatePlatformInvestmentBalances(p.name);
    const totalARS = availableARS + (investmentBalances['ARS'] || 0);

    const card = document.createElement('div');
    card.className = 'platform-card';
    card.innerHTML = `
      <div class="platform-card-header">
        <div class="platform-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <div class="platform-card-actions">
          <button class="btn-icon" onclick="editPlatform(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button class="btn-icon" style="color: var(--expense-light);" onclick="deletePlatform(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
      <div>
        <div class="platform-card-name">${p.name}</div>
        <div class="platform-balance-wrap" style="margin-top: 1rem;">
          <div class="platform-balance-row">
            <span class="platform-balance-label">Disponible ARS</span>
            <span class="platform-balance-value ${availableARS >= 0 ? 'income-color' : 'expense-color'}">${fmt(availableARS)}</span>
          </div>
          <div class="platform-balance-row">
            <span class="platform-balance-label">Disponible USD</span>
            <span class="platform-balance-value ${availableUSD >= 0 ? 'income-color' : 'expense-color'}">${availableUSD !== 0 ? 'U$D ' + availableUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</span>
          </div>
          <div class="platform-balance-row">
            <span class="platform-balance-label">Inversión</span>
            <span class="platform-balance-value" style="font-size: 0.75rem;">
              ${investmentBalances['ARS'] ? '$' + investmentBalances['ARS'].toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}
              ${investmentBalances['ARS'] && investmentBalances['USD'] ? ' / ' : ''}
              ${investmentBalances['USD'] ? 'U$D ' + investmentBalances['USD'].toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}
              ${!investmentBalances['ARS'] && !investmentBalances['USD'] ? '-' : ''}
            </span>
          </div>
        </div>
      </div>
      <div class="platform-total-row">
        <span class="platform-total-label">Balance Total</span>
        <span class="platform-total-value">${fmt(totalARS)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function calculatePlatformInvestmentBalances(platformName) {
  const platformSavings = savings.filter(s => s.platform === platformName);
  const balances = {};
  platformSavings.forEach(s => {
    const cur = (s.currency || 'ARS').toUpperCase();
    balances[cur] = (balances[cur] || 0) + (parseFloat(s.price) || 0);
  });
  return balances;
}

function getPlatformSortData(p) {
  const availableARS = calculatePlatformBalance(p.name, 'ARS');
  const availableUSD = calculatePlatformBalance(p.name, 'USD');
  const invBalances = calculatePlatformInvestmentBalances(p.name);
  const invARS = invBalances['ARS'] || 0;
  const invUSD = invBalances['USD'] || 0;
  const totalARS = availableARS + invARS;
  return { availableARS, availableUSD, invARS, invUSD, totalARS };
}

function renderPlatformsList() {
  const platformsTable = document.getElementById('platforms-list');
  if (!platformsTable) return;
  const tbody = platformsTable.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  updatePlatformSortIndicators();

  const sorted = [...platforms].sort((a, b) => {
    const aData = getPlatformSortData(a);
    const bData = getPlatformSortData(b);
    let valA, valB;
    switch (platformSortColumn) {
      case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
      case 'availableARS': valA = aData.availableARS; valB = bData.availableARS; break;
      case 'availableUSD': valA = aData.availableUSD; valB = bData.availableUSD; break;
      case 'invARS': valA = aData.invARS; valB = bData.invARS; break;
      case 'invUSD': valA = aData.invUSD; valB = bData.invUSD; break;
      case 'totalARS': valA = aData.totalARS; valB = bData.totalARS; break;
      default: valA = a.name.toLowerCase(); valB = b.name.toLowerCase();
    }
    if (typeof valA === 'string') return valA.localeCompare(valB) * platformSortDirection;
    return (valA - valB) * platformSortDirection;
  });

  sorted.forEach(p => {
    const availableARS = calculatePlatformBalance(p.name, 'ARS');
    const availableUSD = calculatePlatformBalance(p.name, 'USD');
    const investmentBalances = calculatePlatformInvestmentBalances(p.name);
    const totalARS = availableARS + (investmentBalances['ARS'] || 0);
    const invARS = investmentBalances['ARS'] ? '$' + investmentBalances['ARS'].toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-';
    const invUSD = investmentBalances['USD'] ? 'U$D ' + investmentBalances['USD'].toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="platform-icon" style="width:36px;height:36px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <strong>${p.name}</strong>
        </div>
      </td>
      <td class="${availableARS >= 0 ? 'income-color' : 'expense-color'}" style="font-weight:600;">${fmt(availableARS)}</td>
      <td class="${availableUSD >= 0 ? 'income-color' : 'expense-color'}" style="font-weight:600;">${availableUSD !== 0 ? 'U$D ' + availableUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
      <td style="font-weight:600;">${invARS}</td>
      <td style="font-weight:600;">${invUSD}</td>
      <td class="platform-total-value" style="font-weight:800;">${fmt(totalARS)}</td>
      <td>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn-icon" onclick="editPlatform(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button class="delete-table-btn" onclick="deletePlatform(${p.id})">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function updatePlatformSortIndicators() {
  const ths = document.querySelectorAll('#platforms-list thead th.sortable');
  ths.forEach(th => {
    const col = th.dataset.sort;
    th.classList.remove('sort-asc', 'sort-desc');
    if (col === platformSortColumn) {
      th.classList.add(platformSortDirection === 1 ? 'sort-asc' : 'sort-desc');
    }
  });
}

function initPlatformTableSorting() {
  document.querySelectorAll('#platforms-list thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (platformSortColumn === col) {
        platformSortDirection *= -1;
      } else {
        platformSortColumn = col;
        platformSortDirection = 1;
      }
      localStorage.setItem('platformSortColumn', platformSortColumn);
      localStorage.setItem('platformSortDirection', platformSortDirection);
      renderPlatformsList();
    });
  });
}

function populatePlatformsDropdowns() {
  const dropdowns = [
    'expense-platform-select',
    'income-platform-select',
    'transfer-from',
    'transfer-to',
    'savings-platform-select',
    'edit-savings-platform-select',
    'bulk-platform-select'
  ];

  dropdowns.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const currentVal = el.value;
    el.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';

    platforms.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      el.appendChild(opt);
    });

    if (currentVal && platforms.some(p => p.name === currentVal)) {
      el.value = currentVal;
    }
  });
}

// Platform Form Logic
const platformForm = document.getElementById('platform-form');
const cancelPlatformEditBtn = document.getElementById('cancel-platform-edit');

if (platformForm) {
  platformForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('platform-id').value;
    const name = document.getElementById('platform-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('platform-initial-balance').value) || 0;
    const initialBalanceUSD = parseFloat(document.getElementById('platform-initial-balance-usd').value) || 0;

    if (!name) return;

    if (id) {
      // Edit
      const index = platforms.findIndex(p => p.id == id);
      if (index !== -1) {
        platforms[index].name = name;
        platforms[index].initialBalance = initialBalance;
        platforms[index].initialBalanceUSD = initialBalanceUSD;
      }
    } else {
      // Add
      if (platforms.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert('Ya existe una plataforma con ese nombre');
        return;
      }
      platforms.push({
        id: generateID(),
        name: name,
        initialBalance: initialBalance,
        initialBalanceUSD: initialBalanceUSD
      });
    }

    updateLocalStorage();
    resetPlatformForm();
    updatePlatformsUI();
    updateDashboard();
  });
}

if (cancelPlatformEditBtn) {
  cancelPlatformEditBtn.addEventListener('click', resetPlatformForm);
}

function resetPlatformForm() {
  if (!platformForm) return;
  platformForm.reset();
  const idEl = document.getElementById('platform-id');
  const titleEl = document.getElementById('platform-form-title');
  if (idEl) idEl.value = '';
  if (titleEl) titleEl.innerText = 'Nueva Plataforma';
  if (cancelPlatformEditBtn) cancelPlatformEditBtn.style.display = 'none';
}

function editPlatform(id) {
  const p = platforms.find(plat => plat.id === id);
  if (!p) return;

  document.getElementById('platform-id').value = p.id;
  document.getElementById('platform-name').value = p.name;
  document.getElementById('platform-initial-balance').value = p.initialBalance || 0;
  document.getElementById('platform-initial-balance-usd').value = p.initialBalanceUSD || 0;

  document.getElementById('platform-form-title').innerText = 'Editar Plataforma';
  if (cancelPlatformEditBtn) cancelPlatformEditBtn.style.display = 'block';

  platformForm.scrollIntoView({ behavior: 'smooth' });
}

function deletePlatform(id) {
  const p = platforms.find(plat => plat.id === id);
  if (!p) return;

  const usage = transactions.filter(t => t.platform === p.name).length;
  if (usage > 0) {
    if (!confirm(`Esta plataforma tiene ${usage} movimientos asociados. Si la eliminas, esos movimientos perderán su referencia de plataforma. ¿Continuar?`)) {
      return;
    }
  } else {
    if (!confirm('¿Eliminar esta plataforma?')) return;
  }

  platforms = platforms.filter(plat => plat.id !== id);
  updateLocalStorage();
  updatePlatformsUI();
}

// Transfer Logic
const transferForm = document.getElementById('transfer-form');
if (transferForm) {
  document.getElementById('transfer-date').valueAsDate = new Date();

  transferForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const from = document.getElementById('transfer-from').value;
    const to = document.getElementById('transfer-to').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const date = document.getElementById('transfer-date').value;
    const currency = document.getElementById('transfer-currency').value;

    if (!from || !to || !amount || !date) return;
    if (from === to) {
      alert('Las cuentas de origen y destino deben ser diferentes');
      return;
    }

    // Create 2 movements
    const transferId = generateID();

    // 1. Withdrawal from source
    transactions.push({
      id: generateID(),
      text: `Transferencia a ${to}`,
      amount: -amount,
      date: date,
      platform: from,
      currency: currency,
      isTransfer: true,
      transferRef: transferId
    });

    // 2. Deposit to destination
    transactions.push({
      id: generateID(),
      text: `Transferencia desde ${from}`,
      amount: amount,
      date: date,
      platform: to,
      currency: currency,
      isTransfer: true,
      transferRef: transferId
    });

    updateLocalStorage();
    transferForm.reset();
    document.getElementById('transfer-date').valueAsDate = new Date();

    updatePlatformsUI();
    updateDashboard();
    renderHistoryList();

    // Success feedback
    const btn = transferForm.querySelector('.btn-submit');
    const originalText = btn.innerHTML;
    btn.innerText = '✓ Transferencia realizada';
    setTimeout(() => { btn.innerHTML = originalText; }, 2000);
  });
}

init();

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

const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item, .btn-link');
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

// ===== STATE =====
let transactions = [];
let currentFilter = 'all';
let currentSearchQuery = '';

// ===== HELPERS =====
function fmt(amount) {
  const formatted = Math.abs(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR');
}

function generateID() {
  return Math.floor(Math.random() * 100000000);
}

// ===== NAVIGATION =====
const viewTitles = {
  'dashboard': ['Dashboard', 'Resumen financiero'],
  'transactions-form': ['Movimientos', 'Registrar ingresos y gastos'],
  'history': ['Historial', 'Todos los movimientos']
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
}

// ===== FORM TABS =====
const formTabs = document.querySelectorAll('.form-tab');
formTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    formTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabName = tab.getAttribute('data-tab');
    document.getElementById('expense-panel').style.display = tabName === 'expense' ? 'grid' : 'none';
    document.getElementById('income-panel').style.display = tabName === 'income' ? 'grid' : 'none';
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

function populateYearFilter() {
  const years = [...new Set(transactions.map(t => new Date(t.date + 'T00:00:00').getFullYear()))].sort((a, b) => b - a);
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

// ===== KPI UPDATE =====
function updateKPIs(displayTransactions) {
  const amounts = displayTransactions.map(t => t.amount);
  const total = amounts.reduce((acc, item) => acc + item, 0);
  const income = amounts.filter(i => i > 0).reduce((acc, i) => acc + i, 0);
  const expense = Math.abs(amounts.filter(i => i < 0).reduce((acc, i) => acc + i, 0));

  const incomes = displayTransactions.filter(t => t.amount > 0);
  const expenses = displayTransactions.filter(t => t.amount < 0);

  balance.innerText = fmt(total);
  balance.style.color = total >= 0 ? 'var(--income-light)' : 'var(--expense-light)';

  money_plus.innerText = '+' + fmt(income);
  money_minus.innerText = '-' + fmt(expense);

  if (incomeCount) incomeCount.innerText = `${incomes.length} movimiento${incomes.length !== 1 ? 's' : ''}`;
  if (expenseCount) expenseCount.innerText = `${expenses.length} movimiento${expenses.length !== 1 ? 's' : ''}`;

  // Savings rate
  const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  if (savingsRate) {
    savingsRate.innerText = rate + '%';
    savingsRate.style.color = rate >= 0 ? 'var(--savings)' : 'var(--expense-light)';
  }
  if (savingsLabel) savingsLabel.innerText = 'del total ingresado';
}

// ===== CHARTS =====
let platformChartInstance = null;
let monthlyChartInstance = null;
let balanceEvolutionChartInstance = null;

function updateCharts(displayTransactions) {
  const platformCanvas = document.getElementById('platformChart');
  const monthlyCanvas = document.getElementById('monthlyChart');
  if (!platformCanvas || !monthlyCanvas) return;

  // Platform Doughnut
  const expenses = displayTransactions.filter(t => t.amount < 0);
  const platformData = {};
  expenses.forEach(t => {
    platformData[t.platform] = (platformData[t.platform] || 0) + Math.abs(t.amount);
  });

  const platformLabels = Object.keys(platformData);
  const platformValues = Object.values(platformData);
  const palette = ['#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

  if (platformChartInstance) platformChartInstance.destroy();
  if (platformLabels.length > 0) {
    platformChartInstance = new Chart(platformCanvas, {
      type: 'doughnut',
      data: {
        labels: platformLabels,
        datasets: [{
          data: platformValues,
          backgroundColor: palette,
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#64748b',
              font: { size: 10, family: 'Inter' },
              usePointStyle: true,
              pointStyleWidth: 8,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(6,9,20,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  // Monthly Bar Chart
  const monthlyData = {};
  displayTransactions.forEach(t => {
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
              callback: (v) => '$' + (v / 1000).toFixed(0) + 'k'
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
}

// ===== BALANCE EVOLUTION CHART =====
function updateBalanceEvolutionChart(displayTransactions) {
  const canvas = document.getElementById('balanceEvolutionChart');
  if (!canvas) return;

  // Group by date and calculate cumulative balance
  const sorted = [...displayTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const evolution = {};
  let runningBalance = 0;

  sorted.forEach(t => {
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
              callback: (v) => '$' + (v / 1000).toFixed(0) + 'k'
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false }
          }
        }
      }
    });
  }
}

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

// ===== DASHBOARD UPDATE =====
function updateDashboard() {
  const displayTransactions = getDashboardFilteredTransactions();
  updateKPIs(displayTransactions);
  updateCharts(displayTransactions);
  updateBalanceEvolutionChart(displayTransactions);
  updateRecentList(displayTransactions);
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
  const allExpenses = sorted.filter(t => t.amount < 0);
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
  const allIncomes = sorted.filter(t => t.amount > 0);
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
  fmtEl('form-income-avg', incAvg);

  // Mini lists
  if (expenseList) {
    expenseList.innerHTML = '';
    allExpenses.slice(0, 5).forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="mini-dot minus"></span>
        <div class="mini-info"><div class="mini-desc">${t.text}</div><div class="mini-date">${fmtDate(t.date)}</div></div>
        <span class="mini-amount minus">-${fmt(t.amount)}</span>
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
function createTransactionFromForm(textVal, amountVal, sign, dateVal, platformVal) {
  const transaction = {
    id: generateID(),
    text: textVal,
    amount: sign * Math.abs(+amountVal),
    date: dateVal,
    platform: platformVal
  };
  transactions.push(transaction);
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

// ===== FORM LISTENERS =====
if (expenseForm) {
  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('expense-text').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;
    const platform = document.getElementById('expense-platform').value;
    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, -1, date, platform);
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
    const platform = document.getElementById('income-platform').value;
    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, 1, date, platform);
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
            setTimeout(() => { saveSettingsNameBtn.innerText = '✓'; }, 2000);
        }).catch(err => alert(err.message));
    }
});

// Logout from settings
logoutSettingsBtn.addEventListener('click', () => {
    auth.signOut();
});

// ===== INIT =====
function init() {
  populateYearFilter();
  updateDashboard();
  renderHistoryList();
  updateFormSideStats();
}

init();

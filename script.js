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
let savings = [];
let deposits = [];
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
  'history': ['Historial', 'Todos los movimientos'],
  'savings': ['Mis Ahorros', 'Gestión de activos y capital'],
  'deposits': ['Fondeos', 'Historial de capital invertido']
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
  }

  if (view === 'deposits') {
    updateDepositsUI();
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

  // Total Saved (Now Total Savings)
  const totalSav = savings.reduce((acc, s) => acc + (s.price * s.quantity), 0);
  const totalSavingsEl = document.getElementById('total-savings');
  if (totalSavingsEl) totalSavingsEl.innerText = fmt(totalSav);

  // Total Deposited (Fondeos)
  const totalDep = deposits.reduce((acc, d) => acc + d.amount, 0);
  const totalDepositsEl = document.getElementById('total-deposits');
  if (totalDepositsEl) totalDepositsEl.innerText = fmt(totalDep);
}

// ===== CHARTS =====
let platformChartInstance = null;
let monthlyChartInstance = null;
let balanceEvolutionChartInstance = null;
let dashSavingsChartInstance = null;

function updateCharts(displayTransactions) {
  const platformCanvas = document.getElementById('platformChart');
  const monthlyCanvas = document.getElementById('monthlyChart');
  const dashSavingsCanvas = document.getElementById('dashSavingsChart');

  if (!monthlyCanvas) return;
  const palette = ['#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

  // 3. Fondeos: Capital por Plataforma (Reservas Disponibles)
  if (platformCanvas) {
    const platformReserves = {};
    deposits.forEach(d => {
      platformReserves[d.account] = (platformReserves[d.account] || 0) + d.amount;
    });
    // Subtract what was already spent on savings in that platform
    savings.forEach(s => {
      platformReserves[s.platform] = (platformReserves[s.platform] || 0) - (s.price * s.quantity);
    });

    const pLabels = Object.keys(platformReserves).filter(k => platformReserves[k] > 0);
    const pValues = pLabels.map(k => platformReserves[k]);

    if (platformChartInstance) platformChartInstance.destroy();
    if (pLabels.length > 0) {
      platformChartInstance = new Chart(platformCanvas, {
        type: 'doughnut',
        data: {
          labels: pLabels,
          datasets: [{
            data: pValues,
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
                padding: 12
              }
            },
            tooltip: {
              backgroundColor: 'rgba(6,9,20,0.95)',
              callbacks: {
                label: (ctx) => ` Reservas: $${ctx.parsed.toLocaleString('es-AR')}`
              }
            }
          },
          cutout: '72%'
        }
      });
    }
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

  // 4. Portfolio Assets Distribution
  if (dashSavingsCanvas) {
    const assetsData = {};
    savings.forEach(s => {
      assetsData[s.asset] = (assetsData[s.asset] || 0) + (s.price * s.quantity);
    });

    const labels = Object.keys(assetsData);
    const values = Object.values(assetsData);

    if (dashSavingsChartInstance) dashSavingsChartInstance.destroy();

    if (labels.length > 0) {
      dashSavingsChartInstance = new Chart(dashSavingsCanvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
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
                label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toLocaleString('es-AR')}`
              }
            }
          },
          cutout: '72%'
        }
      });
    }
  }
}

// ===== BALANCE EVOLUTION CHART =====
function updateBalanceEvolutionChart(displayTransactions) {
  const canvas = document.getElementById('balanceEvolutionChart');
  if (!canvas) return;

  const filtered = getDashboardFilteredTransactions();
  let endDate = new Date();

  if (filtered.length > 0) {
    const sortedFiltered = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    endDate = new Date(sortedFiltered[0].date + 'T23:59:59');
  } else if (filterYear.value !== 'all' || filterMonth.value !== 'all') {
    const year = filterYear.value === 'all' ? new Date().getFullYear() : parseInt(filterYear.value);
    const month = filterMonth.value === 'all' ? 11 : parseInt(filterMonth.value) - 1;
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  }

  const history = transactions
    .filter(t => new Date(t.date + 'T00:00:00') <= endDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (history.length === 0) {
    if (balanceEvolutionChartInstance) balanceEvolutionChartInstance.destroy();
    return;
  }

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
            left: -10,
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
const savePlatform = document.getElementById('savings-platform');
const saveQuantity = document.getElementById('savings-quantity');
const saveAmount = document.getElementById('savings-amount');
const saveDate = document.getElementById('savings-date');
const savePriceDisplay = document.getElementById('savings-price-display');
const saveTableBody = document.querySelector('tbody'); // We'll find it by context if multiple
let savingsAssetChartInstance = null;

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

if (saveForm) {
  saveForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = parseFloat(saveQuantity.value) || 0;
    const a = parseFloat(saveAmount.value) || 0;
    const p = q > 0 ? a / q : 0;

    const item = {
      id: generateID(),
      asset: saveAsset.value.toUpperCase(),
      platform: savePlatform.value,
      quantity: q,
      price: p,
      date: saveDate.value
    };
    savings.push(item);
    updateLocalStorage();
    saveForm.reset();
    saveDate.valueAsDate = new Date();
    savePriceDisplay.value = '$0,00';
    updateSavingsUI();
    updateDashboard();
  });
}

function updateSavingsUI() {
  const tableBody = document.getElementById('inv-table-body'); // Still using this ID from template
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const sorted = [...savings].sort((a, b) => new Date(b.date) - new Date(a.date));
  let totalValue = 0;
  const assetsData = {};

  sorted.forEach(s => {
    const total = s.price * s.quantity;
    totalValue += total;
    assetsData[s.asset] = (assetsData[s.asset] || 0) + total;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
            <td style="padding: 1rem;">${fmtDate(s.date)}</td>
            <td style="padding: 1rem; font-weight: 700; color: var(--primary-light);">${s.asset}</td>
            <td style="padding: 1rem; text-align: right;">${s.quantity}</td>
            <td style="padding: 1rem; text-align: right;">${fmt(s.price)}</td>
            <td style="padding: 1rem; text-align: right; font-weight: 700;">${fmt(total)}</td>
            <td style="padding: 1rem;">${s.platform}</td>
            <td style="padding: 1.25rem 1rem; display: flex; gap: 8px; align-items: center; justify-content: flex-end;">
                <button class="btn-icon" onclick="openEditModal(${s.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                <button class="delete-table-btn" onclick="removeSavings(${s.id})">✕</button>
            </td>
        `;
    tableBody.appendChild(tr);
  });

  // Update Stats
  const totalEl = document.getElementById('savings-stat-total');
  if (totalEl) totalEl.innerText = fmt(totalValue);

  const monthEl = document.getElementById('savings-stat-month');
  if (monthEl) {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthTotal = savings
      .filter(s => {
        const d = new Date(s.date + 'T12:00:00');
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((acc, s) => acc + (s.price * s.quantity), 0);
    monthEl.innerText = fmt(monthTotal);
  }

  // Summary List
  const summaryEl = document.getElementById('savings-asset-summary');
  if (summaryEl) {
    summaryEl.innerHTML = '';
    Object.entries(assetsData)
      .sort((a, b) => b[1] - a[1])
      .forEach(([asset, val]) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; align-items:center;';
        item.innerHTML = `<span style="font-weight:700;">${asset}</span> <span style="font-size:0.85rem; color:var(--text-soft);">${fmt(val)}</span>`;
        summaryEl.appendChild(item);
      });
  }

  // Visual Chart
  updateSavingsAssetChart(assetsData);
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
  document.getElementById('edit-savings-asset').value = item.asset;
  document.getElementById('edit-savings-platform').value = item.platform;
  document.getElementById('edit-savings-quantity').value = item.quantity;
  document.getElementById('edit-savings-amount').value = (item.price * item.quantity).toFixed(2);
  document.getElementById('edit-savings-date').value = item.date;

  document.getElementById('edit-savings-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-savings-modal').style.display = 'none';
}

const editSavingsForm = document.getElementById('edit-savings-form');
if (editSavingsForm) {
  editSavingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-savings-id').value);
    const index = savings.findIndex(s => s.id === id);

    if (index !== -1) {
      const q = parseFloat(document.getElementById('edit-savings-quantity').value) || 0;
      const a = parseFloat(document.getElementById('edit-savings-amount').value) || 0;
      const p = q > 0 ? a / q : 0;

      savings[index] = {
        id: id,
        asset: document.getElementById('edit-savings-asset').value,
        platform: document.getElementById('edit-savings-platform').value,
        quantity: q,
        price: p,
        date: document.getElementById('edit-savings-date').value
      };
      updateLocalStorage();
      updateSavingsUI();
      updateDashboard();
      closeEditModal();
    }
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
function createTransactionFromForm(textVal, amountVal, sign, dateVal, platformVal, isSaving = false, isDeposit = false, qty = 1, targetPlatform = '') {
  const amount = sign * Math.abs(+amountVal);
  const transaction = {
    id: generateID(),
    text: textVal,
    amount: amount,
    date: dateVal,
    platform: platformVal
  };
  transactions.push(transaction);

  // Auto-savings
  if (isSaving && amount < 0) {
    const assetName = textVal && textVal.includes('BTC') ? 'BTC' : (textVal || 'Activo');
    savings.push({
      id: generateID(),
      asset: assetName,
      platform: platformVal || 'Binance',
      quantity: qty || 1,
      price: Math.abs(amount) / (qty || 1),
      date: dateVal
    });
    updateSavingsUI();
  }

  // Auto-deposit
  if (isDeposit && amount < 0) {
    deposits.push({
      id: generateID(),
      account: targetPlatform || platformVal || 'Personal Pay',
      amount: Math.abs(amount),
      date: dateVal
    });
    updateDepositsUI();
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

// ===== FORM LISTENERS =====
if (expenseForm) {
  // Toggle conditional fields
  const isSavingCheck = document.getElementById('expense-is-saving');
  const isDepositCheck = document.getElementById('expense-is-deposit');
  const savingField = document.getElementById('expense-saving-field');
  const depositField = document.getElementById('expense-deposit-field');

  if (isSavingCheck) {
    isSavingCheck.addEventListener('change', () => {
      savingField.style.display = isSavingCheck.checked ? 'block' : 'none';
    });
  }
  if (isDepositCheck) {
    isDepositCheck.addEventListener('change', () => {
      depositField.style.display = isDepositCheck.checked ? 'block' : 'none';
    });
  }

  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('expense-text').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;
    const platform = document.getElementById('expense-platform').value;
    const isSaving = isSavingCheck.checked;
    const isDeposit = isDepositCheck.checked;
    const qty = parseFloat(document.getElementById('expense-qty').value) || 1;
    const targetPlatform = document.getElementById('expense-deposit-target').value;

    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, -1, date, platform, isSaving, isDeposit, qty, targetPlatform);
    expenseForm.reset();
    document.getElementById('expense-date').valueAsDate = new Date();
    savingField.style.display = 'none';
    depositField.style.display = 'none';
    
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
      setTimeout(() => { saveSettingsNameBtn.innerText = 'Guardar Nombre'; }, 2000); // Revert text
    }).catch(err => alert(err.message));
  }
});

// Logout from settings
logoutSettingsBtn.addEventListener('click', () => {
  auth.signOut();
});

// ===== DEPOSITS LOGIC =====
const depositForm = document.getElementById('deposit-form');
const depositsTableBody = document.getElementById('deposits-table-body');
const depositsTotalBalance = document.getElementById('deposits-total-balance');
const depositsKpiGrid = document.getElementById('deposits-kpi-grid');


function updateDepositsUI() {
  renderDepositsTable();
  updateDepositsTotals();
}

function updateDepositsTotals() {
  const totals = deposits.reduce((acc, d) => {
    acc.total += d.amount;
    acc.byPlatform[d.account] = (acc.byPlatform[d.account] || 0) + d.amount;
    return acc;
  }, { total: 0, byPlatform: {} });

  if (depositsTotalBalance) depositsTotalBalance.innerText = fmt(totals.total);

  // Update or create platform cards
  const platformCardsWrap = document.getElementById('deposits-platform-cards');
  if (platformCardsWrap) {
    platformCardsWrap.innerHTML = '';
    Object.entries(totals.byPlatform).sort((a, b) => b[1] - a[1]).forEach(([platform, amount]) => {
      const card = document.createElement('div');
      card.className = 'side-stat-item';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.padding = '0.75rem';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.borderRadius = 'var(--radius-md)';
      card.style.border = '1px solid var(--border)';

      card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary-light);"></div>
                    <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-soft);">${platform}</span>
                </div>
                <span style="font-size: 0.85rem; font-weight: 700; color: var(--text);">${fmt(amount)}</span>
            `;
      platformCardsWrap.appendChild(card);
    });
  }
}

function renderDepositsTable() {
  if (!depositsTableBody) return;
  depositsTableBody.innerHTML = '';

  // Sort by date desc
  const sorted = [...deposits].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(d => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
            <td style="padding: 1rem;">${fmtDate(d.date)}</td>
            <td style="padding: 1rem;"><span class="pill" style="padding: 2px 8px; font-size: 0.75rem;">${d.account}</span></td>
            <td style="padding: 1rem; text-align: right; font-weight: 600;">${fmt(d.amount)}</td>
            <td style="padding: 1rem; text-align: center; display: flex; gap: 8px; justify-content: center;">
                <button class="btn-icon" onclick="openEditDepositModal(${d.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
                <button class="delete-table-btn" onclick="removeDeposit(${d.id})">✕</button>
            </td>
        `;
    depositsTableBody.appendChild(tr);
  });
}


function removeDeposit(id) {
  if (confirm('¿Estás seguro de eliminar este fondeo?')) {
    deposits = deposits.filter(d => d.id !== id);
    updateLocalStorage();
    updateDepositsUI();
    updateDashboard();
  }
}

// Deposit Modal Logic
function openEditDepositModal(id) {
  const item = deposits.find(d => d.id === id);
  if (!item) return;

  document.getElementById('edit-deposit-id').value = item.id;
  document.getElementById('edit-deposit-account').value = item.account;
  document.getElementById('edit-deposit-amount').value = item.amount;
  document.getElementById('edit-deposit-date').value = item.date;

  document.getElementById('edit-deposit-modal').style.display = 'flex';
}

function closeEditDepositModal() {
  document.getElementById('edit-deposit-modal').style.display = 'none';
}

const editDepositForm = document.getElementById('edit-deposit-form');
if (editDepositForm) {
  editDepositForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-deposit-id').value);
    const index = deposits.findIndex(d => d.id === id);

    if (index !== -1) {
      deposits[index] = {
        id: id,
        account: document.getElementById('edit-deposit-account').value,
        amount: parseFloat(document.getElementById('edit-deposit-amount').value),
        date: document.getElementById('edit-deposit-date').value
      };
      updateLocalStorage();
      updateDepositsUI();
      updateDashboard();
      closeEditDepositModal();
    }
  });
}

if (depositForm) {
  depositForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const account = document.getElementById('deposit-account').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const date = document.getElementById('deposit-date').value;

    if (!account || isNaN(amount) || !date) return;

    const newDeposit = {
      id: generateID(),
      account: account,
      amount: amount,
      date: date
    };

    deposits.push(newDeposit);
    updateLocalStorage();
    updateDepositsUI();
    depositForm.reset();
    document.getElementById('deposit-date').valueAsDate = new Date();
  });
}

document.getElementById('deposit-date').valueAsDate = new Date();

// ===== SEED DATA =====
function seedDeposits() {
  if (deposits.length > 0) return;

  const initialData = [
    { "id": 9086692, "date": "2026-02-12", "amount": 192000.0, "account": "IOL" },
    { "id": 41430657, "date": "2026-01-14", "amount": 2183.0, "account": "Cocos" },
    { "id": 99418149, "date": "2025-12-21", "amount": 8000.0, "account": "IOL" },
    { "id": 8789740, "date": "2025-12-22", "amount": 19713.0, "account": "Cocos" },
    { "id": 59578177, "date": "2025-12-14", "amount": 14710.0, "account": "Cocos" },
    { "id": 20599782, "date": "2025-01-20", "amount": 210000.0, "account": "IOL" },
    { "id": 47273581, "date": "2025-01-16", "amount": 8893.0, "account": "IOL" },
    { "id": 67636365, "date": "2025-01-16", "amount": 100000.0, "account": "IOL" },
    { "id": 98612488, "date": "2025-01-13", "amount": 52500.0, "account": "IOL" },
    { "id": 30531830, "date": "2025-01-09", "amount": 100000.0, "account": "IOL" },
    { "id": 38425001, "date": "2025-01-06", "amount": 200000.0, "account": "IOL" },
    { "id": 72056497, "date": "2025-01-03", "amount": 35000.0, "account": "IOL" },
    { "id": 7326920, "date": "2025-01-02", "amount": 100000.0, "account": "IOL" },
    { "id": 39062299, "date": "2024-12-30", "amount": 13000.0, "account": "IOL" },
    { "id": 62512845, "date": "2024-12-27", "amount": 155000.0, "account": "IOL" },
    { "id": 53812581, "date": "2024-12-20", "amount": 150000.0, "account": "IOL" },
    { "id": 83542553, "date": "2024-12-19", "amount": 100000.0, "account": "IOL" },
    { "id": 81648705, "date": "2024-12-17", "amount": 5000.0, "account": "IOL" },
    { "id": 46395632, "date": "2024-12-17", "amount": 28000.0, "account": "IOL" },
    { "id": 59316274, "date": "2024-12-13", "amount": 60000.0, "account": "IOL" },
    { "id": 19133663, "date": "2024-12-06", "amount": 53000.0, "account": "IOL" },
    { "id": 92128842, "date": "2024-12-04", "amount": 216000.0, "account": "IOL" },
    { "id": 46159378, "date": "2024-12-03", "amount": 61437.74, "account": "IOL" },
    { "id": 4919795, "date": "2024-11-21", "amount": 56000.0, "account": "IOL" },
    { "id": 87340838, "date": "2024-11-07", "amount": 58000.0, "account": "IOL" },
    { "id": 21516784, "date": "2024-10-30", "amount": 27007.25, "account": "IOL" },
    { "id": 98303551, "date": "2024-10-25", "amount": 60800.0, "account": "IOL" },
    { "id": 58761317, "date": "2024-10-23", "amount": 100000.0, "account": "IOL" },
    { "id": 91262891, "date": "2024-10-17", "amount": 60000.0, "account": "IOL" },
    { "id": 76279029, "date": "2024-10-10", "amount": 60000.0, "account": "IOL" },
    { "id": 95641901, "date": "2024-10-03", "amount": 200000.0, "account": "IOL" },
    { "id": 47461074, "date": "2024-10-02", "amount": 63000.0, "account": "IOL" },
    { "id": 77176048, "date": "2024-09-23", "amount": 172000.0, "account": "IOL" },
    { "id": 57809728, "date": "2024-09-23", "amount": 60000.0, "account": "IOL" },
    { "id": 19699650, "date": "2024-09-13", "amount": 65000.0, "account": "IOL" },
    { "id": 10907625, "date": "2024-09-06", "amount": 62000.0, "account": "IOL" },
    { "id": 71910003, "date": "2024-08-26", "amount": 64000.0, "account": "IOL" },
    { "id": 96308380, "date": "2024-08-21", "amount": 100000.0, "account": "IOL" },
    { "id": 2738954, "date": "2024-08-20", "amount": 50000.0, "account": "IOL" },
    { "id": 65062026, "date": "2024-08-19", "amount": 65000.0, "account": "IOL" },
    { "id": 18978823, "date": "2024-08-15", "amount": 20000.0, "account": "IOL" },
    { "id": 95986700, "date": "2024-08-07", "amount": 150000.0, "account": "IOL" },
    { "id": 84804850, "date": "2024-08-04", "amount": 500.0, "account": "Binance" },
    { "id": 86224971, "date": "2024-08-04", "amount": 69000.0, "account": "Binance" },
    { "id": 15292062, "date": "2024-07-03", "amount": 200.0, "account": "IOL" },
    { "id": 26641717, "date": "2024-07-02", "amount": 27.83, "account": "IOL" },
    { "id": 47410143, "date": "2024-07-01", "amount": 100000.0, "account": "IOL" },
    { "id": 6466071, "date": "2024-07-01", "amount": 200000.0, "account": "IOL" },
    { "id": 47016809, "date": "2024-06-28", "amount": 14914.33, "account": "IOL" },
    { "id": 45913084, "date": "2024-06-26", "amount": 411.41, "account": "IOL" },
    { "id": 36003883, "date": "2024-06-25", "amount": 296.72, "account": "IOL" },
    { "id": 7718657, "date": "2024-06-25", "amount": 17.03, "account": "IOL" },
    { "id": 56715540, "date": "2024-06-24", "amount": 300000.0, "account": "IOL" },
    { "id": 6712918, "date": "2024-06-19", "amount": 5809.9, "account": "IOL" },
    { "id": 26940509, "date": "2024-06-15", "amount": 2.0, "account": "IOL" },
    { "id": 57339098, "date": "2024-06-03", "amount": 42000.0, "account": "IOL" },
    { "id": 44205529, "date": "2024-06-03", "amount": 30000.0, "account": "IOL" },
    { "id": 83929702, "date": "2024-05-27", "amount": 100000.0, "account": "IOL" },
    { "id": 3944442, "date": "2024-05-16", "amount": 39748.97, "account": "IOL" },
    { "id": 48667834, "date": "2024-05-03", "amount": 200447.29, "account": "Binance" },
    { "id": 75710193, "date": "2024-05-03", "amount": 400000.0, "account": "IOL" },
    { "id": 66325431, "date": "2024-05-03", "amount": 69891.75, "account": "IOL" },
    { "id": 56946914, "date": "2024-05-01", "amount": 4521.66, "account": "Binance" },
    { "id": 83883563, "date": "2024-04-26", "amount": 20809.43, "account": "IOL" },
    { "id": 85845873, "date": "2024-04-23", "amount": 10000.0, "account": "IOL" },
    { "id": 44395288, "date": "2024-04-04", "amount": 53469.14, "account": "IOL" },
    { "id": 73356926, "date": "2024-03-11", "amount": 2360.0, "account": "Binance" },
    { "id": 96756090, "date": "2024-02-24", "amount": 12296.35, "account": "Binance" },
    { "id": 33289523, "date": "2024-02-14", "amount": 2516.4, "account": "Binance" },
    { "id": 54721232, "date": "2024-02-14", "amount": 8009.93, "account": "Binance" },
    { "id": 44216274, "date": "2024-02-09", "amount": 14000.0, "account": "Binance" },
    { "id": 8626502, "date": "2024-02-01", "amount": 133796.15, "account": "Binance" },
    { "id": 52135005, "date": "2024-01-02", "amount": 100000.0, "account": "Binance" },
    { "id": 71140746, "date": "2023-12-31", "amount": 43271.0, "account": "Binance" },
    { "id": 99313688, "date": "2023-12-23", "amount": 13879.01, "account": "Binance" },
    { "id": 19163718, "date": "2023-12-22", "amount": 50000.0, "account": "Binance" },
    { "id": 89552605, "date": "2023-07-24", "amount": 1000.0, "account": "Binance" },
    { "id": 63878751, "date": "2023-07-24", "amount": 1043.85, "account": "Binance" },
    { "id": 52053064, "date": "2023-07-19", "amount": 1162.82, "account": "Binance" },
    { "id": 76844057, "date": "2023-07-19", "amount": 2000.0, "account": "Binance" },
    { "id": 61204343, "date": "2023-06-29", "amount": 5000.0, "account": "Binance" },
    { "id": 63855747, "date": "2022-06-03", "amount": 20000.0, "account": "Binance" },
    { "id": 7154920, "date": "2022-05-12", "amount": 20400.0, "account": "Binance" },
    { "id": 2438006, "date": "2022-05-04", "amount": 20000.0, "account": "Binance" },
    { "id": 28664399, "date": "2022-04-06", "amount": 22000.0, "account": "Binance" },
    { "id": 92077535, "date": "2022-04-04", "amount": 20000.0, "account": "Binance" },
    { "id": 7827722, "date": "2022-03-27", "amount": 20000.0, "account": "Binance" },
    { "id": 21032441, "date": "2022-03-18", "amount": 20000.0, "account": "Binance" },
    { "id": 17364041, "date": "2022-03-09", "amount": 15000.0, "account": "Binance" },
    { "id": 97955404, "date": "2022-02-23", "amount": 20000.0, "account": "Binance" },
    { "id": 93293849, "date": "2022-02-17", "amount": 20000.0, "account": "Binance" },
    { "id": 16888344, "date": "2022-02-13", "amount": 20100.0, "account": "Binance" },
    { "id": 48551929, "date": "2022-02-08", "amount": 20000.0, "account": "Binance" },
    { "id": 10449000, "date": "2022-02-07", "amount": 16000.0, "account": "Binance" },
    { "id": 79146442, "date": "2022-01-31", "amount": 4090.0, "account": "Binance" },
    { "id": 75342661, "date": "2022-01-19", "amount": 6200.0, "account": "Binance" },
    { "id": 67449323, "date": "2022-01-05", "amount": 6200.0, "account": "Binance" },
    { "id": 47138603, "date": "2021-12-09", "amount": 6300.0, "account": "Binance" },
    { "id": 21151929, "date": "2021-12-01", "amount": 6000.0, "account": "Binance" },
    { "id": 87284799, "date": "2021-11-22", "amount": 7500.0, "account": "Binance" },
    { "id": 60904817, "date": "2021-10-12", "amount": 5050.0, "account": "Binance" },
    { "id": 63569101, "date": "2021-09-30", "amount": 5000.0, "account": "Binance" },
    { "id": 90359063, "date": "2021-08-30", "amount": 5990.0, "account": "Binance" },
    { "id": 82880330, "date": "2021-08-27", "amount": 5100.0, "account": "Binance" },
    { "id": 30416681, "date": "2021-07-30", "amount": 5000.0, "account": "Binance" },
    { "id": 33062499, "date": "2021-07-06", "amount": 5200.0, "account": "Binance" },
    { "id": 13630424, "date": "2021-06-11", "amount": 5000.0, "account": "Binance" },
    { "id": 27117404, "date": "2021-06-09", "amount": 5000.0, "account": "Binance" },
    { "id": 65581422, "date": "2021-06-07", "amount": 6000.0, "account": "Binance" },
    { "id": 3412779, "date": "2021-06-06", "amount": 5000.0, "account": "Binance" },
    { "id": 33346770, "date": "2021-06-03", "amount": 3000.0, "account": "Binance" },
    { "id": 65438202, "date": "2021-06-01", "amount": 10000.0, "account": "Binance" },
    { "id": 25754708, "date": "2021-05-26", "amount": 10000.0, "account": "Binance" },
    { "id": 49006760, "date": "2021-05-25", "amount": 10000.0, "account": "Binance" },
    { "id": 39833230, "date": "2021-05-24", "amount": 10000.0, "account": "Binance" },
    { "id": 16905744, "date": "2025-05-13", "amount": 100225.15, "account": "Cocos" },
    { "id": 57966712, "date": "2025-05-15", "amount": 6851.48, "account": "Cocos" },
    { "id": 86019932, "date": "2025-05-16", "amount": 1053994.4, "account": "Cocos" },
    { "id": 89554667, "date": "2025-05-20", "amount": 1000.0, "account": "Cocos" },
    { "id": 95548845, "date": "2025-05-22", "amount": 48578.27, "account": "Cocos" },
    { "id": 3824677, "date": "2025-05-22", "amount": 1000.0, "account": "Cocos" },
    { "id": 74409728, "date": "2025-05-23", "amount": 1000.0, "account": "Cocos" },
    { "id": 99809253, "date": "2025-05-26", "amount": 1000.0, "account": "Cocos" },
    { "id": 82707712, "date": "2025-05-27", "amount": 1000.0, "account": "Cocos" },
    { "id": 26389915, "date": "2025-05-27", "amount": 28291.29, "account": "Cocos" },
    { "id": 34254398, "date": "2025-05-27", "amount": 3518.94, "account": "Cocos" },
    { "id": 26089794, "date": "2025-05-27", "amount": 10000.0, "account": "Cocos" },
    { "id": 45750779, "date": "2025-05-28", "amount": 1000.0, "account": "Cocos" },
    { "id": 35518980, "date": "2025-05-28", "amount": 3500.45, "account": "Cocos" },
    { "id": 22424383, "date": "2025-05-29", "amount": 1111.0, "account": "Cocos" },
    { "id": 98767726, "date": "2025-05-29", "amount": 3501.75, "account": "Cocos" },
    { "id": 1536339, "date": "2025-05-29", "amount": 3000000.0, "account": "Cocos" },
    { "id": 12490153, "date": "2025-05-30", "amount": 820.68, "account": "Cocos" },
    { "id": 18506177, "date": "2025-05-30", "amount": 1396.62, "account": "Cocos" },
    { "id": 93640, "date": "2025-06-02", "amount": 4190.87, "account": "Cocos" },
    { "id": 55545531, "date": "2025-06-02", "amount": 1462.84, "account": "Cocos" },
    { "id": 65898600, "date": "2025-06-03", "amount": 1000.0, "account": "Cocos" },
    { "id": 35389345, "date": "2025-06-03", "amount": 1395.5, "account": "Cocos" },
    { "id": 20342126, "date": "2025-06-03", "amount": 2268.37, "account": "Cocos" },
    { "id": 6067461, "date": "2025-06-04", "amount": 1000.0, "account": "Cocos" },
    { "id": 44684017, "date": "2025-06-04", "amount": 1397.84, "account": "Cocos" },
    { "id": 29720330, "date": "2025-06-05", "amount": 1392.27, "account": "Cocos" },
    { "id": 61589404, "date": "2025-06-05", "amount": 1000.0, "account": "Cocos" },
    { "id": 26301063, "date": "2025-06-06", "amount": 1397.7, "account": "Cocos" },
    { "id": 61470672, "date": "2025-06-06", "amount": 1000.0, "account": "Cocos" },
    { "id": 40853248, "date": "2025-06-09", "amount": 47262.99, "account": "Cocos" },
    { "id": 5598102, "date": "2025-06-09", "amount": 1000.0, "account": "Cocos" },
    { "id": 16786816, "date": "2025-06-10", "amount": 1427.05, "account": "Cocos" },
    { "id": 94022384, "date": "2025-06-10", "amount": 1000.0, "account": "Cocos" },
    { "id": 96202964, "date": "2025-06-11", "amount": 61985.57, "account": "Cocos" },
    { "id": 9627436, "date": "2025-06-11", "amount": 1444.1, "account": "Cocos" },
    { "id": 61678529, "date": "2025-06-11", "amount": 1000.0, "account": "Cocos" },
    { "id": 12914457, "date": "2025-06-12", "amount": 180.88, "account": "Cocos" },
    { "id": 15946033, "date": "2025-06-12", "amount": 2288.26, "account": "Cocos" },
    { "id": 88319533, "date": "2025-06-12", "amount": 1000.0, "account": "Cocos" },
    { "id": 62472768, "date": "2025-06-13", "amount": 1977.62, "account": "Cocos" },
    { "id": 38842803, "date": "2025-06-13", "amount": 1492.02, "account": "Cocos" },
    { "id": 74205954, "date": "2025-06-13", "amount": 35.0, "account": "Cocos" },
    { "id": 45578928, "date": "2025-06-13", "amount": 1502.86, "account": "Cocos" },
    { "id": 75009867, "date": "2025-06-13", "amount": 1000.0, "account": "Cocos" },
    { "id": 40359828, "date": "2025-06-17", "amount": 1000.0, "account": "Cocos" },
    { "id": 99841480, "date": "2025-06-17", "amount": 1400.0, "account": "Cocos" },
    { "id": 7157514, "date": "2025-06-17", "amount": 600.0, "account": "Cocos" },
    { "id": 69263035, "date": "2025-06-17", "amount": 5871.47, "account": "Cocos" },
    { "id": 68514050, "date": "2025-06-17", "amount": 8101.76, "account": "Cocos" },
    { "id": 48386281, "date": "2025-06-18", "amount": 1000.0, "account": "Cocos" },
    { "id": 42838823, "date": "2025-06-18", "amount": 1512.19, "account": "Cocos" },
    { "id": 57969893, "date": "2025-06-19", "amount": 632.0, "account": "Cocos" },
    { "id": 23513585, "date": "2025-06-19", "amount": 1000.0, "account": "Cocos" },
    { "id": 74108632, "date": "2025-06-19", "amount": 1535.98, "account": "Cocos" },
    { "id": 2480534, "date": "2025-06-23", "amount": 1000.0, "account": "Cocos" },
    { "id": 57899952, "date": "2025-06-23", "amount": 589.0, "account": "Cocos" },
    { "id": 21127960, "date": "2025-06-23", "amount": 5855.19, "account": "Cocos" },
    { "id": 32725261, "date": "2025-06-24", "amount": 1000.0, "account": "Cocos" },
    { "id": 90196245, "date": "2025-06-25", "amount": 1000.0, "account": "Cocos" },
    { "id": 46238062, "date": "2025-06-25", "amount": 1469.37, "account": "Cocos" },
    { "id": 83955677, "date": "2025-06-26", "amount": 2941.55, "account": "Cocos" },
    { "id": 35259338, "date": "2025-06-26", "amount": 1000.0, "account": "Cocos" },
    { "id": 59014587, "date": "2025-06-27", "amount": 1000.0, "account": "Cocos" },
    { "id": 13783931, "date": "2025-06-27", "amount": 1479.89, "account": "Cocos" },
    { "id": 39089632, "date": "2025-06-30", "amount": 1000.0, "account": "Cocos" },
    { "id": 26740866, "date": "2025-06-30", "amount": 4427.17, "account": "Cocos" },
    { "id": 99372671, "date": "2025-07-01", "amount": 1449.45, "account": "Cocos" },
    { "id": 82020043, "date": "2025-07-01", "amount": 1000.0, "account": "Cocos" },
    { "id": 43222873, "date": "2025-07-02", "amount": 1000.0, "account": "Cocos" },
    { "id": 1637258, "date": "2025-07-02", "amount": 1403.93, "account": "Cocos" },
    { "id": 5417615, "date": "2025-07-04", "amount": 1336.35, "account": "Cocos" },
    { "id": 24825447, "date": "2025-07-08", "amount": 5202.36, "account": "Cocos" },
    { "id": 15072248, "date": "2025-07-14", "amount": 3288.15, "account": "Cocos" },
    { "id": 8259530, "date": "2025-07-15", "amount": 1051.0, "account": "Cocos" },
    { "id": 31813716, "date": "2025-07-18", "amount": 4521.3, "account": "Cocos" },
    { "id": 65217345, "date": "2025-07-18", "amount": 1288.56, "account": "Cocos" },
    { "id": 67545439, "date": "2025-07-21", "amount": 18093.54, "account": "Cocos" },
    { "id": 82262579, "date": "2025-07-22", "amount": 1985.79, "account": "Cocos" },
    { "id": 62482334, "date": "2025-07-23", "amount": 2201.98, "account": "Cocos" },
    { "id": 76725626, "date": "2025-07-24", "amount": 1895.84, "account": "Cocos" },
    { "id": 94470012, "date": "2025-07-25", "amount": 1681.8, "account": "Cocos" },
    { "id": 66005806, "date": "2025-07-30", "amount": 8227.13, "account": "Cocos" },
    { "id": 37758581, "date": "2025-07-31", "amount": 1532.63, "account": "Cocos" },
    { "id": 28314939, "date": "2025-08-01", "amount": 1544.37, "account": "Cocos" },
    { "id": 83402045, "date": "2025-08-04", "amount": 4464.51, "account": "Cocos" },
    { "id": 16677721, "date": "2025-08-05", "amount": 1487.65, "account": "Cocos" },
    { "id": 59848447, "date": "2025-08-06", "amount": 1495.22, "account": "Cocos" },
    { "id": 25971960, "date": "2025-08-07", "amount": 1502.05, "account": "Cocos" },
    { "id": 24705740, "date": "2025-08-08", "amount": 1828.88, "account": "Cocos" },
    { "id": 45120491, "date": "2025-08-11", "amount": 5940.0, "account": "Cocos" },
    { "id": 98869850, "date": "2025-08-12", "amount": 2057.42, "account": "Cocos" },
    { "id": 69089740, "date": "2025-08-13", "amount": 108500.0, "account": "Cocos" },
    { "id": 78494519, "date": "2025-08-13", "amount": 110270.93, "account": "Cocos" },
    { "id": 49714767, "date": "2025-08-14", "amount": 2125.07, "account": "Cocos" },
    { "id": 97166865, "date": "2025-08-18", "amount": 9805.0, "account": "Cocos" },
    { "id": 47478231, "date": "2025-08-19", "amount": 1994.18, "account": "Cocos" },
    { "id": 66132278, "date": "2025-08-26", "amount": 7714.0, "account": "Cocos" },
    { "id": 98435369, "date": "2025-08-26", "amount": 10000.0, "account": "Cocos" },
    { "id": 48615098, "date": "2025-08-27", "amount": 1122.76, "account": "Cocos" },
    { "id": 39395085, "date": "2025-08-28", "amount": 9000.0, "account": "Cocos" },
    { "id": 29642570, "date": "2025-09-10", "amount": 10000.0, "account": "Cocos" },
    { "id": 15689365, "date": "2025-09-15", "amount": 7338.83, "account": "Cocos" },
    { "id": 8418316, "date": "2025-10-08", "amount": 603564.85, "account": "Cocos" },
    { "id": 29482707, "date": "2025-10-14", "amount": 7655.7, "account": "Cocos" },
    { "id": 24383800, "date": "2025-10-15", "amount": 1000000.0, "account": "Cocos" },
    { "id": 16334191, "date": "2025-10-22", "amount": 7390.28, "account": "Cocos" },
    { "id": 81383451, "date": "2025-11-03", "amount": 18603.62, "account": "Cocos" },
    { "id": 40187768, "date": "2025-11-07", "amount": 2345.97, "account": "Cocos" },
    { "id": 45150176, "date": "2025-11-20", "amount": 175109.0, "account": "Cocos" },
    { "id": 36492382, "date": "2025-11-26", "amount": 1000000.0, "account": "Cocos" },
    { "id": 52946348, "date": "2025-11-27", "amount": 90000.0, "account": "Cocos" },
    { "id": 90872676, "date": "2025-12-02", "amount": 16336.81, "account": "Cocos" },
    { "id": 50156910, "date": "2025-12-04", "amount": 1600000.0, "account": "Cocos" }
  ];

  deposits = initialData;
  updateLocalStorage();
  updateDepositsUI();
}

// ===== INIT =====
function init() {
  populateYearFilter();
  updateDashboard();
  renderHistoryList();
  updateFormSideStats();

  if (typeof updateSavingsUI === 'function') updateSavingsUI();
  if (typeof updateDepositsUI === 'function') {
    updateDepositsUI();
    if (deposits.length === 0) seedDeposits();
  }
}

init();

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
  'savings': ['Mis Ahorros', 'Gestión de activos y capital']
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

function populateYearFilter() {
  const allDates = [
    ...transactions.map(t => t.date),
    ...savings.map(s => s.date)
  ].filter(d => d);
  const years = [...new Set(allDates.map(d => new Date(d + 'T00:00:00').getFullYear()))].sort((a, b) => b - a);
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
function updateKPIs(displayTransactions, displaySavings) {
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
  const totalSav = (displaySavings || savings).reduce((acc, s) => acc + (s.price), 0);
  const totalSavingsEl = document.getElementById('total-savings');
  if (totalSavingsEl) totalSavingsEl.innerText = fmt(totalSav);
}

// ===== CHARTS =====
let monthlyChartInstance = null;
let balanceEvolutionChartInstance = null;
let dashSavingsChartInstance = null;
let dashSavingsQtyChartInstance = null;

function updateCharts(displayTransactions, displaySavings) {
  const monthlyCanvas = document.getElementById('monthlyChart');
  const dashSavingsCanvas = document.getElementById('dashSavingsChart');
  const dashSavingsQtyCanvas = document.getElementById('dashSavingsQtyChart');

  if (!monthlyCanvas) return;
  const palette = ['#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

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
    (displaySavings || savings).forEach(s => {
      assetsData[s.asset] = (assetsData[s.asset] || 0) + (s.price);
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

  // Portfolio Quantities Distribution
  if (dashSavingsQtyCanvas) {
    const assetsQtyData = {};
    (displaySavings || savings).forEach(s => {
      assetsQtyData[s.asset] = (assetsQtyData[s.asset] || 0) + s.quantity;
    });

    const labels = Object.keys(assetsQtyData);
    const values = Object.values(assetsQtyData);

    if (dashSavingsQtyChartInstance) dashSavingsQtyChartInstance.destroy();

    if (labels.length > 0) {
      dashSavingsQtyChartInstance = new Chart(dashSavingsQtyCanvas, {
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
                label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} uds.`
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
let savingsQtyChartInstance = null;

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
      price: a, // now stores Total Amount
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
  const assetsQtyData = {};

  sorted.forEach(s => {
    // Treat s.price as the TOTAL amount
    const total = s.price;
    const unitPrice = s.quantity > 0 ? s.price / s.quantity : 0;

    totalValue += total;
    assetsData[s.asset] = (assetsData[s.asset] || 0) + total;
    assetsQtyData[s.asset] = (assetsQtyData[s.asset] || 0) + s.quantity;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
            <td style="padding: 1rem;">${fmtDate(s.date)}</td>
            <td style="padding: 1rem; font-weight: 700; color: var(--primary-light);">${s.asset}</td>
            <td style="padding: 1rem; text-align: right;">${s.quantity}</td>
            <td style="padding: 1rem; text-align: right;">${fmt(unitPrice)}</td>
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
      .reduce((acc, s) => acc + (s.price), 0);
    monthEl.innerText = fmt(monthTotal);
  }

  // Summary List
  const summaryEl = document.getElementById('savings-asset-summary');
  if (summaryEl) {
    summaryEl.innerHTML = '';
    Object.entries(assetsData)
      .sort((a, b) => b[1] - a[1])
      .forEach(([asset, val]) => {
        const qty = assetsQtyData[asset] || 0;
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; padding:12px 16px; background:rgba(255,255,255,0.03); border-radius:12px; align-items:center; border: 1px solid rgba(255,255,255,0.05); transition: all 0.2s ease;';
        item.innerHTML = `
          <div style="display:flex; flex-direction:column; gap: 4px;">
            <span style="font-weight:700; color: var(--text); font-size: 1rem; letter-spacing: 0.5px;">${asset}</span>
            <div style="display:flex; align-items:center; gap: 6px;">
              <span style="font-size:0.75rem; color:var(--primary-light); background: rgba(124, 58, 237, 0.1); padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                ${qty.toLocaleString('es-AR', { maximumFractionDigits: 8 })} uds.
              </span>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size:1rem; font-weight:800; color:var(--text);">${fmt(val)}</span>
            <p style="font-size:0.65rem; color:var(--text-muted); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">Total Ahorrado</p>
          </div>
        `;
        summaryEl.appendChild(item);
      });
  }

  // Visual Chart
  updateSavingsAssetChart(assetsData);
  updateSavingsQtyChart(assetsQtyData);
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
  document.getElementById('edit-savings-asset').value = item.asset;
  document.getElementById('edit-savings-platform').value = item.platform;
  document.getElementById('edit-savings-quantity').value = item.quantity;
  document.getElementById('edit-savings-amount').value = (item.price).toFixed(2);
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
        price: a, // store Total Amount
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

function updateDashboard() {
  const displayTransactions = getDashboardFilteredTransactions();
  const displaySavings = getDashboardFilteredSavings();
  updateKPIs(displayTransactions, displaySavings);
  updateCharts(displayTransactions, displaySavings);
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
      price: Math.abs(amount), // Store Total Amount
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
    isSavingCheck.addEventListener('change', () => {
      savingField.style.display = isSavingCheck.checked ? 'block' : 'none';
    });
  }

  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('expense-text').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;
    const platform = document.getElementById('expense-platform').value;
    const isSaving = isSavingCheck ? isSavingCheck.checked : false;
    const qty = document.getElementById('expense-qty') ? (parseFloat(document.getElementById('expense-qty').value) || 1) : 1;

    if (!text || !amount || !date || !platform) return;
    createTransactionFromForm(text, amount, -1, date, platform, isSaving, false, qty, '');
    expenseForm.reset();
    document.getElementById('expense-date').valueAsDate = new Date();
    if (savingField) savingField.style.display = 'none';

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

// Fondeos logic removed

// ===== INIT =====
function init() {
  populateYearFilter();
  updateDashboard();
  renderHistoryList();
  updateFormSideStats();

  if (typeof updateSavingsUI === 'function') updateSavingsUI();
}

init();

// Elements
const balance = document.getElementById('balance');
const money_plus = document.getElementById('money-plus');
const money_minus = document.getElementById('money-minus');
const list = document.getElementById('list'); // Main list
const recentList = document.getElementById('recent-list'); // Dashboard list
const form = document.getElementById('form');
const text = document.getElementById('text');
const amount = document.getElementById('amount');
const dateInput = document.getElementById('date');
const platformInput = document.getElementById('platform');
const emptyMsg = document.getElementById('empty-msg');
const filterBtns = document.querySelectorAll('.filter-btn');
const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item, .view-all');
const viewSections = document.querySelectorAll('.view-section');
const viewTitle = document.getElementById('view-title');

const initialMovements = [
  { date: '2026-02-16', amount: -44000.00, text: 'Teatro Mari', platform: 'Personal Pay' },
  { date: '2026-02-14', amount: -37043.67, text: 'Super', platform: 'Personal Pay' },
  { date: '2026-02-10', amount: -9500.00, text: 'Futbol', platform: 'Belo' },
  { date: '2026-02-10', amount: -45003.28, text: 'Tarjeta - Personal', platform: 'Personal Pay' },
  { date: '2026-02-10', amount: -8485.00, text: 'Tarjeta - Dia', platform: 'Personal Pay' },
  { date: '2026-02-07', amount: -7000.00, text: 'Flores', platform: 'Belo' },
  { date: '2026-02-06', amount: -15180.00, text: 'Súper Dia', platform: 'Personal Pay' },
  { date: '2026-02-06', amount: -15980.00, text: 'ABL - Condarco', platform: 'Buepp' },
  { date: '2026-02-06', amount: -11240.00, text: 'ABL - Lafuente', platform: 'Buepp' },
  { date: '2026-02-06', amount: -316016.01, text: 'Tarjeta - Resumen', platform: 'Santander' },
  { date: '2026-02-06', amount: -50000.00, text: 'Clau', platform: 'Belo' },
  { date: '2026-02-04', amount: -35000.00, text: 'Federico Gabriel Dante Cingolani', platform: 'Belo' },
  { date: '2026-02-03', amount: -33891.00, text: 'Tarjeta - La esquina da las aceitunas', platform: 'Personal Pay' },
  { date: '2026-02-03', amount: -11500.00, text: 'Tarjeta - Tuenti', platform: 'Personal Pay' },
  { date: '2026-02-02', amount: -550.00, text: 'Tarjeta - Pedidos Ya', platform: 'Personal Pay' },
  { date: '2026-02-02', amount: -14048.00, text: 'Tarjeta - Pedidos Ya', platform: 'Personal Pay' },
  { date: '2026-01-30', amount: -60000.00, text: 'Azar Pedro', platform: 'Personal Pay' },
  { date: '2026-01-29', amount: -4900.00, text: 'Adrian Walter Bersano', platform: 'LB Finanzas' },
  { date: '2026-01-27', amount: -99102.68, text: 'Tarjeta', platform: 'Personal Pay' },
  { date: '2026-01-23', amount: -50000.00, text: 'Azar Pedro', platform: 'LB Finanzas' },
  { date: '2026-01-19', amount: -28750.00, text: 'Pago - Varios', platform: 'Buepp' },
  { date: '2026-01-16', amount: -16637.80, text: 'Tarjeta', platform: 'Personal Pay' },
  { date: '2026-01-16', amount: -16637.80, text: 'Tarjeta - Metrogas', platform: 'Personal Pay' },
  { date: '2026-01-15', amount: -12602.86, text: 'ABL - Lafuente', platform: 'Buepp' },
  { date: '2026-01-15', amount: -8840.00, text: 'Tarjeta - Cenat/ansv', platform: 'Personal Pay' },
  { date: '2026-01-15', amount: -70600.00, text: 'Tarjeta - Lo de Charly', platform: 'Personal Pay' },
  { date: '2026-01-13', amount: -25050.00, text: 'Tarjeta - Zeiter Srl', platform: 'Personal Pay' },
  { date: '2026-01-12', amount: -38064.50, text: 'Tarjeta - Personal/Flow', platform: 'Personal Pay' },
  { date: '2026-01-10', amount: -661.00, text: 'Tarjeta - Pedidos Ya', platform: 'Personal Pay' },
  { date: '2026-01-10', amount: -25339.00, text: 'Tarjeta - Pedidos Ya', platform: 'Personal Pay' },
  { date: '2026-01-09', amount: -63560.00, text: 'Pago - Chacarita', platform: 'Buepp' },
  { date: '2026-01-09', amount: -558000.00, text: 'Tarjeta - Resumen', platform: 'Santander' },
  { date: '2026-01-08', amount: -45155.09, text: 'Tarjeta - Carrefour', platform: 'Personal Pay' },
  { date: '2026-01-08', amount: 0.00, text: 'transferencia confirmada', platform: 'Santander' },
  { date: '2026-01-07', amount: -8625.00, text: 'Jose Nicolas Bocles', platform: 'Personal Pay' },
  { date: '2026-01-07', amount: -8000.00, text: 'Alberto Miguel Gnisci', platform: 'Personal Pay' },
  { date: '2026-01-06', amount: -2500.00, text: 'Marcelo Javier Tcherkassky', platform: 'LB Finanzas' },
  { date: '2026-01-05', amount: -1250.00, text: 'Tarjeta - Personal', platform: 'Personal Pay' },
  { date: '2026-01-02', amount: -11500.00, text: 'Tarjeta - Tuenti', platform: 'Personal Pay' }
];

// Set transactions to the full history by default
let transactions = initialMovements.map(m => ({ ...m, id: Math.floor(Math.random() * 100000000) }));
let currentFilter = 'all';

// Navigation Logic
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.getAttribute('data-view');
    if (!view) return;

    // Update active state
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll(`[data-view="${view}"]`).forEach(nav => nav.classList.add('active'));

    // Switch views
    viewSections.forEach(section => section.style.display = 'none');
    document.getElementById(`${view}-view`).style.display = 'block';

    // Update title
    viewTitle.innerText = view.charAt(0).toUpperCase() + view.slice(1);

    if (view === 'dashboard') {
      updateCharts();
    }
  });
});

// Add transaction
function addTransaction(e) {
  e.preventDefault();

  if (text.value.trim() === '' || amount.value.trim() === '' || dateInput.value === '' || platformInput.value === '') {
    alert('Por favor completa todos los campos');
  } else {
    const transaction = {
      id: generateID(),
      text: text.value,
      amount: +amount.value,
      date: dateInput.value,
      platform: platformInput.value
    };

    transactions.push(transaction);

    updateValues();
    updateLocalStorage();
    init();

    form.reset();
    dateInput.valueAsDate = new Date();

    // Auto switch to dashboard to see results
    document.querySelector('[data-view="dashboard"]').click();
  }
}

// Generate random ID
function generateID() {
  return Math.floor(Math.random() * 100000000);
}

// Add transactions to DOM list
function addTransactionDOM(transaction, targetList) {
  const sign = transaction.amount < 0 ? '-' : '+';
  const item = document.createElement('li');
  item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');

  const formattedDate = new Date(transaction.date + 'T00:00:00').toLocaleDateString('es-AR');

  item.innerHTML = `
    <div class="item-main">
        <span class="item-desc">${transaction.text}</span>
        <span class="item-amount">${sign}$${Math.abs(transaction.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="item-details">
        <span>${formattedDate}</span>
        <span class="platform-tag">${transaction.platform}</span>
    </div>
    <button class="delete-btn" onclick="removeTransaction(${transaction.id})">✕</button>
  `;

  targetList.appendChild(item);
}

// Update the balance, income and expense
function updateValues() {
  const amounts = transactions.map(transaction => transaction.amount);
  const total = amounts.reduce((acc, item) => (acc += item), 0);
  const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
  const expense = Math.abs(amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0));

  balance.innerText = `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  money_plus.innerText = `+$${income.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  money_minus.innerText = `-$${expense.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

// Remove transaction
function removeTransaction(id) {
  transactions = transactions.filter(transaction => transaction.id !== id);
  updateLocalStorage();
  init();
}

// Firebase sync
function updateLocalStorage() {
  const user = auth.currentUser;
  if (user) {
    db.collection('users').doc(user.uid).set({
      transactions: transactions
    }).catch(err => console.error("Error saving transactions:", err));
  }
}

let platformChartInstance = null;
let monthlyChartInstance = null;

function updateCharts() {
  const platformCanvas = document.getElementById('platformChart');
  const monthlyCanvas = document.getElementById('monthlyChart');

  if (!platformCanvas || !monthlyCanvas) return;

  // Expenses only for platform chart
  const expenses = transactions.filter(t => t.amount < 0);
  const platformData = {};
  expenses.forEach(t => {
    platformData[t.platform] = (platformData[t.platform] || 0) + Math.abs(t.amount);
  });

  const platformLabels = Object.keys(platformData);
  const platformValues = Object.values(platformData);

  if (platformChartInstance) platformChartInstance.destroy();
  platformChartInstance = new Chart(platformCanvas, {
    type: 'doughnut',
    data: {
      labels: platformLabels,
      datasets: [{
        data: platformValues,
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, usePointStyle: true } }
      },
      cutout: '75%'
    }
  });

  // Monthly Chart
  const monthlyData = {};
  transactions.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
    if (t.amount > 0) monthlyData[month].income += t.amount;
    else monthlyData[month].expense += Math.abs(t.amount);
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const monthLabels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(year, month - 1).toLocaleString('es-ES', { month: 'short' });
  });

  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(monthlyCanvas, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        { label: 'Ingresos', data: sortedMonths.map(m => monthlyData[m].income), backgroundColor: '#10b981', borderRadius: 6 },
        { label: 'Gastos', data: sortedMonths.map(m => monthlyData[m].expense), backgroundColor: '#ef4444', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// Init app
function init() {
  list.innerHTML = '';
  recentList.innerHTML = '';

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Populate recent list (first 5)
  sortedTransactions.slice(0, 5).forEach(t => addTransactionDOM(t, recentList));

  // Populate full list with filters
  let filteredTransactions = sortedTransactions;
  if (currentFilter === 'income') filteredTransactions = sortedTransactions.filter(t => t.amount > 0);
  if (currentFilter === 'expense') filteredTransactions = sortedTransactions.filter(t => t.amount < 0);

  filteredTransactions.forEach(t => addTransactionDOM(t, list));

  updateValues();
  updateCharts();

  emptyMsg.style.display = filteredTransactions.length === 0 ? 'block' : 'none';
}

// Listeners
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    init();
  });
});

document.getElementById('add-transaction-btn').addEventListener('click', () => {
  document.querySelector('[data-view="transactions"]').click();
});
document.getElementById('add-transaction-fab').addEventListener('click', () => {
  document.querySelector('[data-view="transactions"]').click();
});

document.getElementById('sync-history-btn').addEventListener('click', () => {
  if (confirm('¿Quieres cargar los 39 movimientos oficiales? Esto sincronizará tu cuenta con el historial completo.')) {
    // Generate new IDs and load the full initial list
    transactions = initialMovements.map(m => ({ ...m, id: generateID() }));
    updateValues();
    updateLocalStorage(); // Push to Firestore
    init();
    alert('Historial sincronizado con éxito.');
  }
});

dateInput.valueAsDate = new Date();
form.addEventListener('submit', addTransaction);
init();

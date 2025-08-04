// Configurazione API - Auto-detect per localhost, rete locale o accesso esterno
let API_BASE;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Se siamo in localhost, usa porta 8082
    API_BASE = 'http://localhost:8082';
    console.log('Frontend - Localhost mode:', API_BASE);
} else if (window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.')) {
    // Se siamo su rete locale, usa IP con porta 8082
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('Frontend - LAN mode:', API_BASE);
} else {
    // Accesso esterno tramite port forwarding - forza HTTP per compatibilità
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('Frontend - External access mode (forced HTTP):', API_BASE);
}

const API_TOKEN = 'family_secret_token';

console.log('Frontend - API Base URL:', API_BASE);
console.log('Frontend - Current hostname:', window.location.hostname);
console.log('Frontend - Current protocol:', window.location.protocol);

// Headers per le richieste API
const headers = {
    'Content-Type': 'application/json',
    'X-Token': API_TOKEN
};

// Variabili globali
let categories = [];
let users = [];
let expenses = [];
let incomes = [];
let currentTab = 'dashboard'; // 'dashboard', 'expenses' o 'incomes'
let categoryChart = null;
let userChart = null;
let balanceChart = null;
let userBalanceChart = null;
let trendChart = null;
let topCategoriesChart = null;

// Funzione per valutare formule matematiche in modo sicuro
function evaluateMathExpression(expression) {
    try {
        // Rimuovi spazi e converti a stringa
        const expr = expression.toString().replace(/\s/g, '');
        
        // Verifica che contenga solo numeri, operatori matematici di base e punti decimali
        if (!/^[0-9+\-*/.(),\s]+$/.test(expr)) {
            throw new Error('Formula non valida: caratteri non consentiti');
        }
        
        // Verifica che non ci siano operatori consecutivi
        if (/[+\-*/]{2,}/.test(expr)) {
            throw new Error('Formula non valida: operatori consecutivi');
        }
        
        // Verifica che non inizi o finisca con un operatore (eccetto -)
        if (/^[+*/]|[+\-*/]$/.test(expr)) {
            throw new Error('Formula non valida: inizia o termina con operatore');
        }
        
        // Usa Function invece di eval per maggiore sicurezza
        const result = Function('"use strict"; return (' + expr + ')')();
        
        // Verifica che il risultato sia un numero valido
        if (isNaN(result) || !isFinite(result)) {
            throw new Error('Risultato non valido');
        }
        
        return parseFloat(result.toFixed(2));
    } catch (error) {
        throw new Error('Formula non valida: ' + error.message);
    }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Applicazione inizializzata');
    console.log('🔗 API Base URL:', API_BASE);
    
    // Mostra un messaggio di caricamento
    showLoadingMessage();
    
    await loadInitialData();
    setupEventListeners();
    setupDashboardEventListeners(); // Aggiungi event listeners dashboard
    setTodayDate();
    
    // Carica dashboard come vista predefinita
    await loadDashboard();
    
    // Nasconde il messaggio di caricamento
    hideLoadingMessage();
    
    // Avvia refresh automatico ogni 30 secondi
    setupAutoRefresh();
});

// Carica dati iniziali (categorie e utenti)
async function loadInitialData() {
    try {
        console.log('🔄 Caricamento dati iniziali...');
        
        // Carica categorie
        console.log('📊 Caricamento categorie da:', `${API_BASE}/categories`);
        const categoriesResponse = await fetch(`${API_BASE}/categories`, { headers });
        
        if (!categoriesResponse.ok) {
            throw new Error(`HTTP ${categoriesResponse.status}: ${categoriesResponse.statusText}`);
        }
        
        categories = await categoriesResponse.json();
        console.log('✅ Categorie caricate:', categories);
        populateCategorySelect();

        // Carica utenti
        console.log('👥 Caricamento utenti da:', `${API_BASE}/users`);
        const usersResponse = await fetch(`${API_BASE}/users`, { headers });
        
        if (!usersResponse.ok) {
            throw new Error(`HTTP ${usersResponse.status}: ${usersResponse.statusText}`);
        }
        
        users = await usersResponse.json();
        console.log('✅ Utenti caricati:', users);
        populateUserSelect();
        
        console.log('🎉 Dati iniziali caricati con successo!');
        // Rimuovo il messaggio di successo ridondante
    } catch (error) {
        console.error('❌ Errore nel caricamento dati iniziali:', error);
        console.log('🔧 Attivazione modalità fallback...');
        
        // Fallback con dati di esempio
        categories = [
            {id: 1, name: 'Spesa'}, 
            {id: 2, name: 'Benzina'}, 
            {id: 3, name: 'Ristorante'}, 
            {id: 4, name: 'Bollette'}, 
            {id: 5, name: 'Casa'},
            {id: 6, name: 'Salute'},
            {id: 7, name: 'Sport'},
            {id: 8, name: 'Svago'}
        ];
        users = ['Dad', 'Mom', 'Kid1', 'Kid2'];
        
        populateCategorySelect();
        populateUserSelect();
        
        console.log('📝 Categorie fallback:', categories);
        console.log('👥 Utenti fallback:', users);
        
        showError('⚠️ Modalità offline - controlla che il backend sia attivo su localhost:8082');
    }
}

// Popola il select delle categorie
function populateCategorySelect() {
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">Seleziona categoria...</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

// Popola il select degli utenti
function populateUserSelect() {
    const userSelect = document.getElementById('user');
    userSelect.innerHTML = '<option value="">Seleziona utente...</option>';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        userSelect.appendChild(option);
    });
}

// Imposta la data di oggi
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('incomeDate').value = today;
}

// Gestione navigazione tab
function switchTab(tabName) {
    console.log(`🔄 Switching to tab: ${tabName}`);
    currentTab = tabName;
    
    // Aggiorna pulsanti tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Mostra/nascondi sezioni
    const dashboardSection = document.getElementById('dashboardSection');
    const expenseSection = document.getElementById('expenseSection');
    const incomeSection = document.getElementById('incomeSection');
    const recentTitle = document.getElementById('recentTitle');
    
    // Nascondi tutte le sezioni
    dashboardSection.style.display = 'none';
    expenseSection.style.display = 'none';
    incomeSection.style.display = 'none';
    
    if (tabName === 'dashboard') {
        dashboardSection.style.display = 'block';
        recentTitle.textContent = 'Dashboard Famiglia';
        loadDashboard(); // Carica i dati della dashboard
    } else if (tabName === 'expenses') {
        expenseSection.style.display = 'block';
        recentTitle.textContent = 'Spese Recenti';
        console.log('📝 Loading expenses for tab');
        loadItems(); // Ricarica la lista spese
    } else if (tabName === 'incomes') {
        incomeSection.style.display = 'block';
        recentTitle.textContent = 'Entrate Recenti';
        console.log('💰 Loading incomes for tab');
        loadItems(); // Ricarica la lista entrate
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form spesa
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    
    // Form entrata
    document.getElementById('incomeForm').addEventListener('submit', handleIncomeSubmit);
    
    // Bottone aggiungi categoria
    document.getElementById('addCategoryBtn').addEventListener('click', showCategoryModal);
    
    // Modal categoria
    document.getElementById('saveCategoryBtn').addEventListener('click', saveNewCategory);
    document.querySelector('.close').addEventListener('click', hideCategoryModal);
    
    // Report
    document.getElementById('loadReportBtn').addEventListener('click', loadMonthlyReport);
    
    // Refresh manuale
    document.getElementById('refreshBtn').addEventListener('click', manualRefresh);
}

// Setup refresh automatico
function setupAutoRefresh() {
    console.log('🔄 Configurazione refresh automatico ogni 30 secondi...');
    
    setInterval(async () => {
        try {
            console.log('🔄 Refresh automatico in corso...');
            
            if (currentTab === 'dashboard') {
                await loadDashboard();
            } else {
                await loadItems();
            }
            
            updateLastRefreshTime();
            console.log('✅ Refresh automatico completato');
        } catch (error) {
            console.error('❌ Errore durante refresh automatico:', error);
        }
    }, 30000); // 30 secondi
}

// Refresh manuale
async function manualRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    
    try {
        // Disabilita il pulsante e mostra loading
        refreshBtn.disabled = true;
        refreshBtn.style.animation = 'spin 1s linear infinite';
        
        console.log('🔄 Refresh manuale richiesto...');
        
        if (currentTab === 'dashboard') {
            await loadDashboard();
        } else {
            await loadItems();
        }
        
        updateLastRefreshTime();
        console.log('✅ Refresh manuale completato');
        
    } catch (error) {
        console.error('❌ Errore durante refresh manuale:', error);
    } finally {
        // Riabilita il pulsante
        refreshBtn.disabled = false;
        refreshBtn.style.animation = '';
    }
}

// Aggiorna timestamp ultimo aggiornamento
function updateLastRefreshTime() {
    const lastRefresh = document.getElementById('lastRefresh');
    const now = new Date();
    const timeString = now.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    lastRefresh.textContent = `Ultimo aggiornamento: ${timeString}`;
}

// Gestione submit spesa
async function handleExpenseSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    let amount;
    
    try {
        // Ottieni il valore del campo importo
        const amountInput = document.getElementById('amount').value.trim();
        
        // Se contiene operatori matematici, valuta come formula
        if (/[+\-*/]/.test(amountInput)) {
            amount = evaluateMathExpression(amountInput);
            console.log(`Formula "${amountInput}" = ${amount}`);
            // Rimuovo il messaggio di successo per la formula, è troppo invasivo
        } else {
            amount = parseFloat(amountInput);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Importo non valido');
            }
        }
    } catch (error) {
        showError('Errore nella formula: ' + error.message);
        return;
    }
    
    const expense = {
        date: document.getElementById('date').value,
        category: document.getElementById('category').value,
        amount: amount,
        currency: document.getElementById('currency').value,
        user: document.getElementById('user').value
    };

    try {
        const response = await fetch(`${API_BASE}/expenses`, {
            method: 'POST',
            headers,
            body: JSON.stringify(expense)
        });

        if (response.ok) {
            showSuccess('Spesa aggiunta con successo!');
            event.target.reset();
            setTodayDate();
            await loadItems(); // Cambiato da loadExpenses
        } else {
            throw new Error('Errore nel salvataggio');
        }
    } catch (error) {
        console.error('Errore nel salvataggio spesa:', error);
        showError('Errore nel salvataggio della spesa');
    }
}

// Gestione submit entrata
async function handleIncomeSubmit(event) {
    event.preventDefault();
    
    let amount;
    
    try {
        // Ottieni il valore del campo importo
        const amountInput = document.getElementById('incomeAmount').value.trim();
        
        // Se contiene operatori matematici, valuta come formula
        if (/[+\-*/]/.test(amountInput)) {
            amount = evaluateMathExpression(amountInput);
            console.log(`Formula "${amountInput}" = ${amount}`);
            // Rimuovo il messaggio di successo per la formula, è troppo invasivo
        } else {
            amount = parseFloat(amountInput);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Importo non valido');
            }
        }
    } catch (error) {
        showError('Errore nella formula: ' + error.message);
        return;
    }
    
    const income = {
        date: document.getElementById('incomeDate').value,
        category: document.getElementById('incomeCategory').value,
        amount: amount,
        currency: document.getElementById('incomeCurrency').value,
        user: document.getElementById('incomeUser').value
    };

    try {
        const response = await fetch(`${API_BASE}/incomes`, {
            method: 'POST',
            headers,
            body: JSON.stringify(income)
        });

        if (response.ok) {
            showSuccess('Entrata aggiunta con successo!');
            event.target.reset();
            setTodayDate();
            await loadItems();
        } else {
            throw new Error('Errore nel salvataggio');
        }
    } catch (error) {
        console.error('Errore nel salvataggio entrata:', error);
        showError('Errore nel salvataggio dell\'entrata');
    }
}

// Carica lista spese o entrate
async function loadItems() {
    try {
        const endpoint = currentTab === 'expenses' ? '/expenses' : '/incomes';
        console.log(`💰 Caricamento ${currentTab} da:`, `${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const items = await response.json();
        if (currentTab === 'expenses') {
            expenses = items;
            console.log(`✅ Spese caricate:`, items.length, 'elementi');
        } else {
            incomes = items;
            console.log(`✅ Entrate caricate:`, items.length, 'elementi');
        }
        
        displayItems();
        updateLastRefreshTime();
    } catch (error) {
        console.error(`❌ Errore nel caricamento ${currentTab}:`, error);
        console.log(`📝 Usando lista ${currentTab} vuota`);
        
        // Fallback con array vuoto
        if (currentTab === 'expenses') {
            expenses = [];
        } else {
            incomes = [];
        }
        displayItems();
        
        // Non mostriamo errore qui perché potrebbe essere già stato mostrato
        console.log('ℹ️ Lista non disponibile - modalità offline');
    }
}

// Mostra spese o entrate nella lista
function displayItems() {
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '';

    const items = currentTab === 'expenses' ? expenses : incomes;
    const itemType = currentTab === 'expenses' ? 'spesa' : 'entrata';

    if (items.length === 0) {
        itemsList.innerHTML = `<p>Nessuna ${itemType} registrata</p>`;
        return;
    }

    items.slice(0, 20).forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'expense-item';
        
        const isExpense = currentTab === 'expenses';
        const sign = isExpense ? '-' : '+';
        const amountClass = isExpense ? 'expense-amount' : 'income-amount';
        
        itemElement.innerHTML = `
            <div class="expense-info">
                <div class="expense-date">${formatDate(item.date)}</div>
                <div class="expense-details">
                    <span class="expense-category">${item.category}</span>
                    <span class="expense-user">${item.user}</span>
                </div>
            </div>
            <div class="${amountClass}">${sign}${item.amount.toFixed(2)} ${item.currency}</div>
            <div class="expense-actions">
                <button class="edit-btn" onclick="editItem(${item.id})">Modifica</button>
                <button class="delete-btn" onclick="deleteItem(${item.id})">Elimina</button>
            </div>
        `;
        itemsList.appendChild(itemElement);
    });
}

// Elimina spesa
async function deleteExpense(id) {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return;

    try {
        const response = await fetch(`${API_BASE}/expenses/${id}`, {
            method: 'DELETE',
            headers
        });

        if (response.ok) {
            showSuccess('Spesa eliminata con successo!');
            await loadItems();
        } else {
            throw new Error('Errore nell\'eliminazione');
        }
    } catch (error) {
        console.error('Errore nell\'eliminazione spesa:', error);
        showError('Errore nell\'eliminazione della spesa');
    }
}

// Carica report mensile
async function loadMonthlyReport() {
    const year = document.getElementById('reportYear').value;
    const month = document.getElementById('reportMonth').value;

    if (!year || !month) {
        showError('Seleziona anno e mese per il report');
        return;
    }

    try {
        console.log(`📊 Caricamento report per ${month}/${year}...`);
        const url = `${API_BASE}/reports/monthly?year=${year}&month=${month}`;
        console.log('🔗 URL report:', url);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const report = await response.json();
        console.log('📈 Dati report ricevuti:', report);
        
        if (!report.by_category || !report.by_user) {
            throw new Error('Formato dati report non valido');
        }
        
        if (report.by_category.length === 0 && report.by_user.length === 0) {
            showError(`Nessuna spesa trovata per ${month}/${year}`);
            return;
        }
        
        displayCharts(report);
        console.log(`Report per ${month}/${year} caricato con successo!`);
        
    } catch (error) {
        console.error('❌ Errore nel caricamento report:', error);
        showError(`Errore nel caricamento del report: ${error.message}`);
    }
}

// Mostra grafici
function displayCharts(report) {
    // Grafico categorie
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const categoryData = aggregateByCategory(report.by_category);
    categoryChart = new Chart(categoryCtx, {
        type: 'pie',
        data: {
            labels: categoryData.labels,
            datasets: [{
                data: categoryData.values,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Grafico utenti
    const userCtx = document.getElementById('userChart').getContext('2d');
    
    if (userChart) {
        userChart.destroy();
    }
    
    const userData = aggregateByUser(report.by_user);
    userChart = new Chart(userCtx, {
        type: 'bar',
        data: {
            labels: userData.labels,
            datasets: [{
                label: 'Spese (EUR)',
                data: userData.values,
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Aggrega dati per categoria
function aggregateByCategory(data) {
    const aggregated = {};
    
    data.forEach(item => {
        const key = `${item.category} (${item.currency})`;
        aggregated[key] = (aggregated[key] || 0) + item.total;
    });
    
    return {
        labels: Object.keys(aggregated),
        values: Object.values(aggregated)
    };
}

// Aggrega dati per utente
function aggregateByUser(data) {
    const aggregated = {};
    
    data.forEach(item => {
        const key = `${item.user} (${item.currency})`;
        aggregated[key] = (aggregated[key] || 0) + item.total;
    });
    
    return {
        labels: Object.keys(aggregated),
        values: Object.values(aggregated)
    };
}

// Modal categoria
function showCategoryModal() {
    document.getElementById('categoryModal').style.display = 'block';
}

function hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    document.getElementById('newCategoryName').value = '';
}

// Salva nuova categoria
async function saveNewCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    
    if (!name) {
        showError('Inserisci il nome della categoria');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            showSuccess('Categoria aggiunta con successo!');
            hideCategoryModal();
            await loadInitialData(); // Ricarica categorie
        } else {
            throw new Error('Errore nel salvataggio categoria');
        }
    } catch (error) {
        console.error('Errore nel salvataggio categoria:', error);
        showError('Errore nel salvataggio della categoria');
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
}

function showSuccess(message) {
    console.log('✅ Success:', message);
    showToast(message, 'success');
}

function showError(message) {
    console.error('❌ Error:', message);
    showToast(message, 'error');
}

// Sistema di toast non invasivo
function showToast(message, type = 'info') {
    // Rimuovi toast esistenti dello stesso tipo
    const existingToasts = document.querySelectorAll(`.toast.${type}`);
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Stili del toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        max-width: 350px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animazione di entrata
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Rimozione automatica
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, type === 'error' ? 5000 : 3000); // Errori visibili più a lungo
}

// Placeholder per edit expense
function editExpense(id) {
    // TODO: Implementare modifica spesa
    showError('Funzione modifica in sviluppo');
}

// Funzioni di utilità per il caricamento
function showLoadingMessage() {
    const loading = document.createElement('div');
    loading.id = 'loadingMessage';
    loading.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #007bff;
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 1000;
        font-size: 18px;
    `;
    loading.textContent = '🔄 Caricamento applicazione...';
    document.body.appendChild(loading);
}

function hideLoadingMessage() {
    const loading = document.getElementById('loadingMessage');
    if (loading) {
        loading.remove();
    }
}

// === FUNZIONI DASHBOARD ===

// Carica i dati della dashboard
async function loadDashboard() {
    try {
        console.log('🏠 Caricamento dashboard...');
        
        // Carica tutte le spese e entrate
        await Promise.all([
            loadAllExpenses(),
            loadAllIncomes()
        ]);
        
        // Calcola e mostra KPI
        calculateKPIs();
        
        // Carica grafici
        loadDashboardCharts();
        
        console.log('✅ Dashboard caricata');
    } catch (error) {
        console.error('❌ Errore nel caricamento dashboard:', error);
        showError('Errore nel caricamento della dashboard');
    }
}

// Carica tutte le spese per la dashboard
async function loadAllExpenses() {
    try {
        const response = await fetch(`${API_BASE}/expenses`, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        expenses = await response.json();
        console.log('💸 Spese caricate per dashboard:', expenses.length);
    } catch (error) {
        console.error('❌ Errore caricamento spese:', error);
        expenses = [];
    }
}

// Carica tutte le entrate per la dashboard
async function loadAllIncomes() {
    try {
        const response = await fetch(`${API_BASE}/incomes`, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        incomes = await response.json();
        console.log('💰 Entrate caricate per dashboard:', incomes.length);
    } catch (error) {
        console.error('❌ Errore caricamento entrate:', error);
        incomes = [];
    }
}

// Calcola e mostra i KPI
function calculateKPIs() {
    const currentPeriod = getPeriodFromSelector();
    
    // Filtra per periodo selezionato
    const filteredExpenses = filterByPeriod(expenses, currentPeriod);
    const filteredIncomes = filterByPeriod(incomes, currentPeriod);
    
    // Calcola totali
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalIncomes = filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const balance = totalIncomes - totalExpenses;
    const savingsRate = totalIncomes > 0 ? ((balance / totalIncomes) * 100) : 0;
    
    // Aggiorna display
    document.getElementById('totalExpenses').textContent = `€ ${totalExpenses.toFixed(2)}`;
    document.getElementById('totalIncomes').textContent = `€ ${totalIncomes.toFixed(2)}`;
    document.getElementById('totalBalance').textContent = `€ ${balance.toFixed(2)}`;
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;
    
    // Colora il bilancio
    const balanceElement = document.getElementById('totalBalance');
    balanceElement.style.color = balance >= 0 ? '#28a745' : '#dc3545';
    
    console.log('📊 KPI calcolati:', { totalExpenses, totalIncomes, balance, savingsRate });
}

// Ottiene il periodo dal selettore
function getPeriodFromSelector() {
    const periodType = document.getElementById('dashboardPeriod').value;
    const currentDate = new Date();
    
    if (periodType === 'year') {
        return {
            type: 'year',
            year: currentDate.getFullYear()
        };
    } else {
        return {
            type: 'month',
            year: currentDate.getFullYear(),
            month: currentDate.getMonth() + 1
        };
    }
}

// Filtra transazioni per periodo
function filterByPeriod(transactions, period) {
    return transactions.filter(transaction => {
        const date = new Date(transaction.date);
        
        if (period.type === 'year') {
            return date.getFullYear() === period.year;
        } else {
            return date.getFullYear() === period.year && 
                   (date.getMonth() + 1) === period.month;
        }
    });
}

// Carica i grafici della dashboard
function loadDashboardCharts() {
    // Distruggi grafici esistenti per evitare conflitti
    if (balanceChart) balanceChart.destroy();
    if (userBalanceChart) userBalanceChart.destroy();
    if (trendChart) trendChart.destroy();
    if (topCategoriesChart) topCategoriesChart.destroy();
    
    loadBalanceChart();
    loadUserBalanceChart();
    loadTrendChart();
    loadTopCategoriesChart();
}

// Grafico Entrate vs Spese
function loadBalanceChart() {
    try {
        const canvasElement = document.getElementById('balanceChart');
        if (!canvasElement) {
            console.error('Canvas balanceChart non trovato');
            return;
        }
        
        const ctx = canvasElement.getContext('2d');
        
        const currentPeriod = getPeriodFromSelector();
        const filteredExpenses = filterByPeriod(expenses, currentPeriod);
        const filteredIncomes = filterByPeriod(incomes, currentPeriod);
        
        const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalIncomes = filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0);
        
        balanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Entrate', 'Spese'],
            datasets: [{
                data: [totalIncomes, totalExpenses],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    } catch (error) {
        console.error('Errore nel caricamento grafico bilancio:', error);
    }
}

// Grafico bilancio per utente
function loadUserBalanceChart() {
    const ctx = document.getElementById('userBalanceChart').getContext('2d');
    
    const currentPeriod = getPeriodFromSelector();
    const filteredExpenses = filterByPeriod(expenses, currentPeriod);
    const filteredIncomes = filterByPeriod(incomes, currentPeriod);
    
    // Raggruppa per utente
    const userBalances = {};
    
    filteredIncomes.forEach(income => {
        if (!userBalances[income.user]) userBalances[income.user] = 0;
        userBalances[income.user] += income.amount;
    });
    
    filteredExpenses.forEach(expense => {
        if (!userBalances[expense.user]) userBalances[expense.user] = 0;
        userBalances[expense.user] -= expense.amount;
    });
    
    const labels = Object.keys(userBalances);
    const data = Object.values(userBalances);
    
    userBalanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bilancio €',
                data: data,
                backgroundColor: data.map(value => value >= 0 ? '#28a745' : '#dc3545'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Grafico trend mensile
function loadTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // Ultimi 6 mesi
    const months = [];
    const incomeData = [];
    const expenseData = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        
        const monthStr = date.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
        months.push(monthStr);
        
        const monthExpenses = expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() === date.getMonth() && 
                   expDate.getFullYear() === date.getFullYear();
        }).reduce((sum, exp) => sum + exp.amount, 0);
        
        const monthIncomes = incomes.filter(inc => {
            const incDate = new Date(inc.date);
            return incDate.getMonth() === date.getMonth() && 
                   incDate.getFullYear() === date.getFullYear();
        }).reduce((sum, inc) => sum + inc.amount, 0);
        
        expenseData.push(monthExpenses);
        incomeData.push(monthIncomes);
    }
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Entrate',
                data: incomeData,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4
            }, {
                label: 'Spese',
                data: expenseData,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false,
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Grafico top categorie spese
function loadTopCategoriesChart() {
    const ctx = document.getElementById('topCategoriesChart').getContext('2d');
    
    const currentPeriod = getPeriodFromSelector();
    const filteredExpenses = filterByPeriod(expenses, currentPeriod);
    
    // Raggruppa per categoria
    const categoryTotals = {};
    filteredExpenses.forEach(expense => {
        if (!categoryTotals[expense.category]) categoryTotals[expense.category] = 0;
        categoryTotals[expense.category] += expense.amount;
    });
    
    // Ordina e prendi le top 5
    const sortedCategories = Object.entries(categoryTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    const labels = sortedCategories.map(([cat, ]) => cat);
    const data = sortedCategories.map(([, amount]) => amount);
    
    topCategoriesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spese €',
                data: data,
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Rende il grafico orizzontale
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Event listener per il cambio periodo dashboard
function setupDashboardEventListeners() {
    const periodSelector = document.getElementById('dashboardPeriod');
    if (periodSelector) {
        periodSelector.addEventListener('change', () => {
            calculateKPIs();
            loadDashboardCharts();
        });
    }
}

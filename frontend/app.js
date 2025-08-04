// Configurazione API
const API_BASE = 'http://localhost:8082';
const API_TOKEN = 'family_secret_token';

// Headers per le richieste API
const headers = {
    'Content-Type': 'application/json',
    'X-Token': API_TOKEN
};

// Variabili globali
let categories = [];
let users = [];
let expenses = [];
let categoryChart = null;
let userChart = null;

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Applicazione inizializzata');
    console.log('🔗 API Base URL:', API_BASE);
    
    // Mostra un messaggio di caricamento
    showLoadingMessage();
    
    await loadInitialData();
    setupEventListeners();
    setTodayDate();
    await loadExpenses();
    
    // Nasconde il messaggio di caricamento
    hideLoadingMessage();
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
        showSuccess('Connesso al server! Pronto per l\'uso.');
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
}

// Setup event listeners
function setupEventListeners() {
    // Form spesa
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    
    // Bottone aggiungi categoria
    document.getElementById('addCategoryBtn').addEventListener('click', showCategoryModal);
    
    // Modal categoria
    document.getElementById('saveCategoryBtn').addEventListener('click', saveNewCategory);
    document.querySelector('.close').addEventListener('click', hideCategoryModal);
    
    // Report
    document.getElementById('loadReportBtn').addEventListener('click', loadMonthlyReport);
}

// Gestione submit spesa
async function handleExpenseSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const expense = {
        date: document.getElementById('date').value,
        category: document.getElementById('category').value,
        amount: parseFloat(document.getElementById('amount').value),
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
            await loadExpenses();
        } else {
            throw new Error('Errore nel salvataggio');
        }
    } catch (error) {
        console.error('Errore nel salvataggio spesa:', error);
        showError('Errore nel salvataggio della spesa');
    }
}

// Carica lista spese
async function loadExpenses() {
    try {
        console.log('💰 Caricamento spese da:', `${API_BASE}/expenses`);
        const response = await fetch(`${API_BASE}/expenses`, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        expenses = await response.json();
        console.log('✅ Spese caricate:', expenses.length, 'elementi');
        displayExpenses();
    } catch (error) {
        console.error('❌ Errore nel caricamento spese:', error);
        console.log('📝 Usando lista spese vuota');
        
        // Fallback con array vuoto
        expenses = [];
        displayExpenses();
        
        // Non mostriamo errore qui perché potrebbe essere già stato mostrato
        console.log('ℹ️ Lista spese non disponibile - modalità offline');
    }
}

// Mostra spese nella lista
function displayExpenses() {
    const expensesList = document.getElementById('expensesList');
    expensesList.innerHTML = '';

    if (expenses.length === 0) {
        expensesList.innerHTML = '<p>Nessuna spesa registrata</p>';
        return;
    }

    expenses.slice(0, 20).forEach(expense => {
        const expenseItem = document.createElement('div');
        expenseItem.className = 'expense-item';
        expenseItem.innerHTML = `
            <div class="expense-info">
                <div class="expense-date">${formatDate(expense.date)}</div>
                <div class="expense-details">
                    <span class="expense-category">${expense.category}</span>
                    <span class="expense-user">${expense.user}</span>
                </div>
            </div>
            <div class="expense-amount">${expense.amount.toFixed(2)} ${expense.currency}</div>
            <div class="expense-actions">
                <button class="edit-btn" onclick="editExpense(${expense.id})">Modifica</button>
                <button class="delete-btn" onclick="deleteExpense(${expense.id})">Elimina</button>
            </div>
        `;
        expensesList.appendChild(expenseItem);
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
            await loadExpenses();
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
        showSuccess(`Report per ${month}/${year} caricato con successo!`);
        
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
    // Implementazione semplice - puoi migliorare con una libreria di notifiche
    alert('✅ ' + message);
}

function showError(message) {
    // Implementazione semplice - puoi migliorare con una libreria di notifiche
    alert('❌ ' + message);
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

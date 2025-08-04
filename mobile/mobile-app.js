// Configurazione API - Auto-detect per localhost, rete locale o accesso esterno
let API_BASE;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Se siamo in localhost, usa porta 8082
    API_BASE = 'http://localhost:8082';
    console.log('Localhost mode:', API_BASE);
} else if (window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.')) {
    // Se siamo su rete locale, usa IP con porta 8082
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('LAN mode:', API_BASE);
} else {
    // Accesso esterno tramite port forwarding - forza HTTP per compatibilità mobile
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('External access mode (forced HTTP):', API_BASE);
}

const API_TOKEN = 'family_secret_token';

console.log('API Base URL:', API_BASE);
console.log('Current hostname:', window.location.hostname);
console.log('Current protocol:', window.location.protocol);
console.log('User Agent contains Mobile:', navigator.userAgent.includes('Mobile'));

// Headers per le richieste API
const headers = {
    'Content-Type': 'application/json',
    'X-Token': API_TOKEN
};

// Variabili globali per offline storage
let isOnline = navigator.onLine;
let categories = [];
let users = [];
let offlineExpenses = [];
let offlineIncomes = [];
let currentTab = 'expenses'; // 'expenses' o 'incomes'

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

// Service Worker registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(registration => console.log('SW registered:', registration))
        .catch(error => console.log('SW registration failed:', error));
}

// Inizializzazione app
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setTodayDate();
    
    // Load offline data from localStorage PRIMA di tutto
    loadOfflineExpenses();
    loadOfflineIncomes();
    
    await loadInitialData();
    await loadRecentItems();
    
    // Aggiorna lo status dopo aver caricato tutto
    updateSyncStatus();
    
    // Inizializza funzionalità di sync
    initializeSync();
    
    console.log(`App inizializzata - ${offlineExpenses.length} spese e ${offlineIncomes.length} entrate offline in coda`);
});

// Setup event listeners
function setupEventListeners() {
    // Form submit
    document.getElementById('mobileExpenseForm').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('mobileIncomeForm').addEventListener('submit', handleIncomeSubmit);
    
    // Online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// Carica dati iniziali
async function loadInitialData() {
    try {
        if (isOnline) {
            // Carica categorie
            const categoriesResponse = await fetch(`${API_BASE}/categories`, { headers });
            categories = await categoriesResponse.json();
            localStorage.setItem('categories', JSON.stringify(categories));
        } else {
            // Carica da localStorage se offline
            const stored = localStorage.getItem('categories');
            categories = stored ? JSON.parse(stored) : [];
        }
        populateCategorySelect();

        if (isOnline) {
            // Carica utenti
            const usersResponse = await fetch(`${API_BASE}/users`, { headers });
            users = await usersResponse.json();
            localStorage.setItem('users', JSON.stringify(users));
        } else {
            // Carica da localStorage se offline
            const stored = localStorage.getItem('users');
            users = stored ? JSON.parse(stored) : ['Dad', 'Mom', 'Kid1', 'Kid2'];
        }
        populateUserSelect();
        
    } catch (error) {
        console.error('Errore nel caricamento dati iniziali:', error);
        console.log('API_BASE utilizzato:', API_BASE);
        console.log('Headers utilizzati:', headers);
        
        // Fallback to localStorage
        const storedCategories = localStorage.getItem('categories');
        const storedUsers = localStorage.getItem('users');
        
        categories = storedCategories ? JSON.parse(storedCategories) : [];
        users = storedUsers ? JSON.parse(storedUsers) : ['Dad', 'Mom', 'Kid1', 'Kid2'];
        
        populateCategorySelect();
        populateUserSelect();
        
        showToast('Modalità offline attiva - Controllare console per dettagli', 'error');
    }
}

// Popola select categorie
function populateCategorySelect() {
    const select = document.getElementById('mobileCategory');
    select.innerHTML = '<option value="">Seleziona categoria...</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name || category;
        option.textContent = category.name || category;
        select.appendChild(option);
    });
}

// Popola select utenti
function populateUserSelect() {
    const expenseSelect = document.getElementById('mobileUser');
    const incomeSelect = document.getElementById('incomeUser');
    
    expenseSelect.innerHTML = '<option value="">Chi ha speso?</option>';
    incomeSelect.innerHTML = '<option value="">Chi ha guadagnato?</option>';
    
    users.forEach(user => {
        const expenseOption = document.createElement('option');
        expenseOption.value = user;
        expenseOption.textContent = user;
        expenseSelect.appendChild(expenseOption);
        
        const incomeOption = document.createElement('option');
        incomeOption.value = user;
        incomeOption.textContent = user;
        incomeSelect.appendChild(incomeOption);
    });
}

// Imposta data di oggi
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('mobileDate').value = today;
    document.getElementById('incomeDate').value = today;
}

// Gestione submit spesa
async function handleExpenseSubmit(event) {
    event.preventDefault();
    
    let amount;
    
    try {
        // Ottieni il valore del campo importo
        const amountInput = document.getElementById('mobileAmount').value.trim();
        
        // Se contiene operatori matematici, valuta come formula
        if (/[+\-*/]/.test(amountInput)) {
            amount = evaluateMathExpression(amountInput);
            console.log(`Formula "${amountInput}" = ${amount}`);
        } else {
            amount = parseFloat(amountInput);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Importo non valido');
            }
        }
    } catch (error) {
        showToast('Errore nella formula: ' + error.message, 'error');
        return;
    }
    
    const expense = {
        date: document.getElementById('mobileDate').value,
        category: document.getElementById('mobileCategory').value,
        amount: amount,
        currency: document.getElementById('mobileCurrency').value,
        user: document.getElementById('mobileUser').value,
        timestamp: new Date().toISOString(),
        id: Date.now() // ID temporaneo unico
    };

    // Validazione
    if (!expense.date || !expense.category || !expense.amount || !expense.currency || !expense.user) {
        showToast('Compila tutti i campi', 'error');
        return;
    }

    try {
        if (isOnline) {
            // Tenta di salvare online
            const response = await fetch(`${API_BASE}/expenses`, {
                method: 'POST',
                headers,
                body: JSON.stringify(expense)
            });

            if (response.ok) {
                showToast('Spesa aggiunta online!', 'success');
                resetForm();
                await loadRecentExpenses();
                
                // Sincronizza eventuali spese offline in coda
                await syncOfflineExpenses();
                return;
            }
        }
        
        // Se offline o errore online, salva in locale
        throw new Error('Salvataggio offline');
        
    } catch (error) {
        console.log('Salvataggio offline:', error.message);
        
        // Salva sempre offline come backup
        expense.offline = true;
        offlineExpenses.push(expense);
        saveOfflineExpenses();
        
        const message = isOnline ? 'Salvato offline (errore server)' : 'Salvato offline';
        showToast(message, 'warning');
        resetForm();
        displayOfflineExpenses();
        
        // Aggiorna immediatamente l'interfaccia
        updateSyncStatus();
        
        // Se torni online, sincronizza automaticamente
        scheduleSync();
    }
}

// Reset form
function resetForm() {
    document.getElementById('mobileExpenseForm').reset();
    document.getElementById('mobileIncomeForm').reset();
    setTodayDate();
}

// Gestione tab navigation
function switchTab(tabName) {
    currentTab = tabName;
    
    // Aggiorna pulsanti tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Mostra/nascondi sezioni
    const expenseSection = document.getElementById('expenseSection');
    const incomeSection = document.getElementById('incomeSection');
    const recentTitle = document.getElementById('recentTitle');
    
    if (tabName === 'expenses') {
        expenseSection.style.display = 'block';
        incomeSection.style.display = 'none';
        recentTitle.textContent = '📋 Spese Recenti';
    } else {
        expenseSection.style.display = 'none';
        incomeSection.style.display = 'block';
        recentTitle.textContent = '📋 Entrate Recenti';
    }
    
    // Ricarica la lista appropriata
    loadRecentItems();
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
        } else {
            amount = parseFloat(amountInput);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Importo non valido');
            }
        }
    } catch (error) {
        showToast('Errore nella formula: ' + error.message, 'error');
        return;
    }
    
    const income = {
        date: document.getElementById('incomeDate').value,
        category: document.getElementById('incomeCategory').value,
        amount: amount,
        currency: document.getElementById('incomeCurrency').value,
        user: document.getElementById('incomeUser').value,
        timestamp: new Date().toISOString(),
        id: Date.now() // ID temporaneo unico
    };

    // Validazione
    if (!income.date || !income.category || !income.amount || !income.currency || !income.user) {
        showToast('Compila tutti i campi', 'error');
        return;
    }

    try {
        if (isOnline) {
            // Tenta di salvare online
            const response = await fetch(`${API_BASE}/incomes`, {
                method: 'POST',
                headers,
                body: JSON.stringify(income)
            });

            if (response.ok) {
                showToast('Entrata aggiunta online!', 'success');
                resetForm();
                await loadRecentItems();
                
                // Sincronizza eventuali entrate offline in coda
                await syncOfflineIncomes();
                return;
            }
        }
        
        // Se offline o errore online, salva in locale
        throw new Error('Salvataggio offline');
        
    } catch (error) {
        console.log('Salvataggio offline entrata:', error.message);
        
        // Salva sempre offline come backup
        income.offline = true;
        offlineIncomes.push(income);
        saveOfflineIncomes();
        
        const message = isOnline ? 'Salvato offline (errore server)' : 'Salvato offline';
        showToast(message, 'warning');
        resetForm();
        displayOfflineItems();
        
        // Aggiorna immediatamente l'interfaccia
        updateSyncStatus();
        
        // Se torni online, sincronizza automaticamente
        scheduleSync();
    }
}

// Carica transazioni recenti (spese o entrate)
async function loadRecentItems() {
    if (!isOnline) {
        displayOfflineItems();
        return;
    }

    try {
        const endpoint = currentTab === 'expenses' ? '/expenses' : '/incomes';
        const response = await fetch(`${API_BASE}${endpoint}`, { headers });
        const items = await response.json();
        displayItems(items.slice(0, 10)); // Solo le prime 10
    } catch (error) {
        console.error(`Errore nel caricamento ${currentTab}:`, error);
        displayOfflineItems();
    }
}

// Mostra transazioni (spese o entrate)
function displayItems(items) {
    console.log(`displayItems chiamata con ${items.length} ${currentTab}`);
    
    const container = document.getElementById('mobileItemsList');
    if (!container) {
        console.error('Container mobileItemsList non trovato!');
        return;
    }
    
    if (items.length === 0) {
        const label = currentTab === 'expenses' ? 'spese' : 'entrate';
        container.innerHTML = `<p style="text-align: center; color: #7f8c8d;">Nessuna ${label} registrata</p>`;
        return;
    }
    
    const html = items.map(item => {
        const isExpense = currentTab === 'expenses';
        const sign = isExpense ? '-' : '+';
        const colorClass = isExpense ? 'expense-amount' : 'income-amount';
        const actionLabel = isExpense ? 'Speso da' : 'Guadagnato da';
        
        return `
            <div class="expense-item ${item.offline ? 'offline-item' : ''}">
                <div class="expense-left">
                    <div class="expense-category">${item.category}</div>
                    <div class="expense-user">${actionLabel}: ${item.user}</div>
                    <div class="expense-date">Data: ${formatDate(item.date)}</div>
                    ${item.offline ? '<div style="color: #e74c3c; font-size: 0.8em;">Da sincronizzare</div>' : ''}
                </div>
                <div class="${colorClass}">${sign}${item.amount.toFixed(2)} ${item.currency}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Mostra transazioni offline
function displayOfflineItems() {
    const items = currentTab === 'expenses' ? offlineExpenses : offlineIncomes;
    console.log(`displayOfflineItems chiamata con ${items.length} ${currentTab}`);
    displayItems(items.slice(0, 10));
}

// Gestione online/offline
function handleOnline() {
    console.log('📡 Connessione ripristinata');
    isOnline = true;
    
    // Aggiorna immediatamente l'interfaccia
    updateSyncStatus();
    
    const totalPending = offlineExpenses.length + offlineIncomes.length;
    if (totalPending > 0) {
        showToast(`📡 Connesso! Sincronizzazione ${totalPending} items...`, 'success');
    } else {
        showToast('📡 Connesso!', 'success');
    }
    
    // Aspetta un momento per stabilizzare la connessione
    setTimeout(async () => {
        await loadInitialData();
        
        if (offlineExpenses.length > 0) {
            await syncOfflineExpenses();
        }
        
        if (offlineIncomes.length > 0) {
            await syncOfflineIncomes();
        }
        
        scheduleSync(); // Avvia sync automatico
    }, 1000);
}

function handleOffline() {
    console.log('📴 Connessione persa');
    isOnline = false;
    updateSyncStatus();
    
    if (window.syncInterval) {
        clearInterval(window.syncInterval);
    }
    
    showToast('📴 Offline - I dati verranno salvati localmente', 'warning');
}

// Aggiorna status sincronizzazione
function updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    const syncBtn = document.getElementById('manualSyncBtn');
    const totalPending = offlineExpenses.length + offlineIncomes.length;
    
    console.log(`🔍 updateSyncStatus: online=${isOnline}, spese=${offlineExpenses.length}, entrate=${offlineIncomes.length}`);
    
    if (!syncStatus || !syncText) {
        console.error('❌ Elementi syncStatus o syncText non trovati nel DOM');
        return;
    }
    
    if (!isOnline) {
        syncStatus.className = 'sync-status offline';
        syncText.textContent = `📴 Offline${totalPending > 0 ? ` (${totalPending} in coda)` : ''}`;
        if (syncBtn) {
            syncBtn.style.display = 'none';
            console.log('🔍 Nascosto pulsante sync (offline)');
        }
    } else if (totalPending > 0) {
        syncStatus.className = 'sync-status pending';
        syncText.textContent = `🔄 ${totalPending} da sincronizzare`;
        if (syncBtn) {
            syncBtn.style.display = 'block';
            console.log('🔍 Mostrato pulsante sync (items in coda)');
        }
    } else {
        syncStatus.className = 'sync-status online';
        syncText.textContent = '✅ Sincronizzato';
        if (syncBtn) {
            syncBtn.style.display = 'none';
            console.log('🔍 Nascosto pulsante sync (tutto sincronizzato)');
        }
    }
    
    console.log(`🔍 Status aggiornato: ${syncText.textContent}`);
}

// Sincronizza spese offline
async function syncOfflineExpenses() {
    console.log(`🚀 syncOfflineExpenses chiamata - online: ${isOnline}, spese: ${offlineExpenses.length}`);
    
    if (!isOnline || offlineExpenses.length === 0) {
        console.log(`⏹️ Sync saltato - online: ${isOnline}, spese: ${offlineExpenses.length}`);
        return;
    }
    
    console.log(`🔄 Sincronizzazione di ${offlineExpenses.length} spese offline...`);
    console.log('📋 Spese da sincronizzare:', offlineExpenses.map(e => `${e.category}: ${e.amount}`));
    
    showToast(`🔄 Sincronizzazione ${offlineExpenses.length} spese...`, 'info');
    
    const expensesToSync = [...offlineExpenses]; // Copia dell'array
    const syncedIds = []; // Array per tracciare gli ID sincronizzati
    let synced = 0;
    let failed = 0;
    
    for (const expense of expensesToSync) {
        try {
            const { id, offline, timestamp, ...expenseData } = expense;
            
            console.log(`📤 Tentativo sync spesa ID ${id}: ${expenseData.category} - ${expenseData.amount}`);
            
            const response = await fetch(`${API_BASE}/expenses`, {
                method: 'POST',
                headers,
                body: JSON.stringify(expenseData)
            });
            
            if (response.ok) {
                // Aggiungi l'ID alla lista di quelli sincronizzati
                syncedIds.push(expense.id);
                synced++;
                console.log(`✅ Spesa sincronizzata: ${expense.category} - ${expense.amount}${expense.currency}`);
            } else {
                failed++;
                const errorText = await response.text();
                console.error(`❌ Errore sync spesa: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Errore sincronizzazione:', error);
            failed++;
        }
    }
    
    console.log(`📊 Prima della rimozione - syncedIds: [${syncedIds.join(', ')}]`);
    console.log(`📊 Array offlineExpenses prima: ${offlineExpenses.length} elementi`);
    
    // Rimuovi TUTTE le spese sincronizzate DOPO il loop
    if (syncedIds.length > 0) {
        const oldLength = offlineExpenses.length;
        offlineExpenses = offlineExpenses.filter(expense => !syncedIds.includes(expense.id));
        saveOfflineExpenses();
        console.log(`🗑️ Rimosse ${syncedIds.length} spese sincronizzate dall'array offline`);
        console.log(`📊 Array offlineExpenses dopo: ${offlineExpenses.length} elementi (prima: ${oldLength})`);
    }
    
    // Aggiorna l'interfaccia IMMEDIATAMENTE
    console.log('🔄 Aggiornamento interfaccia...');
    updateSyncStatus();
    
        if (synced > 0) {
            showToast(`✅ ${synced} spese sincronizzate!`, 'success');
            
            console.log('🔄 Caricamento spese recenti...');
            await loadRecentItems();
            
            // Se ci sono ancora spese offline, mostra quelle
            if (offlineExpenses.length > 0) {
                console.log(`📋 Mostro ${offlineExpenses.length} spese offline rimanenti`);
                displayOfflineItems();
            }
            
            // Forza aggiornamento del pulsante sync
            const syncBtn = document.getElementById('manualSyncBtn');
            if (syncBtn) {
                const totalPending = offlineExpenses.length + offlineIncomes.length;
                syncBtn.style.display = totalPending > 0 ? 'block' : 'none';
                console.log(`🔘 Pulsante sync ${totalPending > 0 ? 'mostrato' : 'nascosto'}`);
            }
        }    if (failed > 0) {
        showToast(`⚠️ ${failed} spese non sincronizzate`, 'warning');
    }
    
    console.log(`📊 Sync completato: ${synced} ok, ${failed} failed, ${offlineExpenses.length} rimanenti`);
}

// Sincronizza entrate offline
async function syncOfflineIncomes() {
    console.log(`🚀 syncOfflineIncomes chiamata - online: ${isOnline}, entrate: ${offlineIncomes.length}`);
    
    if (!isOnline || offlineIncomes.length === 0) {
        console.log(`⏹️ Sync entrate saltato - online: ${isOnline}, entrate: ${offlineIncomes.length}`);
        return;
    }
    
    console.log(`🔄 Sincronizzazione di ${offlineIncomes.length} entrate offline...`);
    
    showToast(`🔄 Sincronizzazione ${offlineIncomes.length} entrate...`, 'info');
    
    const incomesToSync = [...offlineIncomes];
    const syncedIds = [];
    let synced = 0;
    let failed = 0;
    
    for (const income of incomesToSync) {
        try {
            const { id, offline, timestamp, ...incomeData } = income;
            
            console.log(`📤 Tentativo sync entrata ID ${id}: ${incomeData.category} - ${incomeData.amount}`);
            
            const response = await fetch(`${API_BASE}/incomes`, {
                method: 'POST',
                headers,
                body: JSON.stringify(incomeData)
            });
            
            if (response.ok) {
                syncedIds.push(income.id);
                synced++;
                console.log(`✅ Entrata sincronizzata: ${income.category} - ${income.amount}${income.currency}`);
            } else {
                failed++;
                const errorText = await response.text();
                console.error(`❌ Errore sync entrata: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Errore sincronizzazione entrata:', error);
            failed++;
        }
    }
    
    // Rimuovi entrate sincronizzate
    if (syncedIds.length > 0) {
        const oldLength = offlineIncomes.length;
        offlineIncomes = offlineIncomes.filter(income => !syncedIds.includes(income.id));
        saveOfflineIncomes();
        console.log(`🗑️ Rimosse ${syncedIds.length} entrate sincronizzate dall'array offline`);
    }
    
    // Aggiorna interfaccia
    updateSyncStatus();
    
    if (synced > 0) {
        showToast(`✅ ${synced} entrate sincronizzate!`, 'success');
        await loadRecentItems();
        
        if (offlineIncomes.length > 0) {
            displayOfflineItems();
        }
    }
    
    if (failed > 0) {
        showToast(`⚠️ ${failed} entrate non sincronizzate`, 'warning');
    }
    
    console.log(`📊 Sync entrate completato: ${synced} ok, ${failed} failed, ${offlineIncomes.length} rimanenti`);
}

// Programma sync automatico
function scheduleSync() {
    if (window.syncInterval) clearInterval(window.syncInterval);
    
    // Prova a sincronizzare ogni 30 secondi quando online
    window.syncInterval = setInterval(async () => {
        const totalPending = offlineExpenses.length + offlineIncomes.length;
        if (isOnline && totalPending > 0) {
            console.log('⏰ Sync automatico programmato...');
            await syncOfflineExpenses();
            await syncOfflineIncomes();
        }
    }, 30000);
}

// LocalStorage per spese offline
function saveOfflineExpenses() {
    localStorage.setItem('offlineExpenses', JSON.stringify(offlineExpenses));
}

function loadOfflineExpenses() {
    const stored = localStorage.getItem('offlineExpenses');
    offlineExpenses = stored ? JSON.parse(stored) : [];
}

// LocalStorage per entrate offline
function saveOfflineIncomes() {
    localStorage.setItem('offlineIncomes', JSON.stringify(offlineIncomes));
}

function loadOfflineIncomes() {
    const stored = localStorage.getItem('offlineIncomes');
    offlineIncomes = stored ? JSON.parse(stored) : [];
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: '2-digit' 
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Sync manuale
async function manualSync() {
    if (!isOnline) {
        showToast('❌ Connessione richiesta per la sincronizzazione', 'error');
        return;
    }
    
    const totalPending = offlineExpenses.length + offlineIncomes.length;
    if (totalPending === 0) {
        showToast('✅ Tutto già sincronizzato!', 'success');
        return;
    }
    
    // Disabilita temporaneamente il pulsante per evitare click multipli
    const syncBtn = document.getElementById('manualSyncBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = '🔄 Sincronizzando...';
    }
    
    console.log('🔄 Sync manuale avviato dall\'utente');
    
    try {
        await syncOfflineExpenses();
        await syncOfflineIncomes();
    } finally {
        // Riabilita il pulsante
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = '🔄 Sync';
        }
    }
}

// Inizializza sync automatico all'avvio
function initializeSync() {
    const totalOffline = offlineExpenses.length + offlineIncomes.length;
    console.log(`🔧 Inizializzazione sync - Online: ${isOnline}, Items offline: ${totalOffline}`);
    
    // Avvia sync automatico se online e ci sono items da sincronizzare
    if (isOnline && totalOffline > 0) {
        scheduleSync();
        console.log('⏰ Sync automatico programmato');
        
        // Avvia una sincronizzazione immediata
        setTimeout(async () => {
            await syncOfflineExpenses();
            await syncOfflineIncomes();
        }, 2000);
    }
    
    // Aggiorna l'interfaccia
    updateSyncStatus();
}

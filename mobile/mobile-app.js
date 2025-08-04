// Configurazione API - Auto-detect per localhost, rete locale o accesso esterno
let API_BASE;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Se siamo in localhost, usa porta 8082
    API_BASE = 'http://localhost:8082';
    console.log('� Localhost mode:', API_BASE);
} else if (window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.')) {
    // Se siamo su rete locale, usa IP con porta 8082
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('🏠 LAN mode:', API_BASE);
} else {
    // Accesso esterno tramite port forwarding - forza HTTP per compatibilità mobile
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('🌍 External access mode (forced HTTP):', API_BASE);
}

const API_TOKEN = 'family_secret_token';

console.log('🌐 API Base URL:', API_BASE);
console.log('🌐 Current hostname:', window.location.hostname);
console.log('🌐 Current protocol:', window.location.protocol);
console.log('🌐 User Agent contains Mobile:', navigator.userAgent.includes('Mobile'));

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
    
    // Load offline expenses from localStorage PRIMA di tutto
    loadOfflineExpenses();
    
    await loadInitialData();
    await loadRecentExpenses();
    
    // Aggiorna lo status dopo aver caricato tutto
    updateSyncStatus();
    
    // Inizializza funzionalità di sync
    initializeSync();
    
    console.log(`🚀 App inizializzata - ${offlineExpenses.length} spese offline in coda`);
});

// Setup event listeners
function setupEventListeners() {
    // Form submit
    document.getElementById('mobileExpenseForm').addEventListener('submit', handleExpenseSubmit);
    
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
        console.log('🔍 API_BASE utilizzato:', API_BASE);
        console.log('🔍 Headers utilizzati:', headers);
        
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
    const select = document.getElementById('mobileUser');
    select.innerHTML = '<option value="">Chi ha speso?</option>';
    
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });
}

// Imposta data di oggi
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('mobileDate').value = today;
}

// Gestione submit spesa
async function handleExpenseSubmit(event) {
    event.preventDefault();
    
    const expense = {
        date: document.getElementById('mobileDate').value,
        category: document.getElementById('mobileCategory').value,
        amount: parseFloat(document.getElementById('mobileAmount').value),
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
                showToast('💰 Spesa aggiunta online!', 'success');
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
        
        const message = isOnline ? '💾 Salvato offline (errore server)' : '💾 Salvato offline';
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
    setTodayDate();
}

// Carica spese recenti
async function loadRecentExpenses() {
    if (!isOnline) {
        displayOfflineExpenses();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/expenses`, { headers });
        const expenses = await response.json();
        displayExpenses(expenses.slice(0, 10)); // Solo le prime 10
    } catch (error) {
        console.error('Errore nel caricamento spese:', error);
        displayOfflineExpenses();
    }
}

// Mostra spese
function displayExpenses(expenses) {
    console.log(`📱 displayExpenses chiamata con ${expenses.length} spese`);
    
    const container = document.getElementById('mobileExpensesList');
    if (!container) {
        console.error('❌ Container mobileExpensesList non trovato!');
        return;
    }
    
    console.log('✅ Container mobileExpensesList trovato:', container);
    
    if (expenses.length === 0) {
        console.log('📋 Nessuna spesa da mostrare');
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Nessuna spesa registrata</p>';
        return;
    }
    
    console.log(`📋 Rendering ${expenses.length} spese...`);
    expenses.forEach((expense, index) => {
        console.log(`📝 Spesa ${index + 1}: ${expense.category} - ${expense.amount} (offline: ${expense.offline})`);
    });
    
    const html = expenses.map(expense => `
        <div class="expense-item ${expense.offline ? 'offline-item' : ''}">
            <div class="expense-left">
                <div class="expense-category">${expense.category}</div>
                <div class="expense-user">👤 ${expense.user}</div>
                <div class="expense-date">📅 ${formatDate(expense.date)}</div>
                ${expense.offline ? '<div style="color: #e74c3c; font-size: 0.8em;">⚠️ Da sincronizzare</div>' : ''}
            </div>
            <div class="expense-amount">${expense.amount.toFixed(2)} ${expense.currency}</div>
        </div>
    `).join('');
    
    container.innerHTML = html;
    console.log(`✅ HTML aggiornato nel container (lunghezza: ${html.length} caratteri)`);
}

// Mostra spese offline
function displayOfflineExpenses() {
    console.log(`🏠 displayOfflineExpenses chiamata con ${offlineExpenses.length} spese`);
    console.log('📋 Spese offline:', offlineExpenses.map(e => `${e.category}: ${e.amount}`));
    displayExpenses(offlineExpenses.slice(0, 10));
}

// Gestione online/offline
function handleOnline() {
    console.log('📡 Connessione ripristinata');
    isOnline = true;
    
    // Aggiorna immediatamente l'interfaccia
    updateSyncStatus();
    
    const pendingCount = offlineExpenses.length;
    if (pendingCount > 0) {
        showToast(`📡 Connesso! Sincronizzazione ${pendingCount} spese...`, 'success');
    } else {
        showToast('📡 Connesso!', 'success');
    }
    
    // Aspetta un momento per stabilizzare la connessione
    setTimeout(async () => {
        await loadInitialData();
        
        if (offlineExpenses.length > 0) {
            await syncOfflineExpenses();
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
    
    showToast('� Offline - Le spese verranno salvate localmente', 'warning');
}

// Aggiorna status sincronizzazione
function updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    const syncBtn = document.getElementById('manualSyncBtn');
    const pendingCount = offlineExpenses.length;
    
    console.log(`🔍 updateSyncStatus: online=${isOnline}, pending=${pendingCount}`);
    
    if (!syncStatus || !syncText) {
        console.error('❌ Elementi syncStatus o syncText non trovati nel DOM');
        return;
    }
    
    if (!isOnline) {
        syncStatus.className = 'sync-status offline';
        syncText.textContent = `📴 Offline${pendingCount > 0 ? ` (${pendingCount} in coda)` : ''}`;
        if (syncBtn) {
            syncBtn.style.display = 'none';
            console.log('🔍 Nascosto pulsante sync (offline)');
        }
    } else if (pendingCount > 0) {
        syncStatus.className = 'sync-status pending';
        syncText.textContent = `🔄 ${pendingCount} da sincronizzare`;
        if (syncBtn) {
            syncBtn.style.display = 'block';
            console.log('🔍 Mostrato pulsante sync (spese in coda)');
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
        await loadRecentExpenses();
        
        // Se ci sono ancora spese offline, mostra quelle
        if (offlineExpenses.length > 0) {
            console.log(`📋 Mostro ${offlineExpenses.length} spese offline rimanenti`);
            displayOfflineExpenses();
        }
        
        // Forza aggiornamento del pulsante sync
        const syncBtn = document.getElementById('manualSyncBtn');
        if (syncBtn) {
            syncBtn.style.display = offlineExpenses.length > 0 ? 'block' : 'none';
            console.log(`🔘 Pulsante sync ${offlineExpenses.length > 0 ? 'mostrato' : 'nascosto'}`);
        }
    }
    
    if (failed > 0) {
        showToast(`⚠️ ${failed} spese non sincronizzate`, 'warning');
    }
    
    console.log(`📊 Sync completato: ${synced} ok, ${failed} failed, ${offlineExpenses.length} rimanenti`);
}

// Programma sync automatico
function scheduleSync() {
    if (window.syncInterval) clearInterval(window.syncInterval);
    
    // Prova a sincronizzare ogni 30 secondi quando online
    window.syncInterval = setInterval(async () => {
        if (isOnline && offlineExpenses.length > 0) {
            console.log('⏰ Sync automatico programmato...');
            await syncOfflineExpenses();
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
    
    if (offlineExpenses.length === 0) {
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
    console.log(`🔧 Inizializzazione sync - Online: ${isOnline}, Spese offline: ${offlineExpenses.length}`);
    
    // Avvia sync automatico se online e ci sono spese da sincronizzare
    if (isOnline && offlineExpenses.length > 0) {
        scheduleSync();
        console.log('⏰ Sync automatico programmato');
        
        // Avvia una sincronizzazione immediata
        setTimeout(() => {
            syncOfflineExpenses();
        }, 2000);
    }
    
    // Aggiorna l'interfaccia
    updateSyncStatus();
}

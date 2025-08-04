// Configurazione API - Auto-detect per localhost, rete locale o accesso esterno
let API_BASE;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_BASE = 'http://localhost:8082';
    console.log('Admin - Localhost mode:', API_BASE);
} else if (window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.')) {
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('Admin - LAN mode:', API_BASE);
} else {
    API_BASE = `http://${window.location.hostname}:8082`;
    console.log('Admin - External access mode:', API_BASE);
}

const API_TOKEN = 'family_secret_token';

console.log('Admin - API Base URL:', API_BASE);

// Headers per le richieste API
const headers = {
    'Content-Type': 'application/json',
    'X-Token': API_TOKEN
};

// Variabili globali
let categories = [];
let users = [];
let expenses = [];

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin Panel inizializzato');
    
    setupEventListeners();
    await loadInitialData();
    await loadStats();
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchSection(e.target.dataset.section));
    });
    
    // Dashboard
    document.getElementById('refreshStats').addEventListener('click', loadStats);
    
    // Expenses
    document.getElementById('loadExpenses').addEventListener('click', loadExpenses);
    document.getElementById('expenseSearch').addEventListener('input', filterExpenses);
    
    // Users
    document.getElementById('addUser').addEventListener('click', addUser);
    document.getElementById('loadUsers').addEventListener('click', loadUsers);
    
    // Database
    document.getElementById('confirmReset').addEventListener('change', toggleResetButton);
    document.getElementById('resetDatabase').addEventListener('click', resetDatabase);
    
    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelEdit').addEventListener('click', closeModal);
    document.getElementById('editExpenseForm').addEventListener('submit', saveExpenseEdit);
    
    // Click outside modal
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('editExpenseModal');
        if (e.target === modal) closeModal();
    });
}

// Navigation
function switchSection(sectionName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Show section
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
    
    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadStats();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Load initial data
async function loadInitialData() {
    try {
        // Load categories
        const categoriesResponse = await fetch(`${API_BASE}/categories`, { headers });
        categories = await categoriesResponse.json();
        
        // Load users
        const usersResponse = await fetch(`${API_BASE}/users`, { headers });
        users = await usersResponse.json();
        
        console.log('Dati iniziali caricati:', { categories: categories.length, users: users.length });
    } catch (error) {
        console.error('Errore nel caricamento dati iniziali:', error);
        showToast('Errore nel caricamento dati iniziali', 'error');
    }
}

// Dashboard - Load stats
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/admin/stats`, { headers });
        const stats = await response.json();
        
        displayStats(stats);
        console.log('Statistiche caricate:', stats);
    } catch (error) {
        console.error('Errore nel caricamento statistiche:', error);
        showToast('Errore nel caricamento statistiche', 'error');
    }
}

function displayStats(stats) {
    const statsGrid = document.getElementById('statsGrid');
    
    const currencyTotalsHtml = Object.entries(stats.currency_totals)
        .map(([currency, total]) => `${currency}: ${total.toFixed(2)}`)
        .join('<br>');
    
    const userStatsHtml = stats.user_stats
        .map(user => `${user.user}: ${user.count} spese (${user.total?.toFixed(2) || 0})`)
        .join('<br>');
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.expense_count}</div>
            <div class="stat-label">Spese Totali</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.user_count}</div>
            <div class="stat-label">Utenti</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.category_count}</div>
            <div class="stat-label">Categorie</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Totali per Valuta</div>
            <div style="font-size: 1.2em; margin-top: 10px;">${currencyTotalsHtml || 'Nessuna spesa'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Spese per Utente</div>
            <div style="font-size: 1em; margin-top: 10px;">${userStatsHtml || 'Nessuna spesa'}</div>
        </div>
    `;
}

// Expenses Management
async function loadExpenses() {
    try {
        const response = await fetch(`${API_BASE}/expenses`, { headers });
        expenses = await response.json();
        
        displayExpenses(expenses);
        console.log(`Caricate ${expenses.length} spese`);
    } catch (error) {
        console.error('Errore nel caricamento spese:', error);
        showToast('Errore nel caricamento spese', 'error');
    }
}

function displayExpenses(expensesToShow) {
    const tbody = document.getElementById('expensesTableBody');
    
    if (expensesToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nessuna spesa trovata</td></tr>';
        return;
    }
    
    tbody.innerHTML = expensesToShow.map(expense => `
        <tr>
            <td>${expense.id}</td>
            <td>${formatDate(expense.date)}</td>
            <td>${expense.category}</td>
            <td>${expense.amount.toFixed(2)}</td>
            <td>${expense.currency}</td>
            <td>${expense.user}</td>
            <td>
                <button class="btn btn-warning btn-small" onclick="editExpense(${expense.id})">✏️ Modifica</button>
                <button class="btn btn-danger btn-small" onclick="deleteExpense(${expense.id})">🗑️ Elimina</button>
            </td>
        </tr>
    `).join('');
}

function filterExpenses() {
    const searchTerm = document.getElementById('expenseSearch').value.toLowerCase();
    
    const filtered = expenses.filter(expense => 
        expense.category.toLowerCase().includes(searchTerm) ||
        expense.user.toLowerCase().includes(searchTerm) ||
        expense.amount.toString().includes(searchTerm) ||
        expense.date.includes(searchTerm)
    );
    
    displayExpenses(filtered);
}

// Edit expense
function editExpense(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;
    
    // Populate form
    document.getElementById('editExpenseId').value = expense.id;
    document.getElementById('editDate').value = expense.date;
    document.getElementById('editAmount').value = expense.amount;
    document.getElementById('editCurrency').value = expense.currency;
    
    // Populate categories
    const categorySelect = document.getElementById('editCategory');
    categorySelect.innerHTML = categories.map(cat => 
        `<option value="${cat.name}" ${cat.name === expense.category ? 'selected' : ''}>${cat.name}</option>`
    ).join('');
    
    // Populate users
    const userSelect = document.getElementById('editUser');
    userSelect.innerHTML = users.map(user => 
        `<option value="${user}" ${user === expense.user ? 'selected' : ''}>${user}</option>`
    ).join('');
    
    // Show modal
    document.getElementById('editExpenseModal').style.display = 'block';
}

async function saveExpenseEdit(event) {
    event.preventDefault();
    
    const expenseId = document.getElementById('editExpenseId').value;
    const expenseData = {
        id: parseInt(expenseId),
        date: document.getElementById('editDate').value,
        category: document.getElementById('editCategory').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        currency: document.getElementById('editCurrency').value,
        user: document.getElementById('editUser').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/expenses/${expenseId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(expenseData)
        });
        
        if (response.ok) {
            showToast('Spesa aggiornata con successo', 'success');
            closeModal();
            await loadExpenses();
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.detail}`, 'error');
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento spesa:', error);
        showToast('Errore nell\'aggiornamento spesa', 'error');
    }
}

// Delete expense
async function deleteExpense(expenseId) {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/expenses/${expenseId}`, {
            method: 'DELETE',
            headers
        });
        
        if (response.ok) {
            showToast('Spesa eliminata con successo', 'success');
            await loadExpenses();
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.detail}`, 'error');
        }
    } catch (error) {
        console.error('Errore nell\'eliminazione spesa:', error);
        showToast('Errore nell\'eliminazione spesa', 'error');
    }
}

// Users Management
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, { headers });
        users = await response.json();
        
        displayUsers(users);
        console.log(`Caricati ${users.length} utenti`);
    } catch (error) {
        console.error('Errore nel caricamento utenti:', error);
        showToast('Errore nel caricamento utenti', 'error');
    }
}

function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    
    usersList.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <span class="user-name">👤 ${user}</span>
            </div>
            <div class="user-actions">
                <button class="btn btn-warning btn-small" onclick="editUser('${user}')">✏️ Rinomina</button>
                <button class="btn btn-danger btn-small" onclick="deleteUser('${user}')">🗑️ Elimina</button>
            </div>
        </div>
    `).join('');
}

async function addUser() {
    const userName = document.getElementById('newUserName').value.trim();
    
    if (!userName) {
        showToast('Inserisci un nome utente', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: userName })
        });
        
        if (response.ok) {
            showToast('Utente aggiunto con successo', 'success');
            document.getElementById('newUserName').value = '';
            await loadUsers();
            await loadInitialData(); // Refresh users list
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.detail}`, 'error');
        }
    } catch (error) {
        console.error('Errore nell\'aggiunta utente:', error);
        showToast('Errore nell\'aggiunta utente', 'error');
    }
}

function editUser(userName) {
    const newName = prompt(`Inserisci il nuovo nome per "${userName}":`, userName);
    
    if (!newName || newName === userName) return;
    
    updateUser(userName, newName);
}

async function updateUser(oldName, newName) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(oldName)}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ name: newName })
        });
        
        if (response.ok) {
            showToast('Utente rinominato con successo', 'success');
            await loadUsers();
            await loadInitialData(); // Refresh users list
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.detail}`, 'error');
        }
    } catch (error) {
        console.error('Errore nel rinominare utente:', error);
        showToast('Errore nel rinominare utente', 'error');
    }
}

async function deleteUser(userName) {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userName}"?\n\nNOTA: L'utente può essere eliminato solo se non ha spese associate.`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userName)}`, {
            method: 'DELETE',
            headers
        });
        
        if (response.ok) {
            showToast('Utente eliminato con successo', 'success');
            await loadUsers();
            await loadInitialData(); // Refresh users list
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.detail}`, 'error');
        }
    } catch (error) {
        console.error('Errore nell\'eliminazione utente:', error);
        showToast('Errore nell\'eliminazione utente', 'error');
    }
}

// Database Management
function toggleResetButton() {
    const checkbox = document.getElementById('confirmReset');
    const button = document.getElementById('resetDatabase');
    
    button.disabled = !checkbox.checked;
}

async function resetDatabase() {
    const finalConfirm = confirm(
        '⚠️ ATTENZIONE! ⚠️\n\n' +
        'Questa operazione eliminerà PERMANENTEMENTE:\n' +
        '• Tutte le spese registrate\n' +
        '• Tutti gli utenti personalizzati\n' +
        '• Tutte le categorie personalizzate\n\n' +
        'Verranno ripristinati solo i dati predefiniti.\n\n' +
        'Questa operazione è IRREVERSIBILE!\n\n' +
        'Sei ASSOLUTAMENTE sicuro di voler continuare?'
    );
    
    if (!finalConfirm) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/reset`, {
            method: 'POST',
            headers
        });
        
        if (response.ok) {
            showToast('Database resettato con successo', 'success');
            
            // Reset UI
            document.getElementById('confirmReset').checked = false;
            toggleResetButton();
            
            // Reload all data
            await loadInitialData();
            await loadStats();
            
        } else {
            const error = await response.json();
            showToast(`Errore: ${error.message}`, 'error');
        }
    } catch (error) {
        console.error('Errore nel reset database:', error);
        showToast('Errore nel reset database', 'error');
    }
}

// Modal functions
function closeModal() {
    document.getElementById('editExpenseModal').style.display = 'none';
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 4000);
}

// Global functions for onclick handlers
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.editUser = editUser;
window.deleteUser = deleteUser;

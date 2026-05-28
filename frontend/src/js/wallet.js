const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

// Authentication verification
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/pages/login.html';
}

// Decode JWT token helper
function decodeToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error decoding token:', e);
        return null;
    }
}

const user = decodeToken(token);
if (!user) {
    localStorage.removeItem('token');
    window.location.href = '/pages/login.html';
}

let walletBalance = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial UI updates
    updateHeaderProfile();
    
    // 2. Fetch Wallet Data
    loadWalletBalance();
    loadTransactions();
    updateHealthScoreBadge();

    // 3. Setup search & filters
    const txSearchInput = document.getElementById('tx-search');
    const txCategoryFilter = document.getElementById('tx-category-filter');
    const headerSearchInput = document.getElementById('header-search');

    if (txSearchInput) {
        txSearchInput.addEventListener('input', () => {
            const val = txSearchInput.value;
            if (headerSearchInput) headerSearchInput.value = val;
            loadTransactions(val, txCategoryFilter ? txCategoryFilter.value : '');
        });
    }

    if (headerSearchInput) {
        headerSearchInput.addEventListener('input', () => {
            const val = headerSearchInput.value;
            if (txSearchInput) txSearchInput.value = val;
            loadTransactions(val, txCategoryFilter ? txCategoryFilter.value : '');
        });
    }

    if (txCategoryFilter) {
        txCategoryFilter.addEventListener('change', () => {
            loadTransactions(txSearchInput ? txSearchInput.value : '', txCategoryFilter.value);
        });
    }

    // 4. Setup logout trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }
});

// Update profile headers
function updateHeaderProfile() {
    const firstName = user.email ? user.email.split('@')[0] : 'User';
    const capitalize = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    
    const topUserNameEl = document.getElementById('top-user-name');
    if (topUserNameEl) topUserNameEl.textContent = capitalize;

    const initialsEl = document.getElementById('user-avatar-initials');
    if (initialsEl) initialsEl.textContent = capitalize.substring(0, 2).toUpperCase();

    const upiIdEl = document.getElementById('user-upi-id');
    if (upiIdEl) upiIdEl.textContent = `${firstName.toLowerCase()}@efaws`;
}

// Update health score in app bar header
async function updateHealthScoreBadge() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/score`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('header-health-score');
            if (badge) {
                badge.textContent = `Health Score: ${data.score}`;
            }
        }
    } catch (e) {
        console.warn('Failed to update health score header badge');
    }
}

// Fetch and load wallet balances
async function loadWalletBalance() {
    const balanceDisplay = document.getElementById('wallet-balance-display');
    const withdrawMaxLimit = document.getElementById('withdraw-max-limit');
    if (!balanceDisplay) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/wallet`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load wallet');
        const wallet = await res.json();

        walletBalance = wallet.balance || 0;
        balanceDisplay.textContent = `₹${walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        if (withdrawMaxLimit) {
            withdrawMaxLimit.textContent = `Available balance: ₹${walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
        
        // Update reward tier badge
        const levelBadge = document.getElementById('user-level-badge');
        if (levelBadge) {
            try {
                const rewRes = await fetch(`${API_BASE}/api/v1/rewards`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (rewRes.ok) {
                    const rewData = await rewRes.json();
                    levelBadge.textContent = `Level ${rewData.level} (${rewData.level >= 3 ? 'Gold' : 'Silver'} Rank)`;
                }
            } catch (e) {
                levelBadge.textContent = 'Level 1';
            }
        }

    } catch (err) {
        console.error('Wallet balance fetch error:', err);
        balanceDisplay.textContent = '₹0.00';
    }
}

// Fetch and load transaction logs
async function loadTransactions(search = '', category = '') {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;

    try {
        let url = `${API_BASE}/api/v1/wallet/transactions`;
        const params = [];
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load transactions');
        const txs = await res.json();

        if (txs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-outline text-sm font-medium">No recent transactions in this wallet.</td>
                </tr>
            `;
            return;
        }

        // Icons matching specific categories/types
        const iconConfig = {
            'DEPOSIT': { icon: 'add_circle', color: 'text-success bg-success/10' },
            'WITHDRAW': { icon: 'call_received', color: 'text-secondary bg-secondary/10' },
            'INVESTMENT': { icon: 'trending_up', color: 'text-primary bg-primary/10' },
            'PREMIUM': { icon: 'verified_user', color: 'text-tertiary bg-tertiary/10' },
            'REPAYMENT': { icon: 'payments', color: 'text-warning bg-warning/10' }
        };

        tbody.innerHTML = txs.map(tx => {
            const date = new Date(tx.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            const config = iconConfig[tx.type] || { icon: 'shopping_bag', color: 'text-outline bg-surface-container' };
            const isNegative = ['WITHDRAW', 'INVESTMENT', 'PREMIUM', 'REPAYMENT'].includes(tx.type);
            const amountPrefix = isNegative ? '-' : '+';
            const amountColor = isNegative ? 'text-error font-bold' : 'text-success font-bold';

            return `
                <tr class="hover:bg-surface-container-lowest/50 dark:hover:bg-dark-elevated transition-colors">
                    <td class="py-4">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-full ${config.color} flex items-center justify-center">
                                <span class="material-symbols-outlined">${config.icon}</span>
                            </div>
                            <div>
                                <p class="font-bold text-sm text-on-surface dark:text-white">${tx.description || tx.type}</p>
                                <p class="text-xs text-outline">Ref: #${tx.id.substring(0, 8)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 text-sm font-medium text-on-surface-variant dark:text-outline-variant">${date}</td>
                    <td class="py-4">
                        <span class="text-xs font-semibold bg-surface-container dark:bg-dark-elevated text-outline px-2.5 py-1 rounded-full">${tx.category || 'General'}</span>
                    </td>
                    <td class="py-4">
                        <span class="bg-success/10 text-success text-[10px] font-bold px-2 py-1 rounded-full uppercase">${tx.status || 'Success'}</span>
                    </td>
                    <td class="py-4 text-right font-bold ${amountColor}">
                        ${amountPrefix}₹${parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Transactions load error:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-error text-sm">Failed to load transaction logs.</td>
            </tr>
        `;
    }
}

// Modal open/close helpers
window.openDepositModal = function() {
    const modal = document.getElementById('deposit-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
};

window.closeDepositModal = function() {
    const modal = document.getElementById('deposit-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.openWithdrawModal = function() {
    const modal = document.getElementById('withdraw-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
};

window.closeWithdrawModal = function() {
    const modal = document.getElementById('withdraw-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// Deposit submission
window.handleDeposit = async function(event) {
    event.preventDefault();
    const amountEl = document.getElementById('deposit-amount');
    const amount = parseFloat(amountEl.value);

    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid deposit amount.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/wallet/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            closeDepositModal();
            amountEl.value = '';
            alert(data.message || 'Deposit processed successfully!');
            loadWalletBalance();
            loadTransactions();
            
            // Dispatch custom event to trigger chart update if needed
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            alert(data.error || 'Failed to complete deposit.');
        }
    } catch (e) {
        console.error('Deposit submission error:', e);
        alert('Server communication failed.');
    }
};

// Withdrawal submission
window.handleWithdraw = async function(event) {
    event.preventDefault();
    const amountEl = document.getElementById('withdraw-amount');
    const amount = parseFloat(amountEl.value);

    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid withdrawal amount.');
        return;
    }

    if (amount > walletBalance) {
        alert(`Insufficient wallet balance. You can withdraw up to ₹${walletBalance.toLocaleString('en-IN')}`);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/wallet/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            closeWithdrawModal();
            amountEl.value = '';
            alert(data.message || 'Withdrawal completed successfully!');
            loadWalletBalance();
            loadTransactions();
            
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            alert(data.error || 'Failed to complete withdrawal.');
        }
    } catch (e) {
        console.error('Withdrawal submission error:', e);
        alert('Server communication failed.');
    }
};

window.openSendMoneyModal = function() {
    const modal = document.getElementById('send-money-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
        }, 10);
    }
};

window.closeSendMoneyModal = function() {
    const modal = document.getElementById('send-money-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.toggleTransferFields = function(method) {
    const upiFields = document.getElementById('upi-fields');
    const bankFields = document.getElementById('bank-fields');
    if (method === 'UPI') {
        if (upiFields) upiFields.classList.remove('hidden');
        if (bankFields) bankFields.classList.add('hidden');
    } else {
        if (upiFields) upiFields.classList.add('hidden');
        if (bankFields) bankFields.classList.remove('hidden');
    }
};

window.handleSendMoney = async function(event) {
    event.preventDefault();
    const method = document.querySelector('input[name="transfer-method"]:checked').value;
    const amount = parseFloat(document.getElementById('send-amount').value);
    const notes = document.getElementById('send-notes').value;
    
    let recipient = '';
    if (method === 'UPI') {
        recipient = document.getElementById('send-upi-id').value;
        if (!recipient) {
            alert('Please enter a UPI ID.');
            return;
        }
    } else {
        const acc = document.getElementById('send-bank-acc').value;
        const ifsc = document.getElementById('send-bank-ifsc').value;
        if (!acc || !ifsc) {
            alert('Please enter both Account Number and IFSC Code.');
            return;
        }
        recipient = `Acc: ${acc} (IFSC: ${ifsc})`;
    }

    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }

    if (amount > walletBalance) {
        alert(`Insufficient balance. Available: ₹${walletBalance.toLocaleString('en-IN')}`);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/wallet/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount, method, recipient, notes })
        });

        const data = await res.json();
        if (res.ok) {
            closeSendMoneyModal();
            document.getElementById('send-money-form').reset();
            alert(data.message || 'Transfer completed successfully!');
            loadWalletBalance();
            loadTransactions();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            alert(data.error || 'Transfer failed.');
        }
    } catch (e) {
        console.error('Transfer submission error:', e);
        alert('Server communication failed.');
    }
};

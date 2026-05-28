const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/pages/login.html';
}

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

// Security boundary check: Only admin or approved developers can enter
const isAuthorized = user.role === 'admin' || user.email === 'demo@efaws.com' || user.email === 'etsintern0012@gmail.com';
if (!isAuthorized) {
    alert('Access Denied: You are not authorized to view the admin console.');
    window.location.href = '/pages/dashboard.html';
}

let usersList = [];

document.addEventListener('DOMContentLoaded', () => {
    updateHeaderProfile();
    updateHealthScoreBadge();
    loadAdminData();

    // Search bar filter
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.addEventListener('input', renderUsersTable);
    }

    // Sign out trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }

    // Setup 30s Polling Loop
    setInterval(() => {
        console.log('[POLLING] Refreshing administrator dashboard data...');
        loadAdminData(true);
    }, 30000);
});

function updateHeaderProfile() {
    const firstName = user.email ? user.email.split('@')[0] : 'User';
    const capitalize = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    
    const topUserNameEl = document.getElementById('top-user-name');
    if (topUserNameEl) topUserNameEl.textContent = capitalize;

    const initialsEl = document.getElementById('user-avatar-initials');
    if (initialsEl) initialsEl.textContent = capitalize.substring(0, 2).toUpperCase();
}

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

async function loadAdminData(silent = false) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody && !silent) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to retrieve admin stats');
        const stats = await res.json();

        // Update KPI card text
        document.getElementById('stat-total-balance').textContent = `₹${parseFloat(stats.totalPlatformBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('stat-avg-health').textContent = stats.avgCreditHealthScore || 'N/A';
        document.getElementById('stat-total-loans').textContent = `₹${parseFloat(stats.outstandingLoans || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('stat-total-insurance').textContent = `₹${parseFloat(stats.totalInsuranceCoverage || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        usersList = stats.activeUsersList || [];
        renderUsersTable();

        const syncEl = document.getElementById('last-sync-time');
        if (syncEl) {
            const now = new Date();
            syncEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">sync</span> Synced at ${now.toLocaleTimeString()}`;
        }
    } catch (err) {
        console.error('Error fetching admin stats:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-error">Failed to synchronize administrative dashboard data.</td>
                </tr>
            `;
        }
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const query = (document.getElementById('user-search')?.value || '').toLowerCase();
    
    // Filter users
    const filtered = usersList.filter(u => 
        (u.full_name || '').toLowerCase().includes(query) ||
        (u.email || '').toLowerCase().includes(query) ||
        (u.phone || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-outline">No profiles found matching search criteria.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        const isFrozen = !!u.is_frozen;
        const balance = parseFloat(u.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        
        let kycBadgeClass = 'bg-outline-variant text-on-surface-variant';
        if (u.kyc_status === 'Verified') {
            kycBadgeClass = 'bg-success/15 text-success border border-success/20';
        } else if (u.kyc_status === 'Rejected') {
            kycBadgeClass = 'bg-error/15 text-error border border-error/20';
        } else if (u.kyc_status === 'In_Progress') {
            kycBadgeClass = 'bg-primary/15 text-primary border border-primary/20';
        }

        const stateBadgeClass = isFrozen 
            ? 'bg-error text-white font-extrabold px-2 py-0.5 rounded' 
            : 'bg-success/15 text-success font-bold px-2 py-0.5 rounded border border-success/10';

        const isCurrentAdmin = u.id === user.userId;

        return `
            <tr class="border-b border-outline-variant/15 hover:bg-surface-container-low dark:hover:bg-dark-surface/50 transition-colors">
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            ${(u.full_name || 'N/A').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-on-surface dark:text-white flex items-center gap-1.5">
                                ${u.full_name || 'N/A'}
                                ${isCurrentAdmin ? '<span class="bg-primary/25 text-primary text-[8px] px-1 py-0.2 rounded font-extrabold">You</span>' : ''}
                            </div>
                            <div class="text-[10px] text-outline mt-0.5">${u.email} • ${u.phone || 'No phone'}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 text-right font-bold font-sora text-on-surface dark:text-white">₹${balance}</td>
                <td class="py-4 px-4 text-center font-extrabold text-sm text-primary">${u.financial_health_score || 0}</td>
                <td class="py-4 px-4 text-center">
                    <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${kycBadgeClass}">
                        ${u.kyc_status}
                    </span>
                </td>
                <td class="py-4 px-4 text-center">
                    <span class="text-[10px] uppercase ${stateBadgeClass}">
                        ${isFrozen ? 'FROZEN' : 'ACTIVE'}
                    </span>
                </td>
                <td class="py-4 px-4 text-right">
                    <div class="flex justify-end gap-2">
                        <!-- KYC Verify Action -->
                        ${u.kyc_status === 'Verified' ? `
                            <button onclick="changeKycStatus('${u.id}', 'Pending')" class="bg-surface-container-high dark:bg-dark-bg text-on-surface hover:bg-outline-variant/35 px-3 py-1.5 rounded-xl font-bold transition-all">
                                Reject KYC
                            </button>
                        ` : `
                            <button onclick="changeKycStatus('${u.id}', 'Verified')" class="bg-success text-white hover:opacity-90 px-3 py-1.5 rounded-xl font-bold transition-all">
                                Approve KYC
                            </button>
                        `}
                        
                        <!-- Toggle Freeze Action -->
                        <button onclick="toggleUserFreeze('${u.id}', ${!isFrozen})" class="${isFrozen ? 'bg-primary text-white' : 'bg-error text-white'} hover:opacity-90 px-3 py-1.5 rounded-xl font-bold transition-all">
                            ${isFrozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.changeKycStatus = async function(targetUserId, kycStatus) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/admin/kyc/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId, kycStatus })
        });

        if (res.ok) {
            alert(`KYC status successfully set to: ${kycStatus}`);
            loadAdminData();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to update KYC status.');
        }
    } catch (err) {
        console.error('Error verifying KYC:', err);
        alert('Network error updating KYC.');
    }
};

window.toggleUserFreeze = async function(targetUserId, freeze) {
    if (targetUserId === user.userId) {
        alert('Action Blocked: You cannot freeze your own admin profile.');
        return;
    }

    if (freeze && !confirm('Are you sure you want to FREEZE this account? All transaction actions for this user will be suspended.')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/admin/users/freeze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId, freeze })
        });

        if (res.ok) {
            alert(`User account freeze state set to: ${freeze}`);
            loadAdminData();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to update freeze status.');
        }
    } catch (err) {
        console.error('Error toggling user freeze:', err);
        alert('Network error updating freeze status.');
    }
};

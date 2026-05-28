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

document.addEventListener('DOMContentLoaded', () => {
    updateHeaderProfile();
    updateHealthScoreBadge();
    loadSessions();
    loadAuditLogs();

    // Check admin visibility
    if (user.role === 'admin' || user.email === 'demo@efaws.com' || user.email === 'etsintern0012@gmail.com') {
        const adminLink = document.getElementById('nav-admin-link');
        if (adminLink) adminLink.classList.remove('hidden');
    }

    // Handle change password form submission
    const passwordForm = document.getElementById('change-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handleChangePassword);
    }

    // Sign out trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }

    // 2FA simulated toggle handler
    const twoFaToggle = document.getElementById('two-factor-toggle');
    if (twoFaToggle) {
        twoFaToggle.checked = localStorage.getItem('2fa_enabled') !== 'false';
        twoFaToggle.addEventListener('change', (e) => {
            localStorage.setItem('2fa_enabled', e.target.checked);
            alert(`Simulated 2FA state: ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
        });
    }

    // Setup 30s Polling Loop
    setInterval(() => {
        console.log('[POLLING] Refreshing security metrics & sessions...');
        loadSessions(true);
        loadAuditLogs(true);
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

async function loadSessions(silent = false) {
    const container = document.getElementById('sessions-container');
    if (!container && !silent) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/security/sessions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const sessions = await res.json();

        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-outline text-xs">
                    No active sessions logged.
                </div>
            `;
            return;
        }

        container.innerHTML = sessions.map(sess => {
            const lastActive = new Date(sess.last_active).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            const locationCity = sess.last_location_city || sess.location || 'Unknown Location';
            const isCurrent = sess.ip_address === '::1' || sess.ip_address === '127.0.0.1'; // local placeholder comparison

            return `
                <div class="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 dark:border-outline/5 bg-surface-container-low dark:bg-dark-bg/50">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <span class="material-symbols-outlined">
                                ${sess.device_info.toLowerCase().includes('phone') || sess.device_info.toLowerCase().includes('mobile') ? 'smartphone' : 'laptop_mac'}
                            </span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-sm text-on-surface dark:text-white">${sess.device_info}</span>
                                ${isCurrent ? '<span class="bg-primary/20 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">Current Session</span>' : ''}
                            </div>
                            <p class="text-xs text-outline font-semibold mt-0.5">${locationCity} • IP: ${sess.ip_address}</p>
                            <p class="text-[10px] text-outline mt-0.5">Last active: ${lastActive}</p>
                        </div>
                    </div>
                    
                    <button onclick="revokeSession('${sess.id}')" class="text-xs text-error hover:underline px-3 py-1.5 border border-error/20 hover:bg-error/5 rounded-xl font-bold transition-all">
                        Revoke
                    </button>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching sessions:', err);
        if (container) {
            container.innerHTML = `<div class="text-error text-center py-6">Failed to sync active sessions.</div>`;
        }
    }
}

async function loadAuditLogs(silent = false) {
    const tbody = document.getElementById('audit-logs-tbody');
    if (!tbody && !silent) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/security/audit-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        const logs = await res.json();

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-outline">No logs recorded in your security audit trail yet.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const timestamp = new Date(log.created_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            // Make the action string readable
            let actionText = log.action_type.replace(/_/g, ' ');
            let badgeClass = 'bg-surface-container text-on-surface-variant';
            if (log.action_type.includes('SUCCESS') || log.action_type.includes('COMPLETED') || log.action_type.includes('VERIFIED')) {
                badgeClass = 'bg-success/15 text-success border border-success/20';
            } else if (log.action_type.includes('REVOKE') || log.action_type.includes('FAIL') || log.action_type.includes('FROZEN')) {
                badgeClass = 'bg-error/15 text-error border border-error/20';
            }

            return `
                <tr class="border-b border-outline-variant/10 hover:bg-surface-container-low dark:hover:bg-dark-surface/50 transition-colors">
                    <td class="py-3.5 px-4 font-bold text-on-surface dark:text-white">
                        <span class="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold ${badgeClass}">
                            ${actionText}
                        </span>
                    </td>
                    <td class="py-3.5 px-4 text-outline font-semibold">${timestamp}</td>
                    <td class="py-3.5 px-4 text-outline font-semibold">${log.ip_address || '::1'}</td>
                    <td class="py-3.5 px-4 text-outline max-w-xs truncate" title="${log.device_info || 'Local Server Node'}">${log.device_info || 'Local Agent'}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-error">Failed to synchronize security audit logs.</td>
                </tr>
            `;
        }
    }
}

window.revokeSession = async function(sessionId) {
    if (!confirm('Are you sure you want to terminate this access session?')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/security/sessions/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId })
        });

        if (res.ok) {
            alert('Session revoked successfully.');
            loadSessions();
            loadAuditLogs();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to revoke session.');
        }
    } catch (err) {
        console.error('Error revoking session:', err);
        alert('Network error terminating session.');
    }
};

async function handleChangePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/security/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (res.ok) {
            alert('Password changed successfully!');
            document.getElementById('change-password-form').reset();
            loadAuditLogs();
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to change password.');
        }
    } catch (err) {
        console.error('Error changing password:', err);
        alert('Network error changing password.');
    }
}

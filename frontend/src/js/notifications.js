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

let notificationsData = [];
let currentFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
    updateHeaderProfile();
    updateHealthScoreBadge();
    loadNotifications();

    // Setup clear / mark all read button
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    // Setup search filter
    const searchInput = document.getElementById('notif-search');
    if (searchInput) {
        searchInput.addEventListener('input', renderFilteredNotifications);
    }

    // Setup category filters clicking
    const filterButtons = document.querySelectorAll('#category-filters button');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('bg-primary/10', 'text-primary', 'font-bold');
                b.classList.add('hover:bg-surface-container', 'dark:hover:bg-dark-bg', 'text-on-surface-variant', 'dark:text-outline-variant');
                const badge = b.querySelector('span:last-child');
                if (badge) {
                    badge.className = 'bg-outline-variant text-on-surface text-[10px] px-2 py-0.5 rounded-full';
                }
            });
            btn.classList.remove('hover:bg-surface-container', 'dark:hover:bg-dark-bg', 'text-on-surface-variant', 'dark:text-outline-variant');
            btn.classList.add('bg-primary/10', 'text-primary', 'font-bold');
            const badge = btn.querySelector('span:last-child');
            if (badge) {
                badge.className = 'bg-primary text-white text-[10px] px-2 py-0.5 rounded-full';
            }

            currentFilter = btn.getAttribute('data-filter');
            renderFilteredNotifications();
        });
    });

    // Check admin visibility
    if (user.role === 'admin' || user.email === 'demo@efaws.com' || user.email === 'etsintern0012@gmail.com') {
        const adminLink = document.getElementById('nav-admin-link');
        if (adminLink) adminLink.classList.remove('hidden');
    }

    // Setup 30s Polling Loop
    setInterval(() => {
        console.log('[POLLING] Refreshing notifications stream...');
        loadNotifications(true);
    }, 30000);

    // Sign out trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }
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

async function loadNotifications(silent = false) {
    const container = document.getElementById('notifications-list-container');
    if (!container && !silent) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to retrieve notifications stream');
        notificationsData = await res.json();

        // Update counts
        updateCategoryCounts();

        // Render notifications
        renderFilteredNotifications();

        const syncEl = document.getElementById('last-sync-time');
        if (syncEl) {
            const now = new Date();
            syncEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">sync</span> Synced at ${now.toLocaleTimeString()}`;
        }
    } catch (err) {
        console.error('Error fetching notifications list:', err);
        if (container) {
            container.innerHTML = `<div class="text-error text-center py-6">Failed to sync notification stream.</div>`;
        }
    }
}

function updateCategoryCounts() {
    const cntAll = document.getElementById('cnt-all');
    const cntAlert = document.getElementById('cnt-alert');
    const cntInvestment = document.getElementById('cnt-investment');
    const cntLending = document.getElementById('cnt-lending');
    const cntRewards = document.getElementById('cnt-rewards');

    if (cntAll) cntAll.textContent = notificationsData.length;
    if (cntAlert) cntAlert.textContent = notificationsData.filter(n => n.type === 'ALERT').length;
    if (cntInvestment) cntInvestment.textContent = notificationsData.filter(n => n.type === 'INVESTMENT').length;
    if (cntLending) cntLending.textContent = notificationsData.filter(n => n.type === 'LENDING').length;
    if (cntRewards) cntRewards.textContent = notificationsData.filter(n => n.type === 'REWARDS').length;
}

function renderFilteredNotifications() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    const query = (document.getElementById('notif-search')?.value || '').toLowerCase();
    
    // Apply filters
    let filtered = notificationsData;
    if (currentFilter !== 'ALL') {
        filtered = filtered.filter(n => n.type === currentFilter);
    }
    if (query) {
        filtered = filtered.filter(n => 
            n.title.toLowerCase().includes(query) || 
            n.description.toLowerCase().includes(query)
        );
    }

    const showingSummary = document.getElementById('showing-summary');
    if (showingSummary) {
        showingSummary.textContent = `Showing ${filtered.length} of ${notificationsData.length} notifications`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center text-outline bg-surface-container-lowest dark:bg-dark-surface border border-outline-variant/30 dark:border-outline/10 rounded-2xl card-shadow">
                <span class="material-symbols-outlined text-4xl text-outline mb-2">notifications_off</span>
                <p class="font-semibold text-on-surface dark:text-white">No notifications match this filter.</p>
                <p class="text-xs text-outline mt-1">Updates on activity, security logs, or payouts will be displayed here.</p>
            </div>
        `;
        return;
    }

    // Mapping icons
    const iconMap = {
        'ALERT': 'security',
        'INVESTMENT': 'trending_up',
        'LENDING': 'payments',
        'REWARDS': 'savings'
    };

    // Priority badges logic
    const priorityClasses = {
        'CRITICAL': 'bg-error text-white border border-error',
        'HIGH': 'bg-warning/20 text-warning border border-warning/30',
        'MEDIUM': 'bg-primary/20 text-primary border border-primary/30',
        'LOW': 'bg-outline-variant/30 text-on-surface-variant border border-outline-variant/40'
    };

    container.innerHTML = filtered.map(notif => {
        const isUnread = !notif.is_read;
        const icon = iconMap[notif.type] || 'notifications';
        const badge = priorityClasses[notif.priority || 'LOW'];
        const formattedDate = new Date(notif.created_at).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="p-5 flex gap-4 bg-surface-container-lowest dark:bg-dark-surface border ${isUnread ? 'border-primary/40 dark:border-primary/20 bg-primary/[0.02]' : 'border-outline-variant/30 dark:border-outline/10'} rounded-2xl card-shadow transition-all group relative">
                <div class="w-10 h-10 rounded-xl bg-surface-container dark:bg-dark-bg flex items-center justify-center text-outline border border-outline-variant/20 self-start group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <span class="material-symbols-outlined">${icon}</span>
                </div>
                
                <div class="flex-1 space-y-1">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <h4 class="font-bold text-sm text-on-surface dark:text-white ${isUnread ? 'font-extrabold' : ''}">${notif.title}</h4>
                        <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${badge}">${notif.priority || 'LOW'}</span>
                        ${isUnread ? '<span class="w-2 h-2 rounded-full bg-primary" title="Unread"></span>' : ''}
                    </div>
                    <p class="text-xs text-on-surface-variant dark:text-outline-variant leading-relaxed font-medium">${notif.description}</p>
                    <p class="text-[10px] text-outline pt-1">${formattedDate}</p>
                </div>
                
                <div class="flex items-center gap-2 self-center">
                    ${isUnread ? `
                        <button onclick="markAsRead('${notif.id}')" class="text-xs text-primary dark:text-inverse-primary hover:underline font-bold px-2 py-1" title="Mark as read">
                            Read
                        </button>
                    ` : ''}
                    <button onclick="dismissNotification('${notif.id}')" class="text-xs text-outline hover:text-error hover:underline px-2 py-1" title="Dismiss">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.markAsRead = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            loadNotifications();
        }
    } catch (err) {
        console.error('Error marking as read:', err);
    }
};

window.dismissNotification = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            loadNotifications();
        }
    } catch (err) {
        console.error('Error dismissing notification:', err);
    }
};

async function markAllNotificationsAsRead() {
    const unread = notificationsData.filter(n => !n.is_read);
    if (unread.length === 0) {
        alert('All notifications are already read.');
        return;
    }

    try {
        // Send sequential or parallel read triggers
        await Promise.all(unread.map(n => 
            fetch(`${API_BASE}/api/v1/notifications/${n.id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ));
        loadNotifications();
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
    }
}

window.triggerMockNotification = async function() {
    const priority = document.getElementById('mock-priority').value;
    
    // Choose template message depending on priority
    let title = 'Compounding Target Met!';
    let desc = 'Congratulations! Your retirement SIP portfolio has hit a cumulative returns hurdle of 18.5%.';
    let type = 'INVESTMENT';

    if (priority === 'CRITICAL') {
        title = 'Suspicious Login Attempt Detected';
        desc = 'A simulated connection request from IP: 198.51.100.42 (Moscow, RU) was blocked by E-Faws Security Center.';
        type = 'ALERT';
    } else if (priority === 'HIGH') {
        title = 'EMI Repayment Notice';
        desc = 'Your SBI Business Line EMI of ₹45,000 is due in 3 days. Ensure sufficient E-Wallet balance.';
        type = 'LENDING';
    } else if (priority === 'MEDIUM') {
        title = 'Tier Upgrade Unlocked!';
        desc = 'Claim your Level 4 Diamond Rank badge in the Earn Hub and receive a 10% discount on credit line processing.';
        type = 'REWARDS';
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/notifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type, title, description: desc, priority })
        });

        if (res.ok) {
            loadNotifications();
        } else {
            alert('Failed to inject mock notification.');
        }
    } catch (err) {
        console.error('Error sending mock notification:', err);
    }
};

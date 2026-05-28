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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial UI updates
    updateHeaderProfile();
    updateHealthScoreBadge();
    
    // 2. Load Portfolio Data
    loadPortfolioData();

    // 3. Setup logout trigger
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

// Fetch and load investments portfolio details
async function loadPortfolioData() {
    const totalValEl = document.getElementById('portfolio-total-value');
    const investedCapEl = document.getElementById('portfolio-invested-capital');
    const returnAmtEl = document.getElementById('portfolio-total-returns-amount');
    const todayReturnsEl = document.getElementById('portfolio-today-returns');

    try {
        const res = await fetch(`${API_BASE}/api/v1/investments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load portfolio');
        const investments = await res.json();

        let totalValue = 0;
        let investedCapital = 0;

        investments.forEach(inv => {
            totalValue += parseFloat(inv.current_value || 0);
            investedCapital += parseFloat(inv.invested_amount || 0);
        });

        // Fallback default mock data if no items exist yet
        if (investments.length === 0) {
            totalValue = 4285600;
            investedCapital = 3620300;
        }

        const profit = totalValue - investedCapital;
        const profitPercent = investedCapital > 0 ? ((profit / investedCapital) * 100).toFixed(2) : '0.00';

        if (totalValEl) totalValEl.textContent = `₹${totalValue.toLocaleString('en-IN')}`;
        if (investedCapEl) investedCapEl.textContent = `₹${investedCapital.toLocaleString('en-IN')}`;
        
        if (returnAmtEl) {
            returnAmtEl.textContent = `₹${profit.toLocaleString('en-IN')} Profit`;
            if (profit < 0) {
                returnAmtEl.className = 'text-[12px] text-error font-semibold mt-1';
            } else {
                returnAmtEl.className = 'text-[12px] text-success font-semibold mt-1';
            }
        }

        if (todayReturnsEl) {
            todayReturnsEl.textContent = `${profit >= 0 ? '+' : ''}₹${profit.toLocaleString('en-IN')} (${profitPercent}%)`;
            const parentSpan = todayReturnsEl.parentElement;
            if (parentSpan) {
                if (profit < 0) {
                    parentSpan.className = 'bg-error/10 text-error px-2 py-0.5 rounded-lg text-sm font-bold flex items-center gap-1';
                } else {
                    parentSpan.className = 'bg-success/10 text-success px-2 py-0.5 rounded-lg text-sm font-bold flex items-center gap-1';
                }
            }
        }

    } catch (err) {
        console.error('Portfolio hydration error:', err);
    }
}

// Modal controls
window.openInvestmentModal = function(category = 'Mutual Funds') {
    const modal = document.getElementById('investment-modal');
    const select = document.getElementById('invest-category-field');
    if (select) {
        select.value = category;
    }
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
        }, 10);
    }
};

window.closeInvestmentModal = function() {
    const modal = document.getElementById('investment-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.submitInvestmentPurchase = async function(event) {
    event.preventDefault();

    const portfolioType = document.getElementById('invest-category-field').value;
    const amount = parseFloat(document.getElementById('invest-amount-field').value);

    if (!portfolioType || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid investment amount.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/investments/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ portfolioType, amount })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`Investment Successful!\n\nYou have purchased ₹${amount.toLocaleString('en-IN')} worth of ${portfolioType}.`);
            closeInvestmentModal();
            loadPortfolioData();
            updateHealthScoreBadge();
            
            // Award rewards XP
            await claimRewardXP(`BUY_INVESTMENT_${portfolioType.toUpperCase()}`, 300);
            
            // Reload the asset allocation chart widget if it exists
            const widgetEl = document.getElementById('widget-asset-allocation');
            if (widgetEl && window.location.reload) {
                window.location.reload(); // Simple reload to refresh the mounted React widgets
            }
        } else {
            alert(data.error || 'Failed to complete investment.');
        }
    } catch (err) {
        console.error('Submit investment purchase error:', err);
        alert('Server communication error. Failed to buy asset.');
    }
};

// Award rewards XP helper
async function claimRewardXP(milestoneId, xpReward) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ milestoneId, xpReward })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.leveledUp) {
                alert(`Level Up! ${data.message}`);
            }
        }
    } catch (e) {
        console.warn('Failed to claim rewards XP:', e);
    }
}

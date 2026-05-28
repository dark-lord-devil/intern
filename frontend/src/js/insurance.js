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
    
    // 2. Load Active Policies
    loadInsurancePolicies();

    // 3. Setup logout trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }

    // 4. Initial premium calculation in modal
    calculateMockPremium();
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

// Load user active policies
async function loadInsurancePolicies() {
    const activeCountEl = document.getElementById('active-policies-count');
    const totalCoverageEl = document.getElementById('total-coverage-amount');
    const nextRenewalEl = document.getElementById('next-renewal-days');
    const policiesListEl = document.getElementById('active-policies-list');

    try {
        const res = await fetch(`${API_BASE}/api/v1/insurance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load insurance policies');
        const policies = await res.json();

        // Populate summary values
        let activeCount = policies.length;
        let totalCoverage = 0;
        let closestExpiryDays = Infinity;

        policies.forEach(policy => {
            if (policy.status === 'ACTIVE') {
                totalCoverage += parseFloat(policy.coverage_amount || 0);
                const expiryDate = new Date(policy.expiry_date);
                const now = new Date();
                const diffTime = expiryDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 0 && diffDays < closestExpiryDays) {
                    closestExpiryDays = diffDays;
                }
            }
        });

        if (activeCountEl) activeCountEl.textContent = activeCount;
        if (totalCoverageEl) totalCoverageEl.textContent = `₹${totalCoverage.toLocaleString('en-IN')}`;
        
        if (nextRenewalEl) {
            if (closestExpiryDays === Infinity) {
                nextRenewalEl.textContent = 'No Due';
            } else {
                nextRenewalEl.textContent = `${closestExpiryDays} Days`;
            }
        }

        // Calculate dynamic Protection Score based on active coverage
        // Base protection score: 50. Health cover adds 15, Vehicle adds 10, Life adds 20, Travel adds 5. Max 100.
        let protectionScore = 50;
        const types = new Set(policies.map(p => p.policy_type));
        if (types.has('Health')) protectionScore += 15;
        if (types.has('Vehicle')) protectionScore += 10;
        if (types.has('Life')) protectionScore += 20;
        if (types.has('Travel')) protectionScore += 5;
        if (protectionScore > 100) protectionScore = 100;

        const protectionScoreEl = document.getElementById('protection-score-display');
        if (protectionScoreEl) {
            protectionScoreEl.textContent = protectionScore;
        }

        // Hydrate list
        if (policiesListEl) {
            if (policies.length === 0) {
                policiesListEl.innerHTML = `
                    <div class="text-center py-8">
                        <span class="material-symbols-outlined text-outline text-5xl mb-3">shield_with_heart</span>
                        <p class="text-outline-variant font-bold text-sm">No Active Policies found</p>
                        <p class="text-outline text-xs mt-1">Protect your health and assets today.</p>
                    </div>
                `;
            } else {
                policiesListEl.innerHTML = policies.map(policy => {
                    const expiry = new Date(policy.expiry_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    });
                    const iconName = getPolicyIcon(policy.policy_type);
                    return `
                        <div class="flex items-center justify-between p-4 bg-surface-container-low dark:bg-dark-bg rounded-2xl border border-outline-variant/20 hover:border-primary/30 transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <span class="material-symbols-outlined text-[20px]">${iconName}</span>
                                </div>
                                <div>
                                    <p class="font-bold text-on-surface dark:text-white text-sm">${policy.provider} ${policy.policy_type}</p>
                                    <p class="text-[11px] text-outline">Expires: ${expiry}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-bold text-on-surface dark:text-white text-sm">₹${parseFloat(policy.coverage_amount).toLocaleString('en-IN')}</p>
                                <p class="text-[11px] text-outline">Premium: ₹${parseFloat(policy.premium_amount).toLocaleString('en-IN')}/yr</p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (err) {
        console.error('Insurance policies hydration error:', err);
    }
}

function getPolicyIcon(type) {
    switch (type) {
        case 'Health': return 'medical_services';
        case 'Vehicle': return 'directions_car';
        case 'Life': return 'family_restroom';
        case 'Travel': return 'flight';
        default: return 'verified_user';
    }
}

// Modal calculations
window.calculateMockPremium = function() {
    const type = document.getElementById('policy-type-field').value;
    const coverage = parseInt(document.getElementById('policy-coverage-field').value) || 1000000;
    
    let premium = 0;
    if (type === 'Health') {
        if (coverage <= 500000) premium = 8500;
        else if (coverage <= 1000000) premium = 17200;
        else if (coverage <= 2500000) premium = 32000;
        else premium = 55000;
    } else if (type === 'Vehicle') {
        if (coverage <= 500000) premium = 12000;
        else if (coverage <= 1000000) premium = 18500;
        else if (coverage <= 2500000) premium = 38000;
        else premium = 65000;
    } else if (type === 'Life') {
        if (coverage <= 500000) premium = 4000;
        else if (coverage <= 1000000) premium = 7500;
        else if (coverage <= 2500000) premium = 15000;
        else premium = 28000;
    } else if (type === 'Travel') {
        if (coverage <= 500000) premium = 1500;
        else if (coverage <= 1000000) premium = 2800;
        else if (coverage <= 2500000) premium = 6000;
        else premium = 11000;
    }
    
    const premiumField = document.getElementById('policy-premium-field');
    if (premiumField) {
        premiumField.value = premium;
    }
};

window.openInsuranceModal = function(type = 'Health', provider = 'HDFC ERGO', premium = null, coverage = 1000000) {
    const modal = document.getElementById('insurance-modal');
    
    const typeField = document.getElementById('policy-type-field');
    const providerField = document.getElementById('policy-provider-field');
    const coverageField = document.getElementById('policy-coverage-field');
    
    if (typeField) typeField.value = type;
    if (providerField) providerField.value = provider;
    if (coverageField) coverageField.value = coverage;
    
    if (premium !== null) {
        const premiumField = document.getElementById('policy-premium-field');
        if (premiumField) premiumField.value = premium;
    } else {
        calculateMockPremium();
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
        }, 10);
    }
};

window.closeInsuranceModal = function() {
    const modal = document.getElementById('insurance-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.submitInsurancePurchase = async function(event) {
    event.preventDefault();

    const policyType = document.getElementById('policy-type-field').value;
    const provider = document.getElementById('policy-provider-field').value;
    const coverageAmount = parseFloat(document.getElementById('policy-coverage-field').value);
    const premiumAmount = parseFloat(document.getElementById('policy-premium-field').value);

    if (!policyType || !provider || isNaN(coverageAmount) || isNaN(premiumAmount) || premiumAmount <= 0) {
        alert('Please fill in all policy options.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/insurance/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ policyType, provider, coverageAmount, premiumAmount })
        });

        const data = await res.json();

        if (res.ok) {
            alert(`Policy Purchase Successful!\n\nYou have purchased ${provider} ${policyType} Insurance. ₹${premiumAmount.toLocaleString('en-IN')} has been debited from your wallet.`);
            closeInsuranceModal();
            loadInsurancePolicies();
            updateHealthScoreBadge();
            
            // Award rewards XP
            await claimRewardXP(`BUY_POLICY_${policyType.toUpperCase()}`, 400);
        } else {
            alert(data.error || 'Failed to buy policy.');
        }
    } catch (err) {
        console.error('Submit policy purchase error:', err);
        alert('Server communication error. Failed to buy policy.');
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

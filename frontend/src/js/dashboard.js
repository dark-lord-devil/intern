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
    
    // 2. Fetch Dashboard Modules Data
    loadWalletData();
    loadLendingData();
    loadRewardsData();
    loadAIRecommendations();
    loadOnboardingChecklist();
    
    // 3. Setup real-time polling
    setupRealtimePolling();

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
    // Greets user
    const firstName = user.email ? user.email.split('@')[0] : 'User';
    const capitalize = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    
    const userFirstNameEl = document.getElementById('user-first-name');
    if (userFirstNameEl) userFirstNameEl.textContent = capitalize;

    const topUserNameEl = document.getElementById('top-user-name');
    if (topUserNameEl) topUserNameEl.textContent = capitalize;

    const initialsEl = document.getElementById('user-avatar-initials');
    if (initialsEl) initialsEl.textContent = capitalize.substring(0, 2).toUpperCase();
}

// Fetch and load wallet balances
async function loadWalletData() {
    const grid = document.getElementById('wallet-accounts-grid');
    if (!grid) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/wallet`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load wallet');
        const wallet = await res.json();

        // Stitch design has HDFC and SBI balances, let's merge with primary e-faws wallet
        grid.innerHTML = `
            <!-- Primary E-Faws Wallet -->
            <div class="p-4 rounded-2xl border border-primary/30 bg-primary/5 flex justify-between items-center group hover:border-primary/50 transition-all cursor-pointer" onclick="window.location.href='/pages/wallet.html'">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <span class="material-symbols-outlined text-primary font-bold">account_balance_wallet</span>
                    </div>
                    <div>
                        <p class="font-bold text-on-surface dark:text-white">Smart E-Wallet</p>
                        <p class="text-[12px] text-outline">Primary Balance</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-primary dark:text-inverse-primary">₹${wallet.balance.toLocaleString('en-IN')}</p>
                    <span class="text-[10px] text-outline">Manage Balance →</span>
                </div>
            </div>

            <!-- Seeded HDFC Account from Stitch template -->
            <div class="p-4 rounded-2xl border border-outline-variant/50 dark:border-outline/20 bg-light-bg dark:bg-dark-bg flex justify-between items-center group hover:border-primary/50 transition-all cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white dark:bg-dark-surface rounded-xl shadow-sm flex items-center justify-center border border-outline-variant/20">
                        <span class="font-bold text-primary">HDFC</span>
                    </div>
                    <div>
                        <p class="font-bold text-on-surface dark:text-white">Savings Account</p>
                        <p class="text-[12px] text-outline">**** 8821</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-on-surface dark:text-white">₹12,42,800</p>
                    <span class="text-[10px] text-outline">Linked</span>
                </div>
            </div>
            
            <!-- Seeded SBI Account from Stitch template -->
            <div class="p-4 rounded-2xl border border-outline-variant/50 dark:border-outline/20 bg-light-bg dark:bg-dark-bg flex justify-between items-center group hover:border-primary/50 transition-all cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white dark:bg-dark-surface rounded-xl shadow-sm flex items-center justify-center border border-outline-variant/20">
                        <span class="font-bold text-success">SBI</span>
                    </div>
                    <div>
                        <p class="font-bold text-on-surface dark:text-white">Business Current</p>
                        <p class="text-[12px] text-outline">**** 4432</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-on-surface dark:text-white">₹8,12,050</p>
                    <span class="text-[10px] text-outline">Linked</span>
                </div>
            </div>
        `;

        // Update health score badge in header
        updateHealthScoreBadge();

    } catch (err) {
        console.error('Wallet hydration error:', err);
        grid.innerHTML = `<div class="text-error text-sm p-4">Error loading wallet information. Please refresh.</div>`;
    }
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

// Fetch and load active lending loans
async function loadLendingData() {
    const container = document.getElementById('active-loan-section');
    const badge = document.getElementById('emi-days-badge');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/lending/loans`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load loans');
        const loans = await res.json();
        const active = loans.filter(l => l.status === 'ACTIVE');

        if (active.length === 0) {
            if (badge) badge.classList.add('hidden');
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-6 text-center">
                    <span class="material-symbols-outlined text-outline text-4xl mb-2">account_balance</span>
                    <h4 class="font-semibold text-on-surface dark:text-white">No Active Loans</h4>
                    <p class="text-xs text-outline mb-4">You have pre-approved limits up to ₹15,00,000.</p>
                    <a href="/pages/lending.html" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-sm font-bold text-xs hover:opacity-90 transition-all">Apply for Credit Line</a>
                </div>
            `;
            return;
        }

        const loan = active[0];
        
        // Calculate dynamic dates
        const nextDate = new Date(loan.next_emi_date);
        const diffTime = Math.max(0, nextDate - new Date());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (badge) {
            badge.textContent = `Next EMI: ${diffDays} Days`;
            badge.classList.remove('hidden');
        }

        const percentPaid = Math.round(((loan.amount - loan.remaining_amount) / loan.amount) * 100);

        container.innerHTML = `
            <div>
                <div class="flex justify-between text-label-sm mb-2">
                    <span class="text-on-surface dark:text-white font-bold">Personal Loan (HDFC)</span>
                    <span class="text-outline">₹${loan.remaining_amount.toLocaleString('en-IN')} / ₹${loan.amount.toLocaleString('en-IN')}</span>
                </div>
                <div class="w-full h-3 bg-surface-container dark:bg-dark-bg rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full" style="width: ${percentPaid}%"></div>
                </div>
                <div class="flex justify-between mt-2 text-[11px] text-outline uppercase font-bold">
                    <span>Paid: ${percentPaid}%</span>
                    <span>Next Due: ${nextDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
            </div>
            <div class="flex gap-4 mt-4">
                <button class="flex-1 border border-primary text-primary dark:text-inverse-primary py-3 rounded-xl font-label-sm font-bold hover:bg-primary/5 transition-all text-xs" onclick="repayEmi('${loan.id}')">
                    Pay Monthly EMI (₹${loan.emi_amount.toLocaleString('en-IN')})
                </button>
                <a href="/pages/lending.html" class="flex-1 bg-surface-container dark:bg-dark-surface text-on-surface-variant dark:text-white text-center py-3 rounded-xl font-label-sm font-bold hover:bg-surface-container-high transition-all text-xs">
                    Lending Hub
                </a>
            </div>
        `;

    } catch (err) {
        console.error('Lending hydration error:', err);
        container.innerHTML = `<div class="text-error text-sm">Error loading loan data.</div>`;
    }
}

// Global repayment helper
window.repayEmi = async function(loanId) {
    if (!confirm('Are you sure you want to repay this EMI from your wallet?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/lending/loans/${loanId}/repay`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message || 'Repayment successful!');
            // Reload components
            loadWalletData();
            loadLendingData();
        } else {
            alert(data.error || 'Failed to process payment.');
        }
    } catch (e) {
        console.error('Repayment call error:', e);
        alert('Server connection error. Failed to process EMI repayment.');
    }
};

// Fetch and load rewards/XP progress
async function loadRewardsData() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Rewards API call failed');
        const rewards = await res.json();

        const levelDisplay = document.getElementById('earnhub-level-display');
        const nextLevelTip = document.getElementById('earnhub-next-level-tip');
        const progressBar = document.getElementById('earnhub-progress-bar');
        const currentXp = document.getElementById('earnhub-current-xp');
        const nextXp = document.getElementById('earnhub-next-xp');

        if (levelDisplay) levelDisplay.textContent = `Level ${rewards.level}`;
        if (nextLevelTip) nextLevelTip.textContent = `Next: Level ${rewards.level + 1} (Gold Rank)`;
        
        const percent = Math.round((rewards.current_xp / rewards.next_level_xp) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (currentXp) currentXp.textContent = `${rewards.current_xp.toLocaleString()} XP`;
        if (nextXp) nextXp.textContent = `${rewards.next_level_xp.toLocaleString()} XP`;

    } catch (err) {
        console.warn('Rewards progress hydration warning:', err.message);
    }
}

// Fetch and load AI Recommendations
async function loadAIRecommendations() {
    const insightsContainer = document.getElementById('insights-container');
    const mainTipTitle = document.getElementById('ai-tip-title');
    const mainTipDesc = document.getElementById('ai-tip-desc');
    const mainTipBtn = document.getElementById('ai-tip-btn');

    try {
        const res = await fetch(`${API_BASE}/api/v1/analytics/recommendations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('AI recommendations API call failed');
        const recommendations = await res.json();

        if (recommendations && recommendations.length > 0) {
            // 1. Update the Main Welcome Card tip
            const mainTip = recommendations[0];
            if (mainTipTitle) mainTipTitle.textContent = mainTip.title;
            if (mainTipDesc) mainTipDesc.textContent = mainTip.description;
            if (mainTipBtn) {
                mainTipBtn.textContent = mainTip.action_text || 'Apply Recommendation';
                mainTipBtn.onclick = () => handleRecommendationAction(mainTip);
            }

            // 2. Load the bottom grid (limit to 3 items)
            if (insightsContainer) {
                const subRecs = recommendations.slice(1, 4);
                
                // Static definitions to merge icons with dynamic backend categories
                const iconMap = {
                    'INVESTMENT': { icon: 'show_chart', color: 'text-primary bg-primary/10' },
                    'SPENDING': { icon: 'warning', color: 'text-warning bg-warning/10' },
                    'LENDING': { icon: 'payments', color: 'text-success bg-success/10' }
                };

                insightsContainer.innerHTML = subRecs.map(rec => {
                    const setup = iconMap[rec.category] || { icon: 'auto_awesome', color: 'text-primary bg-primary/10' };
                    return `
                        <div class="bg-surface-container-low dark:bg-dark-surface p-6 rounded-[24px] border border-outline-variant/30 dark:border-outline/10 group hover:bg-white dark:hover:bg-dark-elevated hover:card-shadow transition-all cursor-pointer flex flex-col justify-between" onclick="handleRecommendationAction(${JSON.stringify(rec).replace(/"/g, '&quot;')})">
                            <div>
                                <div class="w-10 h-10 rounded-xl ${setup.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <span class="material-symbols-outlined">${setup.icon}</span>
                                </div>
                                <h4 class="font-card-title text-on-surface dark:text-white font-semibold mb-2">${rec.title}</h4>
                                <p class="text-on-surface-variant dark:text-outline-variant font-body-md text-sm mb-4 leading-relaxed">${rec.description}</p>
                            </div>
                            <span class="text-xs text-primary dark:text-inverse-primary font-bold group-hover:underline self-start">${rec.action_text || 'Take Action'} →</span>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('AI Insights hydration error:', err);
        if (insightsContainer) {
            insightsContainer.innerHTML = `<div class="text-outline text-sm">Failed to load AI optimizations.</div>`;
        }
    }
}

// Take Action handler for AI tips
async function handleRecommendationAction(rec) {
    // If it's a specific route or action, redirect or simulate claim
    alert(`AI Recommendation Action Triggered:\n\nTitle: ${rec.title}\nAction: ${rec.action_text}\n\nThis optimization will be processed in your portfolio.`);
    
    // Simulate awarding rewards XP on claim!
    // Simulate awarding rewards XP on claim!
    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                milestoneId: `AI_REC_CLAIM_${rec.id || 'GENERIC'}`,
                xpReward: 250
            })
        });
        if (res.ok) {
            const result = await res.json();
            if (result.leveledUp) {
                alert(`Level Up! ${result.message}`);
            }
            loadRewardsData();
        }
    } catch (e) {
        console.warn('Failed to award action XP:', e);
    }
}

// Fetch and calculate Onboarding status
async function loadOnboardingChecklist() {
    const container = document.getElementById('onboarding-checklist-container');
    const percentEl = document.getElementById('onboarding-percent');
    const progressBar = document.getElementById('onboarding-progress-bar');
    if (!container) return;

    try {
        const [profileRes, walletRes, invRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/api/v1/wallet`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/api/v1/investments`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (profileRes.ok && walletRes.ok && invRes.ok) {
            const profile = await profileRes.json();
            const wallet = await walletRes.json();
            const investments = await invRes.json();

            const isKycVerified = profile.kyc_status === 'Verified';
            const isWalletSetup = wallet.balance > 0;
            const isInvested = investments.length > 0;

            let completedCount = 0;
            if (isKycVerified) completedCount++;
            if (isWalletSetup) completedCount++;
            if (isInvested) completedCount++;

            const percent = Math.round((completedCount / 3) * 100);

            if (percentEl) percentEl.textContent = `${percent}% Completed`;
            if (progressBar) progressBar.style.width = `${percent}%`;

            const kycBadge = document.getElementById('kyc-badge-status');
            if (kycBadge) {
                kycBadge.textContent = profile.kyc_status;
                if (profile.kyc_status === 'Verified') {
                    kycBadge.className = 'text-success font-bold';
                } else if (profile.kyc_status === 'Pending') {
                    kycBadge.className = 'text-warning font-bold';
                } else {
                    kycBadge.className = 'text-error font-bold';
                }
            }

            container.innerHTML = `
                <div class="flex items-center justify-between p-3 rounded-xl border ${isKycVerified ? 'border-success/30 bg-success/5' : 'border-outline-variant/30 bg-surface-container-low'} transition-all">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined ${isKycVerified ? 'text-success font-bold' : 'text-outline'}">
                            ${isKycVerified ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div>
                            <p class="font-bold text-xs ${isKycVerified ? 'text-success' : 'text-on-surface dark:text-white'}">Verify Identity (KYC)</p>
                            <p class="text-[10px] text-outline">${profile.kyc_status === 'Verified' ? 'Approved by admin' : 'Submit verification documents'}</p>
                        </div>
                    </div>
                    ${!isKycVerified ? '<button onclick="window.location.href=\'/pages/admin.html\'" class="text-[10px] font-bold text-primary hover:underline">Verify →</button>' : ''}
                </div>

                <div class="flex items-center justify-between p-3 rounded-xl border ${isWalletSetup ? 'border-success/30 bg-success/5' : 'border-outline-variant/30 bg-surface-container-low'} transition-all">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined ${isWalletSetup ? 'text-success font-bold' : 'text-outline'}">
                            ${isWalletSetup ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div>
                            <p class="font-bold text-xs ${isWalletSetup ? 'text-success' : 'text-on-surface dark:text-white'}">Fund E-Wallet</p>
                            <p class="text-[10px] text-outline">${isWalletSetup ? `Balance: ₹${wallet.balance.toLocaleString('en-IN')}` : 'Deposit initial funds to wallet'}</p>
                        </div>
                    </div>
                    ${!isWalletSetup ? '<button onclick="window.location.href=\'/pages/wallet.html\'" class="text-[10px] font-bold text-primary hover:underline">Deposit →</button>' : ''}
                </div>

                <div class="flex items-center justify-between p-3 rounded-xl border ${isInvested ? 'border-success/30 bg-success/5' : 'border-outline-variant/30 bg-surface-container-low'} transition-all">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined ${isInvested ? 'text-success font-bold' : 'text-outline'}">
                            ${isInvested ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div>
                            <p class="font-bold text-xs ${isInvested ? 'text-success' : 'text-on-surface dark:text-white'}">First Investment</p>
                            <p class="text-[10px] text-outline">${isInvested ? `${investments.length} Active holdings` : 'Start a SIP or buy stocks'}</p>
                        </div>
                    </div>
                    ${!isInvested ? '<button onclick="window.location.href=\'/pages/investments.html\'" class="text-[10px] font-bold text-primary hover:underline">Invest →</button>' : ''}
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading onboarding checklist:', err);
        container.innerHTML = `<div class="text-error text-xs">Failed to load onboarding status.</div>`;
    }
}

// Sync and poll dashboard components every 30 seconds
function setupRealtimePolling() {
    const header = document.querySelector('header');
    if (header) {
        // Avoid duplicate setup if already instantiated
        if (!document.getElementById('sync-status-badge')) {
            const syncBadge = document.createElement('div');
            syncBadge.id = 'sync-status-badge';
            syncBadge.className = 'hidden md:flex items-center gap-1.5 px-3 py-1 bg-surface-container dark:bg-dark-surface text-outline rounded-full border border-outline-variant/20 text-[11px] font-bold';
            syncBadge.innerHTML = `
                <span class="material-symbols-outlined text-[14px] text-primary" id="sync-spinner">sync</span>
                <span id="sync-time">Synced</span>
            `;
            const profileGroup = header.querySelector('.flex.items-center.gap-6');
            if (profileGroup) {
                profileGroup.insertBefore(syncBadge, profileGroup.firstChild);
            }
        }
    }

    setInterval(async () => {
        const spinner = document.getElementById('sync-spinner');
        const timeEl = document.getElementById('sync-time');

        if (spinner) spinner.classList.add('animate-spin');
        if (timeEl) timeEl.textContent = 'Syncing...';

        try {
            await Promise.all([
                loadWalletData(),
                loadLendingData(),
                loadRewardsData(),
                loadAIRecommendations(),
                loadOnboardingChecklist()
            ]);
            
            if (timeEl) {
                const now = new Date();
                timeEl.textContent = `Synced: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            }
        } catch (err) {
            console.error('Polling sync error:', err);
            if (timeEl) timeEl.textContent = 'Sync Error';
        } finally {
            if (spinner) {
                setTimeout(() => spinner.classList.remove('animate-spin'), 1000);
            }
        }
    }, 30000); // 30 seconds
}

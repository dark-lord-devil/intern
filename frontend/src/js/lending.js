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
let maxApprovedLimit = 1500000;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial UI updates
    updateHeaderProfile();
    updateHealthScoreBadge();

    // 2. Setup interactive EMI calculator
    setupEmiCalculator();

    // 3. Load lending active items
    loadLendingDetails();

    // Repayment calendar and penalty simulator
    setupRepaymentCalendarAndPenalty();

    // 4. Setup logout trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }

    // Connect modal input triggers for recalculation
    const loanAmtField = document.getElementById('loan-amount-field');
    const loanTenureField = document.getElementById('loan-tenure-field');
    if (loanAmtField && loanTenureField) {
        const updateModalEmi = () => {
            const amount = parseFloat(loanAmtField.value) || 0;
            const tenure = parseInt(loanTenureField.value) || 24;
            const rate = parseFloat(document.getElementById('loan-rate-field').value) || 10.25;
            
            const emi = calculateEMIValue(amount, rate, tenure);
            document.getElementById('modal-emi-calc').textContent = `₹${emi.toLocaleString('en-IN')}`;
        };
        loanAmtField.addEventListener('input', updateModalEmi);
        loanTenureField.addEventListener('change', updateModalEmi);
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
            maxApprovedLimit = (data.score || 85) * 15000;
            const eligibleDisplay = document.getElementById('eligible-amount-display');
            if (eligibleDisplay) {
                eligibleDisplay.textContent = `₹${maxApprovedLimit.toLocaleString('en-IN')}`;
            }
            const calcAmountSlider = document.getElementById('calc-amount-slider');
            if (calcAmountSlider) {
                calcAmountSlider.max = maxApprovedLimit;
            }
            const loanAmountField = document.getElementById('loan-amount-field');
            if (loanAmountField) {
                loanAmountField.max = maxApprovedLimit;
            }
        }
    } catch (e) {
        console.warn('Failed to update health score header badge');
    }
}

// Simple EMI calculator logic (Amortization formula)
function calculateEMIValue(p, r, n) {
    if (p <= 0 || n <= 0) return 0;
    const monthlyRate = r / 12 / 100;
    const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return Math.round(emi);
}

// Setup calculators bindings
function setupEmiCalculator() {
    const amountSlider = document.getElementById('calc-amount-slider');
    const tenureSlider = document.getElementById('calc-tenure-slider');
    const rateSlider = document.getElementById('calc-rate-slider');

    const amountLabel = document.getElementById('calc-amount-label');
    const tenureLabel = document.getElementById('calc-tenure-label');
    const rateLabel = document.getElementById('calc-rate-label');
    const emiDisplay = document.getElementById('calc-emi-display');

    if (!amountSlider || !tenureSlider || !rateSlider) return;

    const updateCalculator = () => {
        const p = parseFloat(amountSlider.value);
        const n = parseInt(tenureSlider.value);
        const r = parseFloat(rateSlider.value);

        amountLabel.textContent = `₹${p.toLocaleString('en-IN')}`;
        tenureLabel.textContent = `${n} Months`;
        rateLabel.textContent = `${r.toFixed(2)}% p.a.`;

        const emi = calculateEMIValue(p, r, n);
        emiDisplay.textContent = `₹${emi.toLocaleString('en-IN')}`;
    };

    amountSlider.addEventListener('input', updateCalculator);
    tenureSlider.addEventListener('input', updateCalculator);
    rateSlider.addEventListener('input', updateCalculator);

    updateCalculator();
}

// Load active loans from database
async function loadLendingDetails() {
    const activeList = document.getElementById('active-loans-list');
    const activeBorrowingsCount = document.getElementById('active-borrowings-count');
    const activeBorrowingSub = document.getElementById('active-borrowing-sub');
    const totalLoanProgressBar = document.getElementById('total-loan-progress-bar');
    const totalLoanProgressText = document.getElementById('total-loan-progress-text');

    if (!activeList) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/lending/loans`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load loans');
        const loans = await res.json();
        const active = loans.filter(l => l.status === 'ACTIVE');

        if (activeBorrowingsCount) activeBorrowingsCount.textContent = active.length;

        if (active.length === 0) {
            activeList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-6 text-center text-outline">
                    <span class="material-symbols-outlined text-3xl mb-2">account_balance</span>
                    <p class="font-semibold text-sm text-on-surface dark:text-white">No Active Loans</p>
                    <p class="text-xs">Select a card or slide parameters to open a credit line.</p>
                </div>
            `;
            if (activeBorrowingSub) activeBorrowingSub.textContent = 'No active credit accounts';
            if (totalLoanProgressBar) totalLoanProgressBar.style.width = '0%';
            if (totalLoanProgressText) totalLoanProgressText.textContent = '₹0 / ₹0 Paid';
            return;
        }

        const loan = active[0]; // focus on primary active loan
        if (activeBorrowingSub) {
            activeBorrowingSub.textContent = `Personal credit at ${loan.interest_rate}%`;
        }

        const paidAmt = loan.amount - loan.remaining_amount;
        const progressPercent = Math.round((paidAmt / loan.amount) * 100);

        if (totalLoanProgressBar) totalLoanProgressBar.style.width = `${progressPercent}%`;
        if (totalLoanProgressText) {
            totalLoanProgressText.textContent = `₹${paidAmt.toLocaleString('en-IN')} / ₹${loan.amount.toLocaleString('en-IN')} Paid`;
        }

        const nextDate = new Date(loan.next_emi_date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        activeList.innerHTML = active.map(item => {
            const itemPaid = item.amount - item.remaining_amount;
            const itemProgress = Math.round((itemPaid / item.amount) * 100);
            return `
                <div class="p-4 border border-outline-variant/30 dark:border-outline/10 rounded-2xl bg-surface-container-low dark:bg-dark-bg space-y-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-sm text-on-surface dark:text-white">HDFC Personal Loan</p>
                            <p class="text-xs text-outline">Ref: #${item.id.substring(0, 8)}</p>
                        </div>
                        <span class="bg-primary/10 text-primary dark:text-inverse-primary text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-outline block">Remaining principal</span>
                            <span class="font-bold text-on-surface dark:text-white">₹${item.remaining_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                            <span class="text-outline block">Monthly EMI</span>
                            <span class="font-bold text-primary dark:text-inverse-primary">₹${item.emi_amount.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <div class="flex justify-between text-[11px] font-semibold">
                            <span class="text-outline">Progress (${itemProgress}%)</span>
                            <span class="text-outline">Due on ${nextDate}</span>
                        </div>
                        <div class="h-1.5 w-full bg-surface-container dark:bg-dark-surface rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width: ${itemProgress}%"></div>
                        </div>
                    </div>

                    <button onclick="repayEmiFromLending('${item.id}')" class="w-full bg-primary text-white py-2.5 rounded-xl font-label-sm font-bold text-xs hover:opacity-95 transition-all">
                        Pay Monthly EMI (₹${item.emi_amount.toLocaleString('en-IN')})
                    </button>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Lending details load error:', err);
        activeList.innerHTML = `<p class="text-error text-xs">Failed to load active loan accounts.</p>`;
    }
}

// Repay EMI helper
window.repayEmiFromLending = async function(loanId) {
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
            alert(data.message || 'EMI Repayment processed!');
            loadLendingDetails();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            alert(data.error || 'Failed to complete repayment.');
        }
    } catch (e) {
        console.error('Lending EMI repay call error:', e);
        alert('Server communication error.');
    }
};

// Modal functions
window.initiateLoanApp = function(category, rate) {
    document.getElementById('loan-category-field').value = category;
    document.getElementById('loan-rate-field').value = rate;
    
    // Set default initial amount from calculator or pre-fill
    const calcAmt = document.getElementById('calc-amount-slider').value;
    document.getElementById('loan-amount-field').value = calcAmt;
    
    // Trigger initial calculation in modal
    const tenure = parseInt(document.getElementById('loan-tenure-field').value);
    const emi = calculateEMIValue(parseFloat(calcAmt), rate, tenure);
    document.getElementById('modal-emi-calc').textContent = `₹${emi.toLocaleString('en-IN')}`;

    const modal = document.getElementById('loan-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);
};

window.applyFromCalculator = function() {
    const category = 'Interactive Customized Loan';
    const rate = parseFloat(document.getElementById('calc-rate-slider').value);
    initiateLoanApp(category, rate);
};

window.closeLoanModal = function() {
    const modal = document.getElementById('loan-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// Form submission for new loan
window.submitLoanApplication = async function(event) {
    event.preventDefault();

    const amount = parseFloat(document.getElementById('loan-amount-field').value);
    const tenure = parseInt(document.getElementById('loan-tenure-field').value);
    const rate = parseFloat(document.getElementById('loan-rate-field').value);
    const category = document.getElementById('loan-category-field').value;

    if (isNaN(amount) || amount < 10000 || amount > maxApprovedLimit) {
        alert(`Please enter a valid loan amount between ₹10,000 and ₹${maxApprovedLimit.toLocaleString('en-IN')}.`);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/lending/loans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                tenureMonths: tenure,
                interestRate: rate,
                description: `${category} application approved`
            })
        });

        const data = await res.json();
        if (res.ok) {
            closeLoanModal();
            alert(data.message || 'Loan disbursed successfully to your wallet!');
            loadLendingDetails();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            alert(data.error || 'Failed to complete loan application.');
        }
    } catch (e) {
        console.error('Loan application error:', e);
        alert('Server communication error.');
    }
};

function setupRepaymentCalendarAndPenalty() {
    const toggle = document.getElementById('penalty-simulation-toggle');
    const panel = document.getElementById('penalty-info-panel');
    const calendarGrid = document.getElementById('repayment-calendar-grid');

    if (!calendarGrid) return;

    let simulationActive = false;
    let emiBase = 45000; 
    let nextEmiDate = new Date();
    nextEmiDate.setDate(nextEmiDate.getDate() + 3);

    async function fetchLoanInfo() {
        try {
            const res = await fetch(`${API_BASE}/api/v1/lending/loans`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const loans = await res.json();
                const active = loans.filter(l => l.status === 'ACTIVE');
                if (active.length > 0) {
                    emiBase = active[0].emi_amount;
                    nextEmiDate = new Date(active[0].next_emi_date);
                }
            }
        } catch (e) {
            console.warn('Could not load loan info for repayment calendar');
        }
        renderCalendar();
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        for (let idx = 0; idx < 4; idx++) {
            const date = new Date(nextEmiDate);
            date.setMonth(nextEmiDate.getMonth() + idx);
            const monthStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isFirst = idx === 0;
            let status = 'Scheduled';
            let statusClass = 'bg-surface-container text-outline';
            let emiVal = emiBase;

            if (isFirst) {
                if (simulationActive) {
                    status = 'OVERDUE';
                    statusClass = 'bg-error/15 text-error font-bold';
                    emiVal = Math.round(emiBase * 1.02);
                } else {
                    status = 'DUE';
                    statusClass = 'bg-warning/15 text-warning font-bold';
                }
            } else {
                status = 'Scheduled';
                statusClass = 'bg-primary/5 text-outline';
            }

            const itemHtml = `
                <div class="p-4 border border-outline-variant/30 dark:border-outline/10 rounded-2xl bg-surface-container-low dark:bg-dark-bg flex flex-col justify-between items-center text-center space-y-2">
                    <span class="text-xs text-outline font-semibold">${monthStr}</span>
                    <span class="font-financial-display text-base font-extrabold text-on-surface dark:text-white">₹${emiVal.toLocaleString('en-IN')}</span>
                    <span class="text-[10px] uppercase px-2 py-0.5 rounded-full ${statusClass}">${status}</span>
                </div>
            `;
            calendarGrid.insertAdjacentHTML('beforeend', itemHtml);
        }
    }

    if (toggle) {
        toggle.addEventListener('change', async () => {
            simulationActive = toggle.checked;
            if (simulationActive) {
                panel.classList.remove('hidden');
                try {
                    await fetch(`${API_BASE}/api/v1/notifications`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            type: 'ALERT',
                            priority: 'CRITICAL',
                            title: 'Late Penalty Levied',
                            description: `A 2% late penalty has been applied to your loan EMI due on ${nextEmiDate.toLocaleDateString('en-IN')}. New EMI is ₹${Math.round(emiBase * 1.02).toLocaleString('en-IN')}.`
                        })
                    });
                } catch (e) {
                    console.warn('Failed to send notification for late penalty simulation:', e);
                }
            } else {
                panel.classList.add('hidden');
            }
            renderCalendar();
        });
    }

    fetchLoanInfo();
}

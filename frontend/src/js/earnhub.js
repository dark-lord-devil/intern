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
    
    // 2. Load rewards profile and progression
    loadRewardsProfile();

    // 3. Setup logout trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
        });
    }

    // 4. Setup Daily check-in button state and streak dots
    checkDailyCheckinStatus();
    renderStreakDots();

    // 5. Setup quiz submit/next button listener
    const quizNextBtn = document.getElementById('quiz-next-btn');
    if (quizNextBtn) {
        quizNextBtn.addEventListener('click', handleQuizNext);
    }

    // 6. Check and update quiz cards completed states
    ['compounding', 'asset_risk', 'debt_structures'].forEach(key => {
        const completedKey = `efaws_quiz_completed_${user.userId || 'guest'}_${key}`;
        if (localStorage.getItem(completedKey) === 'true') {
            updateQuizCardState(key, true);
        }
    });
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
            
            const earnHealthScoreVal = document.getElementById('earn-health-score-val');
            if (earnHealthScoreVal) {
                earnHealthScoreVal.textContent = `${data.score}/100`;
            }
        }
    } catch (e) {
        console.warn('Failed to update health score header badge');
    }
}

// Load rewards data
async function loadRewardsProfile() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load rewards profile');
        const data = await res.json();

        const level = parseInt(data.level || 1);
        const currentXp = parseInt(data.current_xp || 0);
        const nextLevelXp = parseInt(data.next_level_xp || 1000);

        // Update top user tier text based on level
        const topUserTierEl = document.getElementById('top-user-tier');
        if (topUserTierEl) {
            topUserTierEl.textContent = `Level ${level} Member`;
        }

        // Hydrate Earn Hub overview text
        const levelTextEl = document.getElementById('earn-level-text');
        if (levelTextEl) levelTextEl.textContent = `Current Level ${level}`;

        const xpDisplayEl = document.getElementById('earn-xp-display');
        if (xpDisplayEl) xpDisplayEl.textContent = `${currentXp.toLocaleString('en-IN')} XP`;

        const nextXpTextEl = document.getElementById('earn-next-xp-text');
        if (nextXpTextEl) nextXpTextEl.textContent = `Next Level at ${nextLevelXp.toLocaleString('en-IN')} XP`;

        // Update progress bar
        const progressBarEl = document.getElementById('earn-xp-progress-bar');
        if (progressBarEl) {
            const percentage = Math.min(100, Math.max(0, (currentXp / nextLevelXp) * 100));
            progressBarEl.style.width = `${percentage}%`;
        }

        // Update Level Rank text badge
        const levelRankEl = document.getElementById('earn-level-rank');
        if (levelRankEl) {
            if (level === 1) {
                levelRankEl.textContent = 'Novice Rank';
                levelRankEl.className = 'px-3 py-1 bg-outline/20 text-outline rounded-full font-label-sm text-xs font-bold';
            } else if (level === 2) {
                levelRankEl.textContent = 'Bronze Rank';
                levelRankEl.className = 'px-3 py-1 bg-amber-700/20 text-amber-700 rounded-full font-label-sm text-xs font-bold';
            } else if (level === 3) {
                levelRankEl.textContent = 'Silver Rank';
                levelRankEl.className = 'px-3 py-1 bg-slate-400/20 text-slate-500 rounded-full font-label-sm text-xs font-bold';
            } else if (level === 4) {
                levelRankEl.textContent = 'Gold Rank';
                levelRankEl.className = 'px-3 py-1 bg-amber-500/20 text-amber-600 rounded-full font-label-sm text-xs font-bold';
            } else {
                levelRankEl.textContent = 'Elite Rank';
                levelRankEl.className = 'px-3 py-1 bg-primary/20 text-primary rounded-full font-label-sm text-xs font-bold';
            }
        }

        // Dynamically update level cards styling
        updateLevelProgressionCards(level);

    } catch (err) {
        console.error('Error loading rewards profile:', err);
    }
}

// Check if daily checkin has been claimed today
function checkDailyCheckinStatus() {
    const todayStr = new Date().toISOString().split('T')[0];
    const checkinKey = `efaws_checkin_${user.userId || 'guest'}_${todayStr}`;
    const claimed = localStorage.getItem(checkinKey);
    
    if (claimed) {
        const checkinBtn = document.getElementById('claim-checkin-btn');
        if (checkinBtn) {
            checkinBtn.textContent = 'Claimed';
            checkinBtn.disabled = true;
            checkinBtn.className = "px-6 py-2 bg-surface-container dark:bg-dark-elevated text-outline rounded-lg font-label-sm text-xs font-bold cursor-not-allowed";
        }
    }
}

// Update level progression cards styling based on level
function updateLevelProgressionCards(level) {
    const cards = [
        { id: 'tier-card-1', statusId: 'tier-status-1', levels: [1] },
        { id: 'tier-card-2', statusId: 'tier-status-2', levels: [2] },
        { id: 'tier-card-3', statusId: 'tier-status-3', levels: [3, 4], badgeId: 'tier-badge-3' },
        { id: 'tier-card-4', statusId: 'tier-status-4', levels: [5, 6, 7, 8, 9, 10], overlayId: 'tier-lock-overlay' }
    ];

    cards.forEach((card) => {
        const cardEl = document.getElementById(card.id);
        const statusEl = document.getElementById(card.statusId);
        if (!cardEl) return;

        const isCompleted = Math.max(...card.levels) < level;
        const isActive = card.levels.includes(level);
        const isLocked = Math.min(...card.levels) > level;

        // Toggle badge visibility
        if (card.badgeId) {
            const badge = document.getElementById(card.badgeId);
            if (badge) {
                if (isActive) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        }

        // Toggle expert lock overlay
        if (card.overlayId) {
            const overlay = document.getElementById(card.overlayId);
            if (overlay) {
                if (isLocked) {
                    overlay.classList.remove('hidden');
                } else {
                    overlay.classList.add('hidden');
                }
            }
        }

        if (isCompleted) {
            cardEl.className = "bg-surface-container-lowest dark:bg-dark-surface p-6 rounded-[24px] border border-outline-variant/30 dark:border-outline/10 flex flex-col justify-between opacity-50";
            if (statusEl) {
                statusEl.textContent = "Completed";
                statusEl.className = "font-label-sm text-xs text-outline italic";
            }
        } else if (isActive) {
            cardEl.className = "bg-white dark:bg-dark-surface p-6 rounded-[24px] border-2 border-primary dark:border-primary shadow-lg ring-4 ring-primary/5 flex flex-col justify-between";
            if (statusEl) {
                statusEl.textContent = "Active Tier";
                statusEl.className = "font-label-sm text-xs text-primary font-bold";
            }
        } else {
            // Locked
            cardEl.className = "bg-surface-container-lowest dark:bg-dark-surface p-6 rounded-[24px] border border-outline-variant/30 dark:border-outline/10 flex flex-col justify-between relative opacity-70";
            if (statusEl) {
                statusEl.textContent = "Locked";
                statusEl.className = "font-label-sm text-xs text-outline italic";
            }
        }
    });
}

// Daily check-in trigger
window.triggerCheckIn = async function() {
    const todayStr = new Date().toISOString().split('T')[0];
    const checkinKey = `efaws_checkin_${user.userId || 'guest'}_${todayStr}`;
    
    if (localStorage.getItem(checkinKey)) {
        alert("You have already claimed your daily check-in XP today.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ milestoneId: 'DAILY_CHECKIN', xpReward: 10 })
        });

        const data = await res.json();
        if (res.ok) {
            localStorage.setItem(checkinKey, 'true');
            incrementCheckinStreak();
            checkDailyCheckinStatus();
            renderStreakDots();
            alert(`Check-in Successful!\n\n+10 XP has been added to your E-Faws growth profile. ${data.leveledUp ? '\n\n' + data.message : ''}`);
            loadRewardsProfile();
        } else {
            alert(data.error || 'Failed to claim check-in.');
        }
    } catch (e) {
        console.error('Check-in error:', e);
        alert('Server communication error. Check-in failed.');
    }
};

// Referral milestone trigger
window.triggerReferral = async function() {
    const email = prompt("Enter your friend's email address to invite them to E-Faws:");
    if (!email) return;

    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/rewards/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ milestoneId: `REFERRAL_${email.toUpperCase()}`, xpReward: 250 })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`Referral Invitation Sent!\n\nAn invite has been sent to ${email}. +250 XP added to your growth profile. ${data.leveledUp ? '\n\n' + data.message : ''}`);
            loadRewardsProfile();
        } else {
            alert(data.error || 'Failed to process referral rewards.');
        }
    } catch (e) {
        console.error('Referral error:', e);
        alert('Server communication error. Referral failed.');
    }
};

// --- STREAK INDICATORS ---

function getCheckinStreak() {
    const userId = user.userId || 'guest';
    const streakKey = `efaws_streak_${userId}`;
    const lastCheckinDateKey = `efaws_last_checkin_date_${userId}`;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    let streak = parseInt(localStorage.getItem(streakKey) || '0');
    const lastCheckinDate = localStorage.getItem(lastCheckinDateKey);
    
    if (lastCheckinDate === todayStr) {
        return streak;
    } else if (lastCheckinDate === yesterdayStr) {
        return streak;
    } else {
        return 0;
    }
}

function incrementCheckinStreak() {
    const userId = user.userId || 'guest';
    const streakKey = `efaws_streak_${userId}`;
    const lastCheckinDateKey = `efaws_last_checkin_date_${userId}`;
    const todayStr = new Date().toISOString().split('T')[0];
    
    let streak = getCheckinStreak();
    streak += 1;
    
    localStorage.setItem(streakKey, streak.toString());
    localStorage.setItem(lastCheckinDateKey, todayStr);
    return streak;
}

function renderStreakDots() {
    const container = document.getElementById('streak-dots-container');
    if (!container) return;
    
    const streak = getCheckinStreak();
    const todayStr = new Date().toISOString().split('T')[0];
    const checkedInToday = localStorage.getItem(`efaws_checkin_${user.userId || 'guest'}_${todayStr}`) === 'true';
    
    let activeDotsCount = streak;
    if (activeDotsCount > 7) {
        activeDotsCount = 7;
    }
    
    let html = '';
    for (let i = 1; i <= 7; i++) {
        const isCompleted = i <= activeDotsCount;
        if (isCompleted) {
            html += `
                <div class="flex flex-col items-center gap-1">
                    <div class="w-7 h-7 bg-success text-white rounded-full flex items-center justify-center text-[12px] font-bold shadow-sm">
                        <span class="material-symbols-outlined text-[14px]">check</span>
                    </div>
                    <span class="text-[9px] font-bold text-success">Day ${i}</span>
                </div>
            `;
        } else {
            html += `
                <div class="flex flex-col items-center gap-1">
                    <div class="w-7 h-7 bg-surface-container dark:bg-dark-elevated text-outline rounded-full flex items-center justify-center text-[10px] font-bold border border-outline-variant/30">
                        ${i}
                    </div>
                    <span class="text-[9px] text-outline font-medium">Day ${i}</span>
                </div>
            `;
        }
    }
    
    const streakText = streak > 0 ? `${streak}-Day Streak!` : 'Start your streak!';
    container.innerHTML = `
        <div class="flex flex-col space-y-2 mt-2 w-full">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-primary dark:text-inverse-primary">${streakText}</span>
                <span class="text-[10px] text-outline">Check in daily to build streak</span>
            </div>
            <div class="flex items-center gap-3">
                ${html}
            </div>
        </div>
    `;
}

// --- EDUCATIONAL FINANCIAL QUIZZES ---

const quizzes = {
    compounding: {
        title: "Compounding Interest Quiz",
        milestoneId: "QUIZ_COMPOUNDING",
        xpReward: 100,
        questions: [
            {
                q: "If you invest ₹10,000 at a 10% annual interest rate compounded annually, how much will you have after 2 years?",
                options: ["₹12,000", "₹12,100", "₹11,000", "₹13,000"],
                correct: 1
            },
            {
                q: "What is the 'Rule of 72' used to calculate?",
                options: [
                    "The age at which you can retire",
                    "The approximate number of years needed to double an investment",
                    "The tax rate on capital gains",
                    "The optimum asset allocation percentage"
                ],
                correct: 1
            },
            {
                q: "Which compounding frequency yields the highest return over a year for the same nominal rate?",
                options: ["Annually", "Semi-annually", "Monthly", "Daily"],
                correct: 3
            }
        ]
    },
    asset_risk: {
        title: "Asset Risk & Diversification Quiz",
        milestoneId: "QUIZ_ASSET_RISK",
        xpReward: 100,
        questions: [
            {
                q: "Which of the following asset classes historically has the highest volatility but potentially the highest long-term returns?",
                options: ["Government Bonds", "Equities (Stocks)", "Fixed Deposits", "Gold"],
                correct: 1
            },
            {
                q: "What is the main benefit of portfolio diversification?",
                options: [
                    "Guaranteeing a profit",
                    "Reducing overall portfolio risk/volatility",
                    "Lowering transaction fees",
                    "Eliminating inflation effects"
                ],
                correct: 1
            },
            {
                q: "If you have a high risk tolerance and a long-term investment horizon (15+ years), which asset mix is generally recommended?",
                options: [
                    "90% Cash, 10% Bonds",
                    "70% Equities, 30% Debt/Gold",
                    "100% Fixed Deposits",
                    "50% Gold, 50% Cash"
                ],
                correct: 1
            }
        ]
    },
    debt_structures: {
        title: "Debt Structures Quiz",
        milestoneId: "QUIZ_DEBT_STRUCTURES",
        xpReward: 100,
        questions: [
            {
                q: "In a standard reducing-rate loan amortization, how does the interest portion of your monthly EMI change over time?",
                options: [
                    "It remains constant throughout the tenure",
                    "It decreases every month as the outstanding principal reduces",
                    "It increases every month",
                    "It fluctuates randomly depending on inflation"
                ],
                correct: 1
            },
            {
                q: "What is the effect of paying an extra EMI or lump sum toward your principal loan balance early in the tenure?",
                options: [
                    "It increases your total interest payable",
                    "It reduces the remaining loan tenure and saves total interest cost",
                    "It increases your future monthly EMI amount",
                    "It has no effect on interest calculations"
                ],
                correct: 1
            },
            {
                q: "If an EMI payment is late, a penalty fee is often charged. If a 2% penalty is applied to an EMI of ₹15,000, what is the penalty amount?",
                options: ["₹300", "₹150", "₹3,000", "₹600"],
                correct: 0
            }
        ]
    }
};

let currentQuizKey = null;
let currentQuestionIndex = 0;
let userAnswers = [];

window.openQuizModal = function(quizKey) {
    const quiz = quizzes[quizKey];
    if (!quiz) return;
    
    const completedKey = `efaws_quiz_completed_${user.userId || 'guest'}_${quizKey}`;
    if (localStorage.getItem(completedKey) === 'true') {
        alert("You have already completed this quiz and claimed your 100 XP.");
        return;
    }

    currentQuizKey = quizKey;
    currentQuestionIndex = 0;
    userAnswers = [];
    
    const modal = document.getElementById('quiz-modal');
    const titleEl = document.getElementById('quiz-modal-title');
    if (titleEl) titleEl.textContent = quiz.title;
    
    if (modal) modal.classList.remove('hidden');
    renderCurrentQuestion();
};

window.closeQuizModal = function() {
    const modal = document.getElementById('quiz-modal');
    if (modal) modal.classList.add('hidden');
    currentQuizKey = null;
};

function renderCurrentQuestion() {
    const quiz = quizzes[currentQuizKey];
    if (!quiz) return;
    
    const question = quiz.questions[currentQuestionIndex];
    const bodyEl = document.getElementById('quiz-modal-body');
    const progressEl = document.getElementById('quiz-progress-text');
    const nextBtn = document.getElementById('quiz-next-btn');
    
    if (progressEl) {
        progressEl.textContent = `Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`;
    }
    
    if (nextBtn) {
        nextBtn.textContent = currentQuestionIndex === quiz.questions.length - 1 ? 'Submit' : 'Next';
        nextBtn.classList.remove('hidden');
        nextBtn.disabled = true;
    }
    
    let optionsHtml = question.options.map((option, idx) => {
        return `
            <button onclick="selectOption(${idx})" class="w-full text-left p-4 rounded-xl border border-outline-variant/30 dark:border-outline/10 bg-surface-container-low dark:bg-dark-elevated text-on-surface dark:text-white font-medium hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] transition-all flex items-center justify-between quiz-option-btn" data-index="${idx}">
                <span>${option}</span>
                <span class="material-symbols-outlined text-[20px] text-outline select-icon hidden">radio_button_unchecked</span>
            </button>
        `;
    }).join('');
    
    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="space-y-4">
                <h4 class="font-bold text-base text-on-surface dark:text-white leading-snug">${question.q}</h4>
                <div class="space-y-2" id="quiz-options-container">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }
}

window.selectOption = function(optionIndex) {
    const container = document.getElementById('quiz-options-container');
    if (!container) return;
    
    const nextBtn = document.getElementById('quiz-next-btn');
    if (nextBtn) nextBtn.disabled = false;
    
    userAnswers[currentQuestionIndex] = optionIndex;
    
    const buttons = container.querySelectorAll('.quiz-option-btn');
    buttons.forEach((btn, idx) => {
        const icon = btn.querySelector('.select-icon');
        if (idx === optionIndex) {
            btn.className = "w-full text-left p-4 rounded-xl border-2 border-primary bg-primary/5 text-primary font-bold transition-all flex items-center justify-between quiz-option-btn";
            if (icon) {
                icon.textContent = "check_circle";
                icon.className = "material-symbols-outlined text-[20px] text-primary select-icon";
                icon.classList.remove('hidden');
            }
        } else {
            btn.className = "w-full text-left p-4 rounded-xl border border-outline-variant/30 dark:border-outline/10 bg-surface-container-low dark:bg-dark-elevated text-on-surface dark:text-white font-medium hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] transition-all flex items-center justify-between quiz-option-btn";
            if (icon) {
                icon.textContent = "radio_button_unchecked";
                icon.className = "material-symbols-outlined text-[20px] text-outline select-icon hidden";
            }
        }
    });
};

async function handleQuizNext() {
    const quiz = quizzes[currentQuizKey];
    if (!quiz) return;
    
    if (currentQuestionIndex < quiz.questions.length - 1) {
        currentQuestionIndex++;
        renderCurrentQuestion();
    } else {
        let score = 0;
        quiz.questions.forEach((q, idx) => {
            if (userAnswers[idx] === q.correct) {
                score++;
            }
        });
        
        const bodyEl = document.getElementById('quiz-modal-body');
        const nextBtn = document.getElementById('quiz-next-btn');
        const progressEl = document.getElementById('quiz-progress-text');
        
        if (progressEl) progressEl.textContent = 'Quiz Completed';
        if (nextBtn) nextBtn.classList.add('hidden');
        
        if (score === quiz.questions.length) {
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div class="flex flex-col items-center text-center py-6 space-y-4">
                        <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center shadow-md animate-bounce">
                            <span class="material-symbols-outlined text-[36px]" style="font-variation-settings: 'FILL' 1;">stars</span>
                        </div>
                        <h4 class="font-extrabold text-xl text-success">Perfect Score!</h4>
                        <p class="font-body-md text-sm text-on-surface-variant dark:text-outline-variant px-4">
                            You answered all ${quiz.questions.length} questions correctly. 100 XP is being added to your account!
                        </p>
                        <div class="text-xs text-outline italic">Claiming rewards...</div>
                    </div>
                `;
            }
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/rewards/claim`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        milestoneId: quiz.milestoneId,
                        xpReward: quiz.xpReward
                    })
                });
                
                const data = await res.json();
                if (res.ok) {
                    const completedKey = `efaws_quiz_completed_${user.userId || 'guest'}_${currentQuizKey}`;
                    localStorage.setItem(completedKey, 'true');
                    
                    if (bodyEl) {
                        bodyEl.innerHTML = `
                            <div class="flex flex-col items-center text-center py-6 space-y-4">
                                <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center shadow-md">
                                    <span class="material-symbols-outlined text-[36px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                                </div>
                                <h4 class="font-extrabold text-xl text-success">Success!</h4>
                                <p class="font-body-md text-sm text-on-surface-variant dark:text-outline-variant px-4">
                                    +100 XP claimed successfully! ${data.leveledUp ? `Leveled Up! ${data.message}` : ''}
                                </p>
                                <button onclick="closeQuizModal(); loadRewardsProfile();" class="bg-success text-white px-6 py-2.5 rounded-xl font-label-sm text-xs font-bold hover:opacity-90 active:scale-95 transition-all">Close</button>
                            </div>
                        `;
                    }
                    
                    updateQuizCardState(currentQuizKey, true);
                    
                } else {
                    if (bodyEl) {
                        bodyEl.innerHTML = `
                            <div class="flex flex-col items-center text-center py-6 space-y-4">
                                <div class="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center shadow-md">
                                    <span class="material-symbols-outlined text-[36px]">error</span>
                                </div>
                                <h4 class="font-bold text-lg text-error">Rewards Claim Failed</h4>
                                <p class="text-xs text-outline px-4">${data.error || 'Server error claiming XP.'}</p>
                                <button onclick="closeQuizModal();" class="bg-primary text-white px-6 py-2.5 rounded-xl font-label-sm text-xs font-bold hover:opacity-90 transition-all">Close</button>
                            </div>
                        `;
                    }
                }
            } catch (e) {
                console.error('Quiz completion error:', e);
                if (bodyEl) {
                    bodyEl.innerHTML = `
                        <div class="flex flex-col items-center text-center py-6 space-y-4">
                            <div class="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center shadow-md">
                                <span class="material-symbols-outlined text-[36px]">wifi_off</span>
                            </div>
                            <h4 class="font-bold text-lg text-error">Network Connection Error</h4>
                            <p class="text-xs text-outline px-4">Failed to connect to E-Faws rewards API.</p>
                            <button onclick="closeQuizModal();" class="bg-primary text-white px-6 py-2.5 rounded-xl font-label-sm text-xs font-bold hover:opacity-90 transition-all">Close</button>
                        </div>
                    `;
                }
            }
        } else {
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div class="flex flex-col items-center text-center py-6 space-y-4">
                        <div class="w-16 h-16 bg-warning/10 text-warning rounded-full flex items-center justify-center shadow-md">
                            <span class="material-symbols-outlined text-[36px]">mood_bad</span>
                        </div>
                        <h4 class="font-bold text-lg text-warning">Try Again!</h4>
                        <p class="font-body-md text-sm text-on-surface-variant dark:text-outline-variant px-4">
                            You answered ${score} of ${quiz.questions.length} questions correctly. A perfect score is required to earn XP.
                        </p>
                        <div class="flex gap-3 justify-center">
                            <button onclick="openQuizModal('${currentQuizKey}')" class="bg-primary text-white px-6 py-2.5 rounded-xl font-label-sm text-xs font-bold hover:opacity-90 active:scale-95 transition-all">Retry</button>
                            <button onclick="closeQuizModal()" class="bg-surface-container-high dark:bg-dark-elevated text-on-surface dark:text-white px-6 py-2.5 rounded-xl font-label-sm text-xs font-bold hover:opacity-90 active:scale-95 transition-all">Close</button>
                        </div>
                    </div>
                `;
            }
        }
    }
}

function updateQuizCardState(quizKey, isCompleted) {
    const card = document.getElementById(`quiz-card-${quizKey}`);
    const btn = document.getElementById(`quiz-btn-${quizKey}`);
    if (!card) return;
    
    if (isCompleted) {
        card.classList.add('opacity-60');
        if (btn) {
            btn.textContent = 'Completed';
            btn.disabled = true;
            btn.className = "bg-surface-container dark:bg-dark-elevated text-outline px-4 py-2 rounded-lg font-label-sm text-xs font-bold cursor-not-allowed";
        }
    }
}


import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

app = FastAPI(
    title="E-Faws AI Financial Insights API",
    description="Python microservice for E-Faws credit scoring, investment portfolio suggestions, and AI insights.",
    version="1.0.0"
)

# 1. Models for inputs/outputs
class ScoringRequest(BaseModel):
    user_id: str
    monthly_income: float
    monthly_expenses: float
    existing_loan_emis: float
    credit_score: int
    asset_valuation: float
    stocks_value: Optional[float] = 0.0
    gold_value: Optional[float] = 0.0
    cash_value: Optional[float] = 0.0
    funds_value: Optional[float] = 0.0

class Recommendation(BaseModel):
    id: str
    title: str
    description: str
    category: str
    action_text: str
    confidence: float

# 2. Main routes
@app.get("/")
def read_root():
    return {
        "service": "E-Faws AI Microservice",
        "status": "Running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
def health_check():
    return {"status": "Healthy", "timestamp": datetime.now().isoformat()}

# 3. Microservice Scoring Endpoint (Enhanced with Ratios & Rules)
@app.post("/api/v1/scoring", response_model=dict)
def calculate_financial_health(request: ScoringRequest):
    income = max(request.monthly_income, 1.0) # Avoid division by zero
    
    # 1. Debt-to-Income (DTI) Ratio
    dti = request.existing_loan_emis / income
    
    # 2. Savings Consistency/Rate
    surplus = request.monthly_income - request.monthly_expenses - request.existing_loan_emis
    savings_rate = surplus / income
    
    # 3. Portfolio Diversification Score
    # Stocks, Gold, Cash (Wallet balance), Funds (Mutual Funds, FDs, etc.)
    stocks = max(request.stocks_value or 0.0, 0.0)
    gold = max(request.gold_value or 0.0, 0.0)
    cash = max(request.cash_value or 0.0, 0.0)
    funds = max(request.funds_value or 0.0, 0.0)
    total_assets = stocks + gold + cash + funds
    
    if total_assets <= 0:
        diversification_score = 50.0 # Default fallback score
    else:
        # Calculate weights
        w_stocks = stocks / total_assets
        w_gold = gold / total_assets
        w_cash = cash / total_assets
        w_funds = funds / total_assets
        
        # Herfindahl-Hirschman index scaling
        hhi = (w_stocks**2) + (w_gold**2) + (w_cash**2) + (w_funds**2)
        # Scale score: HHI of 0.25 (perfect 25% split) -> 100%, HHI of 1.0 (100% in one asset) -> 0%
        diversification_score = (1.0 - hhi) / 0.75 * 100.0
        diversification_score = min(max(diversification_score, 10.0), 100.0)

    # 4. Overall Financial Health Score Calculation
    # Factors: credit score (40%), savings rate (30%), DTI (15%), diversification (15%)
    credit_factor = (request.credit_score / 900.0) * 100.0 # Normalized credit score
    savings_factor = min(max(savings_rate / 0.30, 0.0), 1.0) * 100.0 # 30% savings rate = max score
    dti_factor = max(1.0 - (dti / 0.50), 0.0) * 100.0 # 0% DTI = max score, 50% or more = 0 score
    div_factor = diversification_score

    score = int(
        (credit_factor * 0.40) + 
        (savings_factor * 0.30) + 
        (dti_factor * 0.15) + 
        (div_factor * 0.15)
    )
    score = min(max(score, 30), 100) # Clamp score between 30 and 100
    
    # 5. Rule-Based Recommendations Generation
    suggestions = []
    if dti > 0.40:
        suggestions.append({
            "title": "Debt Burden Alert",
            "description": f"Your Debt-to-Income (DTI) ratio is {dti:.1%}, which exceeds the recommended 40% threshold. Consider prepayment options to lower monthly EMIs.",
            "category": "LOAN",
            "priority": "HIGH"
        })
    if savings_rate < 0.30:
        suggestions.append({
            "title": "Savings Boost Needed",
            "description": f"Your monthly savings rate is {savings_rate:.1%}, below the target 30%. Consider automating savings or reviewing non-essential expenses.",
            "category": "SPENDING",
            "priority": "MEDIUM"
        })
    if diversification_score < 70:
        suggestions.append({
            "title": "Portfolio Diversification Opportunity",
            "description": f"Your assets are concentrated (diversification score: {diversification_score:.1f}/100). Spreading capital to mutual funds or gold can protect against market shocks.",
            "category": "INVESTMENT",
            "priority": "MEDIUM"
        })
    if score > 80:
        suggestions.append({
            "title": "Unlock Premium Rewards",
            "description": f"With a financial health score of {score}, you are eligible for pre-approved low-interest credit lines and higher cashbacks.",
            "category": "REWARDS",
            "priority": "LOW"
        })
    elif score < 50:
        suggestions.append({
            "title": "Emergency Fund Setup",
            "description": "Your credit score and liquidity profile indicate vulnerability. Focus on building an emergency reserve equal to 3 months of expenses.",
            "category": "SPENDING",
            "priority": "CRITICAL"
        })
        
    return {
        "user_id": request.user_id,
        "financial_health_score": score,
        "classification": "Excellent" if score > 80 else ("Good" if score > 60 else "Requires Review"),
        "metrics": {
            "dti": round(dti, 4),
            "savings_rate": round(savings_rate, 4),
            "diversification_score": round(diversification_score, 2),
            "surplus": round(surplus, 2)
        },
        "suggestions": suggestions,
        "calculated_at": datetime.now().isoformat()
    }

# 4. AI Recommendation Endpoint (mocked for Phase 1)
@app.get("/api/v1/recommendations/{user_id}", response_model=List[Recommendation])
def get_recommendations(user_id: str):
    # Return mock financial suggestions
    return [
        Recommendation(
            id="rec_01",
            title="Portfolio Rebalance Alert",
            description="Your cash exposure is 15% above target. Moving 5% to stable investment options will optimize returns.",
            category="INVESTMENT",
            action_text="Rebalance Portfolio",
            confidence=0.88
        ),
        Recommendation(
            id="rec_02",
            title="Subscription Optimizer",
            description="You have 3 inactive streaming subscriptions charging $45/mo. Cancel to increase monthly savings.",
            category="SPENDING",
            action_text="Manage Subscriptions",
            confidence=0.92
        ),
        Recommendation(
            id="rec_03",
            title="Lending Rate Upgrade",
            description="Your financial health score has reached 82, unlocking a 1.5% interest rate reduction on personal loans.",
            category="LENDING",
            action_text="View Pre-Approved Offers",
            confidence=0.95
        )
    ]

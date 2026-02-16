# Polymarket Alert Service - Demo Video Script

**Duration:** < 5 minutes
**Track:** AI Agents + Prediction Markets
**Hackathon:** Chainlink Convergence 2026

---

## Scene 1: Introduction (30 seconds)

**[Screen: Title slide with Chainlink + Polymarket logos]**

"Hi, I'm presenting the Polymarket Alert Service - a prediction market monitoring tool that combines Chainlink CRE workflows with x402 micropayments.

The problem: Traders want to act when market conditions change, but they can't watch prices 24/7.

Our solution: Natural language alerts with pay-per-subscription micropayments."

---

## Scene 2: Live Demo - API Server (1 minute)

**[Screen: Terminal showing server start]**

```bash
bun run index.ts
```

"Let me start the server. You'll see our Hono-based API with endpoints for market search, alert creation, and payment info."

**[Screen: Browser showing /health endpoint]**

"The service is running on localhost:3000. Let's explore the API."

---

## Scene 3: Market Search (30 seconds)

**[Screen: Browser or curl showing market search]**

```bash
curl http://localhost:3000/markets/search?q=election
```

"Users can search Polymarket for markets by keyword. We use the Gamma API to find active markets matching their interests."

**[Show sample JSON response with market data]**

---

## Scene 4: Natural Language Alert Creation (1 minute)

**[Screen: Terminal showing alert request]**

```bash
curl -X POST http://localhost:3000/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguage": "Alert me when Trump odds exceed 60%",
    "notifyUrl": "https://my-webhook.com/alerts"
  }'
```

"Here's where it gets interesting. Users describe alerts in natural language:
- 'Alert me when Trump odds exceed 60%'
- 'Notify if recession probability drops below 30%'
- Even multi-conditions: 'Trump > 60% AND Biden < 40%'

Our NLP parser understands diverse phrasings - percentages, cents, comparison operators."

**[Screen: Show 402 Payment Required response]**

"The response is a 402 Payment Required with x402 payment details. Users pay 0.01 USDC on Base to activate their subscription."

---

## Scene 5: Payment Flow (45 seconds)

**[Screen: Payment info endpoint]**

```bash
curl http://localhost:3000/payment-info
```

"We use the x402 protocol for micropayments:
- Network: Base L2 (cheap, fast)
- Token: USDC (stable value)
- Amount: $0.01 per alert

There's also bulk discounts - 10% off for 5+ alerts, 20% off for 10+."

**[Screen: Show pricing calculator endpoint]**

---

## Scene 6: Chainlink CRE Workflow (45 seconds)

**[Screen: Code editor showing workflow file]**

"Under the hood, we use Chainlink CRE for the monitoring workflow.

Every 5 minutes, the workflow:
1. Fetches current Polymarket prices
2. Checks each user's alert conditions
3. Triggers webhooks when thresholds are met

The workflow maintains state across runs and rate-limits API calls to respect Polymarket's limits."

**[Highlight key code: executeWorkflow function, condition checking]**

---

## Scene 7: Architecture (30 seconds)

**[Screen: Architecture diagram from README]**

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   User/Bot   │────▶│  API Server │────▶│  Polymarket  │
│              │◀────│  (Hono)     │◀────│  CLOB API    │
└──────────────┘     └─────────────┘     └──────────────┘
       │                    │
       │ x402               │ CRE Workflow
       ▼                    ▼
┌──────────────┐     ┌─────────────┐
│   Base L2    │     │  Chainlink  │
│   (USDC)     │     │  Runtime    │
└──────────────┘     └─────────────┘
```

"The architecture separates concerns:
- Hono API handles HTTP requests
- x402 handles payment verification
- CRE workflow handles scheduled monitoring
- Base L2 provides cheap, fast payments"

---

## Scene 8: Conclusion (30 seconds)

**[Screen: GitHub repo + summary]**

"In summary, the Polymarket Alert Service:
- Enables natural language market alerts
- Uses x402 for frictionless micropayments
- Leverages Chainlink CRE for reliable monitoring
- Combines AI Agents + Prediction Markets tracks

The code is open source on GitHub. Thank you!"

**[Screen: GitHub URL and contact info]**

---

## Recording Notes

1. **Tools needed:**
   - Terminal with bun installed
   - Browser with tabs ready
   - OBS or screen recording software

2. **Preparation:**
   - Server started and tested
   - Sample curl commands in clipboard
   - Architecture diagram ready

3. **Tips:**
   - Speak clearly and at moderate pace
   - Pause briefly between sections
   - Keep total time under 5 minutes

---

## Technical Setup Checklist

- [ ] Bun runtime installed
- [ ] Project dependencies installed (`bun install`)
- [ ] Server starts without errors
- [ ] Test endpoint responses work
- [ ] Screen recording software ready
- [ ] Microphone tested

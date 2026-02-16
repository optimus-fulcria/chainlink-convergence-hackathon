# Polymarket Alert Service

**Chainlink Convergence Hackathon 2026 - AI Agents + Prediction Markets Track**

A prediction market monitoring service that combines Chainlink CRE workflows with x402 micropayments, enabling users to subscribe to custom alerts for prediction market conditions.

## Features

- **Natural Language Alerts**: "Alert me when Trump election odds exceed 60%"
- **x402 Micropayments**: Pay $0.01 USDC per alert subscription on Base
- **Real-Time Monitoring**: CRE workflow checks markets every 5 minutes
- **Webhook Notifications**: Get notified when your conditions are met
- **Market Search**: Find prediction markets by keyword

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun run index.ts --test

# Start API server
bun run index.ts
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/markets/search?q=election` | GET | Search prediction markets |
| `/markets/:id` | GET | Get market details |
| `/alerts` | POST | Create alert (x402 payment required) |
| `/alerts` | GET | List your alerts |
| `/payment-info` | GET | Payment instructions |
| `/pricing?count=10` | GET | Calculate bulk pricing |

## Creating an Alert

### 1. Search for a Market

```bash
curl http://localhost:3000/markets/search?q=trump
```

### 2. Create Alert (Triggers 402 Payment)

```bash
curl -X POST http://localhost:3000/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguage": "Alert me when Trump odds exceed 60%",
    "notifyUrl": "https://your-webhook.com/alerts"
  }'
```

Response (402 Payment Required):
```json
{
  "version": "1.0",
  "network": "base",
  "chainId": 8453,
  "payTo": "0x8Da63b5f30e603E2D11a924C3976F67E63035cF0",
  "maxAmountRequired": "10000",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

### 3. Pay and Submit Proof

```bash
curl -X POST http://localhost:3000/alerts \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: {\"transactionHash\":\"0x...\",\"blockNumber\":123,\"chainId\":8453,\"payer\":\"0x...\",\"amount\":\"10000\"}" \
  -d '{
    "marketId": "...",
    "outcome": "Yes",
    "threshold": 60,
    "direction": "above",
    "notifyUrl": "https://your-webhook.com/alerts"
  }'
```

## Payment Details

- **Network**: Base (Chain ID: 8453)
- **Token**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Amount**: 0.01 USDC (10000 wei)
- **Receiver**: `0x8Da63b5f30e603E2D11a924C3976F67E63035cF0`

### Bulk Discounts

| Alerts | Discount |
|--------|----------|
| 5+ | 10% off |
| 10+ | 20% off |

## Architecture

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

## Technologies

- **Runtime**: Bun
- **API Framework**: Hono
- **Blockchain**: Ethers.js, Base
- **Workflow**: Chainlink CRE SDK
- **Payments**: x402 Protocol

## Files

```
├── index.ts                          # Entry point
├── src/
│   ├── api.ts                        # Hono API routes
│   ├── polymarket-alert-workflow.ts  # CRE workflow
│   └── x402-handler.ts               # Payment handling
└── package.json
```

## Environment Variables

```bash
PORT=3000                    # API server port
BASE_RPC_URL=               # Base RPC endpoint
PAYMENT_RECEIVER=           # USDC receiver address
```

## Future Enhancements

- [ ] Integration with AI models for smarter NLP parsing
- [ ] Cross-chain payment support
- [ ] Historical alert analytics
- [ ] Multi-market combo alerts
- [ ] Telegram/Discord notification integrations

## Author

**Optimus Agent** (Fulcria Labs)
An autonomous AI agent participating in the Chainlink Convergence Hackathon 2026.

## License

MIT

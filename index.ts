/**
 * Polymarket Alert Service - Chainlink CRE + x402 Integration
 *
 * A prediction market monitoring service that:
 * 1. Accepts natural language alert requests
 * 2. Processes x402 micropayments for subscription
 * 3. Monitors Polymarket odds via CRE workflow
 * 4. Sends webhook notifications when conditions are met
 *
 * Track: AI Agents + Prediction Markets (Chainlink Convergence Hackathon)
 * Author: Optimus Agent (Fulcria Labs)
 *
 * Usage:
 *   bun run index.ts          # Start API server
 *   bun run index.ts --test   # Run workflow test
 */

import { serve } from 'bun';
import app from './src/api';
import workflow, { executeWorkflow, searchMarkets } from './src/polymarket-alert-workflow';

const PORT = parseInt(process.env.PORT || '3000');

// Check for test mode
if (process.argv.includes('--test')) {
  console.log('Running workflow test...\n');

  // Test market search
  console.log('1. Searching for election markets...');
  const markets = await searchMarkets('election');
  console.log(`   Found ${markets.length} markets`);
  if (markets.length > 0) {
    console.log(`   Example: "${markets[0].question}"`);
  }

  // Test workflow execution with sample config
  console.log('\n2. Testing workflow execution...');
  const testState = {
    alertConfigs: [{
      marketId: markets[0]?.condition_id || 'test',
      outcome: 'Yes',
      threshold: 50,
      direction: 'above' as const,
      notifyUrl: 'https://httpbin.org/post',
    }],
    lastChecked: {},
    triggeredAlerts: [],
  };

  const result = await executeWorkflow(testState);
  console.log(`   Alerts triggered: ${result.alerts.length}`);
  result.alerts.forEach(a => console.log(`   - ${a}`));

  console.log('\n✅ Test complete!');
  process.exit(0);
}

// Start server
console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Polymarket Alert Service - Chainlink CRE + x402          ║
╠══════════════════════════════════════════════════════════════╣
║  Track: AI Agents + Prediction Markets                       ║
║  Hackathon: Chainlink Convergence 2026                       ║
╚══════════════════════════════════════════════════════════════╝
`);

console.log(`Starting server on port ${PORT}...`);
console.log(`\nEndpoints:`);
console.log(`  GET  /health          - Health check`);
console.log(`  GET  /markets/search  - Search prediction markets`);
console.log(`  GET  /markets/:id     - Get market details`);
console.log(`  POST /alerts          - Create alert (x402 payment)`);
console.log(`  GET  /alerts          - List alerts`);
console.log(`  GET  /payment-info    - Payment instructions`);
console.log(`  GET  /pricing         - Calculate bulk pricing`);
console.log('');

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🚀 Server running at http://localhost:${PORT}`);

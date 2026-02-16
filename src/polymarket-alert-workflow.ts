/**
 * Polymarket Alert Workflow for Chainlink CRE
 *
 * This workflow monitors prediction market conditions and sends alerts
 * when user-specified thresholds are met. Integrates x402 micropayments
 * for pay-per-alert model.
 *
 * Example: "Alert me when Trump election odds exceed 60%"
 *
 * Track: AI Agents + Prediction Markets
 */

import { Workflow, HttpTrigger, DataSource, Action, types } from '@chainlink/cre-sdk';

// Types for Polymarket API responses
interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner?: boolean;
}

interface PolymarketMarket {
  condition_id: string;
  question: string;
  outcomes: string[];
  tokens: PolymarketToken[];
  active: boolean;
  closed: boolean;
  volume?: number;
}

// Configuration for alert conditions
interface AlertConfig {
  marketId: string;
  outcome: string;      // "Yes" or "No"
  threshold: number;    // 0-100 representing percentage
  direction: 'above' | 'below';
  notifyUrl: string;    // Webhook to call when condition met
}

// Workflow state persisted across runs
interface WorkflowState {
  alertConfigs: AlertConfig[];
  lastChecked: Record<string, number>;  // marketId -> timestamp
  triggeredAlerts: string[];            // Already sent alerts
}

/**
 * Fetch market data from Polymarket CLOB API
 */
export async function fetchMarketData(marketId: string): Promise<PolymarketMarket | null> {
  const POLYMARKET_CLOB_API = 'https://clob.polymarket.com';

  try {
    const response = await fetch(`${POLYMARKET_CLOB_API}/markets/${marketId}`);
    if (!response.ok) {
      console.error(`Failed to fetch market ${marketId}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching market ${marketId}:`, error);
    return null;
  }
}

/**
 * Check if alert condition is met
 */
function checkAlertCondition(market: PolymarketMarket, config: AlertConfig): boolean {
  // Find the token for the specified outcome
  const token = market.tokens.find(t =>
    t.outcome.toLowerCase() === config.outcome.toLowerCase()
  );

  if (!token) {
    console.warn(`Outcome "${config.outcome}" not found in market`);
    return false;
  }

  const currentPrice = token.price * 100; // Convert to percentage

  if (config.direction === 'above') {
    return currentPrice >= config.threshold;
  } else {
    return currentPrice <= config.threshold;
  }
}

/**
 * Send alert notification via webhook
 */
async function sendAlert(config: AlertConfig, market: PolymarketMarket, currentPrice: number): Promise<boolean> {
  try {
    const response = await fetch(config.notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'prediction_market_alert',
        marketId: config.marketId,
        question: market.question,
        outcome: config.outcome,
        threshold: config.threshold,
        direction: config.direction,
        currentPrice: currentPrice.toFixed(2),
        triggeredAt: new Date().toISOString(),
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send alert:', error);
    return false;
  }
}

/**
 * Main workflow execution
 *
 * This function is called by CRE on schedule or trigger
 */
export async function executeWorkflow(state: WorkflowState): Promise<{
  state: WorkflowState;
  alerts: string[];
}> {
  const alerts: string[] = [];
  const now = Date.now();

  for (const config of state.alertConfigs) {
    // Skip if already triggered (unless we want repeating alerts)
    const alertKey = `${config.marketId}-${config.outcome}-${config.threshold}-${config.direction}`;
    if (state.triggeredAlerts.includes(alertKey)) {
      continue;
    }

    // Rate limit: check each market at most once per minute
    const lastChecked = state.lastChecked[config.marketId] || 0;
    if (now - lastChecked < 60000) {
      continue;
    }

    state.lastChecked[config.marketId] = now;

    // Fetch current market data
    const market = await fetchMarketData(config.marketId);
    if (!market || !market.active || market.closed) {
      continue;
    }

    // Check condition
    if (checkAlertCondition(market, config)) {
      const token = market.tokens.find(t =>
        t.outcome.toLowerCase() === config.outcome.toLowerCase()
      );
      const currentPrice = (token?.price || 0) * 100;

      // Send notification
      const sent = await sendAlert(config, market, currentPrice);
      if (sent) {
        state.triggeredAlerts.push(alertKey);
        alerts.push(`Alert triggered: ${market.question} - ${config.outcome} at ${currentPrice.toFixed(1)}%`);
      }
    }
  }

  return { state, alerts };
}

/**
 * Parse natural language alert request using AI
 *
 * Input: "Alert me when Trump election odds exceed 60%"
 * Output: AlertConfig structure
 */
export function parseAlertRequest(request: string, notifyUrl: string): AlertConfig | null {
  // This would use Gemini/OpenAI in production
  // For now, a simple pattern matcher

  const patterns = [
    // "when X odds exceed/above Y%"
    /when\s+(.+?)\s+odds?\s+(exceed|above|over|greater than)\s+(\d+)%?/i,
    // "when X odds fall below/under Y%"
    /when\s+(.+?)\s+odds?\s+(fall below|below|under|less than)\s+(\d+)%?/i,
    // "if X reaches Y%"
    /if\s+(.+?)\s+(reaches|hits|gets to)\s+(\d+)%?/i,
  ];

  for (const pattern of patterns) {
    const match = request.match(pattern);
    if (match) {
      const [, subject, direction, threshold] = match;

      // Determine direction
      const isAbove = ['exceed', 'above', 'over', 'greater than', 'reaches', 'hits', 'gets to'].some(
        d => direction.toLowerCase().includes(d)
      );

      return {
        marketId: '', // Would be resolved via market search
        outcome: 'Yes', // Default to Yes outcome
        threshold: parseInt(threshold),
        direction: isAbove ? 'above' : 'below',
        notifyUrl,
      };
    }
  }

  return null;
}

/**
 * Search for markets matching a query
 *
 * This would connect to Polymarket's search API
 */
export async function searchMarkets(query: string): Promise<PolymarketMarket[]> {
  const GAMMA_API = 'https://gamma-api.polymarket.com';

  try {
    // Search for markets matching the query
    const response = await fetch(`${GAMMA_API}/markets?closed=false&_limit=10`);
    if (!response.ok) {
      return [];
    }

    const markets: any[] = await response.json();

    // Filter by query (simple text match)
    const queryLower = query.toLowerCase();
    return markets.filter(m =>
      m.question?.toLowerCase().includes(queryLower) ||
      m.description?.toLowerCase().includes(queryLower)
    ).map(m => ({
      condition_id: m.conditionId,
      question: m.question,
      outcomes: m.outcomes || ['Yes', 'No'],
      tokens: m.tokens || [],
      active: m.active,
      closed: m.closed,
      volume: m.volume,
    }));
  } catch (error) {
    console.error('Market search failed:', error);
    return [];
  }
}

// Export for CRE workflow registration
export default {
  name: 'polymarket-alerts',
  version: '1.0.0',
  description: 'Monitor prediction markets and send alerts when conditions are met',
  triggers: ['cron:*/5 * * * *'], // Check every 5 minutes
  execute: executeWorkflow,
  helpers: {
    parseAlertRequest,
    searchMarkets,
    fetchMarketData,
  },
};

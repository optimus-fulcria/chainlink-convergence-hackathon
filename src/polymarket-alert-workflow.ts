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
 * Enhanced natural language parsing for alert requests
 *
 * Supports various phrasings:
 * - "Alert me when Trump election odds exceed 60%"
 * - "Notify when Bitcoin ETF approval drops below 30%"
 * - "Tell me if Trump wins probability goes above 55%"
 * - "Watch when No hits 40% on AI regulation"
 * - "Alert when the price of Yes on election is over 70 cents"
 * - "If recession likelihood falls under 25%, let me know"
 */

// Pattern definitions for parsing
interface ParsePattern {
  regex: RegExp;
  extractor: (match: RegExpMatchArray) => Partial<AlertConfig> | null;
}

// Keywords for direction detection
const ABOVE_KEYWORDS = [
  'exceed', 'exceeds', 'above', 'over', 'greater than', 'more than',
  'reaches', 'hits', 'gets to', 'goes above', 'rises to', 'climbs to',
  'surpasses', 'passes', 'breaks', 'tops', '>'
];

const BELOW_KEYWORDS = [
  'fall below', 'below', 'under', 'less than', 'drops to', 'drops below',
  'falls to', 'falls under', 'dips to', 'dips below', 'sinks to',
  'declines to', '<'
];

// Keywords for outcome detection
const YES_KEYWORDS = ['yes', 'true', 'will', 'pass', 'approve', 'win', 'happen'];
const NO_KEYWORDS = ['no', 'false', "won't", 'fail', 'reject', 'lose', "doesn't"];

function detectDirection(text: string): 'above' | 'below' | null {
  const lower = text.toLowerCase();
  for (const kw of BELOW_KEYWORDS) {
    if (lower.includes(kw)) return 'below';
  }
  for (const kw of ABOVE_KEYWORDS) {
    if (lower.includes(kw)) return 'above';
  }
  return null;
}

function detectOutcome(text: string): 'Yes' | 'No' {
  const lower = text.toLowerCase();
  // Explicit No mention takes priority
  if (/\b(no outcome|"no"|'no'|\bno\b(?:\s+option|\s+side)?)/i.test(text)) {
    return 'No';
  }
  for (const kw of NO_KEYWORDS) {
    if (lower.includes(kw)) return 'No';
  }
  return 'Yes';
}

function extractPercentage(text: string): number | null {
  // Match various percentage formats
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%/,           // "60%"
    /(\d+(?:\.\d+)?)\s*percent/i,    // "60 percent"
    /(\d+(?:\.\d+)?)\s*cents?/i,     // "70 cents" (Polymarket price format)
    /0\.(\d+)/,                       // "0.60" (decimal odds)
    /\.(\d+)/,                        // ".60"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      // Handle "cents" format (70 cents = 70%)
      if (pattern.source.includes('cents')) {
        return value;
      }
      // Handle decimal format (0.60 = 60%)
      if (pattern.source.includes('0\\.')) {
        return value * 100;
      }
      return value;
    }
  }
  return null;
}

function extractSubject(text: string): string {
  // Remove common alert prefixes
  let cleaned = text.replace(/^(alert|notify|tell|watch|let me know|ping me|message me|inform me)\s*(me|us)?\s*(when|if|once)?\s*/i, '');

  // Remove threshold phrases
  cleaned = cleaned.replace(/\s*(exceeds?|above|over|below|under|reaches|hits|drops?|falls?|goes?|rises?|climbs?|dips?|declines?|sinks?)\s*(\d+(?:\.\d+)?)\s*(%|percent|cents?)?\s*/gi, '');

  // Remove trailing phrases
  cleaned = cleaned.replace(/\s*,?\s*(let me know|notify me|alert me|tell me).*$/i, '');

  // Clean up
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || text;
}

export function parseAlertRequest(request: string, notifyUrl: string): AlertConfig | null {
  // Advanced pattern matching
  const patterns: ParsePattern[] = [
    // Pattern 1: "when X odds/probability/chance exceed/above Y%"
    {
      regex: /(?:when|if|once)\s+(.+?)\s+(?:odds?|probability|chance|likelihood)\s+(?:to\s+)?(\w+(?:\s+\w+)*)\s+(\d+(?:\.\d+)?)\s*(%|percent|cents?)?/i,
      extractor: (m) => ({
        threshold: parseFloat(m[3]),
        direction: detectDirection(m[2]),
        outcome: detectOutcome(m[1]),
      })
    },
    // Pattern 2: "when X exceeds/drops below Y%"
    {
      regex: /(?:when|if|once)\s+(.+?)\s+(exceeds?|goes?\s+above|rises?\s+to|drops?\s+(?:to|below)|falls?\s+(?:to|below)|goes?\s+below)\s+(\d+(?:\.\d+)?)\s*(%|percent|cents?)?/i,
      extractor: (m) => ({
        threshold: parseFloat(m[3]),
        direction: detectDirection(m[2]),
        outcome: detectOutcome(m[1]),
      })
    },
    // Pattern 3: "X > Y%" or "X < Y%"
    {
      regex: /(.+?)\s*([<>])\s*(\d+(?:\.\d+)?)\s*(%|percent|cents?)?/,
      extractor: (m) => ({
        threshold: parseFloat(m[3]),
        direction: m[2] === '>' ? 'above' : 'below',
        outcome: detectOutcome(m[1]),
      })
    },
    // Pattern 4: Simple "X hits Y%"
    {
      regex: /(.+?)\s+(hits?|reaches?|at|to)\s+(\d+(?:\.\d+)?)\s*(%|percent|cents?)?/i,
      extractor: (m) => ({
        threshold: parseFloat(m[3]),
        direction: 'above' as const,
        outcome: detectOutcome(m[1]),
      })
    },
  ];

  // Try each pattern
  for (const { regex, extractor } of patterns) {
    const match = request.match(regex);
    if (match) {
      const parsed = extractor(match);
      if (parsed && parsed.threshold !== undefined && parsed.direction) {
        return {
          marketId: '', // Resolved via market search
          outcome: parsed.outcome || 'Yes',
          threshold: parsed.threshold,
          direction: parsed.direction,
          notifyUrl,
        };
      }
    }
  }

  // Fallback: Extract what we can
  const percentage = extractPercentage(request);
  const direction = detectDirection(request);

  if (percentage !== null && direction !== null) {
    return {
      marketId: '',
      outcome: detectOutcome(request),
      threshold: percentage,
      direction,
      notifyUrl,
    };
  }

  return null;
}

/**
 * Parse multiple conditions from a single request
 *
 * Examples:
 * - "Alert when Trump > 60% AND Biden < 40%"
 * - "Watch both: recession above 70% or inflation below 20%"
 */
export function parseMultiConditionAlert(request: string, notifyUrl: string): AlertConfig[] {
  const results: AlertConfig[] = [];

  // Split on AND/OR/both/either/,
  const parts = request.split(/\s+(?:and|or|,|&|\|)\s+/i);

  for (const part of parts) {
    const parsed = parseAlertRequest(part.trim(), notifyUrl);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Extract search keywords from natural language
 */
export function extractSearchKeywords(request: string): string[] {
  const subject = extractSubject(request);

  // Extract potential search terms
  const keywords: string[] = [];

  // Named entities (capitalized words)
  const namedEntities = subject.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
  if (namedEntities) {
    keywords.push(...namedEntities);
  }

  // Topic keywords
  const topicPatterns = [
    /(?:about|on|for|regarding)\s+(.+?)(?:\s+(?:odds|probability|chance|market)|$)/i,
    /(.+?)\s+(?:election|approval|outcome|decision|vote|result)/i,
    /(?:will|if)\s+(.+?)\s+(?:win|pass|happen|be\s+approved)/i,
  ];

  for (const pattern of topicPatterns) {
    const match = request.match(pattern);
    if (match) {
      keywords.push(match[1].trim());
    }
  }

  // Fallback to subject words
  if (keywords.length === 0) {
    const words = subject.split(/\s+/).filter(w => w.length > 3);
    keywords.push(...words.slice(0, 3));
  }

  return [...new Set(keywords)];
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

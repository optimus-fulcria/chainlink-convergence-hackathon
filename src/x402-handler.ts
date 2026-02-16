/**
 * x402 Payment Handler for Prediction Market Alerts
 *
 * Implements HTTP 402 Payment Required flow for micropayments.
 * Users pay small amounts (e.g., $0.01 USDC) per alert subscription.
 *
 * Flow:
 * 1. User requests to create an alert
 * 2. Server responds with 402 + payment details
 * 3. User pays via USDC on Base
 * 4. Server verifies payment and creates alert
 */

import { ethers } from 'ethers';

// x402 payment protocol constants
const X402_VERSION = '1.0';
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER || '0x8Da63b5f30e603E2D11a924C3976F67E63035cF0';
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ALERT_PRICE_USDC = '10000'; // 0.01 USDC in 6 decimals
const BASE_CHAIN_ID = 8453;

// Payment request structure per x402 spec
interface X402PaymentRequest {
  version: string;
  network: string;
  chainId: number;
  payTo: string;
  maxAmountRequired: string;
  asset: string;
  resource: string;
  description: string;
  expiry: number;
  nonce: string;
}

// Payment proof structure
interface X402PaymentProof {
  transactionHash: string;
  blockNumber: number;
  chainId: number;
  payer: string;
  amount: string;
}

/**
 * Generate a 402 Payment Required response
 */
export function createPaymentRequired(resource: string, description: string): {
  status: 402;
  headers: Record<string, string>;
  body: X402PaymentRequest;
} {
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  const paymentRequest: X402PaymentRequest = {
    version: X402_VERSION,
    network: 'base',
    chainId: BASE_CHAIN_ID,
    payTo: PAYMENT_RECEIVER,
    maxAmountRequired: ALERT_PRICE_USDC,
    asset: USDC_ADDRESS_BASE,
    resource,
    description,
    expiry,
    nonce,
  };

  return {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
      'X-Payment-Version': X402_VERSION,
    },
    body: paymentRequest,
  };
}

/**
 * Verify a payment proof on-chain
 */
export async function verifyPayment(
  proof: X402PaymentProof,
  expectedAmount: string = ALERT_PRICE_USDC
): Promise<{ valid: boolean; error?: string }> {
  // Validate chain ID
  if (proof.chainId !== BASE_CHAIN_ID) {
    return { valid: false, error: 'Invalid chain ID - must be Base' };
  }

  // Connect to Base RPC
  const provider = new ethers.JsonRpcProvider(
    process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  );

  try {
    // Fetch transaction receipt
    const receipt = await provider.getTransactionReceipt(proof.transactionHash);
    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }

    // Verify transaction was successful
    if (receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed' };
    }

    // Verify block number matches
    if (receipt.blockNumber !== proof.blockNumber) {
      return { valid: false, error: 'Block number mismatch' };
    }

    // Parse USDC transfer logs
    const usdcInterface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);

    let paymentFound = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC_ADDRESS_BASE.toLowerCase()) {
        continue;
      }

      try {
        const parsed = usdcInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        const { from, to, value } = parsed.args;

        // Check if payment goes to our receiver
        if (to.toLowerCase() === PAYMENT_RECEIVER.toLowerCase()) {
          // Check amount
          if (BigInt(value) >= BigInt(expectedAmount)) {
            paymentFound = true;

            // Verify sender matches proof
            if (from.toLowerCase() !== proof.payer.toLowerCase()) {
              return { valid: false, error: 'Payer address mismatch' };
            }
            break;
          }
        }
      } catch {
        continue; // Not a Transfer event
      }
    }

    if (!paymentFound) {
      return { valid: false, error: 'Payment not found in transaction' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Verification failed: ${error}` };
  }
}

/**
 * Generate payment instructions for users
 */
export function getPaymentInstructions(): string {
  return `
## How to Pay for Alert Subscriptions

1. **Network**: Base (Chain ID: ${BASE_CHAIN_ID})
2. **Token**: USDC (${USDC_ADDRESS_BASE})
3. **Amount**: ${parseInt(ALERT_PRICE_USDC) / 1e6} USDC
4. **Send To**: ${PAYMENT_RECEIVER}

After payment, submit the transaction hash to activate your alert.

### Wallet Support
- Coinbase Wallet (recommended)
- MetaMask (add Base network)
- Rainbow
- Any wallet with Base support
  `.trim();
}

/**
 * Calculate total cost for multiple alerts
 */
export function calculateBulkPrice(alertCount: number): {
  totalUsdc: number;
  discount: number;
  pricePerAlert: number;
} {
  const basePrice = parseInt(ALERT_PRICE_USDC) / 1e6;

  // Bulk discounts
  let discount = 0;
  if (alertCount >= 10) discount = 0.20;      // 20% off for 10+
  else if (alertCount >= 5) discount = 0.10;  // 10% off for 5+

  const pricePerAlert = basePrice * (1 - discount);
  const totalUsdc = pricePerAlert * alertCount;

  return {
    totalUsdc,
    discount,
    pricePerAlert,
  };
}

// Export for use in workflow
export default {
  createPaymentRequired,
  verifyPayment,
  getPaymentInstructions,
  calculateBulkPrice,
  PAYMENT_RECEIVER,
  USDC_ADDRESS_BASE,
  ALERT_PRICE_USDC,
  BASE_CHAIN_ID,
};

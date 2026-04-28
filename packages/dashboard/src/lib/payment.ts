import type { WalletClient } from 'viem';

export interface PaymentDetails {
  amount: string;
  currency: string;
  recipient: string;
  network: string;
  nonce?: string;
  deadline?: number;
}

export class PaymentRequiredError extends Error {
  readonly details: PaymentDetails;

  constructor(details: PaymentDetails) {
    super(`Payment required: ${details.amount} ${details.currency}`);
    this.name = 'PaymentRequiredError';
    this.details = details;
  }
}

// Base chain USDC address
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const EIP3009_DOMAIN = (chainId: number, tokenAddress: `0x${string}`) => ({
  name: 'USD Coin',
  version: '2',
  chainId,
  verifyingContract: tokenAddress,
} as const);

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * Signs an EIP-3009 transferWithAuthorization for x402 payment.
 * Returns the hex-encoded signature.
 */
export async function signX402Payment(
  walletClient: WalletClient,
  from: `0x${string}`,
  details: PaymentDetails,
): Promise<string> {
  const chainId = walletClient.chain?.id ?? 8453; // default to Base
  const tokenAddress = USDC_BASE;

  // USDC has 6 decimals
  const decimals = 6;
  const amountRaw = BigInt(Math.round(parseFloat(details.amount) * 10 ** decimals));

  const validAfter = BigInt(0);
  const validBefore = BigInt(details.deadline ?? Math.floor(Date.now() / 1000) + 3600);
  // Nonce is a random 32-byte value — the server or x402 response may provide one
  const nonce = details.nonce
    ? (details.nonce as `0x${string}`)
    : (`0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`);

  const signature = await walletClient.signTypedData({
    account: from,
    domain: EIP3009_DOMAIN(chainId, tokenAddress),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from,
      to: details.recipient as `0x${string}`,
      value: amountRaw,
      validAfter,
      validBefore,
      nonce,
    },
  });

  return JSON.stringify({
    signature,
    from,
    to: details.recipient,
    value: amountRaw.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    token: tokenAddress,
    chainId,
  });
}

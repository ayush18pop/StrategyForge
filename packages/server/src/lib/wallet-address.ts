import { getAddress, isAddress } from 'ethers';

export function normalizeWalletAddress(value: string): string | null {
  if (!isAddress(value)) {
    return null;
  }

  return getAddress(value);
}

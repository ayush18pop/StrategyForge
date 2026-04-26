import { err, ok } from './core.js';
import type { Result } from './core.js';

export type WalletLike = unknown;

interface EthersLike {
  JsonRpcProvider: new (url: string) => unknown;
  Wallet: new (privateKey: string, provider: unknown) => WalletLike;
}

export async function createSigner(
  privateKey: string,
  evmRpc: string,
): Promise<Result<WalletLike>> {
  try {
    const ethersModule = (await import('ethers')) as { ethers?: EthersLike } & EthersLike;
    const ethersLike = ethersModule.ethers ?? ethersModule;

    if (!ethersLike.JsonRpcProvider || !ethersLike.Wallet) {
      return err(new Error('ethers is missing required exports'));
    }

    const provider = new ethersLike.JsonRpcProvider(evmRpc);
    return ok(new ethersLike.Wallet(privateKey, provider));
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error(`Failed to load ethers: ${String(error)}`),
    );
  }
}

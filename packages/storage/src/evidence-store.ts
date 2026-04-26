import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import { err, ok } from './core.js';
import type { EvidenceBundle, Result } from './core.js';

export interface EvidenceStoreConfig {
  privateKey: string;
  evmRpc: string;
  indexerUrl: string;
}

export class EvidenceStore {
  constructor(private readonly config: EvidenceStoreConfig) { }

  async writeBundle(bundle: EvidenceBundle): Promise<Result<{ cid: string }>> {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.evmRpc);
      const signer = new ethers.Wallet(this.config.privateKey, provider);
      const indexer = new Indexer(this.config.indexerUrl);

      const dataString = JSON.stringify(bundle);
      const data = new TextEncoder().encode(dataString);
      const memData = new MemData(data);

      const [tree, treeErr] = await memData.merkleTree();
      if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

      const rootHash = tree?.rootHash();
      if (!rootHash) throw new Error('Merkle tree returned empty root hash');

      const [tx, uploadErr] = await indexer.upload(memData, this.config.evmRpc, signer);
      if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

      return ok({ cid: rootHash });
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async readBundle(cid: string): Promise<Result<EvidenceBundle>> {
    try {
      const indexer = new Indexer(this.config.indexerUrl);

      const [blob, dlErr] = await (indexer as any).downloadToBlob(cid, { proof: true });
      if (dlErr !== null) throw new Error(`Download error: ${dlErr}`);

      const buffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      const parsed = JSON.parse(text) as EvidenceBundle;

      return ok(parsed);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

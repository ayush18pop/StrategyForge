/**
 * TypeScript wrappers for StrategyForge on-chain contracts.
 *
 * Deployed addresses on 0G Testnet (from deployments/0g-testnet.json):
 *   AgentRegistry: 0xF0Be1A141A3340262197f3e519FafB1a71Ee432a
 *   ReputationLedger: 0xCd2FD868b7eaB529075c5a7716dDfE395be33656
 *   StrategyForgeINFT: 0xEAd14B860fa11e81a2B8348AC3Ea1b401b7C4135
 */

import { Contract, keccak256, toUtf8Bytes } from 'ethers';
import type { Signer, ContractTransactionResponse } from 'ethers';

// ─── ABIs ───────────────────────────────────────────────────────

const REPUTATION_REGISTRY_ABI = [
    'function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)',
    'function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)',
] as const;

const INFT_ABI = [
    'function updateBrain(uint256 tokenId, string newCid)',
    'function brainCid(uint256 tokenId) view returns (string)',
] as const;

// ─── Typed interfaces ───────────────────────────────────────────

interface ReputationContract {
    giveFeedback(
        agentId: number,
        value: bigint,
        valueDecimals: number,
        tag1: string,
        tag2: string,
        endpoint: string,
        feedbackURI: string,
        feedbackHash: string,
    ): Promise<ContractTransactionResponse>;
}

interface INFTContract {
    updateBrain(tokenId: number, newCid: string): Promise<ContractTransactionResponse>;
    brainCid(tokenId: number): Promise<string>;
}

// ─── Reputation Ledger ──────────────────────────────────────────

/**
 * Record a strategy execution outcome on-chain via giveFeedback().
 *
 * Mapping: value=successRateBps, valueDecimals=2, tag1=strategyTag,
 *          tag2="execution_outcome", feedbackURI=evidenceCid
 */
export async function recordReputation(
    signer: Signer,
    ledgerAddress: string,
    agentId: number,
    strategyTag: string,
    successRateBps: number,
    evidenceCid: string,
): Promise<{ txHash: string }> {
    const contract = new Contract(
        ledgerAddress, REPUTATION_REGISTRY_ABI, signer,
    ) as unknown as ReputationContract;

    const feedbackHash = keccak256(toUtf8Bytes(evidenceCid));

    const tx = await contract.giveFeedback(
        agentId,
        BigInt(successRateBps),
        2,
        strategyTag,
        'execution_outcome',
        '',
        evidenceCid,
        feedbackHash,
    );

    const receipt = await tx.wait();
    return { txHash: receipt?.hash ?? tx.hash };
}

// ─── iNFT Brain ─────────────────────────────────────────────────

/**
 * Update the iNFT's brain CID on-chain after pipeline completion.
 */
export async function updateBrain(
    signer: Signer,
    inftAddress: string,
    tokenId: number,
    newBrainCid: string,
): Promise<{ txHash: string }> {
    const contract = new Contract(
        inftAddress, INFT_ABI, signer,
    ) as unknown as INFTContract;

    const tx = await contract.updateBrain(tokenId, newBrainCid);
    const receipt = await tx.wait();
    return { txHash: receipt?.hash ?? tx.hash };
}

/**
 * Read the current brain CID from the iNFT.
 */
export async function readBrainCid(
    signer: Signer,
    inftAddress: string,
    tokenId: number,
): Promise<string> {
    const contract = new Contract(
        inftAddress, INFT_ABI, signer,
    ) as unknown as INFTContract;

    return contract.brainCid(tokenId);
}

import { ethers } from 'ethers';

const REGISTRY_ABI = [
    'function register(string calldata metadataCid) external returns (uint256)',
    'function update(uint256 agentId, string calldata newMetadataCid) external',
    'function getAgent(uint256 agentId) external view returns (string memory)',
    'event AgentRegistered(uint256 indexed agentId, string metadataCid)',
    'event AgentUpdated(uint256 indexed agentId, string newMetadataCid)',
];

const LEDGER_ABI = [
    'function record(uint256 agentId, string calldata strategyTag, uint256 successRateBps, string calldata evidenceCid) external',
    'function getRecords(uint256 agentId) external view returns (tuple(string strategyTag, uint256 successRateBps, string evidenceCid, uint256 timestamp)[] memory)',
    'function getLatest(uint256 agentId) external view returns (tuple(string strategyTag, uint256 successRateBps, string evidenceCid, uint256 timestamp) memory)',
    'function getCount(uint256 agentId) external view returns (uint256)',
    'event RecordAdded(uint256 indexed agentId, string strategyTag, uint256 successRate)',
];

function getProvider() {
    const rpc = process.env.OG_CHAIN_RPC ?? 'https://evmrpc-testnet.0g.ai';
    return new ethers.JsonRpcProvider(rpc);
}

function getSigner() {
    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) throw new Error('AGENT_PRIVATE_KEY env var not set');
    return new ethers.Wallet(privateKey, getProvider());
}

export async function registryUpdate(agentId: number, metadataCid: string): Promise<{ txHash: string }> {
    const address = process.env.AGENT_REGISTRY_ADDRESS;
    if (!address) throw new Error('AGENT_REGISTRY_ADDRESS env var not set');
    const contract = new ethers.Contract(address, REGISTRY_ABI, getSigner());
    const tx = await contract.update(agentId, metadataCid);
    await tx.wait();
    return { txHash: tx.hash };
}

export async function registryRead(agentId: number): Promise<string> {
    const address = process.env.AGENT_REGISTRY_ADDRESS;
    if (!address) throw new Error('AGENT_REGISTRY_ADDRESS env var not set');
    const contract = new ethers.Contract(address, REGISTRY_ABI, getProvider());
    return contract.getAgent(agentId);
}

export async function ledgerRecord(
    agentId: number,
    strategyTag: string,
    successRateBps: number,
    evidenceCid: string,
): Promise<{ txHash: string }> {
    const address = process.env.REPUTATION_LEDGER_ADDRESS;
    if (!address) throw new Error('REPUTATION_LEDGER_ADDRESS env var not set');
    const contract = new ethers.Contract(address, LEDGER_ABI, getSigner());
    const tx = await contract.record(agentId, strategyTag, successRateBps, evidenceCid);
    await tx.wait();
    return { txHash: tx.hash };
}

export async function ledgerGetLatest(agentId: number) {
    const address = process.env.REPUTATION_LEDGER_ADDRESS;
    if (!address) throw new Error('REPUTATION_LEDGER_ADDRESS env var not set');
    const contract = new ethers.Contract(address, LEDGER_ABI, getProvider());
    return contract.getLatest(agentId);
}

export async function ledgerGetCount(agentId: number): Promise<number> {
    const address = process.env.REPUTATION_LEDGER_ADDRESS;
    if (!address) throw new Error('REPUTATION_LEDGER_ADDRESS env var not set');
    const contract = new ethers.Contract(address, LEDGER_ABI, getProvider());
    const count = await contract.getCount(agentId);
    return Number(count);
}

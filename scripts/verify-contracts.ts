/**
 * Verify that the 0G Chain contracts are deployed and working.
 * 
 * Usage:
 *   npx tsx scripts/verify-contracts.ts
 * 
 * This script:
 *   1. Checks that AGENT_REGISTRY_ADDRESS and REPUTATION_LEDGER_ADDRESS are set
 *   2. Reads the deployer wallet balance
 *   3. Reads agent ID 1 from AgentRegistry (registered during deploy)
 *   4. Reads reputation record count for agent ID 1
 *   5. Optionally registers a test agent and records a test reputation entry
 */

import 'dotenv/config';
import { ethers } from 'ethers';

const REGISTRY_ABI = [
    'function register(string calldata metadataCid) external returns (uint256)',
    'function update(uint256 agentId, string calldata newMetadataCid) external',
    'function getAgent(uint256 agentId) external view returns (string memory)',
    'function nextId() external view returns (uint256)',
    'event AgentRegistered(uint256 indexed agentId, string metadataCid)',
];

const LEDGER_ABI = [
    'function record(uint256 agentId, string calldata strategyTag, uint256 successRateBps, string calldata evidenceCid) external',
    'function getRecords(uint256 agentId) external view returns (tuple(string strategyTag, uint256 successRateBps, string evidenceCid, uint256 timestamp)[] memory)',
    'function getLatest(uint256 agentId) external view returns (tuple(string strategyTag, uint256 successRateBps, string evidenceCid, uint256 timestamp) memory)',
    'function getCount(uint256 agentId) external view returns (uint256)',
];

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  StrategyForge — 0G Chain Contract Verification');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. Check env vars
    const registryAddr = process.env.AGENT_REGISTRY_ADDRESS;
    const ledgerAddr = process.env.REPUTATION_LEDGER_ADDRESS;
    const rpc = process.env.OG_CHAIN_RPC ?? 'https://evmrpc-testnet.0g.ai';
    const privateKey = process.env.AGENT_PRIVATE_KEY;

    if (!registryAddr) { console.error('❌ AGENT_REGISTRY_ADDRESS not set'); process.exit(1); }
    if (!ledgerAddr) { console.error('❌ REPUTATION_LEDGER_ADDRESS not set'); process.exit(1); }
    if (!privateKey) { console.error('❌ AGENT_PRIVATE_KEY not set'); process.exit(1); }

    console.log(`RPC:                ${rpc}`);
    console.log(`AgentRegistry:      ${registryAddr}`);
    console.log(`ReputationLedger:   ${ledgerAddr}`);

    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Deployer:           ${wallet.address}`);

    // 2. Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance:            ${ethers.formatEther(balance)} A0GI\n`);

    if (balance === 0n) {
        console.error('⚠️  Wallet has 0 balance — contract calls will fail');
        console.log('   Get testnet tokens from: https://faucet.0g.ai/');
    }

    // 3. Read AgentRegistry
    const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, provider);
    try {
        const nextId = await registry.nextId();
        console.log(`AgentRegistry.nextId: ${nextId} (${Number(nextId) - 1} agents registered)`);

        if (Number(nextId) > 1) {
            const agent1 = await registry.getAgent(1);
            console.log(`Agent #1 metadata:    ${agent1.substring(0, 80)}${agent1.length > 80 ? '...' : ''}`);
        }
        console.log('✅ AgentRegistry is accessible\n');
    } catch (e: any) {
        console.error(`❌ AgentRegistry read failed: ${e.message}\n`);
    }

    // 4. Read ReputationLedger
    const ledger = new ethers.Contract(ledgerAddr, LEDGER_ABI, provider);
    try {
        const count = await ledger.getCount(1);
        console.log(`ReputationLedger records for agent #1: ${count}`);

        if (Number(count) > 0) {
            const latest = await ledger.getLatest(1);
            console.log(`  Latest: tag=${latest.strategyTag}, success=${Number(latest.successRateBps)/100}%, evidence=${latest.evidenceCid.substring(0, 30)}...`);
        }
        console.log('✅ ReputationLedger is accessible\n');
    } catch (e: any) {
        console.error(`❌ ReputationLedger read failed: ${e.message}\n`);
    }

    // 5. Live write test (if --test flag passed)
    if (process.argv.includes('--test')) {
        console.log('── Running live write test ──\n');

        const registryWrite = new ethers.Contract(registryAddr, REGISTRY_ABI, wallet);
        const ledgerWrite = new ethers.Contract(ledgerAddr, LEDGER_ABI, wallet);

        // Register a test agent
        console.log('Registering test agent...');
        const regTx = await (registryWrite as any).register('verify-script-test-agent');
        const regReceipt = await regTx.wait();
        const regEvent = regReceipt.logs
            .map((log: any) => { try { return registryWrite.interface.parseLog(log); } catch { return null; } })
            .find((e: any) => e?.name === 'AgentRegistered');
        const testAgentId = regEvent ? Number(regEvent.args.agentId) : -1;
        console.log(`✅ Registered test agent #${testAgentId} (tx: ${regTx.hash})`);

        // Record a reputation entry
        console.log('Recording reputation entry...');
        const ledgerTx = await (ledgerWrite as any).record(
            testAgentId,
            'test-strategy',
            10000, // 100% success
            'test-evidence-cid'
        );
        await ledgerTx.wait();
        console.log(`✅ Reputation recorded (tx: ${ledgerTx.hash})`);

        // Verify
        const testCount = await ledger.getCount(testAgentId);
        console.log(`✅ Agent #${testAgentId} now has ${testCount} reputation record(s)\n`);

        console.log('── Live test passed! Contracts are fully functional ──');
    } else {
        console.log('Tip: Run with --test flag to do a live write test:');
        console.log('  npx tsx scripts/verify-contracts.ts --test');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Verification complete');
    console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

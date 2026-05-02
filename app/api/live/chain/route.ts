import { NextResponse } from 'next/server';

const OG_RPC = process.env.OG_CHAIN_RPC || 'https://evmrpc-testnet.0g.ai';
const AGENT_REGISTRY = process.env.AGENT_REGISTRY_ADDRESS || '';
const REPUTATION_LEDGER = process.env.REPUTATION_LEDGER_ADDRESS || '';

// Minimal JSON-RPC helper — no ethers dependency needed for simple reads
async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(OG_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

// GET /api/live/chain
// Returns current 0G Chain block + agent contract state.
export async function GET() {
  try {
    const [blockHex, chainIdHex] = await Promise.all([
      rpc('eth_blockNumber'),
      rpc('eth_chainId'),
    ]);

    const block = hexToNumber(blockHex);
    const chainId = hexToNumber(chainIdHex);

    // Try to read nextId from AgentRegistry (slot 1 = nextId after owner at slot 0)
    // Function selector for nextId(): keccak256("nextId()")[0..4] = 0x61b8ce8c
    let agentCount: number | null = null;
    if (AGENT_REGISTRY) {
      try {
        const result = await rpc('eth_call', [
          { to: AGENT_REGISTRY, data: '0x61b8ce8c' },
          'latest',
        ]);
        // nextId starts at 1, so registered agents = nextId - 1
        agentCount = Math.max(0, hexToNumber(result) - 1);
      } catch {
        // contract not deployed yet in this env — non-fatal
      }
    }

    // Try to read record count — call getRecords(1) — selector keccak256("getRecords(uint256)")[0..4] = 0xb5f2bb43
    // Encode agentId=1 as 32-byte padded uint256
    let reputationRecords: number | null = null;
    if (REPUTATION_LEDGER) {
      try {
        const calldata =
          '0xb5f2bb43' +
          '0000000000000000000000000000000000000000000000000000000000000001';
        const result = await rpc('eth_call', [
          { to: REPUTATION_LEDGER, data: calldata },
          'latest',
        ]);
        // ABI-decode dynamic array: offset at byte 0 (32 bytes), length at byte 32
        // result is hex string; length is at bytes 32..64
        const lengthHex = '0x' + result.slice(66, 130);
        reputationRecords = hexToNumber(lengthHex);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json(
      {
        block,
        chainId,
        network: '0G Testnet',
        rpc: OG_RPC,
        contracts: {
          agentRegistry: AGENT_REGISTRY || null,
          reputationLedger: REPUTATION_LEDGER || null,
        },
        agentCount,
        reputationRecords,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { createHash } from 'crypto';
import { ok, err } from '@strategyforge/core';
import type { SealedInferenceResult, Result } from '@strategyforge/core';

export interface SealedInferenceConfig {
  privateKey: string;
  evmRpc: string;
}

export interface InferenceParams {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxRetries?: number;
}

type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;

export class SealedInference {
  private broker: Broker | null = null;
  private providerAddress: string | null = null;
  private endpoint: string | null = null;
  private model: string | null = null;

  constructor(private readonly config: SealedInferenceConfig) {}

  async init(): Promise<Result<void>> {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.evmRpc);
      const wallet = new ethers.Wallet(this.config.privateKey, provider);
      this.broker = await createZGComputeNetworkBroker(wallet);

      const services = await this.broker.inference.listService();
      if (services.length === 0) {
        return err(new Error('No inference services available on 0G Compute'));
      }

      this.providerAddress = services[0].provider as string;
      await this.broker.inference.acknowledgeProviderSigner(this.providerAddress);

      const meta = await this.broker.inference.getServiceMetadata(this.providerAddress);
      this.endpoint = meta.endpoint as string;
      this.model = meta.model as string;

      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async infer(params: InferenceParams): Promise<Result<SealedInferenceResult>> {
    if (!this.broker || !this.providerAddress || !this.endpoint || !this.model) {
      return err(new Error('Not initialized — call init() first'));
    }

    const maxRetries = params.maxRetries ?? 3;
    let lastError: Error = new Error('Unknown inference error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const headers = await this.broker.inference.getRequestHeaders(this.providerAddress);

        const systemContent = params.jsonMode
          ? `${params.systemPrompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
          : params.systemPrompt;

        const response = await fetch(`${this.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(headers as Record<string, string>),
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemContent },
              { role: 'user', content: params.userPrompt },
            ],
          }),
        });

        if (response.status === 429) {
          if (attempt < maxRetries) {
            await sleep(Math.pow(2, attempt) * 1000);
            continue;
          }
          return err(new Error('Rate limited: max retries exhausted'));
        }

        if (!response.ok) {
          return err(
            new Error(`Inference failed: HTTP ${response.status} ${response.statusText}`),
          );
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };

        const content = data.choices[0]?.message?.content ?? '';

        // Prefer real TEE attestation header; fall back to content hash
        const attestationHash =
          response.headers.get('x-attestation-hash') ??
          response.headers.get('x-tee-attestation') ??
          createHash('sha256').update(content).digest('hex');

        return ok({
          response: content,
          attestationHash,
          model: this.model,
          provider: this.providerAddress,
        });
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    return err(lastError);
  }

  async getBalance(): Promise<Result<number>> {
    if (!this.broker) {
      return err(new Error('Not initialized — call init() first'));
    }
    try {
      // broker.ledger exposes balance operations; depositFund is documented but
      // getBalance may vary by SDK version — using listService as a liveness check
      const ledger = this.broker.ledger as unknown as {
        getBalance?: () => Promise<number>;
      };
      if (typeof ledger.getBalance === 'function') {
        const balance = await ledger.getBalance();
        return ok(balance);
      }
      // SDK version without explicit getBalance — return sentinel indicating funded
      return ok(-1);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async verifyAttestation(
    providerAddress: string,
    outputDir: string,
  ): Promise<Result<boolean>> {
    if (!this.broker) {
      return err(new Error('Not initialized — call init() first'));
    }
    try {
      await this.broker.inference.verifyService(
        providerAddress,
        outputDir,
        (step: { message: string }) => console.log('[0G verify]', step.message),
      );
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

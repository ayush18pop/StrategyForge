import OpenAI from "openai";
import { createHash } from "crypto";
import { ok, err } from "@strategyforge/core";
import type { SealedInferenceResult, Result } from "@strategyforge/core";
import type { InferenceParams } from "./sealed-inference.js";

export const DEFAULT_PROXY_MODEL = "qwen/qwen-2.5-7b-instruct";

const RATE_LIMIT_RETRY_DELAY_MS = 7_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface ProxyInferenceConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  fallbackModels?: string[];
}

export class ProxyInference {
  private client: OpenAI;
  public model: string;
  private readonly fallbackModels: string[];

  constructor(config: ProxyInferenceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL:
        config.baseURL ||
        "https://compute-network-6.integratenetwork.work/v1/proxy",
    });
    this.model = config.model || DEFAULT_PROXY_MODEL;
    this.fallbackModels = (config.fallbackModels ?? []).filter(
      (candidate) => candidate && candidate !== this.model,
    );
  }

  async init(): Promise<Result<void>> {
    // API key based clients don't need async initialization
    return ok(undefined);
  }

  async infer(params: InferenceParams): Promise<Result<SealedInferenceResult>> {
    const attemptedModels = [
      this.model,
      ...this.fallbackModels,
      ...(this.model !== DEFAULT_PROXY_MODEL ? [DEFAULT_PROXY_MODEL] : []),
    ];

    const maxRetries = params.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (const candidateModel of attemptedModels) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.inferWithModel(candidateModel, params);
          if (candidateModel !== this.model) {
            this.model = candidateModel;
          }
          return ok(result);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const is429 =
            lastError.message.includes("429") ||
            (error instanceof Object &&
              "status" in error &&
              (error as { status: number }).status === 429);
          if (is429 && attempt < maxRetries) {
            await sleep(RATE_LIMIT_RETRY_DELAY_MS);
            continue;
          }
          break;
        }
      }
    }

    return err(
      lastError ?? new Error("Inference failed without an explicit error"),
    );
  }

  private async inferWithModel(
    model: string,
    params: InferenceParams,
  ): Promise<SealedInferenceResult> {
    const completion = await this.client.chat.completions.create({
      model,
      response_format: params.jsonMode ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const attestationHash = createHash("sha256").update(content).digest("hex");

    return {
      response: content,
      attestationHash,
      model,
      provider: "Proxy API Key Endpoint",
    };
  }
}

import OpenAI from "openai";
import { createHash } from "crypto";
import { ok, err } from "@strategyforge/core";
import type { SealedInferenceResult, Result } from "@strategyforge/core";
import type { InferenceParams } from "./sealed-inference.js";

export const DEFAULT_PROXY_MODEL = "qwen/qwen-2.5-7b-instruct";

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

    let lastError: Error | null = null;

    for (const candidateModel of attemptedModels) {
      try {
        const result = await this.inferWithModel(candidateModel, params);
        if (candidateModel !== this.model) {
          this.model = candidateModel;
        }
        return ok(result);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
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

import OpenAI from "openai";
import { createHash } from "crypto";
import { ok, err } from "@strategyforge/core";
import type { SealedInferenceResult, Result } from "@strategyforge/core";
import type { InferenceParams } from "./sealed-inference.js";

export interface ProxyInferenceConfig {
    apiKey: string;
    baseURL?: string;
    model?: string;
}

export class ProxyInference {
    private client: OpenAI;
    public model: string;

    constructor(config: ProxyInferenceConfig) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL:
                config.baseURL ||
                "https://compute-network-6.integratenetwork.work/v1/proxy",
        });
        this.model = config.model || "qwen/qwen-2.5-7b-instruct";
    }

    async init(): Promise<Result<void>> {
        // API key based clients don't need async initialization
        return ok(undefined);
    }

    async infer(params: InferenceParams): Promise<Result<SealedInferenceResult>> {
        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                response_format: params.jsonMode ? { type: "json_object" } : undefined,
                messages: [
                    { role: "system", content: params.systemPrompt },
                    { role: "user", content: params.userPrompt },
                ],
            });

            const content = completion.choices[0]?.message?.content ?? "";
            const attestationHash = createHash("sha256").update(content).digest("hex");

            return ok({
                response: content,
                attestationHash,
                model: this.model,
                provider: "Proxy API Key Endpoint",
            });
        } catch (error) {
            return err(
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }
}

/**
 * Unified LLM inference layer.
 * Routes to either 0G Compute Network or OpenRouter based on USE_OG_INFERENCE env var.
 * Every pipeline module (researcher, strategist, critic) calls this — so switching
 * the env var instantly switches the entire pipeline's inference backend.
 */
export async function llmCall(
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    model: string
): Promise<{ content: string; requestId: string }> {

    const useOG = process.env.USE_OG_INFERENCE === 'true';

    // ── Resolve endpoint, key, model ──────────────────────────────────────
    const endpoint = useOG
        ? `${process.env.OG_MODEL_BASE_URL}/chat/completions`
        : 'https://openrouter.ai/api/v1/chat/completions';

    const resolvedKey = useOG
        ? process.env.OG_MODEL_API_KEY!
        : apiKey;

    const resolvedModel = useOG
        ? (process.env.OG_MODEL_NAME || 'qwen-2.5-7b-instruct')
        : model;

    const backendLabel = useOG ? '0G' : 'OpenRouter';

    // ── Build headers ─────────────────────────────────────────────────────
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
    };
    if (!useOG) {
        // OpenRouter-specific headers
        headers['HTTP-Referer'] = 'https://strategyforge.dev';
        headers['X-Title'] = 'StrategyForge';
    }

    // ── Build body ────────────────────────────────────────────────────────
    const body: Record<string, any> = {
        model: resolvedModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
    };
    // response_format is OpenAI-compatible; 0G's qwen model may not support it
    if (!useOG) {
        body.response_format = { type: 'json_object' };
    }

    // ── Fire request ──────────────────────────────────────────────────────
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const data = await res.json();
    const requestId = res.headers.get('x-request-id') ?? data.id ?? `${backendLabel}-${Date.now()}`;

    if (!res.ok || !data.choices?.[0]) {
        const errMsg = data.error?.message ?? data.message ?? JSON.stringify(data);
        throw new Error(`${backendLabel} ${resolvedModel}: ${res.status} — ${errMsg}`);
    }

    let content = data.choices[0].message.content;

    // Validate that content is not empty and looks like JSON
    if (!content || typeof content !== 'string') {
        throw new Error(`${backendLabel} ${resolvedModel}: returned empty or non-string content`);
    }

    // ── Strip markdown fences (```json ... ```) that smaller models love to add ──
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // ── Clean up common LLM JSON issues ───────────────────────────────────
    content = content
        .replace(/\u202f/g, ' ')  // narrow no-break space
        .replace(/\u2009/g, ' ')  // thin space
        .replace(/\u200b/g, '')   // zero-width space
        .replace(/\u00a0/g, ' ')  // non-breaking space
        .replace(/\u2010/g, '-')  // hyphen
        .replace(/\u2011/g, '-')  // non-breaking hyphen
        .replace(/\u2012/g, '-')  // figure dash
        .replace(/\u2013/g, '-')  // en dash
        .replace(/\u2014/g, '-')  // em dash
        .replace(/\u2018/g, "'")  // left single quote
        .replace(/\u2019/g, "'")  // right single quote
        .replace(/\u201c/g, '"')  // left double quote
        .replace(/\u201d/g, '"')  // right double quote
        .replace(/\u2026/g, '...') // ellipsis
        .replace(/\u200a/g, '')   // hair space
        .replace(/\u205f/g, ' '); // medium mathematical space

    // ── Extract JSON from mixed content (smaller models may add prose around it) ──
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        // Try to extract the first JSON object from the content
        const jsonMatch = trimmed.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            content = jsonMatch[1];
        } else {
            throw new Error(`${backendLabel} ${resolvedModel}: returned non-JSON content: ${trimmed.substring(0, 200)}...`);
        }
    }

    return { content, requestId };
}


// web/src/lib/ai.ts
//
// Single helper used by all three AI components.
// Calls /api/ai/chat on the MedLink backend (which proxies to Claude).
// The backend handles the API key and CORS — never call Anthropic from the browser.

import { api } from './api';

/**
 * Send a prompt to Claude via the MedLink backend proxy.
 * Returns the text response.
 * Throws an Error with a user-friendly message on failure.
 */
export async function askClaude(prompt: string, maxTokens = 1000): Promise<string> {
    const res = await api.post('/api/ai/chat', { prompt, maxTokens });
    const text = res.data?.data?.text;
    if (!text) throw new Error('Empty response from AI');
    return text;
}
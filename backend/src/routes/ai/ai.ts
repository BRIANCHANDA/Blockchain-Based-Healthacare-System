import { handleError } from '../../lib/errors';
// backend/src/routes/ai/ai.ts
//
// Mount in index.ts:
//   import { aiRouter } from './routes/ai';
//   app.route('/api/ai', aiRouter);
//
// Requires ANTHROPIC_API_KEY in your .env

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter } from '../../lib/create-app';
import { authMiddleware } from '../../middleware/auth';


const errorSchema = z.object({ success: z.boolean(), error: z.object({ message: z.string() }) });

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // free, fast, clinically capable

export const aiRouter = createRouter()

    // ── PROXY TO GROQ ─────────────────────────────────────────────────────────
    // POST /api/ai/chat
    // Body: { prompt: string, maxTokens?: number }
    // Returns: { success: true, data: { text: string } }
    //
    .openapi(createRoute({
        tags: ['AI'],
        summary: 'Proxy a prompt to Groq LLM (authenticated staff only)',
        method: 'post',
        path: '/chat',
        security: [{ bearerAuth: [] }],
        middleware: [authMiddleware],
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: z.object({
                            prompt: z.string().min(1).max(8000),
                            maxTokens: z.number().int().min(100).max(2000).optional().default(1000),
                        }),
                    },
                },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.object({ text: z.string() }),
                        }),
                    },
                },
                description: 'LLM response',
            },
            403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
            500: { content: { 'application/json': { schema: errorSchema } }, description: 'Server error' },
        },
    }), async (c) => {
        try {
            const userType = c.get('userType');

            const allowed = ['practitioner', 'nurse', 'receptionist', 'admin', 'lab_technician', 'radiologist', 'pharmacist'];
            if (!allowed.includes(userType))
                return c.json({ success: false, error: { message: 'AI features are available to clinical staff only' } }, 403);

            const { prompt, maxTokens } = c.req.valid('json');

            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey)
                return c.json({ success: false, error: { message: 'AI service not configured — GROQ_API_KEY missing' } }, 500);

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    max_tokens: maxTokens ?? 1000,
                    temperature: 0.3,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a clinical documentation assistant for MedLink, a Zambian hospital EMR system. Respond only with the requested clinical content — no preamble, no meta-commentary.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[AI_PROXY] Groq error:', response.status, errText);
                if (response.status === 429)
                    return c.json({ success: false, error: { message: 'AI service is busy — please try again in a moment.' } }, 500);
                return c.json({ success: false, error: { message: 'AI service returned an error. Please try again.' } }, 500);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content ?? '';

            if (!text)
                return c.json({ success: false, error: { message: 'AI returned an empty response' } }, 500);

            return c.json({ success: true, data: { text } });

        } catch (err: any) {
            console.error('[AI_PROXY]', err);
            return c.json({ success: false, error: { message: 'Internal server error' } }, 500);
        }
    });
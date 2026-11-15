import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/**
 * Smoke test edge function - proves a model call works in Supabase Edge Functions
 * with a cloud model (Groq).
 *
 * Deploy with: supabase functions deploy smoke-test
 * Set GROQ_API_KEY as a secret: supabase secrets set GROQ_API_KEY=your_key
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream: false;
  [key: string]: unknown;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface CompleteResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
}

type Role = 'defender';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not configured as Supabase secret' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for optional role and message
    let role: Role = 'defender';
    let message = 'Say hello in one sentence.';

    try {
      const body = await req.json();
      if (body.role === 'defender') {
        role = body.role;
      }
      if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // Ignore parse errors, use defaults
    }

    // Make the completion call directly to Groq
    const startTime = Date.now();
    const model = 'openai/gpt-oss-20b';
    const baseUrl = 'https://api.groq.com/openai/v1';

    const requestBody: ChatCompletionRequest = {
      model,
      messages: [{ role: 'user', content: message }],
      max_tokens: 100,
      temperature: 0.7,
      stream: false,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return new Response(
        JSON.stringify({
          success: false,
          error: `Groq returned ${response.status}: ${errorText}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;

    const choice = data.choices[0];
    if (!choice?.message?.content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empty response from Groq' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = choice.message.content;
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const result: CompleteResult = {
      text,
      usage,
      latencyMs,
      provider: baseUrl,
      model,
    };

    // Return success with result
    return new Response(
      JSON.stringify({
        success: true,
        role,
        model: result.model,
        provider: result.provider,
        latencyMs: result.latencyMs,
        usage: result.usage,
        text: result.text,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

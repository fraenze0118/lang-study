import type { ZodType } from 'zod';
import { LLM_CONFIG } from './config';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxRetries?: number;
}

/**
 * 调用 OpenAI 兼容接口并要求返回 JSON（结构化输出），用 Zod 校验。
 * 解析失败自动重试（默认 1 次）。
 */
export async function chatJson<T>(
  messages: ChatMsg[],
  schema: ZodType<T>,
  opts: ChatOptions = {},
): Promise<T> {
  const temperature = opts.temperature ?? 0.7;
  const maxRetries = opts.maxRetries ?? 1;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const content = await callChat(messages, temperature, true);
      const parsed: unknown = JSON.parse(content);
      return schema.parse(parsed);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI 生成失败');
}

/** 调用 OpenAI 兼容接口，返回纯文本（答疑用，不做 JSON 约束）。 */
export async function chatText(
  messages: ChatMsg[],
  opts: { temperature?: number } = {},
): Promise<string> {
  return callChat(messages, opts.temperature ?? 0.7, false);
}

async function callChat(messages: ChatMsg[], temperature: number, useJson: boolean): Promise<string> {
  if (!LLM_CONFIG.apiKey) {
    throw new Error('未配置 EXPO_PUBLIC_LLM_API_KEY，请在 .env 中填写');
  }

  const body: Record<string, unknown> = {
    model: LLM_CONFIG.model,
    messages,
    temperature,
  };
  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM 返回空内容，请重试');
  }
  return content;
}

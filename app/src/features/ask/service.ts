// 答疑服务（M3）：带上下文的 AI 答疑 + 造句点评
import { chatJson, chatText } from '../../ai/client';
import {
  buildAskPrompt,
  buildCheckSentencePrompt,
  CheckSentenceResult,
  CheckSentenceSchema,
  systemPrompt,
} from '../../ai/prompts';
import { createSession, getMessages, getSession, insertMessage } from '../../db/chatRepo';
import { getItem } from '../../db/repo';
import { getRecentLearnedItems } from '../../db/userRepo';
import { ChatMessage } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { getActiveContext } from '../profile/languageService';

export interface AskInput {
  sessionId?: string;
  itemId?: string;
  message: string;
}

export async function ask(
  input: AskInput,
  userId = DEFAULT_USER_ID,
): Promise<{ sessionId: string; message: ChatMessage }> {
  const ctx = getActiveContext(userId);
  const item = input.itemId ? getItem(input.itemId) : null;

  let sessionId = input.sessionId;
  if (!sessionId) {
    sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const existing = getSession(sessionId);
  if (!existing) {
    createSession(sessionId, userId, item?.id ?? null, 'qa', ctx.languageId);
  }

  const sessionItemId = existing?.itemId ?? item?.id ?? null;
  const sessionItem = sessionItemId ? getItem(sessionItemId) : null;

  insertMessage(sessionId, 'user', input.message);

  const recent = getRecentLearnedItems(userId, ctx.languageId, 20);
  const history = getMessages(sessionId)
    .slice(-10)
    .map((m) => (m.role === 'user' ? '学生' : '老师') + '：' + m.content)
    .join('\n');

  const prompt = buildAskPrompt({
    languageId: ctx.languageId,
    item: sessionItem,
    levelCode: ctx.levelCode,
    recent,
    history,
    question: input.message,
  });

  const answer = await chatText([
    {
      role: 'system',
      content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
    },
    { role: 'user', content: prompt },
  ]);

  const message = insertMessage(sessionId, 'assistant', answer);
  return { sessionId, message };
}

export function getHistory(sessionId: string): ChatMessage[] {
  return getMessages(sessionId);
}

// 为某条目（或自由提问）创建一个答疑会话，返回 sessionId
export function startSession(itemId?: string, userId = DEFAULT_USER_ID): string {
  const ctx = getActiveContext(userId);
  const sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createSession(sessionId, userId, itemId ?? null, 'qa', ctx.languageId);
  return sessionId;
}

export async function checkSentence(
  input: { sessionId: string; itemId: string; sentence: string },
  userId = DEFAULT_USER_ID,
): Promise<ChatMessage> {
  const ctx = getActiveContext(userId);
  const item = getItem(input.itemId);

  const prompt = buildCheckSentencePrompt({
    languageId: ctx.languageId,
    item,
    levelCode: ctx.levelCode,
    sentence: input.sentence,
  });

  const result = await chatJson<CheckSentenceResult>(
    [
      {
        role: 'system',
        content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
      },
      { role: 'user', content: prompt },
    ],
    CheckSentenceSchema,
  );

  const content = formatCheckSentence(result);
  return insertMessage(input.sessionId, 'assistant', content);
}

function formatCheckSentence(r: CheckSentenceResult): string {
  const lines: string[] = [];
  // 刻意不用 emoji：该文本会渲染进对话气泡，而界面其余部分一律用矢量图标，
  // 混入 emoji 会破坏一致性（见 src/lib/theme.ts 的设计原则第 4 条）。
  lines.push(r.isCorrect ? '句子基本正确' : '句子有需要改进的地方');
  for (const c of r.corrections) {
    lines.push(`- ${c.wrong} → ${c.right}（${c.reason}）`);
  }
  if (r.improved) lines.push(`更好的表达：${r.improved}`);
  if (r.encouragement) lines.push(r.encouragement);
  return lines.join('\n');
}

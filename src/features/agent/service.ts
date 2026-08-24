// 对话式入口 Agent 服务（M1）：意图路由 + 内容预览 + 难度反馈 + 答疑
import { chatJson, chatText } from '../../ai/client';
import {
  buildIntentRoutePrompt,
  IntentRouteResult,
  IntentRouteSchema,
  systemPrompt,
} from '../../ai/prompts';
import { createSession, getMessages, getSession } from '../../db/chatRepo';
import { getOrCreateUser, getProgressStats, getRecentLearnedItems } from '../../db/userRepo';
import { Feedback, Intent } from '../../lib/enums';
import { ChatMessage } from '../../lib/types';
import { DEFAULT_USER_ID } from '../learn/service';
import { applyDifficultyFeedback } from '../profile/service';
import { ContentPreview, generateCustomPreview, suggestPreview } from '../study/service';

export type AgentAction =
  | { type: 'study'; preview: ContentPreview }
  | { type: 'review' }
  | { type: 'feedback'; feedback: Feedback };

export interface AgentReply {
  intent: Intent;
  text: string;
  action?: AgentAction;
}

const AGENT_SESSION_ID = 'agent-main';

export function getOrCreateAgentSessionId(userId = DEFAULT_USER_ID): string {
  if (!getSession(AGENT_SESSION_ID)) {
    createSession(AGENT_SESSION_ID, userId, null, 'agent');
  }
  return AGENT_SESSION_ID;
}

export function getAgentHistory(): ChatMessage[] {
  return getMessages(AGENT_SESSION_ID);
}

export function greeting(userId = DEFAULT_USER_ID): string {
  const user = getOrCreateUser(userId);
  const stats = getProgressStats(userId);
  return [
    `你好！我目前估计你在 ${user.levelCode} 水平，有 ${stats.dueCount} 个词待复习。`,
    '你想学点什么？可以直接说（比如「我想学最新的流行词」），或点下面的快捷入口。',
  ].join('\n');
}

export async function handleMessage(
  message: string,
  userId = DEFAULT_USER_ID,
): Promise<AgentReply> {
  const user = getOrCreateUser(userId);
  const stats = getProgressStats(userId);
  getOrCreateAgentSessionId(userId);

  const route = await chatJson<IntentRouteResult>(
    [
      { role: 'system', content: systemPrompt(user.levelCode, user.difficultyBias) },
      {
        role: 'user',
        content: buildIntentRoutePrompt({
          message,
          levelCode: user.levelCode,
          dueCount: stats.dueCount,
        }),
      },
    ],
    IntentRouteSchema,
  );

  switch (route.intent) {
    case 'review':
      return { intent: 'review', text: route.reply, action: { type: 'review' } };

    case 'study_suggest': {
      const preview = await suggestPreview(userId);
      return { intent: route.intent, text: route.reply, action: { type: 'study', preview } };
    }

    case 'study_custom': {
      const preview = await generateCustomPreview(route.topic ?? message, userId);
      return { intent: route.intent, text: route.reply, action: { type: 'study', preview } };
    }

    case 'difficulty_feedback': {
      const feedback: Feedback = route.feedback === 'too_hard' ? 'too_hard' : 'too_easy';
      applyDifficultyFeedback(userId, feedback);
      return { intent: route.intent, text: route.reply, action: { type: 'feedback', feedback } };
    }

    case 'qa':
    default: {
      const answer = await answerInline(route.question ?? message, userId);
      return { intent: 'qa', text: answer };
    }
  }
}

async function answerInline(question: string, userId: string): Promise<string> {
  const user = getOrCreateUser(userId);
  const recent = getRecentLearnedItems(userId, 20)
    .map((r) => `${r.surface}(${r.meaning})`)
    .join('、');
  return chatText([
    { role: 'system', content: systemPrompt(user.levelCode, user.difficultyBias) },
    {
      role: 'user',
      content: `学习者等级：${user.levelCode}。\n最近已学：${recent || '（暂无）'}\n\n学生问题：${question}\n\n请用中文回答，日语例句附假名和中文翻译，不超纲。`,
    },
  ]);
}

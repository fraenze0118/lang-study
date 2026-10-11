// 对话式入口 Agent 服务（M1）：意图路由 + 内容预览 + 难度反馈 + 答疑
import { chatJson, chatText } from '../../ai/client';
import {
  buildIntentRoutePrompt,
  IntentRouteResult,
  IntentRouteSchema,
  systemPrompt,
} from '../../ai/prompts';
import { createSession, getMessages, getSession } from '../../db/chatRepo';
import { getProgressStats, getRecentLearnedItems } from '../../db/userRepo';
import { Feedback, Intent } from '../../lib/enums';
import { ChatMessage } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { getActiveContext, getActiveLanguageId } from '../profile/languageService';
import { applyDifficultyFeedback } from '../profile/service';
import {
  ContentPreview,
  generateCustomPreview,
  generateGrammarPreview,
  suggestPreview,
} from '../study/service';

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
  // 对话会话按语种隔离：切换语种后不应看到另一语种的旧对话
  const languageId = getActiveLanguageId();
  const sessionId = `${AGENT_SESSION_ID}-${languageId}`;
  if (!getSession(sessionId)) {
    createSession(sessionId, userId, null, 'agent', languageId);
  }
  return sessionId;
}

export function getAgentHistory(userId = DEFAULT_USER_ID): ChatMessage[] {
  return getMessages(getOrCreateAgentSessionId(userId));
}

export function greeting(userId = DEFAULT_USER_ID): string {
  const ctx = getActiveContext(userId);
  const stats = getProgressStats(userId, ctx.languageId);
  return [
    `你好！我们正在学${ctx.profile.teacherLabel}，我目前估计你在 ${ctx.levelCode} 水平（${ctx.profile.levelSystem}），有 ${stats.dueCount} 个词待复习。`,
    '你想学点什么？可以直接说（比如「我想学最新的流行词」），或点下面的快捷入口。',
  ].join('\n');
}

export async function handleMessage(
  message: string,
  userId = DEFAULT_USER_ID,
): Promise<AgentReply> {
  const ctx = getActiveContext(userId);
  const stats = getProgressStats(userId, ctx.languageId);
  getOrCreateAgentSessionId(userId);

  const route = await chatJson<IntentRouteResult>(
    [
      {
        role: 'system',
        content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
      },
      {
        role: 'user',
        content: buildIntentRoutePrompt({
          languageId: ctx.languageId,
          message,
          levelCode: ctx.levelCode,
          dueCount: stats.dueCount,
        }),
      },
    ],
    IntentRouteSchema,
  );

  // 语法类意图走语法预览（各语种都适用）
  const isGrammar = /语法|文法|句型|助词|敬语|助詞|존댓말/.test(
    `${message} ${route.topic ?? ''}`,
  );

  switch (route.intent) {
    case 'review':
      return { intent: 'review', text: route.reply, action: { type: 'review' } };

    case 'study_suggest': {
      const preview = isGrammar
        ? await generateGrammarPreview(undefined, userId)
        : await suggestPreview(userId);
      return { intent: route.intent, text: route.reply, action: { type: 'study', preview } };
    }

    case 'study_custom': {
      const topic = route.topic ?? message;
      const preview = isGrammar
        ? await generateGrammarPreview(topic, userId)
        : await generateCustomPreview(topic, userId);
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
  const ctx = getActiveContext(userId);
  const recent = getRecentLearnedItems(userId, ctx.languageId, 20)
    .map((r) => `${r.surface}(${r.meaning})`)
    .join('、');
  return chatText([
    {
      role: 'system',
      content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
    },
    {
      role: 'user',
      content: `学习者等级：${ctx.levelCode}（${ctx.profile.levelSystem}）。\n最近已学：${recent || '（暂无）'}\n\n学生问题：${question}\n\n请用中文回答，${ctx.profile.answerHint}，不超纲。`,
    },
  ]);
}

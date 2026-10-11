// 对话会话与消息数据访问（v2：kind 区分 agent/qa；v5：language_id 标记语种）
import { getDb } from './database';
import { ChatKind } from '../lib/enums';
import { ChatMessage, ChatSession } from '../lib/types';

export function createSession(
  sessionId: string,
  userId: string,
  itemId: string | null,
  kind: ChatKind = 'agent',
  languageId: string | null = null,
): void {
  getDb().runSync(
    'INSERT INTO chat_sessions (id, user_id, item_id, language_id, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    sessionId,
    userId,
    itemId,
    languageId,
    kind,
    Date.now(),
  );
}

export function getSession(sessionId: string): ChatSession | null {
  return getDb().getFirstSync<ChatSession>(
    `SELECT id, user_id AS userId, item_id AS itemId, language_id AS languageId,
            kind, created_at AS createdAt
     FROM chat_sessions WHERE id = ?`,
    sessionId,
  );
}

export function insertMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
): ChatMessage {
  const r = getDb().runSync(
    'INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
    sessionId,
    role,
    content,
    Date.now(),
  );
  return {
    id: Number(r.lastInsertRowId),
    sessionId,
    role,
    content,
    createdAt: Date.now(),
  };
}

export function getMessages(sessionId: string): ChatMessage[] {
  return getDb().getAllSync<ChatMessage>(
    `SELECT id, session_id AS sessionId, role, content, created_at AS createdAt
     FROM chat_messages WHERE session_id = ? ORDER BY id`,
    sessionId,
  );
}

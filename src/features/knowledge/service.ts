// 知识库服务（M3）：浏览、搜索、筛选已学内容
import { getKnowledgeItems, getProgressStats, KnowledgeItem, ProgressStats } from '../../db/userRepo';
import { ItemType, MasteryState } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../learn/service';

export interface KnowledgeFilter {
  type?: ItemType;
  mastery?: MasteryState;
  query?: string;
}

export function listItems(filter: KnowledgeFilter = {}, userId = DEFAULT_USER_ID): KnowledgeItem[] {
  let items = getKnowledgeItems(userId);
  if (filter.type) items = items.filter((i) => i.type === filter.type);
  if (filter.mastery) items = items.filter((i) => i.masteryState === filter.mastery);
  if (filter.query) {
    const q = filter.query.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.surface.includes(q) ||
        i.reading.includes(q) ||
        i.meaning.toLowerCase().includes(q),
    );
  }
  return items;
}

export function getStats(userId = DEFAULT_USER_ID): ProgressStats {
  return getProgressStats(userId);
}

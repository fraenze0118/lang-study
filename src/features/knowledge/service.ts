// 知识库服务（M3）：浏览、搜索、筛选已学内容（按当前语种隔离）
import { getKnowledgeItems, getProgressStats, KnowledgeItem, ProgressStats } from '../../db/userRepo';
import { ItemType, MasteryState } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { getActiveLanguageId } from '../profile/languageService';

export interface KnowledgeFilter {
  type?: ItemType;
  mastery?: MasteryState;
  query?: string;
}

export function listItems(
  filter: KnowledgeFilter = {},
  userId = DEFAULT_USER_ID,
  languageId = getActiveLanguageId(),
): KnowledgeItem[] {
  let items = getKnowledgeItems(userId, languageId);
  if (filter.type) items = items.filter((i) => i.type === filter.type);
  if (filter.mastery) items = items.filter((i) => i.masteryState === filter.mastery);
  if (filter.query) {
    // 查询串与字段都小写化，避免罗马音大小写不一致导致搜不到
    const q = filter.query.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.surface.toLowerCase().includes(q) ||
        i.reading.toLowerCase().includes(q) ||
        i.meaning.toLowerCase().includes(q),
    );
  }
  return items;
}

export function getStats(
  userId = DEFAULT_USER_ID,
  languageId = getActiveLanguageId(),
): ProgressStats {
  return getProgressStats(userId, languageId);
}

export interface MasteryDistribution {
  new: number;
  learning: number;
  mastered: number;
}

export function getMasteryDistribution(items: KnowledgeItem[]): MasteryDistribution {
  return {
    new: items.filter((i) => i.masteryState === 'new').length,
    learning: items.filter((i) => i.masteryState === 'learning').length,
    mastered: items.filter((i) => i.masteryState === 'mastered').length,
  };
}

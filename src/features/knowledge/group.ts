// 知识库分组逻辑（纯函数，4 维度）
import { KnowledgeItem } from '../../db/userRepo';

export type GroupDimension = 'theme' | 'level' | 'pos' | 'mastery';

export interface KnowledgeGroup {
  title: string;
  items: KnowledgeItem[];
}

const MASTERY_LABEL: Record<string, string> = {
  new: '新学',
  learning: '学习中',
  mastered: '已掌握',
};

const POS_LABEL: Record<string, string> = {
  verb: '动词',
  noun: '名词',
  'i-adj': 'い形容词',
  'na-adj': 'な形容词',
  adverb: '副词',
  particle: '助词',
  conjunction: '接续词',
  interjection: '感叹词',
  expression: '惯用语',
  // 兼容 AI 可能返回的中文词性
  动词: '动词',
  名词: '名词',
  い形容词: 'い形容词',
  な形容词: 'な形容词',
  副词: '副词',
  助词: '助词',
  接续词: '接续词',
  感叹词: '感叹词',
  惯用语: '惯用语',
};

export function groupItems(items: KnowledgeItem[], dimension: GroupDimension): KnowledgeGroup[] {
  const map = new Map<string, KnowledgeItem[]>();
  for (const it of items) {
    const key = keyOf(it, dimension);
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  const groups: KnowledgeGroup[] = [...map.entries()].map(([title, its]) => ({
    title,
    items: its,
  }));
  return sortGroups(groups, dimension);
}

function keyOf(it: KnowledgeItem, dimension: GroupDimension): string {
  switch (dimension) {
    case 'theme':
      return it.category ?? '未分类';
    case 'level':
      return it.levelCode ?? '未分级';
    case 'pos':
      return POS_LABEL[it.pos ?? ''] ?? '其他';
    case 'mastery':
      return MASTERY_LABEL[it.masteryState] ?? it.masteryState;
  }
}

function sortGroups(groups: KnowledgeGroup[], dimension: GroupDimension): KnowledgeGroup[] {
  if (dimension === 'mastery') {
    const order = ['新学', '学习中', '已掌握'];
    return groups.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
  }
  if (dimension === 'level') {
    const order = ['N5', 'N4', 'N3', 'N2', 'N1'];
    return groups.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
  }
  return groups.sort((a, b) => b.items.length - a.items.length);
}

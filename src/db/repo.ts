// 数据访问层：领域服务层通过这里读写 SQLite，页面不直接碰 DB。
import { getDb } from './database';
import { ItemType } from '../lib/enums';
import { Item, ItemExample, Level, Unit } from '../lib/types';

const ITEM_COLS = `id, unit_id AS unitId, language_id AS languageId, type, surface, reading, accent, pos, conjugation,
  transitivity, meaning, pattern, grammar_category AS grammarCategory,
  onyomi_kunyomi AS onyomiKunyomi, related_item_ids AS relatedItemIds,
  category, source, level_code AS levelCode, created_at AS createdAt, sort_order AS sortOrder`;

export function getLanguage(code: string): { id: string; code: string; name: string } | null {
  return getDb().getFirstSync<{ id: string; code: string; name: string }>(
    'SELECT id, code, name FROM languages WHERE code = ?',
    code,
  );
}

export function getLevels(languageId: string): Level[] {
  return getDb().getAllSync<Level>(
    `SELECT id, language_id AS languageId, code, sort_order AS sortOrder, target_vocab AS targetVocab
     FROM levels WHERE language_id = ? ORDER BY sort_order`,
    languageId,
  );
}

export function getLevelByCode(languageId: string, code: string): Level | null {
  return getDb().getFirstSync<Level>(
    `SELECT id, language_id AS languageId, code, sort_order AS sortOrder, target_vocab AS targetVocab
     FROM levels WHERE language_id = ? AND code = ?`,
    languageId,
    code,
  );
}

export function getUnits(levelId: string): Unit[] {
  return getDb().getAllSync<Unit>(
    `SELECT id, level_id AS levelId, title, kind, sort_order AS sortOrder
     FROM units WHERE level_id = ? ORDER BY sort_order`,
    levelId,
  );
}

export function getUnit(unitId: string): Unit | null {
  return getDb().getFirstSync<Unit>(
    `SELECT id, level_id AS levelId, title, kind, sort_order AS sortOrder
     FROM units WHERE id = ?`,
    unitId,
  );
}

export function getItemsByUnit(unitId: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT ${ITEM_COLS} FROM items WHERE unit_id = ? ORDER BY sort_order`,
    unitId,
  );
}

export function getItem(itemId: string): Item | null {
  return getDb().getFirstSync<Item>(`SELECT ${ITEM_COLS} FROM items WHERE id = ?`, itemId);
}

// 按「写法 + 读音 + 语种」查重（用于 AI 生成条目的去重）
// 必须带 languageId：不同语种可能有同形词（如韩语「学生」与日语「学生」）
export function getItemBySurfaceReading(
  surface: string,
  reading: string,
  languageId: string,
): Item | null {
  return getDb().getFirstSync<Item>(
    `SELECT ${ITEM_COLS} FROM items WHERE surface = ? AND reading = ? AND language_id = ? LIMIT 1`,
    surface,
    reading,
    languageId,
  );
}

export function getExamplesByItem(itemId: string): ItemExample[] {
  return getDb().getAllSync<ItemExample>(
    'SELECT id, item_id AS itemId, ja, pronunciation, zh, source FROM item_examples WHERE item_id = ? ORDER BY id',
    itemId,
  );
}

export function countLanguages(): number {
  const row = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM languages');
  return row?.n ?? 0;
}

/** 该语种是否已写入 languages 表（播种幂等判断用；本项目 id 与 code 相同） */
export function hasLanguageRow(languageId: string): boolean {
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM languages WHERE id = ?',
    languageId,
  );
  return (row?.n ?? 0) > 0;
}

// 某单元中该用户尚未学习的条目（无 user_item_states 记录）
export function getItemsWithoutState(userId: string, unitId: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT i.id, i.unit_id AS unitId, i.language_id AS languageId, i.type, i.surface, i.reading,
            i.accent, i.pos, i.conjugation, i.transitivity, i.meaning, i.pattern,
            i.grammar_category AS grammarCategory, i.onyomi_kunyomi AS onyomiKunyomi,
            i.related_item_ids AS relatedItemIds, i.source, i.level_code AS levelCode,
            i.created_at AS createdAt, i.sort_order AS sortOrder
     FROM items i
     LEFT JOIN user_item_states s ON s.item_id = i.id AND s.user_id = ?
     WHERE i.unit_id = ? AND s.id IS NULL
     ORDER BY i.sort_order`,
    userId,
    unitId,
  );
}

/** 某语种指定类型的所有内置条目（按单元与排序），用于字母表等参考页 */
export function getSyllabusItemsByType(languageId: string, type: ItemType): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT ${ITEM_COLS
      .split(',')
      .map((c) => `i.${c.trim()}`)
      .join(', ')}
     FROM items i
     WHERE i.language_id = ? AND i.type = ? AND i.source = 'syllabus'
     ORDER BY i.unit_id, i.sort_order`,
    languageId,
    type,
  );
}

export function insertExample(
  itemId: string,
  ja: string,
  pronunciation: string,
  zh: string,
  source: 'manual' | 'ai',
): void {
  getDb().runSync(
    'INSERT INTO item_examples (item_id, ja, pronunciation, zh, source) VALUES (?, ?, ?, ?, ?)',
    itemId,
    ja,
    pronunciation,
    zh,
    source,
  );
}

export function insertItem(item: Item): void {
  getDb().runSync(
    `INSERT INTO items (
       id, unit_id, language_id, type, surface, reading, accent, pos, conjugation, transitivity,
       meaning, pattern, grammar_category, onyomi_kunyomi, related_item_ids, category,
       source, level_code, created_at, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.unitId,
    item.languageId,
    item.type,
    item.surface,
    item.reading,
    item.accent,
    item.pos,
    item.conjugation,
    item.transitivity,
    item.meaning,
    item.pattern,
    item.grammarCategory,
    item.onyomiKunyomi,
    item.relatedItemIds,
    item.category,
    item.source,
    item.levelCode,
    item.createdAt,
    item.sortOrder,
  );
}

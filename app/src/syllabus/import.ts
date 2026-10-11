// 大纲播种：按语种幂等、增量、可迁移。
//
// 三代实现的演进（读之前先理解这里为什么这么做）：
//   v1  `if (countLanguages() > 0) return;`  —— 日语播种后新语种永不写入
//   v2  逐语种判断 + 等级存在即整体跳过       —— 新语种能补，但**新增单元补不进去**
//   v3  内容哈希 ID + 逐条 upsert + 旧库迁移  —— 当前版本
//
// v3 修掉的两个真实缺陷：
// 1. **ID 不稳定**：旧实现用数组下标生成 ID（`{level}-u{ui}-i{ii}`）。
//    往大纲中间插入一个单元，后续所有 ID 都会平移，而 `user_item_states.item_id`
//    引用 `items.id`，于是用户的掌握度/复习进度会**指向错误的内容**。
//    现在 ID 由内容算哈希，增删改单元不会影响其它条目。
// 2. **无法增量**：旧实现一看到等级已存在就 return，所以老用户升级后
//    永远拿不到新补充的大纲内容（例如韩语的音节拼合与收音单元）。
//    现在逐单元、逐条目 upsert，并在末尾重排 sort_order。
//
// 兼容旧库：检测到下标形态的 ID 时，先按「surface + reading」把用户进度
// 迁移到新 ID 上，再删除旧的 syllabus 条目重建。
import { getDb } from '../db/database';
import { LANGUAGE_PROFILES } from '../lib/languages';
import { getCourse } from './registry';
import { Syllabus, SyllabusItem } from './types';

/** 稳定的短哈希（djb2 变体），用于生成内容相关的 ID */
function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/** 内容哈希 ID：同样内容永远得到同样的 ID */
function unitIdOf(levelId: string, title: string): string {
  return `${levelId}-u-${hashId(`${levelId}|${title}`)}`;
}

function itemIdOf(unitId: string, item: SyllabusItem): string {
  return `${unitId}-i-${hashId(`${item.type}|${item.surface}|${item.reading ?? ''}`)}`;
}

/** 旧实现的下标 ID 形态：{level}-u{数字}-i{数字} */
const LEGACY_ID = /-u\d+-i\d+$/;

export function ensureSyllabusSeeded(): void {
  for (const profile of Object.values(LANGUAGE_PROFILES)) {
    const course = getCourse(profile.id);
    // 无内置大纲的语种跳过；但**已注册课程就不能因为「语种已存在」而跳过**，
    // 否则新增单元永远补不进去（这正是 v2 的缺陷）。
    if (!course) continue;
    seedCourse(course);
  }
}

function seedCourse(syllabus: Syllabus): void {
  const db = getDb();
  const { language, level, units } = syllabus;

  db.runSync(
    'INSERT OR IGNORE INTO languages (id, code, name) VALUES (?, ?, ?)',
    language.id,
    language.code,
    language.name,
  );

  const levelExists = db.getFirstSync<{ id: string }>(
    'SELECT id FROM levels WHERE id = ?',
    level.id,
  );
  if (!levelExists) {
    db.runSync(
      'INSERT INTO levels (id, language_id, code, sort_order, target_vocab) VALUES (?, ?, ?, ?, ?)',
      level.id,
      language.id,
      level.code,
      level.sortOrder,
      level.targetVocab,
    );
  }

  // 旧库的下标 ID 需要先迁移，否则重建会删掉用户正在引用的进度
  migrateLegacyIds(syllabus);

  // 先插全部单元（条目有 unit_id 外键，必须单元先到位）
  units.forEach((unit) => {
    const uid = unitIdOf(level.id, unit.title);
    db.runSync(
      `INSERT INTO units (id, level_id, title, kind, sort_order) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, kind = excluded.kind`,
      uid,
      level.id,
      unit.title,
      unit.kind,
    );
  });

  // 再逐条 upsert 条目
  units.forEach((unit) => {
    const uid = unitIdOf(level.id, unit.title);
    unit.items.forEach((item) => {
      const iid = itemIdOf(uid, item);
      const extras = extractExtras(item);
      const exists = db.getFirstSync<{ id: string }>('SELECT id FROM items WHERE id = ?', iid);

      if (!exists) {
        db.runSync(
          `INSERT INTO items (
             id, unit_id, language_id, type, surface, reading, accent, pos, conjugation,
             transitivity, meaning, pattern, grammar_category, category,
             source, level_code, created_at, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          iid,
          uid,
          language.id,
          item.type,
          item.surface,
          item.reading ?? item.surface,
          extras.accent,
          extras.pos,
          extras.conjugation,
          extras.transitivity,
          item.meaning,
          extras.pattern,
          extras.grammarCategory,
          unit.title,
          'syllabus',
          level.code,
          Date.now(),
        );

        (item.examples ?? []).forEach((ex) => {
          db.runSync(
            'INSERT INTO item_examples (item_id, ja, pronunciation, zh, source) VALUES (?, ?, ?, ?, ?)',
            iid,
            ex.ja,
            ex.pronunciation,
            ex.zh,
            'manual',
          );
        });
      } else {
        // 已存在：只同步「可安全更新」的展示字段，不动任何用户数据
        db.runSync(
          `UPDATE items SET meaning = ?, category = ?, level_code = ?, reading = ?,
             accent = ?, pos = ?, pattern = ?, grammar_category = ?
           WHERE id = ?`,
          item.meaning,
          unit.title,
          level.code,
          item.reading ?? item.surface,
          extras.accent,
          extras.pos,
          extras.pattern,
          extras.grammarCategory,
          iid,
        );
      }
    });
  });

  // 最后统一重排顺序：ID 与内容绑定，顺序只能靠 sort_order 表达
  units.forEach((unit, ui) => {
    const uid = unitIdOf(level.id, unit.title);
    db.runSync('UPDATE units SET sort_order = ? WHERE id = ?', ui, uid);
    unit.items.forEach((item, ii) => {
      db.runSync('UPDATE items SET sort_order = ? WHERE id = ?', ii, itemIdOf(uid, item));
    });
  });
}

/**
 * 把下标形态的 ID 迁移到内容哈希 ID，并保留用户进度。
 *
 * 做法：对旧库里的每个 syllabus 条目，按「unit 顺序 + item 顺序」回推它应该是哪条内容，
 * 再用 surface/reading 与用户状态匹配，把 item_id 改写成新的稳定 ID。
 * 由于旧 ID 的顺序与代码里的数组顺序一一对应，这个回推是可靠的。
 */
function migrateLegacyIds(syllabus: Syllabus): void {
  const db = getDb();
  const { level, units } = syllabus;

  // 该等级下是否存在下标形态的条目
  const legacy = db.getFirstSync<{ id: string }>(
    `SELECT id FROM items WHERE level_code = ? AND source = 'syllabus' AND id GLOB '*-u[0-9]*-i[0-9]*' LIMIT 1`,
    level.code,
  );
  if (!legacy) return;

  // 1. 建立 旧ID → 新ID 映射
  const remap = new Map<string, string>();
  units.forEach((unit, ui) => {
    const oldUnitId = `${level.id}-u${ui}`;
    const newUnitId = unitIdOf(level.id, unit.title);
    unit.items.forEach((item, ii) => {
      remap.set(`${oldUnitId}-i${ii}`, itemIdOf(newUnitId, item));
    });
  });

  // 2. 把用户数据指向新 ID（外键表必须先改，再删旧条目）
  for (const [oldId, newId] of remap) {
    if (oldId === newId) continue;
    // 目标 ID 可能已存在（例如上次播种已部分完成），
    // 由于 user_item_states 有 UNIQUE(user_id, item_id)，
    // 不先清掉冲突行会导致 UPDATE 触发唯一约束失败。
    db.runSync('DELETE FROM user_item_states WHERE item_id = ?', newId);
    db.runSync('UPDATE user_item_states SET item_id = ? WHERE item_id = ?', newId, oldId);
    db.runSync('UPDATE review_logs SET item_id = ? WHERE item_id = ?', newId, oldId);
    db.runSync('UPDATE answer_logs SET item_id = ? WHERE item_id = ?', newId, oldId);
    db.runSync('UPDATE chat_sessions SET item_id = ? WHERE item_id = ?', newId, oldId);
    db.runSync('UPDATE difficulty_feedback SET item_id = ? WHERE item_id = ?', newId, oldId);
  }

  // 3. 删除旧的 syllabus 条目与下标的空单元，然后由调用方按新 ID 重新插入
  db.runSync(`DELETE FROM item_examples WHERE item_id IN (
    SELECT id FROM items WHERE level_code = ? AND source = 'syllabus'
  )`, level.code);
  db.runSync(
    `DELETE FROM items WHERE level_code = ? AND source = 'syllabus'`,
    level.code,
  );
  db.runSync(
    `DELETE FROM units WHERE level_id = ? AND id GLOB '*-u[0-9]*'`,
    level.id,
  );
}

function extractExtras(item: SyllabusItem) {
  if (item.type === 'word') {
    return {
      accent: item.accent ?? null,
      pos: item.pos,
      conjugation: item.conjugation ?? null,
      transitivity: item.transitivity ?? null,
      pattern: null,
      grammarCategory: null,
    };
  }
  if (item.type === 'grammar') {
    return {
      accent: null,
      pos: null,
      conjugation: null,
      transitivity: null,
      pattern: item.pattern ?? null,
      grammarCategory: item.grammarCategory ?? null,
    };
  }
  // 字母入门类（日语 kana / 韩语 hangul）
  return {
    accent: null,
    pos: null,
    conjugation: null,
    transitivity: null,
    pattern: null,
    grammarCategory: null,
  };
}

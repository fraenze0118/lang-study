// 大纲播种：按语种幂等。
//
// 修复的关键缺陷：旧实现首行是 `if (countLanguages() > 0) return;` ——
// 日语一旦播种，之后新增的语种（如韩语）永远不会被写入。
// 现在改为"该语种是否已存在"逐语种判断，因此已安装的 App 升级后会自动补种韩语。
import { getDb } from '../db/database';
import { hasLanguageRow } from '../db/repo';
import { LANGUAGE_PROFILES } from '../lib/languages';
import { getCourse } from './registry';
import { Syllabus, SyllabusItem } from './types';

export function ensureSyllabusSeeded(): void {
  for (const profile of Object.values(LANGUAGE_PROFILES)) {
    if (hasLanguageRow(profile.id)) continue; // 该语种已播种，跳过
    const course = getCourse(profile.id);
    if (!course) continue; // 只注册了 profile、暂无内置大纲的语种
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
  // 大纲里只种一个等级（小样本），已存在则不重复
  const existingLevel = db.getFirstSync<{ id: string }>(
    'SELECT id FROM levels WHERE id = ?',
    level.id,
  );
  if (existingLevel) return;

  db.runSync(
    'INSERT INTO levels (id, language_id, code, sort_order, target_vocab) VALUES (?, ?, ?, ?, ?)',
    level.id,
    language.id,
    level.code,
    level.sortOrder,
    level.targetVocab,
  );

  units.forEach((unit, ui) => {
    const unitId = `${level.id}-u${ui}`;
    db.runSync(
      'INSERT INTO units (id, level_id, title, kind, sort_order) VALUES (?, ?, ?, ?, ?)',
      unitId,
      level.id,
      unit.title,
      unit.kind,
      ui,
    );

    unit.items.forEach((item, ii) => {
      const itemId = `${unitId}-i${ii}`;
      const extras = extractExtras(item);
      db.runSync(
        `INSERT INTO items (
           id, unit_id, language_id, type, surface, reading, accent, pos, conjugation,
           transitivity, meaning, pattern, grammar_category, category,
           source, level_code, created_at, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId,
        unitId,
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
        ii,
      );

      (item.examples ?? []).forEach((ex) => {
        db.runSync(
          'INSERT INTO item_examples (item_id, ja, pronunciation, zh, source) VALUES (?, ?, ?, ?, ?)',
          itemId,
          ex.ja,
          ex.pronunciation,
          ex.zh,
          'manual',
        );
      });
    });
  });
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

// 大纲导入：启动时若库为空则写入 N5 小样本大纲（幂等）。
import { getDb } from '../db/database';
import { countLanguages } from '../db/repo';
import { N5_SYLLABUS, SyllabusItem } from './data';

export function ensureSyllabusSeeded(): void {
  if (countLanguages() > 0) return; // 已导入，跳过

  const db = getDb();
  const { language, level, units } = N5_SYLLABUS;

  db.runSync(
    'INSERT INTO languages (id, code, name) VALUES (?, ?, ?)',
    language.id,
    language.code,
    language.name,
  );
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
           id, unit_id, type, surface, reading, accent, pos, conjugation,
           transitivity, meaning, pattern, grammar_category,
           source, level_code, created_at, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId,
        unitId,
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
        'syllabus',
        level.code,
        Date.now(),
        ii,
      );

      (item.examples ?? []).forEach((ex) => {
        db.runSync(
          'INSERT INTO item_examples (item_id, ja, kana, zh, source) VALUES (?, ?, ?, ?, ?)',
          itemId,
          ex.ja,
          ex.kana,
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
  return {
    accent: null,
    pos: null,
    conjugation: null,
    transitivity: null,
    pattern: null,
    grammarCategory: null,
  };
}

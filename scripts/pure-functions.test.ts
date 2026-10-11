// 纯函数自测：不引入测试框架，用 Node 内置 test runner 直接跑。
// 运行：npm test  （即 tsx --test scripts/pure-functions.test.ts）
// 说明：用 tsx 而不是 node --experimental-strip-types，是因为本项目源码使用
//       无扩展名相对导入（Metro 风格），Node 原生 ESM 解析器无法处理。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gradeExercise, normalizeAnswer } from '../src/features/study/answer';
import {
  accuracy,
  isSessionPerfect,
  xpForAnswer,
  xpForSession,
  XP_CORRECT,
  XP_REVIEW,
} from '../src/features/progress/xp';
import { computeStreak, localDateKey, recentDateKeys } from '../src/features/progress/streak';
import { buildSteps, countExerciseSteps } from '../src/features/study/steps';
import { readPreferences, writePreferences } from '../src/features/profile/preferences';
import {
  DEFAULT_LANGUAGE_ID,
  getDefaultLevelCode,
  getLanguageProfile,
  getLevelsSorted,
  LANGUAGE_PROFILES,
  listLanguages,
  shiftLevelCode,
} from '../src/lib/languages';
import { LANGUAGE_COURSES } from '../src/syllabus/registry';

// —— normalizeAnswer ——
test('normalizeAnswer: 全角转半角、去空白与标点、小写化', () => {
  assert.equal(normalizeAnswer('ＡＢＣ'), 'abc');
  assert.equal(normalizeAnswer('１２３'), '123');
  assert.equal(normalizeAnswer(' 食べる '), '食べる');
  assert.equal(normalizeAnswer('食べる。'), '食べる');
  assert.equal(normalizeAnswer('食べる、'), '食べる');
  assert.equal(normalizeAnswer('「テスト」'), 'テスト');
  assert.equal(normalizeAnswer('ａ　ｂ'), 'ab'); // 全角空格 U+3000
  assert.equal(normalizeAnswer(''), '');
});

test('normalizeAnswer: 全角＃号转半角', () => {
  assert.equal(normalizeAnswer('＃１'), '#1');
});

// —— gradeExercise ——
test('gradeChoice/fill: 容错空白与标点', () => {
  assert.equal(gradeExercise('choice', ' 犬 ', '犬').correct, true);
  assert.equal(gradeExercise('choice', '犬', '犬').correct, true);
  assert.equal(gradeExercise('choice', '猫', '犬').correct, false);
  assert.equal(gradeExercise('choice', '', '犬').correct, false); // 空答案不算对
  assert.equal(gradeExercise('fill', 'たべる。', 'たべる').correct, true);
});

test('gradeExercise: translate 永远进入自评，不自动判对', () => {
  const r = gradeExercise('translate', '我吃饭', '我吃饭');
  assert.equal(r.correct, false);
  assert.equal(r.pendingSelfCheck, true);
});

// —— xp ——
test('xpForAnswer: 答错 0，答对基础值，连击 3 以上有加成', () => {
  assert.equal(xpForAnswer(false, 0), 0);
  assert.equal(xpForAnswer(false, 5), 0); // 答错时不应有加成
  assert.equal(xpForAnswer(true, 1), XP_CORRECT);
  assert.equal(xpForAnswer(true, 2), XP_CORRECT);
  assert.equal(xpForAnswer(true, 3), XP_CORRECT); // 阈值处不加成
  assert.ok(xpForAnswer(true, 4) > XP_CORRECT);
  assert.ok(xpForAnswer(true, 10) > xpForAnswer(true, 4));
});

test('accuracy: 分母为 0 返回 null，避免 NaN', () => {
  assert.equal(accuracy(0, 0), null);
  assert.equal(accuracy(1, 2), 0.5);
  assert.equal(isSessionPerfect(0, 0), false);
  assert.equal(isSessionPerfect(3, 3), true);
});

test('XP_REVIEW: 四档都有经验且忘了最少', () => {
  assert.ok(XP_REVIEW.Again < XP_REVIEW.Good);
  assert.equal(XP_REVIEW.Easy, XP_REVIEW.Good);
});

test('xpForSession: 没有题目时不发整批奖励', () => {
  assert.equal(xpForSession(0, 0), 0);
  assert.ok(xpForSession(10, 1) > 10);
});

// —— streak ——
test('localDateKey: 用本地时区生成 YYYY-MM-DD', () => {
  const d = new Date(2024, 0, 5, 23, 30, 0); // 本地 2024-01-05 23:30
  assert.equal(localDateKey(d.getTime()), '2024-01-05');
});

test('computeStreak: 今天已达成则计入今天', () => {
  const info = computeStreak(
    [
      { date: '2024-01-03', xp: 60 },
      { date: '2024-01-04', xp: 55 },
      { date: '2024-01-05', xp: 50 },
    ],
    50,
    '2024-01-05',
  );
  assert.equal(info.current, 3);
  assert.equal(info.todayDone, true);
  assert.equal(info.todayXp, 50);
});

test('computeStreak: 今天未达成不清零，从昨天往前数', () => {
  const info = computeStreak(
    [
      { date: '2024-01-03', xp: 60 },
      { date: '2024-01-04', xp: 55 },
      { date: '2024-01-05', xp: 10 },
    ],
    50,
    '2024-01-05',
  );
  assert.equal(info.current, 2);
  assert.equal(info.todayDone, false);
});

test('computeStreak: 昨天断档则连续为 0', () => {
  const info = computeStreak(
    [
      { date: '2024-01-03', xp: 60 },
      { date: '2024-01-05', xp: 10 },
    ],
    50,
    '2024-01-05',
  );
  assert.equal(info.current, 0);
});

test('computeStreak: 同日多条累加', () => {
  const info = computeStreak(
    [
      { date: '2024-01-05', xp: 30 },
      { date: '2024-01-05', xp: 25 },
    ],
    50,
    '2024-01-05',
  );
  assert.equal(info.todayXp, 55);
  assert.equal(info.current, 1);
});

test('computeStreak: 未设目标时不统计连续', () => {
  const info = computeStreak([{ date: '2024-01-05', xp: 0 }], 0, '2024-01-05');
  assert.equal(info.current, 0);
  assert.equal(info.todayDone, true);
});

test('computeStreak: 空数据不崩', () => {
  const info = computeStreak([], 50, '2024-01-05');
  assert.equal(info.current, 0);
  assert.equal(info.todayXp, 0);
});

test('computeStreak: 跨月连续', () => {
  const info = computeStreak(
    [
      { date: '2024-01-31', xp: 50 },
      { date: '2024-02-01', xp: 50 },
    ],
    50,
    '2024-02-01',
  );
  assert.equal(info.current, 2);
});

test('recentDateKeys: 跨月回溯顺序正确', () => {
  assert.deepEqual(recentDateKeys('2024-03-01', 3), ['2024-02-28', '2024-02-29', '2024-03-01']);
});

// —— buildSteps ——
const session = {
  sessionId: 's1',
  mode: 'suggest' as const,
  items: [
    { id: 'i1', surface: '犬', reading: 'いぬ', pos: 'noun', meaning: '狗' },
    { id: 'i2', surface: '猫', reading: 'ねこ', pos: 'noun', meaning: '猫' },
  ],
  grammarItemId: 'g1',
  lessons: [
    { itemId: 'i1', explanation: '讲解1', examples: [{ ja: 'a', pronunciation: 'a', zh: 'a' }] },
  ],
  grammar: {
    itemId: 'g1',
    explanation: '语法讲解',
    structure: '〜は〜です',
    tips: '提示',
    examples: [{ ja: 'b', pronunciation: 'b', zh: 'b' }],
  },
  exercises: [
    { type: 'choice' as const, prompt: 'q1', options: ['a', 'b'], answer: 'a', explanation: 'e' },
    { type: 'fill' as const, prompt: 'q2', options: null, answer: 'x', explanation: 'e' },
  ],
};

test('buildSteps: intro 开头、summary 结尾，条目/语法/练习都在中间', () => {
  const steps = buildSteps(session);
  assert.equal(steps[0].kind, 'intro');
  assert.equal(steps[steps.length - 1].kind, 'summary');
  assert.equal(countExerciseSteps(steps), 2);
  // i1 有讲解 → lesson 卡；i2 无讲解 → word 卡
  assert.deepEqual(
    steps.map((s) => s.kind),
    ['intro', 'lesson', 'word', 'grammar', 'exercise', 'exercise', 'summary'],
  );
});

test('buildSteps: 纯函数，多次调用结果等长同序', () => {
  const a = buildSteps(session).map((s) => s.kind);
  const b = buildSteps(session).map((s) => s.kind);
  assert.deepEqual(a, b);
});

test('buildSteps: 没有练习时仍有 intro 与 summary', () => {
  const steps = buildSteps({ ...session, items: [], lessons: [], grammar: null, exercises: [] });
  assert.deepEqual(
    steps.map((s) => s.kind),
    ['intro', 'summary'],
  );
  assert.equal(countExerciseSteps(steps), 0);
});

test('buildSteps: 讲解引用了本批之外的条目也不会丢内容', () => {
  const steps = buildSteps({
    ...session,
    items: [],
    lessons: [{ itemId: 'orphan', explanation: 'x', examples: [{ ja: 'a', pronunciation: 'a', zh: 'a' }] }],
    grammar: null,
    exercises: [],
  });
  assert.deepEqual(
    steps.map((s) => s.kind),
    ['intro', 'lesson', 'summary'],
  );
});

// —— readPreferences（起点选择写进 interests 的偏好）——
test('readPreferences: 正常解析 skipKanaUnits', () => {
  assert.equal(readPreferences('{"skipKanaUnits":true}').skipKanaUnits, true);
  assert.equal(readPreferences('{"skipKanaUnits":false}').skipKanaUnits, false);
});

test('readPreferences: null / 非 JSON / 非对象都退化为空偏好，不抛错', () => {
  assert.deepEqual(readPreferences(null), {});
  assert.deepEqual(readPreferences(''), {});
  assert.deepEqual(readPreferences('not json'), {});
  assert.deepEqual(readPreferences('"just a string"'), {});
  assert.deepEqual(readPreferences('null'), {});
  assert.deepEqual(readPreferences('123'), {});
  assert.deepEqual(readPreferences('[1,2]'), {});
});

test('writePreferences → readPreferences 往返一致', () => {
  assert.equal(readPreferences(writePreferences({ skipKanaUnits: true })).skipKanaUnits, true);
});

// —— 语种注册表（新增语种时这些用例会立刻发现配置错误）——

test('每个 profile 的必填字段都不为空且 id 与 code 一致', () => {
  for (const p of listLanguages()) {
    assert.equal(p.id, p.code, `${p.id}: id 与 code 必须一致`);
    for (const key of ['name', 'nativeName', 'flag', 'teacherLabel', 'readingLabel', 'scriptLabel',
      'scriptUnitTitle', 'skipScriptLabel', 'levelSystem', 'ttsLocale', 'voiceLabel'] as const) {
      assert.ok(String(p[key]).length > 0, `${p.id}: ${key} 不能为空`);
    }
    assert.ok(p.teacherRules.length > 0, `${p.id}: teacherRules 不能为空`);
    assert.ok(p.startingPoints.length > 0, `${p.id}: startingPoints 不能为空`);
  }
});

test('每个 profile 的等级代码唯一且 order 从 1 连续递增', () => {
  for (const p of listLanguages()) {
    const codes = p.levels.map((l) => l.code);
    assert.equal(new Set(codes).size, codes.length, `${p.id}: 等级代码重复`);
    const orders = [...p.levels].sort((a, b) => a.order - b.order).map((l) => l.order);
    orders.forEach((o, i) => assert.equal(o, i + 1, `${p.id}: order 必须从 1 连续，实际 ${orders}`));
  }
});

test('ttsLocale 形如 xx-XX', () => {
  for (const p of listLanguages()) {
    assert.match(p.ttsLocale, /^[a-z]{2}-[A-Z]{2}$/, `${p.id}: ttsLocale 格式错误`);
  }
});

test('startingPoints 引用的等级必须存在（否则入门页会给出不存在的起点）', () => {
  for (const p of listLanguages()) {
    const codes = new Set(p.levels.map((l) => l.code));
    for (const sp of p.startingPoints) {
      assert.ok(codes.has(sp.level), `${p.id}: startingPoint 引用了不存在的等级 ${sp.level}`);
    }
  }
});

test('getLanguageProfile 对未知 id 回退默认语种而不抛错', () => {
  assert.equal(getLanguageProfile('xx').id, DEFAULT_LANGUAGE_ID);
  assert.equal(getLanguageProfile(null).id, DEFAULT_LANGUAGE_ID);
  assert.equal(getLanguageProfile(undefined).id, DEFAULT_LANGUAGE_ID);
});

test('getLevelsSorted 按 order 升序，且 getDefaultLevelCode 取第一级', () => {
  assert.deepEqual(
    getLevelsSorted('ja').map((l) => l.code),
    ['N5', 'N4', 'N3', 'N2', 'N1'],
  );
  assert.deepEqual(
    getLevelsSorted('ko').map((l) => l.code),
    ['TOPIK1', 'TOPIK2', 'TOPIK3', 'TOPIK4', 'TOPIK5', 'TOPIK6'],
  );
  assert.equal(getDefaultLevelCode('ja'), 'N5');
  assert.equal(getDefaultLevelCode('ko'), 'TOPIK1');
});

test('shiftLevelCode 越界夹到边界，未知等级回退第一级', () => {
  assert.equal(shiftLevelCode('ja', 'N5', +1), 'N4');
  assert.equal(shiftLevelCode('ja', 'N1', +1), 'N1'); // 上界
  assert.equal(shiftLevelCode('ja', 'N5', -1), 'N5'); // 下界
  assert.equal(shiftLevelCode('ko', 'TOPIK1', +2), 'TOPIK3');
  assert.equal(shiftLevelCode('ja', '不存在', +1), 'N5');
});

test('每个注册语种要么有内置课程，要么明确没有（防止注册了却学不到内容）', () => {
  for (const p of listLanguages()) {
    const course = LANGUAGE_COURSES[p.id];
    if (!course) continue; // 允许"仅 AI 生成"的语种
    assert.equal(course.language.id, p.id, `${p.id}: 课程语种不匹配`);
    assert.equal(course.units.length > 0, true, `${p.id}: 课程没有单元`);
    // 课程等级必须在 profile 里声明
    const codes = new Set(p.levels.map((l) => l.code));
    assert.ok(codes.has(course.level.code), `${p.id}: 课程等级 ${course.level.code} 未在 profile 声明`);
  }
});

test('字母入门单元的 kind 必须等于 profile 的 scriptUnitKind', () => {
  for (const p of listLanguages()) {
    const course = LANGUAGE_COURSES[p.id];
    if (!course) continue;
    const scriptUnits = course.units.filter((u) => u.kind === p.scriptUnitKind);
    assert.ok(scriptUnits.length > 0, `${p.id}: 找不到 kind=${p.scriptUnitKind} 的入门单元`);
    for (const u of scriptUnits) {
      for (const it of u.items) {
        assert.equal(it.type, p.scriptUnitKind, `${p.id}: 入门单元里的条目类型应为 ${p.scriptUnitKind}`);
      }
    }
  }
});

test('课程条目字段完整：surface/meaning 非空，word 必须有 reading 与 pos', () => {
  for (const p of listLanguages()) {
    const course = LANGUAGE_COURSES[p.id];
    if (!course) continue;
    for (const unit of course.units) {
      for (const it of unit.items) {
        assert.ok(it.surface, `${p.id}: 条目缺 surface`);
        assert.ok(it.meaning, `${p.id}/${it.surface}: 缺 meaning`);
        if (it.type === 'word') {
          assert.ok(it.reading, `${p.id}/${it.surface}: word 必须有 reading`);
          assert.ok(it.pos, `${p.id}/${it.surface}: word 必须有 pos`);
        }
        for (const ex of it.examples ?? []) {
          assert.ok(ex.ja, `${p.id}/${it.surface}: 例句缺 ja`);
          assert.ok(ex.pronunciation, `${p.id}/${it.surface}: 例句缺 pronunciation`);
          assert.ok(ex.zh, `${p.id}/${it.surface}: 例句缺 zh`);
        }
      }
    }
  }
});

test('validation 正则确实能拦下错误的发音标注', () => {
  const ja = getLanguageProfile('ja');
  assert.equal(ja.validation.readingMustNotMatch?.test('わたし'), false); // 纯假名应通过
  assert.equal(ja.validation.readingMustNotMatch?.test('私'), true); // 含汉字应被拦下

  const ko = getLanguageProfile('ko');
  assert.equal(ko.validation.readingMustNotMatch?.test('haksaeng'), false); // 罗马音应通过
  assert.equal(ko.validation.readingMustNotMatch?.test('학생'), true); // 含谚文应被拦下
});



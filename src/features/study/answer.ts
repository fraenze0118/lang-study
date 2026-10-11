// 练习判分（纯函数，无 IO）
// choice / fill 自动判分；translate 因中文表达多样，只能给参考答案 + 用户自评。
import { ExerciseKind } from '../../lib/enums';

export interface GradeOutcome {
  correct: boolean;
  /** true 时 correct 恒为 false，UI 应展示参考答案与「我写对了/我写错了」自评按钮 */
  pendingSelfCheck: boolean;
  /** 归一化后的用户答案，用于回显对比 */
  normalizedUser: string;
}

/**
 * 归一化用于比对的字符串：
 * 1. 全角 → 半角（Ａ１＃ → A1#），表意空格 U+3000 → 空格
 * 2. 去掉空白与常见中英日标点
 * 3. 转小写
 */
export function normalizeAnswer(input: string): string {
  if (!input) return '';
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x3000) {
      out += ' ';
    } else if (code >= 0xff01 && code <= 0xff5e) {
      // 全角 ASCII 区
      out += String.fromCodePoint(code - 0xfee0);
    } else {
      out += ch;
    }
  }
  return out
    .replace(/[\s\u3000]/g, '')
    .replace(/[、。，．・？！「」『』（）()［］\[\]{}｛｝:：;；'"'"`~〜…—－\-]/g, '')
    .toLowerCase();
}

export function gradeChoice(user: string, answer: string): GradeOutcome {
  const normalizedUser = normalizeAnswer(user);
  return {
    correct: normalizedUser !== '' && normalizedUser === normalizeAnswer(answer),
    pendingSelfCheck: false,
    normalizedUser,
  };
}

export function gradeFill(user: string, answer: string): GradeOutcome {
  const normalizedUser = normalizeAnswer(user);
  return {
    correct: normalizedUser !== '' && normalizedUser === normalizeAnswer(answer),
    pendingSelfCheck: false,
    normalizedUser,
  };
}

/** 翻译题不做字符串比对：交给用户自评，reference 仅作展示 */
export function gradeTranslate(user: string, _reference: string): GradeOutcome {
  return { correct: false, pendingSelfCheck: true, normalizedUser: normalizeAnswer(user) };
}

export function gradeExercise(kind: ExerciseKind, user: string, answer: string): GradeOutcome {
  switch (kind) {
    case 'choice':
      return gradeChoice(user, answer);
    case 'fill':
      return gradeFill(user, answer);
    case 'translate':
    default:
      return gradeTranslate(user, answer);
  }
}

// 语种 → 内置课程的注册表。
//
// 新增一个语种时：在本文件加一行 + 在 lib/languages.ts 注册 profile 即可，
// 播种逻辑（import.ts）会自动遍历这里。
import { Syllabus } from './types';
import { JA_N5_SYLLABUS } from './ja/n5';
import { KO_TOPIK1_SYLLABUS } from './ko/topik1';

export const LANGUAGE_COURSES: Record<string, Syllabus> = {
  ja: JA_N5_SYLLABUS,
  ko: KO_TOPIK1_SYLLABUS,
};

/** 没有内置大纲的语种返回 null（此时学习内容全靠 AI 生成） */
export function getCourse(languageId: string): Syllabus | null {
  return LANGUAGE_COURSES[languageId] ?? null;
}

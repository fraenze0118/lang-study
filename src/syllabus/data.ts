// 向后兼容入口：旧代码从 './data' 导入 N5_SYLLABUS 与类型。
// 实际数据已按语种拆到 ja/ 与 ko/，见 registry.ts。
export type {
  Syllabus,
  SyllabusExample,
  SyllabusItem,
  SyllabusLevel,
  SyllabusUnit,
  ScriptItem,
  WordItem,
  GrammarItem,
} from './types';
export { JA_N5_SYLLABUS } from './ja/n5';
export { KO_TOPIK1_SYLLABUS } from './ko/topik1';
export { LANGUAGE_COURSES, getCourse } from './registry';

import { JA_N5_SYLLABUS } from './ja/n5';

/** @deprecated 用 getCourse(languageId) 取代；保留仅为兼容旧引用 */
export const N5_SYLLABUS = JA_N5_SYLLABUS;

// 韩语 TOPIK 1 小样本大纲
//
// 罗马音采用「国立国语院罗马字标记法」的常见写法；发音标注放在 pronunciation 字段。
// 内容为入门小样本（与日语 N5 同量级），后续可按 docs/features/multi-language 扩充。
import { Syllabus } from '../types';

export const KO_TOPIK1_SYLLABUS: Syllabus = {
  language: { id: 'ko', code: 'ko', name: 'Korean' },
  level: { id: 'ko-topik1', code: 'TOPIK1', sortOrder: 1, targetVocab: 800 },
  units: [
    {
      title: '谚音入门（基本辅音·元音）',
      kind: 'hangul',
      items: [
        // 基本辅音 14
        { type: 'hangul', surface: 'ㄱ', reading: 'g/k', meaning: '辅音 ㄱ（g/k）' },
        { type: 'hangul', surface: 'ㄴ', reading: 'n', meaning: '辅音 ㄴ（n）' },
        { type: 'hangul', surface: 'ㄷ', reading: 'd/t', meaning: '辅音 ㄷ（d/t）' },
        { type: 'hangul', surface: 'ㄹ', reading: 'r/l', meaning: '辅音 ㄹ（r/l）' },
        { type: 'hangul', surface: 'ㅁ', reading: 'm', meaning: '辅音 ㅁ（m）' },
        { type: 'hangul', surface: 'ㅂ', reading: 'b/p', meaning: '辅音 ㅂ（b/p）' },
        { type: 'hangul', surface: 'ㅅ', reading: 's', meaning: '辅音 ㅅ（s）' },
        { type: 'hangul', surface: 'ㅇ', reading: 'ng', meaning: '辅音 ㅇ（作初声不发音，作终声读 ng）' },
        { type: 'hangul', surface: 'ㅈ', reading: 'j', meaning: '辅音 ㅈ（j）' },
        { type: 'hangul', surface: 'ㅊ', reading: 'ch', meaning: '辅音 ㅊ（送气 ch）' },
        { type: 'hangul', surface: 'ㅋ', reading: 'k', meaning: '辅音 ㅋ（送气 k）' },
        { type: 'hangul', surface: 'ㅌ', reading: 't', meaning: '辅音 ㅌ（送气 t）' },
        { type: 'hangul', surface: 'ㅍ', reading: 'p', meaning: '辅音 ㅍ（送气 p）' },
        { type: 'hangul', surface: 'ㅎ', reading: 'h', meaning: '辅音 ㅎ（h）' },
        // 基本元音 10
        { type: 'hangul', surface: 'ㅏ', reading: 'a', meaning: '元音 ㅏ（a）' },
        { type: 'hangul', surface: 'ㅑ', reading: 'ya', meaning: '元音 ㅑ（ya）' },
        { type: 'hangul', surface: 'ㅓ', reading: 'eo', meaning: '元音 ㅓ（eo）' },
        { type: 'hangul', surface: 'ㅕ', reading: 'yeo', meaning: '元音 ㅕ（yeo）' },
        { type: 'hangul', surface: 'ㅗ', reading: 'o', meaning: '元音 ㅗ（o）' },
        { type: 'hangul', surface: 'ㅛ', reading: 'yo', meaning: '元音 ㅛ（yo）' },
        { type: 'hangul', surface: 'ㅜ', reading: 'u', meaning: '元音 ㅜ（u）' },
        { type: 'hangul', surface: 'ㅠ', reading: 'yu', meaning: '元音 ㅠ（yu）' },
        { type: 'hangul', surface: 'ㅡ', reading: 'eu', meaning: '元音 ㅡ（eu）' },
        { type: 'hangul', surface: 'ㅣ', reading: 'i', meaning: '元音 ㅣ（i）' },
        // 复合元音 11（谚文里同样属于基本字母表）
        { type: 'hangul', surface: 'ㅐ', reading: 'ae', meaning: '元音 ㅐ（ae）' },
        { type: 'hangul', surface: 'ㅒ', reading: 'yae', meaning: '元音 ㅒ（yae）' },
        { type: 'hangul', surface: 'ㅔ', reading: 'e', meaning: '元音 ㅔ（e）' },
        { type: 'hangul', surface: 'ㅖ', reading: 'ye', meaning: '元音 ㅖ（ye）' },
        { type: 'hangul', surface: 'ㅘ', reading: 'wa', meaning: '元音 ㅘ（wa）' },
        { type: 'hangul', surface: 'ㅙ', reading: 'wae', meaning: '元音 ㅙ（wae）' },
        { type: 'hangul', surface: 'ㅚ', reading: 'oe', meaning: '元音 ㅚ（oe）' },
        { type: 'hangul', surface: 'ㅝ', reading: 'wo', meaning: '元音 ㅝ（wo）' },
        { type: 'hangul', surface: 'ㅞ', reading: 'we', meaning: '元音 ㅞ（we）' },
        { type: 'hangul', surface: 'ㅟ', reading: 'wi', meaning: '元音 ㅟ（wi）' },
        { type: 'hangul', surface: 'ㅢ', reading: 'ui', meaning: '元音 ㅢ（ui）' },
        // 紧音 5
        { type: 'hangul', surface: 'ㄲ', reading: 'kk', meaning: '紧音 ㄲ（kk）' },
        { type: 'hangul', surface: 'ㄸ', reading: 'tt', meaning: '紧音 ㄸ（tt）' },
        { type: 'hangul', surface: 'ㅃ', reading: 'pp', meaning: '紧音 ㅃ（pp）' },
        { type: 'hangul', surface: 'ㅆ', reading: 'ss', meaning: '紧音 ㅆ（ss）' },
        { type: 'hangul', surface: 'ㅉ', reading: 'jj', meaning: '紧音 ㅉ（jj）' },
      ],
    },
    {
      title: '问候与自我介绍',
      kind: 'scene',
      items: [
        {
          type: 'word',
          surface: '안녕하세요',
          reading: 'annyeonghaseyo',
          pos: 'expression',
          meaning: '你好',
          examples: [
            { ja: '안녕하세요, 만나서 반갑습니다.', pronunciation: 'annyeonghaseyo, mannaseo bangapseumnida.', zh: '你好，很高兴见到你。' },
          ],
        },
        {
          type: 'word',
          surface: '감사합니다',
          reading: 'gamsahamnida',
          pos: 'expression',
          meaning: '谢谢',
        },
        {
          type: 'word',
          surface: '죄송합니다',
          reading: 'joesonghamnida',
          pos: 'expression',
          meaning: '对不起',
        },
        {
          type: 'word',
          surface: '이름',
          reading: 'ireum',
          pos: 'noun',
          meaning: '名字',
          examples: [
            { ja: '제 이름은 김민수입니다.', pronunciation: 'je ireumeun gimminsuimnida.', zh: '我的名字是金民秀。' },
          ],
        },
        { type: 'word', surface: '학생', reading: 'haksaeng', pos: 'noun', meaning: '学生' },
        { type: 'word', surface: '선생님', reading: 'seonsaengnim', pos: 'noun', meaning: '老师' },
        { type: 'word', surface: '친구', reading: 'chingu', pos: 'noun', meaning: '朋友' },
        {
          type: 'grammar',
          surface: '～은/는 ～입니다',
          pattern: 'N은/는 N입니다',
          grammarCategory: '句型',
          meaning: '～是～（格式体敬语）',
          examples: [
            { ja: '저는 학생입니다.', pronunciation: 'jeoneun haksaengimnida.', zh: '我是学生。' },
          ],
        },
        {
          type: 'grammar',
          surface: '～이/가',
          grammarCategory: '助词',
          meaning: '主格助词（有终声用 이，无终声用 가）',
          examples: [
            { ja: '친구가 왔습니다.', pronunciation: 'chinguga watseumnida.', zh: '朋友来了。' },
          ],
        },
      ],
    },
    {
      title: '数字',
      kind: 'theme',
      items: [
        { type: 'word', surface: '하나', reading: 'hana', pos: 'noun', meaning: '一（固有数词）' },
        { type: 'word', surface: '둘', reading: 'dul', pos: 'noun', meaning: '二（固有数词）' },
        { type: 'word', surface: '셋', reading: 'set', pos: 'noun', meaning: '三（固有数词）' },
        { type: 'word', surface: '일', reading: 'il', pos: 'noun', meaning: '一（汉字数词）' },
        { type: 'word', surface: '이', reading: 'i', pos: 'noun', meaning: '二（汉字数词）' },
        { type: 'word', surface: '삼', reading: 'sam', pos: 'noun', meaning: '三（汉字数词）' },
      ],
    },
    {
      title: '日常物品',
      kind: 'theme',
      items: [
        {
          type: 'word',
          surface: '물',
          reading: 'mul',
          pos: 'noun',
          meaning: '水',
          examples: [{ ja: '물을 마십니다.', pronunciation: 'mureul masimnida.', zh: '喝水。' }],
        },
        { type: 'word', surface: '밥', reading: 'bap', pos: 'noun', meaning: '饭' },
        { type: 'word', surface: '책', reading: 'chaek', pos: 'noun', meaning: '书' },
        { type: 'word', surface: '집', reading: 'jip', pos: 'noun', meaning: '家' },
        { type: 'word', surface: '학교', reading: 'hakgyo', pos: 'noun', meaning: '学校' },
        { type: 'word', surface: '전화', reading: 'jeonhwa', pos: 'noun', meaning: '电话' },
        {
          type: 'grammar',
          surface: '～을/를',
          grammarCategory: '助词',
          meaning: '宾格助词（有终声用 을，无终声用 를）',
          examples: [
            { ja: '책을 읽습니다.', pronunciation: 'chaegeul ilgeumnida.', zh: '读书。' },
          ],
        },
      ],
    },
    {
      title: '日常动作',
      kind: 'theme',
      items: [
        { type: 'word', surface: '가다', reading: 'gada', pos: 'verb', meaning: '去' },
        { type: 'word', surface: '오다', reading: 'oda', pos: 'verb', meaning: '来' },
        { type: 'word', surface: '먹다', reading: 'meokda', pos: 'verb', meaning: '吃' },
        { type: 'word', surface: '보다', reading: 'boda', pos: 'verb', meaning: '看' },
        { type: 'word', surface: '읽다', reading: 'ikda', pos: 'verb', meaning: '读' },
        {
          type: 'word',
          surface: '공부하다',
          reading: 'gongbuhada',
          pos: 'verb',
          meaning: '学习',
          examples: [
            { ja: '한국어를 공부합니다.', pronunciation: 'hangugeoreul gongbuhamnida.', zh: '学习韩语。' },
          ],
        },
        {
          type: 'grammar',
          surface: '～아/어요',
          pattern: 'V아/어요',
          grammarCategory: '活用',
          meaning: '非格式体敬语（日常口语最常用）',
          examples: [
            { ja: '물을 마셔요.', pronunciation: 'mureul masyeoyo.', zh: '喝水。（口语）' },
          ],
        },
      ],
    },
  ],
};

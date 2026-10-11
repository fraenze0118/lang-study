// v1「每日学习包」的遗留模块。
//
// 该模型已被 v2 的「对话式发起 + 按需学习」取代（见 docs/mvp/MRFD-PRD.md），
// 其 getToday / generatePackage 与对应的 buildLearnPackagePrompt 已整体删除。
//
// 之所以保留这个文件、而不是把引用方全部改到 lib/constants：
// DEFAULT_USER_ID 被 8 个以上页面/服务引用，多语种改造期间改导入路径曾引发一次
// 批量编辑事故（见提交说明）。这里改为单向再导出，引用方无需变动，后续可安全迁移。
export { DEFAULT_USER_ID } from '../../lib/constants';

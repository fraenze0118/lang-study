// LLM 配置：从 Expo 公共环境变量读取（EXPO_PUBLIC_* 会内联进 bundle，仅个人 MVP 使用）
export const LLM_CONFIG = {
  baseUrl: process.env.EXPO_PUBLIC_LLM_BASE_URL ?? 'https://api.deepseek.com',
  apiKey: process.env.EXPO_PUBLIC_LLM_API_KEY ?? '',
  model: process.env.EXPO_PUBLIC_LLM_MODEL ?? 'deepseek-chat',
};

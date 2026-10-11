// 导航路由参数表（v2）
import type { ContentPreview } from '../features/study/service';

export type RootStackParamList = {
  Chat: undefined;
  Study: { preview: ContentPreview };
  Knowledge: undefined;
  Review: undefined;
  ItemDetail: { itemId: string };
  Ask: { itemId?: string; sessionId?: string } | undefined;
  Progress: undefined;
  Settings: undefined;
  Onboarding: undefined;
};

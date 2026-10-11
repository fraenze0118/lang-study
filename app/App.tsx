import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureSyllabusSeeded } from './src/syllabus/import';
import { resetDatabase } from './src/db/database';
import { RootStackParamList } from './src/app/navigation';
import ChatScreen from './src/app/screens/ChatScreen';
import StudyScreen from './src/app/screens/StudyScreen';
import KnowledgeScreen from './src/app/screens/KnowledgeScreen';
import ReviewScreen from './src/app/screens/ReviewScreen';
import ItemDetailScreen from './src/app/screens/ItemDetailScreen';
import AskScreen from './src/app/screens/AskScreen';
import OnboardingScreen from './src/app/screens/OnboardingScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import ProgressScreen from './src/app/screens/ProgressScreen';
import { getUser } from './src/db/userRepo';
import { DEFAULT_USER_ID } from './src/features/learn/service';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** 把任意抛出物整理成可读文本（含原生错误的 stack，便于定位） */
function describeError(e: unknown): string {
  if (e instanceof Error) {
    return [e.name + ': ' + e.message, e.stack].filter(Boolean).join('\n\n');
  }
  try {
    return typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Chat' | 'Onboarding' | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 启动分两步、各自捕获，不要把两个失败点混在一个 try 里：
    // 之前是 `try { seed(); setRoute(getUser() ? ...) } catch { setRoute('Chat') }`，
    // 一旦 seed 失败就跳到 Chat，而 Chat 首屏又会去查用户，于是再次抛错、
    // 界面永远停在「加载中…」—— 现象就是"打不开、直接退出"，且没有任何线索。
    let route: 'Chat' | 'Onboarding' = 'Onboarding';
    try {
      ensureSyllabusSeeded();
    } catch (e) {
      // 播种失败不致命：新用户照样可以进 Onboarding 重新播种
      console.warn('[startup] ensureSyllabusSeeded failed', e);
    }
    try {
      route = getUser(DEFAULT_USER_ID) ? 'Chat' : 'Onboarding';
    } catch (e) {
      // 这一步失败说明数据库本身不可用 —— 必须让用户看见，并给出自救入口
      setStartupError(describeError(e));
      return;
    }
    setInitialRoute(route);
  }, [attempt]);

  const retry = useCallback(() => {
    setStartupError(null);
    setAttempt((n) => n + 1);
  }, []);

  const hardReset = useCallback(() => {
    try {
      resetDatabase();
      setStartupError(null);
      setAttempt((n) => n + 1);
    } catch (e) {
      setStartupError(`重置数据库失败：\n${describeError(e)}`);
    }
  }, []);

  if (startupError) {
    return (
      <SafeAreaProvider>
        <ScrollView contentContainerStyle={styles.errorWrap}>
          <Text style={styles.errorTitle}>启动失败</Text>
          <Text style={styles.errorHint}>
            下面的信息可以直接截图反馈。若反复失败，可尝试「重置本地数据」——
            这会删除本机学习记录（不会影响已导出的备份）。
          </Text>
          <Text style={styles.errorBody} selectable>
            {startupError}
          </Text>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={retry}>
            <Text style={styles.btnText}>重试</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={hardReset}>
            <Text style={styles.btnText}>重置本地数据</Text>
          </Pressable>
        </ScrollView>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  if (!initialRoute) {
    return (
      <View style={styles.center}>
        <Text>加载中…</Text>
      </View>
    );
  }

  return (
    <>
      {/* SafeAreaProvider 必须包在最外层：各页面的 SafeAreaView / useSafeAreaInsets 依赖它，
          缺失时 inset 恒为 0，内容会顶到状态栏下面（首页与学习页都受影响）。 */}
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initialRoute}>
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Study" component={StudyScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Knowledge" component={KnowledgeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Review" component={ReviewScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Ask" component={AskScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Progress" component={ProgressScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { padding: 24, paddingBottom: 48, backgroundColor: '#fff' },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#b42318', marginBottom: 8 },
  errorHint: { fontSize: 14, lineHeight: 20, color: '#475467', marginBottom: 16 },
  errorBody: {
    fontSize: 12,
    lineHeight: 17,
    color: '#101828',
    backgroundColor: '#f6f7f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: { backgroundColor: '#ea580c' },
  btnDanger: { backgroundColor: '#e5484d' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureSyllabusSeeded } from './src/syllabus/import';
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

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Chat' | 'Onboarding' | null>(null);

  useEffect(() => {
    try {
      ensureSyllabusSeeded();
      setInitialRoute(getUser(DEFAULT_USER_ID) ? 'Chat' : 'Onboarding');
    } catch {
      setInitialRoute('Chat');
    }
  }, []);

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
});

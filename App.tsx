import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ensureSyllabusSeeded } from './src/syllabus/import';
import { RootStackParamList } from './src/app/navigation';
import ChatScreen from './src/app/screens/ChatScreen';
import StudyScreen from './src/app/screens/StudyScreen';
import KnowledgeScreen from './src/app/screens/KnowledgeScreen';
import ReviewScreen from './src/app/screens/ReviewScreen';
import ItemDetailScreen from './src/app/screens/ItemDetailScreen';
import AskScreen from './src/app/screens/AskScreen';
import OnboardingScreen from './src/app/screens/OnboardingScreen';
import AssessmentScreen from './src/app/screens/AssessmentScreen';
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
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'lang-study' }} />
          <Stack.Screen name="Study" component={StudyScreen} options={{ title: '学习' }} />
          <Stack.Screen name="Knowledge" component={KnowledgeScreen} options={{ title: '知识库' }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: '复习' }} />
          <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '条目详情' }} />
          <Stack.Screen name="Ask" component={AskScreen} options={{ title: '问 AI' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '进度' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Assessment" component={AssessmentScreen} options={{ title: '水平评估', headerBackVisible: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

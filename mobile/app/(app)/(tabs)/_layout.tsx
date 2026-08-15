import { Tabs } from 'expo-router';
import { colors } from '../../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="vocab" options={{ title: '単語' }} />
      <Tabs.Screen name="grammar" options={{ title: '文法' }} />
      <Tabs.Screen name="listening" options={{ title: 'リスニング' }} />
      <Tabs.Screen name="records" options={{ title: '実績' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}

/**
 * Навигация. docs/SPEC.md §6.0 — карта экранов.
 */

import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors, fonts } from '../design/tokens';
import { scale } from '../design/type';
import { AlarmCreateScreen } from '../screens/AlarmCreateScreen';
import { AlarmRingScreen } from '../screens/AlarmRingScreen';
import { FailScreen } from '../screens/FailScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ImpactScreen } from '../screens/ImpactScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RisePlusScreen } from '../screens/RisePlusScreen';
import { SquadScreen } from '../screens/SquadScreen';
import { WinScreen } from '../screens/WinScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  AlarmCreate: undefined;
  AlarmRing: undefined;
  Win: undefined;
  Fail: undefined;
  RisePlus: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Squad: '👥',
  Impact: '🌳',
  Profile: '👤',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
          height: 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: scale(11) },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Дом' }} />
      <Tabs.Screen name="Squad" component={SquadScreen} options={{ title: 'Команда' }} />
      <Tabs.Screen name="Impact" component={ImpactScreen} options={{ title: 'Импакт' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tabs.Navigator>
  );
}

export function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />

        <Stack.Screen
          name="AlarmCreate"
          component={AlarmCreateScreen}
          options={{ presentation: 'modal' }}
        />

        {/* §6.10: экран срабатывания перекрывает всё и не закрывается жестом. */}
        <Stack.Screen
          name="AlarmRing"
          component={AlarmRingScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />

        {/* Итог срабатывания тоже не закрывается свайпом: с него уходят кнопкой. */}
        <Stack.Screen name="Win" component={WinScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Fail" component={FailScreen} options={{ gestureEnabled: false }} />

        <Stack.Screen
          name="RisePlus"
          component={RisePlusScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

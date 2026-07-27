/**
 * Точка входа. Демо-режим: бэкенда нет, всё живёт в памяти.
 * Что именно отличается от продакшена — см. src/lib/store.ts и docs/DECISIONS.md ADR-012.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { Navigation } from './src/app/navigation';
import { Toast } from './src/components/animated';
import { useAppFonts } from './src/design/fonts';
import { colors } from './src/design/tokens';
import { useStore } from './src/lib/store';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Сплэш мог уже скрыться сам — гасить нечего, это не ошибка.
});

export default function App() {
  const fontsReady = useAppFonts();
  const toast = useStore((s) => s.toast);
  const hideToast = useStore((s) => s.hideToast);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  // §5.4: тост живёт 2.5 секунды.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hideToast, 2500);
    return () => clearTimeout(timer);
  }, [hideToast, toast]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Navigation />
        {toast ? (
          <View style={styles.toastLayer} pointerEvents="box-none">
            <Toast message={toast} />
          </View>
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  toastLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

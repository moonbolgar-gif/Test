/**
 * Загрузка шрифтов §5.2. Начертания подключаются под короткими именами,
 * которые используются в tokens.ts.
 */

// Импорт по подпутям, а не из корня пакета: корневой индекс реэкспортирует все
// начертания, и Metro тащит в бандл все .ttf — около мегабайта неиспользуемых
// шрифтов при §13.3 «размер приложения ≤ 60 МБ».
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces/600SemiBold_Italic';
import { useFonts } from 'expo-font';

export const fontMap = {
  Jakarta_400Regular: PlusJakartaSans_400Regular,
  Jakarta_500Medium: PlusJakartaSans_500Medium,
  Jakarta_600SemiBold: PlusJakartaSans_600SemiBold,
  Jakarta_700Bold: PlusJakartaSans_700Bold,
  Jakarta_800ExtraBold: PlusJakartaSans_800ExtraBold,
  Fraunces_600SemiBold_Italic,
};

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontMap);
  // Шрифт может не загрузиться, но это не повод не показать приложение:
  // системный fallback хуже по типографике, но лучше вечного сплэша.
  return loaded || error !== null;
}

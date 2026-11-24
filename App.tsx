import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { BuildInfo } from './src/BuildInfo';
import { UpdateBanner } from './src/UpdateBanner';
import { isQA } from './src/variant';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {isQA && (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>QA BUILD</Text>
          </View>
        )}

        <Text style={styles.title}>Cart</Text>
        <Text style={styles.count}>{count} items</Text>

        <Pressable style={styles.button} onPress={() => setCount((c) => c + 1)}>
          <Text style={styles.buttonText}>Add to cart</Text>
        </Pressable>

        {/* QA switches branch on the picker before the app (src/BranchGate.tsx), not here. */}
        {!isQA && <UpdateBanner />}

        <BuildInfo />
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  qaBadge: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  qaBadgeText: { color: 'white', fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  count: { fontSize: 20, color: '#3F3F46' },
  button: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

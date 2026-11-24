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

        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove one item"
            disabled={count === 0}
            style={({ pressed }) => [
              styles.stepButton,
              count === 0 && styles.stepButtonDisabled,
              pressed && styles.stepButtonPressed,
            ]}
            onPress={() => setCount((c) => Math.max(0, c - 1))}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>

          <Text style={styles.stepperValue}>{count}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add one item"
            style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
            onPress={() => setCount((c) => c + 1)}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>

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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPressed: { opacity: 0.7 },
  stepButtonDisabled: { backgroundColor: '#A1A1AA' },
  stepButtonText: { color: 'white', fontSize: 26, fontWeight: '700' },
  stepperValue: { fontSize: 22, fontWeight: '600', minWidth: 40, textAlign: 'center' },
});

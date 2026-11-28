import { StepperButton } from '@m0hamadreza/expo-qa-ota-design-system';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { UpdateBanner } from '../UpdateBanner';
import { isQA } from '../variant';

export default function CartScreen() {
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {isQA && (
          <View style={styles.qaBadge}>
            <Text style={styles.qaBadgeText}>QA BUILD</Text>
          </View>
        )}

        <Text style={styles.title}>Cart (CI test)</Text>
        <Text style={styles.count}>{count} items</Text>

        <View style={styles.stepper}>
          <StepperButton
            accessibilityLabel="Remove one item"
            disabled={count === 0}
            onPress={() => setCount((c) => Math.max(0, c - 1))}
          >
            {'−'}
          </StepperButton>

          <Text style={styles.stepperValue}>{count}</Text>

          <StepperButton
            accessibilityLabel="Add one item"
            onPress={() => setCount((c) => c + 1)}
          >
            +
          </StepperButton>
        </View>

        {!isQA && <UpdateBanner />}

        <Button title="Update details" onPress={() => router.navigate('/update-details')} />
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
  stepperValue: { fontSize: 22, fontWeight: '600', minWidth: 40, textAlign: 'center' },
});

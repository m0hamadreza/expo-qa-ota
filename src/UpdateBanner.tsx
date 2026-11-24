import * as Updates from 'expo-updates';
import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * Production users: expo-updates downloads new updates in the background at
 * launch. When one is ready, offer to restart now instead of waiting for the
 * next cold start.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  if (!isUpdatePending) return null;

  return (
    <Pressable style={styles.banner} onPress={() => Updates.reloadAsync()}>
      <Text style={styles.text}>A new version is ready — tap to restart</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 12,
  },
  text: { color: 'white', fontWeight: '600', textAlign: 'center' },
});

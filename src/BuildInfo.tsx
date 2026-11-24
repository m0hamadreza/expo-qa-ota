import * as Updates from 'expo-updates';
import { StyleSheet, Text, View } from 'react-native';
import { variant } from './variant';

type ManifestExtra = { branch?: string };

/** Shows which build / branch / update is running. Handy for QA screenshots. */
export function BuildInfo() {
  const { currentlyRunning } = Updates.useUpdates();
  const extra = (Updates.manifest as { extra?: ManifestExtra } | undefined)?.extra;
  const branch = extra?.branch ?? (currentlyRunning.isEmbeddedLaunch ? '(embedded)' : '?');

  const rows: [string, string][] = [
    ['variant', variant],
    ['channel', Updates.channel ?? '(dev)'],
    ['branch', branch],
    ['update', currentlyRunning.updateId?.slice(0, 8) ?? '(embedded)'],
    ['published', currentlyRunning.createdAt?.toLocaleString() ?? '-'],
    ['runtime', Updates.runtimeVersion ?? '-'],
  ];

  return (
    <View style={styles.card}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={styles.key}>{k}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F4F4F5',
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  key: { color: '#71717A', fontSize: 13 },
  value: { color: '#18181B', fontSize: 13, fontWeight: '600', flexShrink: 1 },
});

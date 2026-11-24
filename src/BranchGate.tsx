import * as Updates from 'expo-updates';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// Not part of the package's public index, but these hold the subtle header
// logic (override must rebuild the whole header set). Version is pinned exactly
// in package.json, so re-check these imports when bumping it.
import { readConfig, readLoadedState } from '@xprem/control-center/src/config';
import { listBranches, surfTo, type SurfableBranch } from '@xprem/control-center/src/surf';

/**
 * One-shot flag that survives Updates.reloadAsync(): set right before switching
 * branch, read and cleared by the next launch so it goes straight into the app
 * instead of showing this screen again. Extra params are stored natively by
 * expo-updates, so no extra native module (and no new runtimeVersion) is needed.
 */
const SKIP_GATE_PARAM = 'qa_skip_gate';
/** Only honour a flag set moments ago, so a leftover one never skips a later cold start. */
const SKIP_GATE_MAX_AGE_MS = 2 * 60 * 1000;

async function consumeSkipFlag(): Promise<boolean> {
  try {
    const params = await Updates.getExtraParamsAsync();
    const setAt = Number(params[SKIP_GATE_PARAM]);
    if (!setAt) return false;
    await Updates.setExtraParamAsync(SKIP_GATE_PARAM, null);
    return Date.now() - setAt < SKIP_GATE_MAX_AGE_MS;
  } catch {
    // Dev mode / updates disabled: no persisted flag, always show the gate.
    return false;
  }
}

function setSkipFlag(on: boolean) {
  return Updates.setExtraParamAsync(SKIP_GATE_PARAM, on ? String(Date.now()) : null).catch(() => {});
}

/**
 * The branch the "qa" channel points at (infra/bootstrap.mjs). The server leaves
 * it out of /branch_lists, so it is added here; picking it clears the pin
 * instead of pinning, which puts the device back on the channel's default.
 */
const CHANNEL_BRANCH = 'main';

type Row = { name: string; lastUpdateAt?: string; isDefault?: boolean };

function since(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

type Props = { onEnter: () => void };

/**
 * QA only: the first screen of the app. Pick a branch, press "Enter app", and
 * the app opens on that branch. Switching branch happens here and nowhere else.
 */
export function BranchGate({ onEnter }: Props) {
  const config = useMemo(() => readConfig(), []);
  const loaded = useMemo(() => readLoadedState(), []);

  const [checkingFlag, setCheckingFlag] = useState(true);
  const [branches, setBranches] = useState<SurfableBranch[] | null>(null);
  const [surfingOff, setSurfingOff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(loaded.branch);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!config) return;
    try {
      const page = await listBranches(config, undefined, true);
      setError(null);
      setSurfingOff(page === null);
      setBranches(page?.branches ?? []);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [config]);

  // Just reloaded onto the branch picked here → straight into the app.
  // Otherwise show the picker and fetch the branch list.
  useEffect(() => {
    consumeSkipFlag().then((skip) => {
      if (skip) {
        onEnter();
        return;
      }
      setCheckingFlag(false);
      void load();
    });
  }, [onEnter, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const enter = useCallback(async () => {
    if (!config || selected === null || selected === loaded.branch) {
      onEnter();
      return;
    }
    setEntering(true);
    setError(null);
    await setSkipFlag(true);
    try {
      const outcome = await surfTo(config, selected === CHANNEL_BRANCH ? null : selected);
      // 'reloading': the JS context is about to be replaced; the next launch
      // reads the flag and opens the app. Otherwise there was nothing new to
      // load (already on that update), so just go in.
      if (outcome === 'nothing-to-load') {
        await setSkipFlag(false);
        onEnter();
      }
    } catch (cause) {
      await setSkipFlag(false);
      setError((cause as Error).message);
      setEntering(false);
    }
  }, [config, selected, loaded.branch, onEnter]);

  if (checkingFlag) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const switching = selected !== null && selected !== loaded.branch;
  const rows: Row[] = [
    ...(branches?.some((b) => b.name === CHANNEL_BRANCH)
      ? []
      : [{ name: CHANNEL_BRANCH, isDefault: true }]),
    ...(branches ?? []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.qaBadge}>
          <Text style={styles.qaBadgeText}>QA BUILD</Text>
        </View>
        <Text style={styles.title}>Choose a branch</Text>
        <Text style={styles.subtitle}>
          Running now: <Text style={styles.bold}>{loaded.branch ?? 'embedded build'}</Text>
          {Updates.runtimeVersion ? `  ·  runtime ${Updates.runtimeVersion}` : ''}
        </Text>
      </View>

      {loaded.refusedBranch && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            {loaded.refusedBranch} crashed on launch and was rolled back. Publish a fix to that
            branch to test it again.
          </Text>
        </View>
      )}

      {!config ? (
        <Text style={styles.note}>
          Branch list is unavailable here (dev mode or missing update config). You can still
          enter the app.
        </Text>
      ) : branches === null && !error ? (
        <ActivityIndicator style={styles.listLoading} />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={surfingOff ? [] : rows}
          keyExtractor={(b) => b.name}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <Text style={styles.note}>
              {surfingOff
                ? 'Branch surfing is off for this channel.'
                : error
                  ? 'Could not load branches. Pull down to retry.'
                  : 'No branches published for this runtime version yet.'}
            </Text>
          }
          renderItem={({ item }: { item: Row }) => {
            const isSelected = item.name === selected;
            const isRunning = item.name === loaded.branch;
            return (
              <Pressable
                onPress={() => setSelected(item.name)}
                disabled={entering}
                style={[styles.row, isSelected && styles.rowSelected]}
              >
                <View style={[styles.radio, isSelected && styles.radioOn]} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.isDefault
                      ? 'default branch of this channel'
                      : `updated ${since(item.lastUpdateAt ?? '')}`}
                  </Text>
                </View>
                {isRunning && <Text style={styles.running}>running</Text>}
              </Pressable>
            );
          }}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.enter, entering && styles.enterBusy]}
        onPress={enter}
        disabled={entering}
      >
        {entering ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.enterText}>
            {switching ? `Enter app on ${selected}` : 'Enter app'}
          </Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 48, gap: 8, alignItems: 'flex-start' },
  qaBadge: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  qaBadgeText: { color: 'white', fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#18181B' },
  subtitle: { fontSize: 14, color: '#71717A' },
  bold: { fontWeight: '700', color: '#18181B' },
  warn: {
    marginHorizontal: 24,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF6E5',
  },
  warnText: { color: '#8A5A08', fontSize: 13 },
  list: { flex: 1, marginTop: 16 },
  listContent: { paddingHorizontal: 24, gap: 8, paddingBottom: 16 },
  listLoading: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  rowSelected: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D4D4D8' },
  radioOn: { borderColor: '#F97316', backgroundColor: '#F97316' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#18181B' },
  rowMeta: { fontSize: 13, color: '#71717A' },
  running: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  note: { paddingHorizontal: 24, paddingVertical: 24, color: '#71717A', flex: 1 },
  error: { color: '#C5221F', paddingHorizontal: 24, paddingBottom: 8 },
  enter: {
    margin: 24,
    backgroundColor: '#18181B',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  enterBusy: { opacity: 0.7 },
  enterText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

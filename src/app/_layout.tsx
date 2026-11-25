import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { BranchGateEntryContext } from '../BranchGate';
import { isQA } from '../variant';

export default function RootLayout() {
  const [entered, setEntered] = useState(!isQA);
  const enter = useCallback(() => setEntered(true), []);

  return (
    <BranchGateEntryContext.Provider value={enter}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={entered}>
          <Stack.Screen name="index" />
          <Stack.Screen name="update-details" options={{ headerShown: true, title: 'Update details' }} />
        </Stack.Protected>
        <Stack.Protected guard={!entered}>
          <Stack.Screen name="choose-branch" />
        </Stack.Protected>
      </Stack>
    </BranchGateEntryContext.Provider>
  );
}

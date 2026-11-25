import { useContext } from 'react';
import { BranchGate, BranchGateEntryContext } from '../BranchGate';

export default function ChooseBranchScreen() {
  const enter = useContext(BranchGateEntryContext);
  if (!enter) throw new Error('ChooseBranchScreen must be rendered inside RootLayout');

  return <BranchGate onEnter={enter} />;
}

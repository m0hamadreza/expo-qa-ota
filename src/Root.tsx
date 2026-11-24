import { useCallback, useState } from 'react';
import App from '../App';
import { BranchGate } from './BranchGate';
import { isQA } from './variant';

/**
 * QA build: branch picker first, then the app on the chosen branch.
 * Production build: straight into the app.
 */
export function Root() {
  const [entered, setEntered] = useState(!isQA);
  const enter = useCallback(() => setEntered(true), []);
  return entered ? <App /> : <BranchGate onEnter={enter} />;
}

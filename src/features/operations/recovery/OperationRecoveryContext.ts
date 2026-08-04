import { createContext, useContext } from 'react';

export interface OperationRecoveryController {
  refreshInbox(): Promise<void>;
}

export const OperationRecoveryContext = createContext<OperationRecoveryController | null>(null);

export function useOperationRecovery(): OperationRecoveryController {
  const controller = useContext(OperationRecoveryContext);
  if (!controller) {
    throw new Error('Operation recovery requires OperationRecoveryProvider');
  }
  return controller;
}

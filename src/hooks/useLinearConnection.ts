import { useCallback, useState } from 'react';
import type { ConnectionState } from '../components/IssuePanel';
import type { Connection } from '../model';
import { connectLinear, desktop, disconnectLinear, errorText, linearConnection } from '../native';
import { play } from '../sound';
import { useStore } from '../store';
import type { Notify } from './useToasts';

/** The Linear workspace this device is signed in to, and the actions that change it. */
export function useLinearConnection(notify: Notify) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState('');

  const refreshConnection = useCallback(async () => {
    if (!desktop) return;
    setConnectionState('loading');
    try {
      const c = await linearConnection(); setConnection(c); setConnectionError(''); setConnectionState('idle');
      // The issue panel picks the remembered team for drafts without one.
      const { session: s, patch } = useStore.getState();
      if (c && !s.issue && s.teamId && !c.teams.some(t => t.id === s.teamId)) patch({ teamId: '', projectId: '', assigneeId: '', labelIds: [] });
    } catch (e) { setConnection(null); setConnectionError(errorText(e)); setConnectionState('unreachable'); }
  }, []);
  const connect = useCallback(async () => {
    setConnectionState('connecting'); setConnectionError('');
    try { await connectLinear(); await refreshConnection(); notify('Linear connected.'); play('success'); }
    catch (e) { setConnectionState('error'); setConnectionError(errorText(e)); }
  }, [notify, refreshConnection]);
  const disconnect = useCallback(async () => { await disconnectLinear(); setConnection(null); setConnectionState('idle'); }, []);
  return { connection, connectionState, connectionError, refreshConnection, connect, disconnect };
}

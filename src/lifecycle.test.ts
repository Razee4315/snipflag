import { describe, expect, it } from 'vitest';
import { saveBeforeQuit } from './lifecycle';

describe('save-before-quit handshake', () => {
  it('commits active editing and waits for durability before acknowledging exit', async () => {
    const calls: string[] = []; let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const quit = saveBeforeQuit({ isBusy: () => false, commit: () => { calls.push('commit'); }, lock: value => { calls.push(`lock:${value}`); },
      save: async () => { calls.push('save'); await pending; }, finish: async saved => { calls.push(`exit:${saved}`); } });
    expect(calls).toEqual(['commit', 'lock:true', 'save']);
    release(); await quit;
    expect(calls).toEqual(['commit', 'lock:true', 'save', 'exit:true', 'lock:false']);
  });
  it('keeps the app open after a disk failure or during submission', async () => {
    const results: boolean[] = [];
    const actions = { isBusy: () => false, commit: () => {}, lock: () => {}, save: async () => { throw new Error('disk full'); }, finish: async (saved: boolean) => { results.push(saved); } };
    await expect(saveBeforeQuit(actions)).rejects.toThrow('disk full');
    await expect(saveBeforeQuit({ ...actions, isBusy: () => true })).rejects.toThrow('current operation');
    expect(results).toEqual([false, false]);
  });
});

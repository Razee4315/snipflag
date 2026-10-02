import { describe, expect, it } from 'vitest';
import { filterSessions } from './history';

const session = (title: string, description = '', sent = '', captions: string[] = []) => ({
  title, description, issue: sent ? { id: sent, identifier: sent, url: '' } : null,
  images: captions.map(name => ({ id: name, name, width: 1, height: 1, dataUrl: '', annotations: [] })),
});
const sessions = [session('Checkout total is wrong', 'Seen on staging'), session('Login button overlaps', '', 'ENG-42', ['Footer']), session('', 'Untitled notes about checkout')];

describe('history search', () => {
  it('matches every typed word across title, description, captions and issue identifier', () => {
    expect(filterSessions(sessions, 'checkout', 'all')).toEqual([sessions[0], sessions[2]]);
    expect(filterSessions(sessions, 'CHECKOUT staging', 'all')).toEqual([sessions[0]]);
    expect(filterSessions(sessions, 'eng-42', 'all')).toEqual([sessions[1]]);
    expect(filterSessions(sessions, 'footer', 'all')).toEqual([sessions[1]]);
    expect(filterSessions(sessions, 'nothing here', 'all')).toEqual([]);
    expect(filterSessions(sessions, '   ', 'all')).toEqual(sessions);
  });
  it('separates drafts from sent sessions', () => {
    expect(filterSessions(sessions, '', 'sent')).toEqual([sessions[1]]);
    expect(filterSessions(sessions, '', 'drafts')).toEqual([sessions[0], sessions[2]]);
    expect(filterSessions(sessions, 'checkout', 'sent')).toEqual([]);
  });
});

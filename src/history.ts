import type { Session } from './model';

export type HistoryFilter = 'all' | 'drafts' | 'sent';
type Listed = Pick<Session, 'title' | 'description' | 'issue' | 'images'>;

/** Sessions matching the filter whose title, description, captions or issue identifier contain every word typed. */
export function filterSessions<T extends Listed>(sessions: T[], query: string, filter: HistoryFilter): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return sessions.filter(s => {
    if (filter === 'drafts' && s.issue) return false;
    if (filter === 'sent' && !s.issue) return false;
    const text = [s.title, s.description, s.issue?.identifier ?? '', ...s.images.map(i => i.name)].join('\n').toLowerCase();
    return words.every(w => text.includes(w));
  });
}

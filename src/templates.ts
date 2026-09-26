import type { Session, Settings, TeamDefaults, TeamOptions, Template } from './model';

export const DEFAULT_TEMPLATES: Template[] = [
  { id: 'bug', name: 'Bug report', body: '## Steps to reproduce\n1. \n\n## Expected result\n\n## Actual result\n\n## Environment\n' },
  { id: 'visual', name: 'Visual defect', body: '## Expected appearance\n\n## Actual appearance\n\n## Affected screen\n' },
  { id: 'regression', name: 'Regression', body: '## Previously worked in\n\n## Fails in\n\n## Reproduction\n1. \n' },
  { id: 'design', name: 'Design feedback', body: '## Reference\n\n## Implementation difference\n\n## Suggested adjustment\n' },
];
export const TEMPLATE_LIMITS = { count: 20, name: 60, body: 5000 };
export const templatesOf = (settings: Pick<Settings, 'templates'>) => settings.templates ?? DEFAULT_TEMPLATES;
/** Names are trimmed and never empty, matching the Rust validation. */
export function tidyTemplates(templates: Template[] | null): Template[] | null {
  return templates && templates.map(t => ({ ...t, name: t.name.trim() || 'Untitled template' }));
}

const MAX_TEAMS = 100;
/** Remembers what was actually sent to a team; the newest team is kept when the list is full. */
export function rememberDetails(all: Record<string, TeamDefaults>, session: Pick<Session, 'teamId' | 'projectId' | 'assigneeId' | 'labelIds' | 'priority'>) {
  if (!session.teamId) return all;
  const rest = Object.entries(all).filter(([team]) => team !== session.teamId).slice(-(MAX_TEAMS - 1));
  const details: TeamDefaults = { projectId: session.projectId, assigneeId: session.assigneeId, labelIds: session.labelIds.slice(0, 50), priority: session.priority };
  return Object.fromEntries([...rest, [session.teamId, details]]);
}
/**
 * Fills only empty fields of a draft from remembered details, keeping IDs the team still offers.
 * Returns null when nothing would change.
 */
export function detailsToFill(session: Pick<Session, 'projectId' | 'assigneeId' | 'labelIds' | 'priority'>, remembered: TeamDefaults | undefined, options: TeamOptions): Partial<Session> | null {
  if (!remembered) return null;
  const fill: Partial<Session> = {};
  if (!session.projectId && options.projects.some(p => p.id === remembered.projectId)) fill.projectId = remembered.projectId;
  if (!session.assigneeId && options.members.some(m => m.id === remembered.assigneeId)) fill.assigneeId = remembered.assigneeId;
  const labels = remembered.labelIds.filter(id => options.labels.some(l => l.id === id));
  if (!session.labelIds.length && labels.length) fill.labelIds = labels;
  if (!session.priority && remembered.priority) fill.priority = remembered.priority;
  return Object.keys(fill).length ? fill : null;
}

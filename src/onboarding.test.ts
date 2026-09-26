import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { defaults } from './model';
import SettingsDialog from './components/SettingsDialog';

vi.mock('./native', async importOriginal => ({ ...await importOriginal<typeof import('./native')>(), desktop: true }));

function connectionMarkup(builtin: boolean, clientId = '') {
  return renderToStaticMarkup(createElement(SettingsDialog, {
    settings: { ...defaults, clientId }, status: { version: 'test', platform: 'windows', shortcutError: null, builtinLinearClient: builtin },
    connection: null, connectionState: 'idle', connectionError: '',
    onSave: async () => {}, onConnect: () => {}, onCancelConnect: () => {}, onDisconnect: async () => {}, onClearHistory: async () => {}, onClose: () => {},
  }));
}

describe('Linear onboarding availability', () => {
  it('offers direct connection with empty saved settings in a configured build', () => {
    const html = connectionMarkup(true);
    expect(html).toMatch(/<button[^>]*class="button primary"(?![^>]*disabled)[^>]*>Connect Linear<\/button>/);
    expect(html).not.toContain('This build has no built-in');
    expect(html).toContain('<details class="setup">');
  });
  it('explains missing configuration and disables connection until custom setup', () => {
    const html = connectionMarkup(false);
    expect(html).toContain('This build has no built-in');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Connect Linear<\/button>/);
    expect(connectionMarkup(false, 'custom')).not.toMatch(/<button[^>]*disabled=""[^>]*>Connect Linear<\/button>/);
  });
  it('preserves a custom application and offers return to the built-in connection', () => {
    const html = connectionMarkup(true, 'existing-custom');
    expect(html).toContain('value="existing-custom"');
    expect(html).toContain('Using your custom Linear application.');
    expect(html).toContain('Use built-in connection');
  });
});

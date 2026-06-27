import { describe, it, expect } from 'vitest';

import type { CloudBackup } from '@nodea/shared';

import { normalizeBaseUrl, basicAuth } from './webdav';

type WebdavCred = Extract<CloudBackup, { provider: 'webdav' }>;

const cred = (over: Partial<WebdavCred> = {}): WebdavCred => ({
  provider: 'webdav',
  baseUrl: 'https://cloud.example.com',
  username: 'alice',
  appPassword: 'abc-def-ghi',
  ...over,
});

describe('webdav helpers', () => {
  it('normalizeBaseUrl trims, drops trailing slashes and a pasted /remote.php tail', () => {
    expect(normalizeBaseUrl('  https://cloud.example.com/  ')).toBe(
      'https://cloud.example.com',
    );
    // A user who pastes the full WebDAV URL from Nextcloud must still resolve to
    // the bare origin — else we'd build …/remote.php/dav/.../remote.php/dav/…
    expect(
      normalizeBaseUrl('https://cloud.example.com/remote.php/dav/files/alice/'),
    ).toBe('https://cloud.example.com');
    // Sub-path installs (Nextcloud under /nextcloud) are preserved.
    expect(normalizeBaseUrl('https://host.tld/nextcloud/')).toBe(
      'https://host.tld/nextcloud',
    );
  });

  it('basicAuth encodes user:appPassword as RFC 7617 Basic, UTF-8 safe', () => {
    // base64("alice:abc-def-ghi") — pins the auth-header composition.
    expect(basicAuth(cred())).toBe('Basic YWxpY2U6YWJjLWRlZi1naGk=');
    // A unicode login is why we don't call btoa() directly (it throws on
    // non-latin1); the shared UTF-8 base64 encoder must handle it.
    expect(() => basicAuth(cred({ username: 'rené' }))).not.toThrow();
  });
});

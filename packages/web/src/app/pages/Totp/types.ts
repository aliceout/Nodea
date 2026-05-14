/** State machine for the TOTP page. Lives in its own file so
 *  `SetupFlow` and `RegenFlow` can re-import the discriminated
 *  union without pulling in the full `index.tsx` orchestrator. */
export type Stage =
  | { kind: 'list' }
  | {
      kind: 'setup';
      sub: 'secret' | 'codes';
      data: {
        secretBase32: string;
        otpauthUri: string;
        backupCodes: string[];
      };
    }
  | { kind: 'regen'; sub: 'password' | 'display'; codes?: string[] }
  | { kind: 'disable' };

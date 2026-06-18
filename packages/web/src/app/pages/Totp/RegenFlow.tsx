import type { useSession } from '@/core/auth/use-session';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import BackupCodesPanel from './BackupCodesPanel';
import PasswordPanel from './PasswordPanel';
import type { Stage } from './types';

interface RegenFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'regen' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

/** Two-step regeneration sequence : `password` (fresh reauth) →
 *  `display` (the new 10 codes, with the old lot already
 *  invalidated server-side). Same `BackupCodesPanel` as the
 *  initial setup, with regeneration-specific copy. */
export default function RegenFlow({
  session,
  stage,
  setStage,
  onCancel,
  onDone,
}: RegenFlowProps) {
  const { t } = useI18n();
  if (stage.sub === 'password') {
    return (
      <PasswordPanel
        title={t('auth.totp.regen.title')}
        body={t('auth.totp.regen.body')}
        cta={t('auth.totp.regen.cta')}
        onCancel={onCancel}
        onSubmit={async (password) => {
          const codes = await session.regenerateTotpBackupCodes(password);
          setStage({ kind: 'regen', sub: 'display', codes });
        }}
      />
    );
  }

  if (stage.sub === 'display' && stage.codes) {
    return (
      <BackupCodesPanel
        eyebrow={t('auth.totp.list.eyebrow')}
        title={t('auth.totp.regen.display.title')}
        alertBody={t('auth.totp.regen.display.alertBody')}
        ackLabel={t('auth.totp.regen.display.ackLabel')}
        codes={stage.codes}
        onDone={onDone}
      />
    );
  }

  return null;
}

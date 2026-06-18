import type { useSession } from '@/core/auth/use-session';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import BackupCodesPanel from './BackupCodesPanel';
import SecretPanel from './SecretPanel';
import type { Stage } from './types';

interface SetupFlowProps {
  session: ReturnType<typeof useSession>;
  stage: Extract<Stage, { kind: 'setup' }>;
  setStage: (s: Stage) => void;
  onCancel: () => void;
  onDone: () => void;
}

/** Two-step setup sequence : `secret` (QR + base32 + verify code)
 *  → `codes` (backup codes display + ack). Stage transition is
 *  driven by the parent ; this is just a router on `stage.sub`. */
export default function SetupFlow({
  session,
  stage,
  setStage,
  onCancel,
  onDone,
}: SetupFlowProps) {
  const { t } = useI18n();
  if (stage.sub === 'secret') {
    const data = stage.data;
    return (
      <SecretPanel
        data={data}
        session={session}
        onCancel={onCancel}
        onActivated={() => setStage({ kind: 'setup', sub: 'codes', data })}
      />
    );
  }

  if (stage.sub === 'codes') {
    return (
      <BackupCodesPanel
        eyebrow={t('auth.totp.setup.codes.eyebrow')}
        title={t('auth.totp.setup.codes.title')}
        alertBody={t('auth.totp.setup.codes.alertBody')}
        ackLabel={t('auth.totp.setup.codes.ackLabel')}
        codes={stage.data.backupCodes}
        onDone={onDone}
      />
    );
  }

  return null;
}

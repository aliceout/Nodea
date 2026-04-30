import { useNavigate } from 'react-router-dom';

import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import DescribedSection from '../components/DescribedSection';
import { modeLabelKey } from '../lib/security-mode';

/** « Sécurité » tab — five rows that link to the dedicated auth
 *  pages for recovery code, password rotation, TOTP enrol, passkey
 *  management, and security mode picker. Order leads with the
 *  « must-have safety net » (recovery code) so a fresh user is
 *  nudged to set it before doing anything else, then « always there »
 *  (password) → « extra factors » (TOTP, passkey) → « how factors
 *  combine » (security mode). Stateless on its own; each link
 *  target owns its own flow. */
export default function SecurityTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const recoveryCodeSet = user?.recoveryCodeSet === true;
  const passkeysCount = user?.passkeysCount ?? 0;
  const totpEnabled = user?.totpEnabled === true;
  const modeLabel = t(
    `account.security.mode.labels.${modeLabelKey(user?.securityMode ?? 'password_or_passkey')}`,
  );

  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <DescribedSection
        title={t('account.security.recoveryCode.title')}
        description={
          recoveryCodeSet
            ? t('account.security.recoveryCode.descriptionSet')
            : t('account.security.recoveryCode.descriptionUnset')
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/recovery-code')}>
          {recoveryCodeSet
            ? t('account.security.recoveryCode.ctaSet')
            : t('account.security.recoveryCode.ctaUnset')}
        </Button>
      </DescribedSection>

      <DescribedSection
        title={t('account.security.password.title')}
        description={t('account.security.password.description')}
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/change-password')}>
          {t('account.security.password.cta')}
        </Button>
      </DescribedSection>

      <DescribedSection
        title={t('account.security.totp.title')}
        description={
          totpEnabled
            ? (
              <>
                <span className="font-semibold text-accent-deep">
                  {t('account.security.totp.statusEnabled')}
                </span>
                <br />
                {t('account.security.totp.descriptionEnabledTail')}
              </>
            )
            : t('account.security.totp.descriptionDisabled')
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/totp')}>
          {totpEnabled
            ? t('account.security.totp.ctaEnabled')
            : t('account.security.totp.ctaDisabled')}
        </Button>
      </DescribedSection>

      <DescribedSection
        title={t('account.security.passkey.title')}
        description={
          passkeysCount === 0
            ? t('account.security.passkey.descriptionEmpty')
            : (
              <>
                <span className="font-semibold text-accent-deep">
                  {passkeysCount === 1
                    ? t('account.security.passkey.countOne', {
                        values: { count: passkeysCount },
                      })
                    : t('account.security.passkey.countOther', {
                        values: { count: passkeysCount },
                      })}
                </span>
                <br />
                {t('account.security.passkey.descriptionExtras')}
              </>
            )
        }
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/passkeys')}>
          {passkeysCount === 0
            ? t('account.security.passkey.ctaEmpty')
            : t('account.security.passkey.ctaManage')}
        </Button>
      </DescribedSection>

      <DescribedSection
        title={t('account.security.mode.title')}
        description={t('account.security.mode.description', {
          values: { mode: modeLabel },
        })}
      >
        <Button variant="primary" size="sm" onClick={() => navigate('/security-mode')}>
          {t('account.security.mode.cta')}
        </Button>
      </DescribedSection>
    </div>
  );
}

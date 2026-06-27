import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  WebdavCredentialsSchema,
  type CloudBackup,
  type WebdavCredentials,
} from '@nodea/shared';

import { getProvider } from '@/core/cloud-backup/registry';
import { WebdavError } from '@/core/cloud-backup/providers/webdav';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

interface WebdavConnectFormProps {
  /** Called with the validated credential once the live PROPFIND check passes;
   *  the panel seals it into the encrypted preferences. */
  onConnected: (cred: CloudBackup) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * WebDAV / Nextcloud connect form.
 *
 * WHAT  Three fields (server URL · login · app-password) → React Hook Form +
 *       the shared Zod schema (the forms rule: 2+ fields ⇒ RHF). On submit it
 *       validates the credential LIVE through the provider (a read-only
 *       PROPFIND) before handing it back to be sealed.
 * WHERE Account → Données → Sauvegarde automatique, shown when the user picks
 *       WebDAV in the provider dropdown (a `connectKind: 'credentials'`
 *       provider, unlike the OAuth-popup Dropbox/pCloud).
 * WHY   The provider's failure is otherwise an opaque "Failed to fetch": we map
 *       its distinct codes (`cors`/`auth`/`path`) to actionable copy, because a
 *       blocked CORS preflight (app not installed / origin not whitelisted) is
 *       browser-indistinguishable from a wrong URL or a network outage.
 */
export default function WebdavConnectForm({
  onConnected,
  onCancel,
}: WebdavConnectFormProps) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WebdavCredentials>({
    resolver: zodResolver(WebdavCredentialsSchema),
    defaultValues: { baseUrl: '', username: '', appPassword: '' },
  });

  async function onSubmit(values: WebdavCredentials): Promise<void> {
    setServerError(null);
    try {
      const cred = await getProvider('webdav').connect(values);
      await onConnected(cred);
    } catch (err) {
      const code = err instanceof WebdavError ? err.code : 'cors';
      setServerError(t(`account.data.cloudBackup.webdav.error.${code}`));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full max-w-[18rem]"
    >
      <Field
        label={t('account.data.cloudBackup.webdav.serverLabel')}
        type="url"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="https://cloud.exemple.com"
        error={
          errors.baseUrl
            ? t('account.data.cloudBackup.webdav.serverInvalid')
            : undefined
        }
        {...field('baseUrl')}
      />
      <Field
        label={t('account.data.cloudBackup.webdav.usernameLabel')}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={
          errors.username
            ? t('account.data.cloudBackup.webdav.required')
            : undefined
        }
        {...field('username')}
      />
      <Field
        label={t('account.data.cloudBackup.webdav.appPasswordLabel')}
        type="password"
        autoComplete="off"
        legend={t('account.data.cloudBackup.webdav.appPasswordHint')}
        error={
          errors.appPassword
            ? t('account.data.cloudBackup.webdav.required')
            : undefined
        }
        {...field('appPassword')}
      />
      {serverError ? <InlineAlert className="mb-3">{serverError}</InlineAlert> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting
            ? t('account.data.cloudBackup.connecting')
            : t('account.data.cloudBackup.webdav.submit')}
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('account.data.cloudBackup.webdav.cancel')}
        </Button>
      </div>
    </form>
  );
}

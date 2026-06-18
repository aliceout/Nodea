import { Link } from 'react-router-dom';
import type { PasskeyListItem } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';
import RowCard from '@/ui/dirk/module/RowCard';

interface ListViewProps {
  passkeys: PasskeyListItem[] | null;
  prfCount: number;
  error: string | null;
  onAdd: () => void;
  onRename: (p: PasskeyListItem) => void;
  onRemove: (p: PasskeyListItem) => void;
}

/**
 * Default surface — list of enrolled passkeys with Rename +
 * Remove actions per row. Headline reflects the PRF-capable
 * count so the user understands which credentials can unlock
 * data on their own (vs which only authenticate the session
 * but still require the password to decrypt entries).
 *
 * Empty / loading / populated states all read off the same
 * `passkeys` prop : `null` = loading, `[]` = empty.
 */
export default function ListView({
  passkeys,
  prfCount,
  error,
  onAdd,
  onRename,
  onRemove,
}: ListViewProps) {
  const { t, tn } = useI18n();

  let subtitle: string;
  if (passkeys === null) {
    subtitle = t('common.states.loading');
  } else if (passkeys.length === 0) {
    subtitle = t('auth.passkeys.list.empty');
  } else {
    subtitle = t('auth.passkeys.list.subtitle', {
      values: {
        count: tn('auth.passkeys.list.countLabel', passkeys.length),
        prf: tn('auth.passkeys.list.prfLabel', prfCount),
        note: prfCount === 0 ? t('auth.passkeys.list.prfNone') : '',
      },
    });
  }

  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.passkeys.list.eyebrow')}
        title={t('auth.passkeys.list.title')}
        subtitle={subtitle}
      />

      {error ? <InlineAlert className="mb-4">{error}</InlineAlert> : null}

      {passkeys && passkeys.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {passkeys.map((p) => (
            <PasskeyRow
              key={p.id}
              passkey={p}
              onRename={() => onRename(p)}
              onRemove={() => onRemove(p)}
            />
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onAdd}
        className="mt-2 w-full"
      >
        {t('auth.passkeys.list.addCta')}
      </Button>

      <div className="mt-4.5 text-center text-[12.5px] text-muted">
        <Link
          to="/flow"
          className="cursor-pointer transition-colors hover:text-ink"
        >
          {t('auth.passkeys.list.back')}
        </Link>
      </div>
    </>
  );
}

interface PasskeyRowProps {
  passkey: PasskeyListItem;
  onRename: () => void;
  onRemove: () => void;
}

function PasskeyRow({ passkey, onRename, onRemove }: PasskeyRowProps) {
  const { t } = useI18n();
  return (
    <RowCard>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">
            {passkey.label ?? t('auth.passkeys.row.unnamed')}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">
            {passkey.prfSupported ? (
              <span className="text-accent-deep">
                {t('auth.passkeys.row.decrypts')}
              </span>
            ) : (
              <span>{t('auth.passkeys.row.loginOnly')}</span>
            )}
            {passkey.lastUsedAt ? (
              <span>
                {' · '}
                {t('auth.passkeys.row.lastUsed', {
                  values: { date: formatDate(passkey.lastUsedAt) },
                })}
              </span>
            ) : (
              <span> · {t('auth.passkeys.row.neverUsed')}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="neutral"
            size="xs"
            onClick={onRename}
          >
            {t('auth.passkeys.row.rename')}
          </Button>
          <Button
            type="button"
            variant="danger-outline"
            size="xs"
            onClick={onRemove}
          >
            {t('auth.passkeys.row.remove')}
          </Button>
        </div>
      </div>
    </RowCard>
  );
}

/** « 12 mars » short FR date used on the « Utilisée » line.
 *  Kept local because it's the only surface that wants the
 *  no-year compact form ; the shared `formatLongDate` adds the
 *  year, which would clutter the row. Catches `Date` parse
 *  errors so a malformed `lastUsedAt` falls back to the raw
 *  string. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

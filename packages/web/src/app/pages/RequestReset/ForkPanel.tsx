import { Link, useNavigate } from 'react-router-dom';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import AuthPanelHeader from '@/ui/dirk/auth/AuthPanelHeader';

/**
 * Entry-point fork (REFACTO-12 split) : ask whether the user has
 * a recovery code. Two equally-weighted buttons ; the « j'ai un
 * code » button is the non-destructive path (so primary visual
 * weight) while « j'ai pas de code » leads into the destructive
 * form (secondary weight).
 *
 * Most users with a code shouldn't even see the destructive form —
 * the fork keeps the colorful destructive warning out of the
 * default layout.
 */
export default function ForkPanel({ onNoCode }: { onNoCode: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <>
      <AuthPanelHeader
        eyebrow={t('auth.requestReset.fork.eyebrow')}
        title={t('auth.requestReset.fork.title')}
        subtitle={t('auth.requestReset.fork.subtitle')}
      />

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={() => navigate('/recover')}
        className="w-full"
      >
        {t('auth.requestReset.fork.hasCodeCta')}
      </Button>

      <Button
        type="button"
        variant="danger-outline"
        size="lg"
        onClick={onNoCode}
        className="mt-2 w-full"
      >
        {t('auth.requestReset.fork.noCodeCta')}
      </Button>

      <div className="mt-[18px] text-center text-[12.5px] text-muted">
        <Link to="/login" className="cursor-pointer transition-colors hover:text-ink">
          {t('auth.requestReset.backToLogin')}
        </Link>
      </div>
    </>
  );
}

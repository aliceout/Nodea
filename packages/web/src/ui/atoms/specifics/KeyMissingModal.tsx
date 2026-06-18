import { DialogTitle } from '@headlessui/react';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import { Modal } from '@/ui/atoms/layout/Modal';

interface KeyMissingModalProps {
  onLogout: () => void;
  open?: boolean;
}

/**
 * Blocking modal — Direction K · Sauge.
 *
 * Shown when the in-memory main key is missing (page reload with a
 * valid session cookie but no password to re-derive it). The only
 * way out is to log out and log back in, so `onClose` is a no-op:
 * Esc and outside-click stay disabled.
 *
 * Reuses the shared `Modal` atom (Dialog/Transition shell) so the
 * visual weight matches other K surfaces (papier crème, hairline
 * border, 12 px radius, soft shadow). Uses the `sm` / `center` variant
 * — a short prompt centred on screen rather than the content-modal
 * drop. `DialogTitle` still resolves the Dialog context Modal renders,
 * so the panel keeps its `aria-labelledby` wiring.
 */
export default function KeyMissingModal({ onLogout, open = true }: KeyMissingModalProps) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={() => undefined} size="sm" align="center">
      <div className="flex flex-col items-stretch gap-3 px-6 py-6 text-center">
        <DialogTitle className="text-[18px] font-semibold tracking-[-0.01em] text-ink">
          {t('auth.login.keyMissingModal.title')}
        </DialogTitle>
        <p className="text-[13.5px] leading-[1.5] text-ink-soft">
          {t('auth.login.keyMissingModal.description')}
        </p>
        <Button variant="primary" size="md" onClick={onLogout} autoFocus className="mx-auto mt-2">
          {t('auth.login.keyMissingModal.logout')}
        </Button>
      </div>
    </Modal>
  );
}

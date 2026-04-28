import { useRef, type ChangeEvent } from 'react';
import Button from '@/ui/atoms/dirk/Button';

interface Props {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap — payload is encrypted and uploaded on save.

/**
 * Read the chosen image as a base64url data URL so the string lives
 * inside the encrypted payload (no separate upload endpoint).
 *
 * The encoded value gets AES-GCM-wrapped along with the rest of the
 * payload when the review is saved — the server never sees pixels.
 */
export default function YearImageStep({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement | null>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      alert('Fichier trop volumineux (2 Mo max).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') onChange(result);
    };
    reader.onerror = () => {
      alert("Impossible de lire l'image.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      {value ? (
        <img
          src={value}
          alt="Image de l'année"
          className="max-h-96 w-full rounded-md border border-hair object-contain"
        />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-hair text-[13px] italic text-muted">
          Aucune image choisie.
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => input.current?.click()}
        >
          {value ? 'Remplacer' : 'Choisir une image'}
        </Button>
        {value ? (
          <Button
            variant="neutral"
            size="sm"
            onClick={() => onChange(undefined)}
          >
            Retirer
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] leading-[1.5] text-muted">
        L'image est chiffrée avec le reste du bilan — le serveur ne la voit jamais
        en clair. Taille maximale : 2 Mo.
      </p>
    </div>
  );
}

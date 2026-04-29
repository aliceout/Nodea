import { useState } from 'react';

import Footer from '../components/Footer';
import { SIMPLE_PLACEHOLDERS, type SimpleType } from '../lib/constants';
import { submitOnCmdEnter } from '../lib/format';

interface SimpleBodyProps {
  type: SimpleType;
  onClose: () => void;
}

/**
 * Free-text body for modules that haven't been wired through
 * yet (`habit`, `note`). Single Instrument-Serif textarea with
 * a module-specific placeholder ; submitting just closes the
 * modal — there's nothing to persist server-side until the
 * matching encryption pipeline lands.
 *
 * `Cmd/Ctrl+Enter` triggers the close exactly like the typed
 * bodies' submits do, so the keyboard contract stays uniform.
 */
export default function SimpleBody({ type, onClose }: SimpleBodyProps) {
  const [text, setText] = useState('');
  return (
    <>
      <div className="px-[22px] pt-3.5 pb-3">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, onClose)}
          placeholder={SIMPLE_PLACEHOLDERS[type]}
          className="block min-h-[90px] w-full resize-none border-0 bg-transparent font-serif text-[19px] leading-[1.5] text-ink placeholder:text-muted-soft focus:outline-none"
        />
      </div>
      <Footer onSubmit={onClose} />
    </>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown-html';
import { cn } from '@/lib/utils';
import DirkButton from '@/ui/atoms/dirk/Button';

import MarkdownToggle from './MarkdownToggle';

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Default `'visual'` (Word-like contentEditable).
   *  `'markdown'` exposes the raw source in a textarea for
   *  users who'd rather type the markers directly. */
  mode?: 'visual' | 'markdown';
  /** Called when the user flips the in-toolbar mode toggle. */
  onModeChange?: (next: 'visual' | 'markdown') => void;
  /** Minimum height of the writing surface in pixels (defaults
   *  to 180). Lets a host module (e.g. Library Composer, where
   *  the form has a lot of fields above and a fixed-height
   *  modal) tune the editor to fill the available space. */
  minHeightPx?: number;
  /** Maximum height of the writing surface in pixels (defaults
   *  to 360). Beyond this the editor scrolls internally so the
   *  modal doesn't grow taller than the viewport — the
   *  « Enregistrer » footer below the editor stays reachable
   *  on long entries. */
  maxHeightPx?: number;
  /** Placeholder shown when the surface is empty. Both modes
   *  use the same string — visual mode wires it via a CSS
   *  pseudo on the contentEditable, Markdown mode via the
   *  native textarea placeholder attribute. */
  placeholder?: string;
  /** When true, the writing surface drops `min/maxHeightPx`
   *  and fills its parent's height instead (`flex-1 min-h-0`
   *  + internal scroll). Use this when the host owns the
   *  vertical sizing — e.g. the Library Composer where the
   *  editor sits in a `flex-col h-[600px]` body and should
   *  soak up whatever room is left after the other fields.
   *  The toolbar stays sticky on top via `shrink-0`. Default
   *  `false` (legacy fixed sizing). */
  fillParent?: boolean;
  /** Id of an external description (typically the host form's
   *  `role="alert"` error line) wired to the writing surface via
   *  `aria-describedby` — both the visual contentEditable and the
   *  markdown textarea carry it so assistive tech announces the
   *  error in context (audit 2026-06, lot G). */
  ariaDescribedBy?: string | undefined;
}

/**
 * Two-mode editor for the Journal Composer :
 *
 * - **visual** (default) : a `contentEditable` surface where
 *   bold / italic / bullet show formatted directly, edited
 *   Word-style. The toolbar uses `document.execCommand`
 *   (deprecated but universally supported) to apply
 *   formatting, and we serialise the resulting HTML back to
 *   Markdown on every input — storage stays Markdown either
 *   way.
 * - **markdown** : a textarea with the raw source. The toolbar
 *   wraps the current selection with `**` / `*`, or toggles
 *   `- ` line prefixes.
 *
 * Toggle lives in the Composer footer (`MarkdownToggle`).
 * Switching modes hydrates the new surface from the canonical
 * `value` so the round trip is lossless for the supported
 * subset.
 *
 * Keyboard : `Cmd/Ctrl+Enter` submits in both modes.
 * `Cmd/Ctrl+B/I` works in markdown mode (handled here) and
 * visual mode (the browser already maps these to execCommand
 * for contentEditable).
 *
 * Deliberately not a full editor — no headings, no links, no
 * code blocks. If we need more we'll reach for TipTap ; for
 * now this is zero-dep and predictable.
 */
export default function MarkdownEditor({
  value,
  onChange,
  onSubmit,
  disabled,
  mode = 'visual',
  onModeChange,
  minHeightPx = 180,
  maxHeightPx = 360,
  placeholder: placeholderProp,
  fillParent = false,
  ariaDescribedBy,
}: MarkdownEditorProps) {
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t('modals.composer.markdownDefaultPlaceholder');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const ceRef = useRef<HTMLDivElement | null>(null);

  // Keep the contentEditable in sync with `value` — on mount, on
  // toggle into visual mode, AND on external value changes (a
  // draft restored after its async decrypt, a « repartir à zéro »
  // reset). The one case we must NOT touch innerHTML is while the
  // user is typing — the surface is the source of changes then
  // (serialised back via onInput) and re-setting it would clobber
  // the cursor — so we skip the re-hydrate whenever the editor
  // has focus. Audit 2026-06 : the previous mount-only hydration
  // left restored drafts rendering an EMPTY editor ; one
  // keystroke then silently overwrote the restored content.
  useEffect(() => {
    const el = ceRef.current;
    if (mode !== 'visual' || !el) return;
    if (document.activeElement === el) return;
    if (htmlToMarkdown(el.innerHTML) !== value) {
      el.innerHTML = markdownToHtml(value);
    }
  }, [value, mode]);

  /* ---- Markdown-mode helpers (textarea source view) ----------- */

  function wrapSelection(marker: string): void {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    onChange(`${before}${marker}${sel}${marker}${after}`);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + marker.length, end + marker.length);
    });
  }

  function toggleBulletList(): void {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd =
      value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nonEmpty = lines.filter((l) => l.length > 0);
    const allBulleted =
      nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith('- '));
    const transformed = lines
      .map((l) => {
        if (l.length === 0) return l;
        if (allBulleted) return l.startsWith('- ') ? l.slice(2) : l;
        return l.startsWith('- ') ? l : `- ${l}`;
      })
      .join('\n');
    const next = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
    onChange(next);
    const delta = transformed.length - block.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, end + delta);
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        wrapSelection('**');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        wrapSelection('*');
        return;
      }
    }
  }

  /* ---- Visual-mode helpers (contentEditable) ----------------- */

  function syncFromContentEditable(): void {
    if (!ceRef.current) return;
    onChange(htmlToMarkdown(ceRef.current.innerHTML));
  }

  function execCommand(command: 'bold' | 'italic' | 'insertUnorderedList'): void {
    const el = ceRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command);
    syncFromContentEditable();
  }

  function handleVisualKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    // Wire Cmd/Ctrl + B / I explicitly. Browsers nominally map
    // these to execCommand for contentEditable on their own,
    // but the behaviour is patchy across Firefox / Safari /
    // Chrome — handling them ourselves guarantees the toolbar
    // and the keyboard agree.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        execCommand('bold');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        execCommand('italic');
        return;
      }
    }
  }

  function handleVisualPaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    // Force plain-text paste so the contentEditable doesn't
    // ingest arbitrary HTML (styles, images, links) from
    // another app — the user can re-apply our limited
    // formatting via the toolbar.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function handleVisualDrop(e: React.DragEvent<HTMLDivElement>): void {
    // Same posture as paste : never let foreign HTML enter the
    // contentEditable alive (a dragged `<img onerror>` from a
    // hostile page would execute before re-serialisation).
    // Insert the plain-text payload at the caret instead.
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain');
    if (!text || disabled) return;
    ceRef.current?.focus();
    document.execCommand('insertText', false, text);
    syncFromContentEditable();
  }

  /* ---- Render ------------------------------------------------ */

  const toolbarDisabled = Boolean(disabled);
  const isVisual = mode === 'visual';

  return (
    <div className={cn('flex flex-col gap-1.5', fillParent && 'h-full min-h-0')}>
      <div className="flex shrink-0 items-center gap-0.5">
        <ToolbarButton
          onClick={() => (isVisual ? execCommand('bold') : wrapSelection('**'))}
          ariaLabel={t('common.editor.bold')}
          title={t('common.editor.boldTitle')}
          disabled={toolbarDisabled}
        >
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => (isVisual ? execCommand('italic') : wrapSelection('*'))}
          ariaLabel={t('common.editor.italic')}
          title={t('common.editor.italicTitle')}
          disabled={toolbarDisabled}
        >
          <span className="font-serif italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            isVisual ? execCommand('insertUnorderedList') : toggleBulletList()
          }
          ariaLabel={t('common.editor.bulletList')}
          title={t('common.editor.bulletList')}
          disabled={toolbarDisabled}
        >
          <span className="leading-none">•</span>
        </ToolbarButton>
        <span className="ml-2 text-[11px] text-muted">
          {isVisual
            ? t('common.editor.visualHint')
            : t('common.editor.markdownHint')}
        </span>
        {onModeChange ? (
          <div className="ml-auto">
            <MarkdownToggle
              value={mode === 'markdown'}
              onChange={(next) => onModeChange(next ? 'markdown' : 'visual')}
            />
          </div>
        ) : null}
      </div>
      {isVisual ? (
        <div
          ref={ceRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          tabIndex={disabled ? -1 : 0}
          aria-multiline="true"
          aria-label={t('modals.composer.markdownContentAria')}
          aria-describedby={ariaDescribedBy}
          data-placeholder={placeholder}
          onInput={syncFromContentEditable}
          onKeyDown={handleVisualKeyDown}
          onPaste={handleVisualPaste}
          onDrop={handleVisualDrop}
          style={
            fillParent
              ? undefined
              : {
                  minHeight: `${minHeightPx}px`,
                  maxHeight: `${maxHeightPx}px`,
                  overflowY: 'auto',
                }
          }
          className={cn(
            'journal-ce block w-full rounded-sm border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink',
            'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
            fillParent && 'min-h-0 flex-1 overflow-y-auto',
            disabled ? 'pointer-events-none opacity-60' : '',
          )}
        />
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          aria-label={t('modals.composer.markdownContentAria')}
          aria-describedby={ariaDescribedBy}
          placeholder={placeholder}
          rows={fillParent ? undefined : 8}
          disabled={disabled}
          style={
            fillParent
              ? undefined
              : {
                  minHeight: `${minHeightPx}px`,
                  maxHeight: `${maxHeightPx}px`,
                }
          }
          className={cn(
            'block w-full resize-none overflow-y-auto rounded-sm border border-hair bg-bg px-3 py-2 text-[13.5px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60',
            fillParent && 'min-h-0 flex-1',
          )}
        />
      )}
    </div>
  );
}

/** Square ghost button used by `MarkdownEditor`'s toolbar.
 *  `onMouseDown` preventing default keeps the textarea
 *  focused so `selectionStart/End` stays accurate when the
 *  click handler runs the formatting command. */
interface ToolbarButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  disabled?: boolean | undefined;
  children: ReactNode;
}

function ToolbarButton({
  onClick,
  ariaLabel,
  title,
  disabled,
  children,
}: ToolbarButtonProps) {
  return (
    <DirkButton
      variant="ghost"
      size="xs"
      iconOnly
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      className="text-[13px] text-ink-soft"
    >
      {children}
    </DirkButton>
  );
}

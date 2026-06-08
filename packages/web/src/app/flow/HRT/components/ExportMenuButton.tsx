/**
 * HRT · Export — a download split-button : the visible label (« Prises » /
 * « Analyses ») opens a small menu to pick the spreadsheet format (Excel
 * `.xlsx` or LibreOffice `.ods`), which triggers the export in that format.
 *
 * Why a menu per button (not one shared format select) : the format choice
 * reads more naturally *on* each export action. Built on HeadlessUI's
 * accessible `Menu` (keyboard nav + click-outside) ; the trigger reuses the
 * `Button` atom (neutral / sm) so it matches the PDF button beside it.
 */
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';

import type { SpreadsheetFormat } from '../lib/spreadsheet';

interface ExportMenuButtonProps {
  label: string;
  disabled?: boolean;
  onSelect: (format: SpreadsheetFormat) => void;
}

const FORMATS: ReadonlyArray<{ format: SpreadsheetFormat; label: string }> = [
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'ods', label: 'LibreOffice (.ods)' },
];

export default function ExportMenuButton({
  label,
  disabled = false,
  onSelect,
}: ExportMenuButtonProps) {
  return (
    <Menu>
      <MenuButton as={Button} variant="neutral" size="sm" disabled={disabled}>
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
        {label}
        <ChevronDownIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 mt-1 min-w-[10rem] rounded-md border border-hair bg-bg p-1 shadow-md focus:outline-none"
      >
        {FORMATS.map(({ format, label: formatLabel }) => (
          <MenuItem key={format}>
            <button
              type="button"
              onClick={() => onSelect(format)}
              className="flex w-full cursor-pointer items-center rounded px-2.5 py-1.5 text-left text-[12.5px] text-ink data-[focus]:bg-bg-2"
            >
              {formatLabel}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

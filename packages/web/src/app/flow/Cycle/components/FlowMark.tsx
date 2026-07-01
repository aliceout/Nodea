/**
 * Small teardrop marker for a flow day (calendar + legends). Colour
 * grades with intensity on the warm « low » token family (spotting →
 * heavy), so period days read as a droplet under the date rather than
 * a big filled disc. `predicted` renders a hollow droplet for the
 * estimated next-period band.
 */
import type { CycleFlow } from '@nodea/shared';

const FLOW_COLOR: Record<CycleFlow, string> = {
  spotting: 'text-low-soft',
  light: 'text-low',
  medium: 'text-low',
  heavy: 'text-low-deep',
};

const PATH = 'M12 3.5s-6.5 7.4-6.5 11.6a6.5 6.5 0 1 0 13 0C18.5 10.9 12 3.5 12 3.5Z';

interface Props {
  flow?: CycleFlow;
  predicted?: boolean;
  className?: string;
}

export default function FlowMark({ flow, predicted, className = 'h-2.5 w-2.5' }: Props) {
  if (flow) {
    return (
      <svg viewBox="0 0 24 24" className={`${className} ${FLOW_COLOR[flow]}`} aria-hidden="true">
        <path d={PATH} fill="currentColor" />
      </svg>
    );
  }
  if (predicted) {
    return (
      <svg viewBox="0 0 24 24" className={`${className} text-low-soft`} aria-hidden="true">
        <path d={PATH} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    );
  }
  return null;
}

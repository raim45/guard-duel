import type { ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cx } from '../../lib/cx';

export interface TabItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
  /** Set when each tab has a TabPanel. Otherwise the tabs act as a segmented control. */
  hasPanels?: boolean;
  children?: ReactNode;
}

/** Pill tabs. Radix provides the roving focus and arrow-key behavior. */
export function Tabs({ items, value, onValueChange, label, className, hasPanels = false, children }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List aria-label={label} className={cx('flex flex-wrap gap-2 pb-1')}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} disabled={item.disabled} className="tab" {...(hasPanels ? {} : { 'aria-controls': undefined })}>
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;

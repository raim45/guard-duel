import * as RadixSlider from '@radix-ui/react-slider';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cx } from '../../lib/cx';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label. The whole row toggles the switch. */
  label: string;
  description?: string;
  id: string;
  disabled?: boolean;
  className?: string;
}

/** A labelled on/off switch: brass when on, with the thumb on the right. */
export function Switch({ checked, onCheckedChange, label, description, id, disabled, className }: SwitchProps) {
  return (
    <div className={cx('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="t-body block font-bold">{label}</span>
        {description ? <span className="t-small block text-chalk-dim">{description}</span> : null}
      </label>
      <RadixSwitch.Root id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="switch-root">
        <RadixSwitch.Thumb className="switch-thumb" />
      </RadixSwitch.Root>
    </div>
  );
}

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  /** Stop labels shown under the track, for example Terse, Normal, Chatty. */
  stops?: string[];
  valueText?: string;
  disabled?: boolean;
  className?: string;
}

export function Slider({ value, onValueChange, min, max, step, label, stops, valueText, disabled, className }: SliderProps) {
  return (
    <div className={className}>
      <RadixSlider.Root
        className="slider-root"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onValueChange(next[0] ?? value)}
      >
        <RadixSlider.Track className="slider-track">
          <RadixSlider.Range className="slider-range" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="slider-thumb" aria-label={label} aria-valuetext={valueText} />
      </RadixSlider.Root>
      {stops ? (
        <div className="t-small mt-2 flex justify-between text-chalk-dim" aria-hidden="true">
          {stops.map((stop) => <span key={stop}>{stop}</span>)}
        </div>
      ) : null}
    </div>
  );
}

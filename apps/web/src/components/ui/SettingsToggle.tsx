type SettingsToggleProps = {
  label: string;
  description: string;
  ariaLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const SettingsToggle = ({
  label,
  description,
  ariaLabel,
  checked,
  onChange,
}: SettingsToggleProps) => (
  <button
    aria-checked={checked}
    aria-label={ariaLabel}
    className="settings-toggle-option"
    data-active={checked ? "true" : "false"}
    onClick={() => onChange(!checked)}
    role="switch"
    type="button"
  >
    <span className="settings-toggle-copy">
      <span className="settings-toggle-label">{label}</span>
      <span className="settings-toggle-description">{description}</span>
    </span>
    <span className="settings-toggle-switch" aria-hidden="true">
      <span className="settings-toggle-thumb" />
    </span>
    <span className="settings-toggle-state">{checked ? "Enabled" : "Disabled"}</span>
  </button>
);

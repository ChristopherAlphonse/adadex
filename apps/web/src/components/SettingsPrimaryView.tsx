import type { ColorTheme } from "../app/colorTheme";
import {
  TERMINAL_COMPLETION_SOUND_OPTIONS,
  type TerminalCompletionSoundId,
} from "../app/notificationSounds";
import { ActionButton } from "./ui/ActionButton";
import { SettingsToggle } from "./ui/SettingsToggle";

type SettingsPrimaryViewProps = {
  colorTheme: ColorTheme;
  onColorThemeChange: (theme: ColorTheme) => void;
  terminalCompletionSound: TerminalCompletionSoundId;
  isRuntimeStatusStripVisible: boolean;
  onTerminalCompletionSoundChange: (soundId: TerminalCompletionSoundId) => void;
  onPreviewTerminalCompletionSound: (soundId: TerminalCompletionSoundId) => void;
  onRuntimeStatusStripVisibilityChange: (visible: boolean) => void;
};

const COLOR_THEME_OPTIONS: { id: ColorTheme; label: string; description: string }[] = [
  { id: "dark", label: "Dark", description: "Low-glare console tuned for long sessions." },
  { id: "light", label: "Light", description: "Bright workspace for well-lit environments." },
];

export const SettingsPrimaryView = ({
  colorTheme,
  onColorThemeChange,
  terminalCompletionSound,
  isRuntimeStatusStripVisible,
  onTerminalCompletionSoundChange,
  onPreviewTerminalCompletionSound,
  onRuntimeStatusStripVisibilityChange,
}: SettingsPrimaryViewProps) => (
  <section className="settings-view" aria-label="Settings primary view">
    <section className="settings-panel" aria-label="Appearance settings">
      <header className="settings-panel-header">
        <h2>Appearance</h2>
        <p>Choose the console color theme. Saved locally on this device.</p>
      </header>

      <div className="settings-sound-picker">
        {COLOR_THEME_OPTIONS.map((option) => (
          <button
            aria-pressed={colorTheme === option.id}
            className="settings-sound-option"
            data-active={colorTheme === option.id ? "true" : "false"}
            key={option.id}
            onClick={() => {
              onColorThemeChange(option.id);
            }}
            type="button"
          >
            <span className="settings-sound-option-label">{option.label}</span>
            <span className="settings-sound-option-description">{option.description}</span>
          </button>
        ))}
      </motion>
    </section>
    <section className="settings-panel" aria-label="Completion notification settings">
      <header className="settings-panel-header">
        <h2>Orchestration completion sound</h2>
        <p>Play a notification when a orchestration moves from processing to idle.</p>
      </header>

      <div className="settings-sound-picker">
        {TERMINAL_COMPLETION_SOUND_OPTIONS.map((option) => (
          <button
            aria-pressed={terminalCompletionSound === option.id}
            className="settings-sound-option"
            data-active={terminalCompletionSound === option.id ? "true" : "false"}
            key={option.id}
            onClick={() => {
              onTerminalCompletionSoundChange(option.id);
              onPreviewTerminalCompletionSound(option.id);
            }}
            type="button"
          >
            <span className="settings-sound-option-label">{option.label}</span>
            <span className="settings-sound-option-description">{option.description}</span>
          </button>
        ))}
      </div>

      <div className="settings-panel-actions">
        <ActionButton
          aria-label="Preview selected completion sound"
          className="settings-sound-preview"
          onClick={() => {
            onPreviewTerminalCompletionSound(terminalCompletionSound);
          }}
          size="dense"
          variant="accent"
        >
          Preview
        </ActionButton>
        <span className="settings-saved-pill">Saved locally</span>
      </div>
    </section>
    <section className="settings-panel" aria-label="Workspace surface visibility settings">
      <header className="settings-panel-header">
        <h2>Workspace surface visibility</h2>
        <p>Enable or disable optional surfaces in the main workspace shell.</p>
      </header>

      <div className="grid grid-cols-2 gap-2 max-[940px]:grid-cols-1">
        <SettingsToggle
          label="Runtime status strip"
          description="Top console status strip metrics"
          ariaLabel="Show runtime status strip"
          checked={isRuntimeStatusStripVisible}
          onChange={onRuntimeStatusStripVisibilityChange}
        />
      </div>
    </section>
  </section>
);

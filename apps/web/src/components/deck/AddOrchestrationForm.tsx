import { useEffect, useRef, useState } from "react";

import type { DeckAvailableSkill } from "@adadex/core";

import { formatColorForDisplay } from "../../app/mascotPalette";
import type { MascotAccessory, MascotAnimation, MascotExpression } from "../MascotSprite";
import { MascotSprite } from "../MascotSprite";
import { MASCOT_COLORS } from "./mascotVisuals";

export type MascotAppearancePayload = {
  animation: string;
  expression: string;
  accessory: string;
  hairColor: string;
};

export type AddOrchestrationFormProps = {
  onSubmit: (
    name: string,
    description: string,
    color: string,
    mascot: MascotAppearancePayload,
    suggestedSkills: string[],
  ) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  availableSkills: DeckAvailableSkill[];
};

export const EXPRESSION_OPTIONS: { value: MascotExpression; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "focused", label: "Focused" },
  { value: "curious", label: "Curious" },
];

export const ACCESSORY_OPTIONS: { value: MascotAccessory; label: string }[] = [
  { value: "none", label: "None" },
  { value: "glasses", label: "Glasses" },
  { value: "badge", label: "Badge" },
  { value: "visor", label: "Visor" },
  { value: "terminal", label: "Terminal" },
  { value: "node-ring", label: "Node Ring" },
  { value: "shield", label: "Shield" },
];

export const AddOrchestrationForm = ({
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  availableSkills,
}: AddOrchestrationFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(
    () => MASCOT_COLORS[Math.floor(Math.random() * MASCOT_COLORS.length)] as string,
  );
  const [selectedExpression, setSelectedExpression] = useState<MascotExpression>("neutral");
  const [selectedAccessory, setSelectedAccessory] = useState<MascotAccessory>("none");
  const [selectedAnimation] = useState<MascotAnimation>("idle");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) return;
    onSubmit(
      name.trim(),
      description.trim(),
      selectedColor,
      {
        animation: selectedAnimation,
        expression: selectedExpression,
        accessory: selectedAccessory,
        hairColor: selectedColor,
      },
      selectedSkills,
    );
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills((current) =>
      current.includes(skillName)
        ? current.filter((skill) => skill !== skillName)
        : [...current, skillName].sort((a, b) => a.localeCompare(b)),
    );
  };

  return (
    <form className="deck-add-form" onSubmit={handleSubmit}>
      <div className="deck-add-form-header">
        <button type="button" className="deck-add-form-back" onClick={onCancel}>
          ← Back
        </button>
        <span className="deck-add-form-title">New Coordination</span>
      </div>

      <div className="deck-add-form-body">
        <div className="deck-add-form-grid">
          <div className="deck-add-form-left">
            <label className="deck-add-form-label">
              Name
              <input
                ref={nameRef}
                type="text"
                className="deck-add-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Database Layer"
              />
            </label>

            <label className="deck-add-form-label">
              Description
              <textarea
                className="deck-add-form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this coordination is responsible for..."
                rows={3}
              />
            </label>

            {availableSkills.length > 0 && (
              <div className="deck-add-form-label">
                Suggested Skills
                <div className="deck-add-form-skills">
                  {availableSkills.map((skill) => {
                    const checked = selectedSkills.includes(skill.name);
                    return (
                      <label
                        key={`${skill.source}:${skill.name}`}
                        className="deck-add-form-skill-option"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSkill(skill.name)}
                        />
                        <span className="deck-add-form-skill-name">{skill.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="deck-add-form-right">
            <div className="deck-add-form-preview">
              <MascotSprite
                color={selectedColor}
                animation="idle"
                expression={selectedExpression}
                accessory={selectedAccessory}
                size={192}
              />
            </div>

            <div className="deck-add-form-label">
              Accent Color
              <div className="deck-add-form-colors">
                {MASCOT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="deck-add-form-color-swatch"
                    data-selected={c === selectedColor ? "true" : "false"}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                    title={formatColorForDisplay(c)}
                    aria-label={`Select color ${formatColorForDisplay(c)}`}
                  />
                ))}
              </div>
              <p className="deck-add-form-color-meta" aria-live="polite">
                {formatColorForDisplay(selectedColor)}
              </p>
            </div>

            <div className="deck-add-form-row">
              <div className="deck-add-form-label">
                Expression
                <div className="deck-add-form-chips">
                  {EXPRESSION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="deck-add-form-chip"
                      data-selected={opt.value === selectedExpression ? "true" : "false"}
                      onClick={() => setSelectedExpression(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="deck-add-form-label">
                Accessory
                <div className="deck-add-form-chips">
                  {ACCESSORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="deck-add-form-chip"
                      data-selected={opt.value === selectedAccessory ? "true" : "false"}
                      onClick={() => setSelectedAccessory(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="deck-add-form-error">{error}</div>}

        <button
          type="submit"
          className="deck-add-form-submit"
          disabled={isSubmitting || name.trim().length === 0}
        >
          {isSubmitting ? "Creating..." : "Create Coordination"}
        </button>
      </div>
    </form>
  );
};

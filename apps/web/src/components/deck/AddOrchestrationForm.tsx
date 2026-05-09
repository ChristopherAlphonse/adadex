import { useEffect, useRef, useState } from "react";

import type { DeckAvailableSkill } from "@adadex/core";

import { formatColorForDisplay } from "../../app/mascotPalette";
import type { MascotAccessory, MascotAnimation, MascotExpression } from "../MascotSprite";
import { MascotSprite } from "../MascotSprite";
import { ACCESSORIES, ANIMATIONS, EXPRESSIONS, MASCOT_COLORS } from "./mascotVisuals";

// ─── Add coordination form ─────────────────────────────────────────────────

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
  { value: "normal", label: "Normal" },
  { value: "happy", label: "Happy" },
  { value: "angry", label: "Angry" },
  { value: "surprised", label: "Surprised" },
];

export const ACCESSORY_OPTIONS: { value: MascotAccessory; label: string }[] = [
  { value: "none", label: "None" },
  { value: "long", label: "Long" },
  { value: "mohawk", label: "Mohawk" },
  { value: "side-sweep", label: "Side Sweep" },
  { value: "curly", label: "Curly" },
  { value: "afro", label: "Afro" },
];

export const HAIR_COLORS = [
  "#4a2c0a",
  "#1a1a1a",
  "#c8a04a",
  "#e04020",
  "#f5f5f5",
  "#6b3fa0",
  "#2a6e3f",
  "#1e90ff",
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
  const [selectedExpression, setSelectedExpression] = useState<MascotExpression>(() => {
    const pick = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)] as MascotExpression;
    return pick;
  });
  const [selectedAccessory, setSelectedAccessory] = useState<MascotAccessory>(() => {
    const pick = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)] as MascotAccessory;
    return pick;
  });
  const [selectedAnimation] = useState<MascotAnimation>(() => {
    const pick = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)] as MascotAnimation;
    return pick;
  });
  const [selectedHairColor, setSelectedHairColor] = useState(
    () => HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)] as string,
  );
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
        hairColor: selectedHairColor,
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
        <div className="deck-add-form-preview">
          <MascotSprite
            color={selectedColor}
            animation="idle"
            expression={selectedExpression}
            accessory={selectedAccessory}
            hairColor={selectedHairColor}
            size={160}
          />
        </div>

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
                    <span className="deck-add-form-skill-copy">
                      <span className="deck-add-form-skill-name">{skill.name}</span>
                      {skill.description && (
                        <span className="deck-add-form-skill-desc">{skill.description}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="deck-add-form-label">
          Color
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
            Hair Style
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
          <div className="deck-add-form-label">
            Hair Color
            <div className="deck-add-form-colors">
              {HAIR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="deck-add-form-color-swatch deck-add-form-color-swatch--small"
                  data-selected={c === selectedHairColor ? "true" : "false"}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedHairColor(c)}
                  title={formatColorForDisplay(c)}
                  aria-label={`Select hair color ${formatColorForDisplay(c)}`}
                />
              ))}
            </div>
            <p className="deck-add-form-color-meta" aria-live="polite">
              {formatColorForDisplay(selectedHairColor)}
            </p>
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

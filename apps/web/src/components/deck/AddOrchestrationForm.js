import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { formatColorForDisplay } from "../../app/mascotPalette";
import { MascotSprite } from "../MascotSprite";
import { ACCESSORIES, ANIMATIONS, EXPRESSIONS, MASCOT_COLORS } from "./mascotVisuals";
export const EXPRESSION_OPTIONS = [
    { value: "normal", label: "Normal" },
    { value: "happy", label: "Happy" },
    { value: "angry", label: "Angry" },
    { value: "surprised", label: "Surprised" },
];
export const ACCESSORY_OPTIONS = [
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
export const AddOrchestrationForm = ({ onSubmit, onCancel, isSubmitting, error, availableSkills, }) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedColor, setSelectedColor] = useState(() => MASCOT_COLORS[Math.floor(Math.random() * MASCOT_COLORS.length)]);
    const [selectedExpression, setSelectedExpression] = useState(() => {
        const pick = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
        return pick;
    });
    const [selectedAccessory, setSelectedAccessory] = useState(() => {
        const pick = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
        return pick;
    });
    const [selectedAnimation] = useState(() => {
        const pick = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
        return pick;
    });
    const [selectedHairColor, setSelectedHairColor] = useState(() => HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const nameRef = useRef(null);
    useEffect(() => {
        nameRef.current?.focus();
    }, []);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (name.trim().length === 0)
            return;
        onSubmit(name.trim(), description.trim(), selectedColor, {
            animation: selectedAnimation,
            expression: selectedExpression,
            accessory: selectedAccessory,
            hairColor: selectedHairColor,
        }, selectedSkills);
    };
    const toggleSkill = (skillName) => {
        setSelectedSkills((current) => current.includes(skillName)
            ? current.filter((skill) => skill !== skillName)
            : [...current, skillName].sort((a, b) => a.localeCompare(b)));
    };
    return (_jsxs("form", { className: "deck-add-form", onSubmit: handleSubmit, children: [_jsxs("div", { className: "deck-add-form-header", children: [_jsx("button", { type: "button", className: "deck-add-form-back", onClick: onCancel, children: "\u2190 Back" }), _jsx("span", { className: "deck-add-form-title", children: "New Coordination" })] }), _jsxs("div", { className: "deck-add-form-body", children: [_jsxs("div", { className: "deck-add-form-grid", children: [_jsxs("div", { className: "deck-add-form-left", children: [_jsxs("label", { className: "deck-add-form-label", children: ["Name", _jsx("input", { ref: nameRef, type: "text", className: "deck-add-form-input", value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Database Layer" })] }), _jsxs("label", { className: "deck-add-form-label", children: ["Description", _jsx("textarea", { className: "deck-add-form-textarea", value: description, onChange: (e) => setDescription(e.target.value), placeholder: "What this coordination is responsible for...", rows: 3 })] }), availableSkills.length > 0 && (_jsxs("div", { className: "deck-add-form-label", children: ["Suggested Skills", _jsx("div", { className: "deck-add-form-skills", children: availableSkills.map((skill) => {
                                                    const checked = selectedSkills.includes(skill.name);
                                                    return (_jsxs("label", { className: "deck-add-form-skill-option", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: () => toggleSkill(skill.name) }), _jsx("span", { className: "deck-add-form-skill-name", children: skill.name })] }, `${skill.source}:${skill.name}`));
                                                }) })] }))] }), _jsxs("div", { className: "deck-add-form-right", children: [_jsx("div", { className: "deck-add-form-preview", children: _jsx(MascotSprite, { color: selectedColor, animation: "idle", expression: selectedExpression, accessory: selectedAccessory, hairColor: selectedHairColor, size: 160 }) }), _jsxs("div", { className: "deck-add-form-label", children: ["Color", _jsx("div", { className: "deck-add-form-colors", children: MASCOT_COLORS.map((c) => (_jsx("button", { type: "button", className: "deck-add-form-color-swatch", "data-selected": c === selectedColor ? "true" : "false", style: { backgroundColor: c }, onClick: () => setSelectedColor(c), title: formatColorForDisplay(c), "aria-label": `Select color ${formatColorForDisplay(c)}` }, c))) }), _jsx("p", { className: "deck-add-form-color-meta", "aria-live": "polite", children: formatColorForDisplay(selectedColor) })] }), _jsxs("div", { className: "deck-add-form-row", children: [_jsxs("div", { className: "deck-add-form-label", children: ["Expression", _jsx("div", { className: "deck-add-form-chips", children: EXPRESSION_OPTIONS.map((opt) => (_jsx("button", { type: "button", className: "deck-add-form-chip", "data-selected": opt.value === selectedExpression ? "true" : "false", onClick: () => setSelectedExpression(opt.value), children: opt.label }, opt.value))) })] }), _jsxs("div", { className: "deck-add-form-label", children: ["Hair Style", _jsx("div", { className: "deck-add-form-chips", children: ACCESSORY_OPTIONS.map((opt) => (_jsx("button", { type: "button", className: "deck-add-form-chip", "data-selected": opt.value === selectedAccessory ? "true" : "false", onClick: () => setSelectedAccessory(opt.value), children: opt.label }, opt.value))) })] })] }), _jsxs("div", { className: "deck-add-form-label", children: ["Hair Color", _jsx("div", { className: "deck-add-form-colors", children: HAIR_COLORS.map((c) => (_jsx("button", { type: "button", className: "deck-add-form-color-swatch deck-add-form-color-swatch--small", "data-selected": c === selectedHairColor ? "true" : "false", style: { backgroundColor: c }, onClick: () => setSelectedHairColor(c), title: formatColorForDisplay(c), "aria-label": `Select hair color ${formatColorForDisplay(c)}` }, c))) }), _jsx("p", { className: "deck-add-form-color-meta", "aria-live": "polite", children: formatColorForDisplay(selectedHairColor) })] })] })] }), error && _jsx("div", { className: "deck-add-form-error", children: error }), _jsx("button", { type: "submit", className: "deck-add-form-submit", disabled: isSubmitting || name.trim().length === 0, children: isSubmitting ? "Creating..." : "Create Coordination" })] })] }));
};

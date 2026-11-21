import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VaultFileEditor } from "../src/components/deck/VaultFileEditor";

const initialMarkdown = "# Todo\n\n- [ ] First item\n";

const updatedMarkdown = "# Todo\n\n- [x] First item\n";

describe("VaultFileEditor", () => {
  it("edits the raw markdown value and saves it", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <VaultFileEditor
        error={null}
        fileName="todo.md"
        isSaving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSave={onSave}
        value={initialMarkdown}
      />,
    );

    // SAFETY: the "Edit todo.md" role query resolves the rendered textarea.
    const textarea = screen.getByRole("textbox", { name: "Edit todo.md" }) as HTMLTextAreaElement;

    expect(textarea.value).toBe(initialMarkdown);

    fireEvent.change(textarea, { target: { value: updatedMarkdown } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onChange).toHaveBeenCalledWith(updatedMarkdown);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows save errors and disables actions while saving", () => {
    render(
      <VaultFileEditor
        error="Could not save file."
        fileName="todo.md"
        isSaving
        onChange={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        value=""
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Could not save file.");

    // SAFETY: both role queries resolve the rendered buttons.
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    // SAFETY: the "Cancel" role query resolves the rendered button.
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RuntimeStatusStrip } from "../src/components/RuntimeStatusStrip";

describe("RuntimeStatusStrip", () => {
  it("renders the brand label", () => {
    render(<RuntimeStatusStrip usageData={null} />);

    expect(screen.getByLabelText("Runtime status strip")).toBeInTheDocument();
    expect(screen.getByText("ADADEX")).toBeInTheDocument();
  });
});

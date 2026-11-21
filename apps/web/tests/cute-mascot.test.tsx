import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphNode } from "../src/app/canvas/types";
import { MascotNode } from "../src/components/canvas/MascotNode";
import { CuteMascot, type CuteMascotState } from "../src/components/deck/CuteMascot";

const STATES: CuteMascotState[] = ["idle", "working", "happy", "sleeping", "worried"];

const node: GraphNode = {
  id: "web-ui",
  type: "orchestration",
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  pinned: false,
  radius: 48,
  coordinationId: "web-ui",
  label: "Web UI",
  color: "#7c3aed",
};

describe("CuteMascot", () => {
  it("renders every mood as SVG without a canvas", () => {
    const { container } = render(
      <div>
        {STATES.map((state) => (
          <CuteMascot key={state} state={state} />
        ))}
      </div>,
    );

    for (const state of STATES) {
      expect(container.querySelector(`.cute-mascot--${state}`)).not.toBeNull();
    }

    expect(container.querySelectorAll("svg.cute-mascot")).toHaveLength(STATES.length);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("tints the mascot from the supplied color", () => {
    const { container } = render(<CuteMascot color="#f43f5e" state="happy" />);

    expect(container.innerHTML).toContain("#f43f5e");
  });

  it("replaces the old sprite on canvas orchestration nodes", () => {
    const { container } = render(
      <svg>
        <MascotNode
          node={node}
          connectedNodes={[]}
          isSelected={false}
          selectedNodeId={null}
          selectedNodeColor={null}
          onPointerDown={vi.fn()}
          onClick={vi.fn()}
        />
      </svg>,
    );

    expect(container.querySelector(".cute-mascot")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});

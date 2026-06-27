/**
 * ViewCube accessibility parity (spec v1.0.1 Feature A §1.6). The cube needs a GPU, but the
 * no-pointer path — a named-view `<select>`, a Home button, and the projection toggle — is plain
 * DOM and is asserted here, same parity rule as the supplement binding + the coupe manager.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewControls } from "./ViewCube";
import { useStore } from "../store/useStore";

describe("ViewCube a11y controls (Feature A §1.6)", () => {
  beforeEach(() => useStore.getState().reset());

  it("offers a named-view list (26 views), a Home button, and a projection toggle", () => {
    render(<ViewControls />);
    const select = screen.getByLabelText("Orientation");
    expect(select.querySelectorAll("option")).toHaveLength(27); // 26 views + placeholder
    expect(screen.getByLabelText("Vue par défaut")).toBeInTheDocument();
  });

  it("toggles projection perspective ⇄ orthographic", () => {
    render(<ViewControls />);
    expect(useStore.getState().projection).toBe("perspective");
    fireEvent.click(screen.getByText("Perspective"));
    expect(useStore.getState().projection).toBe("orthographic");
  });

  it("choosing a named view raises a one-shot camera request the viewport consumes", () => {
    render(<ViewControls />);
    fireEvent.change(screen.getByLabelText("Orientation"), { target: { value: "FRONT" } });
    expect(useStore.getState().viewRequest?.id).toBe("FRONT");
    // Home requests the element-aware iso default
    fireEvent.click(screen.getByLabelText("Vue par défaut"));
    expect(useStore.getState().viewRequest?.id).toBe("TOP_FRONT_RIGHT");
  });
});

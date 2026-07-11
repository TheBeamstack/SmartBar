/**
 * F4 ([REF-UI-830]) — the workspace re-layout. The right column stacks Verification + Project + BBS
 * as collapsible, independently scrollable sections; an expand toggle widens it over the 3D. RTL (no
 * WebGL) over the real store. v1.0.6 N4 (U1) subsumed the old Coupes bottom dock into the section
 * dock — the coupe assertion moved to `workspace_shell.spec.tsx`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RightColumn } from "./RightColumn";
import { useStore } from "../store/useStore";

describe("F4 right-column workspace layout", () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.setState({
      rightPanels: { verification: true, project: false, bbs: false },
      expandPanels: false,
    });
  });

  it("renders the three section headers (Verification + Project + BBS)", () => {
    render(<RightColumn />);
    expect(screen.getByRole("button", { name: /vérifications/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /projet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^bbs$/i })).toBeInTheDocument();
  });

  it("sections are independently collapsible: Verification open by default, Project opens on toggle", () => {
    render(<RightColumn />);
    // Verification open (its empty-state / list is mounted); Project collapsed (its toolbar absent)
    const projectHead = screen.getByRole("button", { name: /projet/i });
    expect(projectHead).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(projectHead);
    expect(useStore.getState().rightPanels.project).toBe(true);
    expect(screen.getByRole("button", { name: /projet/i })).toHaveAttribute("aria-expanded", "true");

    // collapsing Verification hides its body but keeps the header
    const verifHead = screen.getByRole("button", { name: /vérifications/i });
    fireEvent.click(verifHead);
    expect(useStore.getState().rightPanels.verification).toBe(false);
    expect(screen.getByRole("button", { name: /vérifications/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("the expand toggle sets the flag and the widened class", () => {
    const { container } = render(<RightColumn />);
    const column = container.querySelector(".right-column") as HTMLElement;
    expect(column).not.toHaveClass("expanded");

    fireEvent.click(screen.getByRole("button", { name: /élargir|expand/i }));
    expect(useStore.getState().expandPanels).toBe(true);
    expect(container.querySelector(".right-column")).toHaveClass("expanded");
  });
});

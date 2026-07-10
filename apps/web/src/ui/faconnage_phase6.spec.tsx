/**
 * v1.0.4 façonnage Phase-6 UI batch:
 *   H16 — NumberField honours the manifest `max`/`step` (was hardcoded 20000/10 for length params).
 *   H17 — rich invalid feedback: the real reason + the last-valid sketch + `aria-invalid` on the field.
 *   H18 — AddressableBars copy comes from the shared i18n bundle (renders in both languages).
 *   H12 — a DROITE bar's length is coupled to the member (read-only) with an explicit override toggle.
 *   H19 — a length leg's control is floored at 1 mm (no degenerate 0-length legs from the slider).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FaconnageEditor } from "./FaconnageEditor";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { useStore } from "../store/useStore";

const editor = (shapeId: string) =>
  render(<FaconnageEditor shapeId={shapeId} diameter={20} faconnage={undefined} memberLength={3000} onChange={() => {}} />);
const nums = (c: HTMLElement) => [...c.querySelectorAll('input[type="number"]')] as HTMLInputElement[];

describe("H16 — NumberField honours the manifest max/step", () => {
  beforeEach(() => useStore.getState().reset());

  it("a DROITE length param uses the manifest step (5), not the 10 fallback", () => {
    const { container } = editor("DROITE");
    expect(nums(container)[0]!.step).toBe("5");
  });

  it("an angle param honours the manifest max (BAIONNETTE crank angle max=45)", () => {
    const { container } = editor("BAIONNETTE");
    expect(nums(container).some((n) => n.max === "45")).toBe(true);
  });
});

describe("H19 — length legs floored at 1 mm (UI)", () => {
  beforeEach(() => useStore.getState().reset());

  it("a length param's min is 1, not the manifest 0", () => {
    const { container } = editor("DROITE");
    expect(nums(container)[0]!.min).toBe("1");
  });
});

describe("H17 — rich invalid feedback", () => {
  beforeEach(() => useStore.getState().reset());

  it("an invalid edit shows the real reason, keeps the last-valid sketch, and marks the field aria-invalid", () => {
    const { container } = editor("DROITE");
    expect(screen.getByText(/3000 mm/)).toBeInTheDocument(); // the valid seed sketch
    const L = nums(container)[0]!;
    fireEvent.change(L, { target: { value: "0" } }); // degenerate leg → invalid geometry
    expect(container.querySelector(".faconnage-error-detail")?.textContent).toMatch(/non-positive leg/i);
    expect(screen.getByText(/3000 mm/)).toBeInTheDocument(); // last valid sketch STILL shown
    expect(L.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("H18 — AddressableBars uses the i18n bundle", () => {
  beforeEach(() => useStore.getState().reset());

  it("renders the bundle title in both languages", () => {
    const { container, rerender } = render(<><Navbar /><Sidebar /></>);
    const panel = () => container.querySelector(".addressable") as HTMLElement;
    expect(within(panel()).getByText("Détail barre par barre")).toBeInTheDocument();
    useStore.getState().toggleLang();
    rerender(<><Navbar /><Sidebar /></>);
    expect(within(panel()).getByText("Bar-by-bar detailing")).toBeInTheDocument();
  });
});

describe("H12 — DROITE length coupled to the member with a toggle", () => {
  beforeEach(() => useStore.getState().reset());

  it("shows the coupled (read-only) length by default and reveals the field on toggle", () => {
    const { container } = render(<><Navbar /><Sidebar /></>);
    const panel = container.querySelector(".addressable") as HTMLElement;
    // v1.0.6 N2: pick the bar on the ONE shared SectionCanvas (select mode) → this editor targets it.
    const canvas = container.querySelector(".section-canvas") as HTMLElement;
    const barBtns = within(canvas).getAllByRole("button").filter((b) => b.classList.contains("sp-list-btn") && !b.classList.contains("sp-list-extra"));
    fireEvent.click(barBtns[0]!);

    expect(panel.querySelector(".addressable-coupled")).toBeTruthy(); // coupled read-only display
    const couple = panel.querySelector(".addressable-couple input[type=checkbox]") as HTMLInputElement;
    fireEvent.click(couple); // opt into a custom length
    expect(panel.querySelector(".addressable-coupled")).toBeFalsy();
    expect(panel.querySelector(".addressable-length input[type=number]")).toBeTruthy();
  });
});

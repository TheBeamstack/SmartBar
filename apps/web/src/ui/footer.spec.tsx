/**
 * Attribution footer: renders the "beamstack" wordmark linking out to the parent product's site.
 * Presentational only — no store/engine involvement.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("links to beam-stack.com, opened in a new tab, with the beamstack wordmark", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /powered by beamstack/i });
    expect(link).toHaveAttribute("href", "https://beam-stack.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("beam")).toBeInTheDocument();
    expect(screen.getByText("stack")).toBeInTheDocument();
  });
});

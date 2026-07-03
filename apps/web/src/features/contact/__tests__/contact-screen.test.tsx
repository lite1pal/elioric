import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContactScreen } from "../components/contact-screen.js";

describe("ContactScreen", () => {
  it("renders the empty state when no contacts exist", () => {
    render(<ContactScreen items={[]} />);

    expect(screen.getByText("No contacts yet")).toBeTruthy();
  });
});

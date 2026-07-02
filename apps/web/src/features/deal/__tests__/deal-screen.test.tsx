import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DealScreen } from "../components/deal-screen";

describe("DealScreen", () => {
  it("renders the empty state when no deals exist", () => {
    render(<DealScreen items={[]} />);

    expect(screen.getByText("No deals yet")).toBeTruthy();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompanyScreen } from "../components/company-screen";

describe("CompanyScreen", () => {
  it("renders the empty state when no companies exist", () => {
    render(<CompanyScreen items={[]} />);

    expect(screen.getByText("No companies yet")).toBeTruthy();
  });
});

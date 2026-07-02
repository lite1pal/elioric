import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoteScreen } from "../components/note-screen";

describe("NoteScreen", () => {
  it("renders the empty state when no notes exist", () => {
    render(<NoteScreen items={[]} />);

    expect(screen.getByText("No notes yet")).toBeTruthy();
  });
});

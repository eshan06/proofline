import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CommandPalette } from "./command-palette";
import { useUiStore } from "@/stores/ui";
import { seedTickets } from "@/data/tickets";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function openPalette() {
  useUiStore.setState({ paletteOpen: true, notifOpen: false });
}

describe("command palette keyboard handling", () => {
  beforeEach(() => {
    push.mockReset();
    openPalette();
  });
  afterEach(() => {
    cleanup();
    useUiStore.setState({ paletteOpen: false });
  });

  it("renders grouped results with the first item active", () => {
    render(<CommandPalette tickets={seedTickets} />);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveTextContent("Home");
  });

  it("ArrowDown / ArrowUp move the active index and clamp at the ends", () => {
    render(<CommandPalette tickets={seedTickets} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    let options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveTextContent("Inbox");

    // ArrowUp past the top clamps at index 0.
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter selects the active item and navigates", () => {
    render(<CommandPalette tickets={seedTickets} />);
    fireEvent.keyDown(window, { key: "ArrowDown" }); // → Inbox
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/inbox");
  });

  it("filters results by query and resets the active index", () => {
    render(<CommandPalette tickets={seedTickets} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "duplicate" } });
    const options = screen.getAllByRole("option");
    // Only the refund ticket matches "duplicate".
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Need refund for duplicate charge");
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/inbox/TKT-1031");
  });

  it("shows an empty state when nothing matches", () => {
    render(<CommandPalette tickets={seedTickets} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzznope" } });
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });
});

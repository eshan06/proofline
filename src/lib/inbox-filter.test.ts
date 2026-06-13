import { describe, expect, it } from "vitest";
import { filterCounts, filterTickets, inboxTickets } from "./inbox-filter";
import { seedTickets } from "@/data/tickets";

describe("inbox data layer", () => {
  it("excludes archived tickets from the inbox", () => {
    const live = inboxTickets(seedTickets);
    expect(live.every((t) => !t.archived)).toBe(true);
    expect(live).toHaveLength(6);
    expect(live.find((t) => t.id === "TKT-1019")).toBeUndefined();
  });

  it("computes the filter chip counts from the prototype", () => {
    const counts = filterCounts(seedTickets);
    expect(counts.All).toBe(6);
    expect(counts.Unassigned).toBe(2); // TKT-1038, TKT-1024
    expect(counts.Mine).toBe(2); // Eshan: TKT-1042, TKT-1027
    expect(counts["SLA Risk"]).toBe(2); // ≤45m & >0: TKT-1042 (18), TKT-1038 (42)
    expect(counts["AI Drafted"]).toBe(5); // all but TKT-1024 (no draft)
    expect(counts["Low Confidence"]).toBe(1); // TKT-1038 @ 0.58
  });

  it("filters Low Confidence to drafts under 0.70", () => {
    const list = filterTickets(seedTickets, "Low Confidence", "");
    expect(list.map((t) => t.id)).toEqual(["TKT-1038"]);
  });

  it("filters Unassigned to tickets with no assignee", () => {
    const list = filterTickets(seedTickets, "Unassigned", "");
    expect(list.map((t) => t.id).sort()).toEqual(["TKT-1024", "TKT-1038"]);
  });

  it("searches across subject, customer, preview, and id", () => {
    expect(filterTickets(seedTickets, "All", "duplicate").map((t) => t.id)).toEqual(["TKT-1031"]);
    expect(filterTickets(seedTickets, "All", "ava").map((t) => t.id)).toEqual(["TKT-1042"]);
    expect(filterTickets(seedTickets, "All", "TKT-1029").map((t) => t.id)).toEqual(["TKT-1029"]);
  });

  it("returns an empty list when nothing matches (drives the empty state)", () => {
    expect(filterTickets(seedTickets, "All", "zzzznomatch")).toHaveLength(0);
  });
});

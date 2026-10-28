import { describe, expect, it } from "vitest";
import { seedLookup } from "../estimator/test-lookup";
import { INITIAL_STATE, respond, type AssistantState } from "./engine";
import { detectIntent, normalise, parseDetails } from "./parser";

const lookup = seedLookup();

function conversation(messages: string[]) {
  let state: AssistantState = INITIAL_STATE;
  const replies = messages.map((m) => {
    const out = respond(state, m, { lookup });
    state = out.state;
    return out.reply;
  });
  return { state, replies, last: replies[replies.length - 1] };
}

const qty = (reply: ReturnType<typeof respond>["reply"], sku: string) =>
  reply.estimate?.lines.find((l) => l.sku === sku)?.quantity;

describe("parser", () => {
  it("normalises units", () => {
    expect(normalise("4.2 metres x 2400mm")).toBe(" 4.2m x 2400mm ");
    expect(normalise("10 square metres")).toBe(" 10sqm ");
    expect(normalise("4 in the bathroom")).toBe(" 4 in the bathroom ");
  });

  it("reads dimensions in mixed units", () => {
    const d = parseDetails(normalise("4200mm x 2.4m"), "plasterboard");
    expect(d.multi).toEqual([4.2, 2.4]);
    const feet = parseDetails(normalise("a wall 14ft long and 8ft high"), "plasterboard");
    expect(feet.labelled.length).toBeCloseTo(4.267, 3);
    expect(feet.labelled.height).toBeCloseTo(2.438, 3);
  });

  it("reads counts and options", () => {
    const d = parseDetails(normalise("two doors and a window, 3 coats, walls only, magnolia"), "paint");
    expect(d).toMatchObject({ doors: 2, windows: 1 });
    expect(d.options).toMatchObject({ coats: 3, includeCeiling: false, colour: "magnolia" });
  });

  it("only treats product words as a job when there's a measurement or quantity question", () => {
    expect(detectIntent(normalise("screws for plasterboard"))).toBeNull();
    expect(detectIntent(normalise("white paint"))).toBeNull();
    expect(detectIntent(normalise("how much paint do I need"))).toBe("paint");
    expect(detectIntent(normalise("plasterboard for a 4m wall"))).toBe("plasterboard");
    expect(detectIntent(normalise("I want to tile my kitchen"))).toBe("tile");
    expect(detectIntent(normalise("insulate the loft"))).toBe("loft-insulation");
    expect(detectIntent(normalise("paint the bedroom"))).toBe("paint");
  });
});

describe("assistant", () => {
  it("estimates in one go when the message has everything", () => {
    const { last, state } = conversation(["Plasterboard a 4.2m x 2.4m wall"]);
    expect(qty(last, "PB-STD-125-TE")).toBe(4);
    expect(state.awaiting).toBeNull();
  });

  it("asks follow-up questions and then refines", () => {
    const { replies, state } = conversation([
      "I want to paint my bedroom",
      "4m x 3m",
      "2.4m (standard)",
      "3 coats",
      "Walls only",
    ]);
    expect(replies[0].estimate).toBeNull();
    expect(replies[0].productQuery).toBe("emulsion paint");
    expect(replies[1].text).toMatch(/How high/);
    expect(replies[2].estimate?.summary).toMatch(/7\.1 litres/);
    expect(replies[3].estimate?.assumptions[0]).toMatch(/^3 coats/);
    expect(replies[4].estimate?.measurements.some((m) => m.label === "Ceiling")).toBe(false);
    expect(state.job?.inputs).toMatchObject({ lengthM: 4, widthM: 3, heightM: 2.4 });
  });

  it("handles fencing with a panel height", () => {
    const { last } = conversation(["I need 20 metres of 6ft fencing"]);
    expect(qty(last, "LF-PANEL-OL-66")).toBe(11);
  });

  it("asks about existing loft insulation", () => {
    const { replies } = conversation(["Insulate my loft, it's about 8m x 5m", "None"]);
    expect(replies[0].text).toMatch(/insulation up there/);
    expect(replies[0].quickReplies).toContain("None");
    expect(qty(replies[1], "IN-LOFT-170")).toBe(9);
  });

  it("asks walls or floor for tiling", () => {
    const { replies } = conversation(["I want to tile my kitchen", "Walls", "2.4m x 1.2m"]);
    expect(replies[0].quickReplies).toEqual(["Walls", "Floor"]);
    expect(replies[2].estimate?.title).toBe("Tile a wall");
  });

  it("reads a depth given as a third dimension", () => {
    const { last } = conversation(["concrete base 3m x 2.4m x 150mm"]);
    expect(last.estimate?.summary).toMatch(/150 mm/);
  });

  it("falls back to product search", () => {
    const { last, state } = conversation(["screws for plasterboard"]);
    expect(last.intent).toBe("search");
    expect(last.productQuery).toBe("screws for plasterboard");
    expect(state.job).toBeNull();
  });

  it("keeps the job while searching mid-conversation", () => {
    const { last, state } = conversation(["Plasterboard a 4.2m x 2.4m wall", "drywall screws"]);
    expect(last.intent).toBe("search");
    expect(state.job?.type).toBe("plasterboard");
  });

  it("adds to basket only when asked", () => {
    const door = conversation(["Plasterboard a 4.2m x 2.4m wall", "Add a door"]);
    expect(door.last.action).toBeNull();
    expect(door.state.job?.inputs.doors).toBe(1);
    const add = conversation(["Plasterboard a 4.2m x 2.4m wall", "add them to my basket"]);
    expect(add.last.action).toBe("add-to-basket");
  });

  it("starts again on request", () => {
    const { state, last } = conversation(["Plasterboard a 4.2m x 2.4m wall", "Start a new job"]);
    expect(state).toEqual(INITIAL_STATE);
    expect(last.intent).toBe("reset");
  });

  it("switches job when a different one is described", () => {
    const { state } = conversation(["Plasterboard a 4.2m x 2.4m wall", "now tile a 2m x 2m bathroom floor"]);
    expect(state.job?.type).toBe("tile");
    expect(state.job?.inputs).toEqual({ lengthM: 2, widthM: 2 });
  });
});

import { describe, expect, it } from "vitest";
import { parseAmount, transferError } from "./transfer";

describe("parseAmount", () => {
  it("accepts plain and formatted amounts", () => {
    expect(parseAmount("500")).toBe(500);
    expect(parseAmount("1,000.50")).toBe(1000.5);
    expect(parseAmount("25,5")).toBe(25.5);
  });
  it("rejects zero, negatives, text and more than 2 decimals", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-10")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("transferError", () => {
  it("maps database codes to messages", () => {
    expect(transferError("INSUFFICIENT_FUNDS")).toBe("Nuk keni fonde të mjaftueshme");
    expect(transferError("something else")).toBe("Veprimi nuk u krye");
  });
});

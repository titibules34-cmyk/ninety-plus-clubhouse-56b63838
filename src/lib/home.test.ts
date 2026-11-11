import { describe, expect, it } from "vitest";
import { homeFor } from "./home";

describe("where accounts land after login", () => {
  it("players go to SPORT", () => expect(homeFor(["user"])).toBe("/sport"));
  it("admins and managers go to the dashboard", () => {
    expect(homeFor(["admin"])).toBe("/dashboard");
    expect(homeFor(["nen_menaxher"])).toBe("/dashboard");
  });
});

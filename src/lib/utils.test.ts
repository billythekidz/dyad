import { describe, it, expect } from "vitest";
import { cn, generateCuteAppName } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("a", "b")).toBe("a b");
      expect(cn("a", { b: true, c: false })).toBe("a b");
      expect(cn("p-4", "p-2")).toBe("p-2"); // tailwind-merge behavior
    });
  });

  describe("generateCuteAppName", () => {
    it("should return a string in format adjective-animal-verb", () => {
      const name = generateCuteAppName();
      const parts = name.split("-");
      expect(parts).toHaveLength(3);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });
});

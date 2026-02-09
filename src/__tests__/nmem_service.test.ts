/**
 * Unit tests for nmem_service.ts
 *
 * Tests neural memory service with mocked CLI responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import * as nmemService from "../lib/nmem_service";

// Mock child_process exec
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

// Mock electron-log
vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

describe("nmem_service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveMessage", () => {
    it("should save a simple text message to nmem", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      const result = await nmemService.saveMessage(
        42,
        { role: "user", content: "test message" },
        1337,
      );

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("nmem remember"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should handle empty message content gracefully", async () => {
      const result = await nmemService.saveMessage(
        42,
        { role: "user", content: "" },
        1337,
      );

      expect(result).toBe(false);
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should retry on failure up to 3 times", async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callCount++;
        if (callCount < 3) {
          callback(new Error("nmem failed"));
        } else {
          callback(null, { stdout: "Saved", stderr: "" });
        }
      });

      const result = await nmemService.saveMessage(
        42,
        { role: "user", content: "test" },
        1337,
      );

      expect(result).toBe(true);
      expect(callCount).toBe(3);
    });

    it("should return false after max retries exceeded", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("nmem failed"));
      });

      const result = await nmemService.saveMessage(
        42,
        { role: "user", content: "test" },
        1337,
      );

      expect(result).toBe(false);
      expect(mockExec).toHaveBeenCalledTimes(3); // 3 retries
    });

    it("should handle array content (multi-part messages)", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      const result = await nmemService.saveMessage(
        42,
        {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "Second part" },
          ],
        } as any,
        1337,
      );

      expect(result).toBe(true);
    });

    it("should escape quotes in message content", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      await nmemService.saveMessage(
        42,
        { role: "user", content: 'Message with "quotes" and \'apostrophes\'' },
        1337,
      );

      const calledCommand = mockExec.mock.calls[0][0] as string;
      expect(calledCommand).toContain('\\"');
    });
  });

  describe("batchSave", () => {
    it("should save multiple messages in sequence", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      const messages = [
        { message: { role: "user", content: "msg 1" }, messageId: 1 },
        { message: { role: "assistant", content: "msg 2" }, messageId: 2 },
        { message: { role: "user", content: "msg 3" }, messageId: 3 },
      ] as any;

      const saved = await nmemService.batchSave(42, messages);

      expect(saved).toBe(3);
      expect(mockExec).toHaveBeenCalledTimes(9); // 3 messages * 3 retries max (but succeeds on first)
    });

    it("should count partial failures correctly", async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callCount++;
        // First message succeeds, second fails, third succeeds
        if (callCount >= 4 && callCount <= 6) {
          callback(new Error("nmem failed"));
        } else {
          callback(null, { stdout: "Saved", stderr: "" });
        }
      });

      const messages = [
        { message: { role: "user", content: "msg 1" }, messageId: 1 },
        { message: { role: "user", content: "msg 2" }, messageId: 2 },
        { message: { role: "user", content: "msg 3" }, messageId: 3 },
      ] as any;

      const saved = await nmemService.batchSave(42, messages);

      expect(saved).toBe(2); // Only 2 out of 3 succeeded
    });
  });

  describe("recall", () => {
    it("should recall memories based on query", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, {
          stdout: "Memory 1\\nMemory 2\\nMemory 3",
          stderr: "",
        });
      });

      const results = await nmemService.recall(42, "authentication", 3);

      expect(results).toEqual(["Memory 1", "Memory 2", "Memory 3"]);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("nmem recall"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should return empty array on failure", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("nmem failed"));
      });

      const results = await nmemService.recall(42, "test query", 5);

      expect(results).toEqual([]);
    });

    it("should limit results to specified depth", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, {
          stdout: "Memory 1\\nMemory 2\\nMemory 3\\nMemory 4\\nMemory 5\\nMemory 6",
          stderr: "",
        });
      });

      const results = await nmemService.recall(42, "test", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("getContext", () => {
    it("should retrieve recent context", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Recent context data", stderr: "" });
      });

      const context = await nmemService.getContext(42, 20);

      expect(context).toBe("Recent context data");
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("nmem context --limit 20"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should return empty string on failure", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("nmem failed"));
      });

      const context = await nmemService.getContext(42, 20);

      expect(context).toBe("");
    });
  });

  describe("getToday", () => {
    it("should retrieve today's work", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Today's work summary", stderr: "" });
      });

      const today = await nmemService.getToday(42);

      expect(today).toBe("Today's work summary");
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("nmem today"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should handle errors gracefully", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("nmem not available"));
      });

      const today = await nmemService.getToday(42);

      expect(today).toBe("");
    });
  });

  describe("consolidate", () => {
    it("should consolidate neural memory", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Consolidated", stderr: "" });
      });

      const result = await nmemService.consolidate();

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("nmem consolidate"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should use longer timeout for consolidation", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Consolidated", stderr: "" });
      });

      await nmemService.consolidate();

      const calledOptions = mockExec.mock.calls[0][1] as any;
      expect(calledOptions.timeout).toBeGreaterThan(30000);
    });

    it("should return false on failure", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("consolidation failed"));
      });

      const result = await nmemService.consolidate();

      expect(result).toBe(false);
    });
  });

  describe("saveSummary", () => {
    it("should save conversation summary to nmem", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      const result = await nmemService.saveSummary(
        42,
        "User implemented authentication with JWT",
        { start: 1, end: 50 },
      );

      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("type:summary"),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should include message range in summary", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "Saved", stderr: "" });
      });

      await nmemService.saveSummary(42, "Test summary", { start: 10, end: 20 });

      const calledCommand = mockExec.mock.calls[0][0] as string;
      expect(calledCommand).toContain("range:10-20");
    });
  });

  describe("isNmemAvailable", () => {
    it("should return true when nmem is available", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(null, { stdout: "nmem v1.0.0", stderr: "" });
      });

      const available = await nmemService.isNmemAvailable();

      expect(available).toBe(true);
    });

    it("should return false when nmem is not available", async () => {
      mockExec.mockImplementation((cmd, opts, callback: any) => {
        callback(new Error("command not found"));
      });

      const available = await nmemService.isNmemAvailable();

      expect(available).toBe(false);
    });
  });
});

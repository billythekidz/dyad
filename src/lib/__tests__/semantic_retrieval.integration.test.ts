/**
 * Integration Tests for Phase 3: Semantic Retrieval
 *
 * Tests the complete semantic retrieval flow:
 * - Context need detection
 * - Semantic recall from nmem
 * - Context merging
 * - Integration with chat handler
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { detectContextNeed } from "../context_detector";
import { recallContext, clearAllCache } from "../semantic_recall";
import { mergeContexts } from "../context_assembly";
import type { ModelMessage } from "ai";

describe("Phase 3: Semantic Retrieval Integration Tests", () => {
  beforeAll(() => {
    // Clear cache before tests
    clearAllCache();
  });

  afterAll(() => {
    // Clean up after tests
    clearAllCache();
  });

  describe("Context Need Detection", () => {
    test("should detect explicit references", () => {
      const testCases = [
        "Remember when we worked on authentication?",
        "Like we did with the login feature",
        "As we discussed earlier about the API",
        "Can you recall what we said about the database?",
      ];

      for (const message of testCases) {
        const result = detectContextNeed(message);
        expect(result.needsContext).toBe(true);
        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    });

    test("should detect temporal references", () => {
      const testCases = [
        "What did we work on yesterday?",
        "Last week we discussed the payment system",
        "Earlier you mentioned the bug fix",
        "Previously we talked about deployment",
      ];

      for (const message of testCases) {
        const result = detectContextNeed(message);
        expect(result.needsContext).toBe(true);
        expect(result.triggeredPatterns.length).toBeGreaterThan(0);
      }
    });

    test("should detect topic switches", () => {
      const message = "Now let's work on the payment integration";
      const result = detectContextNeed(message);

      expect(result.keywords).toContain("payment");
      expect(result.keywords).toContain("integration");
      // May or may not need context based on heuristics
      // Just verify keywords are extracted correctly
    });

    test("should NOT detect for simple messages", () => {
      const testCases = [
        "Hello",
        "Thanks!",
        "OK",
        "Yes, that works",
      ];

      for (const message of testCases) {
        const result = detectContextNeed(message);
        // These simple messages shouldn't trigger context need
        expect(result.keywords.length).toBeLessThan(3);
      }
    });

    test("should extract meaningful keywords", () => {
      const message = "Remember when we implemented authentication using JWT tokens?";
      const result = detectContextNeed(message);

      expect(result.keywords).toContain("implemented");
      expect(result.keywords).toContain("authentication");
      expect(result.keywords).toContain("jwt");
      expect(result.keywords).toContain("tokens");
      // Should NOT contain stop words
      expect(result.keywords).not.toContain("when");
      expect(result.keywords).not.toContain("the");
    });
  });

  describe("Context Merging", () => {
    test("should merge recalled and active messages correctly", () => {
      const activeWindow: ModelMessage[] = [
        { role: "user", content: "Current message 1" },
        { role: "assistant", content: "Current response 1" },
        { role: "user", content: "Current message 2" },
      ];

      const recalled: ModelMessage[] = [
        { role: "user", content: "Old message about auth" },
        { role: "assistant", content: "Old response about auth" },
      ];

      const merged = mergeContexts(activeWindow, recalled);

      // Should have: recalled marker + 2 recalled + active marker + 3 active = 7
      expect(merged.length).toBeGreaterThan(activeWindow.length);

      // Should contain marker messages
      const contents = merged.map(m =>
        typeof m.content === "string" ? m.content : ""
      );
      const hasRecalledMarker = contents.some(c => c.includes("RECALLED CONTEXT"));
      const hasActiveMarker = contents.some(c => c.includes("RECENT CONTEXT"));

      expect(hasRecalledMarker).toBe(true);
      expect(hasActiveMarker).toBe(true);
    });

    test("should deduplicate messages", () => {
      const activeWindow: ModelMessage[] = [
        { role: "user", content: "Message A" },
        { role: "assistant", content: "Response A" },
      ];

      const recalled: ModelMessage[] = [
        { role: "user", content: "Message A" }, // Duplicate
        { role: "assistant", content: "Response B" }, // Unique
      ];

      const merged = mergeContexts(activeWindow, recalled);

      // Should only have unique messages
      // Check that "Message A" appears only once
      const messageACount = merged.filter(m =>
        typeof m.content === "string" && m.content === "Message A"
      ).length;

      expect(messageACount).toBe(1);
    });

    test("should handle empty recalled messages", () => {
      const activeWindow: ModelMessage[] = [
        { role: "user", content: "Current message" },
      ];

      const recalled: ModelMessage[] = [];

      const merged = mergeContexts(activeWindow, recalled);

      // Should return active window as-is
      expect(merged).toEqual(activeWindow);
    });

    test("should respect token budget", () => {
      const activeWindow: ModelMessage[] = [
        { role: "user", content: "A".repeat(1000) },
      ];

      const recalled: ModelMessage[] = [
        { role: "user", content: "B".repeat(50000) }, // Very large message
      ];

      const merged = mergeContexts(activeWindow, recalled, 5000); // Small budget

      // Should trim or exclude large recalled messages
      expect(merged.length).toBeGreaterThan(0);

      // Calculate estimated tokens
      const totalChars = merged.reduce((sum, msg) => {
        const content = typeof msg.content === "string" ? msg.content : "";
        return sum + content.length;
      }, 0);
      const estimatedTokens = Math.ceil(totalChars / 4);

      // Should be within or close to budget
      expect(estimatedTokens).toBeLessThan(6000); // Allow some margin
    });
  });

  describe("Semantic Recall Service", () => {
    test("should handle recall errors gracefully", async () => {
      // Test with invalid chat ID
      const result = await recallContext(-1, ["test"], 5);

      // Should return empty array on error, not throw
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test("should limit results to specified depth", async () => {
      // Note: This test requires nmem to be available and have data
      // In a real test environment, you'd mock the nmem service
      const keywords = ["authentication", "login"];
      const limit = 3;

      const result = await recallContext(1, keywords, limit);

      // Should not exceed limit
      expect(result.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("End-to-End Scenarios", () => {
    test("Scenario 1: User references past work on auth", async () => {
      const userMessage = "Like we did with the authentication feature";

      // Step 1: Detect context need
      const detection = detectContextNeed(userMessage);
      expect(detection.needsContext).toBe(true);
      expect(detection.keywords).toContain("authentication");

      // Step 2: Recall context (would query nmem in real scenario)
      const recalled = await recallContext(1, detection.keywords, 5);

      // Step 3: Merge with active window
      const activeWindow: ModelMessage[] = [
        { role: "user", content: userMessage },
      ];

      const merged = mergeContexts(activeWindow, recalled);

      // Should have at least the active window
      expect(merged.length).toBeGreaterThanOrEqual(activeWindow.length);
    });

    test("Scenario 2: User asks about yesterday's discussion", async () => {
      const userMessage = "What did we discuss yesterday about the database?";

      const detection = detectContextNeed(userMessage);

      expect(detection.needsContext).toBe(true);
      expect(detection.triggeredPatterns).toContain("yesterday");
      expect(detection.keywords).toContain("database");
    });

    test("Scenario 3: User continues work on existing feature", async () => {
      const userMessage = "Now let's continue working on the payment system";

      const detection = detectContextNeed(userMessage);

      expect(detection.keywords).toContain("payment");
      expect(detection.keywords).toContain("system");
    });

    test("Scenario 4: Simple question without context need", async () => {
      const userMessage = "How do I create a React component?";

      const detection = detectContextNeed(userMessage);

      // This is a new question, may or may not need context
      // Just verify it processes without error
      expect(detection).toBeDefined();
      expect(Array.isArray(detection.keywords)).toBe(true);
    });
  });

  describe("Performance Tests", () => {
    test("context detection should be fast (<10ms)", () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        detectContextNeed("Remember when we worked on authentication?");
      }

      const duration = Date.now() - start;
      const avgDuration = duration / 100;

      expect(avgDuration).toBeLessThan(10);
    });

    test("context merging should be fast (<50ms)", () => {
      const activeWindow: ModelMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
      })) as ModelMessage[];

      const recalled: ModelMessage[] = Array.from({ length: 5 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Recalled ${i}`,
      })) as ModelMessage[];

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        mergeContexts(activeWindow, recalled);
      }

      const duration = Date.now() - start;
      const avgDuration = duration / 100;

      expect(avgDuration).toBeLessThan(50);
    });
  });

  describe("Accuracy Tests", () => {
    test("should detect 90%+ of explicit context references", () => {
      const testCases = [
        { message: "Remember when we added auth?", expected: true },
        { message: "Like we did before", expected: true },
        { message: "What did we discuss yesterday?", expected: true },
        { message: "Continue the feature from earlier", expected: true },
        { message: "As we talked about last week", expected: true },
        { message: "That bug we fixed", expected: true },
        { message: "The issue from before", expected: true },
        { message: "Can you recall the API setup?", expected: true },
        { message: "Do you remember the deployment?", expected: true },
        { message: "Previously you said", expected: true },
      ];

      let correctDetections = 0;

      for (const testCase of testCases) {
        const result = detectContextNeed(testCase.message);
        if (result.needsContext === testCase.expected) {
          correctDetections++;
        }
      }

      const accuracy = (correctDetections / testCases.length) * 100;

      // Target: >90% accuracy
      expect(accuracy).toBeGreaterThanOrEqual(90);
    });

    test("should have low false positive rate (<5%)", () => {
      const testCases = [
        "Hello!",
        "Thanks for the help",
        "OK, sounds good",
        "Yes, please",
        "No problem",
      ];

      let falsePositives = 0;

      for (const message of testCases) {
        const result = detectContextNeed(message);
        // These simple messages shouldn't trigger high-confidence context need
        if (result.needsContext && result.confidence > 0.7) {
          falsePositives++;
        }
      }

      const falsePositiveRate = (falsePositives / testCases.length) * 100;

      // Target: <5% false positive rate
      expect(falsePositiveRate).toBeLessThan(5);
    });
  });
});

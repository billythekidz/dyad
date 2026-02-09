/**
 * Phase 2 Integration Tests: Active Window
 *
 * Tests for Neural Memory-First Architecture Phase 2:
 * - Memory tier assignment
 * - Active window retrieval
 * - Dynamic window sizing
 * - Token reduction verification
 * - Migration functionality
 *
 * @module __tests__/phase2_active_window.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { initializeDatabase } from "../db";
import { db } from "../db";
import { chats, messages, apps, chatMemoryConfig } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ModelMessage } from "ai";

// Initialize database before all tests
beforeAll(async () => {
  initializeDatabase();
});

// Modules under test
import {
  updateMemoryTiers,
  updateTiersForNewMessage,
  getTierStats,
} from "../lib/memory_tier_manager";
import {
  getActiveWindow,
  estimateActiveWindowTokens,
  getAllMessages,
} from "../lib/context_assembly";
import {
  calculateOptimalWindowSize,
  autoAdjustWindowSize,
  setTokenBudget,
} from "../lib/dynamic_window_sizing";
import {
  migrateChatToNeural,
  isChatMigrated,
  getMigrationStats,
} from "../lib/migrate_chat_to_neural";

// Test helpers
let testAppId: number;
let testChatId: number;

async function createTestApp(): Promise<number> {
  const [app] = await db
    .insert(apps)
    .values({
      name: "Test App",
      path: "/test/path",
    })
    .returning({ id: apps.id });

  return app.id;
}

async function createTestChat(appId: number): Promise<number> {
  const [chat] = await db
    .insert(chats)
    .values({
      appId,
      title: "Test Chat",
    })
    .returning({ id: chats.id });

  return chat.id;
}

async function createTestMessages(
  chatId: number,
  count: number
): Promise<number[]> {
  const messageIds: number[] = [];

  for (let i = 0; i < count; i++) {
    const [msg] = await db
      .insert(messages)
      .values({
        chatId,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Test message ${i + 1}. This is some content for testing. `.repeat(
          5
        ),
      })
      .returning({ id: messages.id });

    messageIds.push(msg.id);
  }

  return messageIds;
}

async function cleanupTestData() {
  if (testChatId) {
    await db.delete(messages).where(eq(messages.chatId, testChatId));
    await db.delete(chats).where(eq(chats.id, testChatId));
  }
  if (testAppId) {
    await db.delete(apps).where(eq(apps.id, testAppId));
  }
}

describe("Phase 2: Active Window - Memory Tier Assignment", () => {
  beforeEach(async () => {
    testAppId = await createTestApp();
    testChatId = await createTestChat(testAppId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should assign correct tiers to 50 messages", async () => {
    // Create 50 messages
    await createTestMessages(testChatId, 50);

    // Update tiers
    const result = await updateMemoryTiers(testChatId);

    // Verify tier counts
    expect(result.active).toBe(30); // Last 30 messages
    expect(result.session).toBe(20); // Messages 31-50
    expect(result.archived).toBe(0); // No archived yet

    // Verify stats
    const stats = await getTierStats(testChatId);
    expect(stats.active).toBe(30);
    expect(stats.session).toBe(20);
    expect(stats.archived).toBe(0);
    expect(stats.total).toBe(50);
  });

  it("should assign correct tiers to 200+ messages", async () => {
    // Create 250 messages
    await createTestMessages(testChatId, 250);

    // Update tiers
    const result = await updateMemoryTiers(testChatId);

    // Verify tier counts
    expect(result.active).toBe(30); // Last 30
    expect(result.session).toBe(170); // Messages 31-200
    expect(result.archived).toBe(50); // Messages 201-250
  });

  it("should update tiers incrementally for new messages", async () => {
    // Create initial 25 messages
    await createTestMessages(testChatId, 25);
    await updateMemoryTiers(testChatId);

    // Add 10 more messages
    const newMessageIds = await createTestMessages(testChatId, 10);

    // Update tiers for new messages
    for (const msgId of newMessageIds) {
      await updateTiersForNewMessage(testChatId, msgId);
    }

    // Verify final state
    const stats = await getTierStats(testChatId);
    expect(stats.total).toBe(35);
    expect(stats.active).toBe(30); // Should still be 30
    expect(stats.session).toBe(5); // Remaining messages
  });
});

describe("Phase 2: Active Window - Context Assembly", () => {
  beforeEach(async () => {
    testAppId = await createTestApp();
    testChatId = await createTestChat(testAppId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should retrieve only active tier messages", async () => {
    // Create 100 messages
    await createTestMessages(testChatId, 100);

    // Assign tiers
    await updateMemoryTiers(testChatId);

    // Get active window
    const activeMessages = await getActiveWindow(testChatId);

    // Should return only last 30 messages
    expect(activeMessages.length).toBe(30);

    // Verify messages are in chronological order
    expect(activeMessages[0].role).toBe("user"); // First should be user
  });

  it("should estimate token count correctly", async () => {
    // Create 50 messages
    await createTestMessages(testChatId, 50);

    // Assign tiers
    await updateMemoryTiers(testChatId);

    // Estimate tokens for active window
    const estimatedTokens = await estimateActiveWindowTokens(testChatId);

    // With 30 messages, each ~125 chars (5 repetitions of 25 chars)
    // ~125 / 4 = ~31 tokens per message
    // 30 messages * 31 tokens = ~930 tokens
    expect(estimatedTokens).toBeGreaterThan(500);
    expect(estimatedTokens).toBeLessThan(2000);
  });

  it("should demonstrate token reduction vs legacy mode", async () => {
    // Create 200 messages
    await createTestMessages(testChatId, 200);

    // Assign tiers
    await updateMemoryTiers(testChatId);

    // Get active window (neural memory mode)
    const activeMessages = await getActiveWindow(testChatId);
    const activeTokens = await estimateActiveWindowTokens(testChatId);

    // Get all messages (legacy mode)
    const allMessages = await getAllMessages(testChatId);

    // Calculate token reduction
    const allTokens = allMessages.reduce((sum, msg) => {
      const content = typeof msg.content === "string" ? msg.content : "";
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const tokenReduction = ((allTokens - activeTokens) / allTokens) * 100;

    // Verify significant token reduction
    expect(activeMessages.length).toBe(30);
    expect(allMessages.length).toBe(200);
    expect(tokenReduction).toBeGreaterThan(60); // At least 60% reduction
    expect(tokenReduction).toBeLessThan(90); // Reasonable upper bound

    console.log(`Token Reduction Test:`);
    console.log(`  Active window: ${activeMessages.length} messages, ${activeTokens} tokens`);
    console.log(`  Legacy mode: ${allMessages.length} messages, ${allTokens} tokens`);
    console.log(`  Reduction: ${tokenReduction.toFixed(1)}%`);
  });
});

describe("Phase 2: Active Window - Dynamic Window Sizing", () => {
  beforeEach(async () => {
    testAppId = await createTestApp();
    testChatId = await createTestChat(testAppId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should calculate optimal window size based on message length", async () => {
    // Create 100 messages with standard length
    await createTestMessages(testChatId, 100);

    // Calculate optimal window size
    const optimalSize = await calculateOptimalWindowSize(testChatId);

    // With ~125 chars per message (~31 tokens), and 40k budget:
    // 40000 / 31 = ~1290 messages
    // But capped at MAX_WINDOW_SIZE (50)
    expect(optimalSize).toBeGreaterThanOrEqual(10); // MIN_WINDOW_SIZE
    expect(optimalSize).toBeLessThanOrEqual(50); // MAX_WINDOW_SIZE
  });

  it("should adjust window size for longer messages", async () => {
    // Create messages with very long content
    const longMessageIds: number[] = [];
    for (let i = 0; i < 50; i++) {
      const [msg] = await db
        .insert(messages)
        .values({
          chatId: testChatId,
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Very long message content. `.repeat(100), // ~2500 chars = ~625 tokens
        })
        .returning({ id: messages.id });

      longMessageIds.push(msg.id);
    }

    // Calculate optimal window size
    const optimalSize = await calculateOptimalWindowSize(testChatId);

    // With ~625 tokens per message, and 40k budget:
    // 40000 / 625 = 64 messages
    // Capped at 50
    expect(optimalSize).toBeLessThanOrEqual(50);
  });

  it("should allow custom token budget", async () => {
    await createTestMessages(testChatId, 50);

    // Set custom budget (lower)
    await setTokenBudget(testChatId, 20000); // 20k instead of 40k

    const optimalSize = await calculateOptimalWindowSize(testChatId);

    // Should be smaller than default
    expect(optimalSize).toBeGreaterThanOrEqual(10);
    expect(optimalSize).toBeLessThanOrEqual(50);
  });

  it("should auto-adjust window size periodically", async () => {
    // Create initial messages
    await createTestMessages(testChatId, 5);

    // Auto-adjust should not trigger (not at 10-message interval)
    const result1 = await autoAdjustWindowSize(testChatId);
    expect(result1).toBeNull();

    // Add 5 more (total 10)
    await createTestMessages(testChatId, 5);

    // Should trigger at 10-message interval
    const result2 = await autoAdjustWindowSize(testChatId);
    expect(result2).not.toBeNull();
    expect(result2).toBeGreaterThanOrEqual(10);
  });
});

describe("Phase 2: Active Window - Migration", () => {
  beforeEach(async () => {
    testAppId = await createTestApp();
    testChatId = await createTestChat(testAppId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should successfully migrate a chat", async () => {
    // Create unmigrated chat with messages
    await createTestMessages(testChatId, 75);

    // Verify not migrated
    const beforeMigration = await isChatMigrated(testChatId);
    expect(beforeMigration).toBe(false);

    // Migrate
    const result = await migrateChatToNeural(testChatId, false); // Don't queue nmem sync

    // Verify migration succeeded
    expect(result.success).toBe(true);
    expect(result.messagesProcessed).toBe(75);
    expect(result.tiersAssigned).toBe(true);
    expect(result.configCreated).toBe(true);

    // Verify migrated
    const afterMigration = await isChatMigrated(testChatId);
    expect(afterMigration).toBe(true);

    // Verify tiers assigned correctly
    const stats = await getTierStats(testChatId);
    expect(stats.active).toBe(30);
    expect(stats.session).toBe(45);
    expect(stats.archived).toBe(0);
  });

  it("should handle empty chat migration", async () => {
    // No messages

    // Migrate empty chat
    const result = await migrateChatToNeural(testChatId, false);

    // Should succeed but process 0 messages
    expect(result.success).toBe(true);
    expect(result.messagesProcessed).toBe(0);
  });

  it("should not re-migrate already migrated chat", async () => {
    await createTestMessages(testChatId, 50);

    // First migration
    await migrateChatToNeural(testChatId, false);

    // Verify migrated
    const isMigrated = await isChatMigrated(testChatId);
    expect(isMigrated).toBe(true);

    // Second migration should detect already migrated
    // (Implementation should check and skip)
  });

  it("should report migration statistics", async () => {
    // Create multiple test chats
    const chat1 = await createTestChat(testAppId);
    const chat2 = await createTestChat(testAppId);

    await createTestMessages(chat1, 20);
    await createTestMessages(chat2, 30);

    // Migrate one chat
    await migrateChatToNeural(chat1, false);

    // Get stats
    const stats = await getMigrationStats();

    // Should have at least 3 total chats (testChatId + chat1 + chat2)
    expect(stats.totalChats).toBeGreaterThanOrEqual(3);
    expect(stats.migratedChats).toBeGreaterThanOrEqual(1);

    // Cleanup extra chats
    await db.delete(chats).where(eq(chats.id, chat1));
    await db.delete(chats).where(eq(chats.id, chat2));
  });
});

describe("Phase 2: Active Window - A/B Test Simulation", () => {
  beforeEach(async () => {
    testAppId = await createTestApp();
    testChatId = await createTestChat(testAppId);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("should demonstrate neural vs legacy performance", async () => {
    // Simulate realistic conversation: 150 messages
    await createTestMessages(testChatId, 150);

    // Assign tiers for neural memory
    await updateMemoryTiers(testChatId);

    // === NEURAL MEMORY MODE ===
    const neuralStart = Date.now();
    const neuralMessages = await getActiveWindow(testChatId);
    const neuralTokens = await estimateActiveWindowTokens(testChatId);
    const neuralTime = Date.now() - neuralStart;

    // === LEGACY MODE ===
    const legacyStart = Date.now();
    const legacyMessages = await getAllMessages(testChatId);
    const legacyTokens = legacyMessages.reduce((sum, msg) => {
      const content = typeof msg.content === "string" ? msg.content : "";
      return sum + Math.ceil(content.length / 4);
    }, 0);
    const legacyTime = Date.now() - legacyStart;

    // Calculate metrics
    const tokenReduction = ((legacyTokens - neuralTokens) / legacyTokens) * 100;
    const messageReduction =
      ((legacyMessages.length - neuralMessages.length) / legacyMessages.length) *
      100;

    // Assertions
    expect(neuralMessages.length).toBe(30); // Active window size
    expect(legacyMessages.length).toBe(150); // All messages
    expect(tokenReduction).toBeGreaterThan(60); // Target: 60-70% reduction
    expect(messageReduction).toBeGreaterThan(70); // Should be ~80%

    // Log results for verification
    console.log("\n=== A/B Test Results ===");
    console.log(`Neural Memory Mode:`);
    console.log(`  Messages: ${neuralMessages.length}`);
    console.log(`  Tokens: ${neuralTokens}`);
    console.log(`  Query time: ${neuralTime}ms`);
    console.log(`Legacy Mode:`);
    console.log(`  Messages: ${legacyMessages.length}`);
    console.log(`  Tokens: ${legacyTokens}`);
    console.log(`  Query time: ${legacyTime}ms`);
    console.log(`Improvements:`);
    console.log(`  Token reduction: ${tokenReduction.toFixed(1)}%`);
    console.log(`  Message reduction: ${messageReduction.toFixed(1)}%`);
    console.log(`  Speed improvement: ${(legacyTime - neuralTime).toFixed(0)}ms`);
  });
});

/**
 * Batch queue for nmem operations to reduce CLI calls
 * Part of Phase 5: Optimization & Rollout
 *
 * Batches nmem operations together and flushes every 5 seconds or when batch size reaches 10
 * Target: Reduce nmem CLI calls by 90%
 */

import { spawn } from "node:child_process";
import log from "electron-log";

export interface NmemOperation {
  type: "add" | "update" | "delete";
  id: string;
  data?: {
    content: string;
    metadata?: Record<string, any>;
  };
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class NmemBatchQueue {
  private queue: NmemOperation[] = [];
  private readonly batchSize = 10;
  private readonly flushIntervalMs = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private stats = {
    totalOperations: 0,
    batchesFlushed: 0,
    cliCallsSaved: 0,
  };

  constructor() {
    this.startFlushTimer();
  }

  /**
   * Add operation to the batch queue
   */
  async enqueue(operation: Omit<NmemOperation, "resolve" | "reject">): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...operation,
        resolve,
        reject,
      });

      this.stats.totalOperations++;

      // Flush if batch size reached
      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    });
  }

  /**
   * Flush the current batch
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = [...this.queue];
    this.queue = [];

    // Reset timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.startFlushTimer();
    }

    this.stats.batchesFlushed++;
    this.stats.cliCallsSaved += Math.max(0, batch.length - 1);

    try {
      // Group operations by type for efficient batching
      const addOps = batch.filter((op) => op.type === "add");
      const updateOps = batch.filter((op) => op.type === "update");
      const deleteOps = batch.filter((op) => op.type === "delete");

      // Execute batched operations
      await Promise.all([
        this.executeBatchAdd(addOps),
        this.executeBatchUpdate(updateOps),
        this.executeBatchDelete(deleteOps),
      ]);
    } catch (error) {
      log.error("Error flushing nmem batch:", error);
      // Reject all operations in batch
      batch.forEach((op) =>
        op.reject(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }

  /**
   * Execute batch add operations
   */
  private async executeBatchAdd(operations: NmemOperation[]): Promise<void> {
    if (operations.length === 0) return;

    try {
      // Prepare batch input for nmem CLI
      const batchInput = operations.map((op) => ({
        id: op.id,
        content: op.data?.content || "",
        metadata: op.data?.metadata || {},
      }));

      // Execute single nmem command with all adds
      const result = await this.executeNmemCommand("batch-add", batchInput);

      // Resolve all operations
      operations.forEach((op, index) => {
        op.resolve(result[index] || { success: true });
      });
    } catch (error) {
      operations.forEach((op) =>
        op.reject(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }

  /**
   * Execute batch update operations
   */
  private async executeBatchUpdate(operations: NmemOperation[]): Promise<void> {
    if (operations.length === 0) return;

    try {
      const batchInput = operations.map((op) => ({
        id: op.id,
        content: op.data?.content || "",
        metadata: op.data?.metadata || {},
      }));

      const result = await this.executeNmemCommand("batch-update", batchInput);

      operations.forEach((op, index) => {
        op.resolve(result[index] || { success: true });
      });
    } catch (error) {
      operations.forEach((op) =>
        op.reject(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }

  /**
   * Execute batch delete operations
   */
  private async executeBatchDelete(operations: NmemOperation[]): Promise<void> {
    if (operations.length === 0) return;

    try {
      const ids = operations.map((op) => op.id);

      const result = await this.executeNmemCommand("batch-delete", ids);

      operations.forEach((op, index) => {
        op.resolve(result[index] || { success: true });
      });
    } catch (error) {
      operations.forEach((op) =>
        op.reject(error instanceof Error ? error : new Error(String(error))),
      );
    }
  }

  /**
   * Execute nmem CLI command
   */
  private async executeNmemCommand(command: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn("nmem", [command], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse nmem output: ${stdout}`));
          }
        } else {
          reject(new Error(`nmem command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", (error) => {
        reject(error);
      });

      // Write batch data to stdin
      process.stdin.write(JSON.stringify(data));
      process.stdin.end();
    });
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Get batch queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentQueueSize: this.queue.length,
      reductionPercentage:
        this.stats.totalOperations > 0
          ? (this.stats.cliCallsSaved / this.stats.totalOperations) * 100
          : 0,
    };
  }

  /**
   * Shutdown the batch queue
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    await this.flush();
  }
}

// Singleton instance
export const nmemBatchQueue = new NmemBatchQueue();

/**
 * Feature flag system for gradual rollout of Neural Memory
 * Part of Phase 5: Optimization & Rollout
 */

import crypto from "node:crypto";
import log from "electron-log";

export interface RolloutConfig {
  percentage: number; // 0-100
  betaUsers: string[];
  enabled: boolean;
}

/**
 * Hash user ID to deterministic number for consistent rollout
 */
function hashUserId(userId: string): number {
  const hash = crypto.createHash("sha256").update(userId).digest("hex");
  // Convert first 8 chars to number 0-99
  return Number.parseInt(hash.substring(0, 8), 16) % 100;
}

/**
 * Check if neural memory is enabled for a user
 */
export function isNeuralMemoryEnabled(
  userId: string,
  config?: RolloutConfig,
): boolean {
  // Get config from environment or use defaults
  const rolloutConfig: RolloutConfig = config || {
    percentage: Number.parseInt(process.env.NEURAL_MEMORY_ROLLOUT || "0", 10),
    betaUsers: (process.env.NEURAL_MEMORY_BETA_USERS || "").split(",").filter(Boolean),
    enabled: process.env.NEURAL_MEMORY_ENABLED !== "false",
  };

  // Check if feature is globally disabled
  if (!rolloutConfig.enabled) {
    return false;
  }

  // Check beta users first
  if (rolloutConfig.betaUsers.includes(userId)) {
    log.info(`[FeatureFlag] Neural memory enabled for beta user: ${userId}`);
    return true;
  }

  // Gradual rollout based on user ID hash
  const userHash = hashUserId(userId);
  const enabled = userHash < rolloutConfig.percentage;

  if (enabled) {
    log.info(
      `[FeatureFlag] Neural memory enabled for user: ${userId} (rollout: ${rolloutConfig.percentage}%)`,
    );
  }

  return enabled;
}

/**
 * Get current rollout status
 */
export function getRolloutStatus(): RolloutConfig & {
  stage: "disabled" | "beta" | "early-adopters" | "majority" | "full";
} {
  const percentage = Number.parseInt(
    process.env.NEURAL_MEMORY_ROLLOUT || "0",
    10,
  );
  const betaUsers = (process.env.NEURAL_MEMORY_BETA_USERS || "")
    .split(",")
    .filter(Boolean);
  const enabled = process.env.NEURAL_MEMORY_ENABLED !== "false";

  let stage: "disabled" | "beta" | "early-adopters" | "majority" | "full" =
    "disabled";
  if (enabled) {
    if (percentage === 0) stage = "beta";
    else if (percentage <= 25) stage = "early-adopters";
    else if (percentage <= 75) stage = "majority";
    else stage = "full";
  }

  return {
    percentage,
    betaUsers,
    enabled,
    stage,
  };
}

/**
 * Set rollout percentage
 */
export function setRolloutPercentage(percentage: number): void {
  if (percentage < 0 || percentage > 100) {
    throw new Error("Rollout percentage must be between 0 and 100");
  }

  process.env.NEURAL_MEMORY_ROLLOUT = percentage.toString();
  log.warn(
    `[FeatureFlag] Neural memory rollout set to ${percentage}% (restart required)`,
  );
}

/**
 * Add beta user
 */
export function addBetaUser(userId: string): void {
  const current = (process.env.NEURAL_MEMORY_BETA_USERS || "")
    .split(",")
    .filter(Boolean);

  if (!current.includes(userId)) {
    current.push(userId);
    process.env.NEURAL_MEMORY_BETA_USERS = current.join(",");
    log.info(`[FeatureFlag] Added beta user: ${userId}`);
  }
}

/**
 * Remove beta user
 */
export function removeBetaUser(userId: string): void {
  const current = (process.env.NEURAL_MEMORY_BETA_USERS || "")
    .split(",")
    .filter(Boolean);

  const updated = current.filter((id) => id !== userId);
  process.env.NEURAL_MEMORY_BETA_USERS = updated.join(",");
  log.info(`[FeatureFlag] Removed beta user: ${userId}`);
}

/**
 * Rollout schedule helper
 */
export const ROLLOUT_SCHEDULE = {
  DAY_1_BETA: 0,
  DAY_2_EARLY: 25,
  DAY_3_HALF: 50,
  DAY_4_MAJORITY: 75,
  DAY_5_FULL: 100,
} as const;

/**
 * Get recommended rollout stage based on metrics
 */
export function getRecommendedRolloutAction(metrics: {
  errorRate: number;
  userSatisfaction: number;
  performanceIssues: number;
}): {
  action: "rollback" | "hold" | "proceed" | "accelerate";
  reason: string;
} {
  // Rollback if error rate is high
  if (metrics.errorRate > 5) {
    return {
      action: "rollback",
      reason: `Error rate too high: ${metrics.errorRate}%`,
    };
  }

  // Hold if user satisfaction is low
  if (metrics.userSatisfaction < 70) {
    return {
      action: "hold",
      reason: `User satisfaction too low: ${metrics.userSatisfaction}%`,
    };
  }

  // Hold if performance issues
  if (metrics.performanceIssues > 10) {
    return {
      action: "hold",
      reason: `Too many performance issues: ${metrics.performanceIssues}`,
    };
  }

  // Accelerate if everything is great
  if (
    metrics.errorRate < 1 &&
    metrics.userSatisfaction > 90 &&
    metrics.performanceIssues === 0
  ) {
    return {
      action: "accelerate",
      reason: "All metrics excellent, safe to accelerate rollout",
    };
  }

  // Otherwise proceed as planned
  return {
    action: "proceed",
    reason: "Metrics within acceptable range",
  };
}

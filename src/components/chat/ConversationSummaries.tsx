/**
 * ConversationSummaries Component
 *
 * Displays conversation summaries in a collapsible timeline view.
 * Allows users to navigate through summarized sections of long conversations.
 *
 * @module ConversationSummaries
 */

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Clock, MessageSquare } from "lucide-react";
import { chatClient } from "@/ipc/types/chat";

interface Summary {
  id: number;
  startMessageId: number;
  endMessageId: number;
  summary: string;
  estimatedTokens: number;
  createdAt: Date;
}

interface ConversationSummariesProps {
  chatId: number;
}

export function ConversationSummaries({ chatId }: ConversationSummariesProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedSummaryId, setExpandedSummaryId] = useState<number | null>(null);

  useEffect(() => {
    if (isExpanded && summaries.length === 0) {
      loadSummaries();
    }
  }, [isExpanded, chatId]);

  const loadSummaries = async () => {
    setLoading(true);
    try {
      const result = await chatClient.getSummaries(chatId);
      if (result && Array.isArray(result)) {
        setSummaries(result);
      }
    } catch (error) {
      console.error("Failed to load summaries:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSummary = (summaryId: number) => {
    setExpandedSummaryId(expandedSummaryId === summaryId ? null : summaryId);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (summaries.length === 0 && !isExpanded) {
    return null; // Don't show anything if no summaries
  }

  return (
    <div className="conversation-summaries border-b border-border/40 bg-muted/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <MessageSquare className="h-4 w-4" />
          <span>Conversation Summaries</span>
          {summaries.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
              {summaries.length}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              Loading summaries...
            </div>
          ) : summaries.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No summaries yet. Summaries are created every 50 messages.
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {summaries.map((summary, index) => (
                <div
                  key={summary.id}
                  className="rounded-lg border border-border/40 bg-card overflow-hidden"
                >
                  <button
                    onClick={() => toggleSummary(summary.id)}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      {expandedSummaryId === summary.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary">
                          Summary #{index + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Messages {summary.startMessageId}-{summary.endMessageId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(summary.createdAt)}</span>
                        <span className="ml-auto">
                          ~{summary.estimatedTokens} tokens
                        </span>
                      </div>
                    </div>
                  </button>

                  {expandedSummaryId === summary.id && (
                    <div className="border-t border-border/40 p-4 bg-muted/20">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {summary.summary.split("\n").map((line, i) => (
                          <p key={i} className="mb-2 last:mb-0 text-sm">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

# Neural Memory Beta Testing Guide

Welcome to the Neural Memory beta testing program! This guide will help you test the new neural memory system effectively.

## What is Neural Memory?

Neural Memory is Dyad's new intelligent conversation management system that enables **unlimited conversation length** while maintaining fast performance. It uses:

- **Smart Memory Tiers**: Automatically categorizes messages by importance
- **Active Window**: Keeps recent messages instantly accessible
- **Semantic Recall**: Intelligently retrieves relevant past context when needed
- **Automatic Summarization**: Creates concise summaries of long conversations

## Benefits

- **Unlimited Conversations**: No more 200-message limit
- **67% Token Reduction**: Dramatically lower API costs
- **Fast Performance**: <100ms context retrieval
- **Smart Context**: AI gets exactly the context it needs, when it needs it

## How to Enable Neural Memory

### For Beta Users

If you're in the beta program, neural memory is automatically enabled for you. You don't need to do anything special!

### Verify It's Working

1. Start a new conversation
2. Look for the "Neural Memory Active" indicator in the chat UI
3. After 50+ messages, you'll see summaries being created
4. The AI will seamlessly recall relevant past context

## What to Test

### 1. Long Conversations (Critical)

- **Goal**: Test unlimited conversation capability
- **Steps**:
  1. Create a new chat
  2. Have a conversation with 100+ messages
  3. Continue to 200+ messages (the old limit)
  4. Verify conversation quality remains high
  5. Check that old context is recalled when relevant

**What to look for**:
- Does the AI remember earlier parts of the conversation?
- Are summaries being created automatically?
- Is performance still fast?

### 2. Context Recall (Critical)

- **Goal**: Verify semantic recall works correctly
- **Steps**:
  1. Start a conversation about Topic A
  2. Switch to Topic B for 20+ messages
  3. Switch back to Topic A
  4. Ask the AI to reference specific details from early Topic A discussion

**What to look for**:
- Does the AI correctly recall Topic A details?
- Is the recalled context relevant?
- Are there any "I don't remember" errors?

### 3. Performance (Important)

- **Goal**: Ensure neural memory is fast
- **Steps**:
  1. Send messages in a long conversation (200+ messages)
  2. Observe response time
  3. Check for any lag or delays

**What to look for**:
- Message responses should feel instant (<2s)
- No noticeable slowdown in long conversations
- Smooth scrolling and UI performance

### 4. Summaries (Important)

- **Goal**: Verify automatic summarization
- **Steps**:
  1. Have a conversation that reaches 50+ messages
  2. Look for summary indicators in the UI
  3. View the summary (if UI is implemented)

**What to look for**:
- Summaries are created every 50 messages
- Summaries are accurate and concise
- Summaries capture key points

### 5. Migration (Edge Case)

- **Goal**: Test existing chat migration
- **Steps**:
  1. Open an old chat (created before neural memory)
  2. Send a new message
  3. Verify the conversation works normally

**What to look for**:
- No errors during migration
- Old messages are still accessible
- Conversation continues smoothly

## How to Report Issues

### Bug Report Template

```
**Title**: Brief description of the issue

**Category**:
- [ ] Critical (crashes, data loss, completely broken)
- [ ] Major (feature doesn't work, significant impact)
- [ ] Minor (small issue, workaround available)

**Description**:
Clear description of what happened

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**:
What you expected to happen

**Actual Behavior**:
What actually happened

**Chat ID** (if applicable):
[Your chat ID here]

**Screenshots** (if applicable):
[Attach screenshots]

**Environment**:
- Dyad version: [e.g., 0.36.0]
- OS: [e.g., Windows 11, macOS 14.0]
- Model: [e.g., GPT-4, Claude Opus]
```

### Where to Report

- **GitHub Issues**: https://github.com/dyad-sh/dyad/issues (use label: `neural-memory-beta`)
- **Discord**: #beta-testing channel
- **Email**: beta@dyad.sh

## Feedback Survey

Please complete this brief survey after testing:

### Usability (1-5 scale)

- How easy was it to understand neural memory? ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5
- How well did semantic recall work? ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5
- How useful are the conversation summaries? ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5

### Performance (1-5 scale)

- How would you rate overall performance? ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5
- Did you notice any slowdowns? ☐ Yes ☐ No
- Was context retrieval fast enough? ☐ Yes ☐ No

### Overall Satisfaction (1-5 scale)

- Overall, how satisfied are you with neural memory? ☐ 1 ☐ 2 ☐ 3 ☐ 4 ☐ 5
- Would you recommend it to others? ☐ Yes ☐ No ☐ Maybe

### Open Feedback

- What did you like most?
- What needs improvement?
- Any other comments?

**Submit survey**: https://forms.dyad.sh/neural-memory-beta (or email to beta@dyad.sh)

## Success Criteria

For neural memory to launch, we need:

- ✅ >80% user satisfaction
- ✅ <5 critical bugs
- ✅ Performance targets met (<100ms retrieval)
- ✅ No data loss or corruption

## Timeline

- **Week 1**: Beta testing (10 users)
- **Week 2**: Bug fixes based on feedback
- **Week 3**: Gradual rollout (25% → 50% → 100%)
- **Week 4**: Full general availability

## FAQ

### Q: Will this affect my existing chats?

A: Existing chats will be automatically migrated when you open them. The migration is safe and non-destructive.

### Q: Can I disable neural memory?

A: Yes, you can set `NEURAL_MEMORY_ENABLED=false` in your environment variables. However, we encourage you to try it first!

### Q: What happens to my data?

A: All conversation data is stored locally. Neural memory uses the same local storage as before, plus the `nmem` CLI tool for semantic search.

### Q: Will this work with all AI models?

A: Yes! Neural memory is model-agnostic and works with GPT-4, Claude, Gemini, and all other supported models.

### Q: How much space does it use?

A: Neural memory is very efficient. The `nmem` index adds approximately 10-20% to your conversation data size.

## Thank You!

Your feedback is crucial to making neural memory amazing. Thank you for being an early tester! 🙌

---

**Questions?** Contact the team:
- Discord: @dyad-team
- Email: beta@dyad.sh
- GitHub: https://github.com/dyad-sh/dyad

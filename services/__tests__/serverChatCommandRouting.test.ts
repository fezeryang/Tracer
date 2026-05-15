import { describe, expect, it } from 'vitest';
import { shouldUseServerChatCommand } from '../serverChatCommandRouting';

describe('serverChatCommandRouting', () => {
  it('keeps server command routing disabled when the flag is false or missing', () => {
    expect(shouldUseServerChatCommand('quote', undefined)).toBe(false);
    expect(shouldUseServerChatCommand('quote', 'false')).toBe(false);
  });

  it('enables D-6C server command routing when the primary flag is true', () => {
    expect(shouldUseServerChatCommand('quote', 'true')).toBe(true);
    expect(shouldUseServerChatCommand('sec', 'true')).toBe(true);
    expect(shouldUseServerChatCommand('history', 'true')).toBe(true);
    expect(shouldUseServerChatCommand('chart', 'true')).toBe(true);
    expect(shouldUseServerChatCommand('official', 'true')).toBe(true);
  });

  it('keeps evidence and trust disabled unless the evidence flag is also true', () => {
    expect(shouldUseServerChatCommand('evidence', 'true')).toBe(false);
    expect(shouldUseServerChatCommand('trust', 'true')).toBe(false);
    expect(shouldUseServerChatCommand('evidence', 'true', 'false')).toBe(false);
    expect(shouldUseServerChatCommand('trust', 'true', undefined)).toBe(false);
    expect(shouldUseServerChatCommand('evidence', 'true', 'true')).toBe(true);
    expect(shouldUseServerChatCommand('trust', 'true', true)).toBe(true);
  });

  it('does not enable unsupported commands even when both flags are true', () => {
    expect(shouldUseServerChatCommand('report', 'true')).toBe(false);
    expect(shouldUseServerChatCommand('backtest', 'true', 'true')).toBe(false);
  });
});

const SERVER_COMMAND_ALLOWLIST = new Set(['quote', 'sec', 'history', 'chart', 'official']);
const SERVER_EVIDENCE_COMMAND_ALLOWLIST = new Set(['evidence', 'trust']);

const normalizeCommandName = (commandName?: string): string | undefined => {
  const value = commandName?.trim().replace(/^\//, '').split(/\s+/)[0].toLowerCase();
  return value || undefined;
};

export function shouldUseServerChatCommand(
  commandName: string | undefined,
  flagValue: string | boolean | undefined,
  evidenceFlagValue?: string | boolean | undefined,
): boolean {
  if (flagValue !== true && flagValue !== 'true') return false;

  const normalizedCommand = normalizeCommandName(commandName);
  if (!normalizedCommand) return false;
  if (SERVER_COMMAND_ALLOWLIST.has(normalizedCommand)) return true;

  return (evidenceFlagValue === true || evidenceFlagValue === 'true')
    && SERVER_EVIDENCE_COMMAND_ALLOWLIST.has(normalizedCommand);
}

export function getServerChatCommandAllowlist(): ReadonlySet<string> {
  return SERVER_COMMAND_ALLOWLIST;
}

export function getServerEvidenceCommandAllowlist(): ReadonlySet<string> {
  return SERVER_EVIDENCE_COMMAND_ALLOWLIST;
}

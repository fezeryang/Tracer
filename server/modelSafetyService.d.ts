export interface SafetyDetectionResult {
  unsafe: boolean;
  matches: string[];
  warnings: string[];
}

export interface ScrubbedModelText {
  text: string;
  warnings: string[];
}

export function detectUnsafeFinancialPhrases(text: unknown): SafetyDetectionResult;

export function buildResearchOnlySystemPrompt(language: unknown): string;

export function buildUnavailableModelMessage(language: unknown): string;

export function scrubModelText(text: unknown, language: unknown): ScrubbedModelText;

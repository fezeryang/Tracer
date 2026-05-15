import { ChatModelRoute, ChatModelPurpose } from './types';

export interface RouteChatModelInput {
  purpose: ChatModelPurpose;
  hasGeminiKey?: boolean;
  hasDeepSeekKey?: boolean;
}

export function routeChatModel(input: RouteChatModelInput): ChatModelRoute {
  const { purpose, hasGeminiKey = false, hasDeepSeekKey = false } = input;

  switch (purpose) {
    case 'tool_command':
      return {
        provider: 'local',
        role: 'conversation',
        reason: 'Tool commands execute locally without AI',
        requiresApiKey: false,
      };

    case 'intent_classification':
      if (hasDeepSeekKey) {
        return {
          provider: 'deepseek',
          role: 'intent_classifier',
          reason: 'DeepSeek available for intent classification',
          requiresApiKey: true,
        };
      }
      return {
        provider: 'none',
        role: 'intent_classifier',
        reason: 'No DeepSeek key configured for intent classification',
        requiresApiKey: true,
        fallbackProvider: 'local',
      };

    case 'general_chat':
      if (hasGeminiKey) {
        return {
          provider: 'gemini',
          role: 'conversation',
          reason: 'Gemini available for general conversation',
          requiresApiKey: true,
        };
      }
      return {
        provider: 'none',
        role: 'conversation',
        reason: 'No Gemini key configured for general chat',
        requiresApiKey: true,
        fallbackProvider: 'local',
      };

    case 'complex_financial_question':
      if (hasGeminiKey) {
        return {
          provider: 'gemini',
          role: 'answer_composer',
          reason: 'Gemini available for structured financial analysis',
          requiresApiKey: true,
        };
      }
      return {
        provider: 'none',
        role: 'answer_composer',
        reason: 'No Gemini key configured for complex financial question',
        requiresApiKey: true,
        fallbackProvider: 'local',
      };
  }
}

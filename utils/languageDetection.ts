import { Language } from '../i18n';

/**
 * Detects the language of user input based on character analysis.
 *
 * Logic:
 * - Count Chinese characters (CJK Unified Ideographs)
 * - Calculate ratio of Chinese characters to total characters
 * - If > 30% Chinese, classify as Chinese
 * - Otherwise, classify as English
 *
 * @param text - The input text to analyze
 * @returns Detected language ('zh' or 'en')
 */
export function detectLanguage(text: string): Language {
  // Trim and get clean text
  const cleanText = text.trim();

  if (!cleanText) {
    return 'en'; // Default to English for empty input
  }

  // Count Chinese characters (CJK Unified Ideographs range)
  const chineseChars = cleanText.match(/[\u4e00-\u9fa5]/g);
  const chineseCharCount = chineseChars ? chineseChars.length : 0;

  // Count total non-whitespace characters
  const totalChars = cleanText.replace(/\s/g, '').length;

  if (totalChars === 0) {
    return 'en';
  }

  // Calculate Chinese character ratio
  const chineseRatio = chineseCharCount / totalChars;

  // Threshold: 30% Chinese characters = Chinese input
  const CHINESE_THRESHOLD = 0.3;

  return chineseRatio > CHINESE_THRESHOLD ? 'zh' : 'en';
}

/**
 * Enhanced detection with mixed language support.
 * Detects if input is primarily Chinese, English, or mixed.
 */
export function detectLanguageDetailed(text: string): {
  language: Language;
  chineseRatio: number;
  isMixed: boolean;
} {
  const cleanText = text.trim();

  if (!cleanText) {
    return { language: 'en', chineseRatio: 0, isMixed: false };
  }

  const chineseChars = cleanText.match(/[\u4e00-\u9fa5]/g);
  const chineseCharCount = chineseChars ? chineseChars.length : 0;

  // Count ASCII letters (English)
  const englishChars = cleanText.match(/[a-zA-Z]/g);
  const englishCharCount = englishChars ? englishChars.length : 0;

  const totalChars = cleanText.replace(/\s/g, '').length;

  if (totalChars === 0) {
    return { language: 'en', chineseRatio: 0, isMixed: false };
  }

  const chineseRatio = chineseCharCount / totalChars;
  const englishRatio = englishCharCount / totalChars;

  // Consider mixed if both languages have > 15% representation
  const isMixed = chineseRatio > 0.15 && englishRatio > 0.15;

  let language: Language;
  if (chineseRatio > 0.3) {
    language = 'zh';
  } else {
    language = 'en';
  }

  return { language, chineseRatio, isMixed };
}

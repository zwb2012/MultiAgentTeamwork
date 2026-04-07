/**
 * 消息内容折叠配置
 * 简化版本：直接使用全局配置中的数值，不使用预设模式
 */

export interface MessageContentConfig {
  // 自动折叠阈值
  autoMinimize: {
    charCount: number;      // 字符数阈值
    lineCount: number;       // 行数阈值
  };
  autoSectionFold: {
    charCount: number;      // 字符数阈值
    lineCount: number;       // 行数阈值
  };
  autoTruncate: {
    charCount: number;      // 字符数阈值
    lineCount: number;       // 行数阈值
  };

  // 折叠显示长度
  collapsedPreviewLength: number;  // 最小化时显示的预览长度
  defaultMaxLength: number;        // 普通消息截断长度
  codeBlockMaxLength: number;      // 包含代码块时的截断长度
  aggressiveTruncateLength: number; // 激进模式截断长度

  // 章节折叠默认展开数量
  defaultExpandedSections: number;      // 默认展开的章节数
}

// 默认配置值（用于兜底）
export const DEFAULT_CONFIG: MessageContentConfig = {
  autoMinimize: { charCount: 500, lineCount: 15 },
  autoSectionFold: { charCount: 200, lineCount: 8 },
  autoTruncate: { charCount: 80, lineCount: 3 },
  collapsedPreviewLength: 60,
  defaultMaxLength: 80,
  codeBlockMaxLength: 300,
  aggressiveTruncateLength: 150,
  defaultExpandedSections: 3,
};

/**
 * 从全局配置中提取消息配置
 */
export function getConfigFromGlobal(uiConfig?: {
  message: MessageContentConfig;
}): MessageContentConfig {
  if (!uiConfig?.message) {
    return DEFAULT_CONFIG;
  }

  return uiConfig.message;
}

/**
 * 计算行数
 * @param text 文本内容
 * @returns 行数
 */
export function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * 判断是否应该自动最小化
 */
export function shouldAutoMinimize(
  text: string,
  isStreaming: boolean,
  config: MessageContentConfig
): boolean {
  if (isStreaming) return false;
  return text.length > config.autoMinimize.charCount ||
         countLines(text) > config.autoMinimize.lineCount;
}

/**
 * 判断是否应该自动章节折叠
 */
export function shouldAutoSectionFold(
  text: string,
  isStreaming: boolean,
  hasSections: boolean,
  config: MessageContentConfig
): boolean {
  if (isStreaming) return false;
  if (!hasSections) return false;
  return text.length > config.autoSectionFold.charCount ||
         countLines(text) > config.autoSectionFold.lineCount;
}

/**
 * 判断是否应该自动截断
 */
export function shouldAutoTruncate(
  text: string,
  isStreaming: boolean,
  config: MessageContentConfig
): boolean {
  if (isStreaming) return false;
  return text.length > config.autoTruncate.charCount ||
         countLines(text) > config.autoTruncate.lineCount;
}

/**
 * 消息内容折叠配置
 * 可根据实际需求调整这些阈值
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
  defaultExpandedSections: number;      // 正常模式下默认展开的章节数
  autoFoldExpandedSections: number;     // 自动折叠模式下默认展开的章节数
}

/**
 * 默认配置
 * 针对中英文混合场景优化
 */
export const defaultConfig: MessageContentConfig = {
  // 自动最小化：超过 500字符 或 15 行
  autoMinimize: {
    charCount: 500,
    lineCount: 15,
  },

  // 自动章节折叠：超过 200字符 或 8 行，且包含标题
  autoSectionFold: {
    charCount: 200,
    lineCount: 8,
  },

  // 自动截断折叠：超过 80字符 或 3 行
  autoTruncate: {
    charCount: 80,
    lineCount: 3,
  },

  // 折叠显示长度
  collapsedPreviewLength: 60,    // 最小化时显示 60 字符
  defaultMaxLength: 80,          // 普通消息截断 80 字符
  codeBlockMaxLength: 300,       // 包含代码块时截断 300 字符
  aggressiveTruncateLength: 150, // 激进模式截断 150 字符

  // 章节折叠默认展开数量
  defaultExpandedSections: 3,   // 正常模式展开 3 个章节
  autoFoldExpandedSections: 1,  // 自动折叠模式展开 1 个章节
};

/**
 * 紧凑模式配置
 * 适用于需要更紧凑显示的场景
 */
export const compactConfig: MessageContentConfig = {
  ...defaultConfig,
  autoMinimize: {
    charCount: 300,  // 降低到 300 字符
    lineCount: 10,   // 降低到 10 行
  },
  autoSectionFold: {
    charCount: 150,  // 降低到 150 字符
    lineCount: 5,    // 降低到 5 行
  },
  autoTruncate: {
    charCount: 60,   // 降低到 60 字符
    lineCount: 2,    // 降低到 2 行
  },
  defaultExpandedSections: 2,
  autoFoldExpandedSections: 1,
};

/**
 * 宽松模式配置
 * 适用于需要显示更多内容的场景
 */
export const looseConfig: MessageContentConfig = {
  ...defaultConfig,
  autoMinimize: {
    charCount: 800,  // 提高到 800 字符
    lineCount: 25,   // 提高到 25 行
  },
  autoSectionFold: {
    charCount: 400,  // 提高到 400 字符
    lineCount: 15,   // 提高到 15 行
  },
  autoTruncate: {
    charCount: 150,  // 提高到 150 字符
    lineCount: 5,    // 提高到 5 行
  },
  defaultExpandedSections: 4,
  autoFoldExpandedSections: 2,
};

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

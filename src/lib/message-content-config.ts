/**
 * 消息内容折叠配置
 * 从 global-config.ts 读取实际配置，此文件提供预设配置和工具函数
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

// 预设配置
export const presetConfigs = {
  // 默认配置：平衡模式
  default: {
    autoMinimize: { charCount: 500, lineCount: 15 },
    autoSectionFold: { charCount: 200, lineCount: 8 },
    autoTruncate: { charCount: 80, lineCount: 3 },
    collapsedPreviewLength: 60,
    defaultMaxLength: 80,
    codeBlockMaxLength: 300,
    aggressiveTruncateLength: 150,
    defaultExpandedSections: 3,
    autoFoldExpandedSections: 1,
  },
  // 紧凑配置：更早触发折叠
  compact: {
    autoMinimize: { charCount: 300, lineCount: 10 },
    autoSectionFold: { charCount: 150, lineCount: 5 },
    autoTruncate: { charCount: 60, lineCount: 2 },
    collapsedPreviewLength: 50,
    defaultMaxLength: 60,
    codeBlockMaxLength: 200,
    aggressiveTruncateLength: 100,
    defaultExpandedSections: 2,
    autoFoldExpandedSections: 1,
  },
  // 宽松配置：更晚触发折叠
  loose: {
    autoMinimize: { charCount: 800, lineCount: 25 },
    autoSectionFold: { charCount: 400, lineCount: 15 },
    autoTruncate: { charCount: 150, lineCount: 5 },
    collapsedPreviewLength: 80,
    defaultMaxLength: 150,
    codeBlockMaxLength: 500,
    aggressiveTruncateLength: 200,
    defaultExpandedSections: 4,
    autoFoldExpandedSections: 2,
  },
} as const;

/**
 * 根据 global-config 的 UI 配置获取实际使用的配置
 */
export function getConfigFromGlobal(uiConfig?: {
  message: {
    collapseMode: 'default' | 'compact' | 'loose' | 'custom';
    customThresholds?: any;
  };
}): MessageContentConfig {
  if (!uiConfig) return presetConfigs.default;

  const { collapseMode, customThresholds } = uiConfig.message;

  // 自定义模式
  if (collapseMode === 'custom' && customThresholds) {
    return {
      autoMinimize: customThresholds.autoMinimize,
      autoSectionFold: customThresholds.autoSectionFold,
      autoTruncate: customThresholds.autoTruncate,
      collapsedPreviewLength: customThresholds.collapsedPreviewLength ?? 60,
      defaultMaxLength: customThresholds.defaultMaxLength ?? 80,
      codeBlockMaxLength: customThresholds.codeBlockMaxLength ?? 300,
      aggressiveTruncateLength: customThresholds.aggressiveTruncateLength ?? 150,
      defaultExpandedSections: customThresholds.defaultExpandedSections ?? 3,
      autoFoldExpandedSections: customThresholds.autoFoldExpandedSections ?? 1,
    };
  }

  // 预设模式（custom 模式不使用 presetConfigs）
  if (collapseMode !== 'custom') {
    return presetConfigs[collapseMode as keyof typeof presetConfigs] || presetConfigs.default;
  }

  // 如果是 custom 模式但没有自定义阈值，返回默认配置
  return presetConfigs.default;
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

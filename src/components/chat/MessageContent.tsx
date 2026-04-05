'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Code, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MessageContentProps {
  content: string;
  maxLength?: number;
  isStreaming?: boolean;
}

interface Section {
  title: string;
  level: number;
  content: string;
  id: string;
}

const DEFAULT_MAX_LENGTH = 100; // 默认截断长度
const CODEBLOCK_MAX_LENGTH = 500; // 包含代码块时的截断长度
const AGGRESSIVE_TRUNCATE_LENGTH = 200; // 激进模式截断长度
const COLLAPSED_PREVIEW_LENGTH = 60; // 整体折叠时显示的预览长度
const AUTO_MINIMIZE_THRESHOLD = 800; // 自动最小化阈值
const AUTO_SECTION_FOLD_THRESHOLD = 300; // 自动章节折叠阈值
const AUTO_TRUNCATE_THRESHOLD = 100; // 自动截断折叠阈值

export function MessageContent({ content, maxLength = DEFAULT_MAX_LENGTH, isStreaming = false }: MessageContentProps) {
  // 检查内容是否包含代码块
  const hasCodeBlock = /```[\s\S]*?```/.test(content);

  // 解析内容为章节（必须在状态计算之前）
  const sections = useMemo(() => {
    return parseSections(content);
  }, [content]);

  // 检查是否应该使用章节折叠
  const shouldUseSectionFolding = sections.length > 1 && !isStreaming;

  // 自动判断初始折叠状态
  const shouldAutoMinimize = !isStreaming && content.length > AUTO_MINIMIZE_THRESHOLD;
  const shouldAutoSectionFold = !isStreaming && !shouldAutoMinimize && shouldUseSectionFolding && content.length > AUTO_SECTION_FOLD_THRESHOLD;
  const shouldAutoTruncate = !isStreaming && !shouldAutoMinimize && !shouldAutoSectionFold && content.length > AUTO_TRUNCATE_THRESHOLD;

  const [isExpanded, setIsExpanded] = useState(shouldAutoTruncate);
  const [copied, setCopied] = useState(false);

  // 根据内容长度自动设置折叠状态
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoMinimize);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // 如果应该自动章节折叠，默认只展开前1-2个章节
    if (shouldAutoSectionFold) {
      if (sections.length <= 2) return new Set(sections.map(s => s.id));
      return new Set(sections.slice(0, 2).map(s => s.id));
    }
    // 否则正常展开前3个章节
    if (sections.length <= 3) return new Set(sections.map(s => s.id));
    return new Set(sections.slice(0, 3).map(s => s.id));
  });

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSections = (expand: boolean) => {
    if (expand) {
      setExpandedSections(new Set(sections.map(s => s.id)));
    } else {
      setExpandedSections(new Set());
    }
  };

  // 处理复制功能
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 如果使用章节折叠
  if (shouldUseSectionFolding) {
    // 整体折叠模式（显示摘要）
    if (isCollapsed) {
      const preview = content.slice(0, COLLAPSED_PREVIEW_LENGTH) + '...';
      return (
        <div className="message-content">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsCollapsed(false)}
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              展开
            </Button>
            <span className="text-xs text-muted-foreground line-clamp-1">{preview}</span>
          </div>
        </div>
      );
    }

    // 章节折叠模式
    return (
      <div className="message-content space-y-2">
        {/* 整体操作按钮 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleAllSections(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              全部展开
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleAllSections(false)}
            >
              <Minus className="h-3 w-3 mr-1" />
              全部收起
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              最小化
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* 渲染各章节 */}
        {sections.map(section => (
          <SectionItem
            key={section.id}
            section={section}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    );
  }

  // 原有的整体折叠逻辑（用于无标题或流式输出的内容）
  const getCodeBlockCount = (text: string) => (text.match(/```[\s\S]*?```/g) || []).length;
  const getNonCodeLength = (text: string) => text.replace(/```[\s\S]*?```/g, '').length;

  const codeBlockCount = getCodeBlockCount(content);
  const nonCodeLength = getNonCodeLength(content);

  const useAggressiveTruncate = codeBlockCount >= 3 || nonCodeLength > AGGRESSIVE_TRUNCATE_LENGTH;
  const effectiveMaxLength = hasCodeBlock
    ? (useAggressiveTruncate ? 300 : CODEBLOCK_MAX_LENGTH)
    : maxLength;

  const shouldTruncate = !isExpanded && !isStreaming && content.length > effectiveMaxLength;
  const displayContent = shouldTruncate ? content.slice(0, effectiveMaxLength) + '\n\n... (点击展开查看更多)' : content;
  const needsExpandButton = content.length > effectiveMaxLength && !isStreaming;

  // 整体折叠模式（显示摘要）
  if (isCollapsed && !isStreaming) {
    const preview = content.slice(0, COLLAPSED_PREVIEW_LENGTH) + '...';
    return (
      <div className="message-content">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            展开
          </Button>
          <span className="text-xs text-muted-foreground line-clamp-1">{preview}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="message-content">
      <div className="text-sm whitespace-pre-wrap break-words">
        {renderMarkdown(displayContent)}
      </div>

      {/* 展开/收起按钮 */}
      {needsExpandButton && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                展开全部
              </>
            )}
          </Button>
        </div>
      )}

      {/* 最小化按钮 */}
      {!isStreaming && content.length > COLLAPSED_PREVIEW_LENGTH && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 px-2 opacity-0 hover:opacity-100 transition-opacity"
          onClick={() => setIsCollapsed(true)}
        >
          <Minus className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

// 解析内容为章节
function parseSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentSection: Partial<Section> = {};
  let sectionCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测标题（## 或 ###）
    if (line.match(/^#{2,3}\s+/)) {
      // 保存上一节
      if (currentSection.title && currentSection.content !== undefined) {
        sections.push({
          id: `section-${sectionCount++}`,
          title: currentSection.title,
          level: currentSection.level || 2,
          content: currentSection.content.trim(),
        });
      }

      // 开始新一节
      const level = line.match(/^#+/)?.[0].length || 2;
      currentSection = {
        title: line.replace(/^#+\s+/, ''),
        level,
        content: '',
      };
    } else {
      // 添加到当前节内容
      if (currentSection.title !== undefined) {
        currentSection.content = (currentSection.content || '') + line + '\n';
      } else {
        // 前言内容
        if (!sections[0]?.title) {
          sections.push({
            id: `section-${sectionCount++}`,
            title: '',
            level: 0,
            content: (sections[0]?.content || '') + line + '\n',
          });
        } else {
          sections[0].content += line + '\n';
        }
      }
    }
  }

  // 保存最后一节
  if (currentSection.title && currentSection.content !== undefined) {
    sections.push({
      id: `section-${sectionCount++}`,
      title: currentSection.title,
      level: currentSection.level || 2,
      content: currentSection.content.trim(),
    });
  }

  // 如果没有标题，返回整个内容作为一节
  if (sections.length === 0) {
    sections.push({
      id: 'section-0',
      title: '',
      level: 0,
      content: content,
    });
  }

  return sections;
}

// 章节项组件
function SectionItem({ section, isExpanded, onToggle }: { section: Section; isExpanded: boolean; onToggle: () => void }) {
  if (!section.title) {
    // 前言，不折叠
    return (
      <div className="text-sm whitespace-pre-wrap break-words">
        {renderMarkdown(section.content)}
      </div>
    );
  }

  // 有标题的章节，支持折叠
  const level = section.level;
  const titleSize = level === 2 ? 'text-sm font-semibold' : 'text-xs font-medium';
  const paddingLeft = level === 2 ? 'pl-0' : 'pl-4';

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-start ${titleSize} ${paddingLeft} h-auto py-2 px-3 text-left hover:bg-muted/50`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 mr-2 flex-shrink-0" />
          ) : (
            <ChevronUp className="h-3 w-3 mr-2 flex-shrink-0" />
          )}
          {section.title}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className={`text-sm whitespace-pre-wrap break-words ${paddingLeft} pr-3`}>
          {renderMarkdown(section.content)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// 渲染 Markdown 内容
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const renderedElements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const index = i;

    // 代码块
    if (line.startsWith('```')) {
      const codeBlock = extractCodeBlock(text, index);
      if (codeBlock) {
        renderedElements.push(
          <div key={`code-${index}`}>{renderCodeBlock(codeBlock.content, codeBlock.language)}</div>
        );
        i += codeBlock.content.split('\n').length + 2;
        continue;
      }
    }

    // 内联代码
    if (line.includes('`') && !line.startsWith('```')) {
      renderedElements.push(<div key={`inline-${index}`}>{renderInlineCode(line)}</div>);
      i++;
      continue;
    }

    // 空行
    if (line.trim() === '') {
      renderedElements.push(<br key={`br-${index}`} />);
      i++;
      continue;
    }

    // 列表
    if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
      renderedElements.push(
        <li key={`list-${index}`} className="ml-4">{line.replace(/^\s*[-*+]\s+|\s*\d+\.\s+/, '')}</li>
      );
      i++;
      continue;
    }

    // 普通段落
    renderedElements.push(<p key={`para-${index}`} className="my-1">{line}</p>);
    i++;
  }

  return renderedElements;
}

// 提取代码块
function extractCodeBlock(text: string, startIndex: number) {
  const lines = text.split('\n');
  const firstLine = lines[startIndex];
  const language = firstLine.replace(/```[\w-]*/, '').trim();
  let content = '';
  let i = startIndex + 1;

  while (i < lines.length && !lines[i].startsWith('```')) {
    content += lines[i] + '\n';
    i++;
  }

  return { language, content: content.trim() };
}

// 渲染代码块
function renderCodeBlock(content: string, language: string) {
  return (
    <div className="my-2 rounded-lg bg-muted/50 border">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{language || 'code'}</span>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-xs">
        <code>{content}</code>
      </pre>
    </div>
  );
}

// 渲染内联代码
function renderInlineCode(line: string) {
  const parts = line.split(/(`[^`]+`)/g);
  return (
    <p className="my-1">
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={index} className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

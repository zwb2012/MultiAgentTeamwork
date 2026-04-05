'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageContentProps {
  content: string;
  maxLength?: number;
  isStreaming?: boolean;
}

const DEFAULT_MAX_LENGTH = 100; // 默认截断长度
const CODEBLOCK_MAX_LENGTH = 500; // 包含代码块时的截断长度
const AGGRESSIVE_TRUNCATE_LENGTH = 200; // 激进模式截断长度

export function MessageContent({ content, maxLength = DEFAULT_MAX_LENGTH, isStreaming = false }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 检查内容是否包含代码块
  const hasCodeBlock = /```[\s\S]*?```/.test(content);

  // 计算非代码块部分的长度
  const getCodeBlockCount = (text: string) => (text.match(/```[\s\S]*?```/g) || []).length;
  const getNonCodeLength = (text: string) => {
    // 移除所有代码块，计算剩余文本长度
    return text.replace(/```[\s\S]*?```/g, '').length;
  };

  // 根据是否有代码块，使用不同的折叠策略
  const codeBlockCount = getCodeBlockCount(content);
  const nonCodeLength = getNonCodeLength(content);

  // 如果有多个代码块或者非代码部分很长，使用更激进的折叠
  const useAggressiveTruncate = codeBlockCount >= 3 || nonCodeLength > AGGRESSIVE_TRUNCATE_LENGTH;
  const effectiveMaxLength = hasCodeBlock
    ? (useAggressiveTruncate ? 300 : CODEBLOCK_MAX_LENGTH)
    : maxLength;

  // 检查是否需要截断
  const shouldTruncate = !isExpanded && !isStreaming && content.length > effectiveMaxLength;
  const displayContent = shouldTruncate ? content.slice(0, effectiveMaxLength) + '\n\n... (点击展开查看更多)' : content;

  // 检查是否需要显示展开按钮
  const needsExpandButton = content.length > effectiveMaxLength && !isStreaming;
  
  // 处理复制功能
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // 渲染 Markdown 内容
  const renderMarkdown = (text: string) => {
    // 简单的 Markdown 渲染，实际项目可以使用 react-markdown
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
          // 跳过代码块的所有行
          i += codeBlock.content.split('\n').length + 2; // +2 for opening and closing ```
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

      // 标题
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        const text = line.replace(/^#+\s*/, '');
        renderedElements.push(
          <Tag key={`heading-${index}`} className={`font-semibold mt-2 mb-1 text-${level}`}>{text}</Tag>
        );
        i++;
        continue;
      }

      // 普通段落
      renderedElements.push(<p key={`para-${index}`} className="my-1">{line}</p>);
      i++;
    }

    return renderedElements;
  };
  
  // 提取代码块
  const extractCodeBlock = (text: string, startIndex: number) => {
    const lines = text.split('\n');
    const firstLine = lines[startIndex];
    const language = firstLine.replace(/```\w*/, '').trim();
    let content = '';
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('```')) {
      content += lines[i] + '\n';
      i++;
    }
    
    return { language, content: content.trim() };
  };
  
  // 渲染代码块
  const renderCodeBlock = (content: string, language: string) => {
    return (
      <div className="my-2 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {language || 'code'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => {
              navigator.clipboard.writeText(content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
        <pre className="p-3 overflow-x-auto text-xs">
          <code>{content}</code>
        </pre>
      </div>
    );
  };
  
  // 渲染内联代码
  const renderInlineCode = (line: string) => {
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
  };
  
  return (
    <div className="message-content">
      <div className="text-sm whitespace-pre-wrap break-words">
        {hasCodeBlock ? renderMarkdown(displayContent) : displayContent}
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
      
      {/* 复制按钮（仅对无代码块的内容显示） */}
      {!hasCodeBlock && !isStreaming && content.length > 100 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 px-2 opacity-0 hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}

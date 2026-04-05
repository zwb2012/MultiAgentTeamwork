'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageContentProps {
  content: string;
  maxLength?: number;
  isStreaming?: boolean;
}

const DEFAULT_MAX_LENGTH = 300; // 默认截断长度

export function MessageContent({ content, maxLength = DEFAULT_MAX_LENGTH, isStreaming = false }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 检查内容是否包含代码块
  const hasCodeBlock = /```[\s\S]*?```/.test(content);
  
  // 检查是否需要截断
  const shouldTruncate = !isExpanded && !isStreaming && content.length > maxLength && !hasCodeBlock;
  const displayContent = shouldTruncate ? content.slice(0, maxLength) + '...' : content;
  
  // 检查是否需要显示展开按钮
  const needsExpandButton = content.length > maxLength && !hasCodeBlock;
  
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
    return text.split('\n').map((line, index) => {
      // 代码块
      if (line.startsWith('```')) {
        const codeBlock = extractCodeBlock(text, index);
        if (codeBlock) {
          return renderCodeBlock(codeBlock.content, codeBlock.language);
        }
      }
      
      // 内联代码
      if (line.includes('`')) {
        return renderInlineCode(line);
      }
      
      // 空行
      if (line.trim() === '') {
        return <br key={index} />;
      }
      
      // 列表
      if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
        return <li key={index} className="ml-4">{line.replace(/^\s*[-*+]\s+|\s*\d+\.\s+/, '')}</li>;
      }
      
      // 标题
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        const text = line.replace(/^#+\s*/, '');
        return <Tag key={index} className={`font-semibold mt-2 mb-1 text-${level}`}>{text}</Tag>;
      }
      
      // 普通段落
      return <p key={index} className="my-1">{line}</p>;
    });
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

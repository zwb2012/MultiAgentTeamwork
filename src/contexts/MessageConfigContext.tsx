'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { getConfigFromGlobal, MessageContentConfig } from '@/lib/message-content-config';

const MessageConfigContext = createContext<MessageContentConfig | null>(null);

/**
 * 消息配置提供者
 * 从全局配置中读取 UI 配置，并转换为 MessageContentConfig
 */
export function MessageConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<MessageContentConfig | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const result = await response.json();
        if (result.success && result.data.ui?.message) {
          setConfig(getConfigFromGlobal(result.data.ui));
        } else {
          setConfig(getConfigFromGlobal({ message: { collapseMode: 'default' } }));
        }
      } catch (error) {
        console.error('获取UI配置失败:', error);
        setConfig(getConfigFromGlobal({ message: { collapseMode: 'default' } }));
      }
    };
    fetchConfig();
  }, []);

  return (
    <MessageConfigContext.Provider value={config}>
      {children}
    </MessageConfigContext.Provider>
  );
}

/**
 * 使用消息配置 Hook
 * 返回当前的消息折叠配置
 */
export function useMessageConfig(): MessageContentConfig {
  const config = useContext(MessageConfigContext);
  if (!config) {
    // 返回默认配置（首屏渲染时可能还未加载配置）
    return getConfigFromGlobal({ message: { collapseMode: 'default' } });
  }
  return config;
}

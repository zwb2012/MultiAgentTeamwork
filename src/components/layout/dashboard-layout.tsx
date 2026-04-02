'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  FileCode,
  GitBranch,
  MessageSquare,
  GitPullRequest,
  Ticket,
  Settings,
  Menu,
  X,
  Bot,
  Copy,
  ChevronDown,
  ChevronRight,
  FolderCog,
  FolderOpen,
  Server,
  FileText,
  Shield
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: '监控面板',
    href: '/',
    icon: <LayoutDashboard className="h-5 w-5" />
  },
  {
    title: '智能体管理',
    href: '#',
    icon: <Users className="h-5 w-5" />,
    children: [
      {
        title: '角色管理',
        href: '/agent-roles',
        icon: <Shield className="h-4 w-4" />
      },
      {
        title: '智能体模板',
        href: '/agent-templates',
        icon: <Copy className="h-4 w-4" />
      },
      {
        title: '项目智能体',
        href: '/project-agents',
        icon: <Bot className="h-4 w-4" />
      }
    ]
  },
  {
    title: '项目管理',
    href: '#',
    icon: <FileCode className="h-5 w-5" />,
    children: [
      {
        title: '项目设置',
        href: '/projects',
        icon: <FolderCog className="h-4 w-4" />
      },
      {
        title: '项目资源',
        href: '/project-resources',
        icon: <FolderOpen className="h-4 w-4" />
      }
    ]
  },
  {
    title: '会话中心',
    href: '/conversations',
    icon: <MessageSquare className="h-5 w-5" />
  },
  {
    title: '流水线',
    href: '/pipelines',
    icon: <GitPullRequest className="h-5 w-5" />
  },
  {
    title: '工单管理',
    href: '/tickets',
    icon: <Ticket className="h-5 w-5" />
  },
  {
    title: '系统设置',
    href: '#',
    icon: <Settings className="h-5 w-5" />,
    children: [
      {
        title: '基础配置',
        href: '/settings',
        icon: <Settings className="h-4 w-4" />
      },
      {
        title: '大模型配置',
        href: '/model-configs',
        icon: <Server className="h-4 w-4" />
      },
      {
        title: '健康日志',
        href: '/health-logs',
        icon: <FileText className="h-4 w-4" />
      }
    ]
  }
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>(['智能体管理', '项目管理', '系统设置']);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const toggleExpand = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // 定时健康检查
  useEffect(() => {
    // 获取配置并设置定时健康检查
    const setupHealthCheck = async () => {
      try {
        const response = await fetch('/api/config');
        const result = await response.json();
        
        if (result.success && result.data?.settings?.health_check_interval > 0) {
          const intervalMinutes = result.data.settings.health_check_interval;
          const intervalMs = intervalMinutes * 60 * 1000;
          
          // 立即执行一次健康检查（如果启用了自动检查）
          if (result.data.settings.auto_health_check) {
            performHealthCheck();
          }
          
          // 设置定时检查
          healthCheckIntervalRef.current = setInterval(() => {
            performHealthCheck();
          }, intervalMs);
          
          console.log(`定时健康检查已启动，间隔: ${intervalMinutes} 分钟`);
        }
      } catch (error) {
        console.error('设置定时健康检查失败:', error);
      }
    };
    
    setupHealthCheck();
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, []);
  
  // 执行批量健康检查
  const performHealthCheck = async () => {
    try {
      const response = await fetch('/api/agents/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_type: 'scheduled' })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`定时健康检查完成: ${result.data.online}/${result.data.checked} 在线`);
      }
    } catch (error) {
      console.error('定时健康检查失败:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 左侧边栏 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">AI Agent 平台</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => (
            <div key={item.title}>
              {/* 有子菜单的项 */}
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      !sidebarOpen && "justify-center"
                    )}
                  >
                    {item.icon}
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{item.title}</span>
                        {expandedItems.includes(item.title) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </button>
                  
                  {/* 子菜单 */}
                  {sidebarOpen && expandedItems.includes(item.title) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive(child.href)
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          {child.icon}
                          <span>{child.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* 没有子菜单的项 */
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                    !sidebarOpen && "justify-center"
                  )}
                  title={!sidebarOpen ? item.title : undefined}
                >
                  {item.icon}
                  {sidebarOpen && <span>{item.title}</span>}
                  {sidebarOpen && item.badge && (
                    <span className="ml-auto bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main
        className={cn(
          "transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        {children}
      </main>
    </div>
  );
}

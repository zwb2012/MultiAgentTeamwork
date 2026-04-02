import { NextRequest, NextResponse } from 'next/server';
import { getGlobalConfig, saveGlobalConfig } from '@/lib/global-config';
import { encrypt, decrypt } from '@/lib/encryption';

// GET /api/config - 获取全局配置
export async function GET() {
  try {
    const config = getGlobalConfig();
    
    // 隐藏敏感信息
    const safeConfig = {
      ...config,
      llm: {
        ...config.llm,
        default_api_key: config.llm.default_api_key 
          ? `${config.llm.default_api_key.substring(0, 8)}...${config.llm.default_api_key.substring(config.llm.default_api_key.length - 4)}`
          : ''
      },
      git: {
        ...config.git,
        token: config.git.token ? '••••••••••••' : undefined
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      data: safeConfig 
    });
  } catch (error) {
    console.error('获取全局配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取全局配置失败' },
      { status: 500 }
    );
  }
}

// PUT /api/config - 更新全局配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { llm, git, settings } = body;
    
    const updateData: Record<string, unknown> = {};
    
    if (llm) {
      updateData.llm = llm;
    }
    
    if (git) {
      // 如果传入了新的 token，加密存储
      if (git.token && git.token !== '••••••••••••' && !git.token.startsWith('•')) {
        updateData.git = {
          ...git,
          token: await encrypt(git.token)
        };
      } else {
        // 不更新 token
        const currentConfig = getGlobalConfig();
        updateData.git = {
          ...git,
          token: currentConfig.git.token
        };
      }
    }
    
    if (settings) {
      updateData.settings = settings;
    }
    
    const newConfig = saveGlobalConfig(updateData);
    
    // 返回时隐藏敏感信息
    const safeConfig = {
      ...newConfig,
      llm: {
        ...newConfig.llm,
        default_api_key: newConfig.llm.default_api_key 
          ? `${newConfig.llm.default_api_key.substring(0, 8)}...${newConfig.llm.default_api_key.substring(newConfig.llm.default_api_key.length - 4)}`
          : ''
      },
      git: {
        ...newConfig.git,
        token: newConfig.git.token ? '••••••••••••' : undefined
      }
    };
    
    return NextResponse.json({ 
      success: true, 
      data: safeConfig,
      message: '配置已保存'
    });
  } catch (error) {
    console.error('保存全局配置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存全局配置失败' },
      { status: 500 }
    );
  }
}

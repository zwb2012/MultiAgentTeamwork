import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/skills/categories - 获取技能分类列表
 */
export async function GET(request: NextRequest) {
  try {
    const categories = ['code', 'text', 'analysis', 'design', 'integration'];

    const categoryDetails = {
      code: {
        name: '代码开发',
        description: '代码生成、文件操作、命令执行等开发相关技能',
        icon: '💻',
        color: 'blue'
      },
      text: {
        name: '文本处理',
        description: '文案编写、文本生成、翻译等文本相关技能',
        icon: '✍️',
        color: 'green'
      },
      analysis: {
        name: '分析能力',
        description: '需求分析、数据统计、问题诊断等分析技能',
        icon: '🔍',
        color: 'purple'
      },
      design: {
        name: '设计规划',
        description: 'PRD设计、UI设计、架构设计等设计技能',
        icon: '🎨',
        color: 'pink'
      },
      integration: {
        name: '集成能力',
        description: 'API调用、第三方集成、数据同步等集成技能',
        icon: '🔗',
        color: 'orange'
      }
    };

    return NextResponse.json({
      success: true,
      data: categories.map(cat => ({
        id: cat,
        ...categoryDetails[cat as keyof typeof categoryDetails]
      }))
    });
  } catch (error) {
    console.error('Failed to get skill categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取技能分类失败'
      },
      { status: 500 }
    );
  }
}

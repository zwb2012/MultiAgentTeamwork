import { NextRequest, NextResponse } from 'next/server';
import { skillRegistry } from '@/lib/skills/registry';

/**
 * GET /api/skills/[id] - 获取单个技能详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: skillId } = params;
    const skill = skillRegistry[skillId];

    if (!skill) {
      return NextResponse.json(
        {
          success: false,
          error: '技能不存在'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: skill
    });
  } catch (error) {
    console.error('Failed to get skill:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取技能详情失败'
      },
      { status: 500 }
    );
  }
}

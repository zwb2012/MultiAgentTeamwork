import { NextRequest, NextResponse } from 'next/server';
import { skillRegistry, getAllSkills, getSkillsByCategory } from '@/lib/skills/registry';

/**
 * GET /api/skills - 获取所有技能
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let skills;
    if (category) {
      skills = getSkillsByCategory(category);
    } else {
      skills = getAllSkills();
    }

    return NextResponse.json({
      success: true,
      data: skills,
      total: skills.length
    });
  } catch (error) {
    console.error('Failed to get skills:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取技能列表失败'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/skills/[skillId] - 获取单个技能详情
 */
export async function getSkillById(request: NextRequest, { params }: { params: { skillId: string } }) {
  try {
    const { skillId } = params;
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

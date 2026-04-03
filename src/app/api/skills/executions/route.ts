import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * GET /api/skills/executions - 获取技能执行日志
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const skillId = searchParams.get('skill_id');
    const projectId = searchParams.get('project_id');
    const success = searchParams.get('success');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = getSupabaseClient();
    let query = client
      .from('skill_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 添加过滤条件
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    if (skillId) {
      query = query.eq('skill_id', skillId);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (success !== null) {
      query = query.eq('success', success === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get skill executions:', error);
      return NextResponse.json(
        {
          success: false,
          error: '获取执行日志失败'
        },
        { status: 500 }
      );
    }

    // 获取总数
    let countQuery = client.from('skill_executions').select('*', { count: 'exact', head: true });
    if (agentId) countQuery = countQuery.eq('agent_id', agentId);
    if (skillId) countQuery = countQuery.eq('skill_id', skillId);
    if (projectId) countQuery = countQuery.eq('project_id', projectId);
    if (success !== null) countQuery = countQuery.eq('success', success === 'true');

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Failed to get skill executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取执行日志失败'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/skills/stats - 获取技能使用统计
 */
export async function getSkillStats(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const days = parseInt(searchParams.get('days') || '7');

    const client = getSupabaseClient();

    // 计算日期范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取统计数据
    const { data: stats } = await client
      .from('skill_executions')
      .select('skill_id, success, execution_time, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (!stats) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          success_rate: 0,
          avg_execution_time: 0,
          by_skill: {},
          trend: []
        }
      });
    }

    // 按技能分组统计
    const bySkill: Record<string, any> = {};
    stats.forEach(stat => {
      if (!bySkill[stat.skill_id]) {
        bySkill[stat.skill_id] = {
          skill_id: stat.skill_id,
          total: 0,
          success: 0,
          failed: 0,
          total_time: 0
        };
      }
      bySkill[stat.skill_id].total++;
      bySkill[stat.skill_id].total_time += stat.execution_time || 0;
      if (stat.success) {
        bySkill[stat.skill_id].success++;
      } else {
        bySkill[stat.skill_id].failed++;
      }
    });

    // 计算平均值
    Object.values(bySkill).forEach((skill: any) => {
      skill.success_rate = skill.total > 0 ? (skill.success / skill.total * 100).toFixed(2) : 0;
      skill.avg_execution_time = skill.total > 0 ? Math.round(skill.total_time / skill.total) : 0;
    });

    // 整体统计
    const total = stats.length;
    const success = stats.filter(s => s.success).length;
    const total_time = stats.reduce((sum, s) => sum + (s.execution_time || 0), 0);

    // 按天统计趋势
    const trend: Record<string, number> = {};
    stats.forEach(stat => {
      const date = new Date(stat.created_at).toISOString().split('T')[0];
      trend[date] = (trend[date] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        total,
        success_rate: total > 0 ? ((success / total) * 100).toFixed(2) : 0,
        avg_execution_time: total > 0 ? Math.round(total_time / total) : 0,
        success_count: success,
        failed_count: total - success,
        by_skill: Object.values(bySkill),
        trend: Object.entries(trend).map(([date, count]) => ({ date, count }))
      }
    });
  } catch (error) {
    console.error('Failed to get skill stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取统计数据失败'
      },
      { status: 500 }
    );
  }
}

#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# 配置 Git 全局默认设置
echo "Configuring git global settings..."
git config --global user.name "AI Agent" 2>/dev/null || true
git config --global user.email "agent@ai.local" 2>/dev/null || true
git config --global init.defaultBranch main 2>/dev/null || true

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

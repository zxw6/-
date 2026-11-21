#!/bin/bash
# 宝塔服务器：网站目录下或通过「计划任务 → Shell」调用
# 建议：Nginx 反代一个仅内网/带 Token 的 PHP/Node 入口，内部 exec 本脚本
#
# 环境变量（Webhook 入口传入）：
#   DEPLOY_TOKEN   与 deploy.json 里 webhookSecret 一致
#   DEPLOY_TARGET  admin-prod 等
#   DEPLOY_BRANCH  默认 master

set -euo pipefail

EXPECTED_TOKEN="${BAOTA_DEPLOY_TOKEN:-请改成与本地 deploy.json 相同}"
if [[ "${DEPLOY_TOKEN:-}" != "$EXPECTED_TOKEN" ]]; then
  echo "invalid token"
  exit 1
fi

BRANCH="${DEPLOY_BRANCH:-master}"
SITE="${BAOTA_SITE_PATH:-/www/wwwroot/xhd-admin}"
cd "$SITE"

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 按项目类型择一或分段执行（示例：Vue 管理端）
# npm ci && npm run build:prod
# 产物已在仓库 dist 则只需拉代码；或 build 后由宝塔网站根指 dist

# Java 微服务示例（路径按你宝塔实际改）：
# cd /www/wwwroot/xhd-java/yudao-server && mvn -q -DskipTests package
# bt restart java_你的项目名

echo "deploy ok: $(git log -1 --pretty=format:'%h %an %s')"
)
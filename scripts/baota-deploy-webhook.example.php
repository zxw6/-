<?php
/**
 * 宝塔网站根目录或独立子站点示例：校验 Token 后执行 deploy 脚本
 * Nginx 可把 /hooks/deploy-admin 指到此文件
 */
header('Content-Type: text/plain; charset=utf-8');

$token = $_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '';
$expected = getenv('BAOTA_DEPLOY_TOKEN') ?: '请与 deploy.json 里 webhookSecret 一致';

if ($token === '' || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo "forbidden\n";
    exit;
}

$script = '/www/wwwroot/your-site/deploy-hook.sh'; // 指向 baota-deploy-hook.example.sh
$branch = 'master';

putenv('DEPLOY_TOKEN=' . $expected);
putenv('DEPLOY_BRANCH=' . $branch);

$cmd = escapeshellcmd($script) . ' 2>&1';
$output = shell_exec($cmd);
echo $output ?: "ok\n";
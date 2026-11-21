22job/                          # 个人代码工作台（可整目录带走）
├── package.json                 # 根脚本：dev / tunnel / push
├── config.json                  # 监听哪些本地 Git 仓库
├── deploy.json                  # 部署目标（远程、分支、Webhook）
├── profile.json                 # 昵称、简介、GitHub 等
├── README.md
├── scripts/
│   ├── git-commit-push.ps1      # 先 commit → pull --rebase → push
│   └── baota-deploy-*.example.* # 宝塔发布示例
├── server/                      # 后端 API + 监听（默认 127.0.0.1:4177）
│   └── src/
│       ├── index.js             # HTTP + WebSocket 入口
│       ├── watcher.js           # 文件保存监听
│       ├── git-snapshot.js      # 未提交 WIP 定时快照
│       ├── db.js                # SQLite 活动库
│       ├── deploy-*.js          # 部署、草稿、差异、远程
│       └── github-profile-sync.js
├── web/                         # 前端 Vue3 + Vite（默认 127.0.0.1:5178）
│   └── src/
│       ├── App.vue              # 工作台 / 部署模式切换
│       ├── views/DeployView.vue
│       └── components/          # 热力图、活动流、设置、GitHub 等
├── data/                        # 本地数据（不入 Git 或按 .gitignore）
│   ├── activity.db              # 活动与提交记录
│   ├── deploy-drafts/           # 部署前草稿备份
│   └── github-profile/          # 同步 GitHub 简介用克隆仓
└── github-profile/              # 说明与主页 README 模板
<img width="1218" height="945" alt="image" src="https://github.com/user-attachments/assets/c8269a8b-410a-45c4-b993-30e58284d53d" />

# TaskBoard SaaS 项目部署与开发指南

## 📋 项目概述

- **项目名称**: TaskBoard - B2B 团队任务管理 SaaS
- **技术栈**: React + TypeScript + FastAPI + SQLite + Clerk
- **当前状态**: V1.0 开发完成，准备部署上线

---

## 🚀 第一部分：生产环境部署

### 1.1 部署前准备

#### 检查清单
- [ ] 代码已提交到 Git 仓库
- [ ] 环境变量已配置（.env 文件）
- [ ] 本地测试通过（前端构建 + 后端运行）
- [ ] 域名已购买（可选但推荐）
- [ ] SSL 证书准备（Let's Encrypt 免费）

#### 服务器要求
- **操作系统**: Ubuntu 22.04 LTS
- **配置**: 2核 4GB 内存（最低）
- **存储**: 20GB SSD
- **带宽**: 5Mbps 以上

---

### 1.2 后端部署（FastAPI）

#### 步骤 1：创建 Systemd 服务

创建服务文件：
```bash
sudo nano /etc/systemd/system/taskboard-api.service
```

写入配置：
```ini
[Unit]
Description=TaskBoard API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/B2B-SaaS/backend
Environment=PATH=/root/B2B-SaaS/backend/.venv/bin
Environment=PYTHONUNBUFFERED=1
ExecStart=/root/B2B-SaaS/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

#### 步骤 2：启动服务

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable taskboard-api

# 启动服务
sudo systemctl start taskboard-api

# 查看状态
sudo systemctl status taskboard-api

# 查看日志
sudo journalctl -u taskboard-api -f
```

#### 步骤 3：环境变量配置

确保 `/root/B2B-SaaS/backend/.env` 包含：
```env
# Clerk 配置
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json

# 数据库
DATABASE_URL=sqlite:///./taskboard.db

# 前端地址（生产环境）
FRONTEND_URL=https://your-domain.com

# 其他配置
FREE_TIER_MEMBERSHIP_LIMIT=2
PRO_TIER_MEMBERSHIP_LIMIT=0
```

---

### 1.3 前端部署（Nginx）

#### 步骤 1：构建生产版本

```bash
cd /root/B2B-SaaS/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 构建输出在 dist/ 目录
```

#### 步骤 2：安装和配置 Nginx

```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default
```

创建配置文件：
```bash
sudo nano /etc/nginx/sites-available/taskboard
```

写入配置（HTTP 版本）：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    # 前端静态文件
    root /root/B2B-SaaS/frontend/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 前端路由支持（单页应用）
    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用配置：
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/taskboard /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 步骤 3：HTTPS 配置（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

### 1.4 数据库备份策略

#### 自动备份脚本

创建备份脚本：
```bash
sudo nano /root/backup-db.sh
```

写入：
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/root/backups
DB_FILE=/root/B2B-SaaS/backend/taskboard.db

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $DB_FILE $BACKUP_DIR/taskboard_$DATE.db

# 保留最近 30 天的备份
find $BACKUP_DIR -name "taskboard_*.db" -mtime +30 -delete

echo "Backup completed: taskboard_$DATE.db"
```

设置定时任务：
```bash
chmod +x /root/backup-db.sh

# 每天凌晨 3 点备份
crontab -e
# 添加：
0 3 * * * /root/backup-db.sh >> /var/log/db-backup.log 2>&1
```

---

### 1.5 监控与日志

#### 查看服务状态
```bash
# 后端服务
sudo systemctl status taskboard-api
sudo journalctl -u taskboard-api -f

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### 性能监控（可选）
安装 htop 和 netdata：
```bash
sudo apt install htop
# 或使用 netdata 进行 Web 监控
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

---

### 1.6 Clerk 生产环境配置

在 Clerk Dashboard 中更新：

1. **应用设置** → **URLs**：
   - Application name: TaskBoard
   - Home URL: `https://your-domain.com`
   - Sign-in URL: `https://your-domain.com/sign-in`
   - Sign-up URL: `https://your-domain.com/sign-up`

2. **开发者** → **API Keys**：
   - 使用 Production 环境的密钥
   - 更新服务器上的 `.env` 文件

3. **Webhooks**：
   - Endpoint URL: `https://your-domain.com/api/webhooks/clerk`
   - 订阅事件: `subscription.created`, `subscription.updated`, etc.

4. **Organizations**：
   - 启用 Organizations 功能
   - 配置默认角色权限

---

## 🔄 第二部分：Git 迭代开发工作流

### 2.1 初始化 Git 仓库

如果还没有 Git 仓库：
```bash
cd /root/B2B-SaaS

# 初始化
git init

# 添加远程仓库（GitHub/GitLab/Gitee）
git remote add origin https://github.com/yourusername/taskboard.git

# 首次提交
git add .
git commit -m "feat: initial release v1.0"
git push -u origin main
```

---

### 2.2 分支策略（Git Flow）

推荐的分支模型：

```
main (生产分支)
  ↑
  |--- develop (开发分支)
  |      ↑
  |      |--- feature/login (功能分支)
  |      |--- feature/payment (功能分支)
  |      |--- bugfix/ui-fix (修复分支)
  |
  |--- hotfix/security (紧急修复)
  |--- release/v1.1 (发布分支)
```

#### 分支说明

| 分支 | 用途 | 生命周期 |
|------|------|----------|
| `main` | 生产环境代码 | 永久 |
| `develop` | 开发集成 | 永久 |
| `feature/*` | 新功能开发 | 临时 |
| `bugfix/*` | Bug 修复 | 临时 |
| `release/*` | 发布准备 | 临时 |
| `hotfix/*` | 紧急修复 | 临时 |

---

### 2.3 日常开发工作流

#### 场景 1：开发新功能

```bash
# 1. 切换到 develop 分支并更新
git checkout develop
git pull origin develop

# 2. 创建功能分支
git checkout -b feature/dark-mode

# 3. 开发代码...
# 编辑文件

# 4. 提交更改
git add .
git commit -m "feat: add dark mode toggle

- Add useTheme hook
- Add ThemeToggle component
- Update CSS variables for dark mode"

# 5. 推送到远程
git push -u origin feature/dark-mode

# 6. 创建 Pull Request（在 GitHub/GitLab 上）
# 7. 代码审查通过后合并到 develop
```

#### 场景 2：修复生产 Bug

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git pull origin main
git checkout -b hotfix/login-error

# 2. 修复代码...

# 3. 提交并推送
git add .
git commit -m "fix: resolve login redirect issue"
git push -u origin hotfix/login-error

# 4. 合并到 main 和 develop
# 在 GitHub 上创建 PR 合并到 main
# 然后 cherry-pick 到 develop
git checkout develop
git cherry-pick <commit-hash>
git push origin develop
```

#### 场景 3：发布新版本

```bash
# 1. 从 develop 创建 release 分支
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. 版本号更新、测试、文档更新...

# 3. 提交 release 分支
git add .
git commit -m "chore: prepare v1.1.0 release"
git push -u origin release/v1.1.0

# 4. 合并到 main
git checkout main
git merge release/v1.1.0
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin main --tags

# 5. 合并回 develop
git checkout develop
git merge release/v1.1.0
git push origin develop

# 6. 删除 release 分支
git branch -d release/v1.1.0
git push origin --delete release/v1.1.0
```

---

### 2.4 提交信息规范

使用 **Conventional Commits** 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add user profile page` |
| `fix` | Bug 修复 | `fix: resolve login redirect` |
| `docs` | 文档更新 | `docs: update API documentation` |
| `style` | 代码格式 | `style: format with prettier` |
| `refactor` | 重构 | `refactor: optimize database query` |
| `perf` | 性能优化 | `perf: improve page load speed` |
| `test` | 测试 | `test: add unit tests for auth` |
| `chore` | 杂项 | `chore: update dependencies` |

#### 示例

```bash
# 简单提交
git commit -m "feat: add dark mode support"

# 详细提交
git commit -m "feat(auth): implement OAuth login

- Add Google OAuth integration
- Update user model with OAuth fields
- Add login callback handler

Closes #123"
```

---

### 2.5 自动化部署（CI/CD）

#### GitHub Actions 配置

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install frontend dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Build frontend
      run: |
        cd frontend
        npm run build
    
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /root/B2B-SaaS
          git pull origin main
          cd frontend && npm install && npm run build
          sudo systemctl restart taskboard-api
          sudo systemctl restart nginx
```

#### 配置 Secrets

在 GitHub 仓库设置中添加：
- `SERVER_HOST`: 150.158.116.209
- `SERVER_USER`: root
- `SSH_PRIVATE_KEY`: 服务器私钥

---

### 2.6 版本号管理

使用 **Semantic Versioning** (语义化版本)：

```
版本格式：主版本号.次版本号.修订号（MAJOR.MINOR.PATCH）

1.0.0
│ │ │
│ │ └── 修订号：Bug 修复
│ └──── 次版本号：新功能（向下兼容）
└────── 主版本号：重大变更（不兼容）
```

#### 版本发布流程

1. 更新 `package.json` 版本号
2. 更新 `CHANGELOG.md`
3. 创建 Git tag
4. 推送到远程
5. 部署到生产环境

---

## 📚 附录

### 常用命令速查

```bash
# Git
git status                    # 查看状态
git log --oneline -10         # 查看最近提交
git diff                      # 查看更改
git stash                     # 暂存更改
git stash pop                 # 恢复暂存
git reset --soft HEAD~1       # 撤销上次提交
git revert <commit>           # 回滚提交

# 服务管理
sudo systemctl start|stop|restart taskboard-api
sudo systemctl start|stop|restart nginx
sudo journalctl -u taskboard-api -f

# Nginx
sudo nginx -t                 # 测试配置
sudo nginx -s reload          # 重载配置

# 数据库
sqlite3 taskboard.db ".dump" > backup.sql  # 导出
sqlite3 taskboard.db < backup.sql          # 导入
```

### 故障排查

| 问题 | 解决方案 |
|------|----------|
| 502 Bad Gateway | 检查后端服务是否运行 |
| 404 Not Found | 检查 Nginx 路径配置 |
| CORS 错误 | 检查 FRONTEND_URL 环境变量 |
| 样式不生效 | 清除浏览器缓存 |
| 数据库锁定 | 重启后端服务 |

---

## ✅ 部署检查清单

### 部署前
- [ ] 代码已推送到 main 分支
- [ ] 环境变量已配置
- [ ] 本地构建测试通过
- [ ] 数据库备份已创建

### 部署中
- [ ] 后端服务正常运行
- [ ] Nginx 配置正确
- [ ] 前端资源可访问
- [ ] API 接口响应正常

### 部署后
- [ ] 首页可访问
- [ ] 登录功能正常
- [ ] 任务 CRUD 正常
- [ ] Clerk Webhook 正常
- [ ] 深色模式正常
- [ ] 移动端适配正常

---

**文档版本**: v1.0  
**最后更新**: 2024-04-09  
**维护者**: TaskBoard Team

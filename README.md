<div align="center">
  <img src="apps/web/public/sauna-mark.svg" width="112" alt="Sauna 标志：光门与座席" />
  <h1>Sauna</h1>
  <p><strong>和你的 AI 智囊团一起，把复杂的问题想清楚。</strong></p>
  <p>
    <a href="README.md">简体中文</a> ·
    <a href="README_EN.md">English</a>
  </p>
</div>

Sauna 是一个个人 AI 智囊团工作空间。系统可以提供已经通过 `nuwa-skill` 思路蒸馏完成的默认智囊，也允许用户创建属于自己的智囊 Skill；咨询时，Sauna 会加载对应 Skill，并调用用户配置的大模型进行真实、流式的对话。

> 项目目前处于持续开发阶段。产品界面仍在迭代，因此仓库暂不展示可能快速过时的截图。

## 核心体验

- **智囊大厅**：以工位形式展示默认和个人智囊，选中人物后再开始咨询。
- **VIP 桑拿房**：支持 SSE 流式响应、Markdown、代码块、执行计划展示和历史会话。
- **蒸馏车间**：从公共模板创建 Skill，或提交新的 `nuwa-skill` 蒸馏任务。
- **模型设置**：保存 OpenAI-compatible Base URL、API Key、供应商和模型。
- **真实登录**：支持邮件验证码登录；生产环境通过 SMTP 发送验证码。
- **董事会桑拿**：多智囊协作与辩论的后续能力，当前为规划功能。

## nuwa-skill 如何接入

默认智囊不是只靠一句“模仿名人”的提示词生成。后端会把已蒸馏的 Skill Markdown 作为版本化内容保存，在每次咨询时将所选人物的身份、认知框架和 Skill 内容组装进系统提示词，再交给用户配置的模型。

默认 Skill 位于：

```text
apps/backend/seed/nuwa-skills
```

当前仓库包含乔布斯、马斯克、费曼、芒格、Naval 和 Paul Graham 等种子 Skill。用户创建的智囊以私有 Agent 和 Skill 版本保存；后续知识资料可通过 PostgreSQL `pgvector` 扩展检索能力。

## 架构

```text
Browser / Next.js 16
        │  REST + SSE
        ▼
Go API / Gin
        │
        ├── Auth、Workspace、Agent、Session、Turn
        ├── Prompt Assembly / nuwa-skill Loader
        └── OpenAI-compatible LLM Adapter
        │
        ├── PostgreSQL + pgvector + pgcrypto
        └── DragonFlyDB / Redis-compatible cache
```

- **前端**：Next.js 16 App Router、React 19、Tailwind CSS、Zustand、Motion。
- **后端**：Go、Gin，按 Domain / Repository / Usecase / Handler 分层。
- **数据库**：PostgreSQL，关系数据与向量数据统一存储。
- **缓存**：DragonFlyDB，负责验证码、限流和运行时缓存。
- **模型层**：OpenAI-compatible 模型发现与流式 Chat Completions。

## 仓库结构

```text
apps/web       Next.js 前端
apps/backend   Go API、数据库迁移和 nuwa-skill 种子
scripts        本地启停脚本
docs           PRD 与跨开发环境交接文档
```

## 环境要求

- Node.js 与 npm
- Go 1.25+
- PostgreSQL，并启用 `pgvector`、`pgcrypto`
- DragonFlyDB 或兼容 Redis 的服务

默认本地服务：

```text
PostgreSQL: 127.0.0.1:5432 / sauna
DragonFly:  redis://127.0.0.1:16379/0
Backend:    http://127.0.0.1:19588
Frontend:   http://127.0.0.1:3000
```

## 配置

```bash
cp .env.example .env
```

后端核心变量：

```dotenv
APP_ENV=development
HTTP_ADDR=:19588
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/sauna?sslmode=disable
REDIS_URL=redis://127.0.0.1:16379/0
SAUNA_SECRET_KEY=change-me-to-a-long-random-secret
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AUTH_EMAIL_DRIVER=dev
```

前端变量：

```dotenv
NEXT_PUBLIC_SAUNA_API_BASE_URL=http://127.0.0.1:19588/api/v1
SAUNA_BACKEND_INTERNAL_URL=http://127.0.0.1:19588
```

生产环境邮件登录还需要配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM` 和 `SMTP_SECURITY`。不要把真实数据库密码、SMTP 密码或模型 Key 提交到 Git。

## 安装与运行

```bash
npm install
npm --prefix apps/web install
cd apps/backend && go mod download && cd ../..
```

启动 VPS 上的 Go 后端：

```bash
npm run dev:start
```

停止后端：

```bash
npm run dev:stop
```

本地开发前端：

```bash
npm run web:dev
```

健康检查：

```bash
curl http://127.0.0.1:19588/health
```

## 验证

```bash
npm run backend:test
npm run web:typecheck
npm run web:lint
npm run web:build
git diff --check
```

## 部署

### Vercel 前端

```text
Root Directory: apps/web
Build Command: npm run build
NEXT_PUBLIC_SAUNA_API_BASE_URL=https://api.sauna.wrenzeal.top/api/v1
```

生产前端地址为 `https://sauna.wrenzeal.top`。Vercel 只需要公开 API 地址，不应保存数据库、SMTP、平台模型或加密密钥。

### Go 后端与 Nginx

Go 后端监听 `127.0.0.1:19588`，由 Nginx 暴露为 `https://api.sauna.wrenzeal.top`。SSE 代理路径必须关闭 buffering，并设置足够长的读取超时。后端环境保存数据库、DragonFlyDB、`SAUNA_SECRET_KEY`、CORS 和 SMTP 配置。

## 安全边界

- Provider API Key 加密后入库，前端只获得脱敏提示。
- 登录验证码与认证接口通过 DragonFlyDB 限流；未登录用户只能浏览默认智囊。
- `.env`、构建产物、依赖目录、本地运行状态及 Codex/OMX 状态不应提交。
- 生产环境必须使用高强度 `SAUNA_SECRET_KEY`、明确的 `DATABASE_URL` 和 SMTP 配置。

## 路线图

- 完善外部 Agent 执行器与蒸馏任务队列。
- 将上传资料切分、嵌入并存入 `pgvector`。
- 实现多智囊董事会讨论、观点汇总和分歧展示。
- 增加稳定的产品截图、贡献指南和自动化端到端测试。

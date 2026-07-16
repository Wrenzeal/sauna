# Sauna 人物大厅管理员手册

## 管理员身份

后端只使用 `SAUNA_ADMIN_EMAILS` 判断管理员，按完整邮箱精确匹配。当前产品不使用角色表或多级 RBAC。

```env
SAUNA_ADMIN_EMAILS=owner@example.com
```

管理员登录后，顶部导航会出现“管理”，可以查看人物申请并更新状态。普通用户不会看到入口，即使直接访问管理 API 也会收到 `403`。

## 本地蒸馏与上架

平台不允许用户在线运行蒸馏任务。管理员在服务器上使用现有 `nuwa-skill` 完成人物蒸馏，并整理为：

```text
<slug>/
├── manifest.json
├── SYSTEM_PROMPT.md
├── SKILL.md
└── quality-report.json
```

先校验：

```bash
cd apps/backend
go run ./cmd/catalog validate --dir /path/to/package
```

直接上架：

```bash
cd apps/backend
go run ./cmd/catalog import --dir /path/to/package
```

完成某张申请并通知关注者：

```bash
cd apps/backend
go run ./cmd/catalog import --dir /path/to/package --request-id <request-uuid>
```

内容哈希未变化时不会创建重复版本。内容变化时会创建新的公开版本；新咨询使用最新版，历史咨询继续固定在原版本。

## 游客试用

游客试用由平台模型支付，不读取任何用户保存的 Provider。生产环境需要单独配置：

```env
GUEST_LLM_BASE_URL=https://provider.example.com/v1
GUEST_LLM_API_KEY=...
GUEST_LLM_MODEL=model-name
GUEST_DAILY_TURN_LIMIT=3
GUEST_SESSION_TTL=24h
```

未配置时公开人物大厅仍可浏览，但试聊接口会返回 `503 guest_provider_unavailable`。

## 数据与恢复

迁移 `005_curated_catalog.sql` 会永久删除旧私人 Agent 及其咨询记录。执行前必须保留 PostgreSQL 备份。当前服务器备份存放在 `.runtime/backups/`，该目录不进入 Git。

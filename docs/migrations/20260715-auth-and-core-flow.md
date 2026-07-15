# 20260715 认证与核心闭环迁移说明

迁移目录：`backend/prisma/migrations/20260715000200_auth_and_core_flow/`

## 变更

- 增加 `identity_provider` 枚举、`auth_identities` 与 `refresh_sessions`。
- `users` 增加 `token_version`、`deleted_at`，`user_status` 增加 `DELETED`。
- `stores` 增加 `deleted_at` 与用户有效店铺查询索引。
- `food_records` 增加客户端幂等 UUID、性价比评分、总消费、用餐时间、同行人、简短感受、推荐/再去/收藏/草稿、软删除字段。
- 增加用户+幂等键唯一约束、有效记录/收藏复合索引与 PostgreSQL 部分索引。
- 增加评分步长、金额非负、同行人数与版本检查约束。

## 数据兼容

所有新增必填字段均有数据库默认值；现有记录无需回填即可迁移。可空字段保持 NULL。历史迁移未修改。

## 执行

```powershell
pnpm prisma:generate
pnpm prisma:validate
pnpm prisma:migrate:deploy
```

开发环境可在迁移后执行：

```powershell
pnpm prisma:seed
```

不需要清空本地数据库。若本地数据库曾手工修改过同名表或枚举，应先备份并使用 `prisma migrate status` 核对，不要在生产库运行 reset。

## 验证

```powershell
pnpm prisma:migrate:test
```

迁移测试会在隔离 PostgreSQL 中重放所有迁移、再次 deploy、重复 seed，并验证九张核心表、腾讯 POI 去重、跨用户复合外键、评分/金额约束与用户级联隔离。

## 回退

该迁移属于向前迁移，不提供自动降级 SQL。尚未承载会话数据的本地开发库可重建；生产环境应通过新的修复迁移演进，不能删除或改写已执行迁移。

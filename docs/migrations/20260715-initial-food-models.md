# 20260715 初始美食数据模型迁移说明

## 1. 迁移目标

本迁移只建立第三阶段已审核的数据库模型和后端数据访问基础，不创建会员、好友、共享清单或具体业务接口。

迁移目录：`backend/prisma/migrations/20260715000100_initial_food_models/`。

## 2. 数据变化

### 2.1 枚举

- `user_status`：`ACTIVE`、`DISABLED`；
- `store_source`：`TENCENT_POI`、`MANUAL`；
- `coordinate_type`：`GCJ02`；
- `record_status`：`WANT_TO_GO`、`VISITED`、`BLACKLISTED`；
- `dish_type`：`RECOMMENDED`、`AVOIDED`。

### 2.2 表与 Prisma 模型

| Prisma model | PostgreSQL table | 说明 |
| --- | --- | --- |
| `User` | `users` | 用户根实体 |
| `Store` | `stores` | 用户私有店铺快照 |
| `FoodRecord` | `food_records` | 一店一条当前美食记录 |
| `Tag` | `tags` | 用户自定义标签 |
| `RecordTag` | `food_record_tags` | 记录与标签关联 |
| `RecordImage` | `record_images` | 私有图片对象元数据 |
| `DishRecord` | `dish_items` | 推荐菜与踩雷菜；表名沿用已审核设计 |

所有主键为 UUID。时间点字段统一为 `timestamptz(3)`，由数据库按 UTC 保存；`visited_at` 是业务日期，保留为 `date`。

### 2.3 用户隔离与删除规则

- 除 `users` 外，每张业务表都包含非空 `user_id` 并外键关联 `users.id`；
- 父子关系通过 `(user_id, id)` 唯一键和复合外键阻止跨用户关联；
- 删除用户时，店铺、记录、标签、关联、图片元数据和菜品数据级联删除；
- 删除店铺时，其唯一当前记录及记录子项级联删除；
- 删除标签只删除标签关联，不删除美食记录；
- COS 对象的实际清理由后续媒体清理流程处理，本阶段只验证数据库元数据级联。

### 2.4 唯一约束、检查约束与索引

- `stores (user_id, map_poi_id)` 防止同一用户重复保存同一地图 POI；`map_poi_id` 为空的手动店铺可保存多条；
- `food_records (user_id, store_id)` 保证一店一条当前记录；
- 标签名称、记录标签、图片对象键与图片排序、菜品名称均有对应唯一约束；
- 数据库检查经纬度范围、0.5 分评分步长、非负人均消费、固定 `CNY`、图片大小/尺寸/排序和标签颜色格式；
- 外键列、状态列表、日期、评分和地图边界查询均设置用户优先的 B-tree 索引；
- `pg_trgm` GIN 索引用于店铺、备注、标签和菜品的包含搜索。

## 3. 开发环境执行

首次执行前，从仓库根目录创建本地环境文件并填写真实本地密码：

```powershell
Copy-Item .env.example .env
pnpm install
pnpm postgres:up
pnpm prisma:migrate:deploy
pnpm prisma:generate
pnpm prisma:seed
```

后续修改 schema 时使用 `pnpm prisma:migrate:dev` 生成新的向前迁移，不修改已经发布的迁移目录。

## 4. 自动迁移测试

```powershell
pnpm prisma:migrate:test
```

该命令启动一次性本地 Prisma Postgres 测试实例，并实际执行：

1. 空库 `prisma migrate deploy`；
2. 再次 deploy，确认没有待执行迁移；
3. 连续两次 `prisma db seed`，验证种子可重复执行；
4. 表数量与种子基线检查；
5. 同用户 POI 去重、跨用户复合外键、非法评分检查；
6. 用户级联删除和其他用户数据不受影响检查；
7. `prisma migrate status`。

测试实例为无状态实例，结束后自动关闭，不读取或改写开发 `.env` 指向的数据库。

## 5. 生产执行与回退原则

生产环境只使用：

```powershell
pnpm prisma:migrate:deploy
```

执行前必须完成备份与恢复验证，并使用直连 PostgreSQL 的迁移账号。Prisma 迁移只向前执行；已发布迁移不删除、不改名。若上线后发现问题，创建新的修复迁移。当前迁移是初始建表迁移，没有对既有业务数据进行转换。

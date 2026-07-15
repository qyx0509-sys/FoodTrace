# 《食藏录》数据库设计（当前实现）

## 1. 原则

- PostgreSQL 17 + Prisma，主键统一 UUID。
- 时间点使用 `timestamptz(3)`，纯到店日期使用 `date`。
- 金额和评分使用 `Decimal`，不使用浮点数持久化。
- 所有私人业务表都包含非空 `user_id`；父子关系使用复合外键阻止跨用户关联。
- 业务查询显式匹配 JWT `userId`；MVP 暂不启用 RLS。
- 已发布的初始迁移不修改，新变更通过后续迁移向前演进。

## 2. 模型

| Prisma 模型 | 数据库表 | 用途 |
| --- | --- | --- |
| `User` | `users` | 用户根实体、账号状态、token version、软注销时间 |
| `AuthIdentity` | `auth_identities` | 微信小程序/移动端身份绑定，不保存 session_key |
| `RefreshSession` | `refresh_sessions` | 多设备 refresh 会话、哈希、轮换 family 与重放标记 |
| `Store` | `stores` | 用户个人店铺快照，腾讯 POI 或手动来源 |
| `FoodRecord` | `food_records` | 状态、评分、金额、用餐信息、感受、草稿/收藏与软删除 |
| `Tag` | `tags` | 用户自定义标签 |
| `RecordTag` | `food_record_tags` | 记录与标签多对多关联 |
| `RecordImage` | `record_images` | 私有对象键及校验元数据，不保存永久公开 URL |
| `DishRecord` | `dish_items` | 推荐菜与踩雷菜 |

## 3. 核心枚举

- `UserStatus`: `ACTIVE`, `DISABLED`, `DELETED`
- `IdentityProvider`: `WECHAT_MINI`, `WECHAT_MOBILE`
- `StoreSource`: `TENCENT_POI`, `MANUAL`
- `CoordinateType`: `GCJ02`
- `RecordStatus`: `WANT_TO_GO`, `VISITED`, `BLACKLISTED`
- `DishType`: `RECOMMENDED`, `AVOIDED`

## 4. 关键约束

### 用户与会话

- 身份唯一：`(provider, app_id, provider_user_id)`。
- refresh token hash 全局唯一，明文只返回客户端一次。
- 会话索引：`(user_id, expires_at)`、`(family_id, revoked_at)`。
- 禁用/注销用户或 `token_version` 变化后，旧 access token 无法通过 Guard。

### 店铺

- 腾讯 POI 按 `(user_id, map_poi_id)` 去重；PostgreSQL 允许多个 NULL，因此手动店铺不受误限制。
- 经纬度数据库检查范围分别为 `[-90,90]` 与 `[-180,180]`。
- 普通索引覆盖用户+城市、纬度、经度与有效记录更新时间。

### 记录

- 当前 MVP 保持一位用户每店一条记录：`UNIQUE (user_id, store_id)`。
- 幂等键：`UNIQUE (user_id, client_request_id)`。
- 评分 1—5 且步长 0.5；金额非负；版本大于 0。
- 列表索引以 `user_id` 为左前缀，覆盖状态、软删除、更新时间、收藏与日期。
- `deleted_at` 非空后，常规查询不再返回该记录；重新记录同一店铺时服务端可在事务内恢复。

### 关联隔离

- `FoodRecord(user_id, store_id)` 复合外键指向 `Store(user_id, id)`。
- `RecordTag`、`RecordImage`、`DishRecord` 都通过 `(user_id, record_id)` 指向记录。
- 这些约束可以在应用层漏传条件时继续阻止跨用户父子写入。

## 5. 删除策略

- 用户是根实体；执行账号物理清理时从属身份、会话、店铺、记录与关联行级联删除。
- 正常记录删除为软删除，避免误操作直接丢失正文；关联仍保留供后续恢复与受控清理。
- 删除标签关联、菜品与图片元数据时使用级联；对象存储文件必须由后续清理任务处理，不能只删数据库行。
- 商家无权访问或修改任何用户店铺快照与记录。

## 6. 查询与分页

- 列表固定 `updated_at DESC, id DESC` 保证稳定顺序，当前 API 提供 page/pageSize。
- 搜索仅在 JWT 用户范围内匹配店名、地址、备注、摘要、菜品与标签。
- 用户量增长后优先将列表切换为 `(updated_at,id)` 游标分页，不改变数据模型。
- 地理查询 MVP 使用 GCJ-02 经纬度边界与距离计算；有真实性能需求后再评估 PostGIS。

## 7. 迁移与 seed

- `20260715000100_initial_food_models`：初始七个业务模型。
- `20260715000200_auth_and_core_flow`：身份/会话、记录扩展、软删除、索引与检查约束。
- seed 使用固定 UUID 与 upsert，可重复执行；只用于开发/测试，不在生产自动运行。
- `pnpm prisma:migrate:test` 在隔离 PostgreSQL 中两次 deploy、两次 seed，并验证表、唯一约束、跨用户外键、金额/评分约束与级联。

## 8. P1 数据库扩展

图片直传尚需 `UploadSession` 和可靠的对象清理任务；账号注销需要可审计清理流程。两者必须通过新迁移增加，不回改历史迁移。

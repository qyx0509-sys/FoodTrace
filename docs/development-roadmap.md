# 《食迹》开发路线图（MVP）

## 1. 路线原则

项目采用“文档评审 → 基础设施 → 后端能力 → 客户端闭环 → 上线验收”的增量方式。每个阶段开始前必须先提交阶段说明，包含：

1. 本阶段目标与明确不做的内容；
2. 预计新增、修改和删除的文件；
3. 数据库 schema、迁移、种子或现有数据影响；
4. 风险、回滚方式与可观察结果；
5. 可操作的验收标准；
6. 计划执行的语法检查、类型检查、测试和构建命令。

阶段完成后必须展示真实文件 diff 和真实命令结果。存在失败、跳过或因环境未执行的检查时必须明确列出，不得用描述代替执行。未经审核，不跨阶段批量实现，也不大规模删除或重构已审核代码。

## 2. 总体架构

```text
微信原生小程序 ─┐
                 ├─ HTTPS JSON API / OpenAPI ─ NestJS ─ Prisma ─ PostgreSQL
Flutter App ─────┘                         │
                                          ├─ 微信身份接口
                                          ├─ 腾讯位置服务 WebService
                                          └─ 腾讯云 COS / STS

客户端地图展示 ── 腾讯地图平台 SDK/组件
客户端图片上传 ── 临时最小权限凭证 ── 私有 COS
```

### 2.1 架构决策

- 后端采用模块化单体，不使用微服务和消息队列。
- PostgreSQL 是业务数据唯一事实来源；客户端缓存不是权威数据。
- 腾讯位置服务的 POI WebService 请求经后端代理，避免在客户端放置服务端 Key。
- 客户端地图渲染使用平台 SDK/组件所需的受限应用 Key，并绑定小程序、包名、签名或 Bundle ID。
- 图片选用腾讯云 COS，以便地图与存储在同一云生态下管理账号、配额和网络；客户端只取得短期限定凭证。
- Flutter 状态管理首选 Riverpod，网络层使用 Dio。
- API 以 Nest Swagger 生成的 OpenAPI 为跨端契约来源。

## 3. 规划中的项目目录

第一阶段实际只创建 `docs/` 文档。以下是审核通过后逐阶段形成的目标结构，不代表当前已生成：

```text
foodtrace/
├── backend/                         # NestJS + TypeScript + Prisma 后端
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── common/                  # guard、filter、pipe、interceptor、错误码
│   │   ├── config/                  # 环境变量校验与配置映射
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── records/
│   │   │   ├── tags/
│   │   │   ├── pois/
│   │   │   ├── maps/
│   │   │   ├── media/
│   │   │   ├── statistics/
│   │   │   └── health/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                        # e2e、fixtures、跨用户隔离测试
│   ├── Dockerfile
│   └── package.json
├── miniprogram/                     # 微信原生小程序 + TypeScript
│   ├── miniprogram/
│   │   ├── api/                     # 统一请求层与 endpoint 封装
│   │   ├── components/              # 自定义业务组件
│   │   ├── pages/
│   │   │   ├── login/
│   │   │   ├── home/
│   │   │   ├── records/
│   │   │   ├── record-form/
│   │   │   ├── record-detail/
│   │   │   ├── store-search/
│   │   │   ├── store-manual/
│   │   │   ├── map/
│   │   │   ├── statistics/
│   │   │   ├── tags/
│   │   │   └── settings/
│   │   ├── services/                # auth、cache、location、upload
│   │   ├── store/                   # 轻量全局会话与查询状态
│   │   ├── types/
│   │   ├── utils/
│   │   ├── app.json
│   │   └── app.ts
│   ├── tests/
│   ├── project.config.example.json
│   └── package.json
├── flutter_app/                     # Flutter Android/iOS App
│   ├── android/
│   ├── ios/
│   ├── lib/
│   │   ├── app/
│   │   │   ├── router/
│   │   │   └── theme/
│   │   ├── core/
│   │   │   ├── cache/
│   │   │   ├── config/
│   │   │   ├── errors/
│   │   │   ├── network/             # Dio 与 token refresh
│   │   │   ├── security/            # Keychain / Keystore
│   │   │   └── widgets/
│   │   └── features/
│   │       ├── auth/
│   │       ├── home/
│   │       ├── records/
│   │       ├── stores/
│   │       ├── map/
│   │       ├── media/
│   │       ├── statistics/
│   │       ├── tags/
│   │       └── settings/
│   ├── test/
│   ├── integration_test/
│   └── pubspec.yaml
├── packages/
│   └── api-contract/
│       ├── openapi.json              # 从 Nest Swagger 导出的版本化契约
│       └── generated/                # 可再生成代码，不手工修改
├── docs/
│   ├── product-requirements.md
│   ├── page-structure.md
│   ├── database-design.md
│   ├── api-design.md
│   └── development-roadmap.md
├── infra/
│   ├── docker/
│   │   └── docker-compose.dev.yml    # 本地 PostgreSQL 等最小依赖
│   └── cos/
│       └── README.md                 # Bucket、CORS、生命周期和 IAM 配置说明
├── scripts/                          # 契约导出与一致性检查脚本
├── .env.example                     # 仅变量名和安全示例，不含真实密钥
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

### 3.1 目录约束

- `backend` 与 `miniprogram` 进入 pnpm workspace；`flutter_app` 保留自己的工具链和锁文件。
- 业务模块按领域组织，不建立按 Controller/Service 类型横切的巨大目录。
- `generated/` 只能由固定命令重建，并在 CI 验证是否与 `openapi.json` 一致。
- 平台真实配置文件、签名材料、`.env`、service account 和 keystore 不提交仓库。
- `.env.example` 只能放占位值，并解释变量用途与是否敏感。

## 4. 分阶段计划

### 阶段 0：需求与设计（当前阶段）

**目标**

- 固化产品范围、页面结构、数据库模型、API 契约、目录结构、路线和验收标准。

**文件**

- `docs/product-requirements.md`
- `docs/page-structure.md`
- `docs/database-design.md`
- `docs/api-design.md`
- `docs/development-roadmap.md`

**数据变化**

- 无数据库、迁移、依赖或运行时数据变化。

**验收**

- 五份文档均为中文，字段、接口与代码标识为英文。
- 18 项 MVP 功能和暂不开发项均有明确归属。
- 明确 `userId` 隔离、微信跨端身份、腾讯地图、COS 临时凭证和本地缓存边界。
- Markdown 结构、相对链接、术语和示例 JSON 通过实际检查。
- 展示真实 diff 后停止，等待审核。

### 阶段 1：仓库与工程骨架

**目标**

- 初始化 monorepo、NestJS 空应用、小程序 TypeScript 空壳、Flutter 空应用和本地 PostgreSQL。
- 建立环境变量校验、统一命令、基础 CI 和健康检查，不写完整业务。

**主要文件变化**

- 根 workspace、锁文件、`.gitignore`、`.env.example`、README；
- `backend` 最小 NestJS、Swagger、Prisma 和配置模块；
- `miniprogram` 最小可编译页面与统一请求层接口；
- `flutter_app` 最小 Riverpod/Dio 工程；
- `infra/docker/docker-compose.dev.yml`。

**数据变化**

- 创建本地开发数据库容器；不创建业务表。

**验收命令方向**

- pnpm lint、TypeScript 类型检查、单元测试与构建；
- Nest 启动及 `/health/live` 冒烟测试；
- Flutter `format --set-exit-if-changed`、`analyze`、`test`；
- 小程序 TypeScript 编译与基础测试。

### 阶段 2：数据库基础与微信认证

**目标**

- 建立 `users`、`auth_identities`、`refresh_sessions` 模型与迁移。
- 实现小程序/App 微信登录适配器、JWT、刷新轮换、退出和 `/me`。
- 用可替换的微信适配器在自动化测试中避免调用真实微信。

**数据变化**

- 首次业务迁移创建身份和会话表及必要索引。
- 测试种子只创建虚构用户，不包含真实微信身份。

**验收**

- 登录、刷新重放检测、退出、过期和禁用用户测试通过。
- 数据库只保存刷新令牌哈希，不保存微信临时密钥。
- 小程序与 App 身份在有可验证 `unionId` 时合并，无条件时不误合并。

### 阶段 3：店铺、记录与标签核心闭环

**目标**

- 创建 `stores`、`food_records`、`dish_items`、`tags`、`food_record_tags` 模型。
- 实现记录创建、列表、详情、编辑、删除、筛选、排序和标签 CRUD。
- 暂用手动店铺完成后端闭环，POI 与图片不在本阶段接入。

**数据变化**

- 新增核心业务表、复合外键、约束、索引和开发测试数据。

**验收**

- 三种状态与所有文本/数值字段可正确持久化。
- 评分步长、唯一记录、标签归属和乐观锁由自动化测试覆盖。
- 用户 A 无法读写删用户 B 的任何资源。
- 删除级联与统计样本 SQL 经过数据库集成测试。

### 阶段 4：腾讯 POI 与地图后端

**目标**

- 接入腾讯位置服务适配器、POI 搜索、逆地址解析和地图范围标记。
- 建立超时、限流、错误映射和可替换测试桩。

**数据变化**

- `stores` 开始写入 `TENCENT_POI` 数据；无新表预期。
- 如执行计划需要，只通过迁移增加已审核索引。

**验收**

- 腾讯 Key 仅服务端可见，POI 不因普通搜索而持久化。
- 所有坐标为 `GCJ02`，范围查询和距离排序有边界用例。
- 上游超时、配额错误、空结果和用户拒绝定位均可处理。

### 阶段 5：COS 图片链路

**目标**

- 创建图片、上传会话与清理任务模型。
- 实现 STS 临时凭证、直传确认、私有读取签名、排序、删除和失败重试。

**数据变化**

- 新增 `record_images`、`upload_sessions`、`media_cleanup_tasks` 表。
- 配置私有 Bucket 的 CORS、`pending/` 生命周期和最小权限 CAM 策略。

**验收**

- 永久 COS 密钥不出现在客户端、响应、日志或仓库。
- 凭证只能写入当前用户、当前记录、当前 session 的精确键。
- 伪造大小/MIME、过期 session、重复完成、9 张上限和跨用户签名测试通过。
- 删除后不再签发 URL，清理任务失败可重试。

### 阶段 6：微信小程序 MVP

**目标**

- 按页面结构完成小程序登录、首页、搜索/手动店铺、记录表单、清单、详情、地图、统计、标签和设置。
- 实现统一请求层、单飞刷新、用户命名空间缓存和草稿。

**数据变化**

- 无数据库 schema 变化预期；真实开发账号产生的数据仅写开发环境。

**验收**

- 微信开发者工具与真机完成核心流程。
- 请求层统一处理 requestId、认证刷新、错误码和取消请求。
- 断网缓存、草稿、退出清理、定位拒绝和图片失败重试可验证。
- TypeScript、lint、单元测试和可用构建均实际通过。

### 阶段 7：Flutter Android/iOS MVP

**目标**

- 使用 Riverpod、Dio 和平台安全存储实现与小程序等价的核心功能。
- 接入微信移动授权、腾讯地图平台适配与 COS 直传。

**数据变化**

- 无数据库 schema 变化预期；两端共用 API 和用户数据。

**验收**

- Android 模拟器/真机与 iOS Simulator/真机按能力完成核心流程。
- 小程序和 App 在同一用户条件下数据一致。
- Dio 单飞刷新、Riverpod 状态、缓存隔离和 Widget 交互有测试。
- `flutter analyze`、测试及对应平台构建检查实际通过；无法在当前主机执行的 iOS 真机构建必须明确记录并在 macOS CI/设备补验。

### 阶段 8：统计、缓存完善与发布验收

**目标**

- 完成基础统计 UI、一致的缓存失效、全链路错误体验、性能与安全加固。
- 完成部署、备份恢复、隐私说明和发布前检查。

**数据变化**

- 原则上不新增功能表；任何性能索引必须基于查询计划单独评审。

**验收**

- `product-requirements.md` 的全部 MVP 验收项有对应证据。
- 三端契约、关键 E2E、跨用户安全、依赖漏洞、密钥扫描与构建通过。
- 生产环境变量、数据库备份、COS 私有权限、域名 HTTPS 与告警配置完成。
- 未完成项有明确风险与后续计划，不以“已知问题”掩盖阻断缺陷。

## 5. 每阶段交付模板

开始前：

```text
阶段：
目标：
不做：
涉及文件：
数据变化：
风险与回滚：
检查与测试命令：
验收标准：
```

完成后：

```text
完成内容：
真实 diff：
已执行命令与结果：
失败/跳过/未执行：
数据迁移结果：
已知限制：
等待审核的问题：
```

如阶段包含不可逆数据迁移、外部云资源创建、域名变更或费用操作，执行前必须再次取得明确同意。

## 6. 需要申请或准备的账号与外部服务

### 6.1 开发核心依赖

| 优先级 | 服务/账号 | 需要准备 | 用途与注意事项 |
| --- | --- | --- | --- |
| 必需 | 微信小程序账号 | 小程序主体、`appId`、`appSecret`、开发者权限 | 小程序登录；`appSecret` 只进入后端密钥配置 |
| 必需 | 微信开放平台账号 | 移动应用审核、移动 `appId`/`appSecret`、小程序与移动应用关联 | Flutter 微信登录及符合条件时通过 `unionId` 跨端识别 |
| 必需 | 腾讯位置服务账号 | WebService Key、小程序/Android/iOS 地图应用配置、调用配额 | POI、逆地址解析和地图 SDK；WebService Key 只在后端 |
| 必需 | 腾讯云账号 | COS 私有 Bucket、地域、CAM 子账号或云角色、STS 权限 | 图片直传与私有读取；优先云角色，其次最小权限永久凭据 |
| 必需 | PostgreSQL | 本地 Docker；测试/生产实例与备份权限 | 开发可无云账号，生产需要独立实例和恢复能力 |
| 必需 | API 部署环境 | 云主机、容器平台或等价环境 | 运行 NestJS 与清理定时任务 |
| 必需 | 域名与 TLS | API 域名、DNS、证书 | 微信合法域名和生产 HTTPS；按实际部署地区核验备案与合规要求 |

### 6.2 客户端发布依赖

| 阶段 | 服务/材料 | 需要准备 |
| --- | --- | --- |
| iOS 真机/发布前 | Apple Developer 与 App Store Connect | Team、Bundle ID、签名证书/自动签名权限、Associated Domains/Universal Link |
| Android 真机/发布前 | Android 应用签名 | 固定 package name、keystore、alias、密码的安全托管、微信平台登记的签名摘要 |
| 微信小程序发布前 | 小程序后台配置 | request/upload/download 合法域名、隐私保护指引、服务类目和体验成员 |
| 正式发布前 | 法律与隐私材料 | 隐私政策、用户协议、第三方 SDK 清单、权限用途说明；按上架地区届时规则复核 |

iOS 若计划公开提交 App Store，需要在发布阶段依据届时审核规则评估登录方式与账号删除等要求；不在当前设计阶段凭假设扩充功能，但必须在发布门禁前完成核验。

### 6.3 建议但非 MVP 阻断

| 服务 | 用途 | 决策 |
| --- | --- | --- |
| 托管 Git/CI | 代码审查、自动检查和构建 | 初始化阶段选择；不得把密钥写入工作流文件 |
| 错误监控 | 服务端和客户端崩溃追踪 | 上线前评审数据最小化与脱敏后再接入 |
| 邮件/告警渠道 | 运维告警 | 生产部署阶段选择，不进入产品功能 |

当前不需要支付、短信、AI、公开内容审核、优惠券或商家平台账号。

## 7. 环境变量清单

以下仅定义变量名；真实值不得写入文档、代码、示例或客户端仓库。

### 7.1 后端敏感变量

```text
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
WECHAT_MINI_APP_SECRET
WECHAT_MOBILE_APP_SECRET
TENCENT_MAP_WEB_SERVICE_KEY
TENCENT_CLOUD_SECRET_ID
TENCENT_CLOUD_SECRET_KEY
```

在支持云角色的部署环境中，优先不设置 `TENCENT_CLOUD_SECRET_ID` 和 `TENCENT_CLOUD_SECRET_KEY`，由实例角色取得 STS 权限。

### 7.2 后端非密钥配置

```text
NODE_ENV
PORT
API_BASE_URL
JWT_ISSUER
JWT_AUDIENCE
JWT_ACCESS_TTL_SECONDS
JWT_REFRESH_TTL_SECONDS
WECHAT_MINI_APP_ID
WECHAT_MOBILE_APP_ID
TENCENT_COS_BUCKET
TENCENT_COS_REGION
TENCENT_COS_UPLOAD_TTL_SECONDS
TENCENT_COS_READ_URL_TTL_SECONDS
SWAGGER_ENABLED
LOG_LEVEL
```

`appId`、Bucket 名和 Region 通常不是秘密，但仍通过配置注入以区分环境。

### 7.3 客户端构建配置

```text
API_BASE_URL
WECHAT_APP_ID
TENCENT_MAP_APP_KEY
APP_ENV
```

地图客户端 Key 无法像服务端秘密一样完全隐藏，因此必须按平台分别申请，并在供应商后台绑定小程序、Android package/signature、iOS Bundle ID 等限制。客户端不得包含 WebService Key、COS 永久密钥、JWT Secret 或数据库凭据。

### 7.4 本地配置文件

预计忽略但尚未创建的文件包括：

```text
.env
.env.*.local
miniprogram/project.config.json
flutter_app/android/key.properties
flutter_app/android/*.jks
flutter_app/ios/Runner/*.entitlements.local
```

实际 Flutter/iOS 文件名以初始化生成结果为准，先审核 `.gitignore` 再放入任何签名材料。

## 8. MVP 总体验收门禁

只有同时满足以下条件，MVP 才视为完成：

1. 小程序、Android 和 iOS 使用同一 API 完成登录、记录、清单、地图、图片、缓存和统计核心流程。
2. 腾讯 POI 和手动店铺都能创建记录，三种状态互相切换且数据一致。
3. 四项评分、消费、两类菜品、备注、标签和 9 张图片边界均通过测试。
4. 搜索、筛选、排序、地图范围和基础统计使用已知样本核对正确。
5. 编辑冲突可见，删除立即停止业务访问并可靠安排媒体清理。
6. 用户 A 对用户 B 的每类资源、搜索、地图、统计和图片 URL 均无法越权。
7. 客户端、仓库、日志和 API 响应不存在永久密钥或刷新令牌明文。
8. 离线缓存与草稿可用，退出或切换用户不会发生缓存串号。
9. 后端、小程序和 Flutter 的 lint、类型/静态检查、测试及适用构建全部由真实命令通过。
10. Swagger 与真实 API 一致，部署、备份、COS 权限、HTTPS 和隐私材料通过发布检查。

## 9. 当前审核决策点

进入阶段 1 前需要确认：

1. 接受“同一用户对一家店仅一条当前记录”，多次用餐日志延后。
2. 接受三类默认清单直接由 `status` 生成，自定义清单延后。
3. 接受腾讯位置服务 + 腾讯云 COS 的组合。
4. 接受 Flutter 使用 Riverpod。
5. 接受 MVP 币种固定 `CNY`、坐标固定 `GCJ-02`。
6. 确认计划中的小程序、Android package name、iOS Bundle ID 和部署地区，以便后续申请平台配置。

上述决策审核通过前，不初始化完整工程或申请会产生费用的云资源。

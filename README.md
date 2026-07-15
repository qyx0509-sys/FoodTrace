# 食藏录 FoodTrace

食藏录是一款纯私人向的美食记录与店铺管理产品。仓库包含微信原生小程序、Flutter Android/iOS App、NestJS API、Prisma、PostgreSQL 与本地 Docker Compose；英文技术标识继续使用 `FoodTrace` / `foodtrace`。

公开社区、商家入驻、支付、会员、好友与共享清单不属于当前 MVP。

## 技术栈与目录

```text
backend/        NestJS + TypeScript + Prisma API
miniprogram/    微信原生小程序 + TypeScript
flutter_app/    Flutter + Riverpod + Dio
docs/           产品、页面、数据库、API 与迁移文档
infra/docker/   PostgreSQL 17 本地开发编排
```

## 环境要求

- Node.js `22.x`（`package.json` 限定 `>=22 <23`）；
- pnpm `11.7.0`；
- PostgreSQL 17，或 Docker Desktop/兼容的 Docker Compose；
- Flutter `3.44.6` 与配套 Dart；
- 微信开发者工具。

## 首次安装

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm prisma:generate
Set-Location flutter_app
flutter pub get
Set-Location ..
```

编辑被 Git 忽略的 `.env`，至少替换数据库密码和两个不同的 JWT Secret。后端会在启动阶段校验必需项、占位值、TTL、端口、生产 CORS、微信登录与 COS 条件配置；错误配置会直接停止启动。

## 环境变量边界

只能由后端读取的 Secret：

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

允许作为客户端构建配置公开的值：

```text
MINIPROGRAM_API_BASE_URL
FLUTTER_API_BASE_URL
TENCENT_MAP_MINIPROGRAM_KEY
TENCENT_MAP_ANDROID_KEY
TENCENT_MAP_IOS_KEY
```

当前小程序公开 API 地址集中在 `miniprogram/miniprogram/config/runtime-config.ts`；Flutter 使用 `--dart-define=FLUTTER_API_BASE_URL=...`。页面不得自行拼接主机或重复添加 `/api/v1`。

## 启动 PostgreSQL、迁移与 seed

```powershell
pnpm postgres:up
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

开发 seed 可重复执行，只创建明确标注的本地示例数据，不创建真实微信身份。生产部署只执行 `prisma:migrate:deploy`，不得自动运行开发 seed。

停止本地数据库：

```powershell
pnpm postgres:down
```

## 启动后端

```powershell
pnpm backend:dev
```

默认地址：

- liveness：`http://127.0.0.1:3000/api/v1/health/live`
- readiness：`http://127.0.0.1:3000/api/v1/health/ready`
- 开发 Swagger：`http://127.0.0.1:3000/api/v1/docs`
- OpenAPI JSON：`http://127.0.0.1:3000/api/v1/docs-json`

生产环境默认关闭 Swagger，并要求明确的 `CORS_ORIGINS` 白名单。

## 启动微信小程序

```powershell
Copy-Item miniprogram/project.config.example.json miniprogram/project.config.json
```

使用微信开发者工具导入仓库中的 `miniprogram/` 目录。真实 `miniprogram/project.config.json` 与 `project.private.config.json` 被 Git 忽略，只在本机写入 AppID；不得复制第二份 `app.json`。

开发者工具访问本机 API 可使用 `http://127.0.0.1:3000/api/v1` 并在本地调试中关闭合法域名校验。真机不能使用电脑的 `127.0.0.1`，应改为同一局域网内的电脑地址；正式/体验环境必须使用已配置业务域名的 HTTPS API。

## 启动 Flutter

Android 模拟器访问宿主机用 `10.0.2.2`：

```powershell
Set-Location flutter_app
flutter run --dart-define=FLUTTER_API_BASE_URL=http://10.0.2.2:3000/api/v1
```

iOS 模拟器通常可使用 `http://127.0.0.1:3000/api/v1`。Android/iOS 真机与小程序相同，使用局域网地址或 HTTPS 测试环境，不能指向设备自己的 `127.0.0.1`。

## 检查与测试

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm prisma:migrate:test
pnpm build
```

统一执行：

```powershell
pnpm check
```

Flutter：

```powershell
Set-Location flutter_app
dart format --output=none --set-exit-if-changed .
dart analyze
flutter test
```

`prisma:migrate:test` 会启动隔离的一次性 PostgreSQL，重放迁移、重复执行 seed，并检查唯一约束、评分/金额约束、用户隔离与级联行为。

## 核心 API

所有业务接口以 `/api/v1` 为前缀。除健康检查、微信登录与刷新外均使用：

```http
Authorization: Bearer <accessToken>
```

后端只信任 JWT 解析出的用户身份，不接受业务 DTO 中的 `userId`。当前核心接口包括微信小程序登录、刷新/退出、`GET /users/me`、腾讯 POI 搜索、店铺创建/详情、记录创建/分页/详情/编辑/软删除。

## 常见问题与安全注意事项

- 缺少 Secret 无法启动：根据启动错误补齐 `.env`，不要把 `REPLACE_ME` 留在有效配置中。
- API 出现双重 `/api/v1`：客户端 Base URL 已包含前缀，服务方法只传 `/records` 之类的相对路径。
- 小程序提示找不到 `app.json`：应导入 `miniprogram/`，并确保本机 `project.config.json` 的 `miniprogramRoot` 为 `miniprogram/`。
- 地图搜索不可用：后端需配置 `TENCENT_MAP_WEB_SERVICE_KEY`；小程序不会在启动时主动申请定位。
- 不得提交 `.env`、微信真实项目配置、Android keystore、iOS 私有签名、云服务永久密钥、构建产物或日志。
- 数据库 URL、JWT、微信 code/openId、刷新令牌与云 Secret 不得写入日志。

## 文档

- [产品需求](docs/product-requirements.md)
- [页面结构](docs/page-structure.md)
- [数据库设计](docs/database-design.md)
- [API 设计](docs/api-design.md)
- [开发路线](docs/development-roadmap.md)
- [初始数据模型迁移](docs/migrations/20260715-initial-food-models.md)
- [认证与核心闭环迁移](docs/migrations/20260715-auth-and-core-flow.md)

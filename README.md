# 食迹

“食迹”是一款纯私人向的美食打卡与店铺管理产品，包含微信原生小程序、Flutter Android/iOS App、NestJS API、Prisma 和 PostgreSQL。

当前处于第三阶段：数据库模型和后端基础框架已经建立。登录、店铺、记录、地图、图片与统计等具体业务接口尚未实现。

## 项目目录

```text
backend/        NestJS + TypeScript + Prisma 后端
miniprogram/    微信原生小程序 TypeScript 项目
flutter_app/    Flutter Android/iOS 项目
docs/           已审核的产品、架构与迁移文档
infra/docker/   本地 PostgreSQL Compose 配置
```

## 前置工具

- Node.js 22 或更高版本；
- pnpm 11；
- PostgreSQL 17，或 Docker Desktop/兼容的 Docker Compose；
- Flutter 稳定版及其支持的 Dart；
- 微信开发者工具。

## 首次初始化

在仓库根目录执行：

```powershell
Copy-Item .env.example .env
pnpm install
pnpm prisma:generate
```

然后编辑被 Git 忽略的 `.env`，设置本地 PostgreSQL 密码和 `DATABASE_URL`。微信 `appSecret`、JWT Secret、腾讯位置服务 WebService Key、COS 永久凭据等敏感配置只能放在 `.env` 或部署平台密钥管理中。

## 统一启动

### 1. 启动 PostgreSQL并应用迁移

```powershell
pnpm postgres:up
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

`prisma:seed` 写入一名开发用户和三种记录状态的示例数据，可重复执行。停止数据库：

```powershell
pnpm postgres:down
```

### 2. 启动后端

```powershell
pnpm backend:dev
```

默认地址：

- 健康检查：`http://127.0.0.1:3000/api/v1/health/live`
- Swagger：`http://127.0.0.1:3000/api/docs`
- Swagger JSON：`http://127.0.0.1:3000/api/docs-json`

### 3. 启动微信小程序

```powershell
Copy-Item miniprogram/project.config.example.json miniprogram/project.config.json
```

使用微信开发者工具导入 `miniprogram/`。真实 `appId` 只写入被忽略的 `project.config.json`，服务端密钥不得写入小程序。

### 4. 启动 Flutter App

```powershell
Set-Location flutter_app
flutter pub get
flutter run
```

Android application ID 和 iOS Bundle ID 在接入微信开放平台前必须确认；keystore、签名密码和平台密钥不得提交仓库。

## 检查命令

Node、NestJS、Prisma 与小程序：

```powershell
pnpm check
```

`pnpm check` 包含格式、lint、类型检查、单元/E2E 测试、Prisma validate、一次性本地数据库迁移测试和构建。

Flutter：

```powershell
Set-Location flutter_app
dart format --output=none --set-exit-if-changed .
dart analyze
flutter test
```

单独检查和操作 Prisma：

```powershell
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate:test
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

迁移细节见 [初始美食数据模型迁移说明](docs/migrations/20260715-initial-food-models.md)。

## 文档

- [产品需求](docs/product-requirements.md)
- [页面结构](docs/page-structure.md)
- [数据库设计](docs/database-design.md)
- [API 设计](docs/api-design.md)
- [开发路线](docs/development-roadmap.md)

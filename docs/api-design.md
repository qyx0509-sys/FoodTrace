# 《食迹》API 设计（MVP）

## 1. 设计原则

- 后端使用 NestJS、TypeScript、Prisma、PostgreSQL、Swagger、JWT 和 `class-validator`。
- 小程序与 Flutter App 共用同一套 HTTPS JSON API。
- 基础路径为 `/api/v1`；Swagger JSON 为 `/api/docs-json`，交互文档为 `/api/docs`，生产环境是否公开由环境变量控制。
- 除登录、刷新和健康检查外，接口均要求 `Authorization: Bearer <accessToken>`。
- `userId` 只取自服务端验证后的 JWT，任何业务 DTO 都不接受 `userId`。
- Controller 只负责协议与 DTO，业务规则在 Service，数据隔离在 Repository/Prisma 查询中强制执行。
- API 返回稳定的英文标识，用户界面根据错误码显示中文文案。

## 2. 通用约定

### 2.1 请求头

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 受保护接口必填 | `Bearer` access token |
| `Content-Type` | 写接口必填 | `application/json` |
| `X-Request-Id` | 否 | 客户端可传 UUID；缺失时服务端生成 |
| `Idempotency-Key` | 创建记录、创建上传会话建议必填 | 客户端生成 UUID，相同用户与接口范围内去重 |
| `Accept-Language` | 否 | MVP 默认 `zh-CN` |

服务端始终返回 `X-Request-Id`。不得在日志中记录完整 `Authorization`、微信 `code`、刷新令牌、临时 COS 密钥或签名 URL。

### 2.2 成功响应

单资源：

```json
{
  "data": {
    "id": "f158fc5c-7dc3-44a1-8990-07903127aa2f"
  }
}
```

游标分页：

```json
{
  "data": {
    "items": [],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  }
}
```

删除成功使用 `204 No Content`，不返回 JSON body。

### 2.3 错误响应

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": [
      {
        "field": "overallRating",
        "reason": "must be a multiple of 0.5 between 1 and 5"
      }
    ],
    "requestId": "b9d607f8-2a0c-48bc-ab1d-992c0886493f"
  }
}
```

`message` 可面向中文用户，但客户端逻辑只能依赖稳定的 `code`。生产环境不返回堆栈、SQL、外部供应商原始响应或密钥信息。

### 2.4 状态码

| HTTP | 使用场景 |
| --- | --- |
| `200` | 查询、更新成功 |
| `201` | 创建成功 |
| `204` | 删除成功 |
| `400` | JSON 结构错误、游标无效 |
| `401` | 缺少、无效或过期认证 |
| `403` | 已认证但账号被禁用；不用于资源归属判断 |
| `404` | 资源不存在或不属于当前用户 |
| `409` | 重复记录、版本冲突、状态冲突 |
| `413` | 请求或上传对象超过允许大小 |
| `422` | 参数格式正确但不满足业务规则，例如地图范围过大 |
| `429` | 速率限制 |
| `502` | 微信、腾讯地图或 COS 上游失败 |
| `503` | 依赖暂时不可用 |

### 2.5 数据格式

- ID：UUID 字符串。
- 时间点：ISO 8601 UTC，例如 `2026-07-14T12:30:00.000Z`。
- 日期：`YYYY-MM-DD`，例如 `2026-07-14`。
- 金额和评分：JSON number；服务端使用 Decimal 处理，不用浮点数做持久化计算。
- 坐标：十进制度数，`coordinateType` 固定为 `GCJ02`。
- 空值：字段无值时返回 `null`，不使用空字符串代替。
- 未请求的扩展字段可以省略；已声明的资源字段尽量保持稳定。

### 2.6 分页与排序

- `limit` 默认 20，最小 1，最大 50。
- `cursor` 是服务端生成的不透明字符串，客户端不得解析。
- 排序使用枚举，不接受任意列名或 SQL 片段。
- 默认排序 `UPDATED_DESC`，用 `(updatedAt, id)` 保证稳定。

## 3. 认证与会话

### 3.1 Token 设计

`accessToken` 建议 15 分钟有效，`refreshToken` 建议 30 天有效，最终通过环境变量配置。JWT payload 最小化：

```json
{
  "iss": "foodtrace-api",
  "aud": "foodtrace-client",
  "sub": "user-uuid",
  "sid": "session-uuid",
  "platform": "MINI_PROGRAM",
  "iat": 1784030400,
  "exp": 1784031300
}
```

JWT 不包含微信 `openId`、`unionId`、昵称或其他个人资料。刷新令牌每次使用后轮换，数据库仅保存哈希；检测到已轮换令牌被重用时吊销对应会话。

### 3.2 小程序登录

`POST /api/v1/auth/wechat/mini-program`

Request：

```json
{
  "code": "wechat-one-time-code"
}
```

Response `200`：

```json
{
  "data": {
    "accessToken": "...",
    "accessTokenExpiresIn": 900,
    "refreshToken": "...",
    "refreshTokenExpiresIn": 2592000,
    "user": {
      "id": "26cadf01-c017-40a6-b882-dd530b227595",
      "nickname": null,
      "timezone": "Asia/Shanghai"
    }
  }
}
```

后端使用环境变量中的小程序凭据向微信交换身份。微信 `session_key` 不返回客户端、不写数据库。

### 3.3 App 微信登录

`POST /api/v1/auth/wechat/mobile`

```json
{
  "code": "wechat-oauth-code",
  "platform": "IOS"
}
```

`platform` 只允许 `ANDROID`、`IOS`。后端使用对应微信开放平台配置交换身份。只有在可验证的 `unionId` 关联条件成立时，才与既有小程序用户合并；否则创建独立用户并提示产品侧处理，不按昵称或头像猜测账号。

### 3.4 刷新与退出

| Method | Path | Auth | 说明 |
| --- | --- | --- | --- |
| `POST` | `/auth/refresh` | Refresh token | 轮换并返回一对新令牌 |
| `POST` | `/auth/logout` | Access token + Refresh token | 吊销当前会话 |

刷新 Request：

```json
{
  "refreshToken": "..."
}
```

退出接口无论会话已吊销还是首次吊销都返回 `204`，便于客户端幂等清理。

### 3.5 认证错误码

`AUTH_REQUIRED`、`ACCESS_TOKEN_EXPIRED`、`ACCESS_TOKEN_INVALID`、`REFRESH_TOKEN_INVALID`、`SESSION_REVOKED`、`USER_DISABLED`、`WECHAT_CODE_INVALID`、`WECHAT_UPSTREAM_ERROR`。

客户端收到 `ACCESS_TOKEN_EXPIRED` 时只允许一个刷新请求在飞；刷新失败则清理本地会话并回到登录页，不能无限重试。

## 4. 当前用户

### 4.1 获取资料

`GET /api/v1/me`

Response：

```json
{
  "data": {
    "id": "26cadf01-c017-40a6-b882-dd530b227595",
    "nickname": "小食客",
    "avatarUrl": null,
    "timezone": "Asia/Shanghai",
    "locale": "zh-CN",
    "createdAt": "2026-07-14T12:30:00.000Z"
  }
}
```

`avatarUrl` 若存在必须是短时签名 URL，不暴露 `objectKey`。

### 4.2 更新资料

`PATCH /api/v1/me`

```json
{
  "nickname": "小食客",
  "timezone": "Asia/Shanghai"
}
```

MVP 可只允许 `nickname` 和受支持的 `timezone`；不接受 `status`、`providerUserId` 等敏感字段。

## 5. 腾讯 POI

POI 接口是无状态代理，不把普通搜索历史写入数据库。腾讯 WebService Key 只存在于后端。

### 5.1 关键词搜索

`GET /api/v1/pois/search`

Query：

| 参数 | 必填 | 规则 |
| --- | --- | --- |
| `keyword` | 是 | 2 至 50 字符 |
| `city` | 条件必填 | 无中心点时需要城市名称或行政区码 |
| `latitude` | 否 | 与 `longitude` 同时出现，`GCJ-02` |
| `longitude` | 否 | 与 `latitude` 同时出现 |
| `radiusMeters` | 否 | 默认 5,000，最大值依据供应商配额再锁定 |
| `page` | 否 | 从 1 开始，仅映射供应商分页 |
| `limit` | 否 | 默认 20，最大 20 |

Response item：

```json
{
  "provider": "TENCENT",
  "providerPoiId": "poi-provider-id",
  "name": "示例餐厅",
  "category": "美食:中餐",
  "address": "示例路 1 号",
  "province": "上海市",
  "city": "上海市",
  "district": "黄浦区",
  "phone": null,
  "latitude": 31.2304,
  "longitude": 121.4737,
  "coordinateType": "GCJ02",
  "distanceMeters": 860,
  "existingRecord": {
    "id": "record-uuid",
    "status": "WANT_TO_GO"
  }
}
```

`existingRecord` 只查询当前用户；没有记录时为 `null`。

### 5.2 逆地址解析

`GET /api/v1/pois/reverse-geocode?latitude=...&longitude=...`

用于地图选点后补全地址。请求限流并短时缓存标准化结果；不得将不同用户的私人记录混入缓存值。

### 5.3 POI 错误码

`POI_QUERY_INVALID`、`POI_RATE_LIMITED`、`POI_UPSTREAM_TIMEOUT`、`POI_UPSTREAM_ERROR`、`LOCATION_REQUIRED`。

## 6. 记录与店铺

### 6.1 资源结构

记录详情的标准结构：

```json
{
  "id": "f158fc5c-7dc3-44a1-8990-07903127aa2f",
  "status": "VISITED",
  "store": {
    "id": "09199903-e037-4269-a392-068fddfa1780",
    "source": "TENCENT_POI",
    "providerPoiId": "poi-provider-id",
    "name": "示例餐厅",
    "category": "美食:中餐",
    "phone": null,
    "address": "示例路 1 号",
    "province": "上海市",
    "city": "上海市",
    "district": "黄浦区",
    "latitude": 31.2304,
    "longitude": 121.4737,
    "coordinateType": "GCJ02"
  },
  "overallRating": 4.5,
  "tasteRating": 5.0,
  "environmentRating": 4.0,
  "serviceRating": null,
  "perCapitaPrice": 128.00,
  "currency": "CNY",
  "visitedAt": "2026-07-14",
  "recommendedDishes": [
    { "id": "dish-uuid", "name": "红烧肉", "sortOrder": 0 }
  ],
  "avoidedDishes": [],
  "tags": [
    { "id": "tag-uuid", "name": "约会", "color": "#D97706" }
  ],
  "notes": "靠窗位置更安静。",
  "images": [
    {
      "id": "image-uuid",
      "url": "https://temporary-signed-url.example",
      "width": 1600,
      "height": 1200,
      "sortOrder": 0
    }
  ],
  "version": 3,
  "createdAt": "2026-07-14T12:30:00.000Z",
  "updatedAt": "2026-07-14T13:00:00.000Z"
}
```

响应不返回 `userId`、`objectKey` 或任何外部服务密钥。

### 6.2 创建记录

`POST /api/v1/records`

店铺使用判别联合体。腾讯 POI：

```json
{
  "store": {
    "source": "TENCENT_POI",
    "providerPoiId": "poi-provider-id"
  },
  "status": "WANT_TO_GO",
  "tagIds": []
}
```

手动店铺：

```json
{
  "store": {
    "source": "MANUAL",
    "name": "巷口小馆",
    "category": "中餐",
    "phone": null,
    "address": "示例路 2 号",
    "province": "上海市",
    "city": "上海市",
    "district": "徐汇区",
    "latitude": 31.1883,
    "longitude": 121.4365,
    "coordinateType": "GCJ02"
  },
  "status": "VISITED",
  "overallRating": 4.5,
  "tasteRating": 5.0,
  "environmentRating": 4.0,
  "serviceRating": 4.0,
  "perCapitaPrice": 88.00,
  "visitedAt": "2026-07-14",
  "recommendedDishes": ["葱油拌面"],
  "avoidedDishes": [],
  "tagIds": ["tag-uuid"],
  "notes": "午市排队较短。"
}
```

规则：

- 腾讯 POI 的名称、地址和坐标由后端重新向供应商查询或从短时可信缓存取得，不信任客户端覆盖。
- 店铺与记录在同一事务内创建或复用，不提供“只创建空店铺”的公共接口。
- `tagIds` 必须全部属于当前用户。
- 菜名数组去重并保留首次出现顺序。
- 成功返回 `201` 和完整记录。
- 同一用户同一腾讯 POI 或店铺已有记录时返回 `409 RECORD_ALREADY_EXISTS`，`details` 可包含当前用户自己的 `recordId`。
- 相同 `Idempotency-Key` 与相同请求摘要返回首次结果；键相同而 body 不同返回 `409 IDEMPOTENCY_KEY_REUSED`。

### 6.3 记录列表

`GET /api/v1/records`

| Query | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 店名、地址、菜品、标签、备注包含搜索 |
| `status` | comma-separated enum | 一个或多个状态 |
| `tagIds` | comma-separated UUID | 匹配任一标签；如需全部匹配后续增加显式参数 |
| `ratingMin`, `ratingMax` | decimal | 总体评分范围 |
| `priceMin`, `priceMax` | decimal | 人均消费范围 |
| `visitedFrom`, `visitedTo` | date | 到店日期范围 |
| `sort` | enum | `UPDATED_DESC`, `VISITED_DESC`, `RATING_DESC`, `PRICE_ASC`, `DISTANCE_ASC` |
| `latitude`, `longitude` | decimal | 距离排序时必填 |
| `cursor` | string | 不透明游标 |
| `limit` | integer | 默认 20，最大 50 |

空评分、空消费或空日期在对应排序中置后；每种排序最终用 `id` 打破平局。列表 item 返回卡片所需字段，不返回完整备注和所有图片。

### 6.4 获取记录

`GET /api/v1/records/:recordId`

仅按 `recordId + userId` 查询。资源属于其他用户、已删除或不存在均返回 `404 RECORD_NOT_FOUND`。

### 6.5 更新记录

`PATCH /api/v1/records/:recordId`

```json
{
  "status": "BLACKLISTED",
  "overallRating": 2.0,
  "tasteRating": 2.5,
  "environmentRating": null,
  "serviceRating": 1.5,
  "perCapitaPrice": 120.00,
  "visitedAt": "2026-07-14",
  "recommendedDishes": [],
  "avoidedDishes": ["示例菜"],
  "tagIds": ["tag-uuid"],
  "notes": "不再选择。",
  "version": 3
}
```

语义：

- 使用 PATCH，但出现的数组字段采用整体替换；缺失字段保持不变，显式 `null` 清空可空标量。
- `version` 必填；匹配成功后服务端递增。
- 版本不一致返回 `409 VERSION_CONFLICT`，包含当前版本号但不返回其他用户内容。
- 成功返回更新后的完整资源。

### 6.6 更新店铺快照

`PATCH /api/v1/records/:recordId/store`

```json
{
  "name": "巷口小馆（新址）",
  "category": "中餐",
  "phone": "021-00000000",
  "address": "示例路 3 号",
  "province": "上海市",
  "city": "上海市",
  "district": "徐汇区",
  "latitude": 31.1884,
  "longitude": 121.4366,
  "coordinateType": "GCJ02",
  "recordVersion": 3
}
```

修改的是个人快照，不回写腾讯 POI。更新店铺同时递增记录 `version`，使另一端的编辑能够检测冲突。

### 6.7 删除记录

`DELETE /api/v1/records/:recordId?version=3`

- `version` 必填，避免在用户正在另一端编辑时误删。
- 成功返回 `204`。
- 事务创建图片清理任务并删除业务数据；后端从此不再签发图片 URL。
- 重复删除返回 `404 RECORD_NOT_FOUND`。

### 6.8 记录错误码

`RECORD_NOT_FOUND`、`RECORD_ALREADY_EXISTS`、`VERSION_CONFLICT`、`INVALID_RATING_STEP`、`INVALID_STATUS_TRANSITION`、`TAG_NOT_FOUND`、`TOO_MANY_TAGS`、`TOO_MANY_DISHES`、`IDEMPOTENCY_KEY_REUSED`。

## 7. 标签

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/tags` | 获取当前用户标签及使用数，支持 `keyword` |
| `POST` | `/tags` | 创建标签 |
| `PATCH` | `/tags/:tagId` | 更新名称或颜色 |
| `DELETE` | `/tags/:tagId` | 删除标签及关联，不删除记录 |

创建 Request：

```json
{
  "name": "约会",
  "color": "#D97706"
}
```

名称归一化后已存在时返回 `409 TAG_ALREADY_EXISTS`，`details` 可包含当前用户自己的现有 `tagId`。更新和删除只用 `tagId + userId` 查询。

## 8. 图片上传

### 8.1 流程

```text
客户端选择并压缩图片
  -> 创建 upload session
  -> 后端签发仅允许 pending object key 的 COS 临时凭证
  -> 客户端直传私有 COS
  -> 客户端调用 complete
  -> 后端 HEAD 校验、复制到 private key、写 record_images、删除 pending object
  -> 返回短时读取 URL
```

### 8.2 创建上传会话

`POST /api/v1/records/:recordId/image-uploads`

```json
{
  "fileName": "meal.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 2456789,
  "checksum": "optional-sha256"
}
```

Response `201`：

```json
{
  "data": {
    "uploadSessionId": "upload-session-uuid",
    "bucket": "private-bucket-name",
    "region": "ap-shanghai",
    "objectKey": "pending/users/user-uuid/records/record-uuid/upload-session-uuid",
    "credentials": {
      "tmpSecretId": "temporary-id",
      "tmpSecretKey": "temporary-key",
      "sessionToken": "temporary-token",
      "startTime": 1784030400,
      "expiredTime": 1784031300
    }
  }
}
```

临时凭证有效期建议 15 分钟，只允许向响应中的精确 `objectKey` 上传，限制 MIME、大小和操作。客户端不得写日志或持久保存 `credentials`。

### 8.3 确认上传

`POST /api/v1/records/:recordId/image-uploads/:uploadSessionId/complete`

```json
{
  "width": 1600,
  "height": 1200
}
```

服务端执行：

1. 校验 session、record 和当前 `userId` 一致且未过期；
2. 用 COS `HEAD` 验证对象存在、实际大小、MIME 与必要的 checksum；
3. 检查记录当前图片数小于 9；
4. 复制到最终 `private/users/...` 键；
5. 在事务中创建 `record_images` 并标记 session 完成；
6. 删除 pending 对象，返回图片资源。

完成接口幂等：同一 session 已完成时返回既有图片；已过期返回 `409 UPLOAD_SESSION_EXPIRED`。

### 8.4 图片管理

| Method | Path | Body / Query | 说明 |
| --- | --- | --- | --- |
| `DELETE` | `/records/:recordId/images/:imageId` | `version` | 删除图片并递增记录版本 |
| `PUT` | `/records/:recordId/images/order` | `imageIds`, `version` | 全量提交当前图片 ID 顺序 |
| `POST` | `/records/:recordId/images/:imageId/url` | 无 | 签发新的短时读取 URL；也可由详情读取隐式完成 |

图片顺序请求必须恰好包含当前记录的所有图片 ID，不能包含重复或其他用户图片。

### 8.5 图片错误码

`IMAGE_LIMIT_EXCEEDED`、`IMAGE_TYPE_NOT_ALLOWED`、`IMAGE_TOO_LARGE`、`UPLOAD_SESSION_NOT_FOUND`、`UPLOAD_SESSION_EXPIRED`、`UPLOADED_OBJECT_INVALID`、`COS_UPSTREAM_ERROR`。

## 9. 地图

### 9.1 获取可视区域标记

`GET /api/v1/map/markers`

Query：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `north` | 是 | 北纬边界 |
| `south` | 是 | 南纬边界 |
| `east` | 是 | 东经边界 |
| `west` | 是 | 西经边界 |
| `status` | 否 | 一个或多个状态 |
| `tagIds` | 否 | 标签筛选 |

Response item 为轻量结构：

```json
{
  "recordId": "record-uuid",
  "storeName": "示例餐厅",
  "status": "VISITED",
  "latitude": 31.2304,
  "longitude": 121.4737,
  "overallRating": 4.5,
  "thumbnailUrl": "https://temporary-signed-url.example",
  "updatedAt": "2026-07-14T13:00:00.000Z"
}
```

最多返回 500 条。超过上限返回 `422 MAP_AREA_TOO_LARGE` 并提示缩小范围，不随机截断。所有坐标必须为 `GCJ02`。

## 10. 基础统计

`GET /api/v1/statistics/overview`

Response：

```json
{
  "data": {
    "totalRecords": 42,
    "statusCounts": {
      "wantToGo": 12,
      "visited": 27,
      "blacklisted": 3
    },
    "averageOverallRating": 4.2,
    "ratingSampleCount": 25,
    "averagePerCapitaPrice": 96.50,
    "priceSampleCount": 23,
    "topTags": [
      {
        "id": "tag-uuid",
        "name": "约会",
        "color": "#D97706",
        "recordCount": 8
      }
    ],
    "generatedAt": "2026-07-14T13:00:00.000Z"
  }
}
```

无样本时平均值为 `null` 且样本数为 0。统计只使用当前 `userId`，MVP 不接受查询其他用户或公开聚合参数。

## 11. 健康检查

| Method | Path | 认证 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/health/live` | 否 | 进程存活，不探测外部网络 |
| `GET` | `/health/ready` | 部署网络限制 | 检查数据库等必要依赖，返回脱敏状态 |

健康检查不返回环境变量、数据库地址、版本控制信息或外部服务密钥。

## 12. 校验规则摘要

| 字段 | 规则 |
| --- | --- |
| `name` | 店铺 1 至 100 字符；标签 1 至 20；菜品 1 至 50 |
| `notes` | 最多 5,000 字符，纯文本 |
| ratings | 可空；1.0 至 5.0，步长 0.5 |
| `perCapitaPrice` | 可空；0 至 99,999,999.99 |
| `latitude` | -90 至 90 |
| `longitude` | -180 至 180 |
| `tagIds` | UUID 数组，去重后最多 10 个 |
| dishes | 各类去重；具体数量上限初始化阶段锁定，建议每类 30 |
| images | 每条记录最多 9 张；单张不超过 10 MB |
| `color` | `#RRGGBB` |
| `version` | 正整数 |

Nest 全局 ValidationPipe 使用 `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`。嵌套联合 DTO 需要显式判别 `source`，不得把未知对象直接传给 Prisma。

## 13. 安全、限流与缓存

### 13.1 限流建议

实际值在压测和供应商配额确认后配置化：

- 登录：每 IP 与设备组合每分钟 10 次；
- 刷新：每会话每分钟 10 次；
- POI 搜索：每用户每分钟 30 次；
- 上传会话：每用户每分钟 20 次；
- 普通写接口：每用户每分钟 60 次。

限流 Key 不直接在日志中暴露原始 IP 或微信身份。

### 13.2 CORS 与域名

小程序配置合法 request/upload/download 域名，生产 API 只接受明确允许的来源。Flutter 原生请求不依赖浏览器 CORS，但同样只使用 HTTPS。不得使用 `*` 与凭证组合的宽松生产配置。

### 13.3 缓存头

- 认证响应：`Cache-Control: no-store`；
- 含签名图片 URL 的详情：`Cache-Control: private, no-store` 或极短缓存；
- POI 标准化结果可在服务端短时缓存，Key 只含公开查询参数；
- 私人记录不得进入共享 CDN 或跨用户缓存；
- 客户端业务缓存按 `userId` 命名空间管理。

### 13.4 外部调用

- 微信、腾讯位置服务和 COS SDK 均设置连接/响应超时。
- 只对安全的幂等调用做有限、带抖动的重试。
- 使用供应商错误映射，不透传原始响应。
- POI Key 和 COS 永久凭据仅从后端环境变量或云角色读取。

## 14. Swagger 与契约管理

- 每个 endpoint 声明认证、DTO、示例、状态码和稳定错误码。
- OpenAPI schema 是跨端契约来源；生成客户端仅作为辅助，不能替代实际契约测试。
- TypeScript 小程序可从 OpenAPI 生成基础类型，再由统一请求层封装。
- Flutter 可从 OpenAPI 生成或手写 Dio DTO；初始化阶段比较生成代码维护成本后决定。
- CI 对 OpenAPI 变更保存 diff；破坏性变更必须提升 API 版本或提供兼容期。
- Swagger 示例不得出现真实 `openId`、密钥、对象存储地址或用户内容。

## 15. API 验收标准

- Swagger 列出的 endpoint、DTO、状态码与实际行为一致。
- 所有受保护资源通过 `userId` 过滤，跨用户读写删、搜索、地图、统计和图片 URL 测试全部通过。
- DTO 能拒绝未知 `userId`、非法评分步长、超长文本、越界坐标和非 UUID。
- 创建记录幂等，版本冲突不会覆盖新数据。
- POI 与 COS 永久密钥不出现在客户端响应、构建产物和日志中。
- 临时上传凭证只能写入一个限定 pending key，完成接口会验证真实对象。
- 列表游标稳定，无重复、无遗漏，并对非法游标返回可预测错误。
- lint、类型检查、单元测试、数据库集成测试、OpenAPI 契约测试和 Nest 构建均使用真实命令执行并通过。

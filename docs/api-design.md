# 《食藏录》API 设计（当前实现）

## 1. 通用约定

- Base URL：`{CLIENT_API_BASE_URL}`，本地默认 `http://127.0.0.1:3000/api/v1`。
- 页面和业务服务只传 `/records` 等相对路径，`HttpClient` 统一拼接地址。
- 除健康检查、登录与刷新外均要求 `Authorization: Bearer <accessToken>`。
- `userId` 只从 JWT 请求上下文取得；DTO 不接受客户端传入的 `userId`。
- 日期/时间使用 ISO 8601；日期字段使用 `YYYY-MM-DD`；Decimal 在 JSON 中返回字符串，防止精度损失。
- `X-Request-Id` 由服务端生成并随响应返回。

成功响应：

```json
{
  "success": true,
  "data": {},
  "message": "ok",
  "requestId": "uuid"
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "RECORD_NOT_FOUND",
    "message": "记录不存在或已删除",
    "requestId": "uuid"
  }
}
```

分页响应的 `data`：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "hasMore": false
}
```

## 2. 认证与会话

### `POST /auth/wechat/mini/login`

使用一次性 `wx.login` code。开启 `WECHAT_MINI_LOGIN_ENABLED` 后，后端使用服务端 AppID/AppSecret 调用微信 `jscode2session`；客户端永远不会取得 AppSecret。

```json
{
  "code": "one-time-code",
  "deviceId": "installation-uuid",
  "deviceName": "WeChat Mini Program"
}
```

响应包含短期 access token、轮换 refresh token、有效秒数与当前用户。数据库只保存 refresh token 的 HMAC 哈希。

### `POST /auth/refresh`

```json
{ "refreshToken": "sessionId.secret" }
```

每次刷新撤销旧 token 并签发同一 family 的新 token。旧 token 被再次使用时，整个 family 被撤销并记录重放时间。

### `POST /auth/logout`

Bearer 鉴权，撤销当前 `sid` 对应设备会话，返回 `204`。

### `GET /users/me`

返回 JWT 当前用户的基本资料。客户端缓存的 `currentUserId` 只用于缓存命名，不参与服务端授权。

## 3. 健康检查

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/health/live` | 进程存活，不访问数据库 |
| GET | `/health/ready` | 执行 `SELECT 1`，确认数据库可用 |

## 4. 腾讯 POI 与店铺

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/pois/search` | `keyword` + 城市或经纬度；返回当前用户已有记录提示 |
| POST | `/stores/tencent` | body 为 `providerPoiId`；后端重新查询腾讯 POI 后按 `(userId,mapPoiId)` 去重 |
| POST | `/stores/manual` | 手动创建个人店铺，要求名称与 GCJ-02 经纬度 |
| GET | `/stores/:id` | 只返回当前用户店铺与其有效记录摘要 |

腾讯 WebService Key 只由后端读取。POI 搜索无配置时返回明确的 `503 MAP_NOT_CONFIGURED`，不返回假地点。

## 5. 美食记录

### `POST /records`

必填字段：

```json
{
  "clientRequestId": "uuid",
  "storeId": "uuid",
  "status": "VISITED"
}
```

可选字段包括 `overallRating`、`tasteRating`、`environmentRating`、`serviceRating`、`valueRating`、`perCapitaPrice`、`totalPrice`、`visitedAt`、`mealAt`、同行人、`summary`、`notes`、推荐/再去/收藏/草稿标志、标签与菜品。金额使用最多两位小数的字符串；评分为 1—5 且步长 0.5。

`clientRequestId` 与 `userId` 组成唯一约束，重复提交返回首次创建的记录，不会生成第二条。

### `GET /records`

Query：`page`、`pageSize`、`query`、`status`、`favorite`。固定按 `updatedAt DESC, id DESC` 排序；过滤 `deletedAt` 与草稿。

### `GET /records/:id`

按 `id + JWT userId + deletedAt` 查询。其他用户资源与不存在资源统一返回 404。

### `PATCH /records/:id`

`version` 必填，使用乐观锁并在成功后递增。标签或菜品字段缺失时保持原值，显式数组采用整体替换。

微信 `wx.request` 的正式方法枚举不含 PATCH，因此后端同时提供 `PUT /records/:id` 兼容入口，使用完全相同的 DTO、乐观锁与部分更新语义；Flutter 和通用 HTTP 客户端仍可使用 PATCH。

### `DELETE /records/:id`

软删除当前用户记录并递增版本；之后列表和详情均不可查询。客户端操作前必须二次确认。

## 6. 错误与安全

- DTO 启用 `whitelist + forbidNonWhitelisted + transform`，伪造 `userId` 等字段会被拒绝。
- 登录、刷新和 POI 搜索有进程内基础限流；生产部署需在网关增加分布式限流。
- 请求体有大小上限、统一 15 秒处理超时、Helmet、安全 CORS 白名单和生产错误隐藏。
- 日志禁止包含 JWT、refresh token、微信 code/AppSecret、数据库密码、云 Secret、完整 openId。

## 7. 尚未开放的接口

图片临时凭证、标签独立管理、地图聚合、统计、账号注销与 Flutter 微信移动端登录仍属于 P1。客户端不应在这些接口存在前展示可点击的假入口。

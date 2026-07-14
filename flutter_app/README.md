# 食迹 Flutter App

本目录是食迹 Android/iOS 客户端的 Flutter 工程，状态管理使用 Riverpod，网络层使用 Dio。

阶段 2 已使用 Flutter `3.44.6`、Dart `3.12.2` 生成 `android/` 与 `ios/` 平台目录。当前 application ID / Bundle ID 暂定为 `com.foodtrace.foodtrace_mobile`，接入微信开放平台和正式签名前必须确认最终标识。

安装依赖并检查：

```powershell
flutter pub get
dart format --output=none --set-exit-if-changed .
dart analyze
flutter test
flutter build bundle --debug --no-pub
```

Windows 上构建 APK 还需要 Android SDK；构建 iOS 产物需要 macOS、Xcode 与签名环境。不得提交 keystore、签名密码、微信 `appSecret` 或 COS 永久密钥。

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);

  return Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      contentType: Headers.jsonContentType,
      receiveTimeout: const Duration(seconds: 15),
      responseType: ResponseType.json,
      sendTimeout: const Duration(seconds: 15),
    ),
  );
});

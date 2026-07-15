import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_provider.dart';

class HealthStatus {
  const HealthStatus({required this.service, required this.timestamp});

  final String service;
  final DateTime timestamp;
}

class HealthRepository {
  const HealthRepository(this._dio);

  final Dio _dio;

  Future<HealthStatus> getLiveStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/health/live');
    final envelope = response.data;
    final data = envelope?['data'];
    if (envelope?['success'] != true || data is! Map<String, dynamic>) {
      throw const FormatException('API response is not a FoodTrace envelope');
    }
    final service = data['service'];
    final timestamp = DateTime.tryParse(data['timestamp']?.toString() ?? '');
    if (service is! String || timestamp == null) {
      throw const FormatException('Health response is incomplete');
    }
    return HealthStatus(service: service, timestamp: timestamp);
  }
}

final healthRepositoryProvider = Provider<HealthRepository>((ref) {
  return HealthRepository(ref.watch(dioProvider));
});

final healthStatusProvider = FutureProvider<HealthStatus>((ref) {
  return ref.watch(healthRepositoryProvider).getLiveStatus();
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodtrace_mobile/app/foodtrace_app.dart';
import 'package:foodtrace_mobile/features/home/data/health_repository.dart';

void main() {
  testWidgets('renders the FoodTrace shell and real service state', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          healthStatusProvider.overrideWith(
            (ref) async => HealthStatus(
              service: 'foodtrace-api',
              timestamp: DateTime(2026),
            ),
          ),
        ],
        child: const FoodTraceApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('食藏录'), findsOneWidget);
    expect(find.text('私人美食记录与店铺管理'), findsOneWidget);
    expect(find.text('食藏录服务已连接'), findsOneWidget);
  });
}

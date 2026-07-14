import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodtrace_mobile/app/foodtrace_app.dart';

void main() {
  testWidgets('renders the stage-one shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: FoodTraceApp()));

    expect(find.text('食迹'), findsOneWidget);
    expect(find.text('私人美食记录与店铺管理'), findsOneWidget);
    expect(find.textContaining('工程骨架已就绪'), findsOneWidget);
  });
}

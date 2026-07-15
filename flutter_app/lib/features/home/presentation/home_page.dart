import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/health_repository.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final health = ref.watch(healthStatusProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 44, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '食藏录',
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '私人美食记录与店铺管理',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Text(
                '想去、吃过和不再去，都只属于你的味觉档案。',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: const Color(0xFF8D7F78),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 36),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('服务连接', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 14),
                      health.when(
                        data: (_) => const Row(children: [Icon(Icons.check_circle_outline, color: Color(0xFF6F9368)), SizedBox(width: 10), Expanded(child: Text('食藏录服务已连接'))]),
                        error: (_, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('暂时无法连接服务，请确认 API 地址和网络。'),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(onPressed: () => ref.invalidate(healthStatusProvider), icon: const Icon(Icons.refresh), label: const Text('重新连接')),
                        ]),
                        loading: () => const Row(children: [SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)), SizedBox(width: 12), Text('正在连接服务…')]),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../features/home/presentation/home_page.dart';

class FoodTraceApp extends StatelessWidget {
  const FoodTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: const HomePage(),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6D5E3F)),
        scaffoldBackgroundColor: const Color(0xFFF7F7F5),
        useMaterial3: true,
      ),
      title: '食迹',
    );
  }
}

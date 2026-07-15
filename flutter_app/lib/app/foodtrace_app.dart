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
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(22)),
            side: BorderSide(color: Color(0xFFF0DDD3)),
          ),
        ),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFF05A47),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFFFF9F3),
        useMaterial3: true,
      ),
      title: '食藏录',
    );
  }
}

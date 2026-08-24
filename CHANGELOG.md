# Changelog

كل التغييرات الملحوظة في المشروع توثق هنا.
الصيغة مبنية على [Keep a Changelog](https://keepachangelog.com/) وإصدارات SemVer.

## [2.0.0-alpha.1] - 2026-08-24

### Added (المرحلة 0)
- مستودع Git جديد بهيكل معماري معياري (src/data/assets/docs/reference/tests).
- تقرير تحليلي كامل لكود v1 (`docs/ANALYSIS-v1.md`) — 12,135 سطر، 30 ملف.
- نظام إدارة مهام SagTask للمراحل التسعة (`docs/sagtask/SAGTASK-MASTER.md`).
- ملفات التوثيق الأساسية (README, CONTRIBUTING, CHANGELOG).
- نسخة احتياطية كاملة من v1 خارج المستودع: `~/minecraft-universe-x-legacy-v1`.
- نقل أصول الشخصيات (21 صورة مصدر + 20 معالجة) إلى `assets/characters/`.

### Changed
- إعادة البناء من الصفر وفق فلسفة: نمطية مطلقة، عزل اعتماديات، Event Bus، اختبار أولًا.

### Removed
- لا شيء من البيانات — الكود القديم كله محفوظ في النسخة الاحتياطية والمجلد المرجعي.

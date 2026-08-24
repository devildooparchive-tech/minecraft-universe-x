# Minecraft Universe X — v2

لعبة عالم مفتوح ثلاثية الأبعاد بنمط صناديق (Voxel)، تُبنى من الصفر بهندسة معيارية صارمة، مع نظام شخصيات وقدرات مدفوع بملفات بيانات خارجية وتحليل تلقائي لصور الشخصيات.

## الفلسفة الهندسية

1. **النمطية المطلقة** — كل نظام (World, Characters, AI, Graphics, Audio, Persistence) وحدة مستقلة قابلة للإزالة/الاستبدال.
2. **عزل الاعتماديات** — الأنظمة العليا تعتمد على `interfaces/` لا على تنفيذات Three.js مباشرة.
3. **برمجة تفاعلية** — التواصل بين الأنظمة عبر Event Bus حصريًا.
4. **اختبار أولًا** — Vitest قبل أي كود إنتاجي.

## الهيكل المستهدف

```
minecraft-universe-x/
├── src/
│   ├── core/          # أحداث، وقت، حلقة اللعبة
│   ├── interfaces/    # عقود الأنظمة (IRenderer, IPhysics...)
│   ├── world/         # بلوكات، chunks، توليد، أبعاد
│   ├── entities/      # كيانات، شخصيات، قدرات، معدات (JSON-driven)
│   ├── ai/            # state machines، behavior trees، إدراك
│   ├── renderer/      # تنفيذ Three.js خلف الواجهات
│   ├── audio/         # أصوات، موسيقى ديناميكية
│   ├── ui/            # HUD وقوائم
│   └── persistence/   # IndexedDB
├── data/              # بلوكات وشخصيات وقدرات (JSON)
├── assets/characters/ # صور المصدر + المعالجة
├── docs/              # التحليلات و SagTask والأدلة
├── reference/v1-src/  # كود الإصدار الأول (مرجع للقراءة فقط)
└── tests/             # اختبارات الوحدة والتكامل
```

## التشغيل

```bash
npm install
npm run dev      # خادم تطوير على localhost:5173
npm test         # اختبارات Vitest
npm run build    # بناء إنتاجي
```

## الوثائق

- [التقرير التحليلي لـ v1](docs/ANALYSIS-v1.md)
- [خطة المهام SagTask](docs/sagtask/SAGTASK-MASTER.md)
- [دليل المساهمة](CONTRIBUTING.md)
- [سجل التغييرات](CHANGELOG.md)

## الحالة الحالية

🔄 **المرحلة 0 — التحليل والتأسيس** (انظر SagTask)

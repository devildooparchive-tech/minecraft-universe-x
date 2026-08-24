# 🧠 تقرير الاستيعاب الشامل — فهم ماينكرافت من الجذور

> **الغرض**: تحضير إجباري قبل المرحلة 3. كل نقطة هنا ليها تطبيق مباشر في كودنا.
> التاريخ: 2026-08-24 | الحالة: بانتظار الاعتماد قبل كتابة أي كود للمرحلة 3

---

## القسم 0: ملخص المصادر المدروسة

| المصدر | ما استُخلص فعليًا |
|---|---|
| oxidized-physics (Rust) [reference:0] | بنية pipeline الفيزياء per-tick المطابقة لـ `LivingEntity.travel()` و `Entity.move()`: constants ← voxel_shape ← collision (per-axis sweep) ← tick ← slow_blocks ← jump |
| prismarine-physics (JS) [reference:2] | حالة الكيان الكاملة: `isInWater/isInLava/isInWeb/isCollidedHorizontally/jumpTicks/jumpQueued` + vector controls (forward/back/left/right/jump/sprint/sneak) |
| ثوابت الفيزياء [reference:20] | قيم مستخرجة من الفانيلا: WALK_SPEED, SPRINT_SPEED, SNEAK_SPEED=0.03, GRAVITY, HORIZONTAL/VERTICAL_DRAG, WATER/LAVA_BUOYANCY & DRAG, JUMP_POWER, DEFAULT_STEP_HEIGHT, COLLISION_EPSILON |
| Bedrock Entity Components [reference:6] | 175+ component؛ الـ behaviors بتشتغل بنظام **priority** (الأقل رقمًا يتنفذ أولًا ويحل قبل التالي)؛ component groups + events = state machine جاهزة؛ Sensors (`entity_sensor`, `environment_sensor`, `damage_sensor`) بتربط الإدراك بالأحداث |
| World Generation Overview [reference:7] | 6 passes رسمية: First (تضاريس) → Biome (مناخ ثلاثي الأبعاد بعد Caves&Cliffs) → Structure → Feature (أشجار/خامات biome-gated) → Sky → Final (spawn) |
| Noise Caves [reference:9] + SO thread [reference:21] | 3 أنواع: Cheese (كبيرة)، Spaghetti (أنفاق)، Noodle (ضيقة). الوصفة الهندسية: **تقاطع ضوضاء ridged مزدوجة** — `|A|+|B| < t` أو `A²+B² < t` حيث A,B حقول 3D |
| Vibrant Visuals [reference:10] | PBR pipeline كامل: deferred lighting، directional light مع تحكم بلون/كثافة شمس وقمر، volumetric fog، atmospheric scattering، shadows تتغير مع وقت اليوم — بدون أي تغيير gameplay (backwards-compatible) |
| Fabric Recipes [reference:13] | الصياغة data-driven 100%: كل وصفة JSON بمفتاح `"type"` يشير إلى recipe serializer؛ `RecipeManager` يديرها عبر crafting/smithing/stonecutter/anvil؛ pattern+key+result |
| Jeb's Design Principles + BYU [reference:15][reference:16] | One block at a time (حماية player agency) · لا شخصية محددة (placeholder للهوية) · ليست RPG (لا level-up من القتال) · الضرر نتيجة أفعال اللاعب مش النظام · constraints تولّد إبداع · user-centered بلا تعليمات |

---

## القسم 1: تحليل الفجوات (Gap Analysis)

### 🟢 ما نملكه ومطابق للمفاهيم الأساسية
| النظام | عندنا | في ماينكرافت | التقييم |
|---|---|---|---|
| Chunk storage | Uint8Array 16KB | ExtendedBlocks (palette) | كافية حتى نضيف >256 بلوك |
| Event Bus | حصري بين الأنظمة | لا يوجد مكافئ (coupling داخلي) | **أحسن من الأصل** |
| Biomes مناخية | حرارة×رطوبة + blend | حرارة+رطوبة+تآكل+غربة (4 أبعاد!) | أضعف — ينقصنا بعدين |
| كهوف | تقاطع ضوضائين 3D = spaghetti | cheese + spaghetti + noodle | ناقص النوعين الآخرين |
| Physics AABB | per-axis discrete @60Hz | per-axis sweep @20Hz + step height | نفس الفكرة، ناقص step-height |
| Persistence | IndexedDB + edit journal | Region files + entity NBT | مكافئ وظيفيًا |
| Data-driven blocks | JSON كامل | JSON/data-pack كامل | متطابق فلسفيًا |

### 🔴 الفجوات الحرجة (مرتبة بالخطورة)
1. **لا كيانات (Entities) أصلًا** — أكبر فجوة. ماينكرافت كل حاجة فيها entity بمكونات؛ عندنا اللاعب فقط. المرحلة 3 تعالجها.
2. **لا AI ولا Pathfinding** — لا state machines ولا sensors ولا A*. المرحلة 4.
3. **لا صياغة (Crafting)** — الخامات موجودة في الكهوف بلا هدف. data-driven recipes ضرورية لتصبح لها قيمة.
4. **فيزياء ناقصة الجودة**: لا step-up (بيعلق على بلوك واحد)، لا drag حسب البيئة، الماء binary مش حجمي، لا knockback كتل.
5. **إضاءة**: MeshLambert + ambient فقط — لا ضوء voxel منتشر، glowstone مجرد لون. ماينكرافت عندها light propagation per-block منذ 2011.
6. **التوليد أحادي المرحلة** — نولّد كل حاجة في pass واحدة؛ البنية الصح passes منفصلة (terrain→biome→structure→feature).
7. **لا أدوات/معدات رغم وجود نظام المعدات مخططًا** — hardness ثابت بلا تأثير الأدوات.

### 🟡 فجوات ثانوية
- Biomes سطحية فقط (2D climate)؛ بعد Caves&Cliffs البيومات 3D تحت الأرض [reference:8].
- الهياكل قوالب ثابتة؛ jigsaw assembly يسمح تنوع هائل [reference:7].
- لا day/night cycle، لا spawn rules زمنية.

---

## القسم 2: خريطة الطريق (Roadmap حسب أثر تجربة اللاعب)

> المعيار: ما الذي سيشعر به اللاعب خلال أول 10 دقائق لعب؟

| # | التحسين | الأثر المباشر على اللاعب | يعتمد على | المرحلة المقترحة |
|---|---|---|---|---|
| 1 | **Entity System + الشخصيات الـ19** | العالم يتجمد بدونه — أولوية مطلقة | — | 3 |
| 2 | **AI أساسي (State Machine + Sensors + Chase/Flee)** | شخصيات تتفاعل = اللعبة "حية" | #1 | 4 |
| 3 | **Step-up + تحسينات فيزياء الحركة** | إزالة أكثر إزعاج يومي (العلوق على الحواف) | — | 3.5 سريعة |
| 4 | **Crafting data-driven** | الخامات تتحول لتقدم ملموس (سيف حديد!) | خاماتنا جاهزة | 3.5 |
| 5 | **Voxel lighting (ضوء منتشر من glowstone/الشمس)** | الكهوف تظلم فعليًا، المصابيح تفيد | — | 5 |
| 6 | **Day/Night + spawn rules** | دورة خطر/أمان تخلق إيقاع لعب | #2 | 4.5 |
| 7 | **PBR materials + fog بيومي** | القفزة البصرية الكبرى | — | 5 |
| 8 | **Noodle/cheese caves + 3D biomes** | عمق استكشافي | كهوفنا جاهزة | 6 |
| 9 | **Jigsaw structures** | قرى متنوعة غير مكررة | هياكلنا جاهزة | 6 |
| 10 | **Fluids حجمية + تدفق** | ماء يجري، بحيرات تتصرف منطقيًا | — | 6 |

**المبدأ الحاكم**: كل مرحلة يجب أن تغيّر شيئًا *محسوسًا* في أول جلسة لعب.

---

## القسم 3: عشرة تحسينات نبنيها *بشكل مختلف* (وأفضل) من ماينكرافت

1. **فيزياء substepped ضد النفاذ (Tunneling-proof)**: ماينكرافت تحرك الـ AABB خطوة كاملة per-tick — سرعات عالية تنفذ الجدران. سنقسّم كل خطوة لـ substeps بحد أقصى مسافة 0.4 بلوك لكل substep → نفاذ مستحيل رياضيًا بأي سرعة.
2. **استيفاء عرض (Render interpolation) افتراضي**: ماينكرافت تشتغل بـ 20 tick/s والعرض يتقطع (jank معروف). حلقتنا fixed-timestep مع alpha interpolation جاهزة معماريًا — سنفعّلها للكيانات من أول يوم، فالحركة انسيابية 144Hz+ حتى لو المحاكاة 30Hz.
3. **ماء حجمي (Depth-aware) بدل binary**: ماينكرافت: داخل الماء أو خارجه،طفو ثابت. سنحسب عمود الماء فوق اللاعب → طفو/مقاومة متدرجة مع العمق، وتيار أفقي حسب ميل السطح.
4. **AI بالسلوك المُوزَّع (utility-based) لا بالأولويات الصارمة**: ماينكرافت priority list جامدة (الأقل رقمًا يفوز دائمًا). سنستخدم utility scoring — كل سلوك يحسب درجة رغبة لحظية (جوع×قرب طعام، خوف×قرب عدو) → انتقالات أذكى وأقل تذبذبًا.
5. **Pathfinding على مراحل (hierarchical)**: A* كامل على 64 ارتفاع مكلف. سنطبق: coarse path على أعمدة chunks ثم local steering — أسرع ×10 مع نفس النتيجة العملية.
6. **ذاكرة كيانات مكانية (spatial memory)**: sensors ماينكرافت لحظية (تنسى فورًا). كياناتنا ستخزن "آخر مكان رأت فيه اللاعب" + مهلة بحث → سلوك مطاردة مقنع (يزور آخر موقع معروف قبل الاستسلام).
7. **إضاءة hybrid**: voxel propagation للبلوكات (سريعة، تُحفظ مع chunk) + Three.js dynamic lights للقدرات المؤقتة — أفضل من الاثنين منفصلين، وحل عملي لمشكلة الأداء التي ماينكرافت تجنبها بالكامل الأول.
8. **وصفات ذات شروط سياقية**: ماينكرافت shaped/shapeless فقط. وصفاتنا ستدعم conditions: "تعمل فقط فوق y<20"، "تتطلب قرب نار" → crafting يتفاعل مع العالم لا مع شبكة 3×3 فقط.
9. **Spawn ecology**: ماينكرافت: light-level + block. سنربط spawn بسلسلة كاملة: بيوم + ارتفاع + وقت + توازن فصائل (عدد nightbrood الحالي في المنطقة يقلل spawn جديد) → بيئة حية متوازنة لا عشوائية.
10. **هياكل jigsaw مبسطة بـ JSON**: نطبق فكرة template pools [reference:7] لكن أبسط: قطع + نقاط اتصال معلنة في JSON، تجميع حتمي بالـ seed — تنوع هندسي بدون تعقيد NBT.

---

## القسم 4: تصميم الشخصيات المحسّن — ربط الـ19 بالأنظمة

### مصفوفة الربط (شخصية → AI → فصيل → بيوم spawn → قدرات مميزة)

| الشخصية | الدور | نمط AI (state machine) | الفصيل | Spawn | القدرات المحورية للتنفيذ |
|---|---|---|---|---|---|
| Titan Brute (char_01) | boss | Guard-area: idle→threat-scan→charge→slam→enrage<30%HP | ashborn | cave/jungle-temple | ground_slam (AOE بفيزياء knockback)، berserk (سرعة هجوم×2) |
| Humble Monk (char_02) | support NPC | Village-wander→heal-nearest-ally→flee-combat | verdant | village/plains نهارًا | healing_prayer (beam)، blessing aura |
| Crimson Wyrm (char_03) | legendary boss | Lair-loop (circles lair)→dive when spotted→breath cone | mythic | cave deep / dragon-lair | dragon_breath (cone hitbox)، dive_bomb (swept collision مهم!) |
| Ender Sage (char_04) | boss | Teleport-kiter: يقفز مواقع عند اقتراب اللاعب | mythic | end/temple | void_teleport (blink 8m)، gravity_well (يجذب اللاعب فيزيائيًا) |
| Ossiraptor Mk-II (char_05) | elite | Pack-hunter: يطارد مع raptors أخرى، pounce من خلف | neutral-hostile | badlands/fossil | pounce (leap arc)، servo_sprint |
| Supreme Bruin (char_06) | elite-boss | Territorial: يهدد قبل الهجوم (roar)، يقاتل قرب بيته فقط | ashborn | nether | lava_stomp (ضرر + اشتعال)، crown summons |
| Venom Behemoth (char_07) | elite-boss | Juggernaut: مشية بطيئة، لا يستدار، ضرر تصادم بالجسم | nightbrood | wasteland | tusk_impale (charge line)، poison cloud |
| Mighty Mouse (char_08) | event NPC | Arena-brawler: مباراة منظمة بمراحل | neutral | village-festival | flex buff، victory toss |
| Dark Watch (char_09) | rare warrior | Stalker: يظهر ليلًا فقط، backstab ثم يختفي | nightbrood | dark-forest ليلًا | shadow_step (teleport-behind)، smoke escape |
| Bat-Cat (char_10) | rare ally | Tameable: يهرب ثم يوثّق بالطعام، يقاتل معك | verdant | deep-cave | echolocation (يكشف خامات/أعداء عبر الجدران!) |
| Aquila Warlord (char_11) | rare warrior | Sky-patrol: يحوم، ينقض على مجموعات الأعداء | mythic | mountains | talon_dive، eagle_eye (buff دقة للاعب القريب) |
| Alley Detective (char_12) | quest NPC | Info-broker: يقترب من اللاعب، يعرض مهمة مقابل غنيمة | verdant | village/ruins | deduction (يكشف نقاط ضعف العدو UI) |
| Grinning Mechanic (char_13) | servant/trader | Workshop-trader: يقف في ورشته، يتبادل إصلاحات بغنائم | neutral | village ليلًا | repair gear، traps |
| Hollow Creeper (char_14) | elite | Ambusher: silent_stalk ثم abyssal_detonation انتحاري | nightbrood | jungle-temple/deep-dark | detonation (مع particle burst كبير)، pixel_devour (يمتص مقذوفات) |
| Burning Scholar (char_15) | elite-boss | Scholar-duel: يحتفظ بمسافة، ranged fire، يقرأ حركات اللاعب | ashborn | burning-forest | phoenix wings (fire AOE)، foresight dodge |
| Fallen Seraph (char_16) | legendary boss | Multi-phase: جناح→تشيلو shockwave→hymn debuff→judgment execute | mythic | nether-citadel | war_cello_smash (خط موجي أرضي)، seraph_judgment (x2 تحت 30% HP) |
| Lava Glutton (char_17) | elite-boss | Glutton: ينجذب للطعام المرمي، devour يمتص ويشفى | ashborn | basalt-deltas | devour (grab+lifesteal)، eruption geysers |
| Eye-Swarmed Batfiend (char_18) | elite-boss | Swarm-lord: يستدعي خفافيش، eye_burst ranged barrage | nightbrood | swamp/necro-lair | all_seeing (cannot-dodge charge)، corpse feast |
| Ender Knight (char_19) | legendary ally | Companion: يتبع اللاعب، يحميه، crystal_guard يعترض الضربات | mythic-ally | stronghold/end | ender_slash wave، crystal_guard (blocks hits) |

### قواعد التنفيذ المستخلصة من دراسة AI ماينكرافت [reference:6]
- **Priority-based goals** كبداية (أسهل): attack(1) < flee(2) < chase(3) < wander(8) < idle(9).
- **Component groups كـ state machines**: بدل if-maze، كل شخصية JSON تعرّف groups (calm/enraged/tamed) وevents تنقل بينها — نفس نمط Bedrock لكن في ملفاتنا.
- **Sensors منفصلة عن السلوك**: vision sensor (raycast مخففة كل 100ms)، damage sensor، proximity sensor — نتائجهم تخزن في memories قصيرة العمر.

---

## القسم 5: إجابة سؤال المعيار ⭐

### "إزاي هنخلي الفيزياء أحسن من ماينكرافت في ٣ نقاط محددة؟"

**1. Substepped swept collision → صفر نفاذ (Anti-tunneling)**
- ماينكرافت: `Entity.move()` يحرك الـ AABB خطوة كاملة لكل tick (50ms) — المقذوف السريع أو السقوط الطويل ينفذ الجدار (bug معروف بالمقذوفات). [reference:0][reference:2]
- عندنا: قسم المسافة المطلوبة لsubsteps لا يتجاوز كل منها 0.4 بلوك، مع نفس منطق per-axis resolution الحالي. التكلفة: loop بسيط؛ الفائدة: المقذوفات (سهام، كرات نار القدرات!) والسقوط الحر تصبح موثوقة 100%.
- **التطبيق**: داخل `physics.step()` — تقسيم dt إلى `ceil(maxDisplacement/0.4)` خطوات فرعية. ~15 سطرًا.

**2. Interpolation-first architecture → حركة ناعمة بأي framerate**
- ماينكرافت: المحاكاة 20Hz والعرض يحاول التعويض بـ partialTicks — الكيانات البعيدة ترتج (مشكلة تاريخية معروفة).
- عندنا: `GameLoop` موجود أصلاً بـ accumulator + alpha [src/core/loop.ts]. سنجعل كل كيان يحتفظ بـ `prevPosition` و`position`، والـ renderer يرسم عند `lerp(prev, curr, alpha)` → حركة كيانات ناعمة تمامًا حتى على شاشات 144Hz مع محاكاة اقتصادية 30Hz.
- **التطبيق**: حقلان + سطر lerp في الرسم لكل كيان. البنية جاهزة اليوم.

**3. Fluids بعمق حقيقي → سباحة وغرق وطرد بمقياس مستمر**
- ماينكرافت: `isInWater` boolean + ثوابت طفو واحدة [reference:20]. عمق 1 سم أو 30 متر = نفس السلوك.
- عندنا: حساب **عمود الماء فوق الرأس** (عدّ بلوكات الماء للأعلى حتى السطح):
  - الطفو يتناسب طرديًا مع العمق الغاطس (submerged ratio).
  - مقاومة أفقية أعلى في العمق (الغطس أبطأ من السباحة السطحية).
  - الغرق يبدأ فقط عندما يكون عمود الهواء فوق الرأس صفرًا (منطقنا الحالي headUnderwater يكتمل بهذا).
  - تيار خروج: عند السطح قرب حافة، دفعة أفقيًا نحو اليابسة (يمنع "حبس الماء" المزعج).
- **التطبيق**: دالة `waterColumnHeight(x,y,z)` على World (~10 أسطر) + استبدال الثوابت في Survival بمعادلات خطية.

> **الثلاثة قابلة للتنفيذ في كودنا الحالي دون كسر أي اختبار** — الأولى والثالثة تعديلان موضعيان، والثانية تفعيل لبنية قائمة.

---

## القسم 6: قرارات معمارية معتمدة للمرحلة 3 (بناءً على الدراسة)

1. **Generation passes**: سنفصل generator الحالي إلى passes مرتّبة (terrain→caves→ores→surface→trees→structures) داخل نفس الدورة — تمهيدًا لفصل Feature pass قابل للتوسعة كما في البيدروك [reference:7].
2. **Entity definitions JSON**: كل شخصية = `data/entities/<id>.json` يحوي stats/abilities refs/AI profile/spawn rules — نفس روح behavior packs [reference:6] بصيغة أنظف.
3. **Ability effects data-driven**: نوع التأثير (damage/heal/buff/summon/projectile) يُنفَّذ بـ handler عام، والمقدارات من JSON — مثل recipe serializers [reference:13].
4. **Physics constants table**: جدول ثوابت مركزي (walk/run/jump/gravity/water...) قابل للتعديل لكل dimension (nether أخف جاذبية فعلًا!) بدل magic numbers.
5. **One-block-at-a-time principle** [reference:16]: لن نبني mass-build tools — كل تفاعل لاعب = بلوك واحد، حفاظًا على agency وهويتنا كبديل أمين.

---

## حالة المعيار: ✅ مستوفى
السؤال الحاكم أُجيب بثلاث نقاط قابلة للتنفيذ مباشرة (القسم 5)، كل نقطة موثقة بمصدرها وموقع تعديلها في الكود.

**بانتظار اعتماد القائد للبدء في تنفيذ المرحلة 3.**

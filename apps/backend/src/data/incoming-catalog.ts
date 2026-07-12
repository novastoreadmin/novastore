/**
 * Партія нових товарів «Товар в дорозі» (закупівля липень 2026, AliExpress/Rozetka).
 *
 * Джерело даних для:
 *   - prepare-import.ts        → створює/оновлює категорії і генерує CSV для
 *                                Admin → Products → Import (ціни, варіанти, фото)
 *   - apply-incoming-metadata.ts → після імпорту доносить metadata (specs,
 *                                features, i18n.en, arriving) і нульові
 *                                inventory-рівні
 *
 * Правила ті самі, що в catalog.ts: базові тексти УКРАЇНСЬКОЮ, англійська в
 * metadata.i18n.en; option titles/values — англійською (функціональні
 * ідентифікатори, рендер перекладається словником storefront). Ціни — цілі
 * гривні (роздріб = закупівельна повна ціна × 2.8, узгоджено).
 *
 * `arriving: true` → storefront показує бейдж «Товар в дорозі» і вимикає
 * купівлю. Коли товар приїхав: у адмінці поставте кількість на складі та
 * приберіть arriving з metadata (або поставте false).
 */

export type IncomingProduct = {
  handle: string
  title: string
  subtitle: string
  description: string
  /** Роздрібна ціна в ЦІЛИХ гривнях (однакова для всіх варіантів — нюанси див. PRICE_REVIEW нижче). */
  priceUAH: number
  categoryHandles: string[]
  options: { title: string; values: string[] }[]
  variants: { title: string; sku: string; options?: Record<string, string> }[]
  metadata: {
    model?: string
    /** URL сторінки постачальника (для перезакупівлі). */
    source: string
    specs: { label: string; value: string }[]
    features: { title: string; description: string }[]
    arriving: true
    i18n: {
      en: {
        title: string
        subtitle: string
        description: string
        specs: { label: string; value: string }[]
        features: { title: string; description: string }[]
      }
    }
  }
}

/** Нові категорії (створює prepare-import.ts; продубльовані в catalog.ts CATEGORIES). */
export const INCOMING_CATEGORIES: { name: string; handle: string; description: string }[] = [
  { name: "Автономія", handle: "autonomy", description: "Павербанки та зарядні станції." },
  { name: "Хаби", handle: "hubs", description: "USB-C хаби, кардридери та SSD-кишені." },
  { name: "Адаптери", handle: "adapters", description: "Зарядні пристрої та мережеві адаптери." },
]

/**
 * Товари, де реальна закупівельна ціна ВАРІАНТІВ відрізняється (довші кабелі,
 * більша ємність тощо), а в CSV усі варіанти отримують базову ціну.
 * Після імпорту пройдіться по них в адмінці (Variant → Prices).
 */
export const PRICE_REVIEW_HANDLES = [
  "ugreen-nexode-air-mini",
  "ugreen-usbc-hub",
  "ugreen-rj45-splitter",
  "thunderbolt5-cable",
  "ugreen-dp21-cable",
  "ugreen-powerbank-140w",
  "powerbank-display-builtin",
  "liion-aa-charger-kit",
  "pujimax-4slot",
  // SSD: ціни варіантів (250GB–2TB) кардинально різні + закреслені ціни Ali
  // на ці позиції явно завищені — обовʼязково перевірити перед публікацією.
  "kingston-snv3-2230",
  "samsung-970-evo-plus",
  "kingston-nv3-2280",
]

/** Декартів добуток опцій → варіанти з детермінованими SKU-суфіксами. */
function grid(
  skuPrefix: string,
  options: { title: string; values: string[] }[]
): { title: string; sku: string; options: Record<string, string> }[] {
  const combos: Record<string, string>[] = options.reduce(
    (acc, opt) =>
      acc.flatMap((c) => opt.values.map((v) => ({ ...c, [opt.title]: v }))),
    [{} as Record<string, string>]
  )
  return combos.map((opts) => {
    const values = options.map((o) => opts[o.title])
    // Без обрізання: короткі коди ("With 4×AA" vs "With 4×AAA",
    // "Keychain 0.15m Gray" vs "... Silver") інакше колапсують в один SKU.
    const suffix = values
      .map((v) => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
      .join("-")
    return { title: values.join(" / "), sku: `${skuPrefix}-${suffix}`, options: opts }
  })
}

export const INCOMING_PRODUCTS: IncomingProduct[] = [
  /* ───────────────────────────── Автономія ───────────────────────────── */
  {
    handle: "charger-65w-retractable",
    title: "Зарядний пристрій 65W з висувним кабелем USB-C",
    subtitle: "Кабель завжди з собою",
    description:
      "Компактна швидка зарядка 65W із вбудованим висувним кабелем USB-C — більше не треба шукати кабель по сумці. Підтримує протоколи PD та QC3.0, заряджає смартфон, планшет чи ноутбук на максимальній швидкості. Кабель ховається в корпус одним рухом, а європейська вилка працює з будь-якою розеткою 220 В.",
    priceUAH: 1046,
    categoryHandles: ["adapters"],
    options: [{ title: "Color", values: ["White", "Black"] }],
    variants: grid("CH65R", [{ title: "Color", values: ["White", "Black"] }]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005010178258449.html",
      specs: [
        { label: "Потужність", value: "65 Вт (PD, QC3.0)" },
        { label: "Кабель", value: "Вбудований висувний USB-C" },
        { label: "Вилка", value: "EU, 220 В" },
        { label: "Порти", value: "USB-C (кабель) + USB-C" },
      ],
      features: [
        { title: "Висувний кабель", description: "Вбудований USB-C кабель ховається в корпус — нічого не загубиться." },
        { title: "65 Вт для всього", description: "Швидко заряджає смартфони, планшети та більшість ноутбуків." },
        { title: "Компактний корпус", description: "Легко вміщується в кишені й не перекриває сусідню розетку." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "65W Fast Charger with Retractable USB-C Cable",
          subtitle: "The cable is always with you",
          description:
            "A compact 65W fast charger with a built-in retractable USB-C cable — no more digging through your bag. Supports PD and QC3.0, charging phones, tablets and laptops at full speed. The cable tucks into the body in one motion, and the EU plug works with any 220V outlet.",
          specs: [
            { label: "Power", value: "65W (PD, QC3.0)" },
            { label: "Cable", value: "Built-in retractable USB-C" },
            { label: "Plug", value: "EU, 220V" },
            { label: "Ports", value: "USB-C (cable) + USB-C" },
          ],
          features: [
            { title: "Retractable Cable", description: "The built-in USB-C cable tucks away into the body — nothing to lose." },
            { title: "65W for Everything", description: "Fast-charges phones, tablets and most laptops." },
            { title: "Compact Body", description: "Pocket-friendly and doesn't block the neighboring outlet." },
          ],
        },
      },
    },
  },
  {
    handle: "charger-65w-gan",
    title: "Зарядний пристрій GaN 65W USB-C",
    subtitle: "Максимум потужності, мінімум розміру",
    description:
      "Мережевий зарядний пристрій 65W на нітриді галію (GaN): менший, холодніший і ефективніший за класичні зарядки. PD 3.0 та QC 3.0 для швидкої зарядки смартфонів, планшетів і ноутбуків з USB-C. Доступний окремо або в комплекті з кабелем USB-C 1 м.",
    priceUAH: 872,
    categoryHandles: ["adapters"],
    options: [
      { title: "Color", values: ["White", "Black"] },
      { title: "Kit", values: ["Charger only", "With 1m cable"] },
    ],
    variants: grid("CH65G", [
      { title: "Color", values: ["White", "Black"] },
      { title: "Kit", values: ["Charger only", "With 1m cable"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005010020091283.html",
      specs: [
        { label: "Потужність", value: "65 Вт" },
        { label: "Технологія", value: "GaN (нітрид галію)" },
        { label: "Протоколи", value: "PD 3.0, QC 3.0" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "GaN-ефективність", description: "Менше тепла і компактніший корпус при повних 65 Вт." },
        { title: "Універсальна сумісність", description: "iPhone, Android, iPad та ноутбуки з USB-C — одна зарядка для всього." },
        { title: "Комплект з кабелем", description: "За бажанням — одразу з якісним кабелем USB-C 1 м." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "65W GaN USB-C Wall Charger",
          subtitle: "Maximum power, minimum size",
          description:
            "A 65W gallium-nitride (GaN) wall charger: smaller, cooler and more efficient than conventional chargers. PD 3.0 and QC 3.0 fast-charge phones, tablets and USB-C laptops. Available on its own or bundled with a 1m USB-C cable.",
          specs: [
            { label: "Power", value: "65W" },
            { label: "Technology", value: "GaN (gallium nitride)" },
            { label: "Protocols", value: "PD 3.0, QC 3.0" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "GaN Efficiency", description: "Less heat and a smaller body at a full 65W." },
            { title: "Universal Compatibility", description: "iPhone, Android, iPad and USB-C laptops — one charger for all." },
            { title: "Cable Bundle", description: "Optionally comes with a quality 1m USB-C cable." },
          ],
        },
      },
    },
  },
  {
    handle: "wekome-45w-gan",
    title: "WEKOME 45W GaN зарядний пристрій, 2 порти",
    subtitle: "Складана вилка, два порти",
    description:
      "Двопортова GaN-зарядка WEKOME на 45 Вт з підтримкою PD 3.0 і PPS. Заряджає одночасно два пристрої — наприклад, смартфон і навушники. Складана європейська вилка робить її зручною супутницею в подорожах, а яскравий помаранчевий або класичний білий корпус вирізняється на полиці.",
    priceUAH: 4714,
    categoryHandles: ["adapters"],
    options: [{ title: "Color", values: ["Orange", "White"] }],
    variants: grid("WK45", [{ title: "Color", values: ["Orange", "White"] }]),
    metadata: {
      model: "WEKOME 45W",
      source: "https://www.aliexpress.com/item/1005012644784452.html",
      specs: [
        { label: "Потужність", value: "45 Вт (сумарно)" },
        { label: "Порти", value: "2 × USB-C" },
        { label: "Протоколи", value: "PD 3.0, PPS" },
        { label: "Вилка", value: "EU, складана" },
      ],
      features: [
        { title: "Два пристрої одразу", description: "Два порти USB-C — заряджайте смартфон і навушники одночасно." },
        { title: "PPS для Samsung", description: "Підтримка PPS розкриває супершвидку зарядку Galaxy." },
        { title: "Складана вилка", description: "Не дряпає речі в сумці та займає мінімум місця." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "WEKOME 45W GaN Charger, 2 Ports",
          subtitle: "Foldable plug, dual ports",
          description:
            "A dual-port 45W GaN charger from WEKOME with PD 3.0 and PPS support. Charges two devices at once — say, your phone and earbuds. The foldable EU plug makes it a great travel companion, and the vivid orange or classic white body stands out.",
          specs: [
            { label: "Power", value: "45W (total)" },
            { label: "Ports", value: "2 × USB-C" },
            { label: "Protocols", value: "PD 3.0, PPS" },
            { label: "Plug", value: "EU, foldable" },
          ],
          features: [
            { title: "Two Devices at Once", description: "Dual USB-C ports — charge your phone and earbuds simultaneously." },
            { title: "PPS for Samsung", description: "PPS support unlocks Galaxy Super Fast Charging." },
            { title: "Foldable Plug", description: "Won't scratch your gear and takes up minimal space." },
          ],
        },
      },
    },
  },
  {
    handle: "asometech-35w-led",
    title: "ASOMETECH 35W GaN зарядний пристрій з LED-дисплеєм",
    subtitle: "Бачите, скільки ват летить у телефон",
    description:
      "GaN-зарядка ASOMETECH на 35 Вт з LED-дисплеєм, який у реальному часі показує потужність зарядки. Порти USB-C і USB-A, протоколи PD, PPS та QC 3.0 — швидко заряджає iPhone, Samsung та інші пристрої. Європейська вилка, опційно в комплекті з кабелем.",
    priceUAH: 2414,
    categoryHandles: ["adapters"],
    options: [{ title: "Kit", values: ["Charger only", "With cable"] }],
    variants: grid("AS35", [{ title: "Kit", values: ["Charger only", "With cable"] }]),
    metadata: {
      model: "ASOMETECH 35W",
      source: "https://www.aliexpress.com/item/1005006678092544.html",
      specs: [
        { label: "Потужність", value: "35 Вт" },
        { label: "Дисплей", value: "LED, потужність у реальному часі" },
        { label: "Порти", value: "USB-C + USB-A" },
        { label: "Протоколи", value: "PD, PPS, QC 3.0" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "LED-дисплей", description: "Показує фактичну потужність зарядки — видно, коли телефон заряджається швидко." },
        { title: "Два порти", description: "USB-C і USB-A: сучасні й старіші кабелі працюють одночасно." },
        { title: "PPS та QC 3.0", description: "Максимальна швидкість для Samsung, Xiaomi та iPhone." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "ASOMETECH 35W GaN Charger with LED Display",
          subtitle: "See the watts flowing into your phone",
          description:
            "A 35W GaN charger from ASOMETECH with an LED display showing live charging power. USB-C and USB-A ports with PD, PPS and QC 3.0 protocols fast-charge iPhone, Samsung and more. EU plug, optionally bundled with a cable.",
          specs: [
            { label: "Power", value: "35W" },
            { label: "Display", value: "LED, real-time wattage" },
            { label: "Ports", value: "USB-C + USB-A" },
            { label: "Protocols", value: "PD, PPS, QC 3.0" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "LED Display", description: "Shows actual charging power — you can see when your phone is fast-charging." },
            { title: "Two Ports", description: "USB-C and USB-A: modern and legacy cables work side by side." },
            { title: "PPS & QC 3.0", description: "Top speeds for Samsung, Xiaomi and iPhone." },
          ],
        },
      },
    },
  },
  {
    handle: "baseus-45w-gan",
    title: "Baseus 45W GaN5 зарядний пристрій",
    subtitle: "Фірмова швидкість у чотирьох кольорах",
    description:
      "Компактна зарядка Baseus покоління GaN5 на 45 Вт. Підтримує PD і супершвидку зарядку Samsung, заряджає iPhone до 50% приблизно за пів години. Чотири кольори корпусу — білий, чорний, синій і фіолетовий — та надійна європейська вилка.",
    priceUAH: 4569,
    categoryHandles: ["adapters"],
    options: [{ title: "Color", values: ["White", "Black", "Blue", "Purple"] }],
    variants: grid("BS45", [{ title: "Color", values: ["White", "Black", "Blue", "Purple"] }]),
    metadata: {
      model: "Baseus GaN5 45W",
      source: "https://www.aliexpress.com/item/1005011551096285.html",
      specs: [
        { label: "Потужність", value: "45 Вт" },
        { label: "Технологія", value: "GaN5" },
        { label: "Протоколи", value: "PD 3.0, PPS, QC 4.0" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "Покоління GaN5", description: "Новітні чипи Baseus: холодніша й безпечніша зарядка." },
        { title: "45 Вт у кишені", description: "Вистачає для смартфона, планшета й легкого ноутбука." },
        { title: "Чотири кольори", description: "Білий, чорний, синій або фіолетовий — під ваш стиль." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Baseus 45W GaN5 Charger",
          subtitle: "Signature speed in four colors",
          description:
            "A compact 45W charger from Baseus' GaN5 generation. Supports PD and Samsung Super Fast Charging, and tops up an iPhone to ~50% in about half an hour. Four body colors — white, black, blue and purple — with a solid EU plug.",
          specs: [
            { label: "Power", value: "45W" },
            { label: "Technology", value: "GaN5" },
            { label: "Protocols", value: "PD 3.0, PPS, QC 4.0" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "GaN5 Generation", description: "Baseus' latest chips: cooler and safer charging." },
            { title: "45W in Your Pocket", description: "Enough for a phone, tablet and a light laptop." },
            { title: "Four Colors", description: "White, black, blue or purple — match your style." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-nexode-air-mini",
    title: "UGREEN Nexode Air Ultra Mini GaN зарядний пристрій",
    subtitle: "Флагманська серія в мініатюрі",
    description:
      "Надкомпактна зарядка серії UGREEN Nexode Air з підтримкою PD 3.0, QC 4.0 та PPS. Дві версії потужності — 45 Вт для смартфонів і планшетів або 65 Вт, якого вистачає й для MacBook Pro. European plug, преміальні матеріали та фірмова надійність UGREEN.",
    priceUAH: 4284,
    categoryHandles: ["adapters"],
    options: [{ title: "Model", values: ["45W", "65W"] }],
    variants: grid("UGNA", [{ title: "Model", values: ["45W", "65W"] }]),
    metadata: {
      model: "UGREEN Nexode Air",
      source: "https://www.aliexpress.com/item/1005012345939726.html",
      specs: [
        { label: "Потужність", value: "45 Вт або 65 Вт" },
        { label: "Серія", value: "Nexode Air (Ultra Mini)" },
        { label: "Протоколи", value: "PD 3.0, QC 4.0, PPS" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "Ultra Mini", description: "Одна з найкомпактніших GaN-зарядок у своєму класі потужності." },
        { title: "До 65 Вт", description: "Старша версія впевнено заряджає MacBook Pro та ультрабуки." },
        { title: "Фірмова якість UGREEN", description: "Захист від перегріву, перенапруги та короткого замикання." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN Nexode Air Ultra Mini GaN Charger",
          subtitle: "The flagship series, miniaturized",
          description:
            "An ultra-compact charger from UGREEN's Nexode Air series with PD 3.0, QC 4.0 and PPS. Two power versions — 45W for phones and tablets, or 65W with enough headroom for a MacBook Pro. EU plug, premium materials and UGREEN's signature reliability.",
          specs: [
            { label: "Power", value: "45W or 65W" },
            { label: "Series", value: "Nexode Air (Ultra Mini)" },
            { label: "Protocols", value: "PD 3.0, QC 4.0, PPS" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "Ultra Mini", description: "One of the most compact GaN chargers in its power class." },
            { title: "Up to 65W", description: "The larger version confidently charges MacBook Pro and ultrabooks." },
            { title: "UGREEN Quality", description: "Protection against overheating, overvoltage and short circuits." },
          ],
        },
      },
    },
  },
  {
    handle: "toocki-30w-retractable",
    title: "Toocki GaN 30W з висувним кабелем USB-C",
    subtitle: "Зарядка й кабель в одному",
    description:
      "GaN-зарядка Toocki на 30 Вт із вбудованим висувним кабелем USB-C. Ідеальна для iPhone та Android: PD-швидкість, акуратний білий корпус і європейська вилка. Витягніть кабель на потрібну довжину — після зарядки він сам змотається всередину.",
    priceUAH: 3439,
    categoryHandles: ["adapters"],
    options: [],
    variants: [{ title: "Default", sku: "TK30R" }],
    metadata: {
      model: "Toocki 30W",
      source: "https://www.aliexpress.com/item/1005010759553425.html",
      specs: [
        { label: "Потужність", value: "30 Вт (PD)" },
        { label: "Технологія", value: "GaN" },
        { label: "Кабель", value: "Вбудований висувний USB-C" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "Нічого не забути", description: "Кабель вбудований — зарядка завжди повністю укомплектована." },
        { title: "PD 30 Вт", description: "Швидка зарядка iPhone, Android та планшетів." },
        { title: "Самозмотування", description: "Кабель фіксується на кількох довжинах і змотується одним рухом." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Toocki GaN 30W Charger with Retractable USB-C Cable",
          subtitle: "Charger and cable in one",
          description:
            "A 30W GaN charger from Toocki with a built-in retractable USB-C cable. Perfect for iPhone and Android: PD speeds, a clean white body and an EU plug. Pull the cable out to the length you need — it winds itself back in after charging.",
          specs: [
            { label: "Power", value: "30W (PD)" },
            { label: "Technology", value: "GaN" },
            { label: "Cable", value: "Built-in retractable USB-C" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "Nothing to Forget", description: "The cable is built in — the charger is always fully equipped." },
            { title: "PD 30W", description: "Fast charging for iPhone, Android and tablets." },
            { title: "Self-Winding", description: "The cable locks at several lengths and rewinds in one motion." },
          ],
        },
      },
    },
  },
  {
    handle: "baseus-30w-gan",
    title: "Baseus 30W GaN зарядний пристрій",
    subtitle: "Маленький, та потужний",
    description:
      "Мінімалістична GaN-зарядка Baseus на 30 Вт з протоколами PD 3.0 та QC 3.0. Заряджає iPhone майже вдвічі швидше за комплектну зарядку, не гріється й не займає зайвого місця в розетці. Білий або чорний корпус, європейська вилка.",
    priceUAH: 2715,
    categoryHandles: ["adapters"],
    options: [{ title: "Color", values: ["White", "Black"] }],
    variants: grid("BS30", [{ title: "Color", values: ["White", "Black"] }]),
    metadata: {
      model: "Baseus 30W",
      source: "https://www.aliexpress.com/item/1005007010638019.html",
      specs: [
        { label: "Потужність", value: "30 Вт" },
        { label: "Технологія", value: "GaN" },
        { label: "Протоколи", value: "PD 3.0, QC 3.0" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "Компактний GaN", description: "Повні 30 Вт у корпусі, меншому за сірникову коробку." },
        { title: "Для iPhone і не тільки", description: "PD 3.0 та QC 3.0 покривають більшість смартфонів і планшетів." },
        { title: "Перевірена якість Baseus", description: "Повний набір захистів і стабільна робота роками." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Baseus 30W GaN Charger",
          subtitle: "Small but mighty",
          description:
            "A minimalist 30W GaN charger from Baseus with PD 3.0 and QC 3.0. Charges an iPhone almost twice as fast as the in-box adapter, stays cool and doesn't crowd the outlet. White or black body, EU plug.",
          specs: [
            { label: "Power", value: "30W" },
            { label: "Technology", value: "GaN" },
            { label: "Protocols", value: "PD 3.0, QC 3.0" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "Compact GaN", description: "A full 30W in a body smaller than a matchbox." },
            { title: "iPhone and Beyond", description: "PD 3.0 and QC 3.0 cover most phones and tablets." },
            { title: "Proven Baseus Quality", description: "A full protection suite and years of stable service." },
          ],
        },
      },
    },
  },
  {
    handle: "charger-4port-qc",
    title: "Зарядний пристрій на 4 порти (3×USB-A + USB-C)",
    subtitle: "Одна розетка — чотири пристрої",
    description:
      "Мережева зарядка з чотирма портами: три USB-A з QC 3.0 та один USB-C з PD. Заряджає всю родину ґаджетів з однієї розетки — смартфони, навушники, смартгодинники, павербанки. Компактний корпус у жовтому або білому кольорі, вилка EU.",
    priceUAH: 650,
    categoryHandles: ["adapters"],
    options: [{ title: "Color", values: ["Yellow", "White"] }],
    variants: grid("CH4P", [{ title: "Color", values: ["Yellow", "White"] }]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005008821439915.html",
      specs: [
        { label: "Порти", value: "3 × USB-A + 1 × USB-C" },
        { label: "Протоколи", value: "QC 3.0, PD" },
        { label: "Вилка", value: "EU, 220 В" },
      ],
      features: [
        { title: "Чотири порти", description: "Заряджайте одразу чотири пристрої з однієї розетки." },
        { title: "USB-C + USB-A", description: "Сучасний PD-порт плюс три класичні USB-A для всього іншого." },
        { title: "Яскравий акцент", description: "Соковитий жовтий або стриманий білий — на ваш смак." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "4-Port Charger (3×USB-A + USB-C)",
          subtitle: "One outlet — four devices",
          description:
            "A wall charger with four ports: three USB-A with QC 3.0 and one USB-C with PD. Charges the whole family of gadgets from a single outlet — phones, earbuds, smartwatches, power banks. Compact body in yellow or white, EU plug.",
          specs: [
            { label: "Ports", value: "3 × USB-A + 1 × USB-C" },
            { label: "Protocols", value: "QC 3.0, PD" },
            { label: "Plug", value: "EU, 220V" },
          ],
          features: [
            { title: "Four Ports", description: "Charge four devices at once from a single outlet." },
            { title: "USB-C + USB-A", description: "A modern PD port plus three classic USB-A for everything else." },
            { title: "A Pop of Color", description: "Juicy yellow or understated white — your pick." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-powerbank-10000-55w",
    title: "UGREEN павербанк 10000 мА·год 55W з дисплеєм",
    subtitle: "Швидкість ноутбучного класу",
    description:
      "Павербанк UGREEN на 10 000 мА·год з віддачею до 55 Вт — заряджає не лише смартфон, а й планшет чи легкий ноутбук. Цифровий дисплей показує точний відсоток заряду. Два порти для одночасної зарядки двох пристроїв.",
    priceUAH: 18019,
    categoryHandles: ["autonomy"],
    options: [],
    variants: [{ title: "Default", sku: "UGPB10" }],
    metadata: {
      model: "UGREEN 55W 10000",
      source: "https://www.aliexpress.com/item/1005007956125217.html",
      specs: [
        { label: "Ємність", value: "10 000 мА·год" },
        { label: "Потужність", value: "до 55 Вт" },
        { label: "Дисплей", value: "Цифровий, % заряду" },
        { label: "Порти", value: "USB-C + USB-A" },
      ],
      features: [
        { title: "55 Вт на виході", description: "Потягне планшет і навіть легкий ноутбук, не тільки смартфон." },
        { title: "Точний дисплей", description: "Відсоток заряду цифрами — жодних загадкових чотирьох крапок." },
        { title: "Два пристрої одразу", description: "USB-C і USB-A працюють одночасно." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN 10000mAh 55W Power Bank with Display",
          subtitle: "Laptop-class speed",
          description:
            "A 10,000mAh UGREEN power bank with up to 55W output — enough for a tablet or light laptop, not just your phone. The digital display shows the exact charge percentage. Two ports charge two devices at once.",
          specs: [
            { label: "Capacity", value: "10,000mAh" },
            { label: "Power", value: "up to 55W" },
            { label: "Display", value: "Digital, charge %" },
            { label: "Ports", value: "USB-C + USB-A" },
          ],
          features: [
            { title: "55W Output", description: "Handles a tablet and even a light laptop, not just a phone." },
            { title: "Precise Display", description: "Charge percentage in digits — no cryptic four dots." },
            { title: "Two at Once", description: "USB-C and USB-A work simultaneously." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-powerbank-5000",
    title: "UGREEN павербанк 5000 мА·год з вилкою USB-C",
    subtitle: "2-в-1: павербанк прямо в телефон",
    description:
      "Мініатюрний павербанк UGREEN на 5000 мА·год із вбудованим конектором USB-C — вставляється просто в телефон, без кабелю. Швидка зарядка 20 Вт, формат «брелок»: кидаєте в кишеню і забуваєте, поки не знадобиться.",
    priceUAH: 9048,
    categoryHandles: ["autonomy"],
    options: [],
    variants: [{ title: "Default", sku: "UGPB5" }],
    metadata: {
      model: "UGREEN 5000 2-in-1",
      source: "https://www.aliexpress.com/item/1005006987968852.html",
      specs: [
        { label: "Ємність", value: "5000 мА·год" },
        { label: "Потужність", value: "20 Вт (PD)" },
        { label: "Підключення", value: "Вбудований конектор USB-C" },
      ],
      features: [
        { title: "Без кабелю", description: "Вбудований USB-C вставляється просто в смартфон." },
        { title: "20 Вт швидкості", description: "PD-зарядка — iPhone оживає за лічені хвилини." },
        { title: "Кишеньковий формат", description: "Розмір запальнички: завжди з собою на чорний день." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN 5000mAh Power Bank with USB-C Plug",
          subtitle: "2-in-1: plugs right into your phone",
          description:
            "A tiny 5,000mAh UGREEN power bank with a built-in USB-C connector — it plugs straight into your phone, no cable needed. 20W fast charging in a keychain-sized format: toss it in a pocket and forget it until you need it.",
          specs: [
            { label: "Capacity", value: "5,000mAh" },
            { label: "Power", value: "20W (PD)" },
            { label: "Connection", value: "Built-in USB-C connector" },
          ],
          features: [
            { title: "No Cable", description: "The built-in USB-C plugs straight into your phone." },
            { title: "20W of Speed", description: "PD charging — an iPhone comes back to life in minutes." },
            { title: "Pocket Format", description: "Lighter-sized: always with you for a rainy day." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-powerbank-140w",
    title: "UGREEN павербанк 140W / 100W (25000 / 20000 мА·год)",
    subtitle: "Електростанція для ноутбука",
    description:
      "Флагманський павербанк UGREEN для тих, хто працює з ноутбуком далеко від розетки. Дві версії: 20 000 мА·год зі 100 Вт або 25 000 мА·год зі 140 Вт віддачі — вистачає для MacBook Pro 16″. Кілька портів, швидка зарядка самого павербанка та інформативний дисплей.",
    priceUAH: 21115,
    categoryHandles: ["autonomy"],
    options: [{ title: "Model", values: ["20000mAh 100W", "25000mAh 140W"] }],
    variants: grid("UGPB140", [{ title: "Model", values: ["20000mAh 100W", "25000mAh 140W"] }]),
    metadata: {
      model: "UGREEN 140W",
      source: "https://www.aliexpress.com/item/1005005642344316.html",
      specs: [
        { label: "Ємність", value: "20 000 / 25 000 мА·год" },
        { label: "Потужність", value: "100 Вт / 140 Вт" },
        { label: "Порти", value: "2 × USB-C + USB-A" },
        { label: "Дисплей", value: "Цифровий" },
      ],
      features: [
        { title: "До 140 Вт", description: "Заряджає MacBook Pro 16″ на повній швидкості." },
        { title: "Максимальна ємність", description: "25 000 мА·год — ліміт для ручної поклажі в літаку." },
        { title: "Три порти", description: "Ноутбук, смартфон і навушники — одночасно." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN 140W / 100W Power Bank (25000 / 20000mAh)",
          subtitle: "A power station for your laptop",
          description:
            "UGREEN's flagship power bank for working far from an outlet. Two versions: 20,000mAh at 100W or 25,000mAh at 140W output — enough for a 16-inch MacBook Pro. Multiple ports, fast self-recharging and an informative display.",
          specs: [
            { label: "Capacity", value: "20,000 / 25,000mAh" },
            { label: "Power", value: "100W / 140W" },
            { label: "Ports", value: "2 × USB-C + USB-A" },
            { label: "Display", value: "Digital" },
          ],
          features: [
            { title: "Up to 140W", description: "Charges a 16-inch MacBook Pro at full speed." },
            { title: "Maximum Capacity", description: "25,000mAh — right at the airline carry-on limit." },
            { title: "Three Ports", description: "Laptop, phone and earbuds — all at once." },
          ],
        },
      },
    },
  },
  {
    handle: "powerbank-display-builtin",
    title: "Павербанк 22.5W з вбудованими кабелями та дисплеєм",
    subtitle: "Кабелі вже всередині",
    description:
      "Павербанк з вбудованими кабелями USB-C та Lightning, цифровим дисплеєм і швидкою зарядкою 22,5 Вт. Три варіанти ємності — 20 000, 30 000 або 50 000 мА·год — від щоденних поїздок до тривалих відключень світла. Білий або чорний корпус.",
    priceUAH: 6559,
    categoryHandles: ["autonomy"],
    options: [
      { title: "Color", values: ["White", "Black"] },
      { title: "Capacity", values: ["20000mAh", "30000mAh", "50000mAh"] },
    ],
    variants: grid("PBDC", [
      { title: "Color", values: ["White", "Black"] },
      { title: "Capacity", values: ["20000mAh", "30000mAh", "50000mAh"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005009979572706.html",
      specs: [
        { label: "Ємність", value: "20 000 / 30 000 / 50 000 мА·год" },
        { label: "Потужність", value: "22,5 Вт" },
        { label: "Кабелі", value: "Вбудовані USB-C та Lightning" },
        { label: "Дисплей", value: "Цифровий, % заряду" },
      ],
      features: [
        { title: "Кабелі вбудовані", description: "USB-C і Lightning завжди на місці — нічого не треба брати окремо." },
        { title: "До 50 000 мА·год", description: "Старша версія тримає смартфон живим тиждень." },
        { title: "Чесний дисплей", description: "Точний відсоток заряду цифрами." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "22.5W Power Bank with Built-in Cables and Display",
          subtitle: "Cables already inside",
          description:
            "A power bank with built-in USB-C and Lightning cables, a digital display and 22.5W fast charging. Three capacities — 20,000, 30,000 or 50,000mAh — from daily commutes to long blackouts. White or black body.",
          specs: [
            { label: "Capacity", value: "20,000 / 30,000 / 50,000mAh" },
            { label: "Power", value: "22.5W" },
            { label: "Cables", value: "Built-in USB-C and Lightning" },
            { label: "Display", value: "Digital, charge %" },
          ],
          features: [
            { title: "Cables Built In", description: "USB-C and Lightning are always attached — nothing extra to pack." },
            { title: "Up to 50,000mAh", description: "The biggest version keeps a phone alive for a week." },
            { title: "An Honest Display", description: "Exact charge percentage in digits." },
          ],
        },
      },
    },
  },
  {
    handle: "proove-compact-station",
    title: "Proove Compact Station: зарядна станція + 8 акумуляторів",
    subtitle: "4×AA і 4×AAA завжди заряджені",
    description:
      "Зарядна станція Proove Compact Station у комплекті з вісьмома акумуляторами: 4×AA та 4×AAA. Заряджає всі вісім одночасно, живиться від USB-C. Ідеальне рішення для пультів, бездротових мишей, клавіатур і дитячих іграшок — більше жодних одноразових батарейок.",
    priceUAH: 1699,
    categoryHandles: ["autonomy"],
    options: [],
    variants: [{ title: "Default", sku: "PRV-CS8" }],
    metadata: {
      model: "Proove RBCS00000001",
      source: "https://rozetka.com.ua/ua/586014769/p586014769/",
      specs: [
        { label: "Комплект", value: "Станція + 4×AA + 4×AAA" },
        { label: "Слоти", value: "8 (одночасна зарядка)" },
        { label: "Живлення", value: "USB-C" },
        { label: "Колір", value: "Чорний" },
      ],
      features: [
        { title: "Все в комплекті", description: "Вісім акумуляторів Proove вже в коробці — працює з коробки." },
        { title: "8 слотів одночасно", description: "Зарядіть увесь запас за один цикл." },
        { title: "Живлення USB-C", description: "Працює від будь-якої зарядки чи павербанка." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Proove Compact Station: Charging Dock + 8 Batteries",
          subtitle: "4×AA and 4×AAA, always charged",
          description:
            "The Proove Compact Station bundled with eight rechargeable batteries: 4×AA and 4×AAA. Charges all eight at once and runs off USB-C. Perfect for remotes, wireless mice, keyboards and kids' toys — no more disposable batteries.",
          specs: [
            { label: "Bundle", value: "Station + 4×AA + 4×AAA" },
            { label: "Slots", value: "8 (simultaneous charging)" },
            { label: "Power", value: "USB-C" },
            { label: "Color", value: "Black" },
          ],
          features: [
            { title: "Everything Included", description: "Eight Proove batteries in the box — works out of the box." },
            { title: "8 Slots at Once", description: "Recharge your whole stock in a single cycle." },
            { title: "USB-C Powered", description: "Runs off any charger or power bank." },
          ],
        },
      },
    },
  },
  {
    handle: "pujimax-8slot",
    title: "PUJIMAX зарядна станція на 8 слотів AA/AAA",
    subtitle: "Розумна зарядка для всіх батарейок дому",
    description:
      "Розумна зарядна станція PUJIMAX на 8 слотів для Ni-MH/Ni-Cd акумуляторів: одночасно 4×AA і 4×AAA. Відкидна кришка захищає контакти, індикатори показують стан кожного слота. Живлення від USB — зручно вдома і в дорозі.",
    priceUAH: 2828,
    categoryHandles: ["autonomy"],
    options: [],
    variants: [{ title: "Default", sku: "PJ8" }],
    metadata: {
      model: "PUJIMAX 8-slot",
      source: "https://www.aliexpress.com/item/1005010089228173.html",
      specs: [
        { label: "Слоти", value: "8: 4×AA + 4×AAA" },
        { label: "Типи акумуляторів", value: "Ni-MH, Ni-Cd 1.2 В" },
        { label: "Живлення", value: "USB" },
        { label: "Індикація", value: "Послотова" },
      ],
      features: [
        { title: "8 слотів", description: "AA та AAA заряджаються одночасно, кожен слот незалежний." },
        { title: "Відкидна кришка", description: "Захищає акумулятори та контакти від пилу." },
        { title: "Розумний контроль", description: "Автоматичне завершення зарядки для кожного слота." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "PUJIMAX 8-Slot AA/AAA Charging Station",
          subtitle: "Smart charging for every battery in the house",
          description:
            "A smart 8-slot PUJIMAX charging station for Ni-MH/Ni-Cd batteries: 4×AA and 4×AAA at the same time. The flip lid protects the contacts, and per-slot indicators show each battery's status. USB-powered — handy at home and on the road.",
          specs: [
            { label: "Slots", value: "8: 4×AA + 4×AAA" },
            { label: "Battery Types", value: "Ni-MH, Ni-Cd 1.2V" },
            { label: "Power", value: "USB" },
            { label: "Indication", value: "Per slot" },
          ],
          features: [
            { title: "8 Slots", description: "AA and AAA charge together, each slot independent." },
            { title: "Flip Lid", description: "Protects batteries and contacts from dust." },
            { title: "Smart Control", description: "Automatic charge termination per slot." },
          ],
        },
      },
    },
  },
  {
    handle: "pujimax-4slot",
    title: "PUJIMAX зарядний пристрій на 4 слоти AA/AAA",
    subtitle: "Компактна станція з кабелем Type-C",
    description:
      "Компактний зарядний пристрій PUJIMAX на 4 слоти для Ni-MH/Ni-Cd акумуляторів AA та AAA. Кабель Type-C у комплекті, три конфігурації під ваші акумулятори. Індикатори стану на кожен слот.",
    priceUAH: 1492,
    categoryHandles: ["autonomy"],
    options: [{ title: "Model", values: ["For AAA", "For AA", "AA + AAA"] }],
    variants: grid("PJ4", [{ title: "Model", values: ["For AAA", "For AA", "AA + AAA"] }]),
    metadata: {
      model: "PUJIMAX 4-slot",
      source: "https://www.aliexpress.com/item/1005012153204143.html",
      specs: [
        { label: "Слоти", value: "4" },
        { label: "Типи акумуляторів", value: "Ni-MH, Ni-Cd 1.2 В (AA/AAA)" },
        { label: "Живлення", value: "USB Type-C (кабель у комплекті)" },
      ],
      features: [
        { title: "Компактний формат", description: "Розміром з колоду карт — зручно возити з собою." },
        { title: "Type-C у комплекті", description: "Живиться від звичайної зарядки телефона." },
        { title: "Індикатори стану", description: "Видно, коли акумулятори готові." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "PUJIMAX 4-Slot AA/AAA Battery Charger",
          subtitle: "Compact station with a Type-C cable",
          description:
            "A compact 4-slot PUJIMAX charger for Ni-MH/Ni-Cd AA and AAA batteries. Type-C cable included, three configurations to match your batteries. Status indicators for every slot.",
          specs: [
            { label: "Slots", value: "4" },
            { label: "Battery Types", value: "Ni-MH, Ni-Cd 1.2V (AA/AAA)" },
            { label: "Power", value: "USB Type-C (cable included)" },
          ],
          features: [
            { title: "Compact Format", description: "The size of a deck of cards — easy to travel with." },
            { title: "Type-C Included", description: "Runs off a regular phone charger." },
            { title: "Status Indicators", description: "See when your batteries are ready." },
          ],
        },
      },
    },
  },
  {
    handle: "liion-aa-charger-kit",
    title: "Зарядна станція для Li-ion акумуляторів 1.5V AA/AAA",
    subtitle: "Літієві 1.5 В — повна потужність до кінця",
    description:
      "Зарядна станція на 4 слоти для літієвих акумуляторів 1.5 В формату AA/AAA з LED-підсвіткою стану. На відміну від Ni-MH, літієві тримають рівні 1.5 В до повного розряду. Доступні комплекти з чотирма акумуляторами AA (3800 мВт·год) або AAA (3000 мВт·год), або станція окремо.",
    priceUAH: 1541,
    categoryHandles: ["autonomy"],
    options: [{ title: "Kit", values: ["With 4×AA", "With 4×AAA", "Charger only"] }],
    variants: grid("LI15", [{ title: "Kit", values: ["With 4×AA", "With 4×AAA", "Charger only"] }]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005012553509652.html",
      specs: [
        { label: "Слоти", value: "4" },
        { label: "Типи акумуляторів", value: "Li-ion 1.5 В (AA/AAA)" },
        { label: "Живлення", value: "USB Type-C" },
        { label: "Індикація", value: "LED на кожен слот" },
      ],
      features: [
        { title: "Стабільні 1.5 В", description: "Літієві акумулятори не «просідають» — прилади працюють на повну до кінця." },
        { title: "Комплект на вибір", description: "Зі станцією — 4×AA, 4×AAA або без акумуляторів." },
        { title: "Швидка зарядка", description: "USB Type-C і LED-індикатори готовності." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "1.5V Li-ion AA/AAA Battery Charging Station",
          subtitle: "1.5V lithium — full power to the last drop",
          description:
            "A 4-slot charging station for 1.5V lithium AA/AAA batteries with LED status lights. Unlike Ni-MH, lithium cells hold a steady 1.5V until fully drained. Available bundled with four AA (3800mWh) or AAA (3000mWh) batteries, or as the station alone.",
          specs: [
            { label: "Slots", value: "4" },
            { label: "Battery Types", value: "Li-ion 1.5V (AA/AAA)" },
            { label: "Power", value: "USB Type-C" },
            { label: "Indication", value: "LED per slot" },
          ],
          features: [
            { title: "Steady 1.5V", description: "Lithium cells don't sag — devices run at full power to the end." },
            { title: "Your Choice of Kit", description: "With 4×AA, 4×AAA, or the station alone." },
            { title: "Fast Charging", description: "USB Type-C with LED ready indicators." },
          ],
        },
      },
    },
  },

  /* ──────────────────────────── Хаби та адаптери ─────────────────────── */
  {
    handle: "ugreen-usbc-hub",
    title: "UGREEN USB-C хаб 4K@60Hz з PD 100W",
    subtitle: "Всі порти ноутбука — в одному",
    description:
      "USB-C хаб UGREEN з HDMI 4K@60Hz, портами USB 3.0 та наскрізною зарядкою PD 100 Вт. П'ять конфігурацій — від компактної 5-в-1 до повної 8-в-1 з RJ45 та кардридером SD/TF. Алюмінієвий корпус у кольорі вашого MacBook.",
    priceUAH: 4935,
    categoryHandles: ["hubs"],
    options: [
      { title: "Config", values: ["5-in-1 HDMI", "6-in-1 Black", "6-in-1 Purple", "7-in-1 RJ45", "8-in-1 SD/TF"] },
    ],
    variants: grid("UGHUB", [
      { title: "Config", values: ["5-in-1 HDMI", "6-in-1 Black", "6-in-1 Purple", "7-in-1 RJ45", "8-in-1 SD/TF"] },
    ]),
    metadata: {
      model: "UGREEN Hub",
      source: "https://www.aliexpress.com/item/1005007398525395.html",
      specs: [
        { label: "Відео", value: "HDMI 4K@60Hz" },
        { label: "Зарядка", value: "PD 100 Вт (passthrough)" },
        { label: "USB", value: "USB 3.0 (5 Гбіт/с)" },
        { label: "Конфігурації", value: "5/6/7/8-в-1 (RJ45, SD/TF)" },
      ],
      features: [
        { title: "4K без компромісів", description: "HDMI 4K@60Hz — плавна картинка на зовнішньому моніторі." },
        { title: "PD 100 Вт наскрізь", description: "Хаб не займає порт зарядки — ноутбук живиться через нього." },
        { title: "П'ять конфігурацій", description: "Від мінімалістичної 5-в-1 до 8-в-1 з мережею та кардридером." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN USB-C Hub 4K@60Hz with 100W PD",
          subtitle: "All your laptop's ports in one",
          description:
            "A UGREEN USB-C hub with 4K@60Hz HDMI, USB 3.0 ports and 100W PD passthrough charging. Five configurations — from a compact 5-in-1 to a full 8-in-1 with RJ45 and an SD/TF card reader. An aluminum body that matches your MacBook.",
          specs: [
            { label: "Video", value: "HDMI 4K@60Hz" },
            { label: "Charging", value: "PD 100W (passthrough)" },
            { label: "USB", value: "USB 3.0 (5Gbps)" },
            { label: "Configurations", value: "5/6/7/8-in-1 (RJ45, SD/TF)" },
          ],
          features: [
            { title: "Uncompromised 4K", description: "4K@60Hz HDMI — smooth output on an external monitor." },
            { title: "100W PD Passthrough", description: "The hub doesn't steal your charging port — the laptop powers through it." },
            { title: "Five Configurations", description: "From a minimalist 5-in-1 to an 8-in-1 with Ethernet and card reader." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-rj45-splitter",
    title: "UGREEN RJ45 спліттер 1→2",
    subtitle: "Один кабель — два пристрої",
    description:
      "Розгалужувач UGREEN RJ45 з одного порту на два. Дозволяє підключити два пристрої до однієї мережевої розетки без прокладання нового кабелю (пристрої працюють почергово, або попарно з другим спліттером). Комплекти від 2 до 10 штук.",
    priceUAH: 912,
    categoryHandles: ["adapters"],
    options: [{ title: "Pack", values: ["2 pcs", "4 pcs", "6 pcs", "8 pcs", "10 pcs"] }],
    variants: grid("UGRJ45", [{ title: "Pack", values: ["2 pcs", "4 pcs", "6 pcs", "8 pcs", "10 pcs"] }]),
    metadata: {
      model: "UGREEN RJ45 1-to-2",
      source: "https://www.aliexpress.com/item/1005006578302841.html",
      specs: [
        { label: "Тип", value: "RJ45 розгалужувач 1→2" },
        { label: "Застосування", value: "Дві лінії по одному кабелю (парою спліттерів)" },
        { label: "Комплект", value: "2–10 шт" },
      ],
      features: [
        { title: "Економія кабелю", description: "Використовуйте вже прокладений кабель для двох пристроїв." },
        { title: "Якість UGREEN", description: "Позолочені контакти та міцний корпус." },
        { title: "Гнучкі комплекти", description: "Від 2 до 10 штук — для дому чи офісу." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN RJ45 Splitter 1-to-2",
          subtitle: "One cable — two devices",
          description:
            "A UGREEN RJ45 splitter turning one port into two. Connect two devices to a single network drop without pulling new cable (devices work alternately, or in pairs with a second splitter). Packs from 2 to 10 units.",
          specs: [
            { label: "Type", value: "RJ45 splitter 1-to-2" },
            { label: "Use Case", value: "Two lines over one cable (with a splitter pair)" },
            { label: "Pack", value: "2–10 pcs" },
          ],
          features: [
            { title: "Save on Cabling", description: "Reuse an existing cable run for two devices." },
            { title: "UGREEN Quality", description: "Gold-plated contacts and a sturdy shell." },
            { title: "Flexible Packs", description: "From 2 to 10 units — for home or office." },
          ],
        },
      },
    },
  },

  /* ─────────────────────────────── Кабелі ───────────────────────────── */
  {
    handle: "thunderbolt5-cable",
    title: "Кабель Thunderbolt 5 — 120 Гбіт/с, 240W",
    subtitle: "Максимум, на що здатен USB-C",
    description:
      "Повнофункціональний кабель Thunderbolt 5: передача даних до 120 Гбіт/с, зарядка до 240 Вт і відео аж до 16K. Повністю сумісний з USB4 та Thunderbolt 4 — ідеальний для MacBook, зовнішніх SSD і моніторів високої роздільності. Довжини від 0,3 до 2 м.",
    priceUAH: 1014,
    categoryHandles: ["usb-c-cables"],
    options: [{ title: "Length", values: ["0.3m", "0.5m", "1m", "2m"] }],
    variants: grid("TB5", [{ title: "Length", values: ["0.3m", "0.5m", "1m", "2m"] }]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005012278214527.html",
      specs: [
        { label: "Стандарт", value: "Thunderbolt 5 (сумісний з USB4/TB4)" },
        { label: "Дані", value: "до 120 Гбіт/с" },
        { label: "Зарядка", value: "до 240 Вт (PD 3.1)" },
        { label: "Відео", value: "до 16K" },
      ],
      features: [
        { title: "120 Гбіт/с", description: "Зовнішній SSD працює як внутрішній — без вузьких місць." },
        { title: "240 Вт зарядки", description: "Живить найпотужніші ноутбуки через один кабель." },
        { title: "Все в одному", description: "Дані, відео та зарядка одним кабелем." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Thunderbolt 5 Cable — 120Gbps, 240W",
          subtitle: "Everything USB-C is capable of",
          description:
            "A full-featured Thunderbolt 5 cable: up to 120Gbps data, 240W charging and video up to 16K. Fully compatible with USB4 and Thunderbolt 4 — perfect for MacBooks, external SSDs and high-resolution monitors. Lengths from 0.3 to 2m.",
          specs: [
            { label: "Standard", value: "Thunderbolt 5 (USB4/TB4 compatible)" },
            { label: "Data", value: "up to 120Gbps" },
            { label: "Charging", value: "up to 240W (PD 3.1)" },
            { label: "Video", value: "up to 16K" },
          ],
          features: [
            { title: "120Gbps", description: "External SSDs run like internal ones — no bottlenecks." },
            { title: "240W Charging", description: "Powers the beefiest laptops over a single cable." },
            { title: "All in One", description: "Data, video and charging over one cable." },
          ],
        },
      },
    },
  },
  {
    handle: "hichain-240w-silicone-cable",
    title: "Hichain кабель USB-C 240W з рідкого силікону",
    subtitle: "М'який на дотик, потужний всередині",
    description:
      "Кабель USB-C — USB-C Hichain з покриттям з рідкого силікону: приємний на дотик, не плутається і не тріскається на морозі. Підтримує зарядку до 240 Вт (PD 3.1) — вистачить будь-якому ноутбуку. Сім кольорів і дві довжини.",
    priceUAH: 2572,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Light Blue", "White", "Purple", "Orange", "Black", "Pink", "Yellow"] },
      { title: "Length", values: ["1.2m", "2m"] },
    ],
    variants: grid("HC240", [
      { title: "Color", values: ["Light Blue", "White", "Purple", "Orange", "Black", "Pink", "Yellow"] },
      { title: "Length", values: ["1.2m", "2m"] },
    ]),
    metadata: {
      model: "Hichain PD240W",
      source: "https://www.aliexpress.com/item/1005010217045442.html",
      specs: [
        { label: "Зарядка", value: "до 240 Вт (PD 3.1)" },
        { label: "Матеріал", value: "Рідкий силікон" },
        { label: "Довжини", value: "1,2 м / 2 м" },
        { label: "Кольори", value: "7" },
      ],
      features: [
        { title: "240 Вт", description: "Запас потужності на роки вперед — навіть для ігрових ноутбуків." },
        { title: "Рідкий силікон", description: "Не плутається, не залишає заломів і приємний на дотик." },
        { title: "Сім кольорів", description: "Від стриманого чорного до соковитого жовтого." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Hichain 240W Liquid Silicone USB-C Cable",
          subtitle: "Soft to the touch, powerful inside",
          description:
            "A Hichain USB-C to USB-C cable coated in liquid silicone: pleasant to hold, tangle-free and crack-resistant in the cold. Supports up to 240W charging (PD 3.1) — enough for any laptop. Seven colors and two lengths.",
          specs: [
            { label: "Charging", value: "up to 240W (PD 3.1)" },
            { label: "Material", value: "Liquid silicone" },
            { label: "Lengths", value: "1.2m / 2m" },
            { label: "Colors", value: "7" },
          ],
          features: [
            { title: "240W", description: "Power headroom for years to come — even for gaming laptops." },
            { title: "Liquid Silicone", description: "Tangle-free, kink-free and lovely to the touch." },
            { title: "Seven Colors", description: "From understated black to juicy yellow." },
          ],
        },
      },
    },
  },
  {
    handle: "hdmi-coiled-8k",
    title: "Витий кабель HDMI 2.1 8K для камер і стабілізаторів",
    subtitle: "Пружина, що не заважає знімати",
    description:
      "Компактний витий HDMI-кабель стандарту 2.1 (8K) для операторських ригів: камера — монітор, камера — стабілізатор. Пружинна форма розтягується і не бовтається, кутові конектори не впираються в кліть. П'ять варіантів під різні компонування рига.",
    priceUAH: 2427,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Variant", values: ["Blue Straight", "Red Left Angle", "Right Angle", "Face to Face", "Blue Right Angle"] },
    ],
    variants: grid("HD8K", [
      { title: "Variant", values: ["Blue Straight", "Red Left Angle", "Right Angle", "Face to Face", "Blue Right Angle"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005009585504327.html",
      specs: [
        { label: "Стандарт", value: "HDMI 2.1 (8K/4K@120)" },
        { label: "Форма", value: "Вита (пружина)" },
        { label: "Конектори", value: "Прямі та кутові варіанти" },
        { label: "Застосування", value: "Камери, стабілізатори, монітори" },
      ],
      features: [
        { title: "8K сигнал", description: "HDMI 2.1 передає RAW-якість на зовнішній монітор." },
        { title: "Пружинна форма", description: "Розтягується за потреби і не звисає перед об'єктивом." },
        { title: "Кутові конектори", description: "Не впираються в кліть камери чи моторчики стабілізатора." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Coiled HDMI 2.1 8K Cable for Cameras and Gimbals",
          subtitle: "A spring that stays out of the shot",
          description:
            "A compact coiled HDMI 2.1 (8K) cable for camera rigs: camera to monitor, camera to gimbal. The spring shape stretches without dangling, and angled connectors clear the cage. Five variants for different rig layouts.",
          specs: [
            { label: "Standard", value: "HDMI 2.1 (8K/4K@120)" },
            { label: "Form", value: "Coiled (spring)" },
            { label: "Connectors", value: "Straight and angled variants" },
            { label: "Use Case", value: "Cameras, gimbals, monitors" },
          ],
          features: [
            { title: "8K Signal", description: "HDMI 2.1 carries RAW-grade quality to an external monitor." },
            { title: "Spring Form", description: "Stretches when needed and never dangles in front of the lens." },
            { title: "Angled Connectors", description: "Clear the camera cage and gimbal motors." },
          ],
        },
      },
    },
  },
  {
    handle: "hagibis-usb4-keychain",
    title: "Hagibis короткий кабель USB4 брелок — 240W, 80 Гбіт/с",
    subtitle: "Thunderbolt на ключах",
    description:
      "Короткий кабель-брелок Hagibis USB4: 240 Вт зарядки та 80 Гбіт/с даних у форматі, що висить на ключах. Сумісний з Thunderbolt 4/5 — підключайте SSD, монітор чи павербанк де завгодно. Варіанти брелока (0,15 м) чи ланярда (0,3 м), сірий або сріблястий.",
    priceUAH: 2179,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Variant", values: ["Keychain 0.15m Gray", "Keychain Gray 2 pcs", "Lanyard 0.3m Gray", "Keychain 0.15m Silver", "Keychain Silver 2 pcs", "Lanyard 0.3m Silver"] },
    ],
    variants: grid("HGUSB4", [
      { title: "Variant", values: ["Keychain 0.15m Gray", "Keychain Gray 2 pcs", "Lanyard 0.3m Gray", "Keychain 0.15m Silver", "Keychain Silver 2 pcs", "Lanyard 0.3m Silver"] },
    ]),
    metadata: {
      model: "Hagibis USB4",
      source: "https://www.aliexpress.com/item/1005008909056084.html",
      specs: [
        { label: "Стандарт", value: "USB4 (сумісний з TB4/TB5)" },
        { label: "Дані", value: "до 80 Гбіт/с" },
        { label: "Зарядка", value: "до 240 Вт" },
        { label: "Формат", value: "Брелок 0,15 м / ланярд 0,3 м" },
      ],
      features: [
        { title: "Завжди з собою", description: "Висить на ключах — кабель більше не забувається вдома." },
        { title: "Повношвидкісний", description: "80 Гбіт/с і 240 Вт — жодних компромісів через розмір." },
        { title: "Метал і нейлон", description: "Міцний корпус витримує щоденне носіння." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Hagibis Short USB4 Keychain Cable — 240W, 80Gbps",
          subtitle: "Thunderbolt on your keys",
          description:
            "A short Hagibis USB4 keychain cable: 240W charging and 80Gbps data in a form factor that hangs off your keys. Thunderbolt 4/5 compatible — hook up an SSD, monitor or power bank anywhere. Keychain (0.15m) or lanyard (0.3m), gray or silver.",
          specs: [
            { label: "Standard", value: "USB4 (TB4/TB5 compatible)" },
            { label: "Data", value: "up to 80Gbps" },
            { label: "Charging", value: "up to 240W" },
            { label: "Format", value: "Keychain 0.15m / lanyard 0.3m" },
          ],
          features: [
            { title: "Always With You", description: "Lives on your keyring — no more forgotten cables." },
            { title: "Full Speed", description: "80Gbps and 240W — no compromises for the size." },
            { title: "Metal & Nylon", description: "A rugged build that survives daily carry." },
          ],
        },
      },
    },
  },
  {
    handle: "hagibis-90-capsule",
    title: "Hagibis кутовий кабель-капсула USB-C 90°, PD 60W",
    subtitle: "Ідеальний компаньйон павербанка",
    description:
      "Мініатюрний кабель Hagibis з кутовим конектором 90° у форматі капсули — створений для павербанків: телефон з кабелем зручно лежить у руці. PD 60 Вт, три довжини (35/55/70 мм) і два кольори.",
    priceUAH: 724,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Grey", "Black"] },
      { title: "Length", values: ["35mm", "55mm", "70mm"] },
    ],
    variants: grid("HG90", [
      { title: "Color", values: ["Grey", "Black"] },
      { title: "Length", values: ["35mm", "55mm", "70mm"] },
    ]),
    metadata: {
      model: "Hagibis Capsule",
      source: "https://www.aliexpress.com/item/1005011824892024.html",
      specs: [
        { label: "Зарядка", value: "PD 60 Вт" },
        { label: "Конектор", value: "USB-C 90° (кутовий)" },
        { label: "Довжини", value: "35 / 55 / 70 мм" },
        { label: "Формат", value: "Капсула-брелок" },
      ],
      features: [
        { title: "Кут 90°", description: "Кабель не стирчить — телефон з павербанком зручно тримати однією рукою." },
        { title: "Капсула на ключі", description: "Захисний корпус-капсула кріпиться до ключів чи сумки." },
        { title: "PD 60 Вт", description: "Швидка зарядка смартфонів і планшетів." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Hagibis 90° Capsule USB-C Cable, PD 60W",
          subtitle: "The perfect power bank companion",
          description:
            "A tiny Hagibis cable with a 90° angled connector in a capsule format — made for power banks: phone and cable sit comfortably in one hand. PD 60W, three lengths (35/55/70mm) and two colors.",
          specs: [
            { label: "Charging", value: "PD 60W" },
            { label: "Connector", value: "USB-C 90° (angled)" },
            { label: "Lengths", value: "35 / 55 / 70mm" },
            { label: "Format", value: "Keychain capsule" },
          ],
          features: [
            { title: "90° Angle", description: "No protruding cable — phone plus power bank fits in one hand." },
            { title: "Capsule Carry", description: "The protective capsule clips to keys or a bag." },
            { title: "PD 60W", description: "Fast charging for phones and tablets." },
          ],
        },
      },
    },
  },
  {
    handle: "baseus-100w-cable",
    title: "Baseus кабель USB-C 100W",
    subtitle: "Класика швидкої зарядки",
    description:
      "Надійний кабель Baseus USB-C — USB-C на 100 Вт з підтримкою PD. Заряджає ноутбуки, планшети і смартфони на повній швидкості, армоване обплетення витримує тисячі згинань. Білий або чорний, 1 чи 2 метри.",
    priceUAH: 1109,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["White", "Black"] },
      { title: "Length", values: ["1m", "2m"] },
    ],
    variants: grid("BS100C", [
      { title: "Color", values: ["White", "Black"] },
      { title: "Length", values: ["1m", "2m"] },
    ]),
    metadata: {
      model: "Baseus 100W",
      source: "https://www.aliexpress.com/item/1005005912921093.html",
      specs: [
        { label: "Зарядка", value: "до 100 Вт (PD)" },
        { label: "Довжини", value: "1 м / 2 м" },
        { label: "Обплетення", value: "Армований нейлон" },
      ],
      features: [
        { title: "100 Вт", description: "Повна швидкість для MacBook, iPad та смартфонів." },
        { title: "Армований", description: "Нейлонове обплетення і посилені основи конекторів." },
        { title: "Дві довжини", description: "Метр для столу, два — для дивана." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Baseus 100W USB-C Cable",
          subtitle: "A fast-charging classic",
          description:
            "A dependable Baseus USB-C to USB-C cable rated at 100W with PD support. Charges laptops, tablets and phones at full speed, and the braided jacket survives thousands of bends. White or black, 1 or 2 meters.",
          specs: [
            { label: "Charging", value: "up to 100W (PD)" },
            { label: "Lengths", value: "1m / 2m" },
            { label: "Jacket", value: "Braided nylon" },
          ],
          features: [
            { title: "100W", description: "Full speed for MacBook, iPad and phones." },
            { title: "Reinforced", description: "Nylon braid with strengthened connector necks." },
            { title: "Two Lengths", description: "One meter for the desk, two for the couch." },
          ],
        },
      },
    },
  },
  {
    handle: "baseus-66w-usba-cable",
    title: "Baseus кабель USB-A — USB-C 66W (6A)",
    subtitle: "Швидкість для класичних зарядок",
    description:
      "Кабель Baseus USB-A — USB-C зі струмом до 6 А (66 Вт) — розкриває швидку зарядку Huawei SuperCharge, Xiaomi та інших. Ідеальний, коли зарядка чи павербанк мають лише USB-A порт. Три кольори, 1,2 або 2 метри.",
    priceUAH: 1020,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Black", "Blue", "Purple"] },
      { title: "Length", values: ["1.2m", "2m"] },
    ],
    variants: grid("BS66C", [
      { title: "Color", values: ["Black", "Blue", "Purple"] },
      { title: "Length", values: ["1.2m", "2m"] },
    ]),
    metadata: {
      model: "Baseus 6A",
      source: "https://www.aliexpress.com/item/1005007038283111.html",
      specs: [
        { label: "Зарядка", value: "до 66 Вт (6 А)" },
        { label: "Конектори", value: "USB-A → USB-C" },
        { label: "Довжини", value: "1,2 м / 2 м" },
      ],
      features: [
        { title: "6 ампер", description: "Максимум для SuperCharge/SuperVOOC через USB-A." },
        { title: "Для старих зарядок", description: "Оживіть USB-A зарядки та павербанки швидкою зарядкою." },
        { title: "Витривалий", description: "Обплетення і жорсткі основи витримують щоденне користування." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Baseus USB-A to USB-C Cable 66W (6A)",
          subtitle: "Speed for classic chargers",
          description:
            "A Baseus USB-A to USB-C cable carrying up to 6A (66W) — unlocking Huawei SuperCharge, Xiaomi turbo charging and more. Perfect when your charger or power bank only has USB-A. Three colors, 1.2 or 2 meters.",
          specs: [
            { label: "Charging", value: "up to 66W (6A)" },
            { label: "Connectors", value: "USB-A → USB-C" },
            { label: "Lengths", value: "1.2m / 2m" },
          ],
          features: [
            { title: "6 Amps", description: "The maximum for SuperCharge/SuperVOOC over USB-A." },
            { title: "For Older Chargers", description: "Give USB-A chargers and power banks a fast-charging upgrade." },
            { title: "Durable", description: "Braided jacket and stiff necks survive daily use." },
          ],
        },
      },
    },
  },
  {
    handle: "nylon-braided-usbc-cable",
    title: "Нейлоновий кабель USB-C у кольорах",
    subtitle: "Кольоровий акцент на робочому столі",
    description:
      "Плетений нейлоновий кабель USB-C — USB-C зі швидкою зарядкою PD у семи соковитих кольорах — від айворі до хакі. Три довжини (1/1,5/2 м) для столу, ліжка чи подорожей. Матеріал не плутається і виглядає значно дорожче за свою ціну.",
    priceUAH: 684,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Yellow", "Blue", "Army Green", "Ivory", "Orange", "Pink", "Purple"] },
      { title: "Length", values: ["1m", "1.5m", "2m"] },
    ],
    variants: grid("NBC", [
      { title: "Color", values: ["Yellow", "Blue", "Army Green", "Ivory", "Orange", "Pink", "Purple"] },
      { title: "Length", values: ["1m", "1.5m", "2m"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005010514258460.html",
      specs: [
        { label: "Зарядка", value: "PD швидка зарядка" },
        { label: "Матеріал", value: "Плетений нейлон" },
        { label: "Довжини", value: "1 / 1,5 / 2 м" },
        { label: "Кольори", value: "7" },
      ],
      features: [
        { title: "Сім кольорів", description: "Підберіть кабель під сетап — або під настрій." },
        { title: "Плетений нейлон", description: "Не плутається і не зношується на згинах." },
        { title: "Три довжини", description: "Від акуратного метра до вільних двох." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Nylon Braided USB-C Cable in Colors",
          subtitle: "A color accent for your desk",
          description:
            "A braided nylon USB-C to USB-C cable with PD fast charging in seven juicy colors — from ivory to army green. Three lengths (1/1.5/2m) for the desk, bed or travel. It doesn't tangle and looks far pricier than it is.",
          specs: [
            { label: "Charging", value: "PD fast charging" },
            { label: "Material", value: "Braided nylon" },
            { label: "Lengths", value: "1 / 1.5 / 2m" },
            { label: "Colors", value: "7" },
          ],
          features: [
            { title: "Seven Colors", description: "Match your setup — or your mood." },
            { title: "Braided Nylon", description: "Tangle-free and bend-resistant." },
            { title: "Three Lengths", description: "From a tidy meter to a roomy two." },
          ],
        },
      },
    },
  },
  {
    handle: "hagibis-240w-cap-cable",
    title: "Hagibis кабель USB-C 240W із захисним ковпачком",
    subtitle: "PD 3.1 з турботою про конектор",
    description:
      "Кабель Hagibis USB-C — USB-C на 240 Вт (PD 3.1) із захисним ковпачком, що вберігає конектор від пилу та бруду. Є магнітні версії, де ковпачок примагнічується до кабелю й не губиться. Три довжини — від кишенькових 0,25 м до 2 м.",
    priceUAH: 1826,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Variant", values: ["Black Orange", "Black White", "White Green", "Magnet Black Orange", "Magnet Silver", "Magnet Black Green"] },
      { title: "Length", values: ["0.25m", "1.2m", "2m"] },
    ],
    variants: grid("HG240", [
      { title: "Variant", values: ["Black Orange", "Black White", "White Green", "Magnet Black Orange", "Magnet Silver", "Magnet Black Green"] },
      { title: "Length", values: ["0.25m", "1.2m", "2m"] },
    ]),
    metadata: {
      model: "Hagibis 240W",
      source: "https://www.aliexpress.com/item/1005008559014625.html",
      specs: [
        { label: "Зарядка", value: "до 240 Вт (PD 3.1)" },
        { label: "Особливість", value: "Захисний ковпачок (є магнітні версії)" },
        { label: "Довжини", value: "0,25 / 1,2 / 2 м" },
      ],
      features: [
        { title: "Ковпачок-захисник", description: "Конектор не збирає пил у сумці чи кишені." },
        { title: "Магнітна версія", description: "Ковпачок примагнічується до кабелю — не загубиться." },
        { title: "240 Вт", description: "Флагманська потужність PD 3.1 для будь-якої техніки." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Hagibis 240W USB-C Cable with Protective Cap",
          subtitle: "PD 3.1 that cares for its connector",
          description:
            "A Hagibis USB-C to USB-C cable rated 240W (PD 3.1) with a protective cap that keeps dust and grime off the connector. Magnetic versions snap the cap onto the cable so it never gets lost. Three lengths — from a pocketable 0.25m to 2m.",
          specs: [
            { label: "Charging", value: "up to 240W (PD 3.1)" },
            { label: "Special", value: "Protective cap (magnetic versions available)" },
            { label: "Lengths", value: "0.25 / 1.2 / 2m" },
          ],
          features: [
            { title: "Guardian Cap", description: "The connector stays clean in bags and pockets." },
            { title: "Magnetic Version", description: "The cap snaps onto the cable — never lost." },
            { title: "240W", description: "Flagship PD 3.1 power for any device." },
          ],
        },
      },
    },
  },
  {
    handle: "ugreen-dp21-cable",
    title: "UGREEN кабель DisplayPort 2.1 (16K) / 1.4 (8K)",
    subtitle: "Для моніторів, що випереджають час",
    description:
      "Відеокабель UGREEN DisplayPort у двох версіях: DP 1.4 з підтримкою 8K та флагманський DP 2.1 аж до 16K і 4K@240 Гц. Вибір кіберспортсменів і власників моніторів високої частоти. Довжини 1, 2 і 3 метри.",
    priceUAH: 2545,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Version", values: ["8K DP 1.4", "16K DP 2.1"] },
      { title: "Length", values: ["1m", "2m", "3m"] },
    ],
    variants: grid("UGDP", [
      { title: "Version", values: ["8K DP 1.4", "16K DP 2.1"] },
      { title: "Length", values: ["1m", "2m", "3m"] },
    ]),
    metadata: {
      model: "UGREEN DP2.1",
      source: "https://www.aliexpress.com/item/1005005477933540.html",
      specs: [
        { label: "Версії", value: "DP 1.4 (8K) / DP 2.1 (16K)" },
        { label: "Частота", value: "до 4K@240 Гц (DP 2.1)" },
        { label: "Довжини", value: "1 / 2 / 3 м" },
      ],
      features: [
        { title: "До 16K", description: "DP 2.1 — запас пропускної здатності на покоління вперед." },
        { title: "240 Гц у 4K", description: "Кіберспортивна плавність без компресії." },
        { title: "Екранування UGREEN", description: "Стабільний сигнал навіть на 3 метрах." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN DisplayPort 2.1 (16K) / 1.4 (8K) Cable",
          subtitle: "For monitors ahead of their time",
          description:
            "A UGREEN DisplayPort video cable in two versions: DP 1.4 with 8K support, and flagship DP 2.1 reaching 16K and 4K@240Hz. The choice of esports players and high-refresh monitor owners. Lengths of 1, 2 and 3 meters.",
          specs: [
            { label: "Versions", value: "DP 1.4 (8K) / DP 2.1 (16K)" },
            { label: "Refresh", value: "up to 4K@240Hz (DP 2.1)" },
            { label: "Lengths", value: "1 / 2 / 3m" },
          ],
          features: [
            { title: "Up to 16K", description: "DP 2.1 — bandwidth headroom for a generation ahead." },
            { title: "240Hz at 4K", description: "Esports smoothness without compression." },
            { title: "UGREEN Shielding", description: "A stable signal even at 3 meters." },
          ],
        },
      },
    },
  },
  {
    handle: "cat6-short-patch",
    title: "Короткий патч-корд CAT6 (0,2–0,5 м)",
    subtitle: "Порядок у стійці та на столі",
    description:
      "Короткі мережеві кабелі CAT6 для акуратної комутації: роутер — світч, світч — NAS. Довжини 0,2, 0,3 і 0,5 м прибирають зайві петлі кабелю, а три кольори допомагають маркувати лінії.",
    priceUAH: 67,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Orange", "Blue", "Gray"] },
      { title: "Length", values: ["0.2m", "0.3m", "0.5m"] },
    ],
    variants: grid("CAT6", [
      { title: "Color", values: ["Orange", "Blue", "Gray"] },
      { title: "Length", values: ["0.2m", "0.3m", "0.5m"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005004208543524.html",
      specs: [
        { label: "Категорія", value: "CAT6 (до 1 Гбіт/с)" },
        { label: "Довжини", value: "0,2 / 0,3 / 0,5 м" },
        { label: "Кольори", value: "Помаранчевий, синій, сірий" },
      ],
      features: [
        { title: "Без петель", description: "Рівно та точна довжина для сусідніх пристроїв." },
        { title: "Кольорове маркування", description: "Три кольори — легко відстежити, що куди йде." },
        { title: "Чесний CAT6", description: "Стабільний гігабіт для роутера, світча й NAS." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Short CAT6 Patch Cord (0.2–0.5m)",
          subtitle: "Tidy racks and desks",
          description:
            "Short CAT6 network cables for clean interconnects: router to switch, switch to NAS. Lengths of 0.2, 0.3 and 0.5m eliminate cable loops, and three colors help label your lines.",
          specs: [
            { label: "Category", value: "CAT6 (up to 1Gbps)" },
            { label: "Lengths", value: "0.2 / 0.3 / 0.5m" },
            { label: "Colors", value: "Orange, blue, gray" },
          ],
          features: [
            { title: "No Loops", description: "Neat, exact lengths for neighboring devices." },
            { title: "Color Coding", description: "Three colors make it easy to trace what goes where." },
            { title: "Honest CAT6", description: "Stable gigabit for router, switch and NAS." },
          ],
        },
      },
    },
  },
  {
    handle: "paracord-keyboard-cable",
    title: "Кастомний витий кабель для клавіатури (паракорд + PET)",
    subtitle: "Ручна робота з авіаконектором GX16",
    description:
      "Витий кабель ручної роботи для механічних клавіатур: паракорд плюс PET-обплетення, рознімний авіаційний конектор GX16 і десяток розцвіток. USB-A — USB-C, довжина 1,2 м плюс 15 см спіралі. Фінальний штрих кастомного сетапа.",
    priceUAH: 5438,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["Black Silver", "Red", "White", "Blue", "Purple Pink", "Black", "Dark Gray", "Orange", "Green"] },
    ],
    variants: grid("KBPC", [
      { title: "Color", values: ["Black Silver", "Red", "White", "Blue", "Purple Pink", "Black", "Dark Gray", "Orange", "Green"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005006152017933.html",
      specs: [
        { label: "Конектори", value: "USB-A → USB-C + авіаконектор GX16" },
        { label: "Матеріал", value: "Паракорд + PET-обплетення" },
        { label: "Довжина", value: "1,2 м + 15 см спіраль" },
        { label: "Виробництво", value: "Ручна робота" },
      ],
      features: [
        { title: "Авіаконектор GX16", description: "Рознімний металевий конектор — фішка кастомних клавіатур." },
        { title: "Подвійне обплетення", description: "Паракорд усередині, глянцевий PET зверху." },
        { title: "Ручна збірка", description: "Кожен кабель скручено і зшито вручну." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Custom Coiled Keyboard Cable (Paracord + PET)",
          subtitle: "Handmade with a GX16 aviator connector",
          description:
            "A handmade coiled cable for mechanical keyboards: paracord plus PET sleeving, a detachable GX16 aviator connector and a dozen colorways. USB-A to USB-C, 1.2m plus a 15cm coil. The finishing touch for a custom setup.",
          specs: [
            { label: "Connectors", value: "USB-A → USB-C + GX16 aviator" },
            { label: "Material", value: "Paracord + PET sleeving" },
            { label: "Length", value: "1.2m + 15cm coil" },
            { label: "Craft", value: "Handmade" },
          ],
          features: [
            { title: "GX16 Aviator", description: "The detachable metal connector — a custom keyboard signature." },
            { title: "Double Sleeved", description: "Paracord inside, glossy PET on top." },
            { title: "Hand Assembled", description: "Every cable is coiled and finished by hand." },
          ],
        },
      },
    },
  },
  {
    handle: "lano-keyboard-cable",
    title: "LANO витий кабель для клавіатури з GX16, 1,5 м",
    subtitle: "Дванадцять розцвіток на вибір",
    description:
      "Витий кабель LANO для механічних клавіатур з подвійним обплетенням і рознімним авіаконектором GX16. USB-A — USB-C, загальна довжина 1,5 м. Дванадцять розцвіток — від монохрому до сміливих поєднань.",
    priceUAH: 3260,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Colorway", values: ["D3", "D4", "D5", "D6", "D14", "D15", "D16", "D17", "D27", "D32", "D37", "D38"] },
    ],
    variants: grid("KBLN", [
      { title: "Colorway", values: ["D3", "D4", "D5", "D6", "D14", "D15", "D16", "D17", "D27", "D32", "D37", "D38"] },
    ]),
    metadata: {
      model: "LANO GX16",
      source: "https://www.aliexpress.com/item/1005008097787653.html",
      specs: [
        { label: "Конектори", value: "USB-A → USB-C + авіаконектор GX16" },
        { label: "Обплетення", value: "Подвійне" },
        { label: "Довжина", value: "1,5 м" },
        { label: "Розцвіток", value: "12" },
      ],
      features: [
        { title: "12 розцвіток", description: "Кожен знайде варіант під свій кейкап-сет." },
        { title: "GX16", description: "Металевий рознімний конектор посередині кабелю." },
        { title: "Подвійне обплетення", description: "Щільна спіраль тримає форму роками." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "LANO Coiled Keyboard Cable with GX16, 1.5m",
          subtitle: "Twelve colorways to choose from",
          description:
            "A LANO coiled cable for mechanical keyboards with double sleeving and a detachable GX16 aviator connector. USB-A to USB-C, 1.5m total. Twelve colorways — from monochrome to bold combos.",
          specs: [
            { label: "Connectors", value: "USB-A → USB-C + GX16 aviator" },
            { label: "Sleeving", value: "Double" },
            { label: "Length", value: "1.5m" },
            { label: "Colorways", value: "12" },
          ],
          features: [
            { title: "12 Colorways", description: "A match for every keycap set." },
            { title: "GX16", description: "A metal detachable connector mid-cable." },
            { title: "Double Sleeved", description: "The tight coil holds its shape for years." },
          ],
        },
      },
    },
  },
  {
    handle: "coiled-keyboard-cable",
    title: "Витий кабель USB-C для клавіатури з авіаконектором",
    subtitle: "Стиль кастом-сцени за розумні гроші",
    description:
      "Витий кабель для механічних клавіатур з подвійним обплетенням і металевим рознімним авіаконектором. Шість розцвіток, включно з поєднаннями на кшталт чорного із золотом. USB-C з боку клавіатури.",
    priceUAH: 1302,
    categoryHandles: ["usb-c-cables"],
    options: [
      { title: "Color", values: ["White", "Army Green", "Black", "Black Gold", "Dark Red", "Purple Green"] },
    ],
    variants: grid("KBCL", [
      { title: "Color", values: ["White", "Army Green", "Black", "Black Gold", "Dark Red", "Purple Green"] },
    ]),
    metadata: {
      source: "https://www.aliexpress.com/item/1005007231902007.html",
      specs: [
        { label: "Конектори", value: "USB-A → USB-C + авіаконектор" },
        { label: "Обплетення", value: "Подвійне" },
        { label: "Розцвіток", value: "6" },
      ],
      features: [
        { title: "Авіаконектор", description: "Металевий рознім — вигляд дорогого кастома." },
        { title: "Шість розцвіток", description: "Від чистого білого до чорного із золотом." },
        { title: "Пружна спіраль", description: "Тримає форму і не провисає над столом." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Coiled USB-C Keyboard Cable with Aviator Connector",
          subtitle: "Custom-scene style at a sensible price",
          description:
            "A coiled cable for mechanical keyboards with double sleeving and a metal detachable aviator connector. Six colorways, including combos like black and gold. USB-C on the keyboard side.",
          specs: [
            { label: "Connectors", value: "USB-A → USB-C + aviator" },
            { label: "Sleeving", value: "Double" },
            { label: "Colorways", value: "6" },
          ],
          features: [
            { title: "Aviator Connector", description: "The metal coupler — the look of an expensive custom." },
            { title: "Six Colorways", description: "From clean white to black and gold." },
            { title: "Springy Coil", description: "Holds its shape and never sags over the desk." },
          ],
        },
      },
    },
  },

  /* ─────────────────────────────── Пам'ять ──────────────────────────── */
  {
    handle: "kingston-snv3-2230",
    title: "Kingston SNV3 NVMe SSD M.2 2230 (PCIe 4.0)",
    subtitle: "Апгрейд для Steam Deck і ультрабуків",
    description:
      "Компактний NVMe SSD Kingston SNV3 у форматі M.2 2230 — саме такий стоїть у Steam Deck, ROG Ally та Surface. Інтерфейс PCIe 4.0 дає швидкості до 6000 МБ/с, а односторонній дизайн гарантує сумісність із тонкими пристроями. Ємності від 500 ГБ до 2 ТБ.",
    priceUAH: 49012,
    categoryHandles: ["memory"],
    options: [{ title: "Capacity", values: ["500GB", "1TB", "2TB"] }],
    variants: grid("KSNV3", [{ title: "Capacity", values: ["500GB", "1TB", "2TB"] }]),
    metadata: {
      model: "Kingston SNV3",
      source: "https://www.aliexpress.com/item/1005011986772598.html",
      specs: [
        { label: "Формат", value: "M.2 2230 (компактний)" },
        { label: "Інтерфейс", value: "PCIe 4.0 x4, NVMe" },
        { label: "Швидкість", value: "до 6000 МБ/с" },
        { label: "Ємності", value: "500 ГБ / 1 ТБ / 2 ТБ" },
      ],
      features: [
        { title: "Формат 2230", description: "Влазить туди, куди звичайний SSD не поміститься: Steam Deck, ROG Ally, Surface." },
        { title: "PCIe 4.0", description: "До 6000 МБ/с — ігри та проєкти відкриваються миттєво." },
        { title: "До 2 ТБ", description: "Вся бібліотека ігор в кишеньковій консолі." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Kingston SNV3 NVMe SSD M.2 2230 (PCIe 4.0)",
          subtitle: "The upgrade for Steam Deck and ultrabooks",
          description:
            "A compact Kingston SNV3 NVMe SSD in the M.2 2230 format — the same size used by Steam Deck, ROG Ally and Surface. The PCIe 4.0 interface delivers up to 6000MB/s, and the single-sided design guarantees fit in thin devices. Capacities from 500GB to 2TB.",
          specs: [
            { label: "Form Factor", value: "M.2 2230 (compact)" },
            { label: "Interface", value: "PCIe 4.0 x4, NVMe" },
            { label: "Speed", value: "up to 6000MB/s" },
            { label: "Capacities", value: "500GB / 1TB / 2TB" },
          ],
          features: [
            { title: "2230 Form Factor", description: "Fits where a regular SSD can't: Steam Deck, ROG Ally, Surface." },
            { title: "PCIe 4.0", description: "Up to 6000MB/s — games and projects open instantly." },
            { title: "Up to 2TB", description: "Your whole game library in a handheld." },
          ],
        },
      },
    },
  },
  {
    handle: "samsung-970-evo-plus",
    title: "Samsung 970 EVO Plus NVMe SSD M.2",
    subtitle: "Легендарна надійність Samsung",
    description:
      "Samsung 970 EVO Plus — перевірений роками NVMe SSD із фірмовою памʼяттю V-NAND та контролером Phoenix. Послідовне читання до 3500 МБ/с, висока витривалість і легендарна стабільність. Ємності від 250 ГБ до 2 ТБ — для робочих станцій, ігрових ПК і ноутбуків.",
    priceUAH: 17004,
    categoryHandles: ["memory"],
    options: [{ title: "Capacity", values: ["250GB", "500GB", "1TB", "2TB"] }],
    variants: grid("S970EP", [{ title: "Capacity", values: ["250GB", "500GB", "1TB", "2TB"] }]),
    metadata: {
      model: "Samsung 970 EVO Plus",
      source: "https://www.aliexpress.com/item/1005006620333612.html",
      specs: [
        { label: "Формат", value: "M.2 2280" },
        { label: "Інтерфейс", value: "PCIe 3.0 x4, NVMe" },
        { label: "Швидкість", value: "до 3500 МБ/с (читання)" },
        { label: "Памʼять", value: "Samsung V-NAND 3-bit MLC" },
        { label: "Ємності", value: "250 ГБ – 2 ТБ" },
      ],
      features: [
        { title: "Фірмовий V-NAND", description: "Памʼять і контролер Samsung — все власного виробництва." },
        { title: "Витривалість", description: "До 1200 TBW у старших ємностях — вистачить на роки." },
        { title: "Перевірена класика", description: "Один із найпопулярніших NVMe SSD в історії — недарма." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Samsung 970 EVO Plus NVMe SSD M.2",
          subtitle: "Samsung's legendary reliability",
          description:
            "The Samsung 970 EVO Plus — a time-tested NVMe SSD with Samsung's own V-NAND memory and Phoenix controller. Sequential reads up to 3500MB/s, high endurance and legendary stability. Capacities from 250GB to 2TB — for workstations, gaming PCs and laptops.",
          specs: [
            { label: "Form Factor", value: "M.2 2280" },
            { label: "Interface", value: "PCIe 3.0 x4, NVMe" },
            { label: "Speed", value: "up to 3500MB/s (read)" },
            { label: "Memory", value: "Samsung V-NAND 3-bit MLC" },
            { label: "Capacities", value: "250GB – 2TB" },
          ],
          features: [
            { title: "In-house V-NAND", description: "Samsung memory and controller — everything made in-house." },
            { title: "Endurance", description: "Up to 1200 TBW on larger capacities — years of headroom." },
            { title: "A Proven Classic", description: "One of the most popular NVMe SSDs ever — for good reason." },
          ],
        },
      },
    },
  },
  {
    handle: "kingston-nv3-2280",
    title: "Kingston NV3 NVMe SSD M.2 2280 (PCIe 4.0)",
    subtitle: "6000 МБ/с за розумні гроші",
    description:
      "Kingston NV3 — NVMe SSD четвертого покоління у стандартному форматі M.2 2280 зі швидкостями до 6000 МБ/с. Оптимальний апгрейд для ПК і ноутбуків: холодний, тихий, без зайвих переплат. Ємності 500 ГБ, 1 ТБ та 2 ТБ.",
    priceUAH: 17513,
    categoryHandles: ["memory"],
    options: [{ title: "Capacity", values: ["500GB", "1TB", "2TB"] }],
    variants: grid("KNV3", [{ title: "Capacity", values: ["500GB", "1TB", "2TB"] }]),
    metadata: {
      model: "Kingston NV3",
      source: "https://www.aliexpress.com/item/1005007791079105.html",
      specs: [
        { label: "Формат", value: "M.2 2280" },
        { label: "Інтерфейс", value: "PCIe 4.0 x4, NVMe" },
        { label: "Швидкість", value: "до 6000 МБ/с (читання)" },
        { label: "Ємності", value: "500 ГБ / 1 ТБ / 2 ТБ" },
      ],
      features: [
        { title: "PCIe 4.0 для всіх", description: "Швидкості четвертого покоління без флагманського цінника." },
        { title: "Холодний і тихий", description: "Енергоефективний контролер не потребує масивного радіатора." },
        { title: "Простий апгрейд", description: "Стандартний 2280 стає в будь-який сучасний ПК чи ноутбук." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "Kingston NV3 NVMe SSD M.2 2280 (PCIe 4.0)",
          subtitle: "6000MB/s at a sensible price",
          description:
            "The Kingston NV3 — a fourth-generation NVMe SSD in the standard M.2 2280 format with speeds up to 6000MB/s. The sweet-spot upgrade for PCs and laptops: cool, quiet, no flagship markup. Capacities of 500GB, 1TB and 2TB.",
          specs: [
            { label: "Form Factor", value: "M.2 2280" },
            { label: "Interface", value: "PCIe 4.0 x4, NVMe" },
            { label: "Speed", value: "up to 6000MB/s (read)" },
            { label: "Capacities", value: "500GB / 1TB / 2TB" },
          ],
          features: [
            { title: "PCIe 4.0 for Everyone", description: "Fourth-gen speeds without the flagship price tag." },
            { title: "Cool & Quiet", description: "An efficient controller that doesn't need a bulky heatsink." },
            { title: "Easy Upgrade", description: "Standard 2280 fits any modern PC or laptop." },
          ],
        },
      },
    },
  },

  /* ────────────────────────────── Аксесуари ─────────────────────────── */
  {
    handle: "ugreen-smart-finder",
    title: "UGREEN Bluetooth-трекер для Apple Find My",
    subtitle: "Знаходьте речі через Локатор",
    description:
      "Bluetooth-трекер UGREEN, повністю сумісний з мережею Apple Find My («Локатор»). Причепіть до ключів, сумки чи валізи — мільйони пристроїв Apple допоможуть знайти річ будь-де у світі. Змінна батарейка, гучний сигнал пошуку. Працює лише з iOS.",
    priceUAH: 3524,
    categoryHandles: ["accessories"],
    options: [],
    variants: [{ title: "Default", sku: "UGTAG" }],
    metadata: {
      model: "UGREEN Smart Finder",
      source: "https://www.aliexpress.com/item/1005008349940884.html",
      specs: [
        { label: "Мережа", value: "Apple Find My (лише iOS)" },
        { label: "Батарея", value: "Змінна CR2032" },
        { label: "Кріплення", value: "Отвір під кільце для ключів" },
      ],
      features: [
        { title: "Мережа Find My", description: "Мільйони пристроїв Apple анонімно допомагають у пошуку." },
        { title: "Рік від батарейки", description: "Стандартна CR2032 міняється за секунди." },
        { title: "Гучний пошук", description: "Дзвінкий сигнал допоможе знайти ключі під подушкою." },
      ],
      arriving: true,
      i18n: {
        en: {
          title: "UGREEN Bluetooth Tracker for Apple Find My",
          subtitle: "Find your things via Find My",
          description:
            "A UGREEN Bluetooth tracker fully compatible with Apple's Find My network. Clip it to keys, a bag or a suitcase — millions of Apple devices help locate it anywhere in the world. Replaceable battery, loud finding chime. iOS only.",
          specs: [
            { label: "Network", value: "Apple Find My (iOS only)" },
            { label: "Battery", value: "Replaceable CR2032" },
            { label: "Mount", value: "Keyring hole" },
          ],
          features: [
            { title: "Find My Network", description: "Millions of Apple devices anonymously help with the search." },
            { title: "A Year per Battery", description: "A standard CR2032 swaps in seconds." },
            { title: "Loud Finding", description: "A ringing chime uncovers keys under the couch cushions." },
          ],
        },
      },
    },
  },
]

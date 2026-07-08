/**
 * NOVA store catalog (real Hagibis accessory products).
 *
 * Single source of truth for both the seed (`seed.ts`) and the live importer
 * (`import-products.ts`). Images are the files downloaded by
 * `scripts/download-product-images.sh` into `static/products/<handle>/` and are
 * served by the backend at `${MEDUSA_BACKEND_URL}/static/products/<handle>/<file>`.
 *
 * LANGUAGES: the base fields (title/subtitle/description/specs/features and
 * category name/description) are UKRAINIAN — that is what Medusa stores and what
 * the storefront shows by default. The English text lives in
 * `metadata.i18n.en`; the storefront swaps it in when the visitor switches the
 * site language to EN (see apps/storefront/src/lib/catalog-i18n.ts).
 *
 * NOTE: Hagibis does not expose prices publicly, so the `priceCents` values below
 * are reasonable USD estimates per product type. The store sells in the Ukrainian
 * region (UAH), so they are converted to hryvnia at seed/import time via
 * `toStoreMinor()` — adjust the estimates or `UAH_PER_USD` as needed.
 */
import fs from "fs"
import path from "path"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/** The store's default selling currency (ISO 4217, lowercase as Medusa expects). */
export const STORE_CURRENCY = "uah"

/**
 * Hryvnia per US dollar. Used only to derive UAH list prices from the USD
 * estimates in this catalog — set this to your real pricing or replace the
 * per-product amounts outright.
 */
export const UAH_PER_USD = 41

/**
 * Convert a USD amount in cents to whole UAH.
 * Medusa admin displays stored amounts as-is for UAH (no /100 division),
 * so we store whole hryvnias to keep admin and storefront consistent.
 */
export const toStoreMinor = (usdCents: number) => Math.round((usdCents / 100) * UAH_PER_USD)

export type Spec = { label: string; value: string }
export type Feature = { title: string; description: string }

/** Per-language override of the display fields (used for `metadata.i18n.en`). */
export type CatalogProductTranslation = {
  title: string
  subtitle: string
  description: string
  specs: Spec[]
  features: Feature[]
}

export type CatalogProduct = {
  handle: string
  title: string
  subtitle: string
  description: string
  priceCents: number
  categoryHandles: string[]
  options: { title: string; values: string[] }[]
  variants: { title: string; sku: string; options?: Record<string, string> }[]
  metadata: {
    model: string
    specs: Spec[]
    features: Feature[]
    i18n: { en: CatalogProductTranslation }
  }
}

export const CATEGORIES: {
  name: string
  handle: string
  description: string
}[] = [
  { name: "Кардридери", handle: "card-readers", description: "Яскраві компактні кардридери для SD та microSD." },
  { name: "SSD-кишені", handle: "ssd-enclosures", description: "Ультратонкі та легкі кишені для M.2 NVMe SSD." },
  { name: "Пам'ять", handle: "memory", description: "Портативні накопичувачі великої ємності та швидкості." },
  { name: "Кабелі USB-C", handle: "usb-c-cables", description: "Гнучкі та витривалі швидкісні кабелі USB-C." },
  { name: "Аксесуари", handle: "accessories", description: "Багатофункціональні аксесуари на щодень." },
]

export const PRODUCTS: CatalogProduct[] = [
  {
    handle: "dkq04",
    title: "Кардридер SD/Micro SD 4.0 у стилі дискети",
    subtitle: "Ретро-вигляд, сучасна швидкість",
    description:
      "Ретро-кардридер, натхненний дизайном дискет 1990-х. Одночасно читає картки SD і Micro SD на швидкостях SD 4.0 (теоретично до 312 МБ/с), а захисний чип GL забезпечує стабільну передачу даних. Суцільноалюмінієвий корпус розсіює тепло — при товщині 8 мм і вазі 31 г кардридер зручно причепити до рюкзака.",
    priceCents: 2599,
    categoryHandles: ["card-readers"],
    options: [],
    variants: [{ title: "Default", sku: "DKQ04" }],
    metadata: {
      model: "DKQ04",
      specs: [
        { label: "Інтерфейс", value: "SD 4.0 (UHS-II)" },
        { label: "Макс. швидкість", value: "312 МБ/с (теоретично)" },
        { label: "Слоти", value: "SD + Micro SD (одночасно)" },
        { label: "Корпус", value: "Суцільний алюміній" },
        { label: "Товщина", value: "8 мм" },
        { label: "Вага", value: "31 г" },
      ],
      features: [
        { title: "Два слоти одночасно", description: "Читайте SD і Micro SD одночасно та скидайте матеріал швидше." },
        { title: "Швидкості SD 4.0", description: "До 312 МБ/с теоретично, зі зворотною сумісністю з SD 3.0 / UHS-I." },
        { title: "Не перегрівається", description: "Суцільноалюмінієвий корпус розсіює тепло під час тривалих передач." },
      ],
      i18n: {
        en: {
          title: "Floppy Disk Style SD/Micro SD 4.0 Card Reader",
          subtitle: "Retro looks, modern speed",
          description:
            "A retro-styled card reader inspired by 1990s floppy disk design. It reads SD and Micro SD cards simultaneously at SD 4.0 high speeds (theoretical 312MB/s), with a GL security chip for stable transfers. The all-aluminum shell aids heat dissipation in a slim 8mm, 31g body that's easy to clip to a backpack.",
          specs: [
            { label: "Interface", value: "SD 4.0 (UHS-II)" },
            { label: "Max Speed", value: "312MB/s (theoretical)" },
            { label: "Slots", value: "SD + Micro SD (simultaneous)" },
            { label: "Shell", value: "All-aluminum" },
            { label: "Thickness", value: "8mm" },
            { label: "Weight", value: "31g" },
          ],
          features: [
            { title: "Dual-Card Reading", description: "Read SD and Micro SD cards at the same time for fast offloads." },
            { title: "SD 4.0 Speeds", description: "Up to a theoretical 312MB/s, backward compatible with SD 3.0 / UHS-I." },
            { title: "Stays Cool", description: "All-aluminum shell dissipates heat during sustained transfers." },
          ],
        },
      },
    },
  },
  {
    handle: "dkq03",
    title: "Кардридер SD/Micro SD 4.0",
    subtitle: "У стилі теки, два слоти",
    description:
      "Кардридер із двома слотами в дизайні комп'ютерної теки у кольорах Mac Blue та Windows Yellow. Одночасно читає SD і Micro SD на швидкостях SD 4.0 до теоретичних 312 МБ/с, має захисний чип GL та U-подібний суцільноалюмінієвий корпус для розсіювання тепла при товщині лише 8 мм.",
    priceCents: 2399,
    categoryHandles: ["card-readers"],
    options: [{ title: "Color", values: ["Blue", "Yellow"] }],
    variants: [
      { title: "Mac Blue", sku: "DKQ03-BL", options: { Color: "Blue" } },
      { title: "Windows Yellow", sku: "DKQ03-YL", options: { Color: "Yellow" } },
    ],
    metadata: {
      model: "DKQ03",
      specs: [
        { label: "Інтерфейс", value: "SD 4.0 (UHS-II)" },
        { label: "Макс. швидкість", value: "312 МБ/с (теоретично)" },
        { label: "Слоти", value: "SD + Micro SD (одночасно)" },
        { label: "Корпус", value: "U-подібний алюмінієвий сплав" },
        { label: "Товщина", value: "8 мм" },
        { label: "Сумісність", value: "Зворотна з SD 3.0 / UHS-I" },
      ],
      features: [
        { title: "Два слоти одночасно", description: "Передавайте дані з карток SD і Micro SD одночасно." },
        { title: "Чип проти збоїв", description: "Захисний чип GL зменшує затримки та аномалії передачі." },
        { title: "Кишеньковий формат", description: "Ультратонкий 8-мм алюмінієвий корпус у двох яскравих кольорах." },
      ],
      i18n: {
        en: {
          title: "SD/Micro SD 4.0 Card Reader",
          subtitle: "Folder-style, dual-slot",
          description:
            "A dual-slot card reader with a folder-inspired design in Mac Blue and Windows Yellow. It reads SD and Micro SD cards simultaneously at SD 4.0 speeds up to a theoretical 312MB/s, with a GL security chip and a U-shaped all-aluminum shell for heat dissipation in an ultra-slim 8mm body.",
          specs: [
            { label: "Interface", value: "SD 4.0 (UHS-II)" },
            { label: "Max Speed", value: "312MB/s (theoretical)" },
            { label: "Slots", value: "SD + Micro SD (simultaneous)" },
            { label: "Shell", value: "U-shaped aluminum alloy" },
            { label: "Thickness", value: "8mm" },
            { label: "Compatibility", value: "Backward compatible SD 3.0 / UHS-I" },
          ],
          features: [
            { title: "Dual-Card Reading", description: "Transfer from SD and Micro SD cards at the same time." },
            { title: "Anti-Lag Chip", description: "GL security chip reduces lag and transfer anomalies." },
            { title: "Pocketable", description: "Ultra-slim 8mm aluminum body in two playful colorways." },
          ],
        },
      },
    },
  },
  {
    handle: "floppy-disk-style-ssd-enclosure",
    title: "SSD-кишеня у стилі дискети",
    subtitle: "Ікона 90-х, усередині 1200 МБ/с",
    description:
      "Ретро-кишеня для M.2 NVMe SSD у формі 3,5-дюймової дискети. Інтерфейс USB 3.2 Gen2 Type-C видає 10 Гбіт/с із реальними швидкостями читання/запису 1000–1200 МБ/с. Підтримує SSD M.2 2230/2242 NVMe (ключ B+M або M) у тонкому корпусі 6,1 мм і працює з iPhone 15/16/17 Pro для запису ProRes.",
    priceCents: 3299,
    categoryHandles: ["ssd-enclosures", "memory"],
    options: [{ title: "Color", values: ["Grey", "Orange", "Green"] }],
    variants: [
      { title: "Grey", sku: "YPHN02-GY", options: { Color: "Grey" } },
      { title: "Orange", sku: "YPHN02-OR", options: { Color: "Orange" } },
      { title: "Green", sku: "YPHN02-GN", options: { Color: "Green" } },
    ],
    metadata: {
      model: "YPHN02",
      specs: [
        { label: "Інтерфейс", value: "USB 3.2 Gen2 Type-C (10 Гбіт/с)" },
        { label: "Читання/запис", value: "1000–1200 МБ/с" },
        { label: "Диски", value: "M.2 2230 / 2242 NVMe" },
        { label: "Контролер", value: "9210CN" },
        { label: "Товщина", value: "6,1 мм" },
        { label: "iPhone", value: "Запис ProRes на 15/16/17 Pro" },
      ],
      features: [
        { title: "Ретро-дизайн", description: "Виглядає як дискета, працює як сучасний накопичувач." },
        { title: "Передача 10 Гбіт/с", description: "USB 3.2 Gen2 із реальними 1000–1200 МБ/с." },
        { title: "Готова до ProRes", description: "Записуйте відео ProRes напряму з останніх iPhone Pro." },
      ],
      i18n: {
        en: {
          title: "Floppy Disk Style SSD Enclosure",
          subtitle: "1990s icon, 1200MB/s inside",
          description:
            "A retro M.2 NVMe SSD enclosure shaped like a 3.5-inch floppy disk. A USB 3.2 Gen2 Type-C interface delivers 10Gbps with real-world read/write of 1000–1200MB/s. Fits M.2 2230/2242 NVMe SSDs (B+M or M key) in a 6.1mm slim body, and works with iPhone 15/16/17 Pro for ProRes capture.",
          specs: [
            { label: "Interface", value: "USB 3.2 Gen2 Type-C (10Gbps)" },
            { label: "Read/Write", value: "1000–1200MB/s" },
            { label: "Drive Support", value: "M.2 2230 / 2242 NVMe" },
            { label: "Controller", value: "9210CN" },
            { label: "Thickness", value: "6.1mm" },
            { label: "iPhone", value: "ProRes capture on 15/16/17 Pro" },
          ],
          features: [
            { title: "Retro Design", description: "Looks like a floppy disk, performs like modern storage." },
            { title: "10Gbps Transfers", description: "USB 3.2 Gen2 with 1000–1200MB/s real-world speeds." },
            { title: "ProRes Ready", description: "Record ProRes video directly from recent iPhone Pro models." },
          ],
        },
      },
    },
  },
  {
    handle: "folder-style-ssd-enclosure",
    title: "SSD-кишеня у стилі теки",
    subtitle: "Тека з робочого столу, справжнє сховище",
    description:
      "Кишеня для M.2 NVMe SSD у вигляді комп'ютерної теки. USB 3.2 Type-C видає 10 Гбіт/с із читанням/записом 1000–1200 МБ/с, підтримуються диски M.2 2230/2242/2260/2280 NVMe. Лише 8 мм і 28 г — поміститься в будь-яку сумку, а нові iPhone Pro пишуть на неї ProRes 4K@120Гц напряму.",
    priceCents: 2999,
    categoryHandles: ["ssd-enclosures", "memory"],
    options: [{ title: "Color", values: ["Blue", "Yellow"] }],
    variants: [
      { title: "Blue", sku: "YPHN03-BL", options: { Color: "Blue" } },
      { title: "Yellow", sku: "YPHN03-YL", options: { Color: "Yellow" } },
    ],
    metadata: {
      model: "YPHN03",
      specs: [
        { label: "Інтерфейс", value: "USB 3.2 Type-C (10 Гбіт/с)" },
        { label: "Читання/запис", value: "1000–1200 МБ/с" },
        { label: "Диски", value: "M.2 2230/2242/2260/2280 NVMe" },
        { label: "Контролер", value: "9210CN" },
        { label: "Товщина", value: "8 мм" },
        { label: "Вага", value: "28 г" },
      ],
      features: [
        { title: "Широка сумісність", description: "Підходять чотири найпоширеніші довжини M.2 NVMe." },
        { title: "Передача 10 Гбіт/с", description: "USB 3.2 Type-C із реальними 1000–1200 МБ/с." },
        { title: "Для творців", description: "Запис ProRes 4K@120Гц на нових iPhone Pro." },
      ],
      i18n: {
        en: {
          title: "Folder Style SSD Enclosure",
          subtitle: "Desktop folder, real storage",
          description:
            "An M.2 NVMe SSD enclosure styled like a computer file folder. USB 3.2 Type-C delivers 10Gbps with 1000–1200MB/s read/write, and it supports a wide range of M.2 2230/2242/2260/2280 NVMe drives. At just 8mm and 28g it slips into any bag, and recent iPhone Pro models can record 4K@120Hz ProRes straight to it.",
          specs: [
            { label: "Interface", value: "USB 3.2 Type-C (10Gbps)" },
            { label: "Read/Write", value: "1000–1200MB/s" },
            { label: "Drive Support", value: "M.2 2230/2242/2260/2280 NVMe" },
            { label: "Controller", value: "9210CN" },
            { label: "Thickness", value: "8mm" },
            { label: "Weight", value: "28g" },
          ],
          features: [
            { title: "Broad Compatibility", description: "Fits the four most common M.2 NVMe lengths." },
            { title: "10Gbps Transfers", description: "USB 3.2 Type-C with 1000–1200MB/s real-world speeds." },
            { title: "Creator Friendly", description: "4K@120Hz ProRes recording on recent iPhone Pro models." },
          ],
        },
      },
    },
  },
  {
    handle: "tcc10-female",
    title: "Подовжувач USB-C",
    subtitle: "Більше відстані — без втрат",
    description:
      "Преміальний подовжувальний кабель USB-C (штекер–гніздо) у кількох довжинах, щоб розташувати пристрої зручно. Посилений нікельованими конекторами, нейлоновим обплетенням і корпусом з алюмінієвого сплаву; передає 20 Гбіт/с даних, заряджання 240 Вт PD 3.1 (до 48В/5А) і відео 4K@60Гц, а також витримує понад 15 000 тестів на згинання.",
    priceCents: 1699,
    categoryHandles: ["usb-c-cables"],
    options: [{ title: "Length", values: ["0.5ft", "1.6ft", "3.3ft"] }],
    variants: [
      { title: "0.5ft", sku: "TCC10-05", options: { Length: "0.5ft" } },
      { title: "1.6ft", sku: "TCC10-16", options: { Length: "1.6ft" } },
      { title: "3.3ft", sku: "TCC10-33", options: { Length: "3.3ft" } },
    ],
    metadata: {
      model: "TCC10",
      specs: [
        { label: "Швидкість даних", value: "20 Гбіт/с" },
        { label: "Заряджання", value: "240 Вт PD 3.1 (48В/5А)" },
        { label: "Відео", value: "4K@60Гц (DP Alt Mode)" },
        { label: "Конструкція", value: "Нейлонове обплетення + алюмінієвий сплав" },
        { label: "Витривалість", value: "Понад 15 000 згинань" },
      ],
      features: [
        { title: "Швидка зарядка 240 Вт", description: "Чип E-marker і PD 3.1 — до 48В/5А." },
        { title: "Дані 20 Гбіт/с", description: "До 40× швидше за USB 2.0; зворотна сумісність." },
        { title: "Створений надовго", description: "Посилені з'єднання та обплетення витримують 15 000+ згинань." },
      ],
      i18n: {
        en: {
          title: "USB-C Extension Cable",
          subtitle: "Reach further, lose nothing",
          description:
            "A premium USB-C male-to-female extension cable available in several lengths so you can place your devices comfortably. Reinforced with nickel-plated connectors, nylon braiding and an aluminum-alloy casing, it carries 20Gbps data, 240W PD 3.1 charging (up to 48V/5A) and 4K@60Hz video, and survives 15,000+ bend tests.",
          specs: [
            { label: "Data Rate", value: "20Gbps" },
            { label: "Charging", value: "240W PD 3.1 (48V/5A)" },
            { label: "Video", value: "4K@60Hz (DP Alt Mode)" },
            { label: "Build", value: "Nylon braid + aluminum alloy" },
            { label: "Durability", value: "15,000+ bend tests" },
          ],
          features: [
            { title: "240W Fast Charging", description: "E-marker chip and PD 3.1 support up to 48V/5A." },
            { title: "20Gbps Data", description: "Up to 40× faster than USB 2.0; backward compatible." },
            { title: "Built to Last", description: "Reinforced joints and braided jacket pass 15,000+ bends." },
          ],
        },
      },
    },
  },
  {
    handle: "ljx01",
    title: "Кабель для тетерингу камери",
    subtitle: "Г-подібний, надійний, 80 Гбіт/с",
    description:
      "Професійний USB-C кабель для тетерингу з Г-подібним кутовим конектором, який запобігає випадковому від'єднанню під час зйомки. Передає блискавичні 80 Гбіт/с для перегляду в реальному часі, відео 8K@60Гц через DisplayPort і заряджання 240 Вт PD 3.1 — усе в обплетенні, що не плутається.",
    priceCents: 3999,
    categoryHandles: ["usb-c-cables"],
    options: [],
    variants: [{ title: "Default", sku: "LJX01" }],
    metadata: {
      model: "LJX01",
      specs: [
        { label: "Швидкість даних", value: "80 Гбіт/с" },
        { label: "Відео", value: "8K@60Гц (DisplayPort)" },
        { label: "Заряджання", value: "240 Вт PD 3.1 (48В/5А)" },
        { label: "Конектор", value: "Г-подібний кутовий" },
        { label: "Оболонка", value: "Обплетення, не плутається" },
      ],
      features: [
        { title: "Г-подібний конектор", description: "Кутова форма тримає кабель на місці під час зйомки з тетерингом." },
        { title: "80 Гбіт/с у реальному часі", description: "Миттєвий перегляд і передача для професійної зйомки." },
        { title: "Вивід 8K", description: "8K@60Гц через протокол DisplayPort." },
      ],
      i18n: {
        en: {
          title: "Camera Tethering Cable",
          subtitle: "L-shaped, locked-in, 80Gbps",
          description:
            "A professional USB-C tethering cable with an L-shaped right-angle connector that prevents accidental disconnection during shoots. It delivers blazing 80Gbps transfer for real-time display, 8K@60Hz video over DisplayPort, and 240W PD 3.1 charging, all wrapped in a tangle-resistant braided jacket.",
          specs: [
            { label: "Data Rate", value: "80Gbps" },
            { label: "Video", value: "8K@60Hz (DisplayPort)" },
            { label: "Charging", value: "240W PD 3.1 (48V/5A)" },
            { label: "Connector", value: "L-type right angle" },
            { label: "Jacket", value: "Braided, tangle-resistant" },
          ],
          features: [
            { title: "L-Shaped Connector", description: "Right-angle design keeps the cable seated during tethered shoots." },
            { title: "Real-Time 80Gbps", description: "Instant preview and transfer for professional capture." },
            { title: "8K Display Out", description: "Drives 8K@60Hz over the DisplayPort protocol." },
          ],
        },
      },
    },
  },
  {
    handle: "usb-c-extension-cable-313",
    title: "Подовжувач USB-C з LED-дисплеєм",
    subtitle: "Бачте заряд наживо",
    description:
      "Подовжувальний кабель USB-C із вбудованим LED-дисплеєм, який показує потужність і швидкість заряджання в реальному часі. Підтримує швидке заряджання 240 Вт PD 3.1 (48В/5А) для смартфонів, планшетів і консолей, дані 480 Мбіт/с та чип E-marker для безпечного заряджання. Оболонка з рідкого силікону лишається м'якою, гнучкою і не плутається.",
    priceCents: 1999,
    categoryHandles: ["usb-c-cables"],
    options: [{ title: "Color", values: ["Yellow", "Silver"] }],
    variants: [
      { title: "Yellow", sku: "SX03SY-YL", options: { Color: "Yellow" } },
      { title: "Silver", sku: "SX03SY-SV", options: { Color: "Silver" } },
    ],
    metadata: {
      model: "SX03SY",
      specs: [
        { label: "Заряджання", value: "240 Вт PD 3.1 (48В/5А)" },
        { label: "Дисплей", value: "LED: потужність і швидкість наживо" },
        { label: "Швидкість даних", value: "480 Мбіт/с" },
        { label: "Оболонка", value: "Рідкий силікон" },
        { label: "Сумісність", value: "Huawei 88 Вт / Xiaomi 100 Вт" },
      ],
      features: [
        { title: "LED-показники наживо", description: "Вбудований екран показує метрики заряджання в реальному часі." },
        { title: "Швидка зарядка 240 Вт", description: "PD 3.1 із чипом E-marker для безпечного розумного заряджання." },
        { title: "М'який силікон", description: "Гнучка оболонка з рідкого силікону, яка ніколи не плутається." },
      ],
      i18n: {
        en: {
          title: "USB-C Extension Cable with LED Display",
          subtitle: "See your charge, live",
          description:
            "A USB-C extension cable with a built-in LED display that shows real-time charging power and speed. It supports 240W PD 3.1 fast charging (48V/5A) for phones, tablets and consoles, 480Mbps data, and an E-marker chip for safe charging. The liquid-silicone jacket stays soft, flexible and tangle-free.",
          specs: [
            { label: "Charging", value: "240W PD 3.1 (48V/5A)" },
            { label: "Display", value: "Live LED power/speed" },
            { label: "Data Rate", value: "480Mbps" },
            { label: "Jacket", value: "Liquid silicone" },
            { label: "Compatibility", value: "Huawei 88W / Xiaomi 100W" },
          ],
          features: [
            { title: "Live LED Readout", description: "A built-in screen shows real-time charging metrics." },
            { title: "240W Fast Charging", description: "PD 3.1 with E-marker chip for safe, intelligent charging." },
            { title: "Soft Silicone", description: "Flexible liquid-silicone jacket that never tangles." },
          ],
        },
      },
    },
  },
  {
    handle: "qhq01",
    title: "USB-C перемикач",
    subtitle: "Два пристрої, один клік",
    description:
      "Настільний USB-C перемикач, який дозволяє ділити монітор і периферію між двома пристроями та перемикатися одним кліком. Підтримує 8K@60Гц із динамічним HDR, дані 10 Гбіт/с і наскрізне живлення 100 Вт PD; корпус з алюмінієвого сплаву добре відводить тепло. LED-індикатори показують, який пристрій зараз активний.",
    priceCents: 4299,
    categoryHandles: ["accessories"],
    options: [],
    variants: [{ title: "Default", sku: "QHQ01" }],
    metadata: {
      model: "QHQ01",
      specs: [
        { label: "Відео", value: "8K@60Гц з динамічним HDR" },
        { label: "Швидкість даних", value: "10 Гбіт/с" },
        { label: "Живлення", value: "100 Вт PD (на один пристрій)" },
        { label: "Перемикання", value: "Один клік між двома пристроями" },
        { label: "Корпус", value: "Алюмінієвий сплав" },
      ],
      features: [
        { title: "Перемикання одним кліком", description: "Миттєво переносьте монітор і периферію між двома пристроями." },
        { title: "8K HDR", description: "8K@60Гц з динамічним HDR для роботи та ігор." },
        { title: "LED-статуси", description: "Чіткі індикатори показують, який інтерфейс зараз активний." },
      ],
      i18n: {
        en: {
          title: "USB-C Switch",
          subtitle: "Two devices, one click",
          description:
            "A desktop USB-C switch that lets you share a display and peripherals between two devices and swap with a single click. It supports 8K@60Hz with dynamic HDR, 10Gbps data, and 100W PD pass-through, and the aluminum-alloy shell keeps everything cool. LED indicators show which device is active.",
          specs: [
            { label: "Video", value: "8K@60Hz with dynamic HDR" },
            { label: "Data Rate", value: "10Gbps" },
            { label: "Power", value: "100W PD (one device at a time)" },
            { label: "Switching", value: "One-click between two devices" },
            { label: "Shell", value: "Aluminum alloy" },
          ],
          features: [
            { title: "One-Click Switching", description: "Instantly move your display and peripherals between two devices." },
            { title: "8K HDR", description: "Drives 8K@60Hz with dynamic HDR for work and gaming." },
            { title: "Status LEDs", description: "Clear indicators show which interface is currently active." },
          ],
        },
      },
    },
  },
  {
    handle: "ultra-slim-usb-c-hub",
    title: "Ультратонкий USB-C хаб",
    subtitle: "Усі порти майже без товщини",
    description:
      "Ультратонкий алюмінієвий USB-C хаб із портами, які справді потрібні: наскрізне заряджання 100 Вт PD, HDMI 4K@60Гц, гігабітний Ethernet і дані 5 Гбіт/с через USB-A та USB-C. Двобічні вентиляційні отвори відводять тепло, а щільне перехресне плетіння кабелю захищає його від розривів.",
    priceCents: 4599,
    categoryHandles: ["accessories"],
    options: [],
    variants: [{ title: "Default", sku: "KZWN01" }],
    metadata: {
      model: "KZWN01",
      specs: [
        { label: "Заряджання", value: "100 Вт PD наскрізне" },
        { label: "Відео", value: "HDMI 4K@60Гц" },
        { label: "Ethernet", value: "Гігабіт (1000 Мбіт/с)" },
        { label: "Дані", value: "5 Гбіт/с USB-A + USB-C" },
        { label: "Корпус", value: "Алюміній, подвійна вентиляція" },
      ],
      features: [
        { title: "Справжні 4K@60Гц", description: "Дублюйте чи розширюйте картинку на зовнішній монітор через HDMI." },
        { title: "Гігабітний Ethernet", description: "Надійна дротова мережа на 1000 Мбіт/с." },
        { title: "Наскрізні 100 Вт", description: "Живіть ноутбук, поки все лишається під'єднаним." },
      ],
      i18n: {
        en: {
          title: "Ultra Slim USB-C Hub",
          subtitle: "Every port, almost no thickness",
          description:
            "An ultra-slim aluminum USB-C hub that adds the ports you actually need: 100W PD pass-through charging, 4K@60Hz HDMI, Gigabit Ethernet, and 5Gbps USB-A and USB-C data. Bidirectional air vents keep it cool, and the high-density cross-woven cable resists tearing.",
          specs: [
            { label: "Charging", value: "100W PD pass-through" },
            { label: "Video", value: "4K@60Hz HDMI" },
            { label: "Ethernet", value: "Gigabit (1000Mbps)" },
            { label: "Data", value: "5Gbps USB-A + USB-C" },
            { label: "Shell", value: "Aluminum, dual air vents" },
          ],
          features: [
            { title: "True 4K@60Hz", description: "Mirror or extend to an external display over HDMI." },
            { title: "Gigabit Ethernet", description: "Reliable wired networking at 1000Mbps." },
            { title: "100W Pass-Through", description: "Power your laptop while everything stays connected." },
          ],
        },
      },
    },
  },
  {
    handle: "apple-find-my-tracker-329",
    title: "Bluetooth-трекер Find My",
    subtitle: "Більше нічого не загубиться",
    description:
      "Bluetooth-трекер, що працює з мережею Apple Find My — окремий застосунок не потрібен. Відтворіть звук одним дотиком, отримуйте сповіщення про залишені речі та йдіть за точними підказками в застосунку Find. Працює близько року від змінної батарейки і має захист IP64 від води та пилу.",
    priceCents: 1999,
    categoryHandles: ["accessories"],
    options: [],
    variants: [{ title: "Default", sku: "FD01" }],
    metadata: {
      model: "FD01",
      specs: [
        { label: "Мережа", value: "Сертифікований Apple Find My" },
        { label: "Сповіщення", value: "Звук одним кліком + «річ залишено»" },
        { label: "Відстань", value: "Сповіщення про розрив на 100 м" },
        { label: "Батарея", value: "~365 днів, змінна" },
        { label: "Захист", value: "IP64 від води та пилу" },
      ],
      features: [
        { title: "Працює з Find My", description: "Інтеграція з рідним застосунком Find — нічого не треба встановлювати." },
        { title: "Знаходьте швидко", description: "Відтворіть звук або йдіть за точними підказками на екрані." },
        { title: "Батарея на рік", description: "Близько 12 місяців роботи від змінної батарейки." },
      ],
      i18n: {
        en: {
          title: "Find My Bluetooth Tracker",
          subtitle: "Never lose it again",
          description:
            "A Bluetooth tracker that works with Apple's Find My network — no separate app required. Tap to play a sound, get notified when you leave an item behind, and follow precise directions in the Find app. It runs about a year on a user-replaceable battery and is IP64 water- and dust-resistant.",
          specs: [
            { label: "Network", value: "Apple Find My certified" },
            { label: "Alerts", value: "One-click sound + left-behind" },
            { label: "Range Alert", value: "100m disconnection notice" },
            { label: "Battery", value: "~365 days, replaceable" },
            { label: "Rating", value: "IP64 water/dust resistant" },
          ],
          features: [
            { title: "Works with Find My", description: "Integrates with Apple's native Find app — no download needed." },
            { title: "Find It Fast", description: "Play a sound or follow precise on-screen directions." },
            { title: "Year-Long Battery", description: "About 12 months on a user-replaceable battery." },
          ],
        },
      },
    },
  },
  {
    handle: "multifunctional-cleaning-brush-220",
    title: "Багатофункціональний пензлик для чищення",
    subtitle: "Одна річ для всіх ґаджетів",
    description:
      "Інструмент для чищення електроніки з двома насадками. М'які загострені ворсинки у три щільні ряди чистять сітки динаміків і порти без пошкоджень; флокована губка — для кейсів навушників, металевий наконечник підчіпляє застрягле сміття, а знімач клавіш у комплекті допоможе доглядати за клавіатурою.",
    priceCents: 1299,
    categoryHandles: ["accessories"],
    options: [{ title: "Color", values: ["Red", "Gray"] }],
    variants: [
      { title: "White / Red", sku: "CB01-RD", options: { Color: "Red" } },
      { title: "White / Gray", sku: "CB01-GY", options: { Color: "Gray" } },
    ],
    metadata: {
      model: "CB01",
      specs: [
        { label: "Насадки", value: "Дві приховані, перемикаються" },
        { label: "Ворс", value: "М'який, загострений, 3 ряди" },
        { label: "У комплекті", value: "Флокована губка, металевий наконечник, знімач клавіш" },
        { label: "Застосування", value: "Динаміки, порти, кейси, клавіатури" },
      ],
      features: [
        { title: "Дві насадки", description: "Перемикайтеся між пензликом і губкою для будь-якого чищення." },
        { title: "Інструменти для деталей", description: "Металевий наконечник і знімач клавіш для впертого пилу та кейкапів." },
        { title: "Делікатний, але дієвий", description: "Загострений м'який ворс чистить сітки без подряпин." },
      ],
      i18n: {
        en: {
          title: "Multifunctional Cleaning Brush",
          subtitle: "Clean every gadget, one tool",
          description:
            "A dual-head cleaning tool made for electronics. Soft, sharpened bristles in three tight rows clean speaker grilles and ports without damage, while a flocking sponge tackles charging-case interiors, a metal pen tip lifts stubborn debris, and an included key puller helps with keyboard maintenance.",
          specs: [
            { label: "Heads", value: "Dual hidden, switchable" },
            { label: "Bristles", value: "Soft, sharpened, 3-row" },
            { label: "Includes", value: "Flocking sponge, metal tip, key puller" },
            { label: "Use", value: "Speakers, ports, charging cases, keyboards" },
          ],
          features: [
            { title: "Dual Heads", description: "Switch between brush and sponge for any cleaning job." },
            { title: "Detail Tools", description: "Metal pen tip and key puller for stubborn dust and keycaps." },
            { title: "Gentle but Tough", description: "Sharpened soft bristles clean grilles without scratching." },
          ],
        },
      },
    },
  },
]

/** Resolve downloaded images for a product handle from static/products/<handle>/. */
export function resolveImages(handle: string): {
  thumbnail: string | null
  images: { url: string }[]
} {
  const dir = path.join(process.cwd(), "static", "products", handle)
  let files: string[] = []
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch {
    // no images downloaded for this handle
  }
  const images = files.map((f) => ({
    url: `${BACKEND_URL}/static/products/${handle}/${f}`,
  }))
  return { thumbnail: images[0]?.url ?? null, images }
}

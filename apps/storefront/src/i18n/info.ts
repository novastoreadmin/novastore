/**
 * Content for the informational pages (footer links), both languages.
 * Rendered by src/components/info/info-page.tsx.
 */

export type InfoSection = {
  heading: string;
  paragraphs: string[];
  list?: string[];
};

export type InfoPageContent = {
  label: string; // eyebrow
  title: string;
  intro: string;
  sections: InfoSection[];
};

export type InfoPageKey =
  | "about"
  | "shipping"
  | "returns"
  | "support"
  | "careers"
  | "warranty"
  | "faq"
  | "sustainability"
  | "press"
  | "terms"
  | "privacy"
  | "cookies";

export type InfoPagesDict = Record<InfoPageKey, InfoPageContent>;

export const infoPagesUk: InfoPagesDict = {
  about: {
    label: "Компанія",
    title: "Про NOVA",
    intro:
      "Ми віримо, що аксесуари — це не дрібниці. Це інструменти, які щодня стоять між вашою ідеєю та її результатом.",
    sections: [
      {
        heading: "Чому ми існуємо",
        paragraphs: [
          "NOVA народилася з простого спостереження: техніка навколо нас стала неймовірною, а аксесуари до неї — ні. Повільні кардридери, пластикові хаби, кабелі, які не тримають заявлену потужність. Ми вирішили зібрати каталог, у якому кожна річ відповідає рівню пристроїв, до яких вона під'єднується.",
          "Сьогодні NOVA — це ретельно відібрані SSD-кишені, кардридери, хаби та кабелі з алюмінієвими корпусами, чесними швидкостями та дизайном, який приємно тримати в руках.",
        ],
      },
      {
        heading: "Наші принципи",
        paragraphs: [],
        list: [
          "Чесні характеристики: якщо на кабелі написано 240 Вт — він тримає 240 Вт.",
          "Матеріали, що живуть довго: алюміній замість пластику, E-marker замість обіцянок.",
          "Дизайн, який хочеться показати: техніка може бути красивою.",
          "Підтримка, що відповідає: живі люди, а не бот із шаблонами.",
        ],
      },
      {
        heading: "Чому це зручно",
        paragraphs: [
          "Ми доставляємо Новою Поштою по всій країні, приймаємо оплату Monobank і говоримо з вами однією мовою. Кожне замовлення пакуємо так, ніби відправляємо собі. Продаємо лише те, чим користуємося самі.",
        ],
      },
    ],
  },
  shipping: {
    label: "Підтримка",
    title: "Доставка",
    intro:
      "Відправляємо замовлення Новою Поштою по всій Україні — швидко, з трек-номером і охайним пакуванням.",
    sections: [
      {
        heading: "Способи доставки",
        paragraphs: [],
        list: [
          "Нова Пошта — відділення чи поштомат: 1–3 робочі дні, від 80 грн.",
          "Нова Пошта — кур'єр до дверей: 1–3 робочі дні, від 150 грн.",
        ],
      },
      {
        heading: "Як це працює",
        paragraphs: [
          "Після оплати ми формуємо відправлення того ж або наступного робочого дня. Щойно посилка створена, ви отримуєте трек-номер (ТТН) — за ним можна стежити у застосунку Нової Пошти.",
          "Замовлення, оформлені у вихідні та свята, відправляються першого робочого дня.",
        ],
      },
      {
        heading: "Вартість і терміни",
        paragraphs: [
          "Вартість доставки розраховується на кроці оформлення замовлення й не змінюється після оплати. Типовий термін по Україні — 1–3 робочі дні залежно від міста; до великих міст найчастіше наступного дня.",
        ],
      },
    ],
  },
  returns: {
    label: "Підтримка",
    title: "Повернення",
    intro:
      "Не підійшло? Нічого страшного. Повернути товар можна протягом 14 днів згідно із Законом України «Про захист прав споживачів».",
    sections: [
      {
        heading: "Умови повернення",
        paragraphs: [],
        list: [
          "14 днів з моменту отримання замовлення.",
          "Товар не був у використанні та зберіг товарний вигляд.",
          "Збережене повне пакування та комплектація.",
          "Є підтвердження покупки (номер замовлення або чек).",
        ],
      },
      {
        heading: "Як оформити",
        paragraphs: [
          "Напишіть нам на support@novastore.com.ua з номером замовлення й коротким описом причини. Ми відповімо протягом одного робочого дня та надішлемо інструкцію з відправлення.",
          "Кошти повертаються тим самим способом, яким була здійснена оплата, протягом 3–7 робочих днів після того, як ми отримаємо й перевіримо товар.",
        ],
      },
      {
        heading: "Обмін",
        paragraphs: [
          "Хочете інший колір або модель? Оформимо обмін тим самим відправленням — просто вкажіть це в листі.",
        ],
      },
      {
        heading: "Товари зі складу партнера",
        paragraphs: [
          "Товари з позначкою «Зі складу партнера» відправляються окремою посилкою напряму від постачальника. Повернення таких товарів приймається протягом 14 днів за умови, що заводська захисна плівка/пакування не розкриті. Товар з дефектом приймається за наявності повної комплектації.",
        ],
      },
    ],
  },
  support: {
    label: "Підтримка",
    title: "Зв'язатися з нами",
    intro: "Ми поруч і відповідаємо швидко. Оберіть зручний спосіб зв'язку.",
    sections: [
      {
        heading: "Канали підтримки",
        paragraphs: [],
        list: [
          "Email: support@novastore.com.ua — відповідаємо протягом робочого дня.",
          "Питання щодо замовлення: вкажіть номер замовлення у темі листа, це прискорить відповідь.",
          "Гарантійні випадки: опишіть проблему та додайте фото або відео — так ми вирішимо питання за одне звернення.",
        ],
      },
      {
        heading: "Графік",
        paragraphs: [
          "Пн–Пт, 10:00–19:00 за Києвом. Листи, надіслані у вихідні, обробляємо першого робочого дня.",
        ],
      },
      {
        heading: "Перед тим як писати",
        paragraphs: [
          "Можливо, відповідь уже є на сторінці «Питання й відповіді» — перевірте розділ FAQ, це найшвидший шлях.",
        ],
      },
    ],
  },
  careers: {
    label: "Компанія",
    title: "Кар'єра в NOVA",
    intro:
      "Ми — невелика команда, яка любить гарну техніку та чесний сервіс. І ми зростаємо.",
    sections: [
      {
        heading: "Як ми працюємо",
        paragraphs: [
          "Віддалено, без бюрократії, з фокусом на результат. Кожна людина в команді напряму впливає на те, яким буде магазин завтра.",
        ],
      },
      {
        heading: "Кого шукаємо",
        paragraphs: [
          "Зараз відкритих вакансій немає, але ми завжди раді знайомству з людьми, які горять e-commerce, логістикою, контентом або підтримкою клієнтів.",
        ],
      },
      {
        heading: "Написати нам",
        paragraphs: [
          "Надішліть кілька слів про себе та посилання на портфоліо чи LinkedIn на careers@novastore.com.ua. Ми відповідаємо всім.",
        ],
      },
    ],
  },
  warranty: {
    label: "Підтримка",
    title: "Гарантія",
    intro:
      "На всі товари NOVA діє офіційна гарантія 12 місяців з дати покупки.",
    sections: [
      {
        heading: "Що покриває гарантія",
        paragraphs: [],
        list: [
          "Заводські дефекти матеріалів і збірки.",
          "Невідповідність заявленим характеристикам (швидкість, потужність).",
          "Вихід з ладу за нормальних умов використання.",
        ],
      },
      {
        heading: "Що не покриває",
        paragraphs: [],
        list: [
          "Механічні пошкодження, сліди вологи, самостійний ремонт.",
          "Природний знос (потертості корпусу тощо).",
          "Пошкодження через використання несумісного обладнання.",
        ],
      },
      {
        heading: "Як скористатися",
        paragraphs: [
          "Напишіть на support@novastore.com.ua з номером замовлення, описом проблеми та фото/відео. Ми або замінимо товар, або повернемо кошти — залежно від наявності та вашого вибору. Доставку гарантійної заміни оплачуємо ми.",
        ],
      },
    ],
  },
  faq: {
    label: "Підтримка",
    title: "Питання й відповіді",
    intro: "Найчастіші запитання про замовлення, оплату, доставку та повернення.",
    sections: [
      {
        heading: "Як оплатити замовлення?",
        paragraphs: [
          "Оплата проходить через захищену сторінку Monobank: банківська картка будь-якого банку, Apple Pay або Google Pay. Ми не бачимо й не зберігаємо дані вашої картки.",
        ],
      },
      {
        heading: "Коли спишуться кошти?",
        paragraphs: [
          "При оформленні кошти блокуються на картці, а списуються в момент відправлення замовлення. Якщо замовлення скасовується до відправлення — блокування знімається автоматично, зазвичай протягом кількох днів.",
        ],
      },
      {
        heading: "Скільки їде посилка?",
        paragraphs: [
          "Новою Поштою — зазвичай 1–3 робочі дні по Україні. Трек-номер приходить одразу після створення відправлення.",
        ],
      },
      {
        heading: "Чи можна повернути товар?",
        paragraphs: [
          "Так, протягом 14 днів, якщо товар не використовувався і збережене пакування. Деталі — на сторінці «Повернення».",
        ],
      },
      {
        heading: "Чи можна зберегти картку для наступних покупок?",
        paragraphs: [
          "Так. Поставте галочку «Зберегти картку» під час оплати — токен зберігається на боці Monobank, і наступного разу оплата пройде в один клік. Видалити збережену картку можна прямо на сторінці оплати.",
        ],
      },
      {
        heading: "Товари оригінальні?",
        paragraphs: [
          "Так, ми працюємо лише з офіційними постачальниками. На все — гарантія 12 місяців.",
        ],
      },
    ],
  },
  sustainability: {
    label: "Компанія",
    title: "Сталий розвиток",
    intro:
      "Довговічна техніка — найкраща екологія. Ми будуємо каталог навколо речей, які не доведеться викидати за рік.",
    sections: [
      {
        heading: "Довговічність замість одноразовості",
        paragraphs: [
          "Алюмінієві корпуси, якісні роз'єми та чесні характеристики означають простіше: наші аксесуари служать роками. Найекологічніший продукт — той, який не потрібно заміняти.",
        ],
      },
      {
        heading: "Розумне пакування",
        paragraphs: [
          "Ми не додаємо зайвого пластику до відправлень і використовуємо повторно придатні пакувальні матеріали, де це можливо.",
        ],
      },
      {
        heading: "Ремонт і гарантія",
        paragraphs: [
          "Замість «викинь і купи нове» — 12 місяців гарантії та підтримка, яка спершу шукає рішення, а не заміну.",
        ],
      },
    ],
  },
  press: {
    label: "Компанія",
    title: "Преса",
    intro:
      "Пишете про технології, e-commerce чи дизайн? Ми відкриті до розмови.",
    sections: [
      {
        heading: "Для медіа",
        paragraphs: [
          "Надамо коментарі, фотографії продуктів у високій роздільності та інформацію про бренд. Пишіть на press@novastore.com.ua — відповідаємо протягом одного робочого дня.",
        ],
      },
      {
        heading: "Співпраця з блогерами",
        paragraphs: [
          "Ми співпрацюємо з оглядачами техніки та контент-мейкерами. Розкажіть про свою аудиторію — і разом придумаємо формат.",
        ],
      },
    ],
  },
  terms: {
    label: "Правове",
    title: "Умови використання",
    intro:
      "Ці умови регулюють користування сайтом novastore.com.ua та оформлення замовлень у магазині NOVA.",
    sections: [
      {
        heading: "1. Загальні положення",
        paragraphs: [
          "Оформлюючи замовлення на сайті, ви погоджуєтесь із цими умовами, а також з політикою конфіденційності. Магазин працює відповідно до законодавства України, зокрема Закону «Про захист прав споживачів» та Закону «Про електронну комерцію».",
        ],
      },
      {
        heading: "2. Замовлення та оплата",
        paragraphs: [
          "Ціни на сайті вказані в гривнях. Оплата здійснюється через платіжний сервіс Monobank (картка, Apple Pay, Google Pay). Замовлення вважається прийнятим після успішної авторизації платежу; кошти списуються при відправленні замовлення.",
        ],
      },
      {
        heading: "3. Доставка та повернення",
        paragraphs: [
          "Доставка здійснюється Новою Поштою на умовах, описаних на сторінці «Доставка». Повернення та обмін — протягом 14 днів згідно зі сторінкою «Повернення» та чинним законодавством.",
        ],
      },
      {
        heading: "4. Гарантія та відповідальність",
        paragraphs: [
          "На товари діє гарантія 12 місяців. Магазин не несе відповідальності за непрямі збитки, спричинені використанням товарів не за призначенням.",
        ],
      },
      {
        heading: "5. Контакти",
        paragraphs: [
          "З усіх питань щодо цих умов звертайтесь: support@novastore.com.ua.",
        ],
      },
    ],
  },
  privacy: {
    label: "Правове",
    title: "Політика конфіденційності",
    intro:
      "Ми збираємо лише ті дані, що потрібні для виконання вашого замовлення, і ніколи не продаємо їх третім особам.",
    sections: [
      {
        heading: "Які дані ми збираємо",
        paragraphs: [],
        list: [
          "Контактні дані: ім'я, email, телефон — для зв'язку щодо замовлення.",
          "Адреса доставки: місто та відділення Нової Пошти або адреса кур'єрської доставки.",
          "Історія замовлень — для гарантійного обслуговування та повторних покупок.",
        ],
      },
      {
        heading: "Чого ми НЕ збираємо",
        paragraphs: [
          "Дані банківських карток обробляються виключно на боці Monobank. Ми не бачимо, не передаємо і не зберігаємо номер вашої картки — при збереженні картки для повторних покупок у нас зберігається лише знеособлений токен.",
        ],
      },
      {
        heading: "Як ми використовуємо дані",
        paragraphs: [
          "Виконання замовлень, доставка (передача даних Новій Пошті), гарантійна підтримка та — лише за вашою згодою — повідомлення про новинки. Ви можете будь-коли запросити видалення своїх даних, написавши на support@novastore.com.ua.",
        ],
      },
      {
        heading: "Зберігання та захист",
        paragraphs: [
          "Дані зберігаються на захищених серверах у зашифрованому з'єднанні (HTTPS). Доступ до них має лише персонал, який обробляє замовлення.",
        ],
      },
    ],
  },
  cookies: {
    label: "Правове",
    title: "Політика cookies",
    intro:
      "Cookies допомагають сайту пам'ятати ваш кошик, мову та вподобання. Ось що саме ми використовуємо.",
    sections: [
      {
        heading: "Необхідні cookies",
        paragraphs: [
          "Ідентифікатор кошика, сесія авторизації та обрана мова інтерфейсу. Без них магазин просто не працюватиме — вимкнути їх не можна.",
        ],
      },
      {
        heading: "Аналітика",
        paragraphs: [
          "Ми можемо використовувати знеособлену аналітику відвідувань, щоб розуміти, які сторінки корисні, а які — ні. Ці дані не ідентифікують вас особисто.",
        ],
      },
      {
        heading: "Як керувати",
        paragraphs: [
          "Ви можете видалити або заблокувати cookies у налаштуваннях браузера. Врахуйте: після цього кошик і мова скидатимуться між візитами.",
        ],
      },
    ],
  },
};

export const infoPagesEn: InfoPagesDict = {
  about: {
    label: "Company",
    title: "About NOVA",
    intro:
      "We believe accessories are not an afterthought. They are the tools standing between your idea and its result, every single day.",
    sections: [
      {
        heading: "Why we exist",
        paragraphs: [
          "NOVA was born from a simple observation: the devices around us became incredible, while their accessories didn't. Slow card readers, plastic hubs, cables that never hold their rated power. So we set out to build a catalog where every item matches the level of the device it plugs into.",
          "Today NOVA is a curated line of SSD enclosures, card readers, hubs and cables — aluminum bodies, honest speeds, and a design you actually want on your desk.",
        ],
      },
      {
        heading: "Our principles",
        paragraphs: [],
        list: [
          "Honest specs: if the cable says 240W, it delivers 240W.",
          "Materials that last: aluminum over plastic, E-marker over promises.",
          "Design worth showing off: gear can be beautiful.",
          "Support that answers: real people, not template bots.",
        ],
      },
      {
        heading: "Why it's convenient",
        paragraphs: [
          "We ship nationwide with Nova Poshta, accept Monobank payments, and speak your language. Every order is packed like we're shipping it to ourselves. We sell only what we use ourselves.",
        ],
      },
    ],
  },
  shipping: {
    label: "Support",
    title: "Shipping",
    intro:
      "We ship across Ukraine with Nova Poshta — fast, tracked, and carefully packed.",
    sections: [
      {
        heading: "Delivery options",
        paragraphs: [],
        list: [
          "Nova Poshta — branch or parcel locker: 1–3 business days, from ₴80.",
          "Nova Poshta — courier to your door: 1–3 business days, from ₴150.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: [
          "After payment we create the shipment the same or next business day. As soon as it's registered you receive a tracking number (TTN) to follow in the Nova Poshta app.",
          "Orders placed on weekends and holidays ship on the first business day.",
        ],
      },
      {
        heading: "Cost and timing",
        paragraphs: [
          "Shipping cost is calculated at checkout and never changes after payment. Typical delivery across Ukraine takes 1–3 business days; major cities usually receive parcels next day.",
        ],
      },
    ],
  },
  returns: {
    label: "Support",
    title: "Returns",
    intro:
      "Changed your mind? No problem. Return any item within 14 days under Ukraine's Consumer Rights Protection Law.",
    sections: [
      {
        heading: "Return conditions",
        paragraphs: [],
        list: [
          "Within 14 days of receiving your order.",
          "The item is unused and in its original condition.",
          "Complete original packaging is preserved.",
          "Proof of purchase (order number or receipt).",
        ],
      },
      {
        heading: "How to start a return",
        paragraphs: [
          "Email support@novastore.com.ua with your order number and a short reason. We reply within one business day with shipping instructions.",
          "Refunds go back to the original payment method within 3–7 business days after we receive and inspect the item.",
        ],
      },
      {
        heading: "Exchanges",
        paragraphs: [
          "Want a different color or model? We'll arrange an exchange in the same shipment — just mention it in your email.",
        ],
      },
      {
        heading: "Items from a partner warehouse",
        paragraphs: [
          "Items marked \"From partner warehouse\" ship as a separate parcel directly from the supplier. Returns are accepted within 14 days provided the factory protective film/packaging is unopened. Defective items are accepted only with the full original kit.",
        ],
      },
    ],
  },
  support: {
    label: "Support",
    title: "Contact Us",
    intro: "We're close by and quick to answer. Pick whichever channel suits you.",
    sections: [
      {
        heading: "Support channels",
        paragraphs: [],
        list: [
          "Email: support@novastore.com.ua — we reply within one business day.",
          "Order questions: include your order number in the subject line to speed things up.",
          "Warranty claims: describe the issue and attach a photo or video so we can resolve it in one go.",
        ],
      },
      {
        heading: "Hours",
        paragraphs: [
          "Mon–Fri, 10:00–19:00 Kyiv time. Messages sent on weekends are handled on the first business day.",
        ],
      },
      {
        heading: "Before you write",
        paragraphs: [
          "Your answer might already be in the FAQ — it's the fastest route.",
        ],
      },
    ],
  },
  careers: {
    label: "Company",
    title: "Careers at NOVA",
    intro: "We're a small team that loves great hardware and honest service. And we're growing.",
    sections: [
      {
        heading: "How we work",
        paragraphs: [
          "Remote-first, zero bureaucracy, focused on outcomes. Everyone on the team directly shapes what the store becomes tomorrow.",
        ],
      },
      {
        heading: "Who we look for",
        paragraphs: [
          "No open roles right now, but we're always happy to meet people passionate about e-commerce, logistics, content, or customer support.",
        ],
      },
      {
        heading: "Say hello",
        paragraphs: [
          "Send a few words about yourself and a link to your portfolio or LinkedIn to careers@novastore.com.ua. We answer everyone.",
        ],
      },
    ],
  },
  warranty: {
    label: "Support",
    title: "Warranty",
    intro: "Every NOVA product comes with a 12-month official warranty from the date of purchase.",
    sections: [
      {
        heading: "What's covered",
        paragraphs: [],
        list: [
          "Manufacturing defects in materials and assembly.",
          "Deviation from stated specs (speed, power delivery).",
          "Failure under normal usage conditions.",
        ],
      },
      {
        heading: "What's not covered",
        paragraphs: [],
        list: [
          "Mechanical damage, liquid damage, self-repair attempts.",
          "Natural wear (case scuffs and similar).",
          "Damage caused by incompatible equipment.",
        ],
      },
      {
        heading: "How to claim",
        paragraphs: [
          "Email support@novastore.com.ua with your order number, a description of the issue, and a photo/video. We'll replace the item or refund you — your choice, subject to stock. Warranty replacement shipping is on us.",
        ],
      },
    ],
  },
  faq: {
    label: "Support",
    title: "FAQ",
    intro: "The most common questions about orders, payment, delivery and returns.",
    sections: [
      {
        heading: "How do I pay?",
        paragraphs: [
          "Payment runs through Monobank's secure page: any bank card, Apple Pay or Google Pay. We never see or store your card details.",
        ],
      },
      {
        heading: "When is my card charged?",
        paragraphs: [
          "At checkout the amount is placed on hold; it's captured when your order ships. If the order is cancelled before shipping, the hold is released automatically, usually within a few days.",
        ],
      },
      {
        heading: "How long does delivery take?",
        paragraphs: [
          "Nova Poshta delivers within 1–3 business days across Ukraine. The tracking number arrives as soon as the shipment is created.",
        ],
      },
      {
        heading: "Can I return an item?",
        paragraphs: [
          "Yes — within 14 days if the item is unused and the packaging is intact. Details on the Returns page.",
        ],
      },
      {
        heading: "Can I save my card for next time?",
        paragraphs: [
          "Yes. Tick “Save my card” at checkout — the token is stored on Monobank's side, and next time payment takes one click. You can delete a saved card right on the payment step.",
        ],
      },
      {
        heading: "Are the products original?",
        paragraphs: [
          "Yes, we only work with official suppliers. Everything carries a 12-month warranty.",
        ],
      },
    ],
  },
  sustainability: {
    label: "Company",
    title: "Sustainability",
    intro:
      "Durable gear is the best ecology. We build our catalog around things you won't need to throw away in a year.",
    sections: [
      {
        heading: "Longevity over disposability",
        paragraphs: [
          "Aluminum bodies, quality connectors and honest specs mean one simple thing: our accessories last for years. The most sustainable product is the one you never replace.",
        ],
      },
      {
        heading: "Sensible packaging",
        paragraphs: [
          "We don't add unnecessary plastic to shipments and use recyclable packing materials wherever possible.",
        ],
      },
      {
        heading: "Repair and warranty",
        paragraphs: [
          "Instead of “toss it and buy new” — a 12-month warranty and support that looks for a fix before a replacement.",
        ],
      },
    ],
  },
  press: {
    label: "Company",
    title: "Press",
    intro: "Writing about tech, e-commerce or design? We'd love to talk.",
    sections: [
      {
        heading: "For media",
        paragraphs: [
          "We provide comments, high-resolution product photography and brand information. Write to press@novastore.com.ua — we reply within one business day.",
        ],
      },
      {
        heading: "Creator collaborations",
        paragraphs: [
          "We partner with tech reviewers and content creators. Tell us about your audience and let's shape a format together.",
        ],
      },
    ],
  },
  terms: {
    label: "Legal",
    title: "Terms of Service",
    intro:
      "These terms govern the use of novastore.com.ua and placing orders in the NOVA store.",
    sections: [
      {
        heading: "1. General",
        paragraphs: [
          "By placing an order you agree to these terms and to the Privacy Policy. The store operates under the laws of Ukraine, including the Consumer Rights Protection Law and the E-commerce Law.",
        ],
      },
      {
        heading: "2. Orders and payment",
        paragraphs: [
          "Prices are listed in UAH. Payments are processed by Monobank (card, Apple Pay, Google Pay). An order is confirmed after successful payment authorization; the amount is captured when the order ships.",
        ],
      },
      {
        heading: "3. Delivery and returns",
        paragraphs: [
          "Delivery is provided by Nova Poshta under the conditions described on the Shipping page. Returns and exchanges follow the Returns page and applicable law (14 days).",
        ],
      },
      {
        heading: "4. Warranty and liability",
        paragraphs: [
          "Products carry a 12-month warranty. The store is not liable for indirect damages caused by using products against their intended purpose.",
        ],
      },
      {
        heading: "5. Contact",
        paragraphs: ["For any questions about these terms: support@novastore.com.ua."],
      },
    ],
  },
  privacy: {
    label: "Legal",
    title: "Privacy Policy",
    intro:
      "We collect only the data needed to fulfill your order — and we never sell it to third parties.",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [],
        list: [
          "Contact details: name, email, phone — to reach you about the order.",
          "Delivery address: city and Nova Poshta branch, or a courier address.",
          "Order history — for warranty service and repeat purchases.",
        ],
      },
      {
        heading: "What we DON'T collect",
        paragraphs: [
          "Card data is processed entirely on Monobank's side. We never see, transmit or store your card number — when you save a card for one-click checkout, only an anonymized token exists, held by Monobank.",
        ],
      },
      {
        heading: "How we use data",
        paragraphs: [
          "Fulfilling orders, delivery (sharing data with Nova Poshta), warranty support and — only with your consent — product news. You can request deletion of your data anytime at support@novastore.com.ua.",
        ],
      },
      {
        heading: "Storage and protection",
        paragraphs: [
          "Data is stored on secured servers and transferred over encrypted connections (HTTPS). Access is limited to staff processing orders.",
        ],
      },
    ],
  },
  cookies: {
    label: "Legal",
    title: "Cookie Policy",
    intro:
      "Cookies help the site remember your cart, language and preferences. Here's exactly what we use.",
    sections: [
      {
        heading: "Essential cookies",
        paragraphs: [
          "Cart identifier, authentication session and interface language. The store simply won't work without them — they can't be disabled.",
        ],
      },
      {
        heading: "Analytics",
        paragraphs: [
          "We may use anonymized visit analytics to understand which pages help and which don't. This data does not identify you personally.",
        ],
      },
      {
        heading: "Managing cookies",
        paragraphs: [
          "You can delete or block cookies in your browser settings. Note that the cart and language will then reset between visits.",
        ],
      },
    ],
  },
};

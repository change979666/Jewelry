// ---------------------------------------------------------------------------
//  Jewelry — UI chrome dictionary (en | ar)
//
//  SCOPE: this file holds *interface strings only* (navigation, buttons, form
//  labels, empty states, error messages). Content-type copy that is authored
//  per page — FAQ entries, the CTA band, footer collection labels — lives next
//  to its component as a local `en` / `ar` const, so page content changes never
//  require touching the UI dictionary.
//
//  RULES
//   1. Key sets for `en` and `ar` are identical — `ar` is authored natively
//      (never machine-translated) and must not rely on the English fallback.
//   2. The admin console does not use this file (its copy is inline).
//   3. Never leave a key used by a page out of this dictionary: `t()` returns
//      the raw dot-path when a key is missing, which leaks "home.hero_title"
//      into the rendered page.
// ---------------------------------------------------------------------------

export type Locale = "en" | "ar";

export const LOCALES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export const DEFAULT: Locale = "en";
const ORDER: Locale[] = ["en", "ar"];

function next(current: Locale): Locale {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length];
}

// ---- Translation tree ----------------------------------------------------
const dict: Record<string, any> = {
  en: {
    site: {
      description:
        "Modern everyday jewelry for women in KSA and the UAE — earrings, necklaces, bracelets and gift sets with cash on delivery and easy returns.",
    },

    nav: {
      home: "Home",
      collections: "Collections",
      new_arrivals: "New Arrivals",
      best_sellers: "Best Sellers",
      everyday: "Everyday",
      gulf: "Gulf Design",
      gift: "Gift",
      statement: "Statement",
      gold: "Gold",
      silver: "Silver",
      pearls: "Pearls",
      journal: "Journal",
      about: "About",
      about_company: "About Us",
      about_faq: "FAQ",
      about_contact: "Contact",
      faq: "FAQ",
      contact: "Contact",
      cart: "Cart",
    },

    a11y: {
      menu_open: "Open menu",
      newsletter_email: "Email for newsletter",
      theme_toggle: "Toggle theme",
    },

    hero: {
      title: "Fine jewelry, made for every day",
    },

    home: {
      hero_title: "Fine jewelry, made for every day",
      hero_subtitle:
        "Hand-finished pieces in gold, silver and pearls — delivered across Saudi Arabia and the UAE with cash on delivery.",
      collections_title: "Shop by Collection",
      new_arrivals: "New Arrivals",
      section_everyday: "Everyday Essentials",
      section_gulf: "Gulf Design",
      section_gift: "Gift Picks",
      editorial_title: "From the Journal",
      shop_everyday: "Shop Everyday",
      shop_gifts: "Shop Gifts",
      trust_cod_title: "Cash on Delivery",
      trust_cod_text: "Pay when your order arrives — no card required.",
      trust_shipping_title: "Free Shipping",
      trust_shipping_text: "Free delivery on orders over SAR 300 or AED 300.",
      trust_returns_title: "14-Day Returns",
      trust_returns_text: "Unworn pieces in original packaging, no questions asked.",
      empty_catalog: "New pieces are on their way — check back shortly.",
    },

    collection: {
      products_count: "pieces",
      sort_label: "Sort",
      sort_newest: "Newest",
      sort_price_asc: "Price: low to high",
      sort_price_desc: "Price: high to low",
      sort_title: "Name",
      empty: "No pieces in this collection yet.",
      prev: "Previous",
      next: "Next",
      back_home: "Back to Home",
    },

    product: {
      facts_title: "Details",
      description_title: "Description",
      variant_label: "Finish / Size",
      quantity_label: "Quantity",
      sold_out: "Sold out",
      add_to_cart: "Add to Cart",
      fact_material: "Material",
      fact_base_material: "Base material",
      fact_plating: "Plating",
      fact_color: "Colour",
      fact_dimensions: "Dimensions",
      fact_weight: "Weight",
      fact_care: "Care",
      fact_size: "Size",
    },

    cart: {
      title: "Shopping Cart",
      empty: "Your cart is empty.",
      continue: "Continue Shopping",
      remove: "Remove",
      quantity: "Quantity",
      subtotal: "Subtotal",
      total: "Total",
      checkout: "Checkout",
      update: "Update",
    },

    checkout: {
      title: "Checkout",
      contact_section: "Contact",
      address_section: "Shipping Address",
      payment_section: "Payment",
      first_name: "First name",
      last_name: "Last name",
      email: "Email",
      phone: "Mobile number",
      country_ksa: "Saudi Arabia",
      country_uae: "United Arab Emirates",
      city: "City",
      address: "Street address",
      cod: "Cash on Delivery",
      online: "Card payment (coming soon)",
      summary: "Order Summary",
      subtotal: "Subtotal",
      shipping: "Shipping",
      free: "Free",
      vat: "VAT",
      total: "Total",
      place_order: "Place Order",
      stock_warning: "One or more items are no longer available in the requested quantity.",
      totals_note: "Shipping and VAT are calculated from your delivery country.",
      error_cart_empty: "Your cart is empty.",
      error_name_required: "Please enter your first and last name.",
      error_email_invalid: "Please enter a valid email address.",
      error_phone_required: "Please enter a mobile number so we can reach you about delivery.",
      error_address_required: "Please enter your city and street address.",
      error_payment_unavailable: "This payment method is not available yet. Please choose cash on delivery.",
      error_market_unavailable: "Delivery to this country is not available yet.",
      error_item_unavailable: "An item in your cart is no longer available. Please review your cart.",
      error_out_of_stock: "An item sold out while you were checking out. Please review your cart.",
      error_duplicate_submission: "This order was already placed. Check your confirmation email.",
      error_unknown: "Something went wrong while placing your order. Please try again.",
    },

    blog: {
      page_title: "Journal",
      page_subtitle: "Notes on styling, jewelry care and gift ideas from our studio.",
      eyebrow: "Journal",
      latest: "Latest",
      all_categories: "All topics",
      articles_count: "articles",
      read_more: "Read article →",
      min_read: "min read",
      empty: "No articles published yet — check back soon.",
      no_results: "No articles match your search. Try a different keyword.",
      search_placeholder: "Search articles…",
      related_title: "Related articles",
      prev_article: "Previous article",
      next_article: "Next article",
      toc_title: "In this article",
      share_title: "Share",
      author_about: "About the author",
    },

    search: {
      label: "Search",
      open: "to open",
      close: "to close",
      navigate: "to navigate",
      placeholder: "Search articles and guides…",
      hint: "Start typing to search articles and guides",
      no_results: "No results for",
      did_you_mean: "Did you mean",
      popular: "Popular searches",
      empty_title: "Can't find what you need?",
      empty_text: "Browse the collection or message us on WhatsApp — we usually reply the same day.",
      posts: "Journal",
      guides: "Guides",
      browse: "Browse the collection",
    },

    shop: {
      add_to_cart: "Add to Cart",
      facebook_page: "Facebook Page",
      messenger: "Messenger",
      whatsapp_chat: "WhatsApp Chat",
    },

    footer: {
      explore: "Explore",
      contact: "Get in touch",
      subscribe: "Subscribe",
      placeholder: "Your email",
      newsletter_title: "New arrivals, once a month",
      newsletter_subtitle: "New pieces, styling notes and offers — no spam.",
      newsletter_ok: "Thanks! You're on the list.",
      newsletter_exists: "You're already subscribed — thanks!",
      newsletter_invalid: "Please enter a valid email address.",
      newsletter_error: "Something went wrong. Please try again.",
      popular_products: "Shop",
      popular_categories: "Categories",
      popular_articles: "From the Journal",
      whatsapp: "WhatsApp",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      sitemap: "Sitemap",
      copyright: "© {year} {name}. All rights reserved.",
      tagline: "{name} — everyday fine jewelry, delivered across KSA and the UAE.",
    },

    order: {
      confirmed_title: "Order Confirmed!",
      thanks: "Thank you for your purchase. Our team will contact you to arrange delivery.",
      details: "Order Details",
      number: "Order Number",
      total: "Total Amount",
      payment_method: "Payment Method",
      status: "Status",
      continue: "Continue Shopping",
      status_label: {
        PENDING_CONFIRMATION: "Awaiting confirmation",
        CONFIRMED: "Confirmed",
        PROCESSING: "Preparing your order",
        SHIPPED: "Shipped",
        OUT_FOR_DELIVERY: "Out for delivery",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
        RTO: "Returned to sender",
        RETURNED: "Returned",
        REFUNDED: "Refunded",
        DELIVERY_FAILED: "Delivery failed",
        NDR: "Delivery attempted",
      },
    },

    cta: "Shop Now",
    cta_short: "Shop",
  },

  ar: {
    site: {
      description:
        "مجوهرات عصرية للاستخدام اليومي في السعودية والإمارات — أقراط وقلادات وأساور وأطقم هدايا مع الدفع عند الاستلام وإرجاع سهل.",
    },

    nav: {
      home: "الرئيسية",
      collections: "المجموعات",
      new_arrivals: "وصل حديثًا",
      best_sellers: "الأكثر مبيعًا",
      everyday: "اليومية",
      gulf: "تصميم خليجي",
      gift: "الهدايا",
      statement: "القطع المميزة",
      gold: "الذهب",
      silver: "الفضة",
      pearls: "اللؤلؤ",
      journal: "المدونة",
      about: "عن المتجر",
      about_company: "من نحن",
      about_faq: "الأسئلة الشائعة",
      about_contact: "اتصل بنا",
      faq: "الأسئلة الشائعة",
      contact: "اتصل بنا",
      cart: "سلة التسوق",
    },

    a11y: {
      menu_open: "افتح القائمة",
      newsletter_email: "البريد الإلكتروني للنشرة",
      theme_toggle: "تبديل المظهر",
    },

    hero: {
      title: "مجوهرات راقية لكل يوم",
    },

    home: {
      hero_title: "مجوهرات راقية لكل يوم",
      hero_subtitle:
        "قطع مصنوعة بعناية من الذهب والفضة واللؤلؤ — توصيل إلى السعودية والإمارات مع الدفع عند الاستلام.",
      collections_title: "تسوق حسب المجموعة",
      new_arrivals: "وصل حديثًا",
      section_everyday: "القطع اليومية",
      section_gulf: "تصميم خليجي",
      section_gift: "اختيارات الهدايا",
      editorial_title: "من المدونة",
      shop_everyday: "تسوق اليومية",
      shop_gifts: "تسوق الهدايا",
      trust_cod_title: "الدفع عند الاستلام",
      trust_cod_text: "ادفع عند وصول طلبك — دون الحاجة إلى بطاقة.",
      trust_shipping_title: "شحن مجاني",
      trust_shipping_text: "شحن مجاني للطلبات فوق 300 ريال أو 300 درهم.",
      trust_returns_title: "إرجاع خلال 14 يومًا",
      trust_returns_text: "للقطع غير المستخدمة بتغليفها الأصلي، دون أي تعقيدات.",
      empty_catalog: "قطع جديدة في الطريق — عد إلينا قريبًا.",
    },

    collection: {
      products_count: "قطعة",
      sort_label: "ترتيب",
      sort_newest: "الأحدث",
      sort_price_asc: "السعر: من الأقل إلى الأعلى",
      sort_price_desc: "السعر: من الأعلى إلى الأقل",
      sort_title: "الاسم",
      empty: "لا توجد قطع في هذه المجموعة بعد.",
      prev: "السابق",
      next: "التالي",
      back_home: "العودة إلى الرئيسية",
    },

    product: {
      facts_title: "التفاصيل",
      description_title: "الوصف",
      variant_label: "التشطيب / المقاس",
      quantity_label: "الكمية",
      sold_out: "نفدت الكمية",
      add_to_cart: "أضف إلى السلة",
      fact_material: "المادة",
      fact_base_material: "المعدن الأساسي",
      fact_plating: "الطلاء",
      fact_color: "اللون",
      fact_dimensions: "الأبعاد",
      fact_weight: "الوزن",
      fact_care: "العناية",
      fact_size: "المقاس",
    },

    cart: {
      title: "سلة التسوق",
      empty: "سلة التسوق فارغة.",
      continue: "مواصلة التسوق",
      remove: "إزالة",
      quantity: "الكمية",
      subtotal: "المجموع الفرعي",
      total: "الإجمالي",
      checkout: "إتمام الشراء",
      update: "تحديث",
    },

    checkout: {
      title: "إتمام الشراء",
      contact_section: "بيانات التواصل",
      address_section: "عنوان التوصيل",
      payment_section: "طريقة الدفع",
      first_name: "الاسم الأول",
      last_name: "اسم العائلة",
      email: "البريد الإلكتروني",
      phone: "رقم الجوال",
      country_ksa: "المملكة العربية السعودية",
      country_uae: "الإمارات العربية المتحدة",
      city: "المدينة",
      address: "العنوان التفصيلي",
      cod: "الدفع عند الاستلام",
      online: "الدفع بالبطاقة (قريبًا)",
      summary: "ملخص الطلب",
      subtotal: "المجموع الفرعي",
      shipping: "الشحن",
      free: "مجاني",
      vat: "ضريبة القيمة المضافة",
      total: "الإجمالي",
      place_order: "تأكيد الطلب",
      stock_warning: "بعض القطع لم تعد متوفرة بالكمية المطلوبة.",
      totals_note: "يُحسب الشحن والضريبة حسب بلد التوصيل.",
      error_cart_empty: "سلة التسوق فارغة.",
      error_name_required: "يرجى إدخال الاسم الأول واسم العائلة.",
      error_email_invalid: "يرجى إدخال بريد إلكتروني صحيح.",
      error_phone_required: "يرجى إدخال رقم الجوال للتواصل بشأن التوصيل.",
      error_address_required: "يرجى إدخال المدينة والعنوان التفصيلي.",
      error_payment_unavailable: "طريقة الدفع هذه غير متاحة حاليًا. يرجى اختيار الدفع عند الاستلام.",
      error_market_unavailable: "التوصيل إلى هذا البلد غير متاح حاليًا.",
      error_item_unavailable: "إحدى القطع في سلتك لم تعد متاحة. يرجى مراجعة السلة.",
      error_out_of_stock: "نفدت إحدى القطع أثناء إتمام الشراء. يرجى مراجعة السلة.",
      error_duplicate_submission: "تم إنشاء هذا الطلب مسبقًا. راجع رسالة التأكيد.",
      error_unknown: "حدث خطأ أثناء إنشاء الطلب. يرجى المحاولة مرة أخرى.",
    },

    blog: {
      page_title: "المدونة",
      page_subtitle: "ملاحظات عن التنسيق والعناية بالمجوهرات وأفكار الهدايا من استوديونا.",
      eyebrow: "المدونة",
      latest: "الأحدث",
      all_categories: "كل المواضيع",
      articles_count: "مقالات",
      read_more: "اقرأ المقال ←",
      min_read: "دقائق قراءة",
      empty: "لا توجد مقالات منشورة بعد — عد إلينا قريبًا.",
      no_results: "لا توجد مقالات مطابقة لبحثك. جرّب كلمة أخرى.",
      search_placeholder: "ابحث في المقالات…",
      related_title: "مقالات ذات صلة",
      prev_article: "المقال السابق",
      next_article: "المقال التالي",
      toc_title: "في هذا المقال",
      share_title: "شارك",
      author_about: "عن الكاتب",
    },

    search: {
      label: "بحث",
      open: "للفتح",
      close: "للإغلاق",
      navigate: "للتنقل",
      placeholder: "ابحث في المقالات والأدلة…",
      hint: "ابدأ الكتابة للبحث في المقالات والأدلة",
      no_results: "لا نتائج عن",
      did_you_mean: "هل تقصد",
      popular: "الأكثر بحثًا",
      empty_title: "لم تجد ما تبحث عنه؟",
      empty_text: "تصفّح المجموعة أو راسلنا على واتساب — عادةً نرد في اليوم نفسه.",
      posts: "المدونة",
      guides: "الأدلة",
      browse: "تصفّح المجموعة",
    },

    shop: {
      add_to_cart: "أضف إلى السلة",
      facebook_page: "صفحة فيسبوك",
      messenger: "ماسنجر",
      whatsapp_chat: "محادثة واتساب",
    },

    footer: {
      explore: "تصفّح",
      contact: "تواصل معنا",
      subscribe: "اشترك",
      placeholder: "بريدك الإلكتروني",
      newsletter_title: "وصل حديثًا، مرة كل شهر",
      newsletter_subtitle: "قطع جديدة وملاحظات تنسيق وعروض — دون إزعاج.",
      newsletter_ok: "شكرًا! تم تسجيل بريدك.",
      newsletter_exists: "أنت مشترك بالفعل — شكرًا لك!",
      newsletter_invalid: "يرجى إدخال بريد إلكتروني صحيح.",
      newsletter_error: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      popular_products: "تسوق",
      popular_categories: "الأقسام",
      popular_articles: "من المدونة",
      whatsapp: "واتساب",
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      sitemap: "خريطة الموقع",
      copyright: "© {year} {name}. جميع الحقوق محفوظة.",
      tagline: "{name} — مجوهرات راقية للاستخدام اليومي، تُوصَّل إلى السعودية والإمارات.",
    },

    order: {
      confirmed_title: "تم تأكيد الطلب!",
      thanks: "شكرًا لشرائك. سيتواصل معك فريقنا لترتيب التوصيل.",
      details: "تفاصيل الطلب",
      number: "رقم الطلب",
      total: "المبلغ الإجمالي",
      payment_method: "طريقة الدفع",
      status: "الحالة",
      continue: "مواصلة التسوق",
      status_label: {
        PENDING_CONFIRMATION: "بانتظار التأكيد",
        CONFIRMED: "تم التأكيد",
        PROCESSING: "جاري تجهيز الطلب",
        SHIPPED: "تم الشحن",
        OUT_FOR_DELIVERY: "قيد التوصيل",
        DELIVERED: "تم التوصيل",
        CANCELLED: "ملغي",
        RTO: "أُعيد إلى المرسل",
        RETURNED: "تم الإرجاع",
        REFUNDED: "تم رد المبلغ",
        DELIVERY_FAILED: "فشل التوصيل",
        NDR: "تمت محاولة التوصيل",
      },
    },

    cta: "تسوق الآن",
    cta_short: "تسوق",
  },
};

/** Resolve nested dot-path like "home.hero_title" — returns string */
export function t(locale: Locale, path: string): string {
  const keys = path.split(".");
  let v: unknown = dict[locale];
  for (const k of keys) {
    if (v && typeof v === "object") v = (v as Record<string, unknown>)[k];
    else {
      v = _get(DEFAULT, path);
      break;
    }
  }
  if (typeof v === "string") {
    // Warn in dev when a non-default locale is missing a key
    if (locale !== DEFAULT && typeof _get(locale, path) !== "string") {
      console.warn(
        `[i18n] missing "${locale}" translation for "${path}" — falling back to English`,
      );
    }
    return v;
  }
  const fb = _get(DEFAULT, path);
  if (typeof fb === "string") return fb;
  // Key doesn't exist in any language — this is a bug
  console.warn(`[i18n] key "${path}" not found in any locale — returning raw path`);
  return path;
}

/** Resolve nested dot-path — returns the raw value (array, object, string) */
export function ta(locale: Locale, path: string): unknown {
  const keys = path.split(".");
  let v: unknown = dict[locale];
  for (const k of keys) {
    if (v && typeof v === "object") v = (v as Record<string, unknown>)[k];
    else return _get(DEFAULT, path);
  }
  if (v !== undefined) return v;
  return _get(DEFAULT, path);
}

/** Internal dotted-path resolver */
function _get(loc: Locale, path: string): unknown {
  const keys = path.split(".");
  let v: unknown = dict[loc];
  for (const k of keys) {
    if (v && typeof v === "object") v = (v as Record<string, unknown>)[k];
    else return undefined;
  }
  return v;
}

/** All supported locales (used by getStaticPaths & hreflang) */
export const LOCALE_LIST: Locale[] = ["en", "ar"];

/**
 * REMOVED: `localeStaticPaths()`.
 *
 * It used to build `getStaticPaths()` for every `[lang]/` page, one entry per
 * locale, passing `locale` as a prop. With `output: "server"` that silently did
 * nothing — `Astro.props` is never injected for on-demand rendered routes — so
 * every localized page fell back to `"en"` and the entire Arabic storefront
 * rendered in English. Because the helper's very existence invited that bug
 * back, it is gone rather than documented.
 *
 * Do NOT reintroduce prop-based locale passing. Localized pages must validate
 * the URL segment with `requireLocale(Astro.params.lang)` (src/lib/locale.ts);
 * the only case where `getStaticPaths` is legitimate is a page that opts into
 * `export const prerender = true`.
 */

/** Strip the leading locale segment from a pathname (e.g. "/ar/collection/gold" → "/collection/gold") */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if (LOCALE_LIST.includes(parts[1] as Locale)) {
    return "/" + parts.slice(2).join("/");
  }
  return pathname;
}

/**
 * Detect the locale from a pathname (e.g. "/ar/collection/gold" → "ar").
 * Used instead of Astro's `Astro.currentLocale`, which is unavailable when
 * `i18n.routing` is "manual".
 */
export function localeFromPath(pathname: string): Locale {
  const parts = pathname.split("/");
  const first = parts[1];
  return (LOCALE_LIST.includes(first as Locale) ? first : DEFAULT) as Locale;
}

/**
 * Prefix a locale-agnostic path with its locale segment.
 *
 * Every page in this project lives under a `[lang]` segment, INCLUDING the
 * default locale (Astro is configured with `prefixDefaultLocale` semantics, and
 * /en/... is the real route for English). So `en` is prefixed too — an
 * unprefixed "/cart" would 404.
 *
 * Replaces Astro's `getRelativeLocaleUrl`, whose prefixing behaviour follows the
 * i18n routing mode and silently dropped the prefix under `routing: "manual"`.
 */
export function localizedUrl(locale: Locale, pathWithoutLocale: string): string {
  const path = pathWithoutLocale && pathWithoutLocale !== "/" ? pathWithoutLocale : "";
  const suffix = path.startsWith("/") ? path : path ? "/" + path : "";
  return `/${locale}${suffix}/`;
}

/** Next locale in cycle (en → ar → en) */
export function nextLocale(current: Locale): Locale {
  return next(current);
}

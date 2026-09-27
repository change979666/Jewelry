// ---------------------------------------------------------------------------
//  Jewelry — i18n
//  Supports: en | ar  (Arabic rendered native RTL); ar falls back to English until native copy is authored
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
    // P0-2 Decision Inbox (/admin-v2/inbox) — Owner work-entry page strings
    adminInbox: {
      title: "决策收件箱",
      subtitle:
        "所有需要老板处理的事项汇总到一个队列：现在要处理什么、为什么、在哪里操作、处理后记录什么。",
      refresh: "刷新",
      loading: "正在加载数据源…",
      load_failed: "加载失败",
      empty_title: "收件箱已清空",
      empty_desc: "当前无需决策。来自增长、知识、任务和询盘的新事项会出现在这里。",
      partial_failed: "部分数据源加载失败——下方计数可能不完整。",
      queue_total: "条待决策",
      group_all: "全部",
      group_growth: "增长",
      group_knowledge: "知识",
      group_tasks: "任务",
      group_inquiries: "询盘",
      group_autonomy: "自治",
      group_product: "商品数据",
      col_item: "事项",
      col_why: "为什么重要",
      col_action: "操作",
      col_recorded: "处理后记录",
      handle: "处理 →",
      ack_action: "标记已处理",
      ack_outcome_handled: "已处理",
      ack_outcome_adopted: "已采纳",
      ack_outcome_rejected: "已拒绝",
      ack_outcome_later: "稍后",
      ack_done: "结果已记录——已移至「已处理」。",
      ack_failed: "记录结果失败",
      ack_saving: "保存中…",
      handled_title: "已处理",
      handled_show: "显示已处理",
      handled_desc:
        "决策已写回（本次会话或更早）。每次确认都会在 audit_logs 中留下一条可审计记录。",
      handled_empty: "暂无已处理事项。",
      handled_badge: "已处理",
      source_acks: "已处理确认",
      recorded_growth:
        "你的决定（批准/跳过）已写回 growth_opportunities；应用的动作会做 T+14 验证。",
      recorded_knowledge:
        "批准/拒绝已写入 knowledge_v2（verified/deprecated）并重新打开生产积压门禁。",
      recorded_tasks: "批准/拒绝已记录在 mission 或 task 上，并出现在审计轨迹中。",
      recorded_inquiries: "状态（已联系/洽谈中/成交/流失）已存到询盘并汇入漏斗。",
      recorded_autonomy: "自动修复开关和预算变更会作为一次 mission 审计。",
      recorded_product: "标记商品已处理会写入审计轨迹；它会从数据缺口队列中消失，明天不再重复。",
      autonomy_note: "治理闸门——决定哪些动作可以自动执行。",
      wonlost_title: "待记录成交/流失",
      wonlost_desc: "处于「已联系/洽谈中」超过 {days} 天的询盘——记录结果以闭环。",
      wonlost_none: "无滞留询盘——所有「已联系/洽谈中」询盘均在 {days} 天内更新过。",
      won: "成交",
      lost: "流失",
      won_done: "已记录成交——现在计入漏斗与归因。",
      lost_done: "已记录流失。",
      wonlost_failed: "记录结果失败",
      recorded_badge: "已记录",
      view_all: "查看全部",
      source_command_center: "AI 指挥中心",
      source_action_items: "行动项",
      source_autonomy: "自治",
      source_knowledge: "知识审核",
      source_growth: "增长机会",
      source_inquiries: "询盘",
      source_data_gaps: "商品数据缺口",
      days_ago: "天前",
      attribution_title: "询盘归因",
      attribution_desc: "来源 → 会话 → 行为旅程 → 状态（针对近期询盘，读取统计归因联表）。",
      attribution_empty: "暂无带归因的询盘——询盘到达后旅程会出现在这里。",
      attribution_no_session: "该询盘暂无跟踪会话旅程。",
      attribution_events: "{n} 个跟踪事件",
      source_attribution: "归因",
      scheduler_label: "本地调度器上次运行",
      scheduler_ok: "正常",
      scheduler_stale: "滞后",
      scheduler_warn: "滞后",
      scheduler_critical: "宕机",
      scheduler_never: "尚未记录心跳",
      scheduler_age: "{n} 分钟前",
      scheduler_stale_hint:
        "本地任务调度器疑似停滞（>{n} 分钟）——老板电脑关机？GH Actions 仅为兜底。",
    },
    adminKnowledgeConsumption: {
      title: "知识消费",
      desc: "每条活跃知识被谁消费、产生了什么、是否有错误知识进入生产链路。",
      load_failed: "加载失败",
      active_knowledge: "活跃知识",
      consumed: "已消费",
      never_consumed: "从未消费",
      consume_events: "消费事件",
      flagged_review: "需复核",
      top_title: "消费最多",
      col_knowledge: "知识",
      col_count: "次数",
      col_last: "最近消费",
      col_roles: "消费方",
      col_outcome: "关联 mission",
      top_empty: "暂无消费记录——AI 角色向 prompt 注入知识后事件会出现。",
      never_title: "从未消费（库存）",
      never_desc: "尚无任何 AI 消费方注入的活跃知识。",
      never_empty: "每条活跃知识都至少被消费过一次。",
      review_title: "错误知识监控",
      review_desc: "被消费的知识，其关联 mission 后来被真实性或质量闸门拦截/失败。",
      review_empty: "暂无被消费知识与拦截/失败的 mission 关联。",
      needs_review: "需复核",
      failed_title: "近期被拦截/失败的 mission",
      failed_desc: "当消费无法归因到具体 mission 时的交叉核对清单。",
      failed_empty: "近期无被拦截或失败的 mission 步骤。",
      limitation: "归因局限",
    },
    nav: {
      home: "Home",
      products: "Products",
      services: "Services",
      oem: "OEM & ODM",
      sourcing: "Sourcing",
      factory: "Factory",
      about: "About",
      blog: "Blog",
      case_studies: "Case Studies",
      resources: "Resources",
      solutions: "Solutions",
      faq: "FAQ",
      contact: "Contact",
      workspace: "My Workspace",
      solutions_industries: "Industry Solutions",
      solutions_oem: "OEM / ODM Services",
      solutions_sourcing: "China Sourcing",
      solutions_downloads: "Download Center",
      resources_blog: "Blog & Insights",
      resources_downloads: "Download Center",
      about_company: "About Jewelry",
      about_factory: "Factory & Capabilities",
      about_certificates: "Certifications & Compliance",
      about_faq: "FAQ",
      shop: "Shop",
      videos: "Product Videos",
      cart: "Cart",
    },
    videos: {
      page_title: "Product Videos",
      eyebrow: "See it in action",
      page_subtitle:
        "Real product footage and usage demos — check quality, features and details before you request a quote.",
      empty: "No videos published yet. Check back soon.",
      loading: "Loading…",
      view_product: "View Product",
      get_quote: "Get a Quote",
      related_products: "Featured in this video",
      no_products: "This video is a general showcase — browse our catalog for related products.",
      back_to_list: "← All Product Videos",
      not_found: "Video not found",
      not_found_desc: "This video may have been unpublished. Browse all product videos instead.",
      featured: "Featured Video",
      latest: "Latest Videos",
      all_videos: "All Videos",
      load_more: "Load More Videos",
      related_videos: "Related Videos",
      share: "Share",
      share_copied: "Link copied to clipboard",
      category_label: "Category",
      tags_label: "Tags",
      spec_duration: "Duration",
      spec_format: "Format",
      spec_orientation: "Orientation",
      format_short: "Short",
      format_standard: "Standard",
      orientation_landscape: "Landscape",
      orientation_portrait: "Portrait",
      orientation_square: "Square",
      cat_product_demo: "Product Demo",
      cat_product_showcase: "Product Showcase",
      cat_how_to: "How-To",
      cat_usage_tips: "Usage Tips",
      cat_fragrance_knowledge: "Fragrance Knowledge",
      cat_applications: "Applications",
      cat_factory_oem: "Factory & OEM",
      cat_industry_insights: "Industry Insights",
      cat_faq: "FAQ",
      cat_other: "Other",
    },
    cta: "Get a Quote",
    cta_short: "Get a Quote",
    theme_label: "Theme: ",
    lang_label: "Language: ",
    // -----------------------------------------------------------------
    // Product catalog PDF downloads (V5.69). Files are streamed from R2 by
    // functions/api/downloads/catalog/[key].ts, not served from public/ —
    // they are 3–161 MB each, above the Pages ~25 MB static asset cap.
    // Copy stays plain and factual: these are the catalog files we actually
    // hold, described by what they cover. No pricing, no invented claims.
    // -----------------------------------------------------------------
    catalogs: {
      title: "Product Catalogs",
      subtitle:
        "Downloadable PDF catalogs for our home-fragrance ranges — product and package dimensions, weights and carton data per item. Some files are large, so use a stable connection.",
      eyebrow: "PDF downloads",
      card_desc:
        "Real product catalog PDFs by category — dimensions, packaging and carton details.",
      download: "Download",
      view_online: "View online",
      file_size: "Size",
      pages: "pages",
      large_file_warning:
        "Large file — the full master catalog is over 160 MB and can take several minutes to download.",
      note: "These are the catalog files we actually hold. File sizes and page counts are the real values of the current uploads. If a category you need is not listed here, ask us and we will send what we have.",
      cta_title: "Need Pricing or Samples?",
      cta_text:
        "Catalogs list products and packaging, not prices. Send us the items you want and your target market — we reply with pricing, MOQ and lead time.",
      cat_aroma_crystal: "Aroma Crystal",
      cat_candles: "Scented Candles",
      cat_gift_box: "Gift Box",
      cat_reed_diffuser: "Reed Diffuser",
      cat_room_spray: "Room Spray",
      cat_sachet_car: "Sachet & Car Diffuser",
      cat_curated: "Curated 2026 (EN)",
      cat_master: "Full Master Catalog (EN)",
      desc_aroma_crystal:
        "Aroma crystal home-fragrance items with net volume, product and package dimensions, weight and carton quantity.",
      desc_candles:
        "Scented candle range with vessel options, plus per-item dimensions, weight and carton data.",
      desc_gift_box:
        "Gift box sets combining reed diffuser with candle or aroma crystal, including box and carton dimensions.",
      desc_reed_diffuser:
        "Reed diffuser range including ceramic vessels, with per-item dimensions, weight and carton data.",
      desc_room_spray:
        "Room spray formats (30 / 50 / 100 ml) with product and package dimensions, weight and carton quantity.",
      desc_sachet_car:
        "Scented sachets, car diffusers, essential oils, scented gel, gypsum, solid fragrance and potpourri.",
      desc_curated:
        "Selected-collection catalog, English edition dated 20 January 2026 — a cross-category shortlist of room-fragrance items.",
      desc_master:
        "Complete English master product catalog covering the full home-fragrance range, series by series.",
    },
    site: {
      name: "Jewelry",
      tagline: "Aroma Manufacturing & China Sourcing",
      description:
        "Jewelry helps international buyers source premium aroma products and trusted factories across China — from essential oils to OEM/ODM manufacturing and consolidated shipping.",
      address: "Yiwu, Zhejiang, China",
      email: "sales@jewelry.com",
      phone: "+86-159-9322-8742",
    },
    a11y: {
      menu_open: "Open menu",
      theme_toggle: "Toggle theme",
      newsletter_email: "Email for newsletter",
    },
    hero: {
      eyebrow: "China Aroma Supply Chain · Factory & Curated",
      title: "Launch Your Aroma Brand Without the Factory Risk",
      subtitle:
        "Private-label essential oils, scented candles and reed diffusers — ISO 9001 & IFRA compliant, MOQ from 500 units, samples shipped in 7–10 days.",
      explore: "Explore Products",
      quote: "Request a Quote",
      cta_note: "Reply within 24 hours · No commitment",
      image_alt: "Private-label aroma products manufactured by Jewelry",
      card_eyebrow: "Why brands choose Jewelry",
      card_points: ["ISO 9001 & IFRA compliant", "MOQ from 500 units", "Samples in 7–10 days"],
      stat1_num: "40+",
      stat1_lbl: "Countries served",
      stat2_num: "300+",
      stat2_lbl: "Verified factories",
      stat3_num: "12yr",
      stat3_lbl: "In business",
    },
    lanes: [
      {
        icon: "box",
        title: "OEM / ODM",
        desc: "Custom fragrance, private label, packaging & compliance.",
        href: "/oem",
        cta: "Start OEM Project",
      },
      {
        icon: "grid",
        title: "Ready-to-Ship",
        desc: "Wholesale aroma products, curated & verified.",
        href: "/shop",
        cta: "Browse Products",
      },
      {
        icon: "globe",
        title: "China Sourcing",
        desc: "Find, verify & consolidate products from China.",
        href: "/sourcing",
        cta: "Start Sourcing",
      },
    ],
    why: {
      eyebrow: "Why Jewelry",
      title: "A buying partner, not just a middleman",
      subtitle:
        "We de-risk your sourcing with verification, expertise, and end-to-end ownership of the process.",
      items: [
        {
          title: "Factory Direct",
          desc: "Our own blending and filling campus — no middlemen, transparent pricing, and direct control over every batch.",
          icon: "pin",
          proof: "12,000 m² own campus",
        },
        {
          title: "OEM / ODM",
          desc: "Custom fragrance development, private-label packaging and compliance docs, from brief to finished goods.",
          icon: "drop",
          proof: "500+ private-label projects",
        },
        {
          title: "Fast Delivery",
          desc: "Sampling in days and flexible production lines keep lead times short for growing brands.",
          icon: "clock",
          proof: "Samples in 7–10 days",
        },
        {
          title: "Quality Control",
          desc: "A 24/7 QC lab with GC-MS testing and batch sampling — every shipment leaves with an inspection report.",
          icon: "check",
          proof: "GC-MS tested, every batch",
        },
      ],
    },
    process: {
      eyebrow: "How We Work",
      title: "From inquiry to delivery in six clear steps",
      subtitle: "A transparent process with a dedicated contact at every stage.",
      steps: [
        {
          t: "Inquiry",
          d: "Share your product idea, volume and target price. We reply within 1 business day.",
        },
        {
          t: "Quote",
          d: "Transparent quotation with MOQ, unit price and lead time — no hidden fees.",
        },
        { t: "Sample", d: "Samples shipped in 7–10 days for your approval before any bulk order." },
        {
          t: "Production",
          d: "Dedicated production line with in-process checks and progress updates.",
        },
        {
          t: "Inspection",
          d: "100% batch QC with GC-MS testing and a pre-shipment inspection report.",
        },
        { t: "Shipping", d: "Consolidated freight, export docs and tracking to your warehouse." },
      ],
    },
    exportMap: {
      eyebrow: "Global Reach",
      title: "Exporting to 40+ countries",
      subtitle: "Our products are on shelves across North America, Europe and Oceania.",
      markets_label: "Key export markets",
      more: "and 30+ more markets worldwide",
      markets: [
        { id: "us", name: "United States", flag: "🇺🇸" },
        { id: "ca", name: "Canada", flag: "🇨🇦" },
        { id: "gb", name: "United Kingdom", flag: "🇬🇧" },
        { id: "de", name: "Germany", flag: "🇩🇪" },
        { id: "fr", name: "France", flag: "🇫🇷" },
        { id: "es", name: "Spain", flag: "🇪🇸" },
        { id: "it", name: "Italy", flag: "🇮🇹" },
        { id: "nl", name: "Netherlands", flag: "🇳🇱" },
        { id: "ru", name: "Russia", flag: "🇷🇺" },
        { id: "ae", name: "UAE", flag: "🇦🇪" },
        { id: "sa", name: "Saudi Arabia", flag: "🇸🇦" },
        { id: "qa", name: "Qatar", flag: "🇶🇦" },
        { id: "il", name: "Israel", flag: "🇮🇱" },
        { id: "eg", name: "Egypt", flag: "🇪🇬" },
        { id: "tr", name: "Turkey", flag: "🇹🇷" },
        { id: "in", name: "India", flag: "🇮🇳" },
        { id: "sg", name: "Singapore", flag: "🇸🇬" },
        { id: "jp", name: "Japan", flag: "🇯🇵" },
        { id: "kr", name: "South Korea", flag: "🇰🇷" },
        { id: "th", name: "Thailand", flag: "🇹🇭" },
        { id: "vn", name: "Vietnam", flag: "🇻🇳" },
        { id: "id", name: "Indonesia", flag: "🇮🇩" },
        { id: "my", name: "Malaysia", flag: "🇲🇾" },
        { id: "br", name: "Brazil", flag: "🇧🇷" },
        { id: "mx", name: "Mexico", flag: "🇲🇽" },
        { id: "au", name: "Australia", flag: "🇦🇺" },
        { id: "nz", name: "New Zealand", flag: "🇳🇿" },
        { id: "za", name: "South Africa", flag: "🇿🇦" },
      ],
    },
    products: {
      eyebrow: "Our Products",
      title: "Aroma goods, made to your standard",
      subtitle: "Six product lines, each available for white-label and custom formulation.",
      learn_more: "Learn more",
      page_title: "Products",
      page_subtitle:
        "Explore our full range of aroma products — from raw essential oils and fragrance oils to candles, reed diffusers, home fragrance and packaging, all ready for private label.",
      categories: "Categories",
      all: "All",
      "essential-oils": "Essential Oils",
      "fragrance-oils": "Fragrance Oils",
      "reed-diffusers": "Reed Diffusers",
      candles: "Scented Candles",
      "home-fragrance": "Home Fragrance",
      "car-fragrance": "Car Fragrance",
      "scent-machines": "Aroma Machines",
      "wax-melts": "Wax Melts",
      incense: "Incense",
      "personal-care": "Personal Care",
      "gift-sets": "Gift Sets",
      packaging: "Packaging",
      search_placeholder: "Search products…",
      products_count: "products",
      no_results: "No products match your search. Try a different keyword.",
      specs_title: "Specifications & Certifications",
      features_title: "Key Features",
      faq_title: "Frequently Asked Questions",
      moq: "MOQ",
      lead_time: "Lead Time",
      origin: "Origin",
      cert: "Certifications",
      size: "Size",
      scent_notes: "Scent Notes",
      burn_time: "Burn Time",
      materials: "Materials",
      sample_policy: "Sample Policy",
      request_sample: "Request a Sample",
      gallery_title: "Gallery",
      docs_title: "Documents & Compliance",
      doc_sds: "Safety Data Sheet (SDS)",
      doc_coa: "Certificate of Analysis (CoA)",
      doc_ifra: "IFRA Certificate",
      doc_reach: "REACH Report",
      doc_clp: "CLP Label Document",
      download: "Download",
      related_title: "Related Products",
      packaging_label: "Packaging",
      customization_label: "Customization",
      request_quote_short: "Request Quote",
      request_quote: "Request Quote for This Product",
      detail_cta: "Interested in this product? Request a quote.",
      back_to_products: "← Back to Products",
    },
    solutions: {
      learn_more: "Learn more",
      challenges_title: "Challenges We Solve",
      products_title: "Recommended Products",
      benefits_title: "Why Work With Us",
      cta_button: "Request a Quote",
    },
    oem: {
      eyebrow: "OEM & ODM",
      title: "Your brand, our formulation",
      subtitle:
        "Bring a brief or a dream — our perfumers develop the scent, packaging, and compliance docs. Low MOQs and flexible volumes for growing brands.",
      features: [
        "Custom fragrance development & matching",
        "Private-label packaging and branding",
        "Regulatory docs (MSDS, IFRA, REACH)",
        "Pilot runs from 500 units",
      ],
      cta: "Start an OEM project",
      process_title: "The OEM Process",
      steps: [
        {
          step: "01",
          t: "Idea",
          d: "Share your product brief, target price, reference scents, and packaging concepts.",
        },
        {
          step: "02",
          t: "Quotation",
          d: "We return a transparent quote covering MOQ, unit cost, and production lead time.",
        },
        {
          step: "03",
          t: "Sampling",
          d: "Our perfumers develop 3–5 scent options, then ship physical samples within 10 business days for approval.",
        },
        {
          step: "04",
          t: "Production",
          d: "Approved formula goes into a full-scale run with in-line QC and photo/video reports at each stage.",
        },
        {
          step: "05",
          t: "Inspection",
          d: "A dedicated QC inspection verifies fill, fragrance, and packaging against your spec before release.",
        },
        {
          step: "06",
          t: "Shipping",
          d: "We handle consolidated, insured freight and all export documentation to your destination port.",
        },
      ],
    },
    oemServices: {
      process_title: "How It Works",
      specs_title: "Specifications & Capabilities",
      cta_button: "Request a Quote",
    },
    sourcing: {
      eyebrow: "China Sourcing",
      title: "One partner for the whole supply chain",
      subtitle: "We handle the hard parts so you can focus on selling.",
      services: [
        {
          title: "Product Sourcing",
          desc: "We locate the right manufacturer for your spec, volume, and budget.",
        },
        {
          title: "Factory Verification",
          desc: "Audits, certifications, and reference checks before you commit.",
        },
        {
          title: "Quality Inspection",
          desc: "Pre-shipment and in-line inspections with photo & video reports.",
        },
        {
          title: "Consolidated Shipping",
          desc: "Combine orders from multiple factories into one shipment.",
        },
      ],
    },
    factory: {
      eyebrow: "Our Facility",
      title: "A 12,000 m² aroma campus",
      desc: "In-house blending, filling, and QC under one roof, certified to international standards and audited regularly.",
      area: "12k",
      area_lbl: "m² facility",
      iso: "ISO",
      iso_lbl: "9001 certified",
      qc: "24/7",
      qc_lbl: "QC lab",
      preview_cta: "Tour the Facility",
      preview_note: "Video audits welcome · ISO 9001 & 22716",
    },
    factoryPages: {
      highlights_title: "Key Capabilities",
      cta_button: "Contact Us",
    },
    countryPages: {
      nav_label: "Export Markets",
      regulations_title: "Compliance & Regulations",
      products_title: "Popular Products for This Market",
      shipping_title: "Shipping & Logistics",
      cta_button: "Request a Quote",
    },
    comparePages: {
      criterion: "Criterion",
      verdict: "Our Recommendation",
      cta_button: "Get Expert Advice",
    },
    blog: {
      eyebrow: "Insights",
      title: "From the Jewelry journal",
      posts: [
        { t: "How to verify a Chinese factory before paying", c: "Sourcing" },
        { t: "Essential oil basics: notes, grades & blends", c: "Aroma" },
        { t: "MOQ myths that cost new brands money", c: "OEM" },
      ],
      page_title: "Blog",
      page_subtitle: "Field notes on sourcing, ingredients, and building an aroma brand.",
      empty: "No articles yet — check back soon.",
      read_more: "Read article →",
      search_placeholder: "Search articles…",
      all_categories: "All topics",
      latest: "Latest",
      articles_count: "articles",
      no_results: "No articles match your search. Try a different keyword.",
      cta_title: "Have a project in mind? Let's talk.",
      min_read: "min read",
      toc_title: "In this article",
      share_title: "Share",
      related_title: "Related articles",
      author_about: "About the author",
      prev_article: "Previous article",
      next_article: "Next article",
    },
    caseStudies: {
      eyebrow: "Capability Scenarios",
      page_title: "Capability Scenarios",
      page_subtitle:
        "Illustrative examples of what we can build for private-label and OEM programmes — specifications, compliance support and typical workflows. These are capability scenarios, not completed customer projects.",
      empty: "No scenarios yet — check back soon.",
      read_more: "View scenario →",
      all_regions: "All regions",
      challenge: "The Challenge",
      solution: "Our Solution",
      result: "Results",
      key_details: "Key Project Details",
      testimonial_label: "Client Feedback",
      related_products: "Related Products",
      related_guides: "Related Guides",
      cta_title: "Have a similar project?",
      cta_desc:
        "Tell us your product, quantity, and target market. We'll send a proposal within 24 hours.",
      cta_button: "Start Your Project",
      moq_label: "MOQ",
      lead_time_label: "Lead Time",
      packaging_label: "Packaging",
      country_label: "Country",
      client_label: "Client Type",
      back: "All case studies",
    },
    resources: {
      eyebrow: "Resources",
      page_title: "Buyer Resources",
      page_subtitle:
        "Practical guides on OEM, MOQ, importing and packaging — written by our sourcing and QC team for international buyers.",
      catalog_eyebrow: "Product Catalog",
      catalog_title: "Browse the Full Product Catalog",
      catalog_desc:
        "Explore our complete range of essential oils, scented candles and reed diffusers — every item available for private label.",
      catalog_cta: "Browse Products",
      guides_title: "Guides",
      guides_subtitle: "Everything you need to know before you place your first order.",
      read_guide: "Read guide →",
      min_read: "min read",
      empty: "Guides are on the way — check back soon.",
      cta_title: "Can't find the answer you need?",
      cta_body:
        "Ask our sourcing team — we'll point you to the right spec, compliance document or pricing answer within one business day.",
      cta_button: "Ask a Question",
      products_title: "Explore Our Products",
      products_subtitle: "Ready-to-ship and OEM-capable lines behind these guides.",
      nav_catalog: "Product Catalog",
      nav_oem: "OEM / ODM Guide",
      nav_moq: "MOQ Guide",
      nav_import: "Import Guide",
      nav_packaging: "Packaging Guide",
      back: "← Back to Resources",
      toc_title: "In this guide",
      share_title: "Share",
      other_guides: "Other guides",
      author_about: "About the author",
    },
    inquiry: {
      eyebrow: "Get a quote",
      title: "Tell us what you need",
      subtitle:
        "Share your product idea, volume, and timeline. A sourcing specialist replies within one business day.",
      name: "Name",
      email: "Email",
      company: "Company (optional)",
      country: "Country",
      whatsapp: "WhatsApp",
      quantity: "Estimated Quantity",
      country_placeholder: "Select your country",
      quantity_placeholder: "e.g. 5,000 units",
      message: "Tell us about your project…",
      send: "Get My Quote",
      next_title: "What happens next",
      next_steps: [
        "A sourcing specialist replies within 1 business day",
        "Samples shipped in 7–10 days for your approval",
        "Quotation includes MOQ, unit price and lead time",
      ],
      whatsapp_alt: "Or chat with us on WhatsApp",
      privacy: "We never share your details. Reply within 1 business day.",
    },
    footer: {
      tagline:
        "{name} · We connect international buyers with verified aroma manufacturers and trusted factories across China.",
      explore: "Explore",
      contact: "Get in touch",
      subscribe: "Subscribe",
      copyright: "© {year} {name}. All rights reserved.",
      built: "Built for international buyers · Yiwu, Zhejiang, China",
      placeholder: "Your email",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      sitemap: "Sitemap",
      whatsapp: "WhatsApp",
      hours: "Business Hours",
      address_label: "Address",
      email_label: "Email",
      phone_label: "Phone",
      popular_categories: "Popular Categories",
      popular_products: "Popular Products",
      popular_articles: "Popular Articles",
      newsletter_title: "Sourcing tips, once a month",
      newsletter_subtitle: "New arrivals, factory insights and import guides — no spam.",
      newsletter_ok: "Thanks! You're on the list.",
      newsletter_exists: "You're already subscribed — thanks!",
      newsletter_invalid: "Please enter a valid email address.",
      newsletter_error: "Something went wrong. Please try again.",
    },
    about: {
      page_title: "About Us",
      meta: "Jewelry is a Yiwu-based aroma manufacturer and sourcing partner since 2013 — private-label candles, essential oils and reed diffusers for importers, brand owners and retailers worldwide.",
      eyebrow: "Who we are",
      title: "Bridging the world to China's aroma industry since 2013",
      who_title: "Who we help",
      who_subtitle:
        "From first-time importers to established retail chains — we adapt our manufacturing and sourcing service to where your business stands.",
      who_items: [
        {
          icon: "globe",
          t: "Importers",
          d: "Consolidated sourcing across aroma categories with verified factories and complete export documentation — one partner instead of many suppliers.",
        },
        {
          icon: "drop",
          t: "Brand Owners",
          d: "Private label and custom formulation from brief to shelf, with NDA protection and packaging that carries your brand.",
        },
        {
          icon: "pin",
          t: "Retailers",
          d: "Curated product lines with retail-ready packaging, planogram-friendly sizes and dependable restock lead times.",
        },
        {
          icon: "flame",
          t: "Wholesalers",
          d: "Factory-direct pricing on volume orders, with flexible MOQ splits across products to fill your catalog faster.",
        },
        {
          icon: "monitor",
          t: "Amazon Sellers",
          d: "Low-MOQ pilot runs, FBA-ready cartons and labeling, plus fast restocks so your listings never run dry.",
        },
        {
          icon: "wave",
          t: "Supermarkets",
          d: "Private-label programs with reliable lead times, CLP/CPNP compliance and consistent year-round supply.",
        },
      ],
      values_title: "What drives us",
      values: [
        { t: "Transparency", d: "No hidden fees, no surprise markups. You see every cost line." },
        { t: "Quality First", d: "If it doesn't meet spec, it doesn't ship. Period." },
        { t: "Speed", d: "Sampling in days, not weeks. Decisions in hours, not days." },
      ],
      team_title: "Core Team",
      team: [
        { name: "Alex Chen", role: "Founder & CEO" },
        { name: "Maria Liu", role: "Head Perfumer" },
        { name: "David Wang", role: "Supply Chain Director" },
        { name: "Sarah Zhang", role: "QC Manager" },
      ],
      facility_area_desc: "Includes blending rooms, filling lines, and QC laboratory.",
      facility_iso_desc: "ISO quality management system certification.",
      cta_title: "Want to know more?",
      cta_body: "Get in touch and let's start working together.",
      cases_title: "Trusted by Brands Worldwide",
      cases_subtitle: "Real projects, real results — hear it from our clients.",
      products_title: "What We Make",
      products_subtitle: "A glimpse of our most requested product lines.",
      view_all_products: "View All Products",
    },
    contact: {
      page_title: "Contact Us",
      eyebrow: "Let's talk",
      title: "Ready to start your next project?",
      subtitle: "Reach out and a sourcing specialist will get back to you within one business day.",
      office: "Yiwu Office",
      hours: "Mon–Fri 9:00 – 18:00 CST",
      send_message: "Send Message",
      quote_prefix: "I'd like a quote for:",
      tour_prefill:
        "I'd like to arrange a live video tour of your factory. Please share available dates.",
      visit_prefill:
        "I'd like to plan an on-site visit to your factory. Please share available dates.",
      from_prefix: "I'm interested in learning more about",
      trusted_by: "What Clients Say",
    },
    search: {
      label: "Search",
      placeholder: "Search products, guides, FAQs…",
      hint: "Start typing to search across products, guides and FAQs",
      no_results: "No results for",
      try: "Try:",
      popular: "Popular searches",
      did_you_mean: "Did you mean",
      get_quote: "Get Quote",
      oem: "OEM/ODM",
      moq: "MOQ",
      empty_title: "Can't find what you need?",
      empty_text: "Tell us what you're sourcing — we'll reply within one business day.",
      products: "Products",
      blog: "Articles",
      guides: "Guides",
      faq: "FAQ",
      navigate: "to navigate",
      open: "to open",
      close: "to close",
    },
    topic: {
      related_guides_title: "Related Buying Guides",
      related_guides_cta: "Read guide",
      related_products_title: "Products Covered in This Guide",
      related_products_cta: "View product",
      solution_guides_title: "Guides for This Industry",
      solution_products_title: "Popular Products for This Line",
    },
    shop: {
      nav_label: "Shop",
      page_title: "Jewelry Wholesale",
      page_subtitle:
        "Curated aroma products from China's supply chain — transparent specs, MOQ, pricing and sourcing support for international buyers.",
      eyebrow: "Jewelry Wholesale",
      browse_products: "Browse Products",
      request_oem: "Request OEM Quote",
      all: "All",
      search_placeholder: "Search products…",
      products_count: "products",
      no_results: "No products match your search.",
      no_products: "No products available yet. Contact us for custom sourcing.",
      catalog_error: "The catalog is temporarily unavailable. Please try again shortly.",
      retry: "Try again",
      scope_note:
        "This is the full wholesale range. The Ready-to-Ship subset is browsable in the Download Center catalog.",
      scope_note_link: "View Ready-to-Ship catalog",
      empty_oem_title: "Explore OEM / ODM Customization",
      empty_oem_desc:
        "Build your own fragrance line — custom scents, packaging and private label, made to your spec.",
      empty_oem_btn: "Start a custom project",
      empty_guides_title: "Read Our Buying Guides",
      empty_guides_desc:
        "Practical B2B guides on sourcing, compliance and choosing the right fragrance products.",
      empty_guides_btn: "Browse resources",
      pnf_title: "Product Not Found",
      pnf_desc:
        "The product you are looking for does not exist or may have been removed. Explore our other products or start a custom project.",
      pnf_shop_btn: "Back to Shop",
      pnf_oem_btn: "OEM / ODM Customization",
      pnf_guides_btn: "Buying Guides",
      from_price: "From",
      moq: "MOQ",
      lead_time: "Lead Time",
      stock_status: "Availability",
      in_stock: "In Stock",
      limited_stock: "Limited Stock",
      ready_to_ship: "Curated & Verified",
      out_of_stock: "Out of Stock",
      add_to_cart: "Add to Cart",
      add_to_cart_note: "Final price & shipping confirmed after request",
      why_buy_title: "Why Buyers Choose This Product",
      full_specs_btn: "View Full Specifications",
      full_specs_title: "Full Technical Data",
      need_bulk: "Need 500+ pcs?",
      oem_cta: "Custom scent, packaging & branding available.",
      request_oem_quote: "Request OEM Quote",
      price_tiers: "Volume Pricing",
      qty: "Qty",
      unit_price: "Unit Price",
      specifications: "Specifications",
      certifications: "Certifications",
      packaging: "Packaging",
      category_label: "Category",
      view_details: "View Details",
      compare: "Compare",
      compare_clear: "Clear",
      compare_limit: "You can compare up to 4 products.",
      filter_moq: "MOQ",
      filter_price: "Price",
      filter_availability: "Availability",
      filter_all: "All",
      moq_le_50: "≤ 50 pcs",
      moq_51_100: "51–100 pcs",
      moq_101_500: "101–500 pcs",
      moq_500_plus: "500+ pcs",
      price_under_2: "Under $2",
      price_2_5: "$2 – $5",
      price_5_10: "$5 – $10",
      price_over_10: "$10+",
      made_to_order: "Made to Order",
      per_pc: "/ pc",
      pcs: "pcs",
      ship_full_case: "Order full carton to save shipping cost",
      oem_badge: "OEM",
      quick_inquiry: "Quick Inquiry",
      inquiry_product: "Product",
      inquiry_quantity: "Quantity",
      inquiry_country: "Country",
      inquiry_email: "Email",
      inquiry_message: "Message",
      inquiry_message_placeholder: "Tell us about your sourcing needs…",
      inquiry_submit: "Send Inquiry",
      inquiry_submitting: "Sending…",
      inquiry_success: "Inquiry sent! We will get back to you within 1 business day.",
      inquiry_error: "Something went wrong. Please try again.",
      back_to_shop: "← Back to Shop",
      cart: "Cart",
      cart_eyebrow: "Shopping Cart",
      cart_heading: "Your Cart",
      cart_items_label: "items",
      cart_empty: "Your cart is empty.",
      cart_browse: "Browse Ready-to-Ship Products",
      cart_clear: "Clear Cart",
      cart_continue: "Continue Shopping",
      cart_subtotal: "Subtotal",
      cart_request_order: "Request Order",
      cart_remove: "Remove",
      order_title: "Request Order",
      order_subtitle:
        "Submit your order request. We will confirm availability, shipping cost and final quotation.",
      order_name: "Full Name",
      order_company: "Company",
      order_email: "Email",
      order_country: "Country",
      order_city: "City",
      order_address: "Address",
      order_postal: "Postal Code",
      order_phone: "Phone",
      order_whatsapp: "WhatsApp",
      order_note: "Order Note",
      order_submit: "Submit Order Request",
      order_submitting: "Submitting…",
      order_success_title: "Thank You",
      order_success_text:
        "Your order request has been received. We will review availability and shipping, then contact you with the final quotation.",
      order_number: "Order",
      order_continue: "Continue Shopping",
      order_error: "Something went wrong. Please try again.",
      required: "Required",
      sample_available: "Sample Available",
      low_moq: "Low MOQ",
      days: "Days",
      tag_best_seller: "Best Seller",
      tag_hot_europe: "Hot in Europe",
      tag_hot_usa: "Hot in USA",
      tag_fast_delivery: "Fast Delivery",
      tag_new_arrival: "New",
      tag_amazon_fba: "FBA Friendly",
      by_application: "By Application",
      by_business_need: "By Business Need",
      app_all: "All",
      app_hotel_spa: "Hotel & Spa",
      app_home_fragrance: "Home Fragrance",
      app_gift_sets: "Gift Sets",
      app_retail: "Retail",
      app_car: "Car",
      app_wedding: "Wedding",
      need_all: "All",
      need_low_moq: "Low MOQ (≤50)",
      need_ready_to_ship: "Curated & Verified",
      need_private_label: "Private Label",
      need_custom_packaging: "Custom Packaging",
      need_sample_available: "Sample Available",
      request_sample: "Request Sample",
      request_bulk_quote: "Request Bulk Quote",
      view_product: "View Product",
      bulk_pricing_available: "Bulk pricing available",
      bulk_hint: "Looking for private label or bulk quantities?",
      cantfind_title: "Can't Find What You're Sourcing?",
      cantfind_text:
        "Tell us what you're looking for. We help you find, verify and consolidate products from China's fragrance supply chain.",
      whatsapp_us: "WhatsApp Us",
      request_oem_odm: "Request OEM / ODM",
      rts_label: "Ready to Ship",
      best_sellers: "Best Sellers",
      new_arrivals: "New Arrivals",
      featured_title: "Featured Products",
      browse_by_category: "Browse by Category",
      filters: "Filters",
      sort_by: "Sort by",
      sort_featured: "Featured",
      sort_newest: "Newest",
      sort_price_asc: "Price: Low to High",
      sort_price_desc: "Price: High to Low",
      sort_moq_asc: "MOQ: Low to High",
      active_filters: "Active filters",
      clear_all: "Clear all",
      show_n_products: "Show {n} Products",
      purchasing_options: "Purchasing Options",
      bulk_pricing: "Bulk Pricing",
      oem_odm: "OEM / ODM",
      moq_le_10: "≤ 10 pcs",
      moq_le_100: "≤ 100 pcs",
      moq_100_plus: "100+ pcs",
      price_under_1: "Under $1",
      price_1_3: "$1 – $3",
      price_3_5: "$3 – $5",
      prev_page: "Previous",
      next_page: "Next",
      page_label: "Page",
      of_label: "of",
      go_to_page: "Go to page",
      go_label: "Go",
      order_summary: "Order Summary",
      os_product: "Product",
      os_qty: "Quantity",
      os_unit_price: "Unit Price",
      os_subtotal: "Subtotal",
      os_est_weight: "Est. Weight",
      os_shipping: "Shipping",
      os_shipping_request: "Request Quote",
      os_est_total: "Est. Total",
      os_packaging_note: "Packaging weight excluded. Final shipping weight confirmed after order.",
      est_weight: "Estimated Weight",
      to_be_confirmed: "Request a quote",
      total_est_weight: "Total Estimated Weight",
      shipping_method: "Shipping Method",
      shipping_method_sea: "Sea Freight",
      shipping_method_air: "Air Freight",
      shipping_method_express: "Express / Courier",
      shipping_method_recommend: "Let Jewelry recommend",
      additional_requirements: "Additional Requirements",
      bulk_quote_note:
        "Submit your bulk purchase request. We confirm stock and international freight, then send your final quote. No payment required now.",
      added_to_cart: "Added to cart",
      supply_product_code: "Product Code",
      supply_sku_code: "SKU Code",
      variant_option: "Option",
      contact_us_on: "Contact us on",
      facebook_page: "Facebook Page",
      messenger: "Messenger",
      whatsapp_chat: "WhatsApp Chat",
      // Audit D01: 必填文案缺失时的显式 incomplete 态（不编造任何商品卖点）
      copy_pending:
        "The written description for this product is still being prepared. Contact our sales team for full specifications, samples and pricing.",
      copy_pending_label: "Description pending",
    },
  },
};

/** Resolve nested dot-path like "hero.title" — returns string */
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
 * Build getStaticPaths() for a [lang]/ page.
 * Returns one entry per locale, passing `locale` as a prop.
 */
export function localeStaticPaths() {
  return LOCALE_LIST.map((lang) => ({
    params: { lang },
    props: { locale: lang },
  }));
}

/** Strip the leading locale segment from a pathname (e.g. "/es/products" → "/products") */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if (LOCALE_LIST.includes(parts[1] as Locale)) {
    return "/" + parts.slice(2).join("/");
  }
  return pathname;
}

/** Compute the localized URL for a given path across locales (for hreflang alternates) */
export function localizedUrl(locale: Locale, pathWithoutLocale: string): string {
  if (locale === DEFAULT) return pathWithoutLocale || "/";
  return "/" + locale + (pathWithoutLocale && pathWithoutLocale !== "/" ? pathWithoutLocale : "");
}

/** Next locale in cycle (en → ar → en) */
export function nextLocale(current: Locale): Locale {
  return next(current);
}

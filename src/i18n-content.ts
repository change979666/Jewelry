// ---------------------------------------------------------------------------
//  Aromiso — Localized rich content (V1.5 optimization)
//  Long-form, structured content that powers the new Factory page, FAQ page,
//  category landing pages, CTA band, trust bar and animated stats.
//  Kept separate from i18n.ts (UI chrome) to keep both files readable.
// ---------------------------------------------------------------------------

import type { Locale } from "./i18n";

export type StatItem = { num: string; label: string };
export type FaqItem = { q: string; a: string };
export type FactorySection = { icon: string; title: string; body: string };
export type CertItem = { name: string; desc: string };
export type TimelineItem = { year: string; title: string; text: string };
export type CategoryApp = { title: string; desc: string };

type ContentShape = {
  ctaBand: { eyebrow: string; title: string; text: string; button: string; note?: string };
  catalog: { eyebrow: string; title: string; text: string; button: string };
  trust: string[];
  stats: StatItem[];
  homeStats: { eyebrow: string; title: string; subtitle: string };
  packaging: Record<string, string>;
  customization: string;
  factory: {
    eyebrow: string;
    title: string;
    intro: string;
    sections: FactorySection[];
    certs: CertItem[];
    timeline: TimelineItem[];
    galleryTitle: string;
    galleryBadge: string;
    galleryBody: string;
    galleryPrimary: string;
    gallerySecondary: string;
    capacityStats: StatItem[];
    ctaTitle: string;
    ctaText: string;
    ctaNote: string;
    ctaButton: string;
  };
  faq: FaqItem[];
  categories: Record<
    string,
    {
      icon: string;
      title: string;
      intro: string;
      applications: CategoryApp[];
      faqs: FaqItem[];
      ctaButton: string;
    }
  >;
  solutions: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Record<
      string,
      {
        icon: string;
        title: string;
        desc: string;
        hero: string;
        challenges: { title: string; desc: string }[];
        products: { title: string; desc: string }[];
        benefits: string[];
        faqs: { q: string; a: string }[];
        cta: string;
      }
    >;
  };
  // Loose typing for large, deeply-nested content blocks.
  // The downstream `c()` resolver returns `any`, so strict structural
  // typing of these literals adds no runtime safety and is brittle to
  // content edits. Index signatures disable excess-property errors.
  oemServices: Record<string, any>;
  factoryPages: Record<string, any>;
  countryPages: Record<string, any>;
  comparePages: Record<string, any>;
  downloads: Record<string, string>;
  // V5.27 growth expansion (solutions hub / sourcing / OEM hub / category
  // mother pages) — same loose-typing rationale as above.
  solutionsHub: Record<string, any>;
  sourcingPage: Record<string, any>;
  oemHub: Record<string, any>;
  categoryPages: Record<string, any>;
};
// =========================================================================
export const CONTENT = {
  en: {
    ctaBand: {
      eyebrow: "Start your project",
      title: "Ready to manufacture your aroma brand?",
      text: "Share your brief — product, volume and target price — and get a detailed quotation with MOQ and lead time within one business day.",
      button: "Request a Quote",
      note: "Reply within 1 business day · No commitment",
    },
    catalog: {
      eyebrow: "Product Catalog",
      title: "Download our latest catalog",
      text: "Browse essential oils, scented candles and reed diffusers with full specs, MOQs and packaging options — ready for your next private-label line.",
      button: "Request Catalog",
    },
    trust: ["Factory Direct", "OEM / ODM", "Flexible MOQ", "Export Worldwide", "Fast Response"],
    stats: [
      { num: "10+", label: "Years Experience" },
      { num: "500+", label: "OEM Projects" },
      { num: "30+", label: "Export Countries" },
      { num: "24h", label: "Response Time" },
    ],
    homeStats: {
      eyebrow: "By the numbers",
      title: "A manufacturing partner you can scale with",
      subtitle:
        "A decade of aroma expertise, hundreds of brands shipped, and a team that replies fast.",
    },
    packaging: {
      "essential-oils":
        "Glass bottles (5–100 ml), aluminium tins and bulk drums, with private-label printing available.",
      "fragrance-oils":
        "Amber and cobalt glass bottles (10–500 ml) with droppers or disc caps, bulk drums for manufacturing.",
      candles:
        "Glass, tin and ceramic vessels with custom boxes and inserts, private-label printed.",
      "reed-diffusers": "Refillable glass vessels (50–200 ml) with rattan reeds and custom boxes.",
      "home-fragrance":
        "PET and glass spray bottles, wax melt clamshells, car diffuser housings and gift-ready boxes.",
      packaging:
        "Custom rigid boxes, folding cartons, labels, inserts and shrink wrap — full turnkey packaging kits.",
    },
    customization:
      "Scent matching, formula development, private-label packaging and compliance docs (MSDS / IFRA / REACH).",
    factory: {
      eyebrow: "Our Facility",
      title: "A vertically integrated aroma campus",
      intro:
        "From raw material intake to filled, labelled and palletised goods, our 12,000 m² campus controls every step of the supply chain. In-house blending, filling and QC mean tighter quality, faster lead times and full traceability for your brand.",
      sections: [
        {
          icon: "leaf",
          title: "Factory Overview",
          body: "A 12,000 m² campus in Yiwu, Zhejiang combining R&D, production and warehousing under one roof. More than 120 staff across formulation, production and quality teams.",
        },
        {
          icon: "monitor",
          title: "Production Line",
          body: "Automated filling, capping and labelling lines for oils, candles and reed diffusers, with capacity scalable from pilot runs of 500 units to full containers.",
        },
        {
          icon: "check",
          title: "Quality Control",
          body: "A dedicated 24/7 QC lab runs GC-MS testing, stability trials and batch sampling. Every shipment leaves with a full inspection report and photo/video evidence.",
        },
        {
          icon: "pin",
          title: "Warehouse",
          body: "Climate-controlled storage for raw materials and finished goods, with lot-traceability and FIFO rotation so your stock is always fresh and accounted for.",
        },
        {
          icon: "drop",
          title: "Packaging",
          body: "In-house packaging design and sourcing — glass, aluminium and PCR options — with private-label printing, safety labelling and compliance documentation.",
        },
        {
          icon: "globe",
          title: "Export Process",
          body: "Experienced export team handles documentation, customs paperwork and consolidated global freight, with incoterms (EXW / FOB / CIF / DDP) tailored to your need.",
        },
      ],
      certs: [
        { name: "REACH / CLP", desc: "EU chemical & labelling documentation available." },
        { name: "MSDS / SDS", desc: "Safety data sheets for all formulations." },
        { name: "IFRA", desc: "Fragrance compliance documentation on request." },
        {
          name: "Shipping / Transport",
          desc: "Shipping & transport safety reports for air/sea freight.",
        },
      ],
      timeline: [
        {
          year: "2013",
          title: "Founded",
          text: "Aromiso founded in Yiwu, Zhejiang by fragrance engineers and supply-chain veterans.",
        },
        {
          year: "2016",
          title: "Blending Campus",
          text: "First in-house blending and filling lines commissioned.",
        },
        {
          year: "2019",
          title: "Export Expansion",
          text: "Dedicated export desk; first containers shipped to Europe and North America.",
        },
        {
          year: "2022",
          title: "Automation",
          text: "Automated filling and labelling lines doubled throughput.",
        },
        {
          year: "2025",
          title: "12,000 m²",
          text: "Campus expanded to 12,000 m² with a new QC laboratory.",
        },
      ],
      galleryTitle: "Inside the Campus",
      galleryBadge:
        "Photos only tell part of the story. Request a live video tour and we'll walk the production lines with you, answering questions on the spot.",
      galleryBody:
        "A look inside our blending, filling, cleanroom and packaging areas — the same lines where your products will be made.",
      galleryPrimary: "Request a Live Video Tour",
      gallerySecondary: "Plan an On-Site Visit",
      capacityStats: [
        { num: "12,000", label: "m² campus" },
        { num: "120+", label: "production & QC team" },
        { num: "24/7", label: "QC lab" },
        { num: "100%", label: "batches inspected" },
      ],
      ctaTitle: "Visit or audit our facility",
      ctaText:
        "We welcome brand owners and buying teams for on-site or video audits. Request a tour and we'll arrange it.",
      ctaNote: "We reply within 1 business day · On-site and video audits available year-round",
      ctaButton: "Request a Factory Tour",
    },
    faq: [
      {
        q: "What is your minimum order quantity (MOQ)?",
        a: "Our standard MOQ starts at 500 units for private-label runs, with some stock formats available from 200 units. MOQs scale with customization — talk to us about your volume.",
      },
      {
        q: "What are your typical lead times?",
        a: "Sampling takes 7–10 business days. Production lead time is usually 20–30 days after sample approval and deposit, depending on order size and packaging.",
      },
      {
        q: "Do you offer OEM services?",
        a: "Yes. We develop the formula, fragrance profile, packaging and compliance documents from your brief, and manufacture under your brand.",
      },
      {
        q: "What is the difference between OEM and ODM?",
        a: "OEM builds to your specification; ODM uses our existing formulations and designs that you brand as your own. Both support low MOQs.",
      },
      {
        q: "Can you do private label?",
        a: "Absolutely. We provide private-label packaging, printing and labelling so the product ships retail-ready under your brand.",
      },
      {
        q: "Which countries do you ship to?",
        a: "We export worldwide — North America, Europe, the Middle East, Australia and Asia — via air or sea freight with full documentation.",
      },
      {
        q: "What are your payment terms?",
        a: "Typically 30% deposit to start production and 70% before shipment. Established clients may qualify for milestone-based terms.",
      },
      {
        q: "Can I request samples before ordering?",
        a: "Yes. We ship physical samples within 7–10 business days so you can evaluate scent, quality and packaging before committing.",
      },
      {
        q: "What certificates do you provide?",
        a: "We provide REACH/CLP, MSDS/SDS, IFRA compliance and shipping/transport documentation as required for your market; third-party lab or facility audits can be arranged on request.",
      },
    ],
    categories: {
      "essential-oils": {
        icon: "drop",
        title: "Essential Oils",
        intro:
          "Pure, steam-distilled and cold-pressed essential oils sourced from verified farms and distilleries, blended and bottled in our Yiwu campus for private-label and custom formulations.",
        applications: [
          {
            title: "Aromatherapy",
            desc: "Single notes and proprietary blends for diffusers and wellness.",
          },
          {
            title: "Skincare & Cosmetics",
            desc: "Carrier-ready oils formulated to cosmetic grade.",
          },
          { title: "Home Care", desc: "Fragrance bases for candles, detergents and room sprays." },
          { title: "Food & Beverage", desc: "Food-grade flavour oils with full documentation." },
        ],
        faqs: [
          {
            q: "Are your oils pure or diluted?",
            a: "We supply both 100% pure single-note oils and pre-diluted bases, depending on your application and market.",
          },
          {
            q: "Can you match a reference scent?",
            a: "Yes — send us a sample or brief and our perfumers will develop a matching or improved profile.",
          },
        ],
        ctaButton: "Request Essential Oil Quote",
      },
      candles: {
        icon: "flame",
        title: "Scented Candles",
        intro:
          "Natural soy and beeswax candles with custom fragrance profiles, poured and finished in reusable glass and tin vessels with private-label branding.",
        applications: [
          { title: "Home Fragrance", desc: "Signature scents for living spaces and gifting." },
          { title: "Hospitality", desc: "Branded amenity candles for hotels and spas." },
          { title: "Gift Sets", desc: "Curated sets with custom boxes and inserts." },
          { title: "Spa & Wellness", desc: "Calming, low-soot formulations for treatment rooms." },
        ],
        faqs: [
          {
            q: "What wax do you use?",
            a: "Primarily natural soy and beeswax blends, with coconut and paraffin options available on request.",
          },
          {
            q: "Can you supply the glass vessel?",
            a: "Yes — we source and print glass, aluminium and tin vessels, or fill your supplied packaging.",
          },
        ],
        ctaButton: "Request Candle Quote",
      },
      "reed-diffusers": {
        icon: "wave",
        title: "Reed Diffusers",
        intro:
          "Long-lasting home fragrance systems with refillable glass vessels, premium rattan reeds and custom oil blends — a low-maintenance, flame-free scent solution.",
        applications: [
          { title: "Home Fragrance", desc: "Continuous, flameless scent for any room." },
          { title: "Offices", desc: "Subtle branding ambience for reception and meeting spaces." },
          { title: "Retail", desc: "Sell-through friendly, giftable format." },
          { title: "Hospitality", desc: "Signature scents for lobbies and guest rooms." },
        ],
        faqs: [
          {
            q: "How long do they last?",
            a: "Our diffusers typically fragrance a space for 3–6 months depending on room size and reed count.",
          },
          {
            q: "Are the bottles refillable?",
            a: "Yes — we offer refill pouches and reusable glass vessels for a sustainable, repeat-purchase model.",
          },
        ],
        ctaButton: "Request Diffuser Quote",
      },
      "fragrance-oils": {
        icon: "sparkle",
        title: "Fragrance Oils",
        intro:
          "Premium synthetic and nature-identical fragrance oils for candles, diffusers, soaps and home-care products — consistent batch-to-batch, IFRA compliant, available in hundreds of scent profiles.",
        applications: [
          {
            title: "Candle Making",
            desc: "High flash-point oils engineered for clean hot-throw in soy and paraffin wax.",
          },
          {
            title: "Reed Diffusers",
            desc: "Pre-blended diffuser bases with optimal wicking viscosity.",
          },
          { title: "Soap & Cosmetics", desc: "Skin-safe fragrances with full IFRA certificates." },
          { title: "Home Care", desc: "Stable scents for detergents, sprays and air fresheners." },
        ],
        faqs: [
          {
            q: "What is the difference between fragrance oil and essential oil?",
            a: "Essential oils are extracted from plants; fragrance oils are formulated in a lab to replicate or create scents. Fragrance oils offer wider variety, lower cost and better consistency for manufacturing.",
          },
          {
            q: "Can you replicate a designer scent?",
            a: "Yes — send us a reference sample or brief and our perfumers will develop a matching or inspired profile within 7–10 days.",
          },
        ],
        ctaButton: "Request Fragrance Oil Quote",
      },
      "home-fragrance": {
        icon: "home",
        title: "Home Fragrance",
        intro:
          "A complete range of finished home-fragrance products — room sprays, linen mists, wax melts, car diffusers, incense and aroma stones — ready for private label or custom formulation.",
        applications: [
          {
            title: "Retail & E-commerce",
            desc: "Shelf-ready formats with strong margins for online and in-store.",
          },
          { title: "Hospitality", desc: "Branded pillow mists, lobby sprays and amenity kits." },
          {
            title: "Gift Sets",
            desc: "Curated collections with premium packaging for seasonal gifting.",
          },
          {
            title: "Automotive",
            desc: "Clip-on and hanging car diffusers with long-lasting scent.",
          },
        ],
        faqs: [
          {
            q: "What formats do you offer?",
            a: "Room sprays, linen sprays, pillow mists, wax melts, car diffusers, incense sticks, aroma stones and diffuser refills — all in custom scents and packaging.",
          },
          {
            q: "Can I mix formats in one order?",
            a: "Yes — we support mixed-SKU orders so you can build a complete home-fragrance line in a single production run.",
          },
        ],
        ctaButton: "Request Home Fragrance Quote",
      },
      packaging: {
        icon: "box",
        title: "Packaging & Components",
        intro:
          "Source glass bottles, candle jars, diffuser vessels, gift boxes, reed sticks, labels and complete packaging kits — the components your brand needs, manufactured and printed to spec.",
        applications: [
          {
            title: "Glass & Vessels",
            desc: "Amber, cobalt and clear glass bottles, jars and diffuser vessels in stock and custom moulds.",
          },
          {
            title: "Boxes & Gift Sets",
            desc: "Rigid boxes, folding cartons and magnetic closures with full-colour print.",
          },
          {
            title: "Labels & Printing",
            desc: "Pressure-sensitive labels, screen printing and hot-foil branding.",
          },
          {
            title: "Components",
            desc: "Reed sticks, wicks, droppers, caps, inserts and closures.",
          },
        ],
        faqs: [
          {
            q: "Can I order packaging only, without the product?",
            a: "Absolutely — many clients source components and packaging separately. We supply empty vessels, boxes and labels to your spec.",
          },
          {
            q: "Do you offer custom moulds?",
            a: "Yes — for orders above 10,000 units we can open custom glass or tin moulds to your design.",
          },
        ],
        ctaButton: "Request Packaging Quote",
      },
    },
    solutions: {
      eyebrow: "Industry Solutions",
      title: "Solutions by Industry",
      subtitle:
        "Whatever your channel — hospitality, retail, e-commerce or distribution — we have the product range, packaging and compliance experience to fill your shelves.",
      items: {
        hotels: {
          icon: "home",
          title: "Hotels & Hospitality",
          desc: "Signature scents and branded amenities that turn guest rooms into brand experiences.",
          hero: "From lobby diffusers to in-room candles and pillow mists, we help hotels create a signature scent identity that guests remember — and take home.",
          challenges: [
            {
              title: "Brand consistency",
              desc: "Every property needs the same scent profile, batch after batch, across thousands of rooms.",
            },
            {
              title: "Small per-room volumes",
              desc: "Hotels need hundreds of SKUs but low per-unit quantities — flexible MOQ is essential.",
            },
            {
              title: "Compliance & safety",
              desc: "Fire regulations, allergen labelling and MSDS documentation for every product on property.",
            },
          ],
          products: [
            {
              title: "Lobby Reed Diffusers",
              desc: "Large-format diffusers with your signature scent for lobbies, corridors and spas.",
            },
            {
              title: "In-Room Candles",
              desc: "Branded soy candles with hotel logo, custom vessel and safety-tested wick.",
            },
            {
              title: "Pillow Mists & Amenities",
              desc: "Turndown pillow sprays, linen mists and mini diffusers as guest amenities.",
            },
          ],
          benefits: [
            "Signature scent development from brief in 14 days",
            "MOQ from 200 units per SKU",
            "Full MSDS, IFRA and fire-safety documentation",
            "Consistent batch-to-batch fragrance matching",
            "Complimentary sample kit for procurement teams",
            "Consolidated shipping to multiple properties",
          ],
          faqs: [
            {
              q: "Can you develop a signature hotel scent?",
              a: "Yes — our perfumers create a bespoke fragrance from your brand brief, mood board or reference sample within 14 days.",
            },
            {
              q: "What is the MOQ for hotel amenities?",
              a: "We start at 200 units per SKU for hotel projects, with mixed-SKU orders accepted.",
            },
          ],
          cta: "Ready to create your hotel's signature scent? Share your brand brief and we'll develop samples.",
        },
        "spa-wellness": {
          icon: "leaf",
          title: "Spa & Wellness",
          desc: "Calming, therapeutic-grade products for treatment rooms, retail shelves and relaxation spaces.",
          hero: "Spa guests expect purity and calm. We supply essential oils, massage blends, aromatherapy candles and treatment-room diffusers that meet therapeutic-grade standards.",
          challenges: [
            {
              title: "Therapeutic purity",
              desc: "Spa formulators need GC-MS verified oils with full chemotype data, not perfumery-grade blends.",
            },
            {
              title: "Treatment consistency",
              desc: "Therapists rely on identical scent and viscosity across every treatment session.",
            },
            {
              title: "Retail upsell",
              desc: "Spas want branded retail products guests can buy and take home.",
            },
          ],
          products: [
            {
              title: "Essential Oil Sets",
              desc: "Curated therapeutic-grade oil sets for treatment rooms and retail display.",
            },
            {
              title: "Massage & Body Oils",
              desc: "Pre-blended carrier + essential oil formulas, private-labelled for your spa.",
            },
            {
              title: "Aromatherapy Candles",
              desc: "Low-soot soy candles with calming essential oil blends for treatment ambience.",
            },
          ],
          benefits: [
            "GC-MS reports and chemotype data per batch",
            "100% pure, undiluted essential oils",
            "Custom blending to your treatment protocols",
            "Private-label retail products from 300 units",
            "IFRA and cosmetic safety documentation included",
            "Sample kits for therapist evaluation",
          ],
          faqs: [
            {
              q: "Are your oils therapeutic grade?",
              a: "We supply 100% pure essential oils with GC-MS verification. 'Therapeutic grade' is a marketing term — we provide the analytical data so your formulators can verify quality.",
            },
            {
              q: "Can you formulate custom massage blends?",
              a: "Yes — share your protocol and our formulators develop a matching blend with stability testing.",
            },
          ],
          cta: "Tell us about your spa's treatment menu and we'll recommend the right oil range.",
        },
        retail: {
          icon: "monitor",
          title: "Retail & E-commerce",
          desc: "Shelf-ready private-label products with strong margins for online and brick-and-mortar stores.",
          hero: "Whether you run a boutique shop, a chain or a DTC brand, we deliver retail-ready products with packaging, barcodes and compliance docs — so you can focus on selling.",
          challenges: [
            {
              title: "Margin pressure",
              desc: "Retailers need factory-direct pricing to maintain 60%+ margins after platform fees.",
            },
            {
              title: "Fast restocking",
              desc: "Best-sellers sell out; you need a supplier who can restock in 2–3 weeks, not 3 months.",
            },
            {
              title: "Compliance per market",
              desc: "CLP labels for EU, FDA for US, different allergen rules — one supplier who handles it all.",
            },
          ],
          products: [
            {
              title: "Private-Label Candles",
              desc: "Your brand, your scent, your vessel — from 500 units with full packaging.",
            },
            {
              title: "Reed Diffuser Range",
              desc: "Multiple sizes and scents to build a complete home-fragrance collection.",
            },
            {
              title: "Gift Sets",
              desc: "Curated sets with premium boxes — proven high-AOV sellers for Q4.",
            },
          ],
          benefits: [
            "Factory-direct pricing (no middlemen)",
            "MOQ from 500 units per SKU",
            "Full packaging: box, label, barcode, insert",
            "CLP / FDA / REACH documentation per market",
            "20–25 day production, 7-day samples",
            "Mixed-container consolidation for multi-SKU orders",
          ],
          faqs: [
            {
              q: "Can you handle EU CLP labelling?",
              a: "Yes — we produce compliant CLP labels with allergen declarations, hazard pictograms and UFI codes for every EU-bound product.",
            },
            {
              q: "What is your restock lead time?",
              a: "Standard reorders ship in 15–20 days. We also hold safety stock for repeat clients.",
            },
          ],
          cta: "Share your product brief and target retail price — we'll quote within one business day.",
        },
        "amazon-sellers": {
          icon: "globe",
          title: "Amazon Sellers",
          desc: "FBA-ready products with optimised packaging, fast turnaround and the compliance Amazon demands.",
          hero: "Amazon's rules are strict: FNSKU labels, poly-bag warnings, hazmat review for candles and oils. We've shipped thousands of FBA-ready units and handle the compliance so you don't get suspended.",
          challenges: [
            {
              title: "FBA compliance",
              desc: "Amazon rejects shipments without FNSKU, suffocation warnings or proper hazmat docs.",
            },
            {
              title: "Review velocity",
              desc: "You need consistent quality so every unit matches the listing photos and description.",
            },
            {
              title: "Cash flow",
              desc: "Amazon holds payouts; you need low MOQ and fast turnaround to keep inventory flowing.",
            },
          ],
          products: [
            {
              title: "FBA-Ready Candles",
              desc: "Soy candles with FNSKU, poly-bag, suffocation warning and hazmat sheet included.",
            },
            {
              title: "Essential Oil Sets",
              desc: "Multi-pack oil sets optimised for Amazon A+ content and gift positioning.",
            },
            {
              title: "Wax Melt Bundles",
              desc: "High-margin clamshell packs with FBA-compliant packaging.",
            },
          ],
          benefits: [
            "FBA-ready packaging (FNSKU, poly-bag, warnings)",
            "Hazmat documentation for candles and oils",
            "Product photography and A+ content support",
            "MOQ from 500 units — low cash commitment",
            "20-day production to FBA warehouse delivery",
            "Consistent quality for review protection",
          ],
          faqs: [
            {
              q: "Do you provide hazmat documentation?",
              a: "Yes — we supply SDS, flash-point test reports and UN transport certificates for Amazon hazmat review.",
            },
            {
              q: "Can you ship directly to FBA warehouses?",
              a: "Yes — we label, poly-bag and ship to your designated FBA warehouse with carton-level compliance.",
            },
          ],
          cta: "Tell us your ASIN strategy and we'll build a compliant, FBA-ready product plan.",
        },
        supermarkets: {
          icon: "box",
          title: "Supermarkets & Chains",
          desc: "Volume production with EDI integration, retail-compliant packaging and consistent supply.",
          hero: "Supermarket buyers need volume, consistency and compliance. We supply private-label candle, diffuser and home-fragrance ranges at container volumes with full retail compliance.",
          challenges: [
            {
              title: "Volume & consistency",
              desc: "Chain stores need 10,000+ identical units per PO with zero quality variance.",
            },
            {
              title: "Retail compliance",
              desc: "EAN barcodes, EDI ordering, specific packaging dimensions and shelf-ready formats.",
            },
            {
              title: "Cost engineering",
              desc: "Supermarket margins demand aggressive unit costs without sacrificing safety.",
            },
          ],
          products: [
            {
              title: "Private-Label Candle Range",
              desc: "Full candle lines (3–8 SKUs) with shelf-ready trays and EAN coding.",
            },
            {
              title: "Reed Diffuser Collection",
              desc: "Tiered range (good/better/best) with unified brand design.",
            },
            {
              title: "Seasonal Collections",
              desc: "Christmas, summer and spring ranges planned 6 months ahead.",
            },
          ],
          benefits: [
            "Container-volume production (10,000+ units)",
            "Shelf-ready packaging with EAN/UPC",
            "EDI and portal ordering supported",
            "Dedicated account manager for chain accounts",
            "6-month forward planning for seasonal ranges",
            "Full compliance: CLP, REACH, FDA, fire-safety",
          ],
          faqs: [
            {
              q: "Can you meet supermarket volume requirements?",
              a: "Yes — our production lines handle 50,000+ units per month with dedicated QC for chain accounts.",
            },
            {
              q: "Do you support EDI ordering?",
              a: "We integrate with major retail EDI platforms and buyer portals for automated PO processing.",
            },
          ],
          cta: "Share your range plan and volume forecast — we'll prepare a costed proposal within 3 days.",
        },
        "brand-owners": {
          icon: "sparkle",
          title: "Brand Owners",
          desc: "From concept to shelf: formula development, packaging design and manufacturing under your brand.",
          hero: "You have the brand vision; we have the factory. From scent development to packaging engineering to compliance, we build your product line from scratch — no minimum brand experience required.",
          challenges: [
            {
              title: "Product development",
              desc: "Turning a brand concept into a manufacturable, costed product with the right scent and feel.",
            },
            {
              title: "Packaging differentiation",
              desc: "Standing out on shelf or in unboxing requires custom vessels, boxes and finishes.",
            },
            {
              title: "Scaling production",
              desc: "Going from 500-unit launch to 10,000-unit reorder without quality drops.",
            },
          ],
          products: [
            {
              title: "Full Product Development",
              desc: "Scent → formula → vessel → packaging → compliance, managed end-to-end.",
            },
            {
              title: "Custom Moulds & Vessels",
              desc: "Unique glass, ceramic or tin vessels exclusive to your brand.",
            },
            {
              title: "Multi-SKU Range Building",
              desc: "Build a 5–20 SKU range across candles, diffusers and sprays.",
            },
          ],
          benefits: [
            "End-to-end product development (brief to container)",
            "Exclusive custom moulds from 10,000 units",
            "In-house packaging design and prototyping",
            "IP protection: your formula, your mould, NDA covered",
            "Scalable from 500-unit launch to full container",
            "Dedicated project manager for brand builds",
          ],
          faqs: [
            {
              q: "Can you develop a product from just a brief?",
              a: "Yes — share your brand positioning, target price and aesthetic. We handle scent, formula, packaging and compliance.",
            },
            {
              q: "Who owns the formula and mould?",
              a: "You do. Custom formulas and moulds are your IP, covered by NDA. We never resell them.",
            },
          ],
          cta: "Share your brand brief — we'll propose a product range with costings within 5 days.",
        },
        wholesalers: {
          icon: "download",
          title: "Wholesalers",
          desc: "Factory-direct pricing on volume orders with flexible MOQ splits across products.",
          hero: "Wholesalers need margin, breadth and reliability. We offer factory-direct pricing across 80+ SKUs with mixed-container orders so you can fill your warehouse in one shipment.",
          challenges: [
            {
              title: "Margin protection",
              desc: "Wholesale margins are thin; you need the lowest possible unit cost at volume.",
            },
            {
              title: "Breadth of range",
              desc: "Your customers want variety — candles, diffusers, oils, sprays — from one vendor.",
            },
            {
              title: "Reliable supply",
              desc: "Stockouts kill wholesale relationships; you need a supplier who delivers on time, every time.",
            },
          ],
          products: [
            {
              title: "Mixed-Container Orders",
              desc: "Combine candles, diffusers, oils and sprays in one container for maximum efficiency.",
            },
            {
              title: "White-Label Range",
              desc: "Our proven formulas under your house brand with your labels.",
            },
            {
              title: "Stock Programme",
              desc: "We hold safety stock of your top sellers for 2-week restock.",
            },
          ],
          benefits: [
            "Factory-direct pricing (no agents, no markup)",
            "80+ SKUs across 6 categories",
            "Mixed-container consolidation",
            "2-week restock on repeat orders",
            "Flexible payment: 30/70 or LC at sight",
            "Dedicated wholesale account manager",
          ],
          faqs: [
            {
              q: "What is your wholesale pricing structure?",
              a: "Pricing tiers at 1,000 / 5,000 / 10,000 / full container. Request our wholesale price list for full details.",
            },
            {
              q: "Can I mix products in one order?",
              a: "Yes — we encourage mixed-SKU orders. Minimum 500 units per SKU, no maximum SKU count.",
            },
          ],
          cta: "Request our wholesale catalogue and price list — we respond within one business day.",
        },
        distributors: {
          icon: "globe",
          title: "Distributors",
          desc: "Exclusive territory partnerships with marketing support, stock programmes and co-branded materials.",
          hero: "Distributors need exclusivity, marketing support and reliable supply. We offer territory-exclusive partnerships with co-branded catalogues, training materials and dedicated stock programmes.",
          challenges: [
            {
              title: "Territory protection",
              desc: "Distributors invest in market development; they need guaranteed exclusivity.",
            },
            {
              title: "Marketing support",
              desc: "Local-language catalogues, product training and co-branded digital assets.",
            },
            {
              title: "Stock availability",
              desc: "Distributors can't wait 30 days for every order; they need local or pre-positioned stock.",
            },
          ],
          products: [
            {
              title: "Full Catalogue Access",
              desc: "80+ SKUs across all categories with your local-language marketing materials.",
            },
            {
              title: "Co-Branded Packaging",
              desc: "Products with your distribution brand alongside Aromiso manufacturing credit.",
            },
            {
              title: "Stock Programme",
              desc: "Pre-positioned inventory at our warehouse for 2-week dispatch to your territory.",
            },
          ],
          benefits: [
            "Exclusive territory agreements",
            "Co-branded catalogues and digital assets",
            "Product training for your sales team",
            "Pre-positioned stock for fast dispatch",
            "Annual rebate programme on volume targets",
            "Joint trade-show participation support",
          ],
          faqs: [
            {
              q: "Do you offer exclusive territories?",
              a: "Yes — we sign territory-exclusive agreements with minimum annual purchase commitments.",
            },
            {
              q: "What marketing support do you provide?",
              a: "Local-language catalogues, product photography, video content, training decks and co-branded digital assets.",
            },
          ],
          cta: "Tell us your territory and target categories — we'll propose a partnership framework.",
        },
      },
    },
    oemServices: {
      eyebrow: "OEM / ODM Services",
      title: "Private Label & OEM Manufacturing",
      subtitle:
        "From formula development to finished goods — we manufacture under your brand with full customisation.",
      items: {
        "private-label-essential-oil": {
          icon: "drop",
          title: "Private Label Essential Oil",
          desc: "Your brand, our pure essential oils — custom blends, bottles, labels and packaging from 500 units.",
          hero: "Launch your own essential oil range without owning a distillery. We supply 100% pure, GC-MS verified oils in your branding — from single oils to curated sets — with full compliance documentation for any market.",
          process: [
            {
              title: "Brief & Selection",
              desc: "Choose from 30+ stock oils or request custom blends. Share your target market and price point.",
            },
            {
              title: "Sample & Approval",
              desc: "Receive 5–10 ml samples within 7 days. Iterate on blend ratios until approved.",
            },
            {
              title: "Production & Filling",
              desc: "Bulk distillation/sourcing, quality testing, precision filling into your chosen vessel.",
            },
            {
              title: "Labelling & Dispatch",
              desc: "Apply your labels, pack into retail boxes, carton and ship to your warehouse or FBA.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 units per SKU" },
            { label: "Oil Purity", value: "100% pure, GC-MS verified" },
            { label: "Bottle Options", value: "5 ml – 100 ml amber/cobalt glass" },
            { label: "Lead Time", value: "20–25 days after approval" },
            { label: "Certifications", value: "ISO 22716, IFRA, MSDS per SKU" },
            { label: "Custom Blending", value: "Yes — from your brief or reference" },
          ],
          faqs: [
            {
              q: "Can I create a custom essential oil blend?",
              a: "Yes — share your target effect (calming, energising, etc.) or a reference oil. Our formulators develop a matching blend within 7 days.",
            },
            {
              q: "Do you provide GC-MS reports?",
              a: "Every batch ships with a GC-MS chromatogram, allergen declaration and IFRA compliance certificate.",
            },
          ],
          cta: "Ready to launch your essential oil brand? Share your product brief for a free sample.",
        },
        "private-label-candle": {
          icon: "flame",
          title: "Private Label Candle",
          desc: "Custom soy candles with your brand, scent and vessel — from 500 units with full packaging.",
          hero: "Build a candle line that's uniquely yours. We handle wax formulation, fragrance loading, vessel sourcing, safety testing and packaging — you focus on brand and sales.",
          process: [
            {
              title: "Concept & Scent",
              desc: "Define your candle range: wax type, fragrance profile, vessel style and target price.",
            },
            {
              title: "Sampling",
              desc: "Receive 2–3 hand-poured samples with your chosen scent within 10 days.",
            },
            {
              title: "Production",
              desc: "Batch pouring, curing, wick testing and quality inspection on dedicated lines.",
            },
            {
              title: "Packaging & Ship",
              desc: "Box, label, barcode and carton per your spec. Ship to warehouse or Amazon FBA.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 units per SKU" },
            { label: "Wax Options", value: "Soy, coconut-soy, beeswax blend, paraffin" },
            {
              label: "Vessel Options",
              value: "Glass jar, tin, ceramic, concrete — custom moulds available",
            },
            { label: "Fragrance Load", value: "6–12% (IFRA compliant)" },
            { label: "Burn Time", value: "25–80 hrs depending on size" },
            { label: "Lead Time", value: "25–30 days after sample approval" },
          ],
          faqs: [
            {
              q: "Can you match a designer candle scent?",
              a: "Yes — send us a reference candle and our perfumers replicate the cold and hot throw within 10 days.",
            },
            {
              q: "Do you handle fire-safety testing?",
              a: "We perform burn testing, provide SDS and ensure compliance with ASTM F2417 (US) or EN 15493 (EU).",
            },
          ],
          cta: "Tell us your candle vision — scent, vessel, quantity — and we'll quote within one day.",
        },
        "private-label-diffuser": {
          icon: "wave",
          title: "Private Label Reed Diffuser",
          desc: "Custom reed diffusers in your branding — bottle, reeds, fragrance and box from 500 units.",
          hero: "Reed diffusers are the easiest home-fragrance entry point: no flame, no electricity, long-lasting scent. We manufacture complete diffuser sets under your brand with custom everything.",
          process: [
            {
              title: "Design Brief",
              desc: "Choose bottle shape, reed type, fragrance and box style. Share your brand guidelines.",
            },
            {
              title: "Scent Matching",
              desc: "We develop your fragrance oil blend and send 50 ml test diffusers for approval.",
            },
            {
              title: "Production",
              desc: "Precision filling, reed insertion, sealing and quality check on automated lines.",
            },
            {
              title: "Packaging & Delivery",
              desc: "Retail-ready boxing with your artwork, barcoded and palletised for shipment.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 units per SKU" },
            { label: "Sizes", value: "50 ml – 500 ml" },
            {
              label: "Bottle Options",
              value: "Glass (clear/frosted/coloured), ceramic, custom mould",
            },
            { label: "Reed Options", value: "Rattan, fibre (black/white/natural)" },
            { label: "Scent Longevity", value: "6–12 weeks depending on size" },
            { label: "Lead Time", value: "20–25 days" },
          ],
          faqs: [
            {
              q: "Can I use my own bottle design?",
              a: "Yes — send us your 3D file or reference. We source or custom-mould the vessel from 3,000 units.",
            },
            {
              q: "What fragrance options are available?",
              a: "Choose from 50+ stock scents or we develop a bespoke fragrance oil from your brief.",
            },
          ],
          cta: "Share your diffuser concept and we'll send samples within 7 days.",
        },
        "oem-candle": {
          icon: "flame",
          title: "OEM Candle Manufacturing",
          desc: "White-label candle production at scale — your formula or ours, with full QC and compliance.",
          hero: "For brands that need manufacturing capacity without the factory. We produce candles to your exact specification — or develop the formula for you — at volumes from 2,000 to 50,000+ units per month.",
          process: [
            {
              title: "Spec Review",
              desc: "Share your tech pack or product spec. We confirm feasibility, cost and timeline.",
            },
            {
              title: "Pilot Batch",
              desc: "We run a 100-unit pilot for your approval before mass production.",
            },
            {
              title: "Mass Production",
              desc: "Dedicated production lines with in-line QC at every stage.",
            },
            {
              title: "QC & Logistics",
              desc: "AQL inspection, carton packing, container loading with photo documentation.",
            },
          ],
          specs: [
            { label: "Capacity", value: "50,000+ units/month" },
            { label: "MOQ", value: "2,000 units per PO" },
            { label: "Wax Types", value: "Soy, paraffin, coconut, beeswax, blends" },
            { label: "Quality System", value: "ISO 9001, AQL 2.5 inspection" },
            { label: "Compliance", value: "ASTM F2417, EN 15493, CLP, REACH" },
            { label: "Lead Time", value: "25–35 days depending on volume" },
          ],
          faqs: [
            {
              q: "Can you produce to our existing formula?",
              a: "Yes — share your tech pack and we replicate it exactly. We also offer formula optimisation for cost or performance.",
            },
            {
              q: "What is your defect rate?",
              a: "We maintain <1.5% defect rate with 100% visual inspection and AQL 2.5 sampling on every batch.",
            },
          ],
          cta: "Send us your candle spec or tech pack — we'll confirm feasibility and pricing within 2 days.",
        },
        "oem-essential-oil": {
          icon: "drop",
          title: "OEM Essential Oil Supply",
          desc: "Bulk essential oil supply with private labelling, custom blending and full traceability.",
          hero: "Source essential oils at factory prices with complete documentation. We supply bulk and retail-packed oils for cosmetics, aromatherapy, food and industrial applications — all with full batch traceability.",
          process: [
            {
              title: "Requirement Review",
              desc: "Specify oil type, grade, volume and application. We confirm sourcing and pricing.",
            },
            {
              title: "Sample & Testing",
              desc: "Receive samples with GC-MS data. You verify chemotype and quality.",
            },
            {
              title: "Bulk Production",
              desc: "Sourcing from verified farms, steam distillation or cold pressing, batch testing.",
            },
            {
              title: "Packing & Docs",
              desc: "Fill to your spec (bulk or retail), apply labels, include CoA/MSDS/IFRA docs.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 units (retail) / 25 kg (bulk)" },
            { label: "Grade", value: "Therapeutic, cosmetic, food, industrial" },
            {
              label: "Oils Available",
              value: "30+ varieties (lavender, tea tree, eucalyptus, etc.)",
            },
            { label: "Documentation", value: "GC-MS, CoA, MSDS, IFRA, allergen declaration" },
            { label: "Packaging", value: "Bulk drums, amber glass, retail boxes" },
            { label: "Lead Time", value: "15–25 days" },
          ],
          faqs: [
            {
              q: "Can you supply organic-certified oils?",
              a: "Yes — we source USDA/EU organic certified oils from verified farms with full chain-of-custody documentation.",
            },
            {
              q: "Do you offer custom blending?",
              a: "Yes — our formulators create custom blends for aromatherapy, cosmetics or household applications.",
            },
          ],
          cta: "Tell us which oils you need, in what grade and volume — we'll quote within one business day.",
        },
        "custom-packaging": {
          icon: "box",
          title: "Custom Packaging Design",
          desc: "Bespoke boxes, labels, inserts and vessel packaging engineered for your brand and market.",
          hero: "Packaging sells. Our in-house design team creates retail-ready packaging that protects your product, meets market regulations and makes your brand stand out on shelf or in unboxing videos.",
          process: [
            {
              title: "Design Brief",
              desc: "Share your brand guidelines, target market and packaging requirements.",
            },
            {
              title: "3D Mockup",
              desc: "Receive 2–3 design concepts with 3D renders within 5 days.",
            },
            {
              title: "Prototyping",
              desc: "Physical prototype with your chosen materials, finishes and printing.",
            },
            {
              title: "Mass Production",
              desc: "Print, cut, fold and assemble at scale — integrated with your product order.",
            },
          ],
          specs: [
            { label: "MOQ", value: "1,000 units (integrated with product order)" },
            { label: "Box Types", value: "Rigid, folding, magnetic, sleeve, tube" },
            { label: "Finishes", value: "Matte/gloss lamination, foil, emboss, spot UV" },
            { label: "Compliance", value: "CLP labels, FDA, barcode, recycling marks" },
            { label: "Design Service", value: "Free with orders over 3,000 units" },
            { label: "Lead Time", value: "15–20 days (packaging only)" },
          ],
          faqs: [
            {
              q: "Do you design the packaging or do I provide artwork?",
              a: "Both work. Provide your print-ready files, or our design team creates everything from your brand brief — free for orders over 3,000 units.",
            },
            {
              q: "Can you handle EU CLP labelling?",
              a: "Yes — we produce compliant labels with hazard pictograms, allergen lists, UFI codes and all required regulatory text.",
            },
          ],
          cta: "Share your packaging brief and brand guidelines — we'll propose 2–3 concepts within 5 days.",
        },
        "custom-fragrance": {
          icon: "sparkle",
          title: "Custom Fragrance Development",
          desc: "Bespoke scent creation by our perfumers — from brief to production-ready formula in 14 days.",
          hero: "Your signature scent is your brand's invisible identity. Our in-house perfumers develop unique fragrance profiles from your brief, mood board or reference sample — exclusive to your brand, never resold.",
          process: [
            {
              title: "Scent Brief",
              desc: "Describe your vision: mood, notes, references, target product and price point.",
            },
            {
              title: "Perfumer Development",
              desc: "Our perfumers create 3–5 initial accords for your evaluation within 10 days.",
            },
            {
              title: "Refinement",
              desc: "Iterate on your chosen direction — adjust top/mid/base notes until perfect.",
            },
            {
              title: "Production Formula",
              desc: "Finalise IFRA-compliant formula, stability test, and scale to production.",
            },
          ],
          specs: [
            { label: "Development Time", value: "14 days (brief to approved formula)" },
            { label: "Initial Concepts", value: "3–5 scent directions" },
            { label: "Compliance", value: "IFRA 51st Amendment, EU allergen, CLP" },
            { label: "Applications", value: "Candles, diffusers, sprays, cosmetics, textiles" },
            { label: "Exclusivity", value: "Your formula is never resold (NDA covered)" },
            { label: "Cost", value: "Free development with production orders over 2,000 units" },
          ],
          faqs: [
            {
              q: "Can you replicate a designer fragrance?",
              a: "Yes — send a reference sample and we develop a close match (not identical, to respect IP) within 10 days.",
            },
            {
              q: "Who owns the custom formula?",
              a: "You do. Custom formulas are your intellectual property, covered by mutual NDA.",
            },
          ],
          cta: "Describe your dream scent — our perfumers will develop samples within 10 days.",
        },
        "custom-bottle": {
          icon: "drop",
          title: "Custom Bottle & Vessel",
          desc: "Bespoke glass, ceramic and metal vessels — custom moulds, finishes and capacities for your brand.",
          hero: "The vessel IS the product for many buyers. We source and custom-manufacture unique bottles, jars, tins and ceramic vessels that make your product instantly recognisable and impossible to copy.",
          process: [
            {
              title: "Design Brief",
              desc: "Share sketches, references or 3D files. Define material, capacity and finish.",
            },
            {
              title: "3D Rendering",
              desc: "Receive photorealistic renders and dimension drawings within 5 days.",
            },
            {
              title: "Mould & Sample",
              desc: "Cut mould, produce 5–10 physical samples for your approval (15–20 days).",
            },
            {
              title: "Mass Production",
              desc: "Produce at scale with your chosen finish — integrated with your product filling order.",
            },
          ],
          specs: [
            { label: "MOQ", value: "3,000 units (custom mould) / 500 (stock shapes)" },
            { label: "Materials", value: "Glass, ceramic, tin, concrete, wood cap" },
            { label: "Finishes", value: "Frosted, coloured, electroplated, decal, screen print" },
            { label: "Mould Cost", value: "USD 500–2,000 (refundable on repeat orders)" },
            { label: "Capacity Range", value: "5 ml – 500 ml" },
            { label: "Lead Time", value: "30–40 days (incl. mould)" },
          ],
          faqs: [
            {
              q: "Can I see a physical sample before committing?",
              a: "Yes — we produce 5–10 samples after mould cutting. You approve before mass production begins.",
            },
            {
              q: "Is the mould cost refundable?",
              a: "Yes — mould costs are refunded when cumulative orders exceed 10,000 units.",
            },
          ],
          cta: "Share your vessel concept — we'll render it in 3D within 5 days, free of charge.",
        },
      },
    },
    factoryPages: {
      eyebrow: "Inside Our Factory",
      title: "Factory Capabilities",
      subtitle: "Explore our facility in detail — from quality control to production capacity.",
      items: {
        "quality-control": {
          icon: "check",
          title: "Quality Control",
          desc: "Multi-stage QC system ensuring every unit meets international standards before shipping.",
          hero: "Quality isn't a department — it's embedded in every step. From incoming raw material inspection to final AQL sampling, our 12-person QC team ensures zero-defect delivery.",
          highlights: [
            {
              title: "Incoming Material Inspection",
              desc: "Every raw material batch is tested for purity, moisture, and compliance before entering production.",
            },
            {
              title: "In-Line QC",
              desc: "Operators perform visual and dimensional checks at every station; anomalies trigger immediate line stop.",
            },
            {
              title: "AQL 2.5 Final Inspection",
              desc: "Random sampling per ISO 2859 before packing. Photo and video reports shared with clients.",
            },
            {
              title: "Lab Verification",
              desc: "Flash-point, fragrance load, burn-time and diffusion tests on every production batch.",
            },
            {
              title: "Traceability System",
              desc: "Batch codes link every unit to its raw material lot, production date and QC inspector.",
            },
            {
              title: "Third-Party Audits",
              desc: "We welcome SGS, Bureau Veritas or client-nominated inspectors at any stage.",
            },
          ],
          stats: [
            { num: "12", label: "QC Specialists" },
            { num: "<1.5%", label: "Defect Rate" },
            { num: "100%", label: "Batch Traceability" },
            { num: "AQL 2.5", label: "Inspection Standard" },
          ],
          faqs: [
            {
              q: "Can I send my own inspector?",
              a: "Absolutely — we welcome third-party inspection at any stage. We coordinate scheduling and provide full access.",
            },
            {
              q: "What happens if defects are found?",
              a: "Any batch failing AQL is quarantined, reworked or replaced at our cost before shipping.",
            },
          ],
          cta: "Request our full QC protocol document — we'll send it within one business day.",
        },
        laboratory: {
          icon: "drop",
          title: "Laboratory & R&D",
          desc: "In-house lab for fragrance development, stability testing and analytical verification.",
          hero: "Our 200 m² laboratory houses GC-MS instruments, stability chambers and a perfumery bench where new scents are born. Every formula is stress-tested before it reaches production.",
          highlights: [
            {
              title: "GC-MS Analysis",
              desc: "Gas chromatography verifies oil purity, detects adulteration and confirms chemotype for every batch.",
            },
            {
              title: "Fragrance Development",
              desc: "3 senior perfumers develop 20+ new scents monthly — from brief to production-ready formula.",
            },
            {
              title: "Stability Testing",
              desc: "Accelerated aging (40°C/75%RH for 90 days) ensures products perform throughout shelf life.",
            },
            {
              title: "Flash-Point & Safety",
              desc: "Every candle and oil formula is tested for flash point, ensuring transport and use safety.",
            },
            {
              title: "Compatibility Testing",
              desc: "Fragrance-vessel interaction tests prevent discolouration, cracking or scent absorption.",
            },
            {
              title: "Regulatory Compliance",
              desc: "IFRA, REACH, CLP and FDA checks built into every formula development cycle.",
            },
          ],
          stats: [
            { num: "200 m²", label: "Lab Space" },
            { num: "3", label: "Senior Perfumers" },
            { num: "GC-MS", label: "Analytical Equipment" },
            { num: "20+", label: "New Scents / Month" },
          ],
          faqs: [
            {
              q: "Can you develop a custom formula for us?",
              a: "Yes — share your brief and our perfumers create 3–5 options within 10 days, free for orders over 2,000 units.",
            },
            {
              q: "Do you provide stability test reports?",
              a: "Yes — every custom formula ships with accelerated stability data and recommended shelf life.",
            },
          ],
          cta: "Tell us your formulation challenge — our lab team will propose a solution.",
        },
        "raw-material": {
          icon: "leaf",
          title: "Raw Material Sourcing",
          desc: "Verified farms, distilleries and suppliers with full chain-of-custody documentation.",
          hero: "Great products start with great raw materials. We source essential oils from verified farms across 6 countries, wax from certified refineries, and vessels from audited glassworks — all with full traceability.",
          highlights: [
            {
              title: "Verified Farm Network",
              desc: "Lavender from Provence, tea tree from Australia, eucalyptus from Yunnan — direct farm relationships since 2013.",
            },
            {
              title: "Wax Certification",
              desc: "Soy wax from non-GMO certified sources; paraffin from fully-refined, food-grade suppliers.",
            },
            {
              title: "Glass & Vessel Audits",
              desc: "Every glassworks is audited for lead/cadmium compliance, thermal shock resistance and dimensional accuracy.",
            },
            {
              title: "Fragrance Oil Partners",
              desc: "We work with Givaudan, Firmenich and IFF-grade suppliers for consistent, IFRA-compliant fragrance oils.",
            },
            {
              title: "Incoming QC",
              desc: "Every shipment is inspected on arrival: visual check, weight verification, and lab sampling before warehouse entry.",
            },
            {
              title: "Chain of Custody",
              desc: "Full documentation from farm to finished product — organic certificates, CoA, and transport records.",
            },
          ],
          stats: [
            { num: "6", label: "Source Countries" },
            { num: "40+", label: "Verified Suppliers" },
            { num: "100%", label: "CoA Coverage" },
            { num: "2013", label: "Sourcing Since" },
          ],
          faqs: [
            {
              q: "Can you source organic-certified materials?",
              a: "Yes — we maintain USDA and EU organic supply chains for essential oils, with full chain-of-custody documentation.",
            },
            {
              q: "Do you share supplier audit reports?",
              a: "Under NDA, yes. We provide relevant audit summaries and certificates for your compliance team.",
            },
          ],
          cta: "Ask about our raw material sourcing for your specific product requirements.",
        },
        warehouse: {
          icon: "box",
          title: "Warehouse & Logistics",
          desc: "8,000 m² climate-controlled warehousing with consolidated shipping to 30+ countries.",
          hero: "From climate-controlled storage to container loading, our logistics team ensures your products arrive intact and on time. We consolidate multi-SKU orders and handle all export documentation.",
          highlights: [
            {
              title: "Climate-Controlled Storage",
              desc: "Temperature and humidity monitored 24/7 — critical for candles, oils and fragrance stability.",
            },
            {
              title: "Inventory Management",
              desc: "WMS system tracks every pallet in real-time. Clients get stock-level visibility on request.",
            },
            {
              title: "Consolidated Shipping",
              desc: "Combine products from multiple lines into one container — reduce freight cost per unit.",
            },
            {
              title: "Export Documentation",
              desc: "We handle commercial invoices, packing lists, CoO, fumigation certs and customs declarations.",
            },
            {
              title: "Container Loading",
              desc: "Professional loading with dunnage, strapping and photo documentation for insurance claims.",
            },
            {
              title: "Safety Stock Programme",
              desc: "We hold agreed safety stock for repeat clients — 2-week dispatch on reorders.",
            },
          ],
          stats: [
            { num: "8,000 m²", label: "Warehouse Space" },
            { num: "30+", label: "Export Countries" },
            { num: "24/7", label: "Climate Monitoring" },
            { num: "2 Weeks", label: "Reorder Dispatch" },
          ],
          faqs: [
            {
              q: "Can you ship to Amazon FBA warehouses?",
              a: "Yes — we label, poly-bag and ship directly to FBA with carton-level compliance and FNSKU application.",
            },
            {
              q: "Do you offer DDP shipping?",
              a: "Yes — we quote DDP to major destinations including US, EU, UK and Australia.",
            },
          ],
          cta: "Tell us your destination and volume — we'll propose the optimal shipping solution.",
        },
        "production-capacity": {
          icon: "clock",
          title: "Production Capacity",
          desc: "50,000+ units per month across candles, diffusers and oil filling lines.",
          hero: "Scale without compromise. Our 4 production lines handle everything from 500-unit pilot runs to full container orders — with dedicated lines for candles, diffusers, oil filling and packaging.",
          highlights: [
            {
              title: "Candle Line",
              desc: "Automated pouring, wicking and curing — 20,000 candles/month with consistent quality.",
            },
            {
              title: "Diffuser Line",
              desc: "Precision filling and assembly — 15,000 diffusers/month with automated reed insertion.",
            },
            {
              title: "Oil Filling Line",
              desc: "Nitrogen-flushed filling from 5 ml to 500 ml — 25,000 bottles/month.",
            },
            {
              title: "Packaging Line",
              desc: "Box assembly, labelling, shrink-wrap and cartoning — integrated with all production lines.",
            },
            {
              title: "Flexible Scheduling",
              desc: "Pilot runs from 500 units without disrupting mass production schedules.",
            },
            {
              title: "Seasonal Surge",
              desc: "We scale to 80,000 units/month for Q4 with temporary lines and additional shifts.",
            },
          ],
          stats: [
            { num: "50,000+", label: "Units / Month" },
            { num: "4", label: "Production Lines" },
            { num: "500", label: "Min Pilot Run" },
            { num: "80,000", label: "Peak Capacity (Q4)" },
          ],
          faqs: [
            {
              q: "What is your lead time for a full container?",
              a: "25–35 days depending on product mix and customisation level. Pilot runs ship in 15–20 days.",
            },
            {
              q: "Can you handle seasonal volume spikes?",
              a: "Yes — we plan Q4 capacity 3 months ahead with clients. Peak output reaches 80,000 units/month.",
            },
          ],
          cta: "Share your volume forecast — we'll confirm capacity and lock production slots.",
        },
        certificates: {
          icon: "file",
          title: "Certificates & Compliance",
          desc: "REACH/CLP, MSDS/SDS, IFRA compliance and shipping/transport documentation for US, EU and global markets.",
          hero: "Compliance isn't optional — it's your market access. We provide market-specific documentation (REACH/CLP, MSDS/SDS, IFRA compliance, shipping & transport safety reports) for every shipment so your products clear customs without delays; third-party lab or facility audits can be arranged on request.",
          highlights: [
            {
              title: "IFRA Compliance",
              desc: "Fragrance formulas aligned to IFRA standards; compliance documentation available on request.",
            },
            {
              title: "REACH & CLP",
              desc: "EU chemical & labelling documentation (REACH/CLP certificate) available for every shipment.",
            },
            {
              title: "MSDS / SDS",
              desc: "Safety data sheets produced per GHS format for every product, in destination-language.",
            },
            {
              title: "Shipping / Transport Safety",
              desc: "Transport-safety and shipping reports supporting air/sea freight of fragrance goods.",
            },
          ],
          stats: [
            { num: "REACH/CLP", label: "EU Chemical & Labelling Docs" },
            { num: "MSDS/SDS", label: "Safety Data Sheets" },
            { num: "IFRA", label: "Fragrance Compliance Docs" },
          ],
          faqs: [
            {
              q: "Can you provide certificates for our specific market?",
              a: "Yes — tell us your destination country and we prepare all required compliance documentation.",
            },
            {
              q: "Do you update certificates when regulations change?",
              a: "Yes — our compliance team monitors regulatory changes and updates formulas/docs proactively.",
            },
          ],
          cta: "Request our full compliance package — we'll send certificates relevant to your market.",
        },
      },
    },
    countryPages: {
      eyebrow: "Export Markets",
      title: "Export to Your Country",
      subtitle:
        "Market-specific compliance, shipping and product guidance for importing aroma products from China.",
      nav_label: "Export Markets",
      items: {
        usa: {
          icon: "globe",
          title: "Export to USA",
          desc: "FDA-registered, ASTM-tested aroma products shipped to the United States with full compliance documentation.",
          hero: "We've shipped thousands of SKUs to the US — candles, essential oils, diffusers and home fragrance. FDA facility registration, ASTM fire-safety testing, California Prop 65 compliance and FBA-ready packaging are standard on every US-bound order.",
          stats: [
            { num: "FDA", label: "Facility Registered" },
            { num: "ASTM", label: "Fire-Safety Tested" },
            { num: "15–20", label: "Days Sea Freight" },
            { num: "DDP", label: "Shipping Available" },
          ],
          regulations: [
            {
              title: "FDA Registration",
              desc: "Our facility is FDA-registered for cosmetics and household products. We provide the registration number for your import records.",
            },
            {
              title: "ASTM F2417 / F2601",
              desc: "All candles are tested to ASTM fire-safety standards. Test reports included with every shipment.",
            },
            {
              title: "California Prop 65",
              desc: "Products are tested for Prop 65 listed chemicals. Warning labels applied when required.",
            },
            {
              title: "TSCA Compliance",
              desc: "Fragrance ingredients verified against EPA TSCA inventory for legal import.",
            },
            {
              title: "CPSC Guidelines",
              desc: "Candle labelling meets CPSC requirements: manufacturer info, burn instructions, safety warnings.",
            },
            {
              title: "FBA / Amazon",
              desc: "FNSKU labelling, poly-bag warnings, hazmat documentation and direct FBA warehouse delivery.",
            },
          ],
          products: [
            {
              title: "Soy Candles",
              desc: "Private-label soy candles in glass jars and tins — the #1 import category for US home fragrance brands.",
            },
            {
              title: "Essential Oil Sets",
              desc: "Multi-pack gift sets (6×10 ml) optimised for Amazon A+ content and US gifting seasons.",
            },
            {
              title: "Reed Diffusers",
              desc: "Elegant glass diffusers with fibre reeds — strong margins for US boutique retailers.",
            },
          ],
          shipping: [
            {
              title: "Sea Freight (FCL/LCL)",
              desc: "15–20 days port-to-port (Ningbo → LA/Long Beach/NY). We handle customs clearance and last-mile to your warehouse or FBA.",
            },
            {
              title: "Air Express",
              desc: "5–7 days for samples and urgent restocks. DHL/FedEx/UPS with full hazmat documentation for oils and candles.",
            },
            {
              title: "DDP Service",
              desc: "Door-to-door delivery with all duties, taxes and customs handled. One invoice, no surprises.",
            },
            {
              title: "FBA Direct",
              desc: "We label, poly-bag, carton and ship directly to your designated Amazon FBA warehouse with full compliance.",
            },
          ],
          faqs: [
            {
              q: "Do you handle US customs clearance?",
              a: "Yes — we provide all documentation (commercial invoice, packing list, CoO, FDA registration) and can arrange customs brokerage.",
            },
            {
              q: "Are your candles Prop 65 compliant?",
              a: "Yes — we test for all Prop 65 listed chemicals and apply warning labels where required. Test reports available on request.",
            },
          ],
          cta: "Ready to import to the US? Share your product list and we'll prepare a compliance-ready quote.",
        },
        germany: {
          icon: "globe",
          title: "Export to Germany",
          desc: "REACH & CLP compliant aroma products for the German market with full EU documentation.",
          hero: "Germany is Europe's largest home-fragrance market. We supply REACH-registered, CLP-labelled products with German-language safety documentation — meeting the strict standards German importers and retailers demand.",
          stats: [
            { num: "REACH", label: "Registered Substances" },
            { num: "CLP", label: "Compliant Labelling" },
            { num: "25–30", label: "Days Sea Freight" },
            { num: "EU", label: "Conformity Docs" },
          ],
          regulations: [
            {
              title: "REACH Registration",
              desc: "All fragrance substances verified against REACH registered list. We provide compliance declarations for your records.",
            },
            {
              title: "CLP Labelling",
              desc: "German-language CLP labels with hazard pictograms, signal words, allergen declarations and UFI codes.",
            },
            {
              title: "EU Cosmetics Regulation",
              desc: "Products for skin contact (oils, massage blends) comply with EC 1223/2009 with full PIF documentation.",
            },
            {
              title: "GPSR (2024)",
              desc: "General Product Safety Regulation compliance with EU responsible person designation.",
            },
            {
              title: "VerpackG / LUCID",
              desc: "Packaging registered with Zentrale Stelle Verpackungsregister. We assist with your LUCID registration.",
            },
            {
              title: "German Labelling",
              desc: "All product labels, safety warnings and instructions available in German (Deutsch).",
            },
          ],
          products: [
            {
              title: "CLP-Labelled Candles",
              desc: "Soy and paraffin candles with full German CLP labels — ready for retail shelf or online sale.",
            },
            {
              title: "Essential Oils (Cosmetic Grade)",
              desc: "Oils with full EU cosmetic compliance: CPNP notification support, allergen declarations, German SDS.",
            },
            {
              title: "Reed Diffuser Sets",
              desc: "CLP-compliant diffusers with UFI codes — the fastest-growing category in German home fragrance.",
            },
          ],
          shipping: [
            {
              title: "Sea Freight (FCL/LCL)",
              desc: "25–30 days (Ningbo → Hamburg/Bremerhaven). We handle EU customs documentation and can arrange inland delivery.",
            },
            {
              title: "Rail Freight",
              desc: "18–22 days via China-Europe Railway (Yiwu → Duisburg). Cost-effective for medium volumes.",
            },
            {
              title: "EU Customs Clearance",
              desc: "We prepare all import documentation: commercial invoice, packing list, CoO, REACH/CLP declarations.",
            },
            {
              title: "DDP to Germany",
              desc: "Full door-to-door service including EU import duties (6.5% candles, 3% oils) and 19% VAT handling.",
            },
          ],
          faqs: [
            {
              q: "Do you provide German-language SDS?",
              a: "Yes — safety data sheets in German per CLP/GHS format, with all 16 sections and national exposure limits.",
            },
            {
              q: "Can you handle EU customs clearance?",
              a: "We prepare all documentation. For actual clearance, we work with your customs broker or recommend a partner.",
            },
          ],
          cta: "Tell us your product requirements for the German market — we'll prepare a REACH/CLP-ready quote.",
        },
        france: {
          icon: "globe",
          title: "Export to France",
          desc: "EU-compliant aroma products with French-language documentation for the French market.",
          hero: "France's fragrance heritage makes it a discerning market. We supply IFRA-compliant products with French CLP labelling, allergen declarations and the quality French buyers expect — from Grasse-inspired blends to modern home fragrance.",
          stats: [
            { num: "IFRA", label: "51st Amendment" },
            { num: "CLP", label: "French Labelling" },
            { num: "25–30", label: "Days Sea Freight" },
            { num: "EU", label: "Full Compliance" },
          ],
          regulations: [
            {
              title: "REACH & CLP",
              desc: "Full EU chemical compliance with French-language hazard labels, allergen lists and UFI codes.",
            },
            {
              title: "IFRA Standards",
              desc: "Every fragrance formula verified against IFRA 51st Amendment — critical for the quality-conscious French market.",
            },
            {
              title: "EU Cosmetics (EC 1223/2009)",
              desc: "Skin-contact products with CPNP notification support and French-language ingredient lists (INCI).",
            },
            {
              title: "AGEC Law",
              desc: "Anti-waste law compliance: recyclability markings, Triman logo, and packaging eco-design guidance.",
            },
            {
              title: "French Labelling",
              desc: "All labels, warnings and instructions in French. We work with native translators for accuracy.",
            },
            {
              title: "DGCCRF Compliance",
              desc: "Products meet French consumer protection standards for household and cosmetic goods.",
            },
          ],
          products: [
            {
              title: "Premium Scented Candles",
              desc: "High-fragrance-load soy candles with sophisticated scent profiles — matching French quality expectations.",
            },
            {
              title: "Perfumery-Grade Oils",
              desc: "Essential and fragrance oils with full IFRA documentation — for French cosmetics and perfumery clients.",
            },
            {
              title: "Luxury Diffuser Collections",
              desc: "Elegant glass diffusers with premium packaging — positioned for French boutique and concept stores.",
            },
          ],
          shipping: [
            {
              title: "Sea Freight",
              desc: "25–30 days (Ningbo → Le Havre/Marseille). Full EU customs documentation provided.",
            },
            {
              title: "Rail Freight",
              desc: "18–22 days via China-Europe Railway. Competitive for medium-volume orders to France.",
            },
            {
              title: "EU Customs & Inland",
              desc: "We handle documentation; customs clearance via your broker or our EU partner. Inland delivery to your warehouse.",
            },
            {
              title: "DDP to France",
              desc: "Door-to-door including EU duties and 20% TVA. One invoice, delivered to your door.",
            },
          ],
          faqs: [
            {
              q: "Do you provide French-language documentation?",
              a: "Oui — CLP labels, SDS, allergen declarations and product instructions all available in French.",
            },
            {
              q: "Can you develop Grasse-inspired fragrances?",
              a: "Yes — our perfumers create sophisticated French-style compositions from your brief or reference.",
            },
          ],
          cta: "Partagez vos besoins produit pour le marché français — nous préparons un devis conforme UE.",
        },
        spain: {
          icon: "globe",
          title: "Export to Spain",
          desc: "EU-compliant aroma products with Spanish-language documentation for the Iberian market.",
          hero: "Spain's growing home-fragrance market and strong retail sector make it an ideal entry point to Southern Europe. We supply CLP-compliant products with Spanish labelling, competitive pricing and flexible MOQs for Iberian importers.",
          stats: [
            { num: "CLP", label: "Spanish Labelling" },
            { num: "REACH", label: "EU Compliant" },
            { num: "25–30", label: "Days Sea Freight" },
            { num: "EU", label: "Full Documentation" },
          ],
          regulations: [
            {
              title: "REACH & CLP",
              desc: "Full EU compliance with Spanish-language hazard labels, allergen declarations and UFI codes.",
            },
            {
              title: "EU Cosmetics Regulation",
              desc: "Skin-contact products comply with EC 1223/2009. CPNP notification support included.",
            },
            {
              title: "Spanish Labelling (RD 1801)",
              desc: "Product labels meet Spanish consumer information requirements with proper Castilian Spanish text.",
            },
            {
              title: "Packaging Waste (Ley 7/2022)",
              desc: "Compliance with Spanish packaging waste law — recyclability marks and eco-design guidance.",
            },
            {
              title: "IFRA Compliance",
              desc: "All fragrances verified against IFRA standards for safe use in household and cosmetic products.",
            },
            {
              title: "AEMPS Notification",
              desc: "Cosmetic products notified to Spanish health authority where required.",
            },
          ],
          products: [
            {
              title: "Scented Candles",
              desc: "Soy and paraffin candles with Spanish CLP labels — strong demand in Spanish retail and hospitality.",
            },
            {
              title: "Reed Diffusers",
              desc: "Mediterranean-inspired scent profiles (citrus, sea breeze, olive blossom) for the Spanish market.",
            },
            {
              title: "Essential Oils",
              desc: "Pure oils with Spanish SDS and allergen declarations — for cosmetics and aromatherapy channels.",
            },
          ],
          shipping: [
            {
              title: "Sea Freight",
              desc: "25–30 days (Ningbo → Barcelona/Valencia). We handle all EU customs documentation.",
            },
            {
              title: "Rail + Road",
              desc: "Combined rail to Madrid corridor with last-mile road delivery. 20–25 days total.",
            },
            {
              title: "EU Customs Clearance",
              desc: "Full documentation package: invoice, packing list, CoO, REACH/CLP declarations for your broker.",
            },
            {
              title: "DDP to Spain",
              desc: "Door-to-door including EU duties and 21% IVA. Simplified import for Spanish businesses.",
            },
          ],
          faqs: [
            {
              q: "Do you provide Spanish-language labels?",
              a: "Sí — CLP labels, SDS, allergen lists and product instructions all in Castilian Spanish.",
            },
            {
              q: "What are the import duties for Spain?",
              a: "EU common tariff: 0% for essential oils, 6.5% for candles, 3% for glassware. We provide HS codes.",
            },
          ],
          cta: "Comparta sus requisitos de producto para el mercado español — prepararemos un presupuesto conforme UE.",
        },
        canada: {
          icon: "globe",
          title: "Export to Canada",
          desc: "Health Canada and CCPSA compliant aroma products for the Canadian market.",
          hero: "Canada's bilingual requirements and unique regulatory framework (CCPSA, Consumer Chemicals and Containers Regulations) demand specific compliance. We handle both English and French labelling, ensuring your products clear Canadian customs without delays.",
          stats: [
            { num: "CCPSA", label: "Product Safety" },
            { num: "Bilingual", label: "EN + FR Labels" },
            { num: "18–22", label: "Days Sea Freight" },
            { num: "DDP", label: "Shipping Available" },
          ],
          regulations: [
            {
              title: "CCPSA Compliance",
              desc: "Canada Consumer Product Safety Act — products meet Canadian safety requirements for household goods.",
            },
            {
              title: "Bilingual Labelling (EN/FR)",
              desc: "All product labels, warnings and instructions in both English and French per Canadian law.",
            },
            {
              title: "Consumer Chemicals & Containers",
              desc: "Candles and oils comply with CCCR requirements: hazard symbols, precautionary statements, first-aid info.",
            },
            {
              title: "Natural Health Products",
              desc: "Essential oils marketed for therapeutic use require NHP notification — we provide supporting documentation.",
            },
            {
              title: "CEPA Compliance",
              desc: "Fragrance ingredients verified against Canadian Environmental Protection Act domestic substances list.",
            },
            {
              title: "Competitive Act Labelling",
              desc: "Net quantity, dealer identity and country of origin per Canadian labelling regulations.",
            },
          ],
          products: [
            {
              title: "Bilingual Candles",
              desc: "Soy candles with English/French safety labels — compliant with CCPSA and CCCR for Canadian retail.",
            },
            {
              title: "Essential Oil Collections",
              desc: "Pure oils with bilingual documentation — for Canadian aromatherapy and natural health retailers.",
            },
            {
              title: "Reed Diffusers",
              desc: "Elegant diffusers with bilingual labels — growing category in Canadian home décor stores.",
            },
          ],
          shipping: [
            {
              title: "Sea Freight",
              desc: "18–22 days (Ningbo → Vancouver) or 25–30 days to Toronto/Montreal via Panama Canal.",
            },
            {
              title: "Air Express",
              desc: "4–6 days for samples and urgent orders. Full hazmat documentation for oils and candles.",
            },
            {
              title: "Canadian Customs",
              desc: "We prepare all documentation: invoice, packing list, CoO, safety data. HS codes for duty calculation.",
            },
            {
              title: "DDP to Canada",
              desc: "Door-to-door including Canadian duties (6.5% candles, 0% essential oils) and GST/HST handling.",
            },
          ],
          faqs: [
            {
              q: "Do you provide bilingual (EN/FR) labels?",
              a: "Yes — all product labels, safety warnings and instructions are produced in both English and French per Canadian requirements.",
            },
            {
              q: "What are Canadian import duties?",
              a: "Essential oils: 0% duty. Candles: 6.5%. Glass diffusers: 8%. We provide correct HS codes for your broker.",
            },
          ],
          cta: "Ready to import to Canada? Share your product list and we'll prepare a bilingual, compliance-ready quote.",
        },
      },
    },
    comparePages: {
      eyebrow: "Product Comparisons",
      title: "Product Comparison Guides",
      subtitle:
        "Side-by-side comparisons to help you choose the right materials and products for your brand.",
      nav_label: "Comparisons",
      items: {
        "soy-vs-paraffin": {
          title: "Soy Wax vs Paraffin Wax",
          desc: "A detailed comparison of soy and paraffin candle wax — burn time, scent throw, cost, sustainability and market positioning.",
          optionA: "Soy Wax",
          optionB: "Paraffin Wax",
          intro:
            "Choosing between soy and paraffin wax is one of the first decisions for any candle brand. Each has distinct advantages depending on your positioning, price point and target customer.",
          rows: [
            {
              criterion: "Source",
              a: "Natural — hydrogenated soybean oil (renewable)",
              b: "Petroleum — by-product of crude oil refining",
            },
            {
              criterion: "Burn Time",
              a: "30–50% longer (slower, cooler burn)",
              b: "Standard burn rate",
            },
            {
              criterion: "Scent Throw",
              a: "Good cold throw; moderate hot throw (lower melt point)",
              b: "Excellent hot throw (higher melt point releases more fragrance)",
            },
            {
              criterion: "Soot",
              a: "Minimal soot — cleaner burn",
              b: "More soot and black smoke if poorly wicked",
            },
            {
              criterion: "Cost",
              a: "2–3× more expensive per kg",
              b: "Cheapest wax option available",
            },
            {
              criterion: "Sustainability",
              a: "Biodegradable, renewable, carbon-neutral marketing angle",
              b: "Non-renewable petroleum derivative",
            },
            {
              criterion: "Appearance",
              a: "Creamy, opaque finish; prone to frosting",
              b: "Smooth, translucent; takes dye vividly",
            },
            {
              criterion: "Market Perception",
              a: "Premium, eco-conscious, natural positioning",
              b: "Traditional, mass-market, value positioning",
            },
            {
              criterion: "Best For",
              a: "Boutique brands, eco-conscious consumers, premium retail",
              b: "Volume brands, vibrant colours, strong scent throw priority",
            },
          ],
          verdict:
            "Choose soy for premium, eco-positioned brands targeting conscious consumers. Choose paraffin for volume, colour-vibrant lines where strong hot throw and low cost are priorities. Many successful brands offer both — soy as the hero line, paraffin as the value range.",
          faqs: [
            {
              q: "Can you blend soy and paraffin?",
              a: "Yes — soy-paraffin blends (e.g. 70/30) combine soy's clean burn with paraffin's scent throw and lower cost. We formulate custom blends.",
            },
            {
              q: "Which wax do your clients prefer?",
              a: "About 70% of our private-label clients choose soy or soy-blend for Western markets. Paraffin remains popular for volume and highly-coloured decorative candles.",
            },
          ],
          cta: "Not sure which wax suits your brand? Share your positioning and we'll recommend the right formula.",
        },
        "essential-vs-fragrance-oil": {
          title: "Essential Oil vs Fragrance Oil",
          desc: "Understanding the differences between essential oils and fragrance oils — composition, applications, cost and regulatory requirements.",
          optionA: "Essential Oil",
          optionB: "Fragrance Oil",
          intro:
            "Essential oils and fragrance oils serve different purposes in aromatherapy, cosmetics and home fragrance. Understanding their differences helps you choose the right ingredient for your product.",
          rows: [
            {
              criterion: "Composition",
              a: "100% natural — extracted from plants (distillation, cold press)",
              b: "Synthetic or semi-synthetic — lab-created aromatic compounds",
            },
            {
              criterion: "Scent Range",
              a: "Limited to what nature provides (~300 commercial oils)",
              b: "Unlimited — any scent imaginable (ocean breeze, fresh linen, etc.)",
            },
            {
              criterion: "Therapeutic Value",
              a: "Yes — aromatherapy benefits (calming, energising, antibacterial)",
              b: "No therapeutic claims — purely aromatic",
            },
            {
              criterion: "Cost",
              a: "Expensive (USD 20–500+ per kg depending on plant)",
              b: "Affordable (USD 5–30 per kg)",
            },
            {
              criterion: "Consistency",
              a: "Varies by harvest, climate, region (natural variation)",
              b: "Perfectly consistent batch-to-batch (lab-controlled)",
            },
            {
              criterion: "Allergen Risk",
              a: "Higher — natural allergens (linalool, limonene, etc.)",
              b: "Lower — can be formulated allergen-free",
            },
            {
              criterion: "Regulatory",
              a: "Cosmetics regulation, IFRA, allergen declaration required",
              b: "IFRA compliance, CLP labelling, no therapeutic claims",
            },
            {
              criterion: "Shelf Life",
              a: "1–3 years (oxidises, especially citrus oils)",
              b: "2–5 years (more stable synthetic compounds)",
            },
            {
              criterion: "Best For",
              a: "Aromatherapy, natural cosmetics, wellness brands, spa",
              b: "Candles, diffusers, household products, consistent scent branding",
            },
          ],
          verdict:
            "Use essential oils when your brand story centres on natural, therapeutic or wellness positioning. Use fragrance oils for consistent, creative scents in candles and diffusers where cost and variety matter. Many brands use both — essential oils for the 'hero' story, fragrance oils for the broader range.",
          faqs: [
            {
              q: "Can you mix essential and fragrance oils?",
              a: "Yes — hybrid blends give you the natural story of essential oils with the consistency and scent range of fragrance oils. We formulate custom blends.",
            },
            {
              q: "Which is better for candles?",
              a: "Fragrance oils are generally preferred for candles — better hot throw, wider scent range, lower cost and better stability at high temperatures.",
            },
          ],
          cta: "Tell us your product concept and we'll recommend the right oil type and formulation.",
        },
        "reed-diffuser-vs-candle": {
          title: "Reed Diffuser vs Scented Candle",
          desc: "Comparing reed diffusers and scented candles — longevity, safety, cost, scent strength and ideal use cases.",
          optionA: "Reed Diffuser",
          optionB: "Scented Candle",
          intro:
            "Both reed diffusers and candles deliver home fragrance, but they serve different needs. This comparison helps you decide which product line to launch — or why you should offer both.",
          rows: [
            {
              criterion: "Flame / Safety",
              a: "Flameless — no fire risk, safe around children and pets",
              b: "Open flame — requires supervision, fire-safety labelling",
            },
            {
              criterion: "Scent Duration",
              a: "6–12 weeks continuous (passive diffusion)",
              b: "25–80 hours total (active, only when lit)",
            },
            {
              criterion: "Scent Strength",
              a: "Subtle, ambient — fills a room gently",
              b: "Stronger when lit — active hot throw fills space quickly",
            },
            {
              criterion: "Maintenance",
              a: "Zero — flip reeds weekly, otherwise unattended",
              b: "Trim wick, monitor burn, extinguish — active use",
            },
            {
              criterion: "Cost to Consumer",
              a: "Higher upfront (USD 20–60) but lasts months",
              b: "Lower upfront (USD 10–35) but burns out in hours",
            },
            {
              criterion: "Manufacturing Cost",
              a: "Higher (glass vessel + fragrance oil + reeds + box)",
              b: "Lower (wax + vessel + wick + label)",
            },
            {
              criterion: "Regulatory Burden",
              a: "Lower — CLP label, no fire-safety testing",
              b: "Higher — fire-safety testing (ASTM/EN), burn warnings, SDS",
            },
            {
              criterion: "Best Rooms",
              a: "Bathrooms, bedrooms, offices, hotels — continuous ambient",
              b: "Living rooms, dining, spas — ritual and atmosphere",
            },
            {
              criterion: "Gift Appeal",
              a: "Elegant, long-lasting — premium gifting",
              b: "Warm, experiential — seasonal and impulse gifting",
            },
          ],
          verdict:
            "Offer both. Diffusers are your 'always-on' ambient product with higher margins and lower regulatory burden. Candles are your 'ritual' product with stronger emotional connection and impulse-buy appeal. Together they form a complete home-fragrance collection.",
          faqs: [
            {
              q: "Which has better profit margins?",
              a: "Reed diffusers typically offer 60–70% margins vs 50–60% for candles, due to higher perceived value and lower manufacturing cost relative to retail price.",
            },
            {
              q: "Which is easier to ship?",
              a: "Diffusers are easier — no hazmat classification (unlike candles which may require hazmat docs for air freight). Diffusers ship as standard goods.",
            },
          ],
          cta: "Planning a home-fragrance line? We'll help you build the right mix of diffusers and candles.",
        },
        "glass-vs-tin-candle": {
          title: "Glass Jar vs Tin Candle",
          desc: "Comparing glass and tin candle vessels — aesthetics, cost, safety, shipping and brand positioning.",
          optionA: "Glass Jar",
          optionB: "Tin / Metal",
          intro:
            "The vessel defines your candle's shelf presence, price perception and shipping logistics. Glass and tin each have distinct advantages depending on your brand positioning.",
          rows: [
            {
              criterion: "Aesthetics",
              a: "Premium, elegant — shows wax colour, light plays through glass",
              b: "Rustic, modern, industrial — opaque, matte or printed finish",
            },
            {
              criterion: "Cost",
              a: "Higher (USD 0.50–2.00 per vessel)",
              b: "Lower (USD 0.20–0.80 per vessel)",
            },
            {
              criterion: "Weight",
              a: "Heavier — higher shipping cost per unit",
              b: "Lighter — lower shipping cost, more units per carton",
            },
            {
              criterion: "Breakage Risk",
              a: "Fragile — requires protective packaging, higher breakage rate",
              b: "Durable — virtually unbreakable in transit",
            },
            {
              criterion: "Heat Resistance",
              a: "Excellent — handles high temperatures safely",
              b: "Good — but exterior gets hot, needs warning label",
            },
            {
              criterion: "Customisation",
              a: "Frosted, coloured, printed, custom moulds (from 3,000 units)",
              b: "Printed, embossed, custom shapes (from 5,000 units)",
            },
            {
              criterion: "Sustainability",
              a: "Recyclable, reusable — strong eco story",
              b: "Recyclable, reusable — also strong eco story",
            },
            {
              criterion: "Best For",
              a: "Premium brands, spa, luxury gifting, visible wax colours",
              b: "Travel candles, outdoor, modern/industrial brands, cost-sensitive",
            },
          ],
          verdict:
            "Glass for premium positioning where aesthetics and light play matter. Tin for travel-size, outdoor, cost-sensitive or industrial-aesthetic brands. Many brands use glass for their hero line and tin for travel/minis — covering both price points.",
          faqs: [
            {
              q: "Can you do custom-shaped glass jars?",
              a: "Yes — custom moulds from 3,000 units. Mould cost USD 500–2,000, refundable on repeat orders over 10,000 units.",
            },
            {
              q: "Which is better for Amazon FBA?",
              a: "Tin is easier for FBA — lighter (lower FBA fees), unbreakable (no poly-bag requirement for glass), and lower return rate from transit damage.",
            },
          ],
          cta: "Not sure which vessel suits your candle line? Share your concept and we'll recommend the right option.",
        },
      },
    },
    downloads: {
      eyebrow: "Resource Library",
      title: "Download Center",
      subtitle:
        "Ready-to-share documents generated live from our current product data — always up to date, no outdated PDFs.",
      open: "Open document",
      hint: "Generated documents open in your browser — use the Download PDF button (or Ctrl+P) to save a copy. Catalog PDFs download straight to your device.",
      back: "Back to Download Center",
      download_pdf: "Download PDF",
      products: "products",
      lead_time: "Lead time",
      certs: "Certifications",
      rts_products: "Ready-to-Ship products (live from current stock data)",
      full_range: "Looking for the full wholesale range? Browse the Shop.",
      rts_empty:
        "No Ready-to-Ship products match the current stock criteria right now. Contact us for made-to-order options.",
      catalog_unavailable: "Product availability temporarily unavailable — please retry shortly.",
      no_image: "No image",
      ready_to_ship: "Ready to Ship",
      view_product: "View Product",
      request_quote: "Request Quote",
      catalog_title: "Product Catalog",
      catalog_desc:
        "Complete Aromiso product catalog with specifications, MOQ and lead times — generated from live product data.",
      catalog_subtitle: "Full range across 6 categories with specifications, MOQ and lead times.",
      catalog_cta_title: "Request Pricing",
      catalog_cta_text:
        "This catalog is generated from live data. For current pricing, samples or custom formulations, contact our team.",
      certificates_title: "Certifications & Compliance",
      certificates_desc:
        "Overview of Aromiso quality certifications and compliance standards — ISO, IFRA, REACH and more.",
      certificates_subtitle:
        "Quality systems and product compliance standards behind every Aromiso product.",
      cert_cta_title: "Need Specific Documents?",
      cert_cta_text:
        "Full certificate copies, MSDS sheets and IFRA compliance statements are available on request for confirmed projects.",
      oem_title: "OEM / ODM Service Guide",
      oem_desc:
        "Complete guide to Aromiso private-label and contract manufacturing services — capabilities, specs and process.",
      oem_subtitle:
        "Eight manufacturing services with full specifications — from custom formulation to turnkey fulfilment.",
      oem_cta_title: "Start Your Project",
      oem_cta_text:
        "Share your product concept and target market — we'll respond with a tailored proposal within 2 business days.",
      packaging_title: "Packaging Guide",
      packaging_desc:
        "Packaging options for every Aromiso product category — vessels, closures, boxes and private-label finishing.",
      packaging_subtitle:
        "Standard and custom packaging options by product category, plus full turnkey packaging services.",
      packaging_custom_title: "Custom Packaging & Compliance",
      packaging_cta_title: "Design Your Packaging",
      packaging_cta_text:
        "Send us your brand guidelines — our design team will propose packaging mockups within 5 business days.",
    },
    // -----------------------------------------------------------------
    // V5.27 growth expansion — solutions hub / sourcing / OEM / category
    // -----------------------------------------------------------------
    solutionsHub: {
      whoWeHelpTitle: "Who We Help",
      whoWeHelp: [
        {
          icon: "rocket",
          title: "Launch a New Aroma Brand",
          subtitle: "Private label & low MOQ products",
          cta: "Explore Private Label",
          href: "/oem",
        },
        {
          icon: "globe",
          title: "Source Products from China",
          subtitle: "Supplier verification & QC services",
          cta: "Explore Sourcing",
          href: "/sourcing",
        },
        {
          icon: "palette",
          title: "Develop Custom Products",
          subtitle: "OEM fragrance & packaging design",
          cta: "Explore OEM",
          href: "/oem",
        },
        {
          icon: "euro-dollar",
          title: "Import to Europe / USA",
          subtitle: "Compliance documentation ready",
          cta: "View Requirements",
          href: "/downloads/certificates",
        },
      ],
      matrixTitle: "Find Your Path",
      matrixSubtitle: "Match your business type to the right sourcing route",
      matrix: [
        {
          audience: "Amazon Sellers",
          solution: "Private Label + Small MOQ",
          icon: "box",
          href: "/solutions/amazon-sellers",
        },
        {
          audience: "Beauty & Lifestyle Brands",
          solution: "Custom Fragrance + Packaging",
          icon: "droplet",
          href: "/solutions/brand-owners",
        },
        {
          audience: "Hotels & Venues",
          solution: "Signature Scent Programs",
          icon: "bed",
          href: "/solutions/hotels",
        },
        {
          audience: "Retailers",
          solution: "Wholesale Ready-to-Ship",
          icon: "bag",
          href: "/solutions/retail",
        },
        {
          audience: "Gift Companies",
          solution: "Branded Gift Sets",
          icon: "gift",
          href: "/solutions/wholesalers",
        },
        {
          audience: "Distributors",
          solution: "Bulk OEM Partnerships",
          icon: "package",
          href: "/solutions/distributors",
        },
      ],
      howWeSolveTitle: "How We Solve It",
      howWeSolve: [
        { step: 1, title: "Product Brief", desc: "Share your concept, target market and volume" },
        { step: 2, title: "Supplier Match", desc: "We match you with verified partner factories" },
        { step: 3, title: "Sampling", desc: "Evaluate quality, fragrance and finish — 3–12 days" },
        { step: 4, title: "Production", desc: "Scale from pilot runs to full containers" },
        { step: 5, title: "Quality Control", desc: "Batch inspection and pre-shipment QC" },
        { step: 6, title: "Export", desc: "Compliance documentation and consolidated shipping" },
      ],
      industryIntro:
        "Whether you're launching a private-label candle line, building a hotel scent program, or scaling wholesale essential oils, we match you with partner factories that meet your specifications, certifications and delivery timeline.",
      solutionsTitle: "Industry-Specific Solutions",
      solutionsSubtitle: "Browse our solution guides for targeted sourcing strategies",
      finalCtaTitle: "Talk to a Sourcing Specialist",
      finalCtaText:
        "Discuss your project — product category, volume and timeline — and get a tailored roadmap with recommended suppliers.",
      faqs: [
        {
          q: "Can you help me launch a private-label aroma brand?",
          a: "Yes. We connect you with partner factories offering low-MOQ private label (from around 100 units), custom fragrances built on fine-fragrance inputs such as Firmenich and Givaudan, and full packaging design support.",
        },
        {
          q: "How do you verify supplier quality?",
          a: "Aromiso operates ISO 9001 and ISO 22716 (GMP) quality systems, and our partner factories hold certifications such as CE and BSCI, with SGS third-party testing available. We support factory audits, sample evaluation and batch inspection before shipment.",
        },
        {
          q: "What documents do you provide for import compliance?",
          a: "We can supply MSDS/SDS, sea and air transport safety reports, REACH/CLP compliance certificates where applicable, and SGS third-party test reports upon request.",
        },
        {
          q: "What are typical lead times?",
          a: "Samples: 3–12 days. Mass production: 10–35 days depending on customization level and order size. Partner factories maintain 10,000–50,000 bottles/day capacity for rush orders.",
        },
        {
          q: "Do you offer consolidation shipping?",
          a: "Yes. We consolidate multiple supplier shipments into single containers with full lot traceability — ideal for Amazon sellers and retailers sourcing across categories.",
        },
      ],
    },
    sourcingPage: {
      eyebrow: "China Sourcing",
      title: "Source Aroma Products from Verified Chinese Factories",
      subtitle:
        "We match your brief with vetted factories, verify quality and compliance, and consolidate everything into one shipment.",
      whatWeCanSourceTitle: "What We Can Source",
      whatWeCanSourceSubtitle:
        "Eight product families across our factory network — browse ready-made lines or brief us for custom sourcing.",
      whatWeCanSource: [
        {
          icon: "flame",
          title: "Scented Candles",
          desc: "Soy, coconut and blended wax candles in glass, tin or ceramic vessels.",
          href: "/products/candles",
        },
        {
          icon: "wind",
          title: "Reed Diffusers",
          desc: "Rattan-reed diffusers with custom vessels, caps and fragrance loads.",
          href: "/products/reed-diffusers",
        },
        {
          icon: "droplet",
          title: "Essential Oils",
          desc: "Pure and blended essential oils in bulk or retail-ready formats.",
          href: "/products/essential-oils",
        },
        {
          icon: "sparkles",
          title: "Fragrance Oils",
          desc: "Fine-fragrance oils from partner factories working with Firmenich, Givaudan, Ogawa and Robertet inputs.",
          href: "/products/fragrance-oils",
        },
        {
          icon: "car",
          title: "Car Fragrances",
          desc: "Vent clips, hanging cards and diffusers for automotive retail lines.",
          href: "/shop/?category=Car%20Fragrance",
        },
        {
          icon: "gift",
          title: "Gift Sets",
          desc: "Seasonal and corporate gift sets combining multiple categories.",
          href: "/shop/?category=Gift%20Sets",
        },
        {
          icon: "home",
          title: "Home Fragrance Accessories",
          desc: "Room sprays, sachets, wax melts, burners and aroma diffusers.",
          href: "/products/home-fragrance",
        },
        {
          icon: "package",
          title: "Packaging & Private-Label Finishing",
          desc: "Vessels, closures, boxes and label finishing for your brand.",
          href: "/products/packaging",
        },
      ],
      processTitle: "How Sourcing Works",
      process: [
        { step: 1, title: "Share Your Brief", desc: "Product, specs, target price and volume." },
        {
          step: 2,
          title: "Factory Matching",
          desc: "We shortlist verified factories from our network that fit your category, certifications and price point.",
        },
        {
          step: 3,
          title: "Sampling",
          desc: "Samples in 3–12 days — evaluate quality, scent and finish.",
        },
        {
          step: 4,
          title: "Negotiation & Contracts",
          desc: "We negotiate pricing, MOQ and lead times, and document every term.",
        },
        {
          step: 5,
          title: "Production & QC",
          desc: "Batch checks during production; pre-shipment QC with photos and reports.",
        },
        {
          step: 6,
          title: "Consolidation & Shipping",
          desc: "Multiple suppliers consolidated into one shipment with full documentation.",
        },
      ],
      verifyTitle: "What We Verify",
      verifySubtitle: "Every supplier in our network passes the same verification checklist",
      verify: [
        "Factory legitimacy & production capability (audit reports available)",
        "Certifications: CE, BSCI and export compliance for EU / US / Canada",
        "Product compliance: MSDS / SDS for every formulation",
        "Transport safety: sea & air freight transport identification reports",
        "Sample evaluation before any deposit is paid",
        "Batch consistency & fill accuracy during production",
        "Packaging integrity & labelling correctness",
        "Third-party testing via SGS / CNAS / CMA labs on request",
      ],
      networkTitle: "8 Partner Factories, 3 Capability Tiers",
      networkIntro:
        "We work with eight established partner factories across China, grouped into three capability tiers — so we can match any brief, from cost-driven volume orders to premium OEM programs.",
      tiers: [
        {
          name: "Volume & Value",
          desc: "Cost-efficient lines for ready-to-ship and high-turnover SKUs.",
          best: "Retailers, Amazon sellers, price-sensitive programs",
        },
        {
          name: "Balanced OEM",
          desc: "Flexible OEM/ODM with custom fragrance, vessels and packaging.",
          best: "Growing brands, private label from around 100 units",
        },
        {
          name: "Premium Brand Manufacturing",
          desc: "Large-scale facilities (5,000㎡+), fine-fragrance inputs from Firmenich, Givaudan, Ogawa and Robertet, full documentation suite.",
          best: "Established brands, hotel & spa programs",
        },
      ],
      networkStats: [
        { num: "8", label: "Partner factories" },
        { num: "3", label: "Capability tiers" },
        { num: "500+", label: "Available fragrances" },
        { num: "10k–50k", label: "Bottles per day" },
      ],
      auditCtaTitle: "Need an Audit Checklist?",
      auditCtaText:
        "Download our certification overview, or request full supplier audit documentation for confirmed projects.",
      auditCtaButton: "View Certificates & Documents",
      faqs: [
        {
          q: "Do I have to order a full container?",
          a: "No. We support LCL (less than container load) shipments and consolidate multiple suppliers into one shipment, so small and mid-size orders stay economical.",
        },
        {
          q: "Can you source products not in your catalog?",
          a: "Yes — send us a photo, spec sheet or reference sample. We match it against our eight partner factories and come back with options and pricing.",
        },
        {
          q: "How do you handle quality disputes?",
          a: "Every order includes pre-shipment QC with photos and reports. If a batch misses agreed specs, we coordinate rework or replacement with the factory before final payment.",
        },
        {
          q: "Which export documents can you provide?",
          a: "MSDS/SDS, sea and air transport safety reports, REACH/CLP certificates where applicable, and SGS third-party test reports — prepared for EU, US and Canada import requirements.",
        },
        {
          q: "What is the minimum order for sourcing projects?",
          a: "It depends on the product and factory tier. Ready-to-ship items can be ordered by the carton; private label starts around 100 units; custom OEM projects are quoted case by case.",
        },
      ],
    },
    oemHub: {
      eyebrow: "OEM / ODM",
      title: "Custom Manufacturing for Your Aroma Brand",
      subtitle:
        "From ready-made private label to fully bespoke formulations — eight services, one accountable partner.",
      customizeTitle: "What Can We Customize",
      customize: [
        {
          icon: "droplet",
          title: "Fragrance",
          items: [
            "500+ ready-made scents to choose from",
            "Custom formulation matched to your brief",
            "Fine-fragrance inputs (Firmenich, Givaudan, Ogawa, Robertet) via partner factories",
          ],
        },
        {
          icon: "flask",
          title: "Formulation",
          items: [
            "Soy, coconut and blended wax options",
            "Fragrance-load and burn tuning for candles",
            "Vegan-friendly and phthalate-free options",
          ],
        },
        {
          icon: "package",
          title: "Vessel & Packaging",
          items: [
            "Glass, tin and ceramic vessels",
            "Custom boxes, sleeves and inserts",
            "Sustainable packaging alternatives",
          ],
        },
        {
          icon: "tag",
          title: "Branding & Compliance",
          items: [
            "Labels, silk-screen printing and logo embossing",
            "EU / US compliance labelling support",
            "Barcode and multilingual label preparation",
          ],
        },
      ],
      chooseTitle: "Choose Your Product",
      chooseSubtitle: "Eight manufacturing services — pick your starting point",
      choose: [
        {
          icon: "droplet",
          title: "Private Label Essential Oil",
          desc: "Your label on proven pure and blended oils.",
          href: "/oem/private-label-essential-oil",
        },
        {
          icon: "flame",
          title: "Private Label Candle",
          desc: "Proven candle lines ready for your branding.",
          href: "/oem/private-label-candle",
        },
        {
          icon: "wind",
          title: "Private Label Reed Diffuser",
          desc: "Best-selling diffuser formats, your brand.",
          href: "/oem/private-label-diffuser",
        },
        {
          icon: "factory",
          title: "OEM Candle Manufacturing",
          desc: "Custom wax, vessel, scent and packaging.",
          href: "/oem/oem-candle",
        },
        {
          icon: "leaf",
          title: "OEM Essential Oil",
          desc: "Bulk or retail-ready oils to your spec.",
          href: "/oem/oem-essential-oil",
        },
        {
          icon: "package",
          title: "Custom Packaging",
          desc: "Vessels, boxes and finishing that sell.",
          href: "/oem/custom-packaging",
        },
        {
          icon: "sparkles",
          title: "Custom Fragrance",
          desc: "Signature scents developed to your brief.",
          href: "/oem/custom-fragrance",
        },
        {
          icon: "custom-bottle",
          title: "Custom Bottles & Vessels",
          desc: "Moulds and formats that fit your brand.",
          href: "/oem/custom-bottle",
        },
      ],
      levelsTitle: "How Custom Do You Need?",
      levelsSubtitle: "Four levels — from ready-made stock to fully bespoke OEM/ODM",
      levels: [
        {
          name: "Ready-Made",
          tagline: "Fastest to market",
          points: [
            "In-stock catalog, dispatch within 48 hours",
            "Order by piece or carton — no heavy commitment",
            "Best for testing new markets and channels",
          ],
          cta: "Browse Ready to Ship",
          href: "/shop/?rts=1",
        },
        {
          name: "Private Label",
          tagline: "Your brand, our products",
          points: [
            "Your label on proven formulations",
            "MOQ from around 100 units",
            "Samples in 3–12 days",
          ],
          cta: "Explore Private Label",
          href: "/oem/private-label-candle",
        },
        {
          name: "Semi-Custom",
          tagline: "Tune the details",
          points: [
            "Custom fragrance, vessel or packaging",
            "MOQ depends on the customized component",
            "Samples in 3–12 days",
          ],
          cta: "Discuss Semi-Custom",
          href: "/oem/custom-fragrance",
        },
        {
          name: "Full OEM / ODM",
          tagline: "Built from your brief",
          points: [
            "Bespoke formulation, tooling and design",
            "Mass production 10–35 days (order-dependent)",
            "Full documentation suite for import",
          ],
          cta: "Start a Project",
          href: "/contact",
        },
      ],
      processTitle: "The OEM Process",
      process: [
        { step: 1, title: "Inquiry", desc: "Share your concept, specs and target quantity." },
        {
          step: 2,
          title: "Consultation",
          desc: "We clarify requirements and recommend options within 2 business days.",
        },
        { step: 3, title: "Quotation", desc: "Detailed quote with MOQ, unit price and lead time." },
        { step: 4, title: "Sampling", desc: "Samples produced in 3–12 days for your evaluation." },
        {
          step: 5,
          title: "Confirmation",
          desc: "Approve sample, confirm artwork and documentation.",
        },
        { step: 6, title: "Production", desc: "Mass production in 10–35 days depending on order." },
        {
          step: 7,
          title: "Quality Control",
          desc: "In-line checks plus pre-shipment QC with reports.",
        },
        { step: 8, title: "Delivery", desc: "Export documentation and consolidated shipping." },
      ],
      faqs: [
        {
          q: "What is the MOQ for private label orders?",
          a: "Private label starts from around 100 units for most products. Fully custom OEM projects (new moulds, bespoke formulations) carry higher MOQs — we confirm exact numbers in your quotation.",
        },
        {
          q: "Can you develop a fragrance from my description?",
          a: "Yes. Partner factories work with fine-fragrance inputs from houses such as Firmenich, Givaudan, Ogawa and Robertet, and can match a reference scent or build a new one from your brief.",
        },
        {
          q: "How long does sampling take?",
          a: "Typically 3–12 days depending on complexity. Ready-made samples from stock can ship even faster.",
        },
        {
          q: "Do you handle EU / US compliance labelling?",
          a: "Yes — we prepare CLP/REACH-style labelling for the EU market and compliant labelling for the US, plus MSDS/SDS and transport safety reports for your shipment.",
        },
        {
          q: "Can I start small and scale later?",
          a: "That's the usual path: test with ready-to-ship or private-label quantities, then move to semi-custom or full OEM once the SKU proves out. Your specs stay with us for repeat orders.",
        },
      ],
    },
    categoryPages: {
      subcatsTitle: "Popular in This Category",
      buyGuideTitle: "Buying Guide",
      qualityTitle: "Quality & Documentation",
      quality: [
        "ISO 9001 / ISO 22716 (GMP) quality systems",
        "MSDS / SDS available for every product",
        "REACH / CLP compliance documentation on request",
        "Third-party testing via SGS / CNAS / CMA labs",
      ],
      sourcingTitle: "Sourcing & Customization",
      sourcing: [
        "Ready-to-ship stock — dispatch within 48 hours",
        "Private label from around 100 units",
        "Custom fragrance, vessels and packaging (OEM/ODM)",
        "Consolidated shipping across categories",
      ],
      recsTitle: "You May Also Need",
      browseAll: "Browse all products",
      "essential-oils": {
        subcats: [
          { label: "Bulk Essential Oils", href: "/shop/?q=essential%20oil" },
          { label: "Ready to Ship", href: "/shop/?q=essential%20oil&rts=1" },
          { label: "Low MOQ (≤ 50)", href: "/shop/?q=essential%20oil&moq=le50" },
        ],
        guide:
          "Buying essential oils in bulk comes down to purity, consistency and documentation. Verify botanical names and extraction methods, request MSDS/SDS for every SKU, and always evaluate samples for scent profile and batch consistency before committing volume.",
        points: [
          "Ask for the MSDS/SDS and usage guidance per SKU",
          "Confirm extraction method (steam-distilled, cold-pressed) in writing",
          "Evaluate at least two sample batches for scent consistency",
          "For retail: check dropper/closure quality and label compliance",
        ],
      },
      "fragrance-oils": {
        subcats: [
          { label: "Fragrance Oils in Stock", href: "/shop/?q=fragrance%20oil" },
          { label: "Ready to Ship", href: "/shop/?q=fragrance%20oil&rts=1" },
          { label: "Custom Fragrance Service", href: "/oem/custom-fragrance" },
        ],
        guide:
          "Fragrance oils are engineered for performance in specific carriers — candles, diffusers or skin-contact applications. Match the oil to the application, confirm fragrance load recommendations, and ask whether the oil is built on fine-fragrance inputs.",
        points: [
          "Confirm the oil suits your carrier (wax, diffuser base, cosmetic)",
          "Ask for recommended fragrance load per application",
          "Request phthalate-free / vegan options if your market expects it",
          "Partner factories can match a reference scent or build a bespoke one",
        ],
      },
      "reed-diffusers": {
        subcats: [
          {
            label: "Reed Diffusers in Stock",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser",
          },
          {
            label: "Ready to Ship",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&rts=1",
          },
          {
            label: "MOQ ≤ 10",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&moq=le10",
          },
        ],
        guide:
          "A good reed diffuser balances vessel, reed count and fragrance load for consistent throw over weeks. Decide vessel style first, then tune reed count and oil volume to the room size your customers target.",
        points: [
          "Glass vessels with narrow necks slow evaporation and extend life",
          "More reeds = stronger throw but faster consumption",
          "Ask for transport safety reports — diffuser oil is regulated freight",
          "Private label from around 100 units with your vessel and label",
        ],
      },
      candles: {
        subcats: [
          { label: "Candles in Stock", href: "/shop/?category=Scented%20Candles" },
          { label: "Ready to Ship", href: "/shop/?category=Scented%20Candles&rts=1" },
          { label: "Bulk Value ($1–3)", href: "/shop/?category=Scented%20Candles&price=b1_3" },
          { label: "MOQ ≤ 10", href: "/shop/?category=Scented%20Candles&moq=le10" },
        ],
        guide:
          "For wholesale candles, wax type, vessel and burn performance drive both cost and reviews. Natural soy and coconut blends burn cleaner and support a premium story; tins suit travel and cost-sensitive lines.",
        points: [
          "Soy/coconut blends for premium positioning, paraffin blends for cost",
          "Request burn-test notes: burn time, melt pool, soot behaviour",
          "Tin candles ship cheaper and resist breakage (Amazon-friendly)",
          "Custom wax, vessel and scent available via OEM from higher MOQs",
        ],
      },
      "home-fragrance": {
        subcats: [
          { label: "Home Fragrance in Stock", href: "/shop/?category=Home%20Fragrance" },
          { label: "Ready to Ship", href: "/shop/?category=Home%20Fragrance&rts=1" },
          { label: "Car Fragrances", href: "/shop/?category=Car%20Fragrance" },
          { label: "Gift Sets", href: "/shop/?category=Gift%20Sets" },
        ],
        guide:
          "Home fragrance is a mix-and-match category: reed diffusers, room sprays, sachets, melts and car formats all share fragrance platforms. Building a range on one scent story cuts sampling cost and strengthens your brand shelf.",
        points: [
          "Build ranges on one fragrance across diffuser, spray and sachet",
          "Car fragrances are high-turnover add-ons for retail buyers",
          "Gift sets lift average order value — combine 2–3 formats",
          "Consolidate across formats to keep freight economical",
        ],
      },
      packaging: {
        subcats: [
          { label: "Packaging Guide", href: "/downloads/packaging-guide" },
          { label: "Custom Packaging Service", href: "/oem/custom-packaging" },
          { label: "Custom Bottles & Vessels", href: "/oem/custom-bottle" },
        ],
        guide:
          "Packaging decides shelf appeal, freight safety and unboxing experience at once. Choose vessels that survive transit, closures that seal fragrance in, and boxes that carry your brand story — then verify labelling compliance for your market.",
        points: [
          "Match vessel to channel: tins for e-commerce, glass for premium retail",
          "Ask for drop-test and transit packaging specs for fragile SKUs",
          "Custom boxes and sleeves available with your artwork",
          "EU/US compliance labelling can be prepared with your order",
        ],
      },
    },
  },

  // =========================================================================
  es: {
    ctaBand: {
      eyebrow: "Inicie su proyecto",
      title: "¿Listo para fabricar su marca de aroma?",
      text: "Comparta su brief — producto, volumen y precio objetivo — y reciba una cotización detallada con MOQ y plazo de entrega en un día hábil.",
      button: "Solicitar cotización",
      note: "Respuesta en 1 día hábil · Sin compromiso",
    },
    catalog: {
      eyebrow: "Catálogo de Productos",
      title: "Descargue nuestro catálogo más reciente",
      text: "Explore aceites esenciales, velas aromáticas y difusores de caña con especificaciones, MOQs y opciones de empaque — listos para su próxima línea de marca blanca.",
      button: "Solicitar catálogo",
    },
    trust: [
      "Fábrica directa",
      "OEM / ODM",
      "MOQ flexible",
      "Exportación mundial",
      "Respuesta rápida",
    ],
    stats: [
      { num: "10+", label: "Años de experiencia" },
      { num: "500+", label: "Proyectos OEM" },
      { num: "30+", label: "Países de exportación" },
      { num: "24h", label: "Tiempo de respuesta" },
    ],
    homeStats: {
      eyebrow: "En números",
      title: "Un socio de fabricación con el que crecer",
      subtitle:
        "Una década de experiencia en aromas, cientos de marcas enviadas y un equipo que responde rápido.",
    },
    packaging: {
      "essential-oils":
        "Frascos de vidrio (5–100 ml), latas de aluminio y tambores a granel, con impresión de marca blanca.",
      "fragrance-oils":
        "Botellas de vidrio ámbar y cobalto (10–500 ml) con goteros o tapas de disco, tambores a granel.",
      candles:
        "Vasos de vidrio, lata y cerámica con cajas e insertos personalizados, impresos con marca blanca.",
      "reed-diffusers":
        "Vasos de vidrio rellenables (50–200 ml) con cañas de ratán y cajas personalizadas.",
      "home-fragrance":
        "Botellas spray PET y vidrio, moldes de cera, carcasas de difusor para coche y cajas listas para regalo.",
      packaging:
        "Cajas rígidas, plegables, etiquetas, insertos y film retráctil — kits de empaque llave en mano.",
    },
    customization:
      "Igualación de aroma, desarrollo de fórmulas, empaque de marca blanca y documentos de cumplimiento (MSDS / IFRA / REACH).",
    factory: {
      eyebrow: "Nuestra Instalación",
      title: "Un campus de aroma integrado verticalmente",
      intro:
        "Desde la recepción de materia prima hasta productos llenados, etiquetados y paletizados, nuestro campus de 12.000 m² controla cada paso de la cadena de suministro. La mezcla, llenado y control de calidad internos significan mejor calidad, tiempos más cortos y trazabilidad total.",
      sections: [
        {
          icon: "leaf",
          title: "Resumen de fábrica",
          body: "Un campus de 12.000 m² en Yiwu, Zhejiang que combina I+D, producción y almacenamiento bajo un mismo techo. Más de 120 empleados en formulación, producción y calidad.",
        },
        {
          icon: "monitor",
          title: "Línea de producción",
          body: "Líneas automatizadas de llenado, tapado y etiquetado para aceites, velas y difusores, con capacidad escalable desde pruebas piloto de 500 unidades hasta contenedores completos.",
        },
        {
          icon: "check",
          title: "Control de calidad",
          body: "Un laboratorio de CC 24/7 realiza pruebas GC-MS, ensayos de estabilidad y muestreo por lote. Cada envío sale con reporte de inspección y evidencia foto/video.",
        },
        {
          icon: "pin",
          title: "Almacén",
          body: "Almacenamiento con clima controlado para materia prima y producto terminado, con trazabilidad por lote y rotación FIFO para stock fresco.",
        },
        {
          icon: "drop",
          title: "Empaque",
          body: "Diseño y abastecimiento de empaque interno — vidrio, aluminio y opciones PCR — con impresión de marca blanca, etiquetado de seguridad y documentación.",
        },
        {
          icon: "globe",
          title: "Proceso de exportación",
          body: "Equipo de exportación con experiencia maneja documentación, aduanas y flete global consolidado, con incoterms (EXW / FOB / CIF / DDP) según su necesidad.",
        },
      ],
      certs: [
        { name: "ISO 9001", desc: "Sistema de gestión de calidad certificado." },
        { name: "ISO 22716", desc: "GMP para fabricación cosmética." },
        { name: "MSDS", desc: "Fichas de datos de seguridad para todas las fórmulas." },
        { name: "IFRA", desc: "Cumplimiento de fragancia para uso seguro." },
        { name: "REACH", desc: "Conforme a regulación química de la UE." },
        { name: "FDA", desc: "Registro de instalación archivado." },
      ],
      timeline: [
        {
          year: "2013",
          title: "Fundada",
          text: "Aromiso fundada en Yiwu, Zhejiang por ingenieros de fragancias y veteranos de la cadena de suministro.",
        },
        {
          year: "2016",
          title: "Campus de mezcla",
          text: "Primeras líneas internas de mezcla y llenado puestas en marcha.",
        },
        {
          year: "2019",
          title: "Expansión de exportación",
          text: "Mesa de exportación dedicada; primeros contenedores a Europa y Norteamérica.",
        },
        {
          year: "2022",
          title: "Automatización",
          text: "Líneas automatizadas de llenado y etiquetado duplicaron la capacidad.",
        },
        {
          year: "2025",
          title: "12.000 m²",
          text: "Campus ampliado a 12.000 m² con nuevo laboratorio de CC.",
        },
      ],
      galleryTitle: "Dentro del campus",
      galleryBadge:
        "Las fotos solo cuentan parte de la historia. Solicite un recorrido en video en vivo y caminaremos las líneas de producción con usted, respondiendo preguntas en el momento.",
      galleryBody:
        "Un vistazo a nuestras áreas de mezcla, llenado, sala blanca y envasado: las mismas líneas donde se fabricarán sus productos.",
      galleryPrimary: "Solicitar recorrido en video en vivo",
      gallerySecondary: "Planificar visita presencial",
      capacityStats: [
        { num: "12.000", label: "m² de campus" },
        { num: "120+", label: "equipo de producción y CC" },
        { num: "24/7", label: "laboratorio de CC" },
        { num: "100%", label: "lotes inspeccionados" },
      ],
      ctaTitle: "Visite o audite nuestra instalación",
      ctaText:
        "Damos la bienvenida a dueños de marcas y equipos de compra para auditorías en sitio o por video. Solicite una visita y la organizamos.",
      ctaNote:
        "Respondemos en 1 día hábil · Auditorías presenciales y por video disponibles todo el año",
      ctaButton: "Solicitar visita a fábrica",
    },
    faq: [
      {
        q: "¿Cuál es su pedido mínimo (MOQ)?",
        a: "Nuestro MOQ estándar comienza en 500 unidades para marca blanca, con algunos formatos desde 200. El MOQ varía según la personalización.",
      },
      {
        q: "¿Cuáles son sus tiempos de entrega?",
        a: "El muestreo tarda 7–10 días hábiles. La producción suele tardar 20–30 días tras aprobación y depósito, según volumen y empaque.",
      },
      {
        q: "¿Ofrecen servicios OEM?",
        a: "Sí. Desarrollamos la fórmula, el perfil de fragancia, el empaque y la documentación desde su brief, y fabricamos bajo su marca.",
      },
      {
        q: "¿Cuál es la diferencia entre OEM y ODM?",
        a: "OEM produce según su especificación; ODM usa nuestras fórmulas y diseños existentes que usted marca. Ambos con MOQ bajos.",
      },
      {
        q: "¿Hacen marca privada?",
        a: "Por supuesto. Ofrecemos empaque, impresión y etiquetado de marca blanca para envío listo para venta.",
      },
      {
        q: "¿A qué países envían?",
        a: "Exportamos a todo el mundo — Norteamérica, Europa, Medio Oriente, Australia y Asia — por aire o mar con documentación completa.",
      },
      {
        q: "¿Cuáles son sus condiciones de pago?",
        a: "Típicamente 30% de depósito para iniciar y 70% antes del envío. Clientes establecidos pueden calificar a términos por hitos.",
      },
      {
        q: "¿Puedo pedir muestras antes de ordenar?",
        a: "Sí. Enviamos muestras físicas en 7–10 días hábiles para que evalúe aroma, calidad y empaque.",
      },
      {
        q: "¿Qué certificados proporcionan?",
        a: "Suministramos ISO 9001, ISO 22716, MSDS, IFRA, REACH y FDA según su mercado.",
      },
    ],
    categories: {
      "essential-oils": {
        icon: "drop",
        title: "Aceites Esenciales",
        intro:
          "Aceites esenciales puros, destilados por vapor y prensados en frío, abastecidos de granjas y destilerías verificadas, mezclados y envasados en nuestro campus de Yiwu.",
        applications: [
          {
            title: "Aromaterapia",
            desc: "Notas simples y mezclas propietarias para difusores y bienestar.",
          },
          {
            title: "Skincare y cosmética",
            desc: "Aceites de grado cosmético listos para vehiculizar.",
          },
          {
            title: "Cuidado del hogar",
            desc: "Bases de fragancia para velas, detergentes y ambientadores.",
          },
          {
            title: "Alimentos y bebidas",
            desc: "Aceites de sabor de grado alimentario con documentación.",
          },
        ],
        faqs: [
          {
            q: "¿Sus aceites son puros o diluidos?",
            a: "Suministramos tanto aceites puros de nota única como bases diluidas, según su aplicación y mercado.",
          },
          {
            q: "¿Pueden igualar un aroma de referencia?",
            a: "Sí — envíenos una muestra o brief y nuestros perfumistas desarrollarán un perfil similar o mejorado.",
          },
        ],
        ctaButton: "Solicitar cotización de aceites",
      },
      candles: {
        icon: "flame",
        title: "Velas Aromáticas",
        intro:
          "Velas naturales de soja y cera de abeja con perfiles de fragancia personalizados, vertidas y terminadas en envases de vidrio y lata reutilizables con marca blanca.",
        applications: [
          { title: "Fragancia hogar", desc: "Aromas firmas para espacios y regalos." },
          { title: "Hotelería", desc: "Velas amenidad de marca para hoteles y spas." },
          { title: "Sets de regalo", desc: "Sets curados con cajas e insertos personalizados." },
          {
            title: "Spa y bienestar",
            desc: "Fórmulas calmantes y de baja humareda para tratamientos.",
          },
        ],
        faqs: [
          {
            q: "¿Qué cera utilizan?",
            a: "Principalmente mezclas naturales de soja y cera de abeja, con opciones de coco y parafina bajo pedido.",
          },
          {
            q: "¿Suministran el envase de vidrio?",
            a: "Sí — abastecemos e imprimimos vidrio, aluminio y lata, o llenamos su empaque suministrado.",
          },
        ],
        ctaButton: "Solicitar cotización de velas",
      },
      "reed-diffusers": {
        icon: "wave",
        title: "Difusores de Caña",
        intro:
          "Sistemas de fragancia hogareña de larga duración con envases de vidrio rellenables, cañas de ratán premium y mezclas de aceite personalizadas — una solución sin llama.",
        applications: [
          { title: "Fragancia hogar", desc: "Aroma continuo y sin llama para cualquier ambiente." },
          { title: "Oficinas", desc: "Ambiente sutil de marca para recepción y salas." },
          { title: "Retail", desc: "Formato regalable de fácil venta." },
          { title: "Hotelería", desc: "Aromas firmas para lobbies y habitaciones." },
        ],
        faqs: [
          {
            q: "¿Cuánto duran?",
            a: "Nuestros difusores aromatizan un espacio de 3 a 6 meses según tamaño y cantidad de cañas.",
          },
          {
            q: "¿Los frascos son rellenables?",
            a: "Sí — ofrecemos bolsas de recarga y frascos de vidrio reutilizables para un modelo sostenible de recompra.",
          },
        ],
        ctaButton: "Solicitar cotización de difusores",
      },
      "fragrance-oils": {
        icon: "sparkle",
        title: "Aceites Aromáticos",
        intro:
          "Aceites aromáticos sintéticos y naturaleza-idénticos premium para velas, difusores, jabones y productos de limpieza — consistencia lote a lote, cumplimiento IFRA, cientos de perfiles olfativos.",
        applications: [
          {
            title: "Fabricación de velas",
            desc: "Aceites de alto punto de inflamación para una proyección limpia en cera de soja y parafina.",
          },
          {
            title: "Difusores de caña",
            desc: "Bases premezcladas con viscosidad óptima de absorción.",
          },
          {
            title: "Jabón y cosmética",
            desc: "Fragancias seguras para la piel con certificados IFRA.",
          },
          {
            title: "Limpieza del hogar",
            desc: "Aromas estables para detergentes, sprays y ambientadores.",
          },
        ],
        faqs: [
          {
            q: "¿Cuál es la diferencia entre aceite aromático y aceite esencial?",
            a: "Los aceites esenciales se extraen de plantas; los aromáticos se formulan en laboratorio. Ofrecen mayor variedad, menor coste y mejor consistencia para fabricación.",
          },
          {
            q: "¿Pueden replicar un aroma de diseñador?",
            a: "Sí — envíe una muestra de referencia y nuestros perfumistas desarrollarán un perfil en 7–10 días.",
          },
        ],
        ctaButton: "Solicitar cotización de aceites aromáticos",
      },
      "home-fragrance": {
        icon: "home",
        title: "Fragancias para el Hogar",
        intro:
          "Gama completa de productos terminados — sprays ambientales, brumas de lino, cera fundida, difusores para coche, incienso y piedras aromáticas — listos para marca blanca.",
        applications: [
          {
            title: "Retail y e-commerce",
            desc: "Formatos listos para estante con márgenes atractivos.",
          },
          { title: "Hotelería", desc: "Brumas de almohada, sprays de lobby y kits de amenidades." },
          { title: "Sets de regalo", desc: "Colecciones curadas con empaque premium estacional." },
          { title: "Automotriz", desc: "Difusores de clip y colgantes de larga duración." },
        ],
        faqs: [
          {
            q: "¿Qué formatos ofrecen?",
            a: "Sprays, brumas, cera fundida, difusores de coche, incienso, piedras aromáticas y recargas — todo en aromas y empaques personalizados.",
          },
          {
            q: "¿Puedo mezclar formatos en un pedido?",
            a: "Sí — aceptamos pedidos multi-SKU para construir una línea completa en una sola producción.",
          },
        ],
        ctaButton: "Solicitar cotización de fragancias",
      },
      packaging: {
        icon: "box",
        title: "Envases y Componentes",
        intro:
          "Frascos de vidrio, tarros para velas, vasos difusores, cajas de regalo, cañas, etiquetas y kits completos de empaque — fabricados e impresos a su especificación.",
        applications: [
          {
            title: "Vidrio y vasos",
            desc: "Botellas ámbar, cobalto y transparentes en stock y moldes personalizados.",
          },
          {
            title: "Cajas y sets",
            desc: "Cajas rígidas, plegables y cierre magnético con impresión a todo color.",
          },
          {
            title: "Etiquetas e impresión",
            desc: "Etiquetas autoadhesivas, serigrafía y estampado en caliente.",
          },
          { title: "Componentes", desc: "Cañas, mechas, goteros, tapas, insertos y cierres." },
        ],
        faqs: [
          {
            q: "¿Puedo pedir solo empaque, sin producto?",
            a: "Por supuesto — muchos clientes compran componentes y empaque por separado.",
          },
          {
            q: "¿Ofrecen moldes personalizados?",
            a: "Sí — para pedidos superiores a 10.000 unidades abrimos moldes de vidrio o lata a su diseño.",
          },
        ],
        ctaButton: "Solicitar cotización de empaque",
      },
    },
    solutions: {
      eyebrow: "Soluciones por Industria",
      title: "Soluciones por Industria",
      subtitle:
        "Sea cual sea su canal — hostelería, retail, e-commerce o distribución — tenemos la gama, el empaque y la experiencia en cumplimiento para llenar sus estantes.",
      items: {
        hotels: {
          icon: "home",
          title: "Hoteles y Hostelería",
          desc: "Aromas firma y amenidades de marca que convierten habitaciones en experiencias.",
          hero: "Desde difusores de lobby hasta velas y brumas de almohada, ayudamos a los hoteles a crear una identidad olfativa que los huéspedes recuerdan.",
          challenges: [
            {
              title: "Consistencia de marca",
              desc: "Cada propiedad necesita el mismo perfil olfativo, lote tras lote.",
            },
            {
              title: "Volúmenes por habitación",
              desc: "Los hoteles necesitan cientos de SKUs con cantidades bajas por unidad.",
            },
            {
              title: "Cumplimiento y seguridad",
              desc: "Normativa de incendios, etiquetado de alérgenos y MSDS para cada producto.",
            },
          ],
          products: [
            { title: "Difusores de Lobby", desc: "Difusores de gran formato con su aroma firma." },
            {
              title: "Velas de Habitación",
              desc: "Velas de soja con logo del hotel y mecha de seguridad.",
            },
            {
              title: "Brumas y Amenidades",
              desc: "Sprays de almohada, brumas de lino y mini difusores.",
            },
          ],
          benefits: [
            "Desarrollo de aroma firma en 14 días",
            "MOQ desde 200 unidades por SKU",
            "Documentación MSDS, IFRA y seguridad contra incendios",
            "Igualación de fragancia consistente entre lotes",
            "Kit de muestras gratuito para equipos de compras",
            "Envío consolidado a múltiples propiedades",
          ],
          faqs: [
            {
              q: "¿Pueden desarrollar un aroma de hotel?",
              a: "Sí — nuestros perfumistas crean una fragancia bespoke desde su brief en 14 días.",
            },
            {
              q: "¿Cuál es el MOQ para amenidades?",
              a: "Desde 200 unidades por SKU para proyectos hoteleros, con pedidos multi-SKU.",
            },
          ],
          cta: "¿Listo para crear el aroma firma de su hotel? Comparta su brief de marca.",
        },
        "spa-wellness": {
          icon: "leaf",
          title: "Spa y Bienestar",
          desc: "Productos de grado terapéutico para salas de tratamiento y retail.",
          hero: "Los huéspedes de spa esperan pureza y calma. Suministramos aceites esenciales, mezclas de masaje y velas de aromaterapia de grado terapéutico.",
          challenges: [
            {
              title: "Pureza terapéutica",
              desc: "Los formuladores necesitan aceites verificados por GC-MS con datos de quimiotipo.",
            },
            {
              title: "Consistencia de tratamiento",
              desc: "Los terapeutas dependen de aroma y viscosidad idénticos en cada sesión.",
            },
            {
              title: "Venta retail",
              desc: "Los spas quieren productos de marca para que los huéspedes compren.",
            },
          ],
          products: [
            {
              title: "Sets de Aceites Esenciales",
              desc: "Sets curados de grado terapéutico para tratamiento y retail.",
            },
            {
              title: "Aceites de Masaje",
              desc: "Fórmulas portador + esencial premezcladas, marca blanca.",
            },
            {
              title: "Velas de Aromaterapia",
              desc: "Velas de soja con mezclas calmantes para ambiente de tratamiento.",
            },
          ],
          benefits: [
            "Informes GC-MS por lote",
            "Aceites 100% puros sin diluir",
            "Mezclas personalizadas según sus protocolos",
            "Productos retail marca blanca desde 300 unidades",
            "Documentación IFRA y seguridad cosmética incluida",
            "Kits de muestra para evaluación de terapeutas",
          ],
          faqs: [
            {
              q: "¿Sus aceites son de grado terapéutico?",
              a: "Suministramos aceites 100% puros con verificación GC-MS. Proporcionamos los datos analíticos para que sus formuladores verifiquen la calidad.",
            },
            {
              q: "¿Pueden formular mezclas de masaje?",
              a: "Sí — comparta su protocolo y desarrollamos una mezcla con pruebas de estabilidad.",
            },
          ],
          cta: "Cuéntenos sobre su menú de tratamientos y recomendaremos la gama adecuada.",
        },
        retail: {
          icon: "monitor",
          title: "Retail y E-commerce",
          desc: "Productos listos para estante con márgenes fuertes para tiendas online y físicas.",
          hero: "Ya sea una boutique, una cadena o una marca DTC, entregamos productos listos para vender con empaque, códigos de barras y documentación de cumplimiento.",
          challenges: [
            {
              title: "Presión de márgenes",
              desc: "Los retailers necesitan precios de fábrica para mantener márgenes del 60%+.",
            },
            {
              title: "Reabastecimiento rápido",
              desc: "Los best-sellers se agotan; necesita un proveedor que reabastezca en 2–3 semanas.",
            },
            {
              title: "Cumplimiento por mercado",
              desc: "Etiquetas CLP para UE, FDA para EE.UU. — un proveedor que gestione todo.",
            },
          ],
          products: [
            {
              title: "Velas Marca Blanca",
              desc: "Su marca, su aroma, su envase — desde 500 unidades.",
            },
            {
              title: "Gama de Difusores",
              desc: "Múltiples tamaños y aromas para una colección completa.",
            },
            { title: "Sets de Regalo", desc: "Sets curados con cajas premium — alto AOV para Q4." },
          ],
          benefits: [
            "Precio directo de fábrica",
            "MOQ desde 500 unidades por SKU",
            "Empaque completo: caja, etiqueta, código de barras",
            "Documentación CLP / FDA / REACH por mercado",
            "Producción 20–25 días, muestras 7 días",
            "Consolidación multi-SKU en un contenedor",
          ],
          faqs: [
            {
              q: "¿Gestionan el etiquetado CLP de la UE?",
              a: "Sí — producimos etiquetas CLP conformes con alérgenos, pictogramas y códigos UFI.",
            },
            {
              q: "¿Cuál es su plazo de reabastecimiento?",
              a: "Reorders estándar en 15–20 días. También mantenemos stock de seguridad.",
            },
          ],
          cta: "Comparta su brief de producto y precio objetivo — cotizamos en un día hábil.",
        },
        "amazon-sellers": {
          icon: "globe",
          title: "Vendedores de Amazon",
          desc: "Productos listos para FBA con empaque optimizado y cumplimiento Amazon.",
          hero: "Las reglas de Amazon son estrictas: etiquetas FNSKU, advertencias de poly-bag, revisión hazmat. Hemos enviado miles de unidades FBA-ready y gestionamos el cumplimiento.",
          challenges: [
            {
              title: "Cumplimiento FBA",
              desc: "Amazon rechaza envíos sin FNSKU, advertencias o documentos hazmat.",
            },
            {
              title: "Velocidad de reseñas",
              desc: "Necesita calidad consistente para que cada unidad coincida con las fotos.",
            },
            {
              title: "Flujo de caja",
              desc: "Amazon retiene pagos; necesita MOQ bajo y rotación rápida.",
            },
          ],
          products: [
            {
              title: "Velas FBA-Ready",
              desc: "Con FNSKU, poly-bag, advertencia y hoja hazmat incluida.",
            },
            {
              title: "Sets de Aceites",
              desc: "Multi-packs optimizados para contenido A+ y posicionamiento regalo.",
            },
            {
              title: "Bundles de Wax Melts",
              desc: "Packs clamshell de alto margen con empaque FBA.",
            },
          ],
          benefits: [
            "Empaque FBA-ready (FNSKU, poly-bag, advertencias)",
            "Documentación hazmat para velas y aceites",
            "Soporte de fotografía y contenido A+",
            "MOQ desde 500 unidades",
            "Producción 20 días hasta almacén FBA",
            "Calidad consistente para protección de reseñas",
          ],
          faqs: [
            {
              q: "¿Proporcionan documentación hazmat?",
              a: "Sí — SDS, informes de punto de inflamación y certificados de transporte UN.",
            },
            {
              q: "¿Envían directo a almacenes FBA?",
              a: "Sí — etiquetamos, embolsamos y enviamos a su almacén FBA designado.",
            },
          ],
          cta: "Cuéntenos su estrategia de ASIN y construiremos un plan de producto conforme.",
        },
        supermarkets: {
          icon: "box",
          title: "Supermercados y Cadenas",
          desc: "Producción en volumen con empaque retail y suministro consistente.",
          hero: "Los compradores de supermercado necesitan volumen, consistencia y cumplimiento. Suministramos gamas de marca blanca a volumen de contenedor.",
          challenges: [
            {
              title: "Volumen y consistencia",
              desc: "Las cadenas necesitan 10.000+ unidades idénticas por PO.",
            },
            {
              title: "Cumplimiento retail",
              desc: "Códigos EAN, pedidos EDI, dimensiones específicas de empaque.",
            },
            {
              title: "Ingeniería de costes",
              desc: "Los márgenes de supermercado exigen costes unitarios agresivos.",
            },
          ],
          products: [
            {
              title: "Gama de Velas Marca Blanca",
              desc: "Líneas completas (3–8 SKUs) con bandejas shelf-ready y EAN.",
            },
            {
              title: "Colección de Difusores",
              desc: "Gama escalonada (bueno/mejor/premium) con diseño unificado.",
            },
            {
              title: "Colecciones Estacionales",
              desc: "Navidad, verano y primavera planificadas con 6 meses de antelación.",
            },
          ],
          benefits: [
            "Producción a volumen de contenedor (10.000+)",
            "Empaque shelf-ready con EAN/UPC",
            "Pedidos EDI y portal soportados",
            "Gestor de cuenta dedicado para cadenas",
            "Planificación a 6 meses para gamas estacionales",
            "Cumplimiento completo: CLP, REACH, FDA",
          ],
          faqs: [
            {
              q: "¿Pueden cumplir volúmenes de supermercado?",
              a: "Sí — nuestras líneas producen 50.000+ unidades/mes con QC dedicado.",
            },
            {
              q: "¿Soportan pedidos EDI?",
              a: "Nos integramos con las principales plataformas EDI y portales de compradores.",
            },
          ],
          cta: "Comparta su plan de gama y previsión de volumen — propuesta en 3 días.",
        },
        "brand-owners": {
          icon: "sparkle",
          title: "Propietarios de Marca",
          desc: "Del concepto al estante: desarrollo de fórmula, empaque y fabricación bajo su marca.",
          hero: "Usted tiene la visión de marca; nosotros la fábrica. Desde el desarrollo del aroma hasta la ingeniería del empaque y el cumplimiento, construimos su línea desde cero.",
          challenges: [
            {
              title: "Desarrollo de producto",
              desc: "Convertir un concepto en un producto fabricable y costado.",
            },
            {
              title: "Diferenciación de empaque",
              desc: "Destacar en estante o unboxing requiere envases y acabados custom.",
            },
            {
              title: "Escalar producción",
              desc: "Pasar de 500 unidades de lanzamiento a 10.000 sin caídas de calidad.",
            },
          ],
          products: [
            {
              title: "Desarrollo Completo",
              desc: "Aroma → fórmula → envase → empaque → cumplimiento, gestionado end-to-end.",
            },
            {
              title: "Moldes y Envases Custom",
              desc: "Vidrio, cerámica o lata exclusivos de su marca.",
            },
            {
              title: "Construcción de Gama Multi-SKU",
              desc: "Gama de 5–20 SKUs en velas, difusores y sprays.",
            },
          ],
          benefits: [
            "Desarrollo end-to-end (brief a contenedor)",
            "Moldes exclusivos desde 10.000 unidades",
            "Diseño y prototipado de empaque in-house",
            "Protección IP: su fórmula, su molde, NDA",
            "Escalable de 500 a contenedor completo",
            "Gestor de proyecto dedicado",
          ],
          faqs: [
            {
              q: "¿Pueden desarrollar desde un brief?",
              a: "Sí — comparta posicionamiento, precio objetivo y estética. Gestionamos todo.",
            },
            {
              q: "¿Quién posee la fórmula y el molde?",
              a: "Usted. Fórmulas y moldes custom son su IP, cubiertos por NDA.",
            },
          ],
          cta: "Comparta su brief de marca — propondremos una gama con costes en 5 días.",
        },
        wholesalers: {
          icon: "download",
          title: "Mayoristas",
          desc: "Precio de fábrica en pedidos de volumen con división flexible de MOQ.",
          hero: "Los mayoristas necesitan margen, amplitud y fiabilidad. Ofrecemos precio de fábrica en 80+ SKUs con pedidos mixtos por contenedor.",
          challenges: [
            {
              title: "Protección de margen",
              desc: "Los márgenes mayoristas son ajustados; necesita el coste unitario más bajo.",
            },
            {
              title: "Amplitud de gama",
              desc: "Sus clientes quieren variedad — velas, difusores, aceites — de un solo proveedor.",
            },
            {
              title: "Suministro fiable",
              desc: "Las roturas de stock matan relaciones mayoristas.",
            },
          ],
          products: [
            {
              title: "Pedidos Mixtos por Contenedor",
              desc: "Combine velas, difusores, aceites y sprays en un contenedor.",
            },
            { title: "Gama Marca Blanca", desc: "Nuestras fórmulas probadas bajo su marca." },
            {
              title: "Programa de Stock",
              desc: "Mantenemos stock de seguridad de sus top sellers.",
            },
          ],
          benefits: [
            "Precio directo de fábrica",
            "80+ SKUs en 6 categorías",
            "Consolidación mixta por contenedor",
            "Reabastecimiento en 2 semanas",
            "Pago flexible: 30/70 o LC a la vista",
            "Gestor de cuenta mayorista dedicado",
          ],
          faqs: [
            {
              q: "¿Cuál es su estructura de precios mayorista?",
              a: "Tramos a 1.000 / 5.000 / 10.000 / contenedor completo. Solicite nuestra lista.",
            },
            {
              q: "¿Puedo mezclar productos?",
              a: "Sí — mínimo 500 unidades por SKU, sin límite de SKUs.",
            },
          ],
          cta: "Solicite nuestro catálogo y lista de precios mayorista — respondemos en un día.",
        },
        distributors: {
          icon: "globe",
          title: "Distribuidores",
          desc: "Alianzas exclusivas por territorio con soporte de marketing y stock dedicado.",
          hero: "Los distribuidores necesitan exclusividad, soporte de marketing y suministro fiable. Ofrecemos alianzas con exclusividad territorial y materiales co-branding.",
          challenges: [
            {
              title: "Protección territorial",
              desc: "Los distribuidores invierten en desarrollo de mercado; necesitan exclusividad.",
            },
            {
              title: "Soporte de marketing",
              desc: "Catálogos en idioma local, formación y activos digitales co-branding.",
            },
            {
              title: "Disponibilidad de stock",
              desc: "Los distribuidores no pueden esperar 30 días por cada pedido.",
            },
          ],
          products: [
            {
              title: "Acceso a Catálogo Completo",
              desc: "80+ SKUs con materiales de marketing en su idioma.",
            },
            {
              title: "Empaque Co-Branding",
              desc: "Productos con su marca de distribución junto a Aromiso.",
            },
            {
              title: "Programa de Stock",
              desc: "Inventario pre-posicionado para despacho en 2 semanas.",
            },
          ],
          benefits: [
            "Acuerdos de exclusividad territorial",
            "Catálogos y activos digitales co-branding",
            "Formación de producto para su equipo",
            "Stock pre-posicionado para despacho rápido",
            "Programa de rebates anuales por volumen",
            "Soporte de participación en ferias",
          ],
          faqs: [
            {
              q: "¿Ofrecen territorios exclusivos?",
              a: "Sí — firmamos acuerdos de exclusividad con compromisos mínimos anuales.",
            },
            {
              q: "¿Qué soporte de marketing proporcionan?",
              a: "Catálogos locales, fotografía, vídeo, decks de formación y activos digitales.",
            },
          ],
          cta: "Indíquenos su territorio y categorías objetivo — propondremos un marco de alianza.",
        },
      },
    },
    oemServices: {
      eyebrow: "Servicios OEM / ODM",
      title: "Fabricación de Marca Blanca y OEM",
      subtitle:
        "Desde el desarrollo de fórmulas hasta el producto terminado — fabricamos bajo su marca con personalización total.",
      items: {
        "private-label-essential-oil": {
          icon: "drop",
          title: "Aceite Esencial de Marca Blanca",
          desc: "Su marca, nuestros aceites esenciales puros — mezclas, frascos, etiquetas y empaque personalizados desde 500 unidades.",
          hero: "Lance su propia línea de aceites esenciales sin poseer una destilería. Suministramos aceites 100% puros verificados por GC-MS con su marca — desde aceites individuales hasta sets curados — con documentación completa para cualquier mercado.",
          process: [
            {
              title: "Brief y Selección",
              desc: "Elija entre 30+ aceites en stock o solicite mezclas personalizadas. Comparta su mercado objetivo.",
            },
            {
              title: "Muestra y Aprobación",
              desc: "Reciba muestras de 5–10 ml en 7 días. Itere hasta aprobar.",
            },
            {
              title: "Producción y Envasado",
              desc: "Destilación/aprovisionamiento, pruebas de calidad, llenado de precisión en su envase elegido.",
            },
            {
              title: "Etiquetado y Envío",
              desc: "Aplique sus etiquetas, empaque en cajas retail y envíe a su almacén o FBA.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 unidades por SKU" },
            { label: "Pureza", value: "100% puro, verificado GC-MS" },
            { label: "Frascos", value: "5 ml – 100 ml vidrio ámbar/cobalto" },
            { label: "Plazo", value: "20–25 días tras aprobación" },
            { label: "Certificaciones", value: "ISO 22716, IFRA, MSDS por SKU" },
            { label: "Mezcla Personalizada", value: "Sí — desde su brief o referencia" },
          ],
          faqs: [
            {
              q: "¿Puedo crear una mezcla personalizada?",
              a: "Sí — comparta el efecto deseado o un aceite de referencia. Nuestros formuladores desarrollan la mezcla en 7 días.",
            },
            {
              q: "¿Proporcionan informes GC-MS?",
              a: "Cada lote incluye cromatograma GC-MS, declaración de alérgenos y certificado IFRA.",
            },
          ],
          cta: "¿Listo para lanzar su marca de aceites? Comparta su brief para una muestra gratuita.",
        },
        "private-label-candle": {
          icon: "flame",
          title: "Vela de Marca Blanca",
          desc: "Velas de soja personalizadas con su marca, aroma y envase — desde 500 unidades con empaque completo.",
          hero: "Construya una línea de velas única. Manejamos formulación de cera, carga de fragancia, envases, pruebas de seguridad y empaque — usted se enfoca en marca y ventas.",
          process: [
            {
              title: "Concepto y Aroma",
              desc: "Defina su línea: tipo de cera, perfil aromático, envase y precio objetivo.",
            },
            { title: "Muestras", desc: "Reciba 2–3 muestras vertidas a mano en 10 días." },
            {
              title: "Producción",
              desc: "Vertido por lotes, curado, prueba de mecha e inspección de calidad.",
            },
            {
              title: "Empaque y Envío",
              desc: "Cajas, etiquetas, códigos de barras y embalaje según su especificación.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 unidades por SKU" },
            { label: "Ceras", value: "Soja, coco-soja, cera de abeja, parafina" },
            { label: "Envases", value: "Frasco vidrio, lata, cerámica, hormigón — moldes custom" },
            { label: "Carga Aromática", value: "6–12% (conforme IFRA)" },
            { label: "Duración", value: "25–80 hrs según tamaño" },
            { label: "Plazo", value: "25–30 días tras aprobación" },
          ],
          faqs: [
            {
              q: "¿Pueden replicar el aroma de una vela de diseñador?",
              a: "Sí — envíe una vela de referencia y replicamos el aroma en frío y caliente en 10 días.",
            },
            {
              q: "¿Manejan pruebas de seguridad contra incendios?",
              a: "Realizamos pruebas de combustión y proporcionamos SDS conforme ASTM F2417 (US) o EN 15493 (EU).",
            },
          ],
          cta: "Cuéntenos su visión de vela — aroma, envase, cantidad — y cotizamos en un día.",
        },
        "private-label-diffuser": {
          icon: "wave",
          title: "Difusor de Varillas de Marca Blanca",
          desc: "Difusores personalizados con su marca — botella, varillas, fragancia y caja desde 500 unidades.",
          hero: "Los difusores de varillas son la entrada más fácil al home fragrance: sin llama, sin electricidad, aroma duradero. Fabricamos sets completos bajo su marca.",
          process: [
            {
              title: "Brief de Diseño",
              desc: "Elija forma de botella, tipo de varilla, fragancia y estilo de caja.",
            },
            {
              title: "Muestra de Aroma",
              desc: "Desarrollamos su mezcla y enviamos difusores de prueba de 50 ml.",
            },
            {
              title: "Producción",
              desc: "Llenado de precisión, inserción de varillas, sellado y control de calidad.",
            },
            {
              title: "Empaque y Entrega",
              desc: "Cajas retail con su diseño, codificadas y paletizadas.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 unidades por SKU" },
            { label: "Tamaños", value: "50 ml – 500 ml" },
            { label: "Botellas", value: "Vidrio (claro/esmerilado/color), cerámica, molde custom" },
            { label: "Varillas", value: "Ratán, fibra (negro/blanco/natural)" },
            { label: "Duración Aroma", value: "6–12 semanas según tamaño" },
            { label: "Plazo", value: "20–25 días" },
          ],
          faqs: [
            {
              q: "¿Puedo usar mi propio diseño de botella?",
              a: "Sí — envíe su archivo 3D o referencia. Fabricamos el molde desde 3,000 unidades.",
            },
            {
              q: "¿Qué opciones de fragancia hay?",
              a: "Elija entre 50+ aromas en stock o desarrollamos una fragancia exclusiva desde su brief.",
            },
          ],
          cta: "Comparta su concepto de difusor y enviaremos muestras en 7 días.",
        },
        "oem-candle": {
          icon: "flame",
          title: "Fabricación OEM de Velas",
          desc: "Producción de velas a escala — su fórmula o la nuestra, con QC completo y cumplimiento normativo.",
          hero: "Para marcas que necesitan capacidad de fabricación sin la fábrica. Producimos velas según su especificación exacta — o desarrollamos la fórmula — en volúmenes de 2,000 a 50,000+ unidades/mes.",
          process: [
            {
              title: "Revisión de Spec",
              desc: "Comparta su tech pack. Confirmamos viabilidad, coste y plazo.",
            },
            { title: "Lote Piloto", desc: "Ejecutamos 100 unidades piloto para su aprobación." },
            {
              title: "Producción en Masa",
              desc: "Líneas dedicadas con QC en línea en cada etapa.",
            },
            {
              title: "QC y Logística",
              desc: "Inspección AQL, embalaje y carga de contenedor con documentación fotográfica.",
            },
          ],
          specs: [
            { label: "Capacidad", value: "50,000+ unidades/mes" },
            { label: "MOQ", value: "2,000 unidades por PO" },
            { label: "Ceras", value: "Soja, parafina, coco, abeja, mezclas" },
            { label: "Calidad", value: "ISO 9001, inspección AQL 2.5" },
            { label: "Normativa", value: "ASTM F2417, EN 15493, CLP, REACH" },
            { label: "Plazo", value: "25–35 días según volumen" },
          ],
          faqs: [
            {
              q: "¿Pueden producir con nuestra fórmula existente?",
              a: "Sí — comparta su tech pack y la replicamos exactamente. También optimizamos fórmulas.",
            },
            {
              q: "¿Cuál es su tasa de defectos?",
              a: "Mantenemos <1.5% con inspección visual 100% y muestreo AQL 2.5 en cada lote.",
            },
          ],
          cta: "Envíe su spec de vela — confirmamos viabilidad y precio en 2 días.",
        },
        "oem-essential-oil": {
          icon: "drop",
          title: "Suministro OEM de Aceites Esenciales",
          desc: "Aceites esenciales a granel con etiquetado privado, mezclas personalizadas y trazabilidad completa.",
          hero: "Abastezca aceites esenciales a precio de fábrica con documentación completa. Suministramos aceites a granel y envasados para cosmética, aromaterapia, alimentación e industria.",
          process: [
            {
              title: "Revisión de Requisitos",
              desc: "Especifique tipo, grado, volumen y aplicación. Confirmamos sourcing y precio.",
            },
            {
              title: "Muestra y Análisis",
              desc: "Reciba muestras con datos GC-MS. Verifique quimiotipo y calidad.",
            },
            {
              title: "Producción",
              desc: "Aprovisionamiento de granjas verificadas, destilación, pruebas de lote.",
            },
            {
              title: "Envasado y Docs",
              desc: "Llenado (granel o retail), etiquetas, CoA/MSDS/IFRA incluidos.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 uds (retail) / 25 kg (granel)" },
            { label: "Grado", value: "Terapéutico, cosmético, alimentario, industrial" },
            { label: "Variedades", value: "30+ (lavanda, árbol de té, eucalipto, etc.)" },
            { label: "Documentación", value: "GC-MS, CoA, MSDS, IFRA, alérgenos" },
            { label: "Envasado", value: "Bidones, vidrio ámbar, cajas retail" },
            { label: "Plazo", value: "15–25 días" },
          ],
          faqs: [
            {
              q: "¿Suministran aceites con certificación orgánica?",
              a: "Sí — aceites certificados USDA/EU organic de granjas verificadas con cadena de custodia.",
            },
            {
              q: "¿Ofrecen mezclas personalizadas?",
              a: "Sí — nuestros formuladores crean mezclas para aromaterapia, cosmética o uso doméstico.",
            },
          ],
          cta: "Díganos qué aceites necesita, en qué grado y volumen — cotizamos en un día hábil.",
        },
        "custom-packaging": {
          icon: "box",
          title: "Diseño de Empaque Personalizado",
          desc: "Cajas, etiquetas, inserts y empaque de envases a medida para su marca y mercado.",
          hero: "El empaque vende. Nuestro equipo de diseño crea empaque retail que protege su producto, cumple normativas y hace que su marca destaque en estante o en vídeos de unboxing.",
          process: [
            {
              title: "Brief de Diseño",
              desc: "Comparta guías de marca, mercado objetivo y requisitos de empaque.",
            },
            { title: "Mockup 3D", desc: "Reciba 2–3 conceptos con renders 3D en 5 días." },
            {
              title: "Prototipo",
              desc: "Prototipo físico con materiales, acabados e impresión elegidos.",
            },
            {
              title: "Producción",
              desc: "Impresión, corte, plegado y ensamblaje a escala — integrado con su pedido.",
            },
          ],
          specs: [
            { label: "MOQ", value: "1,000 uds (integrado con pedido)" },
            { label: "Tipos de Caja", value: "Rígida, plegable, magnética, faja, tubo" },
            { label: "Acabados", value: "Laminado mate/brillo, foil, relieve, UV localizado" },
            { label: "Normativa", value: "Etiquetas CLP, FDA, código de barras, reciclaje" },
            { label: "Diseño", value: "Gratis en pedidos +3,000 uds" },
            { label: "Plazo", value: "15–20 días (solo empaque)" },
          ],
          faqs: [
            {
              q: "¿Diseñan el empaque o proporciono el arte?",
              a: "Ambos. Proporcione archivos listos para impresión, o nuestro equipo crea todo desde su brief — gratis para +3,000 uds.",
            },
            {
              q: "¿Manejan etiquetado CLP europeo?",
              a: "Sí — producimos etiquetas conformes con pictogramas, alérgenos, códigos UFI y texto regulatorio.",
            },
          ],
          cta: "Comparta su brief de empaque — propondremos 2–3 conceptos en 5 días.",
        },
        "custom-fragrance": {
          icon: "sparkle",
          title: "Desarrollo de Fragancia Personalizada",
          desc: "Creación de aromas exclusivos por nuestros perfumistas — del brief a la fórmula lista en 14 días.",
          hero: "Su aroma firma es la identidad invisible de su marca. Nuestros perfumistas desarrollan perfiles aromáticos únicos desde su brief, moodboard o muestra de referencia — exclusivos para su marca.",
          process: [
            {
              title: "Brief Aromático",
              desc: "Describa su visión: mood, notas, referencias, producto y precio objetivo.",
            },
            {
              title: "Desarrollo",
              desc: "Nuestros perfumistas crean 3–5 acordes iniciales en 10 días.",
            },
            {
              title: "Refinamiento",
              desc: "Itere sobre su dirección elegida — ajuste notas altas/media/fondo.",
            },
            {
              title: "Fórmula de Producción",
              desc: "Finalice fórmula conforme IFRA, pruebas de estabilidad y escalado.",
            },
          ],
          specs: [
            { label: "Tiempo", value: "14 días (brief a fórmula aprobada)" },
            { label: "Conceptos", value: "3–5 direcciones aromáticas" },
            { label: "Normativa", value: "IFRA 51ª Enmienda, alérgenos EU, CLP" },
            { label: "Aplicaciones", value: "Velas, difusores, sprays, cosmética, textiles" },
            { label: "Exclusividad", value: "Su fórmula nunca se revende (NDA)" },
            { label: "Coste", value: "Desarrollo gratis en pedidos +2,000 uds" },
          ],
          faqs: [
            {
              q: "¿Pueden replicar una fragancia de diseñador?",
              a: "Sí — envíe una muestra y desarrollamos una aproximación (no idéntica, respetando IP) en 10 días.",
            },
            {
              q: "¿Quién posee la fórmula personalizada?",
              a: "Usted. Las fórmulas personalizadas son su propiedad intelectual, cubiertas por NDA mutuo.",
            },
          ],
          cta: "Describa su aroma soñado — nuestros perfumistas desarrollarán muestras en 10 días.",
        },
        "custom-bottle": {
          icon: "drop",
          title: "Botella y Envase Personalizado",
          desc: "Envases de vidrio, cerámica y metal a medida — moldes, acabados y capacidades exclusivas para su marca.",
          hero: "El envase ES el producto para muchos compradores. Fabricamos botellas, frascos, latas y envases cerámicos únicos que hacen su producto instantáneamente reconocible.",
          process: [
            {
              title: "Brief de Diseño",
              desc: "Comparta bocetos, referencias o archivos 3D. Defina material, capacidad y acabado.",
            },
            {
              title: "Render 3D",
              desc: "Reciba renders fotorrealistas y planos de dimensiones en 5 días.",
            },
            {
              title: "Molde y Muestra",
              desc: "Corte de molde, 5–10 muestras físicas para aprobación (15–20 días).",
            },
            {
              title: "Producción",
              desc: "Producción a escala con su acabado elegido — integrada con su pedido de llenado.",
            },
          ],
          specs: [
            { label: "MOQ", value: "3,000 uds (molde custom) / 500 (formas stock)" },
            { label: "Materiales", value: "Vidrio, cerámica, lata, hormigón, tapa madera" },
            { label: "Acabados", value: "Esmerilado, color, galvanizado, decal, serigrafía" },
            { label: "Coste Molde", value: "USD 500–2,000 (reembolsable en pedidos repetidos)" },
            { label: "Capacidad", value: "5 ml – 500 ml" },
            { label: "Plazo", value: "30–40 días (incl. molde)" },
          ],
          faqs: [
            {
              q: "¿Puedo ver una muestra física antes de comprometerme?",
              a: "Sí — producimos 5–10 muestras tras el corte de molde. Usted aprueba antes de la producción.",
            },
            {
              q: "¿El coste del molde es reembolsable?",
              a: "Sí — se reembolsa cuando los pedidos acumulados superan 10,000 unidades.",
            },
          ],
          cta: "Comparta su concepto de envase — lo renderizamos en 3D en 5 días, sin coste.",
        },
      },
    },
    factoryPages: {
      eyebrow: "Dentro de Nuestra Fábrica",
      title: "Capacidades de Fábrica",
      subtitle:
        "Explore nuestras instalaciones en detalle — desde control de calidad hasta capacidad de producción.",
      items: {
        "quality-control": {
          icon: "check",
          title: "Control de Calidad",
          desc: "Sistema de CC multi-etapa que garantiza que cada unidad cumpla estándares internacionales antes del envío.",
          hero: "La calidad no es un departamento — está integrada en cada paso. Desde la inspección de materia prima hasta el muestreo AQL final, nuestro equipo de 12 personas garantiza entrega sin defectos.",
          highlights: [
            {
              title: "Inspección de Materia Prima",
              desc: "Cada lote se prueba en pureza, humedad y cumplimiento antes de entrar a producción.",
            },
            {
              title: "CC en Línea",
              desc: "Operarios realizan verificaciones visuales y dimensionales en cada estación.",
            },
            {
              title: "Inspección Final AQL 2.5",
              desc: "Muestreo aleatorio según ISO 2859 antes del embalaje. Informes con foto y vídeo.",
            },
            {
              title: "Verificación de Laboratorio",
              desc: "Pruebas de punto de inflamación, carga aromática y tiempo de combustión en cada lote.",
            },
            {
              title: "Sistema de Trazabilidad",
              desc: "Códigos de lote vinculan cada unidad a su materia prima, fecha e inspector.",
            },
            {
              title: "Auditorías Externas",
              desc: "Aceptamos inspectores de SGS, Bureau Veritas o designados por el cliente.",
            },
          ],
          stats: [
            { num: "12", label: "Especialistas CC" },
            { num: "<1.5%", label: "Tasa de Defectos" },
            { num: "100%", label: "Trazabilidad" },
            { num: "AQL 2.5", label: "Estándar" },
          ],
          faqs: [
            {
              q: "¿Puedo enviar mi propio inspector?",
              a: "Por supuesto — coordinamos la programación y proporcionamos acceso completo en cualquier etapa.",
            },
            {
              q: "¿Qué pasa si se encuentran defectos?",
              a: "Cualquier lote que falle AQL se cuarentena, reprocesa o reemplaza a nuestro coste antes del envío.",
            },
          ],
          cta: "Solicite nuestro protocolo completo de CC — lo enviamos en un día hábil.",
        },
        laboratory: {
          icon: "drop",
          title: "Laboratorio e I+D",
          desc: "Laboratorio interno para desarrollo de fragancias, pruebas de estabilidad y verificación analítica.",
          hero: "Nuestro laboratorio de 200 m² alberga equipos GC-MS, cámaras de estabilidad y un banco de perfumería donde nacen nuevos aromas. Cada fórmula se somete a pruebas de estrés antes de producción.",
          highlights: [
            {
              title: "Análisis GC-MS",
              desc: "Cromatografía de gases verifica pureza, detecta adulteración y confirma quimiotipo.",
            },
            {
              title: "Desarrollo de Fragancias",
              desc: "3 perfumistas senior desarrollan 20+ aromas nuevos mensualmente.",
            },
            {
              title: "Pruebas de Estabilidad",
              desc: "Envejecimiento acelerado (40°C/75%HR durante 90 días) asegura rendimiento durante la vida útil.",
            },
            {
              title: "Punto de Inflamación",
              desc: "Cada fórmula de vela y aceite se prueba para seguridad en transporte y uso.",
            },
            {
              title: "Pruebas de Compatibilidad",
              desc: "Tests de interacción fragancia-envase previenen decoloración o absorción.",
            },
            {
              title: "Cumplimiento Normativo",
              desc: "Verificaciones IFRA, REACH, CLP y FDA integradas en cada ciclo de desarrollo.",
            },
          ],
          stats: [
            { num: "200 m²", label: "Espacio Lab" },
            { num: "3", label: "Perfumistas Senior" },
            { num: "GC-MS", label: "Equipamiento" },
            { num: "20+", label: "Aromas Nuevos/Mes" },
          ],
          faqs: [
            {
              q: "¿Pueden desarrollar una fórmula personalizada?",
              a: "Sí — comparta su brief y creamos 3–5 opciones en 10 días, gratis para pedidos +2,000 uds.",
            },
            {
              q: "¿Proporcionan informes de estabilidad?",
              a: "Sí — cada fórmula incluye datos de estabilidad acelerada y vida útil recomendada.",
            },
          ],
          cta: "Cuéntenos su desafío de formulación — nuestro laboratorio propondrá una solución.",
        },
        "raw-material": {
          icon: "leaf",
          title: "Abastecimiento de Materia Prima",
          desc: "Granjas, destilerías y proveedores verificados con documentación completa de cadena de custodia.",
          hero: "Los grandes productos empiezan con grandes materias primas. Abastecemos aceites de granjas verificadas en 6 países, cera de refinerías certificadas y envases de vidrieras auditadas.",
          highlights: [
            {
              title: "Red de Granjas Verificadas",
              desc: "Lavanda de Provenza, árbol de té de Australia, eucalipto de Yunnan — relaciones directas desde 2013.",
            },
            {
              title: "Certificación de Cera",
              desc: "Soja de fuentes no-OGM certificadas; parafina de proveedores refinados grado alimentario.",
            },
            {
              title: "Auditorías de Vidrio",
              desc: "Cada vidriería se audita por plomo/cadmio, resistencia térmica y precisión dimensional.",
            },
            {
              title: "Socios de Fragancia",
              desc: "Trabajamos con proveedores grado Givaudan, Firmenich e IFF para aceites consistentes.",
            },
            {
              title: "CC de Recepción",
              desc: "Cada envío se inspecciona: verificación visual, peso y muestreo de laboratorio.",
            },
            {
              title: "Cadena de Custodia",
              desc: "Documentación completa de granja a producto terminado — certificados orgánicos, CoA, transporte.",
            },
          ],
          stats: [
            { num: "6", label: "Países de Origen" },
            { num: "40+", label: "Proveedores Verificados" },
            { num: "100%", label: "Cobertura CoA" },
            { num: "2013", label: "Abasteciendo Desde" },
          ],
          faqs: [
            {
              q: "¿Pueden abastecer materiales con certificación orgánica?",
              a: "Sí — mantenemos cadenas de suministro orgánicas USDA y EU con documentación completa.",
            },
            {
              q: "¿Comparten informes de auditoría de proveedores?",
              a: "Bajo NDA, sí. Proporcionamos resúmenes de auditoría y certificados relevantes.",
            },
          ],
          cta: "Pregunte sobre nuestro abastecimiento para sus requisitos específicos de producto.",
        },
        warehouse: {
          icon: "box",
          title: "Almacén y Logística",
          desc: "8,000 m² de almacén climatizado con envío consolidado a 30+ países.",
          hero: "Desde almacenamiento climatizado hasta carga de contenedores, nuestro equipo logístico asegura que sus productos lleguen intactos y a tiempo.",
          highlights: [
            {
              title: "Almacenamiento Climatizado",
              desc: "Temperatura y humedad monitorizadas 24/7 — crítico para velas, aceites y fragancias.",
            },
            {
              title: "Gestión de Inventario",
              desc: "Sistema WMS rastrea cada palé en tiempo real. Visibilidad de stock bajo solicitud.",
            },
            {
              title: "Envío Consolidado",
              desc: "Combine productos de múltiples líneas en un contenedor — reduzca coste de flete.",
            },
            {
              title: "Documentación de Exportación",
              desc: "Facturas comerciales, listas de empaque, CoO, certificados de fumigación y aduanas.",
            },
            {
              title: "Carga de Contenedores",
              desc: "Carga profesional con estiba, trinca y documentación fotográfica.",
            },
            {
              title: "Programa de Stock de Seguridad",
              desc: "Mantenemos stock acordado para clientes recurrentes — despacho en 2 semanas.",
            },
          ],
          stats: [
            { num: "8,000 m²", label: "Espacio Almacén" },
            { num: "30+", label: "Países de Exportación" },
            { num: "24/7", label: "Monitorización" },
            { num: "2 Semanas", label: "Despacho Reorder" },
          ],
          faqs: [
            {
              q: "¿Pueden enviar a almacenes de Amazon FBA?",
              a: "Sí — etiquetamos, embolsamos y enviamos directamente a FBA con cumplimiento a nivel de cartón.",
            },
            {
              q: "¿Ofrecen envío DDP?",
              a: "Sí — cotizamos DDP a destinos principales incluyendo US, EU, UK y Australia.",
            },
          ],
          cta: "Díganos su destino y volumen — propondremos la solución logística óptima.",
        },
        "production-capacity": {
          icon: "clock",
          title: "Capacidad de Producción",
          desc: "50,000+ unidades mensuales en líneas de velas, difusores y envasado de aceites.",
          hero: "Escale sin compromisos. Nuestras 4 líneas de producción manejan desde pilotos de 500 unidades hasta pedidos de contenedor completo.",
          highlights: [
            {
              title: "Línea de Velas",
              desc: "Vertido, mecha y curado automatizados — 20,000 velas/mes con calidad consistente.",
            },
            {
              title: "Línea de Difusores",
              desc: "Llenado y ensamblaje de precisión — 15,000 difusores/mes.",
            },
            {
              title: "Línea de Envasado de Aceites",
              desc: "Llenado con nitrógeno de 5 ml a 500 ml — 25,000 botellas/mes.",
            },
            {
              title: "Línea de Empaque",
              desc: "Ensamblaje de cajas, etiquetado, retractilado y embalaje — integrado con todas las líneas.",
            },
            {
              title: "Programación Flexible",
              desc: "Pilotos desde 500 unidades sin interrumpir la producción en masa.",
            },
            {
              title: "Pico Estacional",
              desc: "Escalamos a 80,000 uds/mes para Q4 con líneas temporales y turnos adicionales.",
            },
          ],
          stats: [
            { num: "50,000+", label: "Uds / Mes" },
            { num: "4", label: "Líneas de Producción" },
            { num: "500", label: "Piloto Mínimo" },
            { num: "80,000", label: "Capacidad Pico (Q4)" },
          ],
          faqs: [
            {
              q: "¿Cuál es el plazo para un contenedor completo?",
              a: "25–35 días según mix de producto y personalización. Pilotos en 15–20 días.",
            },
            {
              q: "¿Pueden manejar picos de volumen estacionales?",
              a: "Sí — planificamos capacidad Q4 con 3 meses de antelación. Pico: 80,000 uds/mes.",
            },
          ],
          cta: "Comparta su previsión de volumen — confirmamos capacidad y reservamos slots.",
        },
        certificates: {
          icon: "file",
          title: "Certificados y Cumplimiento",
          desc: "ISO 9001, IFRA, REACH, CLP, FDA — cumplimiento completo para mercados de US, EU y globales.",
          hero: "El cumplimiento no es opcional — es su acceso al mercado. Mantenemos todas las certificaciones principales internamente y producimos documentación específica para cada envío.",
          highlights: [
            {
              title: "ISO 9001:2015",
              desc: "Sistema de gestión de calidad certificado y auditado anualmente por SGS.",
            },
            {
              title: "Cumplimiento IFRA",
              desc: "Cada fórmula verificada contra estándares IFRA 51ª Enmienda.",
            },
            {
              title: "REACH y CLP",
              desc: "Cumplimiento químico EU completo con sustancias registradas y etiquetado conforme.",
            },
            {
              title: "Registro FDA",
              desc: "Instalación registrada en FDA para exportación de cosméticos y productos domésticos a US.",
            },
            {
              title: "MSDS / SDS",
              desc: "Fichas de seguridad en formato GHS para cada producto, en idioma de destino.",
            },
            {
              title: "Seguridad contra Incendios",
              desc: "Velas probadas según ASTM F2417 (US) y EN 15493 (EU).",
            },
          ],
          stats: [
            { num: "ISO 9001", label: "Sistema de Calidad" },
            { num: "IFRA 51ª", label: "Estándar Fragancia" },
            { num: "REACH", label: "Cumplimiento Químico EU" },
            { num: "FDA", label: "Registro US" },
          ],
          faqs: [
            {
              q: "¿Pueden proporcionar certificados para nuestro mercado específico?",
              a: "Sí — díganos su país de destino y preparamos toda la documentación de cumplimiento.",
            },
            {
              q: "¿Actualizan certificados cuando cambian las regulaciones?",
              a: "Sí — nuestro equipo monitorea cambios regulatorios y actualiza fórmulas y documentos proactivamente.",
            },
          ],
          cta: "Solicite nuestro paquete completo de cumplimiento — enviaremos los certificados relevantes.",
        },
      },
    },
    countryPages: {
      eyebrow: "Mercados de Exportación",
      title: "Exporte a Su País",
      subtitle:
        "Guía de cumplimiento, envío y productos específica para importar productos de aroma desde China.",
      nav_label: "Mercados de Exportación",
      items: {
        usa: {
          icon: "globe",
          title: "Exportar a EE.UU.",
          desc: "Productos de aroma registrados en FDA y probados según ASTM, enviados a Estados Unidos con documentación completa.",
          hero: "Hemos enviado miles de SKUs a EE.UU. — velas, aceites esenciales, difusores y home fragrance. Registro FDA, pruebas ASTM, cumplimiento Prop 65 y empaque FBA son estándar en cada pedido.",
          stats: [
            { num: "FDA", label: "Instalación Registrada" },
            { num: "ASTM", label: "Prueba de Seguridad" },
            { num: "15–20", label: "Días Flete Marítimo" },
            { num: "DDP", label: "Envío Disponible" },
          ],
          regulations: [
            {
              title: "Registro FDA",
              desc: "Instalación registrada en FDA para cosméticos y productos domésticos.",
            },
            {
              title: "ASTM F2417 / F2601",
              desc: "Velas probadas según estándares de seguridad contra incendios ASTM.",
            },
            {
              title: "California Prop 65",
              desc: "Productos probados para químicos listados en Prop 65. Etiquetas de advertencia cuando se requiere.",
            },
            {
              title: "TSCA",
              desc: "Ingredientes de fragancia verificados contra inventario EPA TSCA.",
            },
            {
              title: "CPSC",
              desc: "Etiquetado de velas cumple requisitos CPSC: fabricante, instrucciones, advertencias.",
            },
            {
              title: "FBA / Amazon",
              desc: "Etiquetas FNSKU, advertencias poly-bag, documentación hazmat y entrega directa a FBA.",
            },
          ],
          products: [
            {
              title: "Velas de Soja",
              desc: "Velas de marca blanca en frascos y latas — la categoría #1 de importación para marcas US.",
            },
            {
              title: "Sets de Aceites",
              desc: "Sets regalo multi-pack (6×10 ml) optimizados para Amazon A+ y temporadas de regalo.",
            },
            {
              title: "Difusores de Varillas",
              desc: "Elegantes difusores de vidrio — fuertes márgenes para boutiques US.",
            },
          ],
          shipping: [
            {
              title: "Flete Marítimo (FCL/LCL)",
              desc: "15–20 días (Ningbo → LA/NY). Manejamos despacho aduanal y última milla.",
            },
            {
              title: "Aéreo Express",
              desc: "5–7 días para muestras y reposiciones urgentes. DHL/FedEx/UPS con documentación hazmat.",
            },
            {
              title: "Servicio DDP",
              desc: "Entrega puerta a puerta con aranceles e impuestos incluidos.",
            },
            {
              title: "Directo a FBA",
              desc: "Etiquetamos, embolsamos y enviamos directamente a su almacén FBA designado.",
            },
          ],
          faqs: [
            {
              q: "¿Manejan el despacho aduanal en EE.UU.?",
              a: "Sí — proporcionamos toda la documentación y podemos gestionar el despacho aduanal.",
            },
            {
              q: "¿Sus velas cumplen Prop 65?",
              a: "Sí — probamos todos los químicos Prop 65 y aplicamos etiquetas de advertencia cuando se requiere.",
            },
          ],
          cta: "¿Listo para importar a EE.UU.? Comparta su lista de productos y prepararemos una cotización con cumplimiento.",
        },
        germany: {
          icon: "globe",
          title: "Exportar a Alemania",
          desc: "Productos de aroma conformes con REACH y CLP para el mercado alemán.",
          hero: "Alemania es el mayor mercado de home fragrance de Europa. Suministramos productos registrados REACH con etiquetado CLP en alemán y documentación de seguridad completa.",
          stats: [
            { num: "REACH", label: "Sustancias Registradas" },
            { num: "CLP", label: "Etiquetado Conforme" },
            { num: "25–30", label: "Días Flete Marítimo" },
            { num: "EU", label: "Documentos Conformidad" },
          ],
          regulations: [
            {
              title: "Registro REACH",
              desc: "Sustancias de fragancia verificadas contra lista registrada REACH.",
            },
            {
              title: "Etiquetado CLP",
              desc: "Etiquetas CLP en alemán con pictogramas, palabras de advertencia y códigos UFI.",
            },
            {
              title: "Reglamento Cosméticos UE",
              desc: "Productos de contacto cutáneo conformes con EC 1223/2009.",
            },
            {
              title: "GPSR (2024)",
              desc: "Cumplimiento del Reglamento General de Seguridad de Productos con persona responsable UE.",
            },
            {
              title: "VerpackG / LUCID",
              desc: "Empaque registrado en Zentrale Stelle Verpackungsregister.",
            },
            {
              title: "Etiquetado Alemán",
              desc: "Todas las etiquetas y advertencias disponibles en alemán.",
            },
          ],
          products: [
            {
              title: "Velas con CLP",
              desc: "Velas de soja y parafina con etiquetas CLP en alemán — listas para retail.",
            },
            {
              title: "Aceites (Grado Cosmético)",
              desc: "Aceites con cumplimiento cosmético UE completo: CPNP, alérgenos, SDS en alemán.",
            },
            {
              title: "Sets de Difusores",
              desc: "Difusores conformes CLP con códigos UFI — categoría de mayor crecimiento en Alemania.",
            },
          ],
          shipping: [
            {
              title: "Flete Marítimo",
              desc: "25–30 días (Ningbo → Hamburgo). Documentación aduanal UE completa.",
            },
            {
              title: "Flete Ferroviario",
              desc: "18–22 días vía China-Europa (Yiwu → Duisburg). Rentable para volúmenes medios.",
            },
            {
              title: "Despacho Aduanal UE",
              desc: "Preparamos toda la documentación de importación.",
            },
            {
              title: "DDP a Alemania",
              desc: "Puerta a puerta incluyendo aranceles UE (6.5% velas) y 19% IVA.",
            },
          ],
          faqs: [
            {
              q: "¿Proporcionan SDS en alemán?",
              a: "Sí — fichas de seguridad en alemán según formato CLP/GHS con las 16 secciones.",
            },
            {
              q: "¿Pueden gestionar el despacho aduanal UE?",
              a: "Preparamos toda la documentación. Trabajamos con su agente aduanal o recomendamos un socio.",
            },
          ],
          cta: "Indíquenos sus requisitos para el mercado alemán — prepararemos una cotización REACH/CLP.",
        },
        france: {
          icon: "globe",
          title: "Exportar a Francia",
          desc: "Productos de aroma conformes UE con documentación en francés para el mercado francés.",
          hero: "La herencia de fragancia de Francia lo convierte en un mercado exigente. Suministramos productos conformes IFRA con etiquetado CLP en francés y la calidad que los compradores franceses esperan.",
          stats: [
            { num: "IFRA", label: "51ª Enmienda" },
            { num: "CLP", label: "Etiquetado Francés" },
            { num: "25–30", label: "Días Flete Marítimo" },
            { num: "EU", label: "Cumplimiento Total" },
          ],
          regulations: [
            {
              title: "REACH y CLP",
              desc: "Cumplimiento químico UE completo con etiquetas de peligro en francés y códigos UFI.",
            },
            {
              title: "Normas IFRA",
              desc: "Cada fórmula verificada contra IFRA 51ª Enmienda — crítico para el mercado francés.",
            },
            {
              title: "Cosméticos UE (EC 1223/2009)",
              desc: "Productos de contacto cutáneo con soporte CPNP e ingredientes INCI en francés.",
            },
            {
              title: "Ley AGEC",
              desc: "Cumplimiento anti-residuos: marcas de reciclabilidad, logo Triman.",
            },
            {
              title: "Etiquetado Francés",
              desc: "Todas las etiquetas y advertencias en francés con traductores nativos.",
            },
            {
              title: "DGCCRF",
              desc: "Productos conformes con estándares de protección al consumidor franceses.",
            },
          ],
          products: [
            {
              title: "Velas Premium",
              desc: "Velas de soja con alta carga aromática y perfiles sofisticados.",
            },
            {
              title: "Aceites Grado Perfumería",
              desc: "Aceites con documentación IFRA completa — para clientes de cosmética y perfumería.",
            },
            {
              title: "Colecciones de Difusores",
              desc: "Difusores elegantes con empaque premium para boutiques francesas.",
            },
          ],
          shipping: [
            {
              title: "Flete Marítimo",
              desc: "25–30 días (Ningbo → Le Havre/Marsella). Documentación aduanal UE completa.",
            },
            {
              title: "Flete Ferroviario",
              desc: "18–22 días vía China-Europa. Competitivo para volúmenes medios a Francia.",
            },
            {
              title: "Aduanas UE e Interior",
              desc: "Manejamos documentación; despacho vía su agente. Entrega interior a su almacén.",
            },
            { title: "DDP a Francia", desc: "Puerta a puerta incluyendo aranceles UE y 20% TVA." },
          ],
          faqs: [
            {
              q: "¿Proporcionan documentación en francés?",
              a: "Oui — etiquetas CLP, SDS, declaraciones de alérgenos e instrucciones en francés.",
            },
            {
              q: "¿Pueden desarrollar fragancias estilo Grasse?",
              a: "Sí — nuestros perfumistas crean composiciones sofisticadas estilo francés.",
            },
          ],
          cta: "Comparta sus necesidades para el mercado francés — prepararemos un presupuesto conforme UE.",
        },
        spain: {
          icon: "globe",
          title: "Exportar a España",
          desc: "Productos de aroma conformes UE con documentación en español para el mercado ibérico.",
          hero: "El creciente mercado de home fragrance de España y su fuerte sector retail lo convierten en punto de entrada ideal al sur de Europa. Suministramos productos CLP con etiquetado en español y MOQs flexibles.",
          stats: [
            { num: "CLP", label: "Etiquetado Español" },
            { num: "REACH", label: "Conforme UE" },
            { num: "25–30", label: "Días Flete Marítimo" },
            { num: "EU", label: "Documentación Completa" },
          ],
          regulations: [
            {
              title: "REACH y CLP",
              desc: "Cumplimiento UE completo con etiquetas en español, alérgenos y códigos UFI.",
            },
            {
              title: "Reglamento Cosméticos UE",
              desc: "Productos de contacto cutáneo conformes con EC 1223/2009. Soporte CPNP incluido.",
            },
            {
              title: "Etiquetado Español (RD 1801)",
              desc: "Etiquetas cumplen requisitos de información al consumidor español.",
            },
            {
              title: "Residuos de Envases (Ley 7/2022)",
              desc: "Cumplimiento de la ley española de residuos de envases.",
            },
            {
              title: "IFRA",
              desc: "Fragancias verificadas contra estándares IFRA para uso seguro.",
            },
            {
              title: "AEMPS",
              desc: "Productos cosméticos notificados a la autoridad sanitaria española.",
            },
          ],
          products: [
            {
              title: "Velas Aromáticas",
              desc: "Velas de soja y parafina con etiquetas CLP en español — fuerte demanda en retail y hostelería.",
            },
            {
              title: "Difusores de Varillas",
              desc: "Perfiles mediterráneos (cítricos, brisa marina, azahar) para el mercado español.",
            },
            {
              title: "Aceites Esenciales",
              desc: "Aceites puros con SDS en español — para cosmética y aromaterapia.",
            },
          ],
          shipping: [
            {
              title: "Flete Marítimo",
              desc: "25–30 días (Ningbo → Barcelona/Valencia). Documentación aduanal UE completa.",
            },
            {
              title: "Ferrocarril + Carretera",
              desc: "Combinado ferroviario a corredor Madrid con entrega final por carretera. 20–25 días.",
            },
            {
              title: "Despacho Aduanal UE",
              desc: "Paquete documental completo para su agente aduanal.",
            },
            { title: "DDP a España", desc: "Puerta a puerta incluyendo aranceles UE y 21% IVA." },
          ],
          faqs: [
            {
              q: "¿Proporcionan etiquetas en español?",
              a: "Sí — etiquetas CLP, SDS, listas de alérgenos e instrucciones en español castellano.",
            },
            {
              q: "¿Cuáles son los aranceles de importación?",
              a: "Arancel común UE: 0% aceites esenciales, 6.5% velas, 3% vidrio. Proporcionamos códigos HS.",
            },
          ],
          cta: "Comparta sus requisitos para el mercado español — prepararemos un presupuesto conforme UE.",
        },
        canada: {
          icon: "globe",
          title: "Exportar a Canadá",
          desc: "Productos de aroma conformes con Health Canada y CCPSA para el mercado canadiense.",
          hero: "Los requisitos bilingües de Canadá y su marco regulatorio único (CCPSA, CCCR) exigen cumplimiento específico. Manejamos etiquetado en inglés y francés, asegurando que sus productos pasen aduanas sin demoras.",
          stats: [
            { num: "CCPSA", label: "Seguridad Producto" },
            { num: "Bilingüe", label: "Etiquetas EN + FR" },
            { num: "18–22", label: "Días Flete Marítimo" },
            { num: "DDP", label: "Envío Disponible" },
          ],
          regulations: [
            {
              title: "CCPSA",
              desc: "Canada Consumer Product Safety Act — productos cumplen requisitos de seguridad canadienses.",
            },
            {
              title: "Etiquetado Bilingüe (EN/FR)",
              desc: "Todas las etiquetas en inglés y francés según la ley canadiense.",
            },
            {
              title: "CCCR",
              desc: "Velas y aceites conformes con Consumer Chemicals and Containers Regulations.",
            },
            {
              title: "Productos Naturales de Salud",
              desc: "Aceites para uso terapéutico requieren notificación NHP — proporcionamos documentación.",
            },
            {
              title: "CEPA",
              desc: "Ingredientes verificados contra lista de sustancias domésticas canadiense.",
            },
            {
              title: "Ley de Competencia",
              desc: "Cantidad neta, identidad del distribuidor y país de origen según regulaciones canadienses.",
            },
          ],
          products: [
            {
              title: "Velas Bilingües",
              desc: "Velas de soja con etiquetas de seguridad EN/FR — conformes CCPSA y CCCR.",
            },
            {
              title: "Colecciones de Aceites",
              desc: "Aceites puros con documentación bilingüe — para retailers de aromaterapia.",
            },
            {
              title: "Difusores de Varillas",
              desc: "Difusores elegantes con etiquetas bilingües — categoría creciente en Canadá.",
            },
          ],
          shipping: [
            {
              title: "Flete Marítimo",
              desc: "18–22 días (Ningbo → Vancouver) o 25–30 días a Toronto/Montreal.",
            },
            {
              title: "Aéreo Express",
              desc: "4–6 días para muestras y pedidos urgentes. Documentación hazmat completa.",
            },
            {
              title: "Aduanas Canadienses",
              desc: "Preparamos toda la documentación: factura, packing list, CoO, SDS.",
            },
            {
              title: "DDP a Canadá",
              desc: "Puerta a puerta incluyendo aranceles (6.5% velas, 0% aceites) y GST/HST.",
            },
          ],
          faqs: [
            {
              q: "¿Proporcionan etiquetas bilingües (EN/FR)?",
              a: "Sí — todas las etiquetas, advertencias e instrucciones en inglés y francés según requisitos canadienses.",
            },
            {
              q: "¿Cuáles son los aranceles canadienses?",
              a: "Aceites esenciales: 0%. Velas: 6.5%. Difusores de vidrio: 8%. Proporcionamos códigos HS.",
            },
          ],
          cta: "¿Listo para importar a Canadá? Comparta su lista y prepararemos una cotización bilingüe con cumplimiento.",
        },
      },
    },
    comparePages: {
      eyebrow: "Comparativas de Productos",
      title: "Guías de Comparación",
      subtitle:
        "Comparativas lado a lado para elegir los materiales y productos adecuados para su marca.",
      nav_label: "Comparativas",
      items: {
        "soy-vs-paraffin": {
          title: "Cera de Soja vs Parafina",
          desc: "Comparación detallada de cera de soja y parafina — duración, aroma, coste, sostenibilidad y posicionamiento.",
          optionA: "Cera de Soja",
          optionB: "Parafina",
          intro:
            "Elegir entre soja y parafina es una de las primeras decisiones para cualquier marca de velas. Cada una tiene ventajas distintas según su posicionamiento.",
          rows: [
            {
              criterion: "Origen",
              a: "Natural — aceite de soja hidrogenado (renovable)",
              b: "Petrolera — subproducto de refinado de crudo",
            },
            {
              criterion: "Duración",
              a: "30–50% más larga (combustión lenta y fría)",
              b: "Velocidad de combustión estándar",
            },
            {
              criterion: "Aroma",
              a: "Buen aroma en frío; moderado en caliente",
              b: "Excelente aroma en caliente (mayor punto de fusión)",
            },
            {
              criterion: "Hollín",
              a: "Mínimo — combustión más limpia",
              b: "Más hollín si la mecha no es adecuada",
            },
            { criterion: "Coste", a: "2–3× más cara por kg", b: "La opción más económica" },
            {
              criterion: "Sostenibilidad",
              a: "Biodegradable, renovable, ángulo marketing eco",
              b: "Derivado petrolero no renovable",
            },
            {
              criterion: "Apariencia",
              a: "Acabado cremoso, opaco; propenso a frosting",
              b: "Liso, translúcido; acepta tintes vívidamente",
            },
            {
              criterion: "Percepción",
              a: "Premium, eco-consciente, natural",
              b: "Tradicional, gran consumo, valor",
            },
            {
              criterion: "Ideal Para",
              a: "Marcas boutique, consumidores eco, retail premium",
              b: "Marcas de volumen, colores vibrantes, aroma fuerte",
            },
          ],
          verdict:
            "Elija soja para marcas premium eco-posicionadas. Elija parafina para volumen y colores vibrantes. Muchas marcas exitosas ofrecen ambas — soja como línea hero, parafina como gama valor.",
          faqs: [
            {
              q: "¿Pueden mezclar soja y parafina?",
              a: "Sí — mezclas (ej. 70/30) combinan combustión limpia de soja con aroma y menor coste de parafina.",
            },
            {
              q: "¿Cuál prefieren sus clientes?",
              a: "70% elige soja o mezcla para mercados occidentales. Parafina sigue popular para volumen y velas decorativas.",
            },
          ],
          cta: "¿No sabe qué cera conviene a su marca? Comparta su posicionamiento y recomendaremos la fórmula.",
        },
        "essential-vs-fragrance-oil": {
          title: "Aceite Esencial vs Aceite de Fragancia",
          desc: "Diferencias entre aceites esenciales y de fragancia — composición, aplicaciones, coste y normativa.",
          optionA: "Aceite Esencial",
          optionB: "Aceite de Fragancia",
          intro:
            "Los aceites esenciales y de fragancia sirven propósitos diferentes. Entender sus diferencias le ayuda a elegir el ingrediente correcto.",
          rows: [
            {
              criterion: "Composición",
              a: "100% natural — extraído de plantas",
              b: "Sintético o semi-sintético — compuestos aromáticos de laboratorio",
            },
            {
              criterion: "Variedad",
              a: "Limitada a lo que la naturaleza ofrece (~300 aceites)",
              b: "Ilimitada — cualquier aroma imaginable",
            },
            {
              criterion: "Valor Terapéutico",
              a: "Sí — beneficios aromaterapia",
              b: "No — puramente aromático",
            },
            {
              criterion: "Coste",
              a: "Caro (USD 20–500+ por kg)",
              b: "Asequible (USD 5–30 por kg)",
            },
            {
              criterion: "Consistencia",
              a: "Varía por cosecha y clima",
              b: "Perfectamente consistente lote a lote",
            },
            {
              criterion: "Alérgenos",
              a: "Mayor riesgo — alérgenos naturales",
              b: "Menor — puede formularse sin alérgenos",
            },
            {
              criterion: "Normativa",
              a: "Regulación cosméticos, IFRA, declaración alérgenos",
              b: "IFRA, CLP, sin claims terapéuticos",
            },
            { criterion: "Vida Útil", a: "1–3 años (se oxida)", b: "2–5 años (más estable)" },
            {
              criterion: "Ideal Para",
              a: "Aromaterapia, cosmética natural, wellness, spa",
              b: "Velas, difusores, hogar, branding aromático",
            },
          ],
          verdict:
            "Use aceites esenciales cuando su marca se centre en natural y terapéutico. Use fragancias para aromas consistentes y creativos en velas y difusores. Muchas marcas usan ambos.",
          faqs: [
            {
              q: "¿Pueden mezclar ambos?",
              a: "Sí — mezclas híbridas dan la historia natural del esencial con la consistencia de la fragancia.",
            },
            {
              q: "¿Cuál es mejor para velas?",
              a: "Fragancias generalmente — mejor aroma en caliente, más variedad, menor coste y mejor estabilidad.",
            },
          ],
          cta: "Cuéntenos su concepto y recomendaremos el tipo de aceite y formulación adecuados.",
        },
        "reed-diffuser-vs-candle": {
          title: "Difusor de Varillas vs Vela Aromática",
          desc: "Comparando difusores y velas — duración, seguridad, coste, intensidad y casos de uso.",
          optionA: "Difusor de Varillas",
          optionB: "Vela Aromática",
          intro:
            "Ambos entregan home fragrance pero sirven necesidades diferentes. Esta comparativa le ayuda a decidir qué línea lanzar.",
          rows: [
            {
              criterion: "Llama / Seguridad",
              a: "Sin llama — sin riesgo de incendio",
              b: "Llama abierta — requiere supervisión",
            },
            {
              criterion: "Duración Aroma",
              a: "6–12 semanas continuas",
              b: "25–80 horas totales (solo encendida)",
            },
            {
              criterion: "Intensidad",
              a: "Sutil, ambiental — llena suavemente",
              b: "Más fuerte encendida — llena rápidamente",
            },
            {
              criterion: "Mantenimiento",
              a: "Cero — girar varillas semanalmente",
              b: "Cortar mecha, vigilar, apagar",
            },
            {
              criterion: "Coste Consumidor",
              a: "Mayor inicial (USD 20–60) pero dura meses",
              b: "Menor inicial (USD 10–35) pero se consume",
            },
            {
              criterion: "Coste Fabricación",
              a: "Mayor (vidrio + aceite + varillas + caja)",
              b: "Menor (cera + envase + mecha + etiqueta)",
            },
            {
              criterion: "Carga Normativa",
              a: "Menor — etiqueta CLP, sin prueba fuego",
              b: "Mayor — prueba fuego, advertencias, SDS",
            },
            {
              criterion: "Habitaciones",
              a: "Baños, dormitorios, oficinas, hoteles",
              b: "Salón, comedor, spa — ritual y ambiente",
            },
            {
              criterion: "Regalo",
              a: "Elegante, duradero — regalo premium",
              b: "Cálido, experiencial — regalo estacional",
            },
          ],
          verdict:
            "Ofrezca ambos. Difusores son su producto 'siempre activo' con mayores márgenes. Velas son su producto 'ritual' con conexión emocional. Juntos forman una colección completa.",
          faqs: [
            {
              q: "¿Cuál tiene mejores márgenes?",
              a: "Difusores típicamente 60–70% vs 50–60% velas, por mayor valor percibido.",
            },
            {
              q: "¿Cuál es más fácil de enviar?",
              a: "Difusores — sin clasificación hazmat (a diferencia de velas para aéreo).",
            },
          ],
          cta: "¿Planifica una línea de home fragrance? Le ayudamos a construir el mix correcto.",
        },
        "glass-vs-tin-candle": {
          title: "Frasco de Vidrio vs Lata para Velas",
          desc: "Comparando envases de vidrio y lata — estética, coste, seguridad, envío y posicionamiento.",
          optionA: "Frasco de Vidrio",
          optionB: "Lata / Metal",
          intro:
            "El envase define la presencia en estante, percepción de precio y logística. Vidrio y lata tienen ventajas distintas.",
          rows: [
            {
              criterion: "Estética",
              a: "Premium, elegante — muestra color de cera, luz a través",
              b: "Rústico, moderno, industrial — opaco, mate o impreso",
            },
            {
              criterion: "Coste",
              a: "Mayor (USD 0.50–2.00 por envase)",
              b: "Menor (USD 0.20–0.80 por envase)",
            },
            {
              criterion: "Peso",
              a: "Más pesado — mayor coste de envío",
              b: "Más ligero — menor coste, más unidades por cartón",
            },
            {
              criterion: "Rotura",
              a: "Frágil — requiere empaque protector",
              b: "Duradero — virtually irrompible en tránsito",
            },
            {
              criterion: "Resistencia Calor",
              a: "Excelente — maneja altas temperaturas",
              b: "Buena — exterior se calienta, necesita advertencia",
            },
            {
              criterion: "Personalización",
              a: "Esmerilado, color, impreso, moldes custom (desde 3,000)",
              b: "Impreso, repujado, formas custom (desde 5,000)",
            },
            {
              criterion: "Sostenibilidad",
              a: "Reciclable, reutilizable — historia eco",
              b: "Reciclable, reutilizable — también eco",
            },
            {
              criterion: "Ideal Para",
              a: "Marcas premium, spa, regalo lujo, colores visibles",
              b: "Velas viaje, exterior, marcas modernas, coste sensible",
            },
          ],
          verdict:
            "Vidrio para posicionamiento premium. Lata para viaje, exterior, coste sensible o estética industrial. Muchas marcas usan vidrio para hero y lata para minis/viaje.",
          faqs: [
            {
              q: "¿Hacen frascos de vidrio con forma custom?",
              a: "Sí — moldes custom desde 3,000 uds. Coste molde USD 500–2,000, reembolsable en pedidos repetidos.",
            },
            {
              q: "¿Cuál es mejor para Amazon FBA?",
              a: "Lata — más ligera (menores fees FBA), irrompible (sin poly-bag), menor tasa de devolución.",
            },
          ],
          cta: "¿No sabe qué envase conviene? Comparta su concepto y recomendaremos la opción correcta.",
        },
      },
    },
    downloads: {
      eyebrow: "Biblioteca de Recursos",
      title: "Centro de Descargas",
      subtitle:
        "Documentos listos para compartir, generados en vivo desde nuestros datos de producto — siempre actualizados, sin PDFs obsoletos.",
      open: "Abrir documento",
      hint: "Los documentos generados se abren en su navegador — use el botón Descargar PDF (o Ctrl+P) para guardar una copia. Los catálogos en PDF se descargan directamente a su dispositivo.",
      back: "Volver al Centro de Descargas",
      download_pdf: "Descargar PDF",
      products: "productos",
      lead_time: "Plazo de entrega",
      certs: "Certificaciones",
      rts_products: "productos Ready-to-Ship (datos de stock en vivo)",
      full_range: "¿Busca el rango mayorista completo? Explore la Shop.",
      rts_empty:
        "Ningún producto Ready-to-Ship cumple los criterios de stock actuales. Contáctenos para opciones bajo pedido.",
      catalog_unavailable:
        "Disponibilidad de productos no disponible temporalmente — reintente en breve.",
      no_image: "Sin imagen",
      ready_to_ship: "Ready to Ship",
      view_product: "Ver Producto",
      request_quote: "Solicitar Cotización",
      catalog_title: "Catálogo de Productos",
      catalog_desc:
        "Catálogo completo de Aromiso con especificaciones, MOQ y plazos — generado desde datos en vivo.",
      catalog_subtitle:
        "Gama completa en 6 categorías con especificaciones, MOQ y plazos de entrega.",
      catalog_cta_title: "Solicitar Precios",
      catalog_cta_text:
        "Este catálogo se genera desde datos en vivo. Para precios actuales, muestras o formulaciones personalizadas, contacte a nuestro equipo.",
      certificates_title: "Certificaciones y Cumplimiento",
      certificates_desc:
        "Resumen de certificaciones de calidad y estándares de cumplimiento de Aromiso — ISO, IFRA, REACH y más.",
      certificates_subtitle:
        "Sistemas de calidad y estándares de cumplimiento detrás de cada producto Aromiso.",
      cert_cta_title: "¿Necesita Documentos Específicos?",
      cert_cta_text:
        "Copias completas de certificados, hojas MSDS y declaraciones IFRA están disponibles bajo solicitud para proyectos confirmados.",
      oem_title: "Guía de Servicios OEM / ODM",
      oem_desc:
        "Guía completa de servicios de marca blanca y fabricación por contrato de Aromiso — capacidades, especificaciones y proceso.",
      oem_subtitle:
        "Ocho servicios de fabricación con especificaciones completas — desde formulación personalizada hasta fulfilment llave en mano.",
      oem_cta_title: "Inicie su Proyecto",
      oem_cta_text:
        "Comparta su concepto de producto y mercado objetivo — responderemos con una propuesta a medida en 2 días hábiles.",
      packaging_title: "Guía de Empaque",
      packaging_desc:
        "Opciones de empaque para cada categoría de producto Aromiso — envases, cierres, cajas y acabado de marca blanca.",
      packaging_subtitle:
        "Opciones de empaque estándar y personalizadas por categoría, más servicios de empaque llave en mano.",
      packaging_custom_title: "Empaque Personalizado y Cumplimiento",
      packaging_cta_title: "Diseñe su Empaque",
      packaging_cta_text:
        "Envíenos las guías de su marca — nuestro equipo de diseño propondrá maquetas de empaque en 5 días hábiles.",
    },
    // -----------------------------------------------------------------
    // V5.27 expansión de crecimiento — hub de soluciones / sourcing / OEM
    // -----------------------------------------------------------------
    solutionsHub: {
      whoWeHelpTitle: "A Quién Ayudamos",
      whoWeHelp: [
        {
          icon: "rocket",
          title: "Lanzar una Nueva Marca de Aroma",
          subtitle: "Marca blanca y productos con MOQ bajo",
          cta: "Explorar Marca Blanca",
          href: "/oem",
        },
        {
          icon: "globe",
          title: "Importar Productos de China",
          subtitle: "Verificación de proveedores y control de calidad",
          cta: "Explorar Sourcing",
          href: "/sourcing",
        },
        {
          icon: "palette",
          title: "Desarrollar Productos a Medida",
          subtitle: "Diseño OEM de fragancia y envase",
          cta: "Explorar OEM",
          href: "/oem",
        },
        {
          icon: "euro-dollar",
          title: "Importar a Europa / EE. UU.",
          subtitle: "Documentación de cumplimiento lista",
          cta: "Ver Requisitos",
          href: "/downloads/certificates",
        },
      ],
      matrixTitle: "Encuentre Su Camino",
      matrixSubtitle: "Relacione su tipo de negocio con la ruta de sourcing adecuada",
      matrix: [
        {
          audience: "Vendedores de Amazon",
          solution: "Marca blanca + MOQ pequeño",
          icon: "box",
          href: "/solutions/amazon-sellers",
        },
        {
          audience: "Marcas de Belleza y Estilo de Vida",
          solution: "Fragancia y envase personalizados",
          icon: "droplet",
          href: "/solutions/brand-owners",
        },
        {
          audience: "Hoteles y Espacios",
          solution: "Programas de aroma insignia",
          icon: "bed",
          href: "/solutions/hotels",
        },
        {
          audience: "Minoristas",
          solution: "Mayorista listo para enviar",
          icon: "bag",
          href: "/solutions/retail",
        },
        {
          audience: "Empresas de Regalos",
          solution: "Sets de regalo de marca",
          icon: "gift",
          href: "/solutions/wholesalers",
        },
        {
          audience: "Distribuidores",
          solution: "Alianzas OEM al por mayor",
          icon: "package",
          href: "/solutions/distributors",
        },
      ],
      howWeSolveTitle: "Cómo Lo Resolvemos",
      howWeSolve: [
        {
          step: 1,
          title: "Brief del Producto",
          desc: "Comparta su concepto, mercado objetivo y volumen",
        },
        {
          step: 2,
          title: "Selección de Proveedor",
          desc: "Le conectamos con fábricas asociadas verificadas",
        },
        { step: 3, title: "Muestras", desc: "Evalúe calidad, fragancia y acabado — 3–12 días" },
        { step: 4, title: "Producción", desc: "Escale de lotes piloto a contenedores completos" },
        { step: 5, title: "Control de Calidad", desc: "Inspección por lotes y QC previo al envío" },
        {
          step: 6,
          title: "Exportación",
          desc: "Documentación de cumplimiento y envío consolidado",
        },
      ],
      industryIntro:
        "Ya sea que lance una línea de velas de marca blanca, construya un programa de aroma para hoteles o escale aceites esenciales al por mayor, le conectamos con fábricas asociadas que cumplen sus especificaciones, certificaciones y plazos de entrega.",
      solutionsTitle: "Soluciones por Industria",
      solutionsSubtitle:
        "Explore nuestras guías de soluciones con estrategias de sourcing específicas",
      finalCtaTitle: "Hable con un Especialista en Sourcing",
      finalCtaText:
        "Cuéntenos su proyecto — categoría de producto, volumen y plazos — y reciba una hoja de ruta a medida con proveedores recomendados.",
      faqs: [
        {
          q: "¿Pueden ayudarme a lanzar una marca de aromas de marca blanca?",
          a: "Sí. Le conectamos con fábricas asociadas que ofrecen marca blanca con MOQ bajo (desde unas 100 unidades), fragancias personalizadas creadas con insumos de casas como Firmenich y Givaudan, y soporte completo de diseño de empaque.",
        },
        {
          q: "¿Cómo verifican la calidad de los proveedores?",
          a: "Aromiso opera sistemas de calidad ISO 9001 e ISO 22716 (GMP), y nuestras fábricas asociadas cuentan con certificaciones como CE y BSCI, con pruebas de terceros SGS disponibles. Apoyamos auditorías de fábrica, evaluación de muestras e inspección por lotes antes del envío.",
        },
        {
          q: "¿Qué documentos proporcionan para el cumplimiento de importación?",
          a: "Podemos suministrar MSDS/SDS, informes de seguridad de transporte marítimo y aéreo, certificados de cumplimiento REACH/CLP cuando aplique, e informes de pruebas de terceros SGS bajo solicitud.",
        },
        {
          q: "¿Cuáles son los plazos típicos?",
          a: "Muestras: 3–12 días. Producción en masa: 10–35 días según el nivel de personalización y el tamaño del pedido. Las fábricas asociadas mantienen una capacidad de 10.000–50.000 botellas/día para pedidos urgentes.",
        },
        {
          q: "¿Ofrecen envío consolidado?",
          a: "Sí. Consolidamos envíos de múltiples proveedores en contenedores únicos con trazabilidad completa del lote — ideal para vendedores de Amazon y minoristas que compran en varias categorías.",
        },
      ],
    },
    sourcingPage: {
      eyebrow: "Sourcing en China",
      title: "Compre Productos de Aroma en Fábricas Chinas Verificadas",
      subtitle:
        "Relacionamos su brief con fábricas verificadas, comprobamos calidad y cumplimiento, y consolidamos todo en un solo envío.",
      whatWeCanSourceTitle: "Qué Podemos Conseguir",
      whatWeCanSourceSubtitle:
        "Ocho familias de productos en nuestra red de fábricas — explore líneas listas o envíenos su brief de sourcing a medida.",
      whatWeCanSource: [
        {
          icon: "flame",
          title: "Velas Aromáticas",
          desc: "Velas de cera de soja, coco y mezclas en envases de vidrio, lata o cerámica.",
          href: "/products/candles",
        },
        {
          icon: "wind",
          title: "Difusores de Varillas",
          desc: "Difusores de varillas de ratán con envases, tapas y carga de fragancia a medida.",
          href: "/products/reed-diffusers",
        },
        {
          icon: "droplet",
          title: "Aceites Esenciales",
          desc: "Aceites esenciales puros y mezclas, a granel o en formato listo para retail.",
          href: "/products/essential-oils",
        },
        {
          icon: "sparkles",
          title: "Aceites de Fragancia",
          desc: "Aceites de alta perfumería de fábricas asociadas que trabajan con insumos de Firmenich, Givaudan, Ogawa y Robertet.",
          href: "/products/fragrance-oils",
        },
        {
          icon: "car",
          title: "Ambientadores para Auto",
          desc: "Clips de ventilación, tarjetas colgantes y difusores para líneas automotrices.",
          href: "/shop/?category=Car%20Fragrance",
        },
        {
          icon: "gift",
          title: "Sets de Regalo",
          desc: "Sets de regalo corporativos y de temporada que combinan varias categorías.",
          href: "/shop/?category=Gift%20Sets",
        },
        {
          icon: "home",
          title: "Accesorios de Home Fragrance",
          desc: "Sprays de ambiente, saquitos, cera derretible, quemadores y difusores.",
          href: "/products/home-fragrance",
        },
        {
          icon: "package",
          title: "Empaque y Acabado de Marca Blanca",
          desc: "Envases, tapas, cajas y acabado de etiquetas para su marca.",
          href: "/products/packaging",
        },
      ],
      processTitle: "Cómo Funciona el Sourcing",
      process: [
        {
          step: 1,
          title: "Comparta Su Brief",
          desc: "Producto, especificaciones, precio objetivo y volumen.",
        },
        {
          step: 2,
          title: "Selección de Fábrica",
          desc: "Preseleccionamos fábricas verificadas de nuestra red que encajan con su categoría, certificaciones y precio.",
        },
        {
          step: 3,
          title: "Muestras",
          desc: "Muestras en 3–12 días — evalúe calidad, aroma y acabado.",
        },
        {
          step: 4,
          title: "Negociación y Contratos",
          desc: "Negociamos precios, MOQ y plazos, y documentamos cada término.",
        },
        {
          step: 5,
          title: "Producción y QC",
          desc: "Controles por lote durante la producción; QC previo al envío con fotos e informes.",
        },
        {
          step: 6,
          title: "Consolidación y Envío",
          desc: "Varios proveedores consolidados en un solo envío con documentación completa.",
        },
      ],
      verifyTitle: "Qué Verificamos",
      verifySubtitle: "Cada proveedor de nuestra red pasa la misma lista de verificación",
      verify: [
        "Legitimidad de la fábrica y capacidad de producción (informes de auditoría disponibles)",
        "Certificaciones: CE, BSCI y cumplimiento de exportación para UE / EE. UU. / Canadá",
        "Cumplimiento de producto: MSDS / SDS para cada formulación",
        "Seguridad de transporte: informes de identificación para transporte marítimo y aéreo",
        "Evaluación de muestras antes de pagar cualquier depósito",
        "Consistencia de lote y precisión de llenado durante la producción",
        "Integridad del empaque y corrección del etiquetado",
        "Pruebas de terceros vía laboratorios SGS / CNAS / CMA bajo solicitud",
      ],
      networkTitle: "8 Fábricas Asociadas, 3 Niveles de Capacidad",
      networkIntro:
        "Trabajamos con ocho fábricas asociadas consolidadas en China, organizadas en tres niveles de capacidad — para cubrir cualquier brief, desde pedidos de volumen económicos hasta programas OEM premium.",
      tiers: [
        {
          name: "Volumen y Valor",
          desc: "Líneas económicas para SKUs listos para enviar y de alta rotación.",
          best: "Minoristas, vendedores de Amazon, programas sensibles al precio",
        },
        {
          name: "OEM Equilibrado",
          desc: "OEM/ODM flexible con fragancia, envases y empaque personalizados.",
          best: "Marcas en crecimiento, marca blanca desde unas 100 unidades",
        },
        {
          name: "Manufactura Premium de Marca",
          desc: "Instalaciones de gran escala (5.000㎡+), insumos de alta perfumería de Firmenich, Givaudan, Ogawa y Robertet, suite completa de documentación.",
          best: "Marcas consolidadas, programas para hoteles y spas",
        },
      ],
      networkStats: [
        { num: "8", label: "Fábricas asociadas" },
        { num: "3", label: "Niveles de capacidad" },
        { num: "500+", label: "Fragancias disponibles" },
        { num: "10k–50k", label: "Botellas por día" },
      ],
      auditCtaTitle: "¿Necesita una Lista de Auditoría?",
      auditCtaText:
        "Descargue nuestro resumen de certificaciones o solicite la documentación completa de auditoría de proveedores para proyectos confirmados.",
      auditCtaButton: "Ver Certificados y Documentos",
      faqs: [
        {
          q: "¿Tengo que pedir un contenedor completo?",
          a: "No. Apoyamos envíos LCL (carga menor que contenedor) y consolidamos varios proveedores en un solo envío, para que los pedidos pequeños y medianos sigan siendo económicos.",
        },
        {
          q: "¿Pueden conseguir productos que no están en su catálogo?",
          a: "Sí — envíenos una foto, hoja de especificaciones o muestra de referencia. Lo comparamos con nuestras ocho fábricas asociadas y volvemos con opciones y precios.",
        },
        {
          q: "¿Cómo manejan las disputas de calidad?",
          a: "Cada pedido incluye QC previo al envío con fotos e informes. Si un lote no cumple las especificaciones acordadas, coordinamos reproceso o reemplazo con la fábrica antes del pago final.",
        },
        {
          q: "¿Qué documentos de exportación pueden proporcionar?",
          a: "MSDS/SDS, informes de seguridad de transporte marítimo y aéreo, certificados REACH/CLP cuando aplique, e informes de pruebas de terceros SGS — preparados para los requisitos de importación de UE, EE. UU. y Canadá.",
        },
        {
          q: "¿Cuál es el pedido mínimo para proyectos de sourcing?",
          a: "Depende del producto y del nivel de fábrica. Los artículos listos para enviar pueden pedirse por caja; la marca blanca empieza desde unas 100 unidades; los proyectos OEM a medida se cotizan caso por caso.",
        },
      ],
    },
    oemHub: {
      eyebrow: "OEM / ODM",
      title: "Manufactura a Medida para Su Marca de Aroma",
      subtitle:
        "Desde marca blanca lista hasta formulaciones totalmente a medida — ocho servicios, un socio responsable.",
      customizeTitle: "Qué Podemos Personalizar",
      customize: [
        {
          icon: "droplet",
          title: "Fragancia",
          items: [
            "Más de 500 aromas listos para elegir",
            "Formulación a medida según su brief",
            "Insumos de alta perfumería (Firmenich, Givaudan, Ogawa, Robertet) vía fábricas asociadas",
          ],
        },
        {
          icon: "flask",
          title: "Formulación",
          items: [
            "Opciones de cera de soja, coco y mezclas",
            "Ajuste de carga de fragancia y quemado para velas",
            "Opciones veganas y sin ftalatos",
          ],
        },
        {
          icon: "package",
          title: "Envase y Empaque",
          items: [
            "Envases de vidrio, lata y cerámica",
            "Cajas, fundas e interiores personalizados",
            "Alternativas de empaque sostenible",
          ],
        },
        {
          icon: "tag",
          title: "Marca y Cumplimiento",
          items: [
            "Etiquetas, serigrafía y estampado de logo",
            "Soporte de etiquetado conforme para UE / EE. UU.",
            "Preparación de códigos de barras y etiquetas multilingües",
          ],
        },
      ],
      chooseTitle: "Elija Su Producto",
      chooseSubtitle: "Ocho servicios de manufactura — escoja su punto de partida",
      choose: [
        {
          icon: "droplet",
          title: "Aceite Esencial de Marca Blanca",
          desc: "Su etiqueta sobre aceites puros y mezclas probadas.",
          href: "/oem/private-label-essential-oil",
        },
        {
          icon: "flame",
          title: "Vela de Marca Blanca",
          desc: "Líneas de velas probadas listas para su marca.",
          href: "/oem/private-label-candle",
        },
        {
          icon: "wind",
          title: "Difusor de Varillas de Marca Blanca",
          desc: "Formatos de difusor más vendidos, con su marca.",
          href: "/oem/private-label-diffuser",
        },
        {
          icon: "factory",
          title: "Manufactura OEM de Velas",
          desc: "Cera, envase, aroma y empaque a medida.",
          href: "/oem/oem-candle",
        },
        {
          icon: "leaf",
          title: "Aceite Esencial OEM",
          desc: "Aceites a granel o listos para retail según su spec.",
          href: "/oem/oem-essential-oil",
        },
        {
          icon: "package",
          title: "Empaque Personalizado",
          desc: "Envases, cajas y acabados que venden.",
          href: "/oem/custom-packaging",
        },
        {
          icon: "sparkles",
          title: "Fragancia Personalizada",
          desc: "Aromas insignia desarrollados según su brief.",
          href: "/oem/custom-fragrance",
        },
        {
          icon: "custom-bottle",
          title: "Botellas y Envases a Medida",
          desc: "Moldes y formatos que encajan con su marca.",
          href: "/oem/custom-bottle",
        },
      ],
      levelsTitle: "¿Qué Tan Personalizado Lo Necesita?",
      levelsSubtitle: "Cuatro niveles — desde stock listo hasta OEM/ODM totalmente a medida",
      levels: [
        {
          name: "Listo para Usar",
          tagline: "Lo más rápido para llegar al mercado",
          points: [
            "Catálogo en stock, despacho en 48 horas",
            "Pida por unidad o caja — sin gran compromiso",
            "Ideal para probar nuevos mercados y canales",
          ],
          cta: "Ver Listo para Enviar",
          href: "/shop/?rts=1",
        },
        {
          name: "Marca Blanca",
          tagline: "Su marca, nuestros productos",
          points: [
            "Su etiqueta sobre formulaciones probadas",
            "MOQ desde unas 100 unidades",
            "Muestras en 3–12 días",
          ],
          cta: "Explorar Marca Blanca",
          href: "/oem/private-label-candle",
        },
        {
          name: "Semi-Personalizado",
          tagline: "Ajuste los detalles",
          points: [
            "Fragancia, envase o empaque personalizados",
            "El MOQ depende del componente personalizado",
            "Muestras en 3–12 días",
          ],
          cta: "Hablar de Semi-Personalizado",
          href: "/oem/custom-fragrance",
        },
        {
          name: "OEM / ODM Completo",
          tagline: "Construido desde su brief",
          points: [
            "Formulación, moldes y diseño a medida",
            "Producción en masa 10–35 días (según pedido)",
            "Suite completa de documentación para importación",
          ],
          cta: "Iniciar un Proyecto",
          href: "/contact",
        },
      ],
      processTitle: "El Proceso OEM",
      process: [
        {
          step: 1,
          title: "Consulta",
          desc: "Comparta su concepto, especificaciones y cantidad objetivo.",
        },
        {
          step: 2,
          title: "Asesoría",
          desc: "Aclaramos requisitos y recomendamos opciones en 2 días hábiles.",
        },
        {
          step: 3,
          title: "Cotización",
          desc: "Cotización detallada con MOQ, precio unitario y plazo.",
        },
        {
          step: 4,
          title: "Muestras",
          desc: "Muestras producidas en 3–12 días para su evaluación.",
        },
        {
          step: 5,
          title: "Confirmación",
          desc: "Apruebe la muestra, confirme arte y documentación.",
        },
        { step: 6, title: "Producción", desc: "Producción en masa en 10–35 días según el pedido." },
        {
          step: 7,
          title: "Control de Calidad",
          desc: "Controles en línea más QC previo al envío con informes.",
        },
        { step: 8, title: "Entrega", desc: "Documentación de exportación y envío consolidado." },
      ],
      faqs: [
        {
          q: "¿Cuál es el MOQ para pedidos de marca blanca?",
          a: "La marca blanca empieza desde unas 100 unidades en la mayoría de los productos. Los proyectos OEM totalmente a medida (moldes nuevos, formulaciones exclusivas) tienen MOQs más altos — confirmamos las cifras exactas en su cotización.",
        },
        {
          q: "¿Pueden desarrollar una fragancia a partir de mi descripción?",
          a: "Sí. Las fábricas asociadas trabajan con insumos de alta perfumería de casas como Firmenich, Givaudan, Ogawa y Robertet, y pueden igualar un aroma de referencia o crear uno nuevo desde su brief.",
        },
        {
          q: "¿Cuánto tarda el muestreo?",
          a: "Normalmente 3–12 días según la complejidad. Las muestras listas de stock pueden enviarse aún más rápido.",
        },
        {
          q: "¿Se encargan del etiquetado conforme para UE / EE. UU.?",
          a: "Sí — preparamos etiquetado estilo CLP/REACH para el mercado de la UE y etiquetado conforme para EE. UU., además de MSDS/SDS e informes de seguridad de transporte para su envío.",
        },
        {
          q: "¿Puedo empezar pequeño y escalar después?",
          a: "Ese es el camino habitual: pruebe con cantidades listas para enviar o de marca blanca, y pase a semi-personalizado u OEM completo una vez que el SKU se demuestre. Sus especificaciones quedan con nosotros para pedidos repetidos.",
        },
      ],
    },
    categoryPages: {
      subcatsTitle: "Popular en Esta Categoría",
      buyGuideTitle: "Guía de Compra",
      qualityTitle: "Calidad y Documentación",
      quality: [
        "Sistemas de calidad ISO 9001 / ISO 22716 (GMP)",
        "MSDS / SDS disponible para cada producto",
        "Documentación de cumplimiento REACH / CLP bajo solicitud",
        "Pruebas de terceros vía laboratorios SGS / CNAS / CMA",
      ],
      sourcingTitle: "Sourcing y Personalización",
      sourcing: [
        "Stock listo para enviar — despacho en 48 horas",
        "Marca blanca desde unas 100 unidades",
        "Fragancia, envases y empaque a medida (OEM/ODM)",
        "Envío consolidado entre categorías",
      ],
      recsTitle: "También Puede Necesitar",
      browseAll: "Ver todos los productos",
      "essential-oils": {
        subcats: [
          { label: "Aceites Esenciales a Granel", href: "/shop/?q=essential%20oil" },
          { label: "Listo para Enviar", href: "/shop/?q=essential%20oil&rts=1" },
          { label: "MOQ Bajo (≤ 50)", href: "/shop/?q=essential%20oil&moq=le50" },
        ],
        guide:
          "Comprar aceites esenciales a granel se reduce a pureza, consistencia y documentación. Verifique nombres botánicos y métodos de extracción, solicite MSDS/SDS para cada SKU, y siempre evalúe muestras por perfil de aroma y consistencia de lote antes de comprometer volumen.",
        points: [
          "Pida el MSDS/SDS y la guía de uso por SKU",
          "Confirme por escrito el método de extracción (destilación al vapor, prensado en frío)",
          "Evalúe al menos dos lotes de muestra por consistencia de aroma",
          "Para retail: revise la calidad del gotero/tapa y el cumplimiento de la etiqueta",
        ],
      },
      "fragrance-oils": {
        subcats: [
          { label: "Aceites de Fragancia en Stock", href: "/shop/?q=fragrance%20oil" },
          { label: "Listo para Enviar", href: "/shop/?q=fragrance%20oil&rts=1" },
          { label: "Servicio de Fragancia a Medida", href: "/oem/custom-fragrance" },
        ],
        guide:
          "Los aceites de fragancia están diseñados para rendir en vehículos específicos — velas, difusores o aplicaciones de contacto con la piel. Relacione el aceite con la aplicación, confirme las recomendaciones de carga de fragancia y pregunte si el aceite se basa en insumos de alta perfumería.",
        points: [
          "Confirme que el aceite sirve para su vehículo (cera, base de difusor, cosmético)",
          "Pida la carga de fragancia recomendada por aplicación",
          "Solicite opciones sin ftalatos / veganas si su mercado lo espera",
          "Las fábricas asociadas pueden igualar un aroma de referencia o crear uno a medida",
        ],
      },
      "reed-diffusers": {
        subcats: [
          {
            label: "Difusores de Varillas en Stock",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser",
          },
          {
            label: "Listo para Enviar",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&rts=1",
          },
          {
            label: "MOQ ≤ 10",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&moq=le10",
          },
        ],
        guide:
          "Un buen difusor de varillas equilibra envase, número de varillas y carga de fragancia para una difusión consistente durante semanas. Defina primero el estilo del envase, luego ajuste el número de varillas y el volumen de aceite al tamaño de habitación de sus clientes.",
        points: [
          "Envases de vidrio con cuello estrecho ralentizan la evaporación y extienden la vida",
          "Más varillas = mayor difusión pero consumo más rápido",
          "Pida informes de seguridad de transporte — el aceite de difusor es carga regulada",
          "Marca blanca desde unas 100 unidades con su envase y etiqueta",
        ],
      },
      candles: {
        subcats: [
          { label: "Velas en Stock", href: "/shop/?category=Scented%20Candles" },
          { label: "Listo para Enviar", href: "/shop/?category=Scented%20Candles&rts=1" },
          {
            label: "Valor al Por Mayor ($1–3)",
            href: "/shop/?category=Scented%20Candles&price=b1_3",
          },
          { label: "MOQ ≤ 10", href: "/shop/?category=Scented%20Candles&moq=le10" },
        ],
        guide:
          "Para velas al por mayor, el tipo de cera, el envase y el rendimiento de quemado definen tanto el costo como las reseñas. Las mezclas naturales de soja y coco queman más limpio y apoyan una historia premium; las latas sirven para viaje y líneas sensibles al costo.",
        points: [
          "Mezclas de soja/coco para posicionamiento premium, mezclas de parafina para costo",
          "Pida notas de prueba de quemado: tiempo, piscina de cera, comportamiento del hollín",
          "Las velas en lata viajan más baratas y resisten roturas (ideales para Amazon)",
          "Cera, envase y aroma a medida disponibles vía OEM desde MOQs mayores",
        ],
      },
      "home-fragrance": {
        subcats: [
          { label: "Home Fragrance en Stock", href: "/shop/?category=Home%20Fragrance" },
          { label: "Listo para Enviar", href: "/shop/?category=Home%20Fragrance&rts=1" },
          { label: "Ambientadores para Auto", href: "/shop/?category=Car%20Fragrance" },
          { label: "Sets de Regalo", href: "/shop/?category=Gift%20Sets" },
        ],
        guide:
          "El home fragrance es una categoría para combinar: difusores de varillas, sprays, saquitos, ceras derretibles y formatos para auto comparten plataformas de fragancia. Construir una gama sobre una sola historia de aroma reduce el costo de muestreo y fortalece su anaquel de marca.",
        points: [
          "Construya gamas sobre una fragancia en difusor, spray y saquito",
          "Los ambientadores para auto son complementos de alta rotación para minoristas",
          "Los sets de regalo elevan el valor promedio del pedido — combine 2–3 formatos",
          "Consolide entre formatos para mantener el flete económico",
        ],
      },
      packaging: {
        subcats: [
          { label: "Guía de Empaque", href: "/downloads/packaging-guide" },
          { label: "Servicio de Empaque Personalizado", href: "/oem/custom-packaging" },
          { label: "Botellas y Envases a Medida", href: "/oem/custom-bottle" },
        ],
        guide:
          "El empaque decide el atractivo en anaquel, la seguridad del flete y la experiencia de unboxing a la vez. Elija envases que sobrevivan el transporte, tapas que sellen la fragancia y cajas que cuenten su historia de marca — luego verifique el cumplimiento del etiquetado para su mercado.",
        points: [
          "Relacione el envase con el canal: latas para e-commerce, vidrio para retail premium",
          "Pida especificaciones de empaque con prueba de caída para SKUs frágiles",
          "Cajas y fundas personalizadas disponibles con su arte",
          "El etiquetado conforme UE/EE. UU. puede prepararse junto con su pedido",
        ],
      },
    },
  },

  // =========================================================================
  de: {
    ctaBand: {
      eyebrow: "Projekt starten",
      title: "Bereit, Ihre Aroma-Marke zu produzieren?",
      text: "Teilen Sie Ihr Briefing — Produkt, Menge und Zielpreis — und erhalten Sie innerhalb eines Werktags ein detailliertes Angebot mit MOQ und Lieferzeit.",
      button: "Angebot anfordern",
      note: "Antwort innerhalb eines Werktags · Ohne Verpflichtung",
    },
    catalog: {
      eyebrow: "Produktkatalog",
      title: "Laden Sie unseren neuesten Katalog herunter",
      text: "Stöbern Sie in ätherischen Ölen, Duftkerzen und Reed-Diffusern mit vollständigen Spezifikationen, MOQs und Verpackungsoptionen — bereit für Ihre nächste Eigenmarken-Linie.",
      button: "Katalog anfordern",
    },
    trust: ["Direkt ab Werk", "OEM / ODM", "Flexible MOQ", "Weltweiter Export", "Schnelle Antwort"],
    stats: [
      { num: "10+", label: "Jahre Erfahrung" },
      { num: "500+", label: "OEM-Projekte" },
      { num: "30+", label: "Exportländer" },
      { num: "24h", label: "Reaktionszeit" },
    ],
    homeStats: {
      eyebrow: "In Zahlen",
      title: "Ein Fertigungspartner zum Mitwachsen",
      subtitle:
        "Ein Jahrzehnt Aroma-Know-how, hunderte versendete Marken und ein Team, das schnell antwortet.",
    },
    packaging: {
      "essential-oils":
        "Glasflaschen (5–100 ml), Aluminiumdosen und Fässer, mit Eigenmarken-Druck.",
      "fragrance-oils":
        "Bernstein- und Kobaltglasflaschen (10–500 ml) mit Pipetten oder Scheibenverschlüssen, Fässer für die Fertigung.",
      candles:
        "Glas-, Blech- und Keramikgefäße mit custom Boxen und Einlagen, Eigenmarken-bedruckt.",
      "reed-diffusers":
        "Wiederbefüllbare Glasgefäße (50–200 ml) mit Rattanrohren und custom Boxen.",
      "home-fragrance":
        "PET- und Glassprühflaschen, Wachsmelt-Formen, Auto-Diffuser-Gehäuse und geschenkfertige Boxen.",
      packaging:
        "Stabile Schachteln, Faltschachteln, Etiketten, Einsätze und Schrumpffolie — schlüsselfertige Verpackungssätze.",
    },
    customization:
      "Duftanpassung, Formulentwicklung, Eigenmarken-Verpackung und Konformitätsdokumente (MSDS / IFRA / REACH).",
    factory: {
      eyebrow: "Unsere Anlage",
      title: "Ein vertikal integrierter Aroma-Campus",
      intro:
        "Von der Rohstoffannahme bis zum abgefüllten, etikettierten und palettierten Produkt kontrolliert unser 12.000 m² Campus jeden Schritt der Lieferkette. Interne Misch-, Abfüll- und QC-Prozesse bedeuten bessere Qualität, kürzere Lieferzeiten und volle Rückverfolgbarkeit.",
      sections: [
        {
          icon: "leaf",
          title: "Werksüberblick",
          body: "Ein 12.000 m² Campus in Yiwu, Zhejiang, der F&E, Produktion und Lager unter einem Dach vereint. Über 120 Mitarbeitende in Formulierung, Produktion und Qualität.",
        },
        {
          icon: "monitor",
          title: "Produktionslinie",
          body: "Automatisierte Abfüll-, Verschluss- und Etikettiermaschinen für Öle, Kerzen und Diffuser, skalierbar von Pilotläufen ab 500 Einheiten bis zu vollen Containern.",
        },
        {
          icon: "check",
          title: "Qualitätskontrolle",
          body: "Ein 24/7-QC-Labor führt GC-MS-Tests, Stabilitätsprüfungen und Chargenproben durch. Jede Lieferung geht mit Inspektionsbericht und Foto-/Video-Beweis raus.",
        },
        {
          icon: "pin",
          title: "Lager",
          body: "Klimakontrollierte Lagerung für Rohstoffe und Fertigwaren mit Chargen-Rückverfolgbarkeit und FIFO-Rotation für immer frischen Bestand.",
        },
        {
          icon: "drop",
          title: "Verpackung",
          body: "Internes Verpackungsdesign und -beschaffung — Glas, Aluminium und PCR-Optionen — mit Eigenmarken-Druck, Sicherheitsetiketten und Konformitätsdokumenten.",
        },
        {
          icon: "globe",
          title: "Exportprozess",
          body: "Erfahrenes Exportteam kümmert sich um Dokumentation, Zollpapiere und konsolidierten Weltversand mit Incoterms (EXW / FOB / CIF / DDP) nach Bedarf.",
        },
      ],
      certs: [
        { name: "ISO 9001", desc: "Zertifiziertes Qualitätsmanagementsystem." },
        { name: "ISO 22716", desc: "GMP für Kosmetikherstellung." },
        { name: "MSDS", desc: "Sicherheitsdatenblätter für alle Formulierungen." },
        { name: "IFRA", desc: "Duft-Konformität für sicheren Gebrauch." },
        { name: "REACH", desc: "Konform mit EU-Chemikalienverordnung." },
        { name: "FDA", desc: "Werksregistrierung hinterlegt." },
      ],
      timeline: [
        {
          year: "2013",
          title: "Gegründet",
          text: "Aromiso in Yiwu, Zhejiang von Duftstoff-Ingenieuren und Supply-Chain-Veteranen gegründet.",
        },
        {
          year: "2016",
          title: "Misch-Campus",
          text: "Erste interne Misch- und Abfülllinien in Betrieb genommen.",
        },
        {
          year: "2019",
          title: "Exportausbau",
          text: "Eigenes Export-Desk; erste Container nach Europa und Nordamerika.",
        },
        {
          year: "2022",
          title: "Automatisierung",
          text: "Automatisierte Abfüll- und Etikettiermaschinen verdoppelten den Durchsatz.",
        },
        {
          year: "2025",
          title: "12.000 m²",
          text: "Campus auf 12.000 m² mit neuem QC-Labor erweitert.",
        },
      ],
      galleryTitle: "Einblick in den Campus",
      galleryBadge:
        "Fotos erzählen nur einen Teil der Geschichte. Anfragen Sie eine Live-Video-Tour — wir gehen mit Ihnen durch die Produktionslinien und beantworten Ihre Fragen vor Ort.",
      galleryBody:
        "Ein Blick in unsere Misch-, Abfüll-, Reinraum- und Verpackungsbereiche — dieselben Linien, auf denen Ihre Produkte gefertigt werden.",
      galleryPrimary: "Live-Video-Tour anfragen",
      gallerySecondary: "Vor-Ort-Besuch planen",
      capacityStats: [
        { num: "12.000", label: "m² Campus" },
        { num: "120+", label: "Produktions- & QC-Team" },
        { num: "24/7", label: "QC-Labor" },
        { num: "100%", label: "Chargen geprüft" },
      ],
      ctaTitle: "Besuchen oder auditieren Sie unsere Anlage",
      ctaText:
        "Wir heißen Markeninhaber und Einkaufsteams zu Vor-Ort- oder Video-Audits willkommen. Fordem Sie eine Tour an — wir organisieren sie.",
      ctaNote: "Antwort innerhalb eines Werktags · Vor-Ort- und Video-Audits ganzjährig möglich",
      ctaButton: "Werksbesichtigung anfragen",
    },
    faq: [
      {
        q: "Wie hoch ist Ihre Mindestbestellmenge (MOQ)?",
        a: "Unsere Standard-MOQ beginnt bei 500 Einheiten für Eigenmarken, einige Lagerformate ab 200 Einheiten. Die MOQ skaliert mit der Individualisierung.",
      },
      {
        q: "Wie sind Ihre typischen Lieferzeiten?",
        a: "Muster dauern 7–10 Werktage. Die Produktionszeit beträgt nach Freigabe und Anzahlung meist 20–30 Tage je nach Menge und Verpackung.",
      },
      {
        q: "Bieten Sie OEM an?",
        a: "Ja. Wir entwickeln Formel, Duftprofil, Verpackung und Konformitätsdokumente aus Ihrem Briefing und fertigen unter Ihrer Marke.",
      },
      {
        q: "Was ist der Unterschied zwischen OEM und ODM?",
        a: "OEM fertigt nach Ihrer Spezifikation; ODM nutzt unsere bestehenden Formeln und Designs, die Sie als Eigenmarke führen. Beide mit niedriger MOQ.",
      },
      {
        q: "Machen Sie Private Label?",
        a: "Selbstverständlich. Wir liefern Eigenmarken-Verpackung, Druck und Etikettierung, sodass das Produkt versandfertig unter Ihrer Marke geht.",
      },
      {
        q: "In welche Länder liefern Sie?",
        a: "Wir exportieren weltweit — Nordamerika, Europa, Naher Osten, Australien und Asien — per Luft- oder Seefracht mit vollständiger Dokumentation.",
      },
      {
        q: "Wie sind Ihre Zahlungsbedingungen?",
        a: "Typischerweise 30 % Anzahlung zum Produktionsstart und 70 % vor Versand. Stammkunden können auf meilensteinbasierte Konditionen qualifizieren.",
      },
      {
        q: "Kann ich vor der Bestellung Muster anfordern?",
        a: "Ja. Wir senden physische Muster in 7–10 Werktagen, damit Sie Duft, Qualität und Verpackung prüfen.",
      },
      {
        q: "Welche Zertifikate liefern Sie?",
        a: "Wir liefern ISO 9001, ISO 22716, MSDS, IFRA, REACH und FDA nach Marktbedarf.",
      },
    ],
    categories: {
      "essential-oils": {
        icon: "drop",
        title: "Ätherische Öle",
        intro:
          "Reine, dampfdestillierte und kaltgepresste ätherische Öle von verifizierten Farmen und Destillerien, in unserem Yiwu-Campus gemischt und abgefüllt für Eigenmarken und Custom-Formulierungen.",
        applications: [
          {
            title: "Aromatherapie",
            desc: "Einzelnoten und eigene Blends für Diffuser und Wellness.",
          },
          { title: "Kosmetik & Hautpflege", desc: "Trägerfertige Öle in Kosmetikqualität." },
          { title: "Haushalt", desc: "Duftbasen für Kerzen, Waschmittel und Raumsprays." },
          {
            title: "Lebensmittel & Getränke",
            desc: "Lebensmitteltaugliche Aromaöle mit Dokumentation.",
          },
        ],
        faqs: [
          {
            q: "Sind Ihre Öle rein oder verdünnt?",
            a: "Wir liefern sowohl 100 % reine Einzelnoten-Öle als auch verdünnte Basen je nach Anwendung und Markt.",
          },
          {
            q: "Können Sie einen Referenzduft anpassen?",
            a: "Ja — senden Sie uns eine Probe oder ein Briefing, und unsere Parfümeure entwickeln ein passendes oder verbessertes Profil.",
          },
        ],
        ctaButton: "Öl-Angebot anfordern",
      },
      candles: {
        icon: "flame",
        title: "Duftkerzen",
        intro:
          "Natürliche Soja- und Bienenwachskerzen mit custom Duftprofilen, gegossen und veredelt in wiederverwendbaren Glas- und Blechgefäßen mit Eigenmarken-Branding.",
        applications: [
          { title: "Hausduft", desc: "Signature-Düfte für Wohnräume und Geschenke." },
          { title: "Hotellerie", desc: "Marken-Amenity-Kerzen für Hotels und Spas." },
          { title: "Geschenksets", desc: "Kuratierte Sets mit custom Boxen und Einlagen." },
          {
            title: "Spa & Wellness",
            desc: "Beruhigende, rußarme Formulierungen für Behandlungsräume.",
          },
        ],
        faqs: [
          {
            q: "Welches Wachs verwenden Sie?",
            a: "Hauptsächlich natürliche Soja- und Bienenwachsblends, mit Kokos- und Paraffinoptionen auf Anfrage.",
          },
          {
            q: "Liefern Sie das Glasgefäß?",
            a: "Ja — wir beschaffen und bedrucken Glas, Aluminium und Blech oder füllen Ihre mitgelieferte Verpackung.",
          },
        ],
        ctaButton: "Kerzen-Angebot anfordern",
      },
      "reed-diffusers": {
        icon: "wave",
        title: "Reed-Diffuser",
        intro:
          "Langlebige Hausduft-Systeme mit wiederbefüllbaren Glasgefäßen, Premium-Rattanrohren und custom Ölblends — eine flammenfreie, wartungsarme Duftlösung.",
        applications: [
          { title: "Hausduft", desc: "Kontinuierlicher, flammenfreier Duft für jeden Raum." },
          { title: "Büros", desc: "Subtle Markenatmosphäre für Empfang und Besprechungsräume." },
          { title: "Einzelhandel", desc: "Verkaufsfreundliches, geschenktaugliches Format." },
          { title: "Hotellerie", desc: "Signature-Düfte für Lobbys und Gästezimmer." },
        ],
        faqs: [
          {
            q: "Wie lange halten sie?",
            a: "Unsere Diffuser duften je nach Raumgröße und Rohrzahl 3–6 Monate.",
          },
          {
            q: "Sind die Flaschen wiederbefüllbar?",
            a: "Ja — wir bieten Nachfüllbeutel und wiederverwendbare Glasgefäße für ein nachhaltiges Wiederholkauf-Modell.",
          },
        ],
        ctaButton: "Diffuser-Angebot anfordern",
      },
      "fragrance-oils": {
        icon: "sparkle",
        title: "Duftöle",
        intro:
          "Premium Duftöle (synthetisch und naturidentisch) für Kerzen, Diffuser, Seifen und Haushaltsprodukte — chargenkonstant, IFRA-konform, in hunderten Duftprofilen verfügbar.",
        applications: [
          {
            title: "Kerzenherstellung",
            desc: "Öle mit hohem Flammpunkt für sauberen Duftwurf in Soja- und Paraffinwachs.",
          },
          {
            title: "Reed-Diffuser",
            desc: "Vorgemischte Diffuser-Basen mit optimaler Dochtviskosität.",
          },
          {
            title: "Seife & Kosmetik",
            desc: "Hautsichere Düfte mit vollständigen IFRA-Zertifikaten.",
          },
          {
            title: "Haushaltspflege",
            desc: "Stabile Düfte für Waschmittel, Sprays und Lufterfrischer.",
          },
        ],
        faqs: [
          {
            q: "Was ist der Unterschied zwischen Duftöl und ätherischem Öl?",
            a: "Ätherische Öle werden aus Pflanzen extrahiert; Duftöle werden im Labor formuliert. Duftöle bieten größere Vielfalt, niedrigere Kosten und bessere Konsistenz für die Fertigung.",
          },
          {
            q: "Können Sie einen Designer-Duft nachbilden?",
            a: "Ja — senden Sie uns eine Referenzprobe und unsere Parfümeure entwickeln innerhalb von 7–10 Tagen ein passendes Profil.",
          },
        ],
        ctaButton: "Duftöl-Angebot anfordern",
      },
      "home-fragrance": {
        icon: "home",
        title: "Raumdüfte",
        intro:
          "Ein komplettes Sortiment fertiger Raumdüfte — Raumsprays, Wäschesprays, Wachsmelts, Auto-Diffuser, Räucherstäbchen und Aromasteine — bereit für Eigenmarke oder kundenspezifische Formulierung.",
        applications: [
          { title: "Einzelhandel & E-Commerce", desc: "Regalfertige Formate mit starken Margen." },
          { title: "Hotellerie", desc: "Marken-Kissensprays, Lobby-Sprays und Amenitiy-Kits." },
          { title: "Geschenksets", desc: "Kuratierte Kollektionen mit Premium-Verpackung." },
          { title: "Automobil", desc: "Clip-on und Hänge-Diffuser mit langanhaltendem Duft." },
        ],
        faqs: [
          {
            q: "Welche Formate bieten Sie an?",
            a: "Raumsprays, Wäschesprays, Kissennebel, Wachsmelts, Auto-Diffuser, Räucherstäbchen, Aromasteine und Nachfüllungen — alles in individuellen Düften und Verpackungen.",
          },
          {
            q: "Kann ich Formate in einer Bestellung mischen?",
            a: "Ja — wir unterstützen Multi-SKU-Bestellungen für eine komplette Raumdüfte-Linie in einem Produktionslauf.",
          },
        ],
        ctaButton: "Raumdüfte-Angebot anfordern",
      },
      packaging: {
        icon: "box",
        title: "Verpackungen & Komponenten",
        intro:
          "Glasflaschen, Kerzengläser, Diffuser-Gefäße, Geschenkboxen, Rattanstäbe, Etiketten und komplette Verpackungssätze — gefertigt und bedruckt nach Ihrer Spezifikation.",
        applications: [
          {
            title: "Glas & Gefäße",
            desc: "Bernstein-, Kobalt- und Klarglasflaschen in Standard- und Sonderformen.",
          },
          {
            title: "Boxen & Sets",
            desc: "Stabile Schachteln, Faltschachteln und Magnetverschlüsse mit Vollfarbdruck.",
          },
          {
            title: "Etiketten & Druck",
            desc: "Selbstklebeetiketten, Siebdruck und Heißfolienprägung.",
          },
          {
            title: "Komponenten",
            desc: "Rattanstäbe, Dochte, Pipetten, Verschlüsse, Einsätze und Kappen.",
          },
        ],
        faqs: [
          {
            q: "Kann ich nur Verpackung bestellen, ohne Produkt?",
            a: "Selbstverständlich — viele Kunden beziehen Komponenten und Verpackungen separat.",
          },
          {
            q: "Bieten Sie Sonderformen an?",
            a: "Ja — ab 10.000 Einheiten öffnen wir individuelle Glas- oder Blechformen nach Ihrem Design.",
          },
        ],
        ctaButton: "Verpackungs-Angebot anfordern",
      },
    },

    solutions: {
      eyebrow: "Branchenlösungen",
      title: "Lösungen nach Branche",
      subtitle:
        "Ob Hotellerie, Einzelhandel, E-Commerce oder Vertrieb — wir haben das Sortiment, die Verpackung und die Compliance-Erfahrung für Ihre Regale.",
      items: {
        hotels: {
          icon: "home",
          title: "Hotels & Gastgewerbe",
          desc: "Signature-Düfte und Marken-Amenities, die Gästezimmer zu Markenerlebnissen machen.",
          hero: "Von Lobby-Diffusern bis zu Zimmerkerzen und Kissensprays — wir helfen Hotels, eine Duftidentität zu schaffen, die Gäste nie vergessen.",
          challenges: [
            {
              title: "Markenkonsistenz",
              desc: "Jedes Haus braucht dasselbe Duftprofil, Charge für Charge.",
            },
            {
              title: "Geringe Stückzahlen pro Zimmer",
              desc: "Hotels brauchen hunderte SKUs mit niedrigen Stückzahlen.",
            },
            {
              title: "Compliance & Sicherheit",
              desc: "Brandschutz, Allergenkennzeichnung und MSDS für jedes Produkt.",
            },
          ],
          products: [
            {
              title: "Lobby Reed-Diffuser",
              desc: "Großformatige Diffuser mit Ihrem Signature-Duft.",
            },
            {
              title: "Zimmerkerzen",
              desc: "Sojakerzen mit Hotellogo, individuellem Gefäß und sicherheitsgeprüfter Kerze.",
            },
            {
              title: "Kissensprays & Amenities",
              desc: "Turndown-Sprays, Wäschesprays und Mini-Diffuser.",
            },
          ],
          benefits: [
            "Signature-Duftentwicklung in 14 Tagen",
            "MOQ ab 200 Einheiten pro SKU",
            "Vollständige MSDS-, IFRA- und Brandschutzdokumentation",
            "Konsistente Chargenübereinstimmung",
            "Kostenloses Musterkit für Einkaufsteams",
            "Konsolidierter Versand an mehrere Häuser",
          ],
          faqs: [
            {
              q: "Können Sie einen Hotel-Duft entwickeln?",
              a: "Ja — unsere Parfümeure erstellen einen maßgeschneiderten Duft aus Ihrem Briefing in 14 Tagen.",
            },
            {
              q: "Wie hoch ist die MOQ für Hotel-Amenities?",
              a: "Ab 200 Einheiten pro SKU für Hotelprojekte, Multi-SKU-Bestellungen möglich.",
            },
          ],
          cta: "Bereit für den Signature-Duft Ihres Hotels? Teilen Sie Ihr Markenbriefing.",
        },
        "spa-wellness": {
          icon: "leaf",
          title: "Spa & Wellness",
          desc: "Therapeutische Produkte für Behandlungsräume, Retail und Entspannungsbereiche.",
          hero: "Spa-Gäste erwarten Reinheit und Ruhe. Wir liefern ätherische Öle, Massageöle und Aromatherapie-Kerzen in therapeutischer Qualität.",
          challenges: [
            {
              title: "Therapeutische Reinheit",
              desc: "Spa-Formulierer brauchen GC-MS-verifizierte Öle mit Chemotyp-Daten.",
            },
            {
              title: "Behandlungskonsistenz",
              desc: "Therapeuten verlassen sich auf identischen Duft und Viskosität.",
            },
            {
              title: "Retail-Upsell",
              desc: "Spas wollen Markenprodukte, die Gäste kaufen können.",
            },
          ],
          products: [
            {
              title: "Ätherische Öl-Sets",
              desc: "Kurierte Sets in therapeutischer Qualität für Behandlung und Retail.",
            },
            {
              title: "Massage- & Körperöle",
              desc: "Vorgemischte Träger + ätherische Öle, Eigenmarke.",
            },
            {
              title: "Aromatherapie-Kerzen",
              desc: "Rußarme Sojakerzen mit beruhigenden Ölmischungen.",
            },
          ],
          benefits: [
            "GC-MS-Berichte pro Charge",
            "100% reine, unverdünnte ätherische Öle",
            "Individuelle Mischungen nach Ihren Protokollen",
            "Eigenmarken-Retail ab 300 Einheiten",
            "IFRA- und Kosmetik-Sicherheitsdokumentation",
            "Musterkits für Therapeuten-Evaluierung",
          ],
          faqs: [
            {
              q: "Sind Ihre Öle therapeutische Qualität?",
              a: "Wir liefern 100% reine Öle mit GC-MS-Verifizierung und vollständigen Analysedaten.",
            },
            {
              q: "Können Sie Massage-Mischungen formulieren?",
              a: "Ja — teilen Sie Ihr Protokoll und wir entwickeln eine passende Mischung mit Stabilitätstests.",
            },
          ],
          cta: "Erzählen Sie uns von Ihrem Behandlungsangebot — wir empfehlen die passende Ölpalette.",
        },
        retail: {
          icon: "monitor",
          title: "Einzelhandel & E-Commerce",
          desc: "Regalfertige Eigenmarkenprodukte mit starken Margen für Online- und Ladengeschäfte.",
          hero: "Ob Boutique, Kette oder DTC-Marke — wir liefern verkaufsfertige Produkte mit Verpackung, Barcodes und Compliance-Dokumenten.",
          challenges: [
            {
              title: "Margendruck",
              desc: "Händler brauchen Fabrikpreise für 60%+ Margen nach Plattformgebühren.",
            },
            {
              title: "Schnelle Nachlieferung",
              desc: "Bestseller sind ausverkauft; Sie brauchen Nachlieferung in 2–3 Wochen.",
            },
            {
              title: "Compliance pro Markt",
              desc: "CLP für EU, FDA für USA — ein Lieferant, der alles abwickelt.",
            },
          ],
          products: [
            {
              title: "Eigenmarken-Kerzen",
              desc: "Ihre Marke, Ihr Duft, Ihr Gefäß — ab 500 Einheiten.",
            },
            {
              title: "Diffuser-Sortiment",
              desc: "Mehrere Größen und Düfte für eine komplette Kollektion.",
            },
            { title: "Geschenksets", desc: "Kurierte Sets mit Premium-Boxen — hoher AOV für Q4." },
          ],
          benefits: [
            "Fabrikdirektpreise",
            "MOQ ab 500 Einheiten pro SKU",
            "Komplette Verpackung: Box, Etikett, Barcode",
            "CLP / FDA / REACH Dokumentation pro Markt",
            "20–25 Tage Produktion, 7 Tage Muster",
            "Multi-SKU-Konsolidierung im Container",
          ],
          faqs: [
            {
              q: "Übernehmen Sie die EU-CLP-Kennzeichnung?",
              a: "Ja — wir erstellen konforme CLP-Etiketten mit Allergenen, Piktogrammen und UFI-Codes.",
            },
            {
              q: "Wie schnell liefern Sie nach?",
              a: "Standard-Nachbestellungen in 15–20 Tagen. Sicherheitslager für Stammkunden.",
            },
          ],
          cta: "Teilen Sie Ihr Produktbriefing und Ihren Zielpreis — Angebot innerhalb eines Werktags.",
        },
        "amazon-sellers": {
          icon: "globe",
          title: "Amazon-Verkäufer",
          desc: "FBA-fertige Produkte mit optimierter Verpackung und Amazon-Compliance.",
          hero: "Amazons Regeln sind streng: FNSKU, Polybag-Warnungen, Hazmat-Prüfung. Wir haben tausende FBA-fertige Einheiten versandt und übernehmen die Compliance.",
          challenges: [
            {
              title: "FBA-Compliance",
              desc: "Amazon lehnt Sendungen ohne FNSKU, Warnungen oder Hazmat-Dokumente ab.",
            },
            {
              title: "Bewertungsgeschwindigkeit",
              desc: "Konsistente Qualität, damit jede Einheit den Listing-Fotos entspricht.",
            },
            {
              title: "Cashflow",
              desc: "Amazon hält Auszahlungen zurück; Sie brauchen niedrige MOQ und schnelle Lieferung.",
            },
          ],
          products: [
            { title: "FBA-fertige Kerzen", desc: "Mit FNSKU, Polybag, Warnung und Hazmat-Blatt." },
            {
              title: "Ätherische Öl-Sets",
              desc: "Multi-Packs optimiert für A+ Content und Geschenk-Positionierung.",
            },
            {
              title: "Wax-Melt-Bundles",
              desc: "Clamshell-Packs mit hoher Marge und FBA-Verpackung.",
            },
          ],
          benefits: [
            "FBA-fertige Verpackung (FNSKU, Polybag, Warnungen)",
            "Hazmat-Dokumentation für Kerzen und Öle",
            "Produktfotografie und A+ Content Support",
            "MOQ ab 500 Einheiten",
            "20 Tage Produktion bis FBA-Lager",
            "Konsistente Qualität für Bewertungsschutz",
          ],
          faqs: [
            {
              q: "Liefern Sie Hazmat-Dokumentation?",
              a: "Ja — SDS, Flammpunktberichte und UN-Transportzertifikate für Amazon Hazmat-Review.",
            },
            {
              q: "Versenden Sie direkt an FBA-Lager?",
              a: "Ja — wir etikettieren, verpacken und versenden an Ihr FBA-Lager mit Karton-Compliance.",
            },
          ],
          cta: "Teilen Sie Ihre ASIN-Strategie — wir erstellen einen konformen Produktplan.",
        },
        supermarkets: {
          icon: "box",
          title: "Supermärkte & Ketten",
          desc: "Volumenproduktion mit retail-konformer Verpackung und konsistenter Lieferung.",
          hero: "Supermarkt-Einkäufer brauchen Volumen, Konsistenz und Compliance. Wir liefern Eigenmarken-Sortimente in Containervolumen.",
          challenges: [
            {
              title: "Volumen & Konsistenz",
              desc: "Ketten brauchen 10.000+ identische Einheiten pro Bestellung.",
            },
            {
              title: "Retail-Compliance",
              desc: "EAN-Codes, EDI-Bestellung, spezifische Verpackungsmaße.",
            },
            {
              title: "Kostenoptimierung",
              desc: "Supermarktmargen erfordern aggressive Stückkosten.",
            },
          ],
          products: [
            {
              title: "Eigenmarken-Kerzensortiment",
              desc: "Komplette Linien (3–8 SKUs) mit Shelf-Ready-Trays und EAN.",
            },
            {
              title: "Diffuser-Kollektion",
              desc: "Gestaffeltes Sortiment (gut/besser/premium) mit einheitlichem Design.",
            },
            {
              title: "Saisonkollektionen",
              desc: "Weihnachten, Sommer und Frühling, 6 Monate im Voraus geplant.",
            },
          ],
          benefits: [
            "Containervolumen-Produktion (10.000+)",
            "Shelf-Ready-Verpackung mit EAN/UPC",
            "EDI- und Portal-Bestellung unterstützt",
            "Dedizierter Account-Manager für Ketten",
            "6-Monats-Vorplanung für Saisonsortimente",
            "Vollständige Compliance: CLP, REACH, FDA",
          ],
          faqs: [
            {
              q: "Können Sie Supermarktvolumen liefern?",
              a: "Ja — unsere Linien produzieren 50.000+ Einheiten/Monat mit dediziertem QC.",
            },
            {
              q: "Unterstützen Sie EDI-Bestellungen?",
              a: "Wir integrieren uns in gängige EDI-Plattformen und Einkäuferportale.",
            },
          ],
          cta: "Teilen Sie Ihren Sortimentsplan und Ihre Volumenprognose — Angebot in 3 Tagen.",
        },
        "brand-owners": {
          icon: "sparkle",
          title: "Markeninhaber",
          desc: "Vom Konzept ins Regal: Formulentwicklung, Verpackungsdesign und Fertigung unter Ihrer Marke.",
          hero: "Sie haben die Markenvision; wir die Fabrik. Von der Duftentwicklung bis zur Verpackungskonstruktion bauen wir Ihre Produktlinie von Grund auf.",
          challenges: [
            {
              title: "Produktentwicklung",
              desc: "Ein Markenkonzept in ein fertigbares, kalkuliertes Produkt verwandeln.",
            },
            {
              title: "Verpackungsdifferenzierung",
              desc: "Auffallen im Regal oder beim Unboxing erfordert individuelle Gefäße und Boxen.",
            },
            {
              title: "Produktion skalieren",
              desc: "Von 500 Einheiten Launch zu 10.000 Nachbestellung ohne Qualitätsverlust.",
            },
          ],
          products: [
            {
              title: "Komplette Produktentwicklung",
              desc: "Duft → Formel → Gefäß → Verpackung → Compliance, End-to-End.",
            },
            {
              title: "Individuelle Formen & Gefäße",
              desc: "Exklusives Glas, Keramik oder Blech für Ihre Marke.",
            },
            {
              title: "Multi-SKU Sortimentsaufbau",
              desc: "5–20 SKUs über Kerzen, Diffuser und Sprays.",
            },
          ],
          benefits: [
            "End-to-End-Produktentwicklung (Briefing bis Container)",
            "Exklusive Formen ab 10.000 Einheiten",
            "In-house Verpackungsdesign und Prototyping",
            "IP-Schutz: Ihre Formel, Ihre Form, NDA",
            "Skalierbar von 500 bis Container",
            "Dedizierter Projektmanager",
          ],
          faqs: [
            {
              q: "Können Sie aus einem Briefing entwickeln?",
              a: "Ja — teilen Sie Positionierung, Zielpreis und Ästhetik. Wir übernehmen alles.",
            },
            {
              q: "Wem gehört die Formel und Form?",
              a: "Ihnen. Individuelle Formeln und Formen sind Ihr IP, durch NDA geschützt.",
            },
          ],
          cta: "Teilen Sie Ihr Markenbriefing — wir schlagen ein Sortiment mit Kalkulation in 5 Tagen vor.",
        },
        wholesalers: {
          icon: "download",
          title: "Großhändler",
          desc: "Fabrikpreise bei Volumenbestellungen mit flexibler MOQ-Aufteilung.",
          hero: "Großhändler brauchen Marge, Breite und Zuverlässigkeit. Wir bieten Fabrikpreise über 80+ SKUs mit gemischten Containerbestellungen.",
          challenges: [
            {
              title: "Margenschutz",
              desc: "Großhandelsmargen sind dünn; Sie brauchen den niedrigsten Stückpreis.",
            },
            {
              title: "Sortimentsbreite",
              desc: "Ihre Kunden wollen Vielfalt — Kerzen, Diffuser, Öle — von einem Anbieter.",
            },
            {
              title: "Zuverlässige Lieferung",
              desc: "Lieferausfälle zerstören Großhandelsbeziehungen.",
            },
          ],
          products: [
            {
              title: "Gemischte Containerbestellungen",
              desc: "Kombinieren Sie Kerzen, Diffuser, Öle und Sprays in einem Container.",
            },
            {
              title: "White-Label-Sortiment",
              desc: "Unsere bewährten Formeln unter Ihrer Hausmarke.",
            },
            {
              title: "Lagerprogramm",
              desc: "Sicherheitsbestand Ihrer Topseller für 2-Wochen-Nachlieferung.",
            },
          ],
          benefits: [
            "Fabrikdirektpreise",
            "80+ SKUs in 6 Kategorien",
            "Gemischte Containerkonsolidierung",
            "2-Wochen-Nachlieferung bei Wiederholbestellungen",
            "Flexible Zahlung: 30/70 oder LC at sight",
            "Dedizierter Großhandels-Account-Manager",
          ],
          faqs: [
            {
              q: "Wie ist Ihre Großhandelspreisstruktur?",
              a: "Staffeln bei 1.000 / 5.000 / 10.000 / Container. Fordern Sie unsere Preisliste an.",
            },
            {
              q: "Kann ich Produkte mischen?",
              a: "Ja — Minimum 500 Einheiten pro SKU, keine SKU-Obergrenze.",
            },
          ],
          cta: "Fordern Sie unseren Großhandelskatalog und die Preisliste an — Antwort innerhalb eines Werktags.",
        },
        distributors: {
          icon: "globe",
          title: "Vertriebspartner",
          desc: "Exklusive Gebietpartnerschaften mit Marketing-Support und Lagerprogramm.",
          hero: "Vertriebspartner brauchen Exklusivität, Marketing-Support und zuverlässige Lieferung. Wir bieten gebietsexklusive Partnerschaften mit Co-Branding-Materialien.",
          challenges: [
            {
              title: "Gebietsschutz",
              desc: "Vertriebspartner investieren in Marktentwicklung; sie brauchen garantierte Exklusivität.",
            },
            {
              title: "Marketing-Support",
              desc: "Landessprachliche Kataloge, Produktschulung und Co-Branding-Assets.",
            },
            {
              title: "Lagerverfügbarkeit",
              desc: "Vertriebspartner können nicht 30 Tage auf jede Bestellung warten.",
            },
          ],
          products: [
            {
              title: "Vollständiger Katalogzugang",
              desc: "80+ SKUs mit Marketingmaterialien in Ihrer Landessprache.",
            },
            {
              title: "Co-Branding-Verpackung",
              desc: "Produkte mit Ihrer Vertriebsmarke neben Aromiso.",
            },
            {
              title: "Lagerprogramm",
              desc: "Vorpositioniertes Inventar für 2-Wochen-Versand in Ihr Gebiet.",
            },
          ],
          benefits: [
            "Exklusive Gebietsvereinbarungen",
            "Co-Branding-Kataloge und digitale Assets",
            "Produktschulung für Ihr Vertriebsteam",
            "Vorpositioniertes Lager für schnellen Versand",
            "Jährliches Rebate-Programm bei Volumenziel",
            "Unterstützung bei Messeteilnahmen",
          ],
          faqs: [
            {
              q: "Bieten Sie exklusive Gebiete?",
              a: "Ja — wir schließen gebietsexklusive Vereinbarungen mit jährlichen Mindestabnahmen.",
            },
            {
              q: "Welchen Marketing-Support bieten Sie?",
              a: "Landessprachliche Kataloge, Produktfotografie, Video-Content, Schulungsunterlagen und Co-Branding-Assets.",
            },
          ],
          cta: "Nennen Sie uns Ihr Gebiet und Ihre Zielkategorien — wir schlagen einen Partnerschaftsrahmen vor.",
        },
      },
    },
    oemServices: {
      eyebrow: "OEM / ODM Dienstleistungen",
      title: "Private Label & OEM Fertigung",
      subtitle:
        "Von der Formelentwicklung bis zum Fertigprodukt — wir fertigen unter Ihrer Marke mit voller Individualisierung.",
      items: {
        "private-label-essential-oil": {
          icon: "drop",
          title: "Private Label Ätherisches Öl",
          desc: "Ihre Marke, unsere reinen ätherischen Öle — individuelle Mischungen, Flaschen, Etiketten und Verpackung ab 500 Stück.",
          hero: "Starten Sie Ihre eigene ätherische-Öl-Linie ohne eigene Destillerie. Wir liefern 100% reine, GC-MS-verifizierte Öle in Ihrem Branding — von Einzelölen bis zu kuratierten Sets — mit vollständiger Dokumentation.",
          process: [
            {
              title: "Briefing & Auswahl",
              desc: "Wählen Sie aus 30+ Ölen oder fordern Sie individuelle Mischungen an.",
            },
            {
              title: "Muster & Freigabe",
              desc: "Erhalten Sie 5–10 ml Muster innerhalb von 7 Tagen. Iterieren bis zur Freigabe.",
            },
            {
              title: "Produktion & Abfüllung",
              desc: "Destillation/Beschaffung, Qualitätsprüfung, Präzisionsabfüllung in Ihr Gefäß.",
            },
            {
              title: "Etikettierung & Versand",
              desc: "Ihre Etiketten aufbringen, in Retail-Boxen verpacken und versenden.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 Stück pro SKU" },
            { label: "Reinheit", value: "100% rein, GC-MS-verifiziert" },
            { label: "Flaschen", value: "5 ml – 100 ml Braun-/Kobaltglas" },
            { label: "Lieferzeit", value: "20–25 Tage nach Freigabe" },
            { label: "Zertifizierungen", value: "ISO 22716, IFRA, MSDS pro SKU" },
            { label: "Individuelle Mischung", value: "Ja — nach Ihrem Briefing" },
          ],
          faqs: [
            {
              q: "Kann ich eine eigene Ölmischung erstellen?",
              a: "Ja — teilen Sie uns den gewünschten Effekt mit. Unsere Formulierer entwickeln die Mischung in 7 Tagen.",
            },
            {
              q: "Liefern Sie GC-MS-Berichte?",
              a: "Jede Charge enthält GC-MS-Chromatogramm, Allergenerklärung und IFRA-Konformitätszertifikat.",
            },
          ],
          cta: "Bereit für Ihre eigene Öl-Marke? Teilen Sie Ihr Briefing für ein kostenloses Muster.",
        },
        "private-label-candle": {
          icon: "flame",
          title: "Private Label Kerze",
          desc: "Individuelle Sojawachs-Kerzen mit Ihrer Marke, Duft und Gefäß — ab 500 Stück mit voller Verpackung.",
          hero: "Bauen Sie eine Kerzenlinie auf, die einzigartig ist. Wir übernehmen Wachsformulierung, Duftbeladung, Gefäßbeschaffung, Sicherheitsprüfung und Verpackung.",
          process: [
            {
              title: "Konzept & Duft",
              desc: "Definieren Sie Ihre Kerzenlinie: Wachstyp, Duftprofil, Gefäß und Zielpreis.",
            },
            {
              title: "Bemusterung",
              desc: "Erhalten Sie 2–3 handgegossene Muster innerhalb von 10 Tagen.",
            },
            {
              title: "Produktion",
              desc: "Chargengießen, Aushärtung, Dochtttest und Qualitätsinspektion.",
            },
            {
              title: "Verpackung & Versand",
              desc: "Boxen, Etiketten, Barcodes und Kartonage nach Ihrer Spezifikation.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 Stück pro SKU" },
            { label: "Wachse", value: "Soja, Kokos-Soja, Bienenwachs, Paraffin" },
            { label: "Gefäße", value: "Glas, Dose, Keramik, Beton — individuelle Formen" },
            { label: "Duftbeladung", value: "6–12% (IFRA-konform)" },
            { label: "Brenndauer", value: "25–80 Std. je nach Größe" },
            { label: "Lieferzeit", value: "25–30 Tage nach Freigabe" },
          ],
          faqs: [
            {
              q: "Können Sie einen Designer-Kerzenduft nachbilden?",
              a: "Ja — senden Sie eine Referenzkerze und wir replizieren Kalt- und Warmauswurf in 10 Tagen.",
            },
            {
              q: "Übernehmen Sie Brandsicherheitsprüfungen?",
              a: "Wir führen Brenntests durch und liefern SDS gemäß ASTM F2417 (US) oder EN 15493 (EU).",
            },
          ],
          cta: "Beschreiben Sie Ihre Kerzenvision — wir erstellen ein Angebot innerhalb eines Tages.",
        },
        "private-label-diffuser": {
          icon: "wave",
          title: "Private Label Raumdifffusor",
          desc: "Individuelle Schilfdiffusoren in Ihrem Branding — Flasche, Stäbchen, Duft und Box ab 500 Stück.",
          hero: "Schilfdiffusoren sind der einfachste Einstieg in Home Fragrance: keine Flamme, kein Strom, langanhaltender Duft. Wir fertigen komplette Sets unter Ihrer Marke.",
          process: [
            {
              title: "Design-Briefing",
              desc: "Wählen Sie Flaschenform, Stäbchentyp, Duft und Boxstil.",
            },
            {
              title: "Duftabstimmung",
              desc: "Wir entwickeln Ihre Duftölmischung und senden Test-Diffusoren zur Freigabe.",
            },
            {
              title: "Produktion",
              desc: "Präzisionsabfüllung, Stäbcheneinsatz, Versiegelung und Qualitätskontrolle.",
            },
            {
              title: "Verpackung & Lieferung",
              desc: "Retail-Boxen mit Ihrem Design, barcodeversehen und palettiert.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 Stück pro SKU" },
            { label: "Größen", value: "50 ml – 500 ml" },
            { label: "Flaschen", value: "Glas (klar/matt/farbig), Keramik, individuelle Form" },
            { label: "Stäbchen", value: "Rattan, Faser (schwarz/weiß/natur)" },
            { label: "Duftdauer", value: "6–12 Wochen je nach Größe" },
            { label: "Lieferzeit", value: "20–25 Tage" },
          ],
          faqs: [
            {
              q: "Kann ich mein eigenes Flaschendesign verwenden?",
              a: "Ja — senden Sie Ihre 3D-Datei. Wir fertigen die Form ab 3.000 Stück.",
            },
            {
              q: "Welche Duftoptionen gibt es?",
              a: "Wählen Sie aus 50+ Düften oder wir entwickeln einen exklusiven Duft nach Ihrem Briefing.",
            },
          ],
          cta: "Teilen Sie Ihr Diffusor-Konzept — wir senden Muster innerhalb von 7 Tagen.",
        },
        "oem-candle": {
          icon: "flame",
          title: "OEM Kerzenfertigung",
          desc: "Kerzenproduktion in Serie — Ihre oder unsere Formel, mit vollständiger QK und Konformität.",
          hero: "Für Marken, die Fertigungskapazität ohne eigene Fabrik benötigen. Wir produzieren Kerzen nach Ihrer Spezifikation — in Volumina von 2.000 bis 50.000+ Stück/Monat.",
          process: [
            {
              title: "Spezifikationsprüfung",
              desc: "Teilen Sie Ihr Tech Pack. Wir bestätigen Machbarkeit, Kosten und Zeitplan.",
            },
            {
              title: "Pilotcharge",
              desc: "Wir produzieren 100 Stück zur Freigabe vor der Serienfertigung.",
            },
            { title: "Serienproduktion", desc: "Dedizierte Linien mit Inline-QK in jeder Stufe." },
            {
              title: "QK & Logistik",
              desc: "AQL-Inspektion, Kartonverpackung, Containerbeladung mit Fotodokumentation.",
            },
          ],
          specs: [
            { label: "Kapazität", value: "50.000+ Stück/Monat" },
            { label: "MOQ", value: "2.000 Stück pro Bestellung" },
            { label: "Wachse", value: "Soja, Paraffin, Kokos, Bienenwachs, Mischungen" },
            { label: "Qualität", value: "ISO 9001, AQL 2.5 Inspektion" },
            { label: "Konformität", value: "ASTM F2417, EN 15493, CLP, REACH" },
            { label: "Lieferzeit", value: "25–35 Tage je nach Volumen" },
          ],
          faqs: [
            {
              q: "Können Sie nach unserer bestehenden Formel produzieren?",
              a: "Ja — teilen Sie Ihr Tech Pack und wir replizieren exakt. Wir bieten auch Formeloptimierung.",
            },
            {
              q: "Wie hoch ist Ihre Fehlerquote?",
              a: "Wir halten <1,5% mit 100% Sichtprüfung und AQL 2.5 Stichproben bei jeder Charge.",
            },
          ],
          cta: "Senden Sie Ihre Kerzenspezifikation — wir bestätigen Machbarkeit und Preis in 2 Tagen.",
        },
        "oem-essential-oil": {
          icon: "drop",
          title: "OEM Ätherische Öle Lieferung",
          desc: "Ätherische Öle in Bulk mit Private Labeling, individuellen Mischungen und voller Rückverfolgbarkeit.",
          hero: "Beschafffen Sie ätherische Öle zu Fabrikpreisen mit vollständiger Dokumentation. Wir liefern Bulk- und retailverpackte Öle für Kosmetik, Aromatherapie, Lebensmittel und Industrie.",
          process: [
            {
              title: "Anforderungsprüfung",
              desc: "Spezifizieren Sie Öltyp, Grad, Volumen und Anwendung.",
            },
            {
              title: "Muster & Prüfung",
              desc: "Erhalten Sie Muster mit GC-MS-Daten. Verifizieren Sie Chemotyp und Qualität.",
            },
            {
              title: "Bulk-Produktion",
              desc: "Beschaffung von verifizierten Farmen, Destillation, Chargenprüfung.",
            },
            {
              title: "Abfüllung & Docs",
              desc: "Abfüllung (Bulk oder Retail), Etiketten, CoA/MSDS/IFRA inklusive.",
            },
          ],
          specs: [
            { label: "MOQ", value: "500 Stück (Retail) / 25 kg (Bulk)" },
            { label: "Grad", value: "Therapeutisch, kosmetisch, Lebensmittel, Industrie" },
            { label: "Sorten", value: "30+ (Lavendel, Teebaum, Eukalyptus, etc.)" },
            { label: "Dokumentation", value: "GC-MS, CoA, MSDS, IFRA, Allergene" },
            { label: "Verpackung", value: "Fässer, Braunglas, Retail-Boxen" },
            { label: "Lieferzeit", value: "15–25 Tage" },
          ],
          faqs: [
            {
              q: "Liefern Sie bio-zertifizierte Öle?",
              a: "Ja — USDA/EU-bio-zertifizierte Öle von verifizierten Farmen mit lückenloser Rückverfolgbarkeit.",
            },
            {
              q: "Bieten Sie individuelle Mischungen an?",
              a: "Ja — unsere Formulierer erstellen Mischungen für Aromatherapie, Kosmetik oder Haushalt.",
            },
          ],
          cta: "Nennen Sie uns Öle, Grad und Volumen — wir erstellen ein Angebot innerhalb eines Werktags.",
        },
        "custom-packaging": {
          icon: "box",
          title: "Individuelles Verpackungsdesign",
          desc: "Maßgeschneiderte Boxen, Etiketten, Einlagen und Gefäßverpackungen für Ihre Marke und Ihren Markt.",
          hero: "Verpackung verkauft. Unser Designteam erstellt retailfertige Verpackungen, die Ihr Produkt schützen, Marktvorschriften erfüllen und Ihre Marke hervorheben.",
          process: [
            {
              title: "Design-Briefing",
              desc: "Teilen Sie Markenrichtlinien, Zielmarkt und Verpackungsanforderungen.",
            },
            {
              title: "3D-Mockup",
              desc: "Erhalten Sie 2–3 Konzepte mit 3D-Renderings innerhalb von 5 Tagen.",
            },
            {
              title: "Prototyping",
              desc: "Physischer Prototyp mit Ihren Materialien, Veredelungen und Druck.",
            },
            {
              title: "Serienproduktion",
              desc: "Druck, Schnitt, Falzung und Montage in Serie — integriert mit Ihrer Bestellung.",
            },
          ],
          specs: [
            { label: "MOQ", value: "1.000 Stück (integriert mit Produktbestellung)" },
            { label: "Boxtypen", value: "Starr, Faltschachtel, Magnet, Banderole, Tube" },
            { label: "Veredelungen", value: "Matt/Glanz-Laminierung, Folie, Prägung, Spot-UV" },
            { label: "Konformität", value: "CLP-Etiketten, FDA, Barcode, Recyclingsymbole" },
            { label: "Designservice", value: "Kostenlos ab 3.000 Stück" },
            { label: "Lieferzeit", value: "15–20 Tage (nur Verpackung)" },
          ],
          faqs: [
            {
              q: "Designen Sie die Verpackung oder liefere ich die Druckdaten?",
              a: "Beides möglich. Liefern Sie druckfertige Dateien, oder unser Team erstellt alles nach Ihrem Briefing — kostenlos ab 3.000 Stück.",
            },
            {
              q: "Übernehmen Sie EU-CLP-Etikettierung?",
              a: "Ja — wir erstellen konforme Etiketten mit Gefahrenpiktogrammen, Allergenlisten, UFI-Codes und regulatorischem Text.",
            },
          ],
          cta: "Teilen Sie Ihr Verpackungsbriefing — wir schlagen 2–3 Konzepte innerhalb von 5 Tagen vor.",
        },
        "custom-fragrance": {
          icon: "sparkle",
          title: "Individuelle Duftentwicklung",
          desc: "Exklusive Duftkreation durch unsere Parfümeure — vom Briefing zur produktionsreifen Formel in 14 Tagen.",
          hero: "Ihr Signature-Duft ist die unsichtbare Identität Ihrer Marke. Unsere Parfümeure entwickeln einzigartige Duftprofile nach Ihrem Briefing, Moodboard oder Referenzmuster — exklusiv für Ihre Marke.",
          process: [
            {
              title: "Duft-Briefing",
              desc: "Beschreiben Sie Ihre Vision: Stimmung, Noten, Referenzen, Produkt und Zielpreis.",
            },
            {
              title: "Parfümeur-Entwicklung",
              desc: "Unsere Parfümeure erstellen 3–5 Akkorde innerhalb von 10 Tagen.",
            },
            {
              title: "Verfeinerung",
              desc: "Iterieren Sie — passen Sie Kopf-/Herz-/Basisnoten an bis zur Perfektion.",
            },
            {
              title: "Produktionsformel",
              desc: "IFRA-konforme Formel finalisieren, Stabilitätstest, Skalierung.",
            },
          ],
          specs: [
            { label: "Entwicklungszeit", value: "14 Tage (Briefing bis freigegebene Formel)" },
            { label: "Konzepte", value: "3–5 Duftrichtungen" },
            { label: "Konformität", value: "IFRA 51. Änderung, EU-Allergene, CLP" },
            { label: "Anwendungen", value: "Kerzen, Diffusoren, Sprays, Kosmetik, Textilien" },
            { label: "Exklusivität", value: "Ihre Formel wird nie weiterverkauft (NDA)" },
            { label: "Kosten", value: "Entwicklung kostenlos ab 2.000 Stück" },
          ],
          faqs: [
            {
              q: "Können Sie einen Designer-Duft nachbilden?",
              a: "Ja — senden Sie ein Referenzmuster und wir entwickeln eine Annäherung (nicht identisch, IP-respektierend) in 10 Tagen.",
            },
            {
              q: "Wem gehört die individuelle Formel?",
              a: "Ihnen. Individuelle Formeln sind Ihr geistiges Eigentum, abgesichert durch gegenseitige NDA.",
            },
          ],
          cta: "Beschreiben Sie Ihren Traumduft — unsere Parfümeure entwickeln Muster in 10 Tagen.",
        },
        "custom-bottle": {
          icon: "drop",
          title: "Individuelle Flasche & Gefäß",
          desc: "Maßgeschneiderte Glas-, Keramik- und Metallgefäße — individuelle Formen, Veredelungen und Volumina.",
          hero: "Das Gefäß IST das Produkt für viele Käufer. Wir fertigen einzigartige Flaschen, Dosen und Keramikgefäße, die Ihr Produkt sofort erkennbar und unkopierbar machen.",
          process: [
            {
              title: "Design-Briefing",
              desc: "Teilen Sie Skizzen, Referenzen oder 3D-Dateien. Definieren Sie Material, Volumen und Finish.",
            },
            {
              title: "3D-Rendering",
              desc: "Erhalten Sie fotorealistische Renderings und Maßzeichnungen in 5 Tagen.",
            },
            {
              title: "Form & Muster",
              desc: "Formschnitt, 5–10 physische Muster zur Freigabe (15–20 Tage).",
            },
            {
              title: "Serienproduktion",
              desc: "Produktion in Serie mit Ihrem Finish — integriert mit Ihrer Abfüllbestellung.",
            },
          ],
          specs: [
            { label: "MOQ", value: "3.000 Stück (individuelle Form) / 500 (Lagerformen)" },
            { label: "Materialien", value: "Glas, Keramik, Dose, Beton, Holzdeckel" },
            { label: "Veredelungen", value: "Mattiert, farbig, galvanisiert, Decal, Siebdruck" },
            { label: "Formkosten", value: "USD 500–2.000 (erstattbar bei Folgeaufträgen)" },
            { label: "Volumen", value: "5 ml – 500 ml" },
            { label: "Lieferzeit", value: "30–40 Tage (inkl. Form)" },
          ],
          faqs: [
            {
              q: "Kann ich ein physisches Muster vor der Entscheidung sehen?",
              a: "Ja — wir produzieren 5–10 Muster nach dem Formschnitt. Sie geben vor der Serienproduktion frei.",
            },
            {
              q: "Sind die Formkosten erstattbar?",
              a: "Ja — Formkosten werden erstattet, wenn kumulierte Bestellungen 10.000 Stück überschreiten.",
            },
          ],
          cta: "Teilen Sie Ihr Gefäßkonzept — wir rendern es in 3D innerhalb von 5 Tagen, kostenlos.",
        },
      },
    },
    factoryPages: {
      eyebrow: "Einblick in Unsere Fabrik",
      title: "Fabrik-Kapazitäten",
      subtitle:
        "Erkunden Sie unsere Anlage im Detail — von Qualitätskontrolle bis Produktionskapazität.",
      items: {
        "quality-control": {
          icon: "check",
          title: "Qualitätskontrolle",
          desc: "Mehrstufiges QK-System, das sicherstellt, dass jede Einheit internationale Standards vor dem Versand erfüllt.",
          hero: "Qualität ist keine Abteilung — sie ist in jeden Schritt eingebettet. Von der Rohstoffprüfung bis zur AQL-Stichprobe sorgt unser 12-köpfiges QK-Team für fehlerfreie Lieferung.",
          highlights: [
            {
              title: "Eingangswareprüfung",
              desc: "Jede Rohstoffcharge wird auf Reinheit, Feuchtigkeit und Konformität geprüft.",
            },
            {
              title: "Inline-QK",
              desc: "Bediener führen an jeder Station visuelle und dimensionale Prüfungen durch.",
            },
            {
              title: "AQL 2.5 Endprüfung",
              desc: "Zufallsstichprobe nach ISO 2859 vor der Verpackung. Foto- und Videoreports.",
            },
            {
              title: "Laborverifizierung",
              desc: "Flammpunkt-, Duftbeladungs- und Brenndauertests bei jeder Produktionscharge.",
            },
            {
              title: "Rückverfolgbarkeit",
              desc: "Chargencodes verknüpfen jede Einheit mit Rohstofflos, Datum und Prüfer.",
            },
            {
              title: "Externe Audits",
              desc: "Wir begrüßen SGS, Bureau Veritas oder vom Kunden nominierte Inspektoren.",
            },
          ],
          stats: [
            { num: "12", label: "QK-Spezialisten" },
            { num: "<1,5%", label: "Fehlerquote" },
            { num: "100%", label: "Rückverfolgbarkeit" },
            { num: "AQL 2.5", label: "Prüfstandard" },
          ],
          faqs: [
            {
              q: "Kann ich meinen eigenen Inspektor senden?",
              a: "Selbstverständlich — wir koordinieren die Terminplanung und gewähren vollen Zugang.",
            },
            {
              q: "Was passiert bei gefundenen Mängeln?",
              a: "Jede Charge, die AQL nicht besteht, wird quarantäniert, nachgearbeitet oder auf unsere Kosten ersetzt.",
            },
          ],
          cta: "Fordern Sie unser vollständiges QK-Protokoll an — wir senden es innerhalb eines Werktags.",
        },
        laboratory: {
          icon: "drop",
          title: "Labor & F&E",
          desc: "Hauseigenes Labor für Duftentwicklung, Stabilitätstests und analytische Verifizierung.",
          hero: "Unser 200 m² großes Labor beherbergt GC-MS-Geräte, Stabilitätskammern und eine Parfümeriebank. Jede Formel wird stresstestet, bevor sie in die Produktion geht.",
          highlights: [
            {
              title: "GC-MS-Analyse",
              desc: "Gaschromatographie verifiziert Ölreinheit, erkennt Verfälschung und bestätigt Chemotyp.",
            },
            {
              title: "Duftentwicklung",
              desc: "3 Senior-Parfümeure entwickeln 20+ neue Düfte monatlich.",
            },
            {
              title: "Stabilitätstests",
              desc: "Beschleunigte Alterung (40°C/75%RF für 90 Tage) sichert Leistung über die Haltbarkeit.",
            },
            {
              title: "Flammpunkt & Sicherheit",
              desc: "Jede Kerzen- und Ölformel wird auf Flammpunkt für Transport- und Nutzungssicherheit getestet.",
            },
            {
              title: "Kompatibilitätstests",
              desc: "Duft-Gefäß-Interaktionstests verhindern Verfärbung, Rissbildung oder Duftabsorption.",
            },
            {
              title: "Regulatorische Konformität",
              desc: "IFRA-, REACH-, CLP- und FDA-Prüfungen in jedem Entwicklungszyklus integriert.",
            },
          ],
          stats: [
            { num: "200 m²", label: "Laborfläche" },
            { num: "3", label: "Senior-Parfümeure" },
            { num: "GC-MS", label: "Analytik" },
            { num: "20+", label: "Neue Düfte/Monat" },
          ],
          faqs: [
            {
              q: "Können Sie eine individuelle Formel entwickeln?",
              a: "Ja — teilen Sie Ihr Briefing und wir erstellen 3–5 Optionen in 10 Tagen, kostenlos ab 2.000 Stück.",
            },
            {
              q: "Liefern Sie Stabilitätstestberichte?",
              a: "Ja — jede Formel enthält beschleunigte Stabilitätsdaten und empfohlene Haltbarkeit.",
            },
          ],
          cta: "Beschreiben Sie Ihre Formulierungsherausforderung — unser Laborteam schlägt eine Lösung vor.",
        },
        "raw-material": {
          icon: "leaf",
          title: "Rohstoffbeschaffung",
          desc: "Verifizierte Farmen, Destillerien und Lieferanten mit lückenloser Chain-of-Custody-Dokumentation.",
          hero: "Großartige Produkte beginnen mit großartigen Rohstoffen. Wir beschaffen Öle von verifizierten Farmen in 6 Ländern, Wachs von zertifizierten Raffinerien und Gefäße von auditierten Glaswerken.",
          highlights: [
            {
              title: "Verifiziertes Farmnetzwerk",
              desc: "Lavendel aus der Provence, Teebaum aus Australien, Eukalyptus aus Yunnan — direkte Beziehungen seit 2013.",
            },
            {
              title: "Wachszertifizierung",
              desc: "Sojawachs aus nicht-GVO-zertifizierten Quellen; Paraffin von vollraffinierten Lieferanten.",
            },
            {
              title: "Glas- & Gefäßaudits",
              desc: "Jedes Glaswerk wird auf Blei/Cadmium, Thermoschock und Maßhaltigkeit auditiert.",
            },
            {
              title: "Duftöl-Partner",
              desc: "Wir arbeiten mit Lieferanten auf Givaudan-, Firmenich- und IFF-Niveau.",
            },
            {
              title: "Eingangs-QK",
              desc: "Jede Lieferung wird bei Ankunft geprüft: Sichtkontrolle, Gewichtsverifizierung, Laborstichprobe.",
            },
            {
              title: "Chain of Custody",
              desc: "Lückenlose Dokumentation von der Farm bis zum Fertigprodukt.",
            },
          ],
          stats: [
            { num: "6", label: "Herkunftsländer" },
            { num: "40+", label: "Verifizierte Lieferanten" },
            { num: "100%", label: "CoA-Abdeckung" },
            { num: "2013", label: "Beschaffung seit" },
          ],
          faqs: [
            {
              q: "Können Sie bio-zertifizierte Materialien beschaffen?",
              a: "Ja — wir unterhalten USDA- und EU-Bio-Lieferketten mit lückenloser Dokumentation.",
            },
            {
              q: "Teilen Sie Lieferanten-Auditberichte?",
              a: "Unter NDA ja. Wir stellen relevante Audit-Zusammenfassungen und Zertifikate bereit.",
            },
          ],
          cta: "Fragen Sie nach unserer Rohstoffbeschaffung für Ihre spezifischen Produktanforderungen.",
        },
        warehouse: {
          icon: "box",
          title: "Lager & Logistik",
          desc: "8.000 m² klimatisiertes Lager mit konsolidiertem Versand in 30+ Länder.",
          hero: "Von klimatisierter Lagerung bis zur Containerbeladung sorgt unser Logistikteam dafür, dass Ihre Produkte intakt und pünktlich ankommen.",
          highlights: [
            {
              title: "Klimatisierte Lagerung",
              desc: "Temperatur und Luftfeuchtigkeit 24/7 überwacht — kritisch für Kerzen, Öle und Duftstabilität.",
            },
            {
              title: "Bestandsverwaltung",
              desc: "WMS-System verfolgt jede Palette in Echtzeit. Bestandseinblick auf Anfrage.",
            },
            {
              title: "Konsolidierter Versand",
              desc: "Produkte mehrerer Linien in einem Container kombinieren — Frachtkosten pro Stück senken.",
            },
            {
              title: "Exportdokumentation",
              desc: "Handelsrechnungen, Packlisten, CoO, Begasungszertifikate und Zollanmeldungen.",
            },
            {
              title: "Containerbeladung",
              desc: "Professionelle Beladung mit Staumaterial, Verzurrung und Fotodokumentation.",
            },
            {
              title: "Sicherheitsbestand",
              desc: "Wir halten vereinbarten Sicherheitsbestand für Stammkunden — 2-Wochen-Versand.",
            },
          ],
          stats: [
            { num: "8.000 m²", label: "Lagerfläche" },
            { num: "30+", label: "Exportländer" },
            { num: "24/7", label: "Klimaüberwachung" },
            { num: "2 Wochen", label: "Nachbestellversand" },
          ],
          faqs: [
            {
              q: "Können Sie an Amazon FBA-Lager liefern?",
              a: "Ja — wir etikettieren, verpacken und versenden direkt an FBA mit Karton-Compliance.",
            },
            {
              q: "Bieten Sie DDP-Versand an?",
              a: "Ja — wir bieten DDP zu wichtigen Zielen einschließlich US, EU, UK und Australien.",
            },
          ],
          cta: "Nennen Sie uns Ziel und Volumen — wir schlagen die optimale Versandlösung vor.",
        },
        "production-capacity": {
          icon: "clock",
          title: "Produktionskapazität",
          desc: "50.000+ Einheiten pro Monat über Kerzen-, Diffusor- und Ölabfülllinien.",
          hero: "Skalieren ohne Kompromisse. Unsere 4 Produktionslinien bewältigen alles von 500-Stück-Pilotserien bis zu vollen Containerbestellungen.",
          highlights: [
            {
              title: "Kerzenlinie",
              desc: "Automatisiertes Gießen, Dochten und Aushärten — 20.000 Kerzen/Monat.",
            },
            {
              title: "Diffusorlinie",
              desc: "Präzisionsabfüllung und Montage — 15.000 Diffusoren/Monat.",
            },
            {
              title: "Ölabfülllinie",
              desc: "Stickstoffgespülte Abfüllung von 5 ml bis 500 ml — 25.000 Flaschen/Monat.",
            },
            {
              title: "Verpackungslinie",
              desc: "Boxmontage, Etikettierung, Schrumpffolie und Kartonierung — integriert.",
            },
            {
              title: "Flexible Planung",
              desc: "Pilotserien ab 500 Stück ohne Störung der Serienproduktion.",
            },
            {
              title: "Saisonale Spitze",
              desc: "Wir skalieren auf 80.000 Stück/Monat für Q4 mit temporären Linien.",
            },
          ],
          stats: [
            { num: "50.000+", label: "Stück / Monat" },
            { num: "4", label: "Produktionslinien" },
            { num: "500", label: "Min. Pilotserie" },
            { num: "80.000", label: "Spitzenkapazität (Q4)" },
          ],
          faqs: [
            {
              q: "Wie lang ist die Lieferzeit für einen vollen Container?",
              a: "25–35 Tage je nach Produktmix und Individualisierung. Pilotserien in 15–20 Tagen.",
            },
            {
              q: "Können Sie saisonale Volumenspitzen bewältigen?",
              a: "Ja — wir planen Q4-Kapazität 3 Monate voraus. Spitze: 80.000 Stück/Monat.",
            },
          ],
          cta: "Teilen Sie Ihre Volumenprognose — wir bestätigen Kapazität und reservieren Slots.",
        },
        certificates: {
          icon: "file",
          title: "Zertifikate & Konformität",
          desc: "ISO 9001, IFRA, REACH, CLP, FDA — volle Konformität für US-, EU- und globale Märkte.",
          hero: "Konformität ist keine Option — sie ist Ihr Marktzugang. Wir unterhalten alle wichtigen Zertifizierungen intern und erstellen marktspezifische Dokumentation für jeden Versand.",
          highlights: [
            {
              title: "ISO 9001:2015",
              desc: "Qualitätsmanagementsystem zertifiziert und jährlich von SGS auditiert.",
            },
            {
              title: "IFRA-Konformität",
              desc: "Jede Duftformel gegen IFRA 51. Änderung verifiziert.",
            },
            {
              title: "REACH & CLP",
              desc: "Vollständige EU-Chemikalienkonformität mit registrierten Stoffen.",
            },
            {
              title: "FDA-Registrierung",
              desc: "Anlage bei FDA registriert für Kosmetik- und Haushaltsexport in die USA.",
            },
            {
              title: "MSDS / SDS",
              desc: "Sicherheitsdatenblätter im GHS-Format für jedes Produkt in Zielsprache.",
            },
            {
              title: "Brandsicherheit",
              desc: "Kerzen geprüft nach ASTM F2417 (US) und EN 15493 (EU).",
            },
          ],
          stats: [
            { num: "ISO 9001", label: "Qualitätssystem" },
            { num: "IFRA 51.", label: "Duftstandard" },
            { num: "REACH", label: "EU-Chemiekonformität" },
            { num: "FDA", label: "US-Registrierung" },
          ],
          faqs: [
            {
              q: "Können Sie Zertifikate für unseren spezifischen Markt bereitstellen?",
              a: "Ja — nennen Sie uns Ihr Zielland und wir bereiten alle erforderlichen Dokumente vor.",
            },
            {
              q: "Aktualisieren Sie Zertifikate bei Regulierungsänderungen?",
              a: "Ja — unser Compliance-Team überwacht Änderungen und aktualisiert proaktiv.",
            },
          ],
          cta: "Fordern Sie unser vollständiges Konformitätspaket an — wir senden relevante Zertifikate.",
        },
      },
    },
    countryPages: {
      eyebrow: "Exportmärkte",
      title: "Export in Ihr Land",
      subtitle:
        "Marktspezifische Konformität, Versand und Produktempfehlungen für den Import von Aromaprodukten aus China.",
      nav_label: "Exportmärkte",
      items: {
        usa: {
          icon: "globe",
          title: "Export in die USA",
          desc: "FDA-registrierte, ASTM-geprüfte Aromaprodukte für die USA mit vollständiger Dokumentation.",
          hero: "Wir haben tausende SKUs in die USA geliefert — Kerzen, ätherische Öle, Diffusoren und Home Fragrance. FDA-Registrierung, ASTM-Prüfungen, California Prop 65 und FBA-Verpackung sind Standard.",
          stats: [
            { num: "FDA", label: "Anlage Registriert" },
            { num: "ASTM", label: "Brandsicherheit" },
            { num: "15–20", label: "Tage Seefracht" },
            { num: "DDP", label: "Versand Verfügbar" },
          ],
          regulations: [
            {
              title: "FDA-Registrierung",
              desc: "Anlage bei FDA registriert für Kosmetik und Haushaltsprodukte.",
            },
            {
              title: "ASTM F2417 / F2601",
              desc: "Alle Kerzen nach ASTM-Brandsicherheitsstandards geprüft.",
            },
            {
              title: "California Prop 65",
              desc: "Produkte auf Prop-65-Chemikalien getestet. Warnetiketten wo erforderlich.",
            },
            { title: "TSCA", desc: "Duftstoffe gegen EPA TSCA-Inventar verifiziert." },
            { title: "CPSC", desc: "Kerzenetikettierung erfüllt CPSC-Anforderungen." },
            {
              title: "FBA / Amazon",
              desc: "FNSKU-Etiketten, Polybeutel-Warnungen, Hazmat-Dokumentation und direkte FBA-Lieferung.",
            },
          ],
          products: [
            {
              title: "Sojawachs-Kerzen",
              desc: "Private-Label-Kerzen in Gläsern und Dosen — die #1 Importkategorie für US-Marken.",
            },
            {
              title: "Ätherische Öl-Sets",
              desc: "Multi-Pack-Geschenksets (6×10 ml) optimiert für Amazon A+ und US-Geschenksaisons.",
            },
            {
              title: "Schilfdiffusoren",
              desc: "Elegante Glasdiffusoren — starke Margen für US-Boutiquen.",
            },
          ],
          shipping: [
            {
              title: "Seefracht (FCL/LCL)",
              desc: "15–20 Tage (Ningbo → LA/NY). Wir übernehmen Zollabwicklung und letzte Meile.",
            },
            {
              title: "Luftfracht Express",
              desc: "5–7 Tage für Muster und dringende Nachbestellungen. DHL/FedEx/UPS mit Hazmat-Docs.",
            },
            {
              title: "DDP-Service",
              desc: "Tür-zu-Tür-Lieferung inklusive aller Zölle und Steuern.",
            },
            {
              title: "FBA Direkt",
              desc: "Wir etikettieren, verpacken und versenden direkt an Ihr FBA-Lager.",
            },
          ],
          faqs: [
            {
              q: "Übernehmen Sie die US-Zollabwicklung?",
              a: "Ja — wir stellen alle Dokumente bereit und können Zollabwicklung arrangieren.",
            },
            {
              q: "Sind Ihre Kerzen Prop-65-konform?",
              a: "Ja — wir testen auf alle Prop-65-Chemikalien und bringen Warnetiketten an.",
            },
          ],
          cta: "Bereit für den US-Import? Teilen Sie Ihre Produktliste und wir erstellen ein konformes Angebot.",
        },
        germany: {
          icon: "globe",
          title: "Export nach Deutschland",
          desc: "REACH- und CLP-konforme Aromaprodukte für den deutschen Markt mit vollständiger EU-Dokumentation.",
          hero: "Deutschland ist Europas größter Home-Fragrance-Markt. Wir liefern REACH-registrierte, CLP-etikettierte Produkte mit deutscher Sicherheitsdokumentation.",
          stats: [
            { num: "REACH", label: "Registrierte Stoffe" },
            { num: "CLP", label: "Konforme Etiketten" },
            { num: "25–30", label: "Tage Seefracht" },
            { num: "EU", label: "Konformitätsdocs" },
          ],
          regulations: [
            {
              title: "REACH-Registrierung",
              desc: "Alle Duftstoffe gegen REACH-Registrierungsliste verifiziert.",
            },
            {
              title: "CLP-Etikettierung",
              desc: "Deutsche CLP-Etiketten mit Gefahrenpiktogrammen, Signalwörtern und UFI-Codes.",
            },
            {
              title: "EU-Kosmetikverordnung",
              desc: "Hautkontaktprodukte konform mit EG 1223/2009 mit PIF-Dokumentation.",
            },
            {
              title: "GPSR (2024)",
              desc: "Allgemeine Produktsicherheitsverordnung mit EU-verantwortlicher Person.",
            },
            {
              title: "VerpackG / LUCID",
              desc: "Verpackung bei Zentrale Stelle Verpackungsregister registriert.",
            },
            {
              title: "Deutsche Etikettierung",
              desc: "Alle Etiketten, Warnungen und Anleitungen auf Deutsch verfügbar.",
            },
          ],
          products: [
            {
              title: "CLP-etikettierte Kerzen",
              desc: "Soja- und Paraffinkerzen mit deutschen CLP-Etiketten — bereit für den Verkauf.",
            },
            {
              title: "Ätherische Öle (Kosmetik)",
              desc: "Öle mit vollständiger EU-Kosmetikkonformität: CPNP, Allergene, deutsches SDS.",
            },
            {
              title: "Diffusor-Sets",
              desc: "CLP-konforme Diffusoren mit UFI-Codes — am schnellsten wachsende Kategorie.",
            },
          ],
          shipping: [
            {
              title: "Seefracht",
              desc: "25–30 Tage (Ningbo → Hamburg). Vollständige EU-Zolldokumentation.",
            },
            {
              title: "Schienenfracht",
              desc: "18–22 Tage via China-Europa-Eisenbahn (Yiwu → Duisburg). Kosteneffizient.",
            },
            {
              title: "EU-Zollabwicklung",
              desc: "Wir bereiten alle Importdokumente vor: Rechnung, Packliste, CoO, REACH/CLP.",
            },
            {
              title: "DDP nach Deutschland",
              desc: "Tür-zu-Tür inklusive EU-Zölle (6,5% Kerzen) und 19% MwSt.",
            },
          ],
          faqs: [
            {
              q: "Liefern Sie deutsches SDS?",
              a: "Ja — Sicherheitsdatenblätter auf Deutsch im CLP/GHS-Format mit allen 16 Abschnitten.",
            },
            {
              q: "Können Sie die EU-Zollabwicklung übernehmen?",
              a: "Wir bereiten alle Dokumente vor. Für die Abwicklung arbeiten wir mit Ihrem Zollagenten.",
            },
          ],
          cta: "Nennen Sie Ihre Anforderungen für den deutschen Markt — wir erstellen ein REACH/CLP-Angebot.",
        },
        france: {
          icon: "globe",
          title: "Export nach Frankreich",
          desc: "EU-konforme Aromaprodukte mit französischer Dokumentation für den französischen Markt.",
          hero: "Frankreichs Duft-Erbe macht es zu einem anspruchsvollen Markt. Wir liefern IFRA-konforme Produkte mit französischer CLP-Etikettierung und der Qualität, die französische Einkäufer erwarten.",
          stats: [
            { num: "IFRA", label: "51. Änderung" },
            { num: "CLP", label: "Französische Etiketten" },
            { num: "25–30", label: "Tage Seefracht" },
            { num: "EU", label: "Volle Konformität" },
          ],
          regulations: [
            {
              title: "REACH & CLP",
              desc: "Vollständige EU-Chemiekonformität mit französischen Gefahrenetiketten und UFI-Codes.",
            },
            {
              title: "IFRA-Standards",
              desc: "Jede Duftformel gegen IFRA 51. Änderung verifiziert — kritisch für Frankreich.",
            },
            {
              title: "EU-Kosmetik (EG 1223/2009)",
              desc: "Hautkontaktprodukte mit CPNP-Unterstützung und französischen INCI-Listen.",
            },
            {
              title: "AGEC-Gesetz",
              desc: "Anti-Abfall-Gesetz: Recycelbarkeitskennzeichnung, Triman-Logo.",
            },
            {
              title: "Französische Etikettierung",
              desc: "Alle Etiketten und Warnungen auf Französisch mit muttersprachlichen Übersetzern.",
            },
            { title: "DGCCRF", desc: "Produkte erfüllen französische Verbraucherschutzstandards." },
          ],
          products: [
            {
              title: "Premium-Duftkerzen",
              desc: "Sojakerzen mit hoher Duftbeladung und anspruchsvollen Profilen.",
            },
            {
              title: "Parfümerie-Öle",
              desc: "Öle mit vollständiger IFRA-Dokumentation — für französische Kosmetik- und Parfümeriekunden.",
            },
            {
              title: "Luxus-Diffusoren",
              desc: "Elegante Glasdiffusoren mit Premium-Verpackung für französische Boutiquen.",
            },
          ],
          shipping: [
            {
              title: "Seefracht",
              desc: "25–30 Tage (Ningbo → Le Havre/Marseille). Vollständige EU-Zolldokumentation.",
            },
            {
              title: "Schienenfracht",
              desc: "18–22 Tage via China-Europa-Eisenbahn. Wettbewerbsfähig für mittlere Volumina.",
            },
            {
              title: "EU-Zoll & Inland",
              desc: "Wir erstellen Dokumente; Zollabwicklung über Ihren Agenten. Inlandlieferung.",
            },
            { title: "DDP nach Frankreich", desc: "Tür-zu-Tür inklusive EU-Zölle und 20% TVA." },
          ],
          faqs: [
            {
              q: "Liefern Sie französische Dokumentation?",
              a: "Oui — CLP-Etiketten, SDS, Allergenerklärungen und Anleitungen auf Französisch.",
            },
            {
              q: "Können Sie Grasse-inspirierte Düfte entwickeln?",
              a: "Ja — unsere Parfümeure erstellen anspruchsvolle Kompositionen im französischen Stil.",
            },
          ],
          cta: "Teilen Sie Ihre Anforderungen für den französischen Markt — wir erstellen ein EU-konformes Angebot.",
        },
        spain: {
          icon: "globe",
          title: "Export nach Spanien",
          desc: "EU-konforme Aromaprodukte mit spanischer Dokumentation für den iberischen Markt.",
          hero: "Spaniens wachsender Home-Fragrance-Markt und starker Retail-Sektor machen es zum idealen Einstieg nach Südeuropa. Wir liefern CLP-konforme Produkte mit spanischer Etikettierung und flexiblen MOQs.",
          stats: [
            { num: "CLP", label: "Spanische Etiketten" },
            { num: "REACH", label: "EU-Konform" },
            { num: "25–30", label: "Tage Seefracht" },
            { num: "EU", label: "Volle Dokumentation" },
          ],
          regulations: [
            {
              title: "REACH & CLP",
              desc: "Vollständige EU-Konformität mit spanischen Gefahrenetiketten und UFI-Codes.",
            },
            {
              title: "EU-Kosmetikverordnung",
              desc: "Hautkontaktprodukte konform mit EG 1223/2009. CPNP-Unterstützung inklusive.",
            },
            {
              title: "Spanische Etikettierung (RD 1801)",
              desc: "Etiketten erfüllen spanische Verbraucherinformationsanforderungen.",
            },
            {
              title: "Verpackungsabfall (Ley 7/2022)",
              desc: "Konformität mit spanischem Verpackungsabfallgesetz.",
            },
            {
              title: "IFRA",
              desc: "Alle Düfte gegen IFRA-Standards für sichere Verwendung verifiziert.",
            },
            {
              title: "AEMPS",
              desc: "Kosmetikprodukte bei spanischer Gesundheitsbehörde notifiziert.",
            },
          ],
          products: [
            {
              title: "Duftkerzen",
              desc: "Soja- und Paraffinkerzen mit spanischen CLP-Etiketten — starke Nachfrage in Retail und Gastronomie.",
            },
            {
              title: "Schilfdiffusoren",
              desc: "Mediterrane Duftprofile (Zitrus, Meeresbrise, Orangenblüte) für den spanischen Markt.",
            },
            {
              title: "Ätherische Öle",
              desc: "Reine Öle mit spanischem SDS — für Kosmetik und Aromatherapie.",
            },
          ],
          shipping: [
            {
              title: "Seefracht",
              desc: "25–30 Tage (Ningbo → Barcelona/Valencia). Vollständige EU-Zolldokumentation.",
            },
            {
              title: "Schiene + Straße",
              desc: "Kombinierter Schienenverkehr nach Madrid mit Straßenlieferung. 20–25 Tage.",
            },
            {
              title: "EU-Zollabwicklung",
              desc: "Vollständiges Dokumentenpaket für Ihren Zollagenten.",
            },
            { title: "DDP nach Spanien", desc: "Tür-zu-Tür inklusive EU-Zölle und 21% IVA." },
          ],
          faqs: [
            {
              q: "Liefern Sie spanische Etiketten?",
              a: "Sí — CLP-Etiketten, SDS, Allergenlisten und Anleitungen auf Kastilisch.",
            },
            {
              q: "Wie hoch sind die Importzölle?",
              a: "EU-Gemeinsamer Zolltarif: 0% ätherische Öle, 6,5% Kerzen, 3% Glas. Wir liefern HS-Codes.",
            },
          ],
          cta: "Teilen Sie Ihre Anforderungen für den spanischen Markt — wir erstellen ein EU-konformes Angebot.",
        },
        canada: {
          icon: "globe",
          title: "Export nach Kanada",
          desc: "Health Canada und CCPSA konforme Aromaprodukte für den kanadischen Markt.",
          hero: "Kanadas zweisprachige Anforderungen und einzigartiger Regulierungsrahmen (CCPSA, CCCR) erfordern spezifische Konformität. Wir übernehmen englische und französische Etikettierung.",
          stats: [
            { num: "CCPSA", label: "Produktsicherheit" },
            { num: "Zweisprachig", label: "EN + FR Etiketten" },
            { num: "18–22", label: "Tage Seefracht" },
            { num: "DDP", label: "Versand Verfügbar" },
          ],
          regulations: [
            {
              title: "CCPSA",
              desc: "Canada Consumer Product Safety Act — Produkte erfüllen kanadische Sicherheitsanforderungen.",
            },
            {
              title: "Zweisprachige Etiketten (EN/FR)",
              desc: "Alle Etiketten, Warnungen und Anleitungen auf Englisch und Französisch.",
            },
            {
              title: "CCCR",
              desc: "Kerzen und Öle konform mit Consumer Chemicals and Containers Regulations.",
            },
            {
              title: "Natürliche Gesundheitsprodukte",
              desc: "Öle für therapeutische Nutzung erfordern NHP-Notifizierung — wir liefern Dokumentation.",
            },
            {
              title: "CEPA",
              desc: "Duftstoffe gegen kanadische Domestic Substances List verifiziert.",
            },
            {
              title: "Wettbewerbsgesetz",
              desc: "Nettomenge, Händleridentität und Herkunftsland nach kanadischen Vorschriften.",
            },
          ],
          products: [
            {
              title: "Zweisprachige Kerzen",
              desc: "Sojakerzen mit EN/FR-Sicherheitsetiketten — konform mit CCPSA und CCCR.",
            },
            {
              title: "Ätherische Öl-Sammlungen",
              desc: "Reine Öle mit zweisprachiger Dokumentation — für kanadische Aromatherapie-Retailer.",
            },
            {
              title: "Schilfdiffusoren",
              desc: "Elegante Diffusoren mit zweisprachigen Etiketten — wachsende Kategorie in Kanada.",
            },
          ],
          shipping: [
            {
              title: "Seefracht",
              desc: "18–22 Tage (Ningbo → Vancouver) oder 25–30 Tage nach Toronto/Montreal.",
            },
            {
              title: "Luftfracht Express",
              desc: "4–6 Tage für Muster und dringende Bestellungen. Vollständige Hazmat-Dokumentation.",
            },
            {
              title: "Kanadischer Zoll",
              desc: "Wir erstellen alle Dokumente: Rechnung, Packliste, CoO, SDS, HS-Codes.",
            },
            {
              title: "DDP nach Kanada",
              desc: "Tür-zu-Tür inklusive kanadischer Zölle (6,5% Kerzen, 0% Öle) und GST/HST.",
            },
          ],
          faqs: [
            {
              q: "Liefern Sie zweisprachige Etiketten (EN/FR)?",
              a: "Ja — alle Etiketten, Warnungen und Anleitungen auf Englisch und Französisch nach kanadischen Anforderungen.",
            },
            {
              q: "Wie hoch sind kanadische Importzölle?",
              a: "Ätherische Öle: 0%. Kerzen: 6,5%. Glasdiffusoren: 8%. Wir liefern korrekte HS-Codes.",
            },
          ],
          cta: "Bereit für den Kanada-Import? Teilen Sie Ihre Produktliste und wir erstellen ein zweisprachiges, konformes Angebot.",
        },
      },
    },
    comparePages: {
      eyebrow: "Produktvergleiche",
      title: "Produktvergleichs-Ratgeber",
      subtitle:
        "Seite-an-Seite-Vergleiche für die richtige Material- und Produktauswahl für Ihre Marke.",
      nav_label: "Vergleiche",
      items: {
        "soy-vs-paraffin": {
          title: "Sojawachs vs Paraffin",
          desc: "Detaillierter Vergleich von Soja- und Paraffinkerzenwachs — Brenndauer, Duft, Kosten, Nachhaltigkeit.",
          optionA: "Sojawachs",
          optionB: "Paraffin",
          intro:
            "Die Wahl zwischen Soja und Paraffin ist eine der ersten Entscheidungen für jede Kerzenmarke. Jedes hat distincte Vorteile je nach Positionierung.",
          rows: [
            {
              criterion: "Herkunft",
              a: "Natürlich — hydriertes Sojaöl (erneuerbar)",
              b: "Erdöl — Nebenprodukt der Rohölraffination",
            },
            {
              criterion: "Brenndauer",
              a: "30–50% länger (langsamer, kühler)",
              b: "Standard-Brennrate",
            },
            {
              criterion: "Duft",
              a: "Guter Kaltauswurf; moderater Warmauswurf",
              b: "Exzellenter Warmauswurf (höherer Schmelzpunkt)",
            },
            {
              criterion: "Ruß",
              a: "Minimal — sauberere Verbrennung",
              b: "Mehr Ruß bei schlechter Dochtwahl",
            },
            { criterion: "Kosten", a: "2–3× teurer pro kg", b: "Günstigste Wachs-Option" },
            {
              criterion: "Nachhaltigkeit",
              a: "Biologisch abbaubar, erneuerbar, Eco-Marketing",
              b: "Nicht-erneuerbares Erdölprodukt",
            },
            {
              criterion: "Optik",
              a: "Cremig, opak; neigt zu Frosting",
              b: "Glatt, transluzent; nimmt Farbe lebhaft an",
            },
            {
              criterion: "Wahrnehmung",
              a: "Premium, eco-bewusst, natürlich",
              b: "Traditionell, Massenmarkt, Wert",
            },
            {
              criterion: "Ideal Für",
              a: "Boutique-Marken, Eco-Konsumenten, Premium-Retail",
              b: "Volumenmarken, lebhafte Farben, starker Duft",
            },
          ],
          verdict:
            "Soja für Premium-Eco-Marken. Paraffin für Volumen und lebhafte Farben. Viele erfolgreiche Marken bieten beides — Soja als Hero-Linie, Paraffin als Value-Range.",
          faqs: [
            {
              q: "Können Sie Soja und Paraffin mischen?",
              a: "Ja — Mischungen (z.B. 70/30) kombinieren sauberes Brennen mit Duft und niedrigeren Kosten.",
            },
            {
              q: "Welches Wachs bevorzugen Ihre Kunden?",
              a: "70% wählen Soja oder Mischungen für westliche Märkte. Paraffin bleibt beliebt für Volumen und dekorative Kerzen.",
            },
          ],
          cta: "Unsicher welches Wachs passt? Teilen Sie Ihre Positionierung und wir empfehlen die richtige Formel.",
        },
        "essential-vs-fragrance-oil": {
          title: "Ätherisches Öl vs Duftöl",
          desc: "Unterschiede zwischen ätherischen Ölen und Duftölen — Zusammensetzung, Anwendungen, Kosten und Regulierung.",
          optionA: "Ätherisches Öl",
          optionB: "Duftöl",
          intro:
            "Ätherische Öle und Duftöle dienen unterschiedlichen Zwecken. Das Verständnis der Unterschiede hilft bei der richtigen Zutatenwahl.",
          rows: [
            {
              criterion: "Zusammensetzung",
              a: "100% natürlich — aus Pflanzen extrahiert",
              b: "Synthetisch — laborerzeugte Aromastoffe",
            },
            {
              criterion: "Duftvielfalt",
              a: "Begrenzt (~300 kommerzielle Öle)",
              b: "Unbegrenzt — jeder denkbare Duft",
            },
            {
              criterion: "Therapeutisch",
              a: "Ja — Aromatherapie-Vorteile",
              b: "Nein — rein aromatisch",
            },
            {
              criterion: "Kosten",
              a: "Teuer (USD 20–500+ pro kg)",
              b: "Erschwinglich (USD 5–30 pro kg)",
            },
            {
              criterion: "Konsistenz",
              a: "Variiert je nach Ernte und Klima",
              b: "Perfekt konsistent Charge zu Charge",
            },
            {
              criterion: "Allergene",
              a: "Höheres Risiko — natürliche Allergene",
              b: "Niedriger — kann allergenfrei formuliert werden",
            },
            {
              criterion: "Regulierung",
              a: "Kosmetikverordnung, IFRA, Allergenerklärung",
              b: "IFRA, CLP, keine therapeutischen Claims",
            },
            { criterion: "Haltbarkeit", a: "1–3 Jahre (oxidiert)", b: "2–5 Jahre (stabiler)" },
            {
              criterion: "Ideal Für",
              a: "Aromatherapie, Naturkosmetik, Wellness, Spa",
              b: "Kerzen, Diffusoren, Haushalt, Duft-Branding",
            },
          ],
          verdict:
            "Ätherische Öle für natürliche, therapeutische Positionierung. Duftöle für konsistente, kreative Düfte in Kerzen und Diffusoren. Viele Marken nutzen beides.",
          faqs: [
            {
              q: "Können Sie beide mischen?",
              a: "Ja — Hybridmischungen geben die natürliche Story mit der Konsistenz von Duftölen.",
            },
            {
              q: "Welches ist besser für Kerzen?",
              a: "Duftöle generell — besserer Warmauswurf, mehr Vielfalt, niedrigere Kosten, bessere Stabilität.",
            },
          ],
          cta: "Beschreiben Sie Ihr Produktkonzept und wir empfehlen den richtigen Öltyp.",
        },
        "reed-diffuser-vs-candle": {
          title: "Schilfdiffusor vs Duftkerze",
          desc: "Vergleich von Diffusoren und Kerzen — Langlebigkeit, Sicherheit, Kosten, Duftstärke und Einsatzbereiche.",
          optionA: "Schilfdiffusor",
          optionB: "Duftkerze",
          intro:
            "Beide liefern Home Fragrance, bedienen aber unterschiedliche Bedürfnisse. Dieser Vergleich hilft bei der Entscheidung.",
          rows: [
            {
              criterion: "Flamme / Sicherheit",
              a: "Flammenlos — kein Brandrisiko",
              b: "Offene Flamme — erfordert Aufsicht",
            },
            {
              criterion: "Duftdauer",
              a: "6–12 Wochen kontinuierlich",
              b: "25–80 Stunden gesamt (nur brennend)",
            },
            {
              criterion: "Intensität",
              a: "Subtil, ambient — füllt sanft",
              b: "Stärker brennend — füllt schnell",
            },
            {
              criterion: "Wartung",
              a: "Null — Stäbchen wöchentlich drehen",
              b: "Docht schneiden, überwachen, löschen",
            },
            {
              criterion: "Verbraucherpreis",
              a: "Höher (USD 20–60) aber hält Monate",
              b: "Niedriger (USD 10–35) aber brennt ab",
            },
            {
              criterion: "Herstellkosten",
              a: "Höher (Glas + Öl + Stäbchen + Box)",
              b: "Niedriger (Wachs + Gefäß + Docht + Etikett)",
            },
            {
              criterion: "Regulierung",
              a: "Niedriger — CLP-Etikett, kein Brandtest",
              b: "Höher — Brandtest, Warnungen, SDS",
            },
            {
              criterion: "Räume",
              a: "Bad, Schlafzimmer, Büro, Hotel",
              b: "Wohnzimmer, Esszimmer, Spa — Ritual",
            },
            {
              criterion: "Geschenk",
              a: "Elegant, langlebig — Premium",
              b: "Warm, erlebnisorientiert — saisonal",
            },
          ],
          verdict:
            "Bieten Sie beides an. Diffusoren sind Ihr 'Always-on'-Produkt mit höheren Margen. Kerzen sind Ihr 'Ritual'-Produkt mit emotionaler Verbindung. Zusammen eine komplette Kollektion.",
          faqs: [
            {
              q: "Welches hat bessere Margen?",
              a: "Diffusoren typisch 60–70% vs 50–60% Kerzen, durch höheren wahrgenommenen Wert.",
            },
            {
              q: "Welches ist einfacher zu versenden?",
              a: "Diffusoren — keine Hazmat-Klassifizierung (im Gegensatz zu Kerzen für Luftfracht).",
            },
          ],
          cta: "Planen Sie eine Home-Fragrance-Linie? Wir helfen beim richtigen Mix.",
        },
        "glass-vs-tin-candle": {
          title: "Glasgefäß vs Dose für Kerzen",
          desc: "Vergleich von Glas- und Metallgefäßen — Ästhetik, Kosten, Sicherheit, Versand und Positionierung.",
          optionA: "Glasgefäß",
          optionB: "Dose / Metall",
          intro:
            "Das Gefäß definiert Regalpräsenz, Preiswahrnehmung und Logistik. Glas und Dose haben distincte Vorteile.",
          rows: [
            {
              criterion: "Ästhetik",
              a: "Premium, elegant — zeigt Wachsfarbe, Lichtspiel",
              b: "Rustikal, modern, industriell — opak, matt oder bedruckt",
            },
            {
              criterion: "Kosten",
              a: "Höher (USD 0,50–2,00 pro Gefäß)",
              b: "Niedriger (USD 0,20–0,80 pro Gefäß)",
            },
            {
              criterion: "Gewicht",
              a: "Schwerer — höhere Versandkosten",
              b: "Leichter — niedrigere Kosten, mehr pro Karton",
            },
            {
              criterion: "Bruchrisiko",
              a: "Zerbrechlich — Schutzverpackung nötig",
              b: "Robust — praktisch unzerbrechlich",
            },
            {
              criterion: "Hitzebeständigkeit",
              a: "Exzellent — hohe Temperaturen sicher",
              b: "Gut — Außen wird heiß, Warnung nötig",
            },
            {
              criterion: "Individualisierung",
              a: "Mattiert, farbig, bedruckt, Custom-Formen (ab 3.000)",
              b: "Bedruckt, geprägt, Custom-Formen (ab 5.000)",
            },
            {
              criterion: "Nachhaltigkeit",
              a: "Recycelbar, wiederverwendbar — Eco-Story",
              b: "Recycelbar, wiederverwendbar — auch Eco",
            },
            {
              criterion: "Ideal Für",
              a: "Premium-Marken, Spa, Luxus-Geschenke",
              b: "Reisekerzen, Outdoor, moderne Marken, kostensensitiv",
            },
          ],
          verdict:
            "Glas für Premium-Positionierung. Dose für Reise, Outdoor, kostensensitiv oder industrielle Ästhetik. Viele Marken nutzen Glas für Hero und Dose für Minis/Reise.",
          faqs: [
            {
              q: "Machen Sie Custom-Glasgefäße?",
              a: "Ja — Custom-Formen ab 3.000 Stück. Formkosten USD 500–2.000, erstattbar bei Folgeaufträgen.",
            },
            {
              q: "Welches ist besser für Amazon FBA?",
              a: "Dose — leichter (niedrigere FBA-Gebühren), unzerbrechlich (kein Polybeutel), niedrigere Retourenquote.",
            },
          ],
          cta: "Unsicher welches Gefäß passt? Teilen Sie Ihr Konzept und wir empfehlen die richtige Option.",
        },
      },
    },
    downloads: {
      eyebrow: "Ressourcen-Bibliothek",
      title: "Download-Center",
      subtitle:
        "Dokumente zum Teilen, live aus unseren aktuellen Produktdaten generiert — immer aktuell, keine veralteten PDFs.",
      open: "Dokument öffnen",
      hint: "Generierte Dokumente öffnen sich im Browser — mit dem PDF-herunterladen-Button (oder Strg+P) eine Kopie speichern. Katalog-PDFs werden direkt auf Ihr Gerät heruntergeladen.",
      back: "Zurück zum Download-Center",
      download_pdf: "PDF herunterladen",
      products: "Produkte",
      lead_time: "Lieferzeit",
      certs: "Zertifizierungen",
      rts_products: "Ready-to-Ship-Produkte (live aus aktuellen Bestandsdaten)",
      full_range: "Suchen Sie das gesamte Großhandelssortiment? Stöbern Sie im Shop.",
      rts_empty:
        "Derzeit erfüllt kein Ready-to-Ship-Produkt die aktuellen Bestandskriterien. Kontaktieren Sie uns für Made-to-Order-Optionen.",
      catalog_unavailable:
        "Produktverfügbarkeit vorübergehend nicht verfügbar — bitte kurz erneut versuchen.",
      no_image: "Kein Bild",
      ready_to_ship: "Ready to Ship",
      view_product: "Produkt Ansehen",
      request_quote: "Angebot Anfordern",
      catalog_title: "Produktkatalog",
      catalog_desc:
        "Kompletter Aromiso-Produktkatalog mit Spezifikationen, MOQ und Lieferzeiten — aus Live-Produktdaten generiert.",
      catalog_subtitle:
        "Komplettes Sortiment in 6 Kategorien mit Spezifikationen, MOQ und Lieferzeiten.",
      catalog_cta_title: "Preise Anfordern",
      catalog_cta_text:
        "Dieser Katalog wird aus Live-Daten generiert. Für aktuelle Preise, Muster oder kundenspezifische Formulierungen kontaktieren Sie unser Team.",
      certificates_title: "Zertifizierungen & Compliance",
      certificates_desc:
        "Überblick über Aromiso-Qualitätszertifizierungen und Compliance-Standards — ISO, IFRA, REACH und mehr.",
      certificates_subtitle:
        "Qualitätssysteme und Produkt-Compliance-Standards hinter jedem Aromiso-Produkt.",
      cert_cta_title: "Spezifische Dokumente Benötigt?",
      cert_cta_text:
        "Vollständige Zertifikatkopien, MSDS-Blätter und IFRA-Konformitätserklärungen sind auf Anfrage für bestätigte Projekte erhältlich.",
      oem_title: "OEM / ODM Service-Leitfaden",
      oem_desc:
        "Kompletter Leitfaden für Aromiso Private-Label- und Lohnfertigung — Fähigkeiten, Spezifikationen und Prozess.",
      oem_subtitle:
        "Acht Fertigungsservices mit vollständigen Spezifikationen — von Custom-Formulierung bis Turnkey-Fulfilment.",
      oem_cta_title: "Projekt Starten",
      oem_cta_text:
        "Teilen Sie Ihr Produktkonzept und Ihren Zielmarkt — wir antworten mit einem maßgeschneiderten Angebot innerhalb von 2 Werktagen.",
      packaging_title: "Verpackungs-Leitfaden",
      packaging_desc:
        "Verpackungsoptionen für jede Aromiso-Produktkategorie — Gefäße, Verschlüsse, Schachteln und Private-Label-Veredelung.",
      packaging_subtitle:
        "Standard- und Custom-Verpackungsoptionen nach Produktkategorie sowie Turnkey-Verpackungsservices.",
      packaging_custom_title: "Custom-Verpackung & Compliance",
      packaging_cta_title: "Verpackung Gestalten",
      packaging_cta_text:
        "Senden Sie uns Ihre Markenrichtlinien — unser Designteam schlägt Verpackungs-Mockups innerhalb von 5 Werktagen vor.",
    },
    // -----------------------------------------------------------------
    // V5.27 Wachstums-Expansion — Solutions-Hub / Sourcing / OEM / Kategorien
    // -----------------------------------------------------------------
    solutionsHub: {
      whoWeHelpTitle: "Wem Wir Helfen",
      whoWeHelp: [
        {
          icon: "rocket",
          title: "Eine Neue Aroma-Marke Starten",
          subtitle: "Private Label & Produkte mit niedrigem MOQ",
          cta: "Private Label Entdecken",
          href: "/oem",
        },
        {
          icon: "globe",
          title: "Produkte aus China Beschaffen",
          subtitle: "Lieferantenverifizierung & QC-Services",
          cta: "Sourcing Entdecken",
          href: "/sourcing",
        },
        {
          icon: "palette",
          title: "Custom-Produkte Entwickeln",
          subtitle: "OEM-Duft- & Verpackungsdesign",
          cta: "OEM Entdecken",
          href: "/oem",
        },
        {
          icon: "euro-dollar",
          title: "Import nach Europa / USA",
          subtitle: "Compliance-Dokumentation bereit",
          cta: "Anforderungen Ansehen",
          href: "/downloads/certificates",
        },
      ],
      matrixTitle: "Finden Sie Ihren Weg",
      matrixSubtitle: "Ordnen Sie Ihren Unternehmenstyp der richtigen Beschaffungsroute zu",
      matrix: [
        {
          audience: "Amazon-Verkäufer",
          solution: "Private Label + kleiner MOQ",
          icon: "box",
          href: "/solutions/amazon-sellers",
        },
        {
          audience: "Beauty- & Lifestyle-Marken",
          solution: "Custom-Duft + Verpackung",
          icon: "droplet",
          href: "/solutions/brand-owners",
        },
        {
          audience: "Hotels & Locations",
          solution: "Signature-Duftprogramme",
          icon: "bed",
          href: "/solutions/hotels",
        },
        {
          audience: "Einzelhändler",
          solution: "Großhandel Ready-to-Ship",
          icon: "bag",
          href: "/solutions/retail",
        },
        {
          audience: "Geschenkartikel-Firmen",
          solution: "Gebrandete Geschenksets",
          icon: "gift",
          href: "/solutions/wholesalers",
        },
        {
          audience: "Distributoren",
          solution: "OEM-Partnerschaften in Bulk",
          icon: "package",
          href: "/solutions/distributors",
        },
      ],
      howWeSolveTitle: "Wie Wir Es Lösen",
      howWeSolve: [
        { step: 1, title: "Produkt-Brief", desc: "Teilen Sie Konzept, Zielmarkt und Volumen" },
        {
          step: 2,
          title: "Lieferanten-Match",
          desc: "Wir verbinden Sie mit verifizierten Partnerfabriken",
        },
        { step: 3, title: "Bemusterung", desc: "Qualität, Duft und Finish bewerten — 3–12 Tage" },
        {
          step: 4,
          title: "Produktion",
          desc: "Skalierung von Pilotläufen bis zu vollen Containern",
        },
        { step: 5, title: "Qualitätskontrolle", desc: "Chargeninspektion und Pre-Shipment-QC" },
        { step: 6, title: "Export", desc: "Compliance-Dokumentation und konsolidierter Versand" },
      ],
      industryIntro:
        "Ob Sie eine Private-Label-Kerzenlinie starten, ein Hotel-Duftprogramm aufbauen oder ätherische Öle im Großhandel skalieren — wir verbinden Sie mit Partnerfabriken, die Ihre Spezifikationen, Zertifizierungen und Lieferfristen erfüllen.",
      solutionsTitle: "Branchenspezifische Lösungen",
      solutionsSubtitle: "Durchsuchen Sie unsere Lösungsguides für gezielte Beschaffungsstrategien",
      finalCtaTitle: "Sprechen Sie mit einem Sourcing-Spezialisten",
      finalCtaText:
        "Besprechen Sie Ihr Projekt — Produktkategorie, Volumen und Zeitplan — und erhalten Sie eine maßgeschneiderte Roadmap mit empfohlenen Lieferanten.",
      faqs: [
        {
          q: "Können Sie mir helfen, eine Private-Label-Aroma-Marke zu starten?",
          a: "Ja. Wir verbinden Sie mit Partnerfabriken, die Private Label mit niedrigem MOQ (ab ca. 100 Einheiten), Custom-Düfte auf Basis von Fine-Fragrance-Rohstoffen wie Firmenich und Givaudan sowie vollständige Verpackungsgestaltung anbieten.",
        },
        {
          q: "Wie verifizieren Sie die Lieferantenqualität?",
          a: "Aromiso arbeitet mit ISO-9001- und ISO-22716-(GMP-)Qualitätssystemen, und unsere Partnerfabriken verfügen über Zertifizierungen wie CE und BSCI, mit SGS-Drittanbieterprüfungen auf Wunsch. Wir unterstützen Fabrikaudits, Musterbewertung und Chargeninspektion vor dem Versand.",
        },
        {
          q: "Welche Dokumente liefern Sie für die Import-Compliance?",
          a: "Wir liefern MSDS/SDS, See- und Luftfracht-Transportsicherheitsberichte, REACH-/CLP-Konformitätszertifikate wo zutreffend sowie SGS-Drittanbieter-Testberichte auf Anfrage.",
        },
        {
          q: "Wie sind die typischen Vorlaufzeiten?",
          a: "Muster: 3–12 Tage. Serienproduktion: 10–35 Tage je nach Customization-Grad und Auftragsgröße. Partnerfabriken halten eine Kapazität von 10.000–50.000 Flaschen/Tag für Eilaufträge vor.",
        },
        {
          q: "Bieten Sie konsolidierten Versand an?",
          a: "Ja. Wir konsolidieren Lieferungen mehrerer Lieferanten in einzelnen Containern mit vollständiger Chargenrückverfolgung — ideal für Amazon-Verkäufer und Einzelhändler, die über mehrere Kategorien beschaffen.",
        },
      ],
    },
    sourcingPage: {
      eyebrow: "China-Sourcing",
      title: "Aroma-Produkte von Verifizierten Chinesischen Fabriken Beschaffen",
      subtitle:
        "Wir matchen Ihr Briefing mit geprüften Fabriken, verifizieren Qualität und Compliance und konsolidieren alles in einer Sendung.",
      whatWeCanSourceTitle: "Was Wir Beschaffen Können",
      whatWeCanSourceSubtitle:
        "Acht Produktfamilien über unser Fabriknetzwerk — durchsuchen Sie fertige Linien oder senden Sie uns Ihr Custom-Briefing.",
      whatWeCanSource: [
        {
          icon: "flame",
          title: "Duftkerzen",
          desc: "Soja-, Kokos- und Mischwachskerzen in Glas-, Dosen- oder Keramikgefäßen.",
          href: "/products/candles",
        },
        {
          icon: "wind",
          title: "Rattanstäbchen-Diffuser",
          desc: "Reed-Diffuser mit Custom-Gefäßen, Verschlüssen und Duftbeladung.",
          href: "/products/reed-diffusers",
        },
        {
          icon: "droplet",
          title: "Ätherische Öle",
          desc: "Reine und gemischte ätherische Öle in Bulk oder Retail-fertigen Formaten.",
          href: "/products/essential-oils",
        },
        {
          icon: "sparkles",
          title: "Duftöle",
          desc: "Fine-Fragrance-Öle von Partnerfabriken, die mit Firmenich-, Givaudan-, Ogawa- und Robertet-Rohstoffen arbeiten.",
          href: "/products/fragrance-oils",
        },
        {
          icon: "car",
          title: "Autodüfte",
          desc: "Luftausströmer-Clips, Hängekarten und Diffuser für Automotive-Retail-Linien.",
          href: "/shop/?category=Car%20Fragrance",
        },
        {
          icon: "gift",
          title: "Geschenksets",
          desc: "Saisonale und Corporate-Geschenksets, die mehrere Kategorien kombinieren.",
          href: "/shop/?category=Gift%20Sets",
        },
        {
          icon: "home",
          title: "Home-Fragrance-Zubehör",
          desc: "Raumsprays, Duftbeutel, Wax-Melts, Brenner und Aroma-Diffuser.",
          href: "/products/home-fragrance",
        },
        {
          icon: "package",
          title: "Verpackung & Private-Label-Veredelung",
          desc: "Gefäße, Verschlüsse, Schachteln und Etiketten-Veredelung für Ihre Marke.",
          href: "/products/packaging",
        },
      ],
      processTitle: "So Funktioniert Sourcing",
      process: [
        {
          step: 1,
          title: "Briefing Teilen",
          desc: "Produkt, Spezifikationen, Zielpreis und Volumen.",
        },
        {
          step: 2,
          title: "Fabrik-Matching",
          desc: "Wir erstellen eine Vorauswahl verifizierter Fabriken aus unserem Netzwerk, passend zu Kategorie, Zertifizierungen und Preispunkt.",
        },
        {
          step: 3,
          title: "Bemusterung",
          desc: "Muster in 3–12 Tagen — Qualität, Duft und Finish bewerten.",
        },
        {
          step: 4,
          title: "Verhandlung & Verträge",
          desc: "Wir verhandeln Preise, MOQ und Vorlaufzeiten und dokumentieren jeden Punkt.",
        },
        {
          step: 5,
          title: "Produktion & QC",
          desc: "Chargenprüfungen während der Produktion; Pre-Shipment-QC mit Fotos und Berichten.",
        },
        {
          step: 6,
          title: "Konsolidierung & Versand",
          desc: "Mehrere Lieferanten in einer Sendung konsolidiert, mit vollständiger Dokumentation.",
        },
      ],
      verifyTitle: "Was Wir Verifizieren",
      verifySubtitle: "Jeder Lieferant in unserem Netzwerk durchläuft dieselbe Checkliste",
      verify: [
        "Fabrik-Legitimität & Produktionsfähigkeit (Audit-Berichte verfügbar)",
        "Zertifizierungen: CE, BSCI und Export-Compliance für EU / USA / Kanada",
        "Produkt-Compliance: MSDS / SDS für jede Formulierung",
        "Transportsicherheit: See- & Luftfracht-Transportidentifikationsberichte",
        "Musterbewertung, bevor irgendeine Anzahlung geleistet wird",
        "Chargenkonsistenz & Füllgenauigkeit während der Produktion",
        "Verpackungsintegrität & korrekte Kennzeichnung",
        "Drittanbieter-Tests via SGS / CNAS / CMA Labore auf Anfrage",
      ],
      networkTitle: "8 Partnerfabriken, 3 Leistungsklassen",
      networkIntro:
        "Wir arbeiten mit acht etablierten Partnerfabriken in ganz China, gruppiert in drei Leistungsklassen — so decken wir jedes Briefing ab, vom kostengetriebenen Volumenauftrag bis zum Premium-OEM-Programm.",
      tiers: [
        {
          name: "Volumen & Wert",
          desc: "Kosteneffiziente Linien für Ready-to-Ship- und Schnelldreher-SKUs.",
          best: "Einzelhändler, Amazon-Verkäufer, preisgetriebene Programme",
        },
        {
          name: "Ausgewogene OEM",
          desc: "Flexible OEM/ODM mit Custom-Duft, Gefäßen und Verpackung.",
          best: "Wachsende Marken, Private Label ab ca. 100 Einheiten",
        },
        {
          name: "Premium-Markenproduktion",
          desc: "Große Anlagen (5.000㎡+), Fine-Fragrance-Rohstoffe von Firmenich, Givaudan, Ogawa und Robertet, vollständige Dokumentations-Suite.",
          best: "Etablierte Marken, Hotel- & Spa-Programme",
        },
      ],
      networkStats: [
        { num: "8", label: "Partnerfabriken" },
        { num: "3", label: "Leistungsklassen" },
        { num: "500+", label: "Verfügbare Düfte" },
        { num: "10k–50k", label: "Flaschen pro Tag" },
      ],
      auditCtaTitle: "Audit-Checkliste Benötigt?",
      auditCtaText:
        "Laden Sie unsere Zertifizierungsübersicht herunter oder fordern Sie vollständige Lieferanten-Audit-Dokumentation für bestätigte Projekte an.",
      auditCtaButton: "Zertifikate & Dokumente Ansehen",
      faqs: [
        {
          q: "Muss ich einen vollen Container bestellen?",
          a: "Nein. Wir unterstützen LCL-Sendungen (weniger als Containerladung) und konsolidieren mehrere Lieferanten in einer Sendung, damit kleine und mittlere Aufträge wirtschaftlich bleiben.",
        },
        {
          q: "Können Sie Produkte beschaffen, die nicht im Katalog sind?",
          a: "Ja — senden Sie uns ein Foto, Spezifikationsblatt oder Referenzmuster. Wir gleichen es mit unseren acht Partnerfabriken ab und melden uns mit Optionen und Preisen.",
        },
        {
          q: "Wie gehen Sie mit Qualitätsstreitigkeiten um?",
          a: "Jede Bestellung enthält Pre-Shipment-QC mit Fotos und Berichten. Verfehlt eine Charge die vereinbarten Spezifikationen, koordinieren wir Nacharbeit oder Ersatz mit der Fabrik vor der Schlusszahlung.",
        },
        {
          q: "Welche Exportdokumente können Sie liefern?",
          a: "MSDS/SDS, See- und Luftfracht-Transportsicherheitsberichte, REACH-/CLP-Zertifikate wo zutreffend sowie SGS-Drittanbieter-Testberichte — vorbereitet für die Importanforderungen von EU, USA und Kanada.",
        },
        {
          q: "Wie hoch ist die Mindestbestellmenge für Sourcing-Projekte?",
          a: "Das hängt von Produkt und Fabrikklasse ab. Ready-to-Ship-Artikel sind kartonweise bestellbar; Private Label startet ab ca. 100 Einheiten; Custom-OEM-Projekte werden fallweise kalkuliert.",
        },
      ],
    },
    oemHub: {
      eyebrow: "OEM / ODM",
      title: "Custom-Fertigung für Ihre Aroma-Marke",
      subtitle:
        "Von fertiger Private Label bis zu vollständig maßgeschneiderten Formulierungen — acht Services, ein verantwortlicher Partner.",
      customizeTitle: "Was Wir Anpassen Können",
      customize: [
        {
          icon: "droplet",
          title: "Duft",
          items: [
            "500+ fertige Düfte zur Auswahl",
            "Custom-Formulierung passend zu Ihrem Briefing",
            "Fine-Fragrance-Rohstoffe (Firmenich, Givaudan, Ogawa, Robertet) via Partnerfabriken",
          ],
        },
        {
          icon: "flask",
          title: "Formulierung",
          items: [
            "Soja-, Kokos- und Mischwachs-Optionen",
            "Duftbeladungs- und Abbrand-Tuning für Kerzen",
            "Vegan-freundliche und phthalatfreie Optionen",
          ],
        },
        {
          icon: "package",
          title: "Gefäß & Verpackung",
          items: [
            "Glas-, Dosen- und Keramikgefäße",
            "Custom-Boxen, Sleeves und Einlagen",
            "Nachhaltige Verpackungsalternativen",
          ],
        },
        {
          icon: "tag",
          title: "Branding & Compliance",
          items: [
            "Etiketten, Siebdruck und Logo-Prägung",
            "EU-/US-Compliance-Kennzeichnungssupport",
            "Barcode- und mehrsprachige Etikettenvorbereitung",
          ],
        },
      ],
      chooseTitle: "Wählen Sie Ihr Produkt",
      chooseSubtitle: "Acht Fertigungsservices — wählen Sie Ihren Startpunkt",
      choose: [
        {
          icon: "droplet",
          title: "Private-Label Ätherisches Öl",
          desc: "Ihr Etikett auf bewährten reinen und gemischten Ölen.",
          href: "/oem/private-label-essential-oil",
        },
        {
          icon: "flame",
          title: "Private-Label-Kerze",
          desc: "Bewährte Kerzenlinien bereit für Ihr Branding.",
          href: "/oem/private-label-candle",
        },
        {
          icon: "wind",
          title: "Private-Label Reed-Diffuser",
          desc: "Bestseller-Diffuserformate, Ihre Marke.",
          href: "/oem/private-label-diffuser",
        },
        {
          icon: "factory",
          title: "OEM-Kerzenfertigung",
          desc: "Custom-Wachs, Gefäß, Duft und Verpackung.",
          href: "/oem/oem-candle",
        },
        {
          icon: "leaf",
          title: "OEM Ätherisches Öl",
          desc: "Bulk- oder Retail-fertige Öle nach Ihrer Spezifikation.",
          href: "/oem/oem-essential-oil",
        },
        {
          icon: "package",
          title: "Custom-Verpackung",
          desc: "Gefäße, Boxen und Veredelung, die verkaufen.",
          href: "/oem/custom-packaging",
        },
        {
          icon: "sparkles",
          title: "Custom-Duft",
          desc: "Signature-Düfte, entwickelt nach Ihrem Briefing.",
          href: "/oem/custom-fragrance",
        },
        {
          icon: "custom-bottle",
          title: "Custom-Flaschen & Gefäße",
          desc: "Formen und Formate, die zu Ihrer Marke passen.",
          href: "/oem/custom-bottle",
        },
      ],
      levelsTitle: "Wie Individuell Brauchen Sie Es?",
      levelsSubtitle: "Vier Stufen — vom Fertigbestand bis zu vollständigem OEM/ODM",
      levels: [
        {
          name: "Fertigprodukt",
          tagline: "Am schnellsten am Markt",
          points: [
            "Lagerkatalog, Versand innerhalb von 48 Stunden",
            "Bestellung pro Stück oder Karton — ohne große Verpflichtung",
            "Ideal zum Testen neuer Märkte und Kanäle",
          ],
          cta: "Ready to Ship Durchsuchen",
          href: "/shop/?rts=1",
        },
        {
          name: "Private Label",
          tagline: "Ihre Marke, unsere Produkte",
          points: [
            "Ihr Etikett auf bewährten Formulierungen",
            "MOQ ab ca. 100 Einheiten",
            "Muster in 3–12 Tagen",
          ],
          cta: "Private Label Entdecken",
          href: "/oem/private-label-candle",
        },
        {
          name: "Semi-Custom",
          tagline: "Details anpassen",
          points: [
            "Custom-Duft, Gefäß oder Verpackung",
            "MOQ hängt von der angepassten Komponente ab",
            "Muster in 3–12 Tagen",
          ],
          cta: "Semi-Custom Besprechen",
          href: "/oem/custom-fragrance",
        },
        {
          name: "Voll-OEM / ODM",
          tagline: "Gebaut aus Ihrem Briefing",
          points: [
            "Maßgeschneiderte Formulierung, Formen und Design",
            "Serienproduktion 10–35 Tage (auftragsabhängig)",
            "Vollständige Dokumentations-Suite für den Import",
          ],
          cta: "Projekt Starten",
          href: "/contact",
        },
      ],
      processTitle: "Der OEM-Prozess",
      process: [
        { step: 1, title: "Anfrage", desc: "Teilen Sie Konzept, Spezifikationen und Zielmenge." },
        {
          step: 2,
          title: "Beratung",
          desc: "Wir klären Anforderungen und empfehlen Optionen innerhalb von 2 Werktagen.",
        },
        {
          step: 3,
          title: "Angebot",
          desc: "Detailliertes Angebot mit MOQ, Stückpreis und Vorlaufzeit.",
        },
        {
          step: 4,
          title: "Bemusterung",
          desc: "Muster in 3–12 Tagen für Ihre Bewertung produziert.",
        },
        {
          step: 5,
          title: "Bestätigung",
          desc: "Muster freigeben, Artwork und Dokumentation bestätigen.",
        },
        { step: 6, title: "Produktion", desc: "Serienproduktion in 10–35 Tagen je nach Auftrag." },
        {
          step: 7,
          title: "Qualitätskontrolle",
          desc: "Inline-Prüfungen plus Pre-Shipment-QC mit Berichten.",
        },
        { step: 8, title: "Lieferung", desc: "Exportdokumentation und konsolidierter Versand." },
      ],
      faqs: [
        {
          q: "Wie hoch ist der MOQ für Private-Label-Bestellungen?",
          a: "Private Label startet bei den meisten Produkten ab ca. 100 Einheiten. Vollständige Custom-OEM-Projekte (neue Formen, maßgeschneiderte Formulierungen) haben höhere MOQs — die genauen Zahlen bestätigen wir in Ihrem Angebot.",
        },
        {
          q: "Können Sie einen Duft nach meiner Beschreibung entwickeln?",
          a: "Ja. Partnerfabriken arbeiten mit Fine-Fragrance-Rohstoffen von Häusern wie Firmenich, Givaudan, Ogawa und Robertet und können einen Referenzduft nachbilden oder einen neuen aus Ihrem Briefing entwickeln.",
        },
        {
          q: "Wie lange dauert die Bemusterung?",
          a: "Je nach Komplexität typischerweise 3–12 Tage. Fertige Muster aus Lagerbestand können noch schneller versendet werden.",
        },
        {
          q: "Übernehmen Sie die EU-/US-Compliance-Kennzeichnung?",
          a: "Ja — wir erstellen CLP-/REACH-artige Kennzeichnung für den EU-Markt und konforme Kennzeichnung für die USA, plus MSDS/SDS und Transportsicherheitsberichte für Ihre Sendung.",
        },
        {
          q: "Kann ich klein starten und später skalieren?",
          a: "Das ist der übliche Weg: Testen Sie mit Ready-to-Ship- oder Private-Label-Mengen und wechseln Sie zu Semi-Custom oder Voll-OEM, sobald der SKU sich bewährt. Ihre Spezifikationen bleiben für Folgeaufträge bei uns.",
        },
      ],
    },
    categoryPages: {
      subcatsTitle: "Beliebt in Dieser Kategorie",
      buyGuideTitle: "Kaufberatung",
      qualityTitle: "Qualität & Dokumentation",
      quality: [
        "ISO-9001- / ISO-22716-(GMP-)Qualitätssysteme",
        "MSDS / SDS für jedes Produkt verfügbar",
        "REACH-/CLP-Compliance-Dokumentation auf Anfrage",
        "Drittanbieter-Tests via SGS / CNAS / CMA Labore",
      ],
      sourcingTitle: "Sourcing & Customization",
      sourcing: [
        "Ready-to-Ship-Bestand — Versand innerhalb von 48 Stunden",
        "Private Label ab ca. 100 Einheiten",
        "Custom-Duft, Gefäße und Verpackung (OEM/ODM)",
        "Konsolidierter Versand über Kategorien hinweg",
      ],
      recsTitle: "Vielleicht Brauchen Sie Auch",
      browseAll: "Alle Produkte Durchsuchen",
      "essential-oils": {
        subcats: [
          { label: "Ätherische Öle in Bulk", href: "/shop/?q=essential%20oil" },
          { label: "Ready to Ship", href: "/shop/?q=essential%20oil&rts=1" },
          { label: "Niedriger MOQ (≤ 50)", href: "/shop/?q=essential%20oil&moq=le50" },
        ],
        guide:
          "Der Bulk-Kauf ätherischer Öle dreht sich um Reinheit, Konsistenz und Dokumentation. Verifizieren Sie botanische Namen und Extraktionsmethoden, fordern Sie MSDS/SDS für jede SKU an und bewerten Sie stets Muster auf Duftprofil und Chargenkonsistenz, bevor Sie Volumen festlegen.",
        points: [
          "Fordern Sie MSDS/SDS und Verwendungshinweise pro SKU an",
          "Bestätigen Sie die Extraktionsmethode (wasserdampfdestilliert, kaltgepresst) schriftlich",
          "Bewerten Sie mindestens zwei Musterchargen auf Duftkonsistenz",
          "Für Retail: Tropfer-/Verschlussqualität und Etiketten-Compliance prüfen",
        ],
      },
      "fragrance-oils": {
        subcats: [
          { label: "Duftöle auf Lager", href: "/shop/?q=fragrance%20oil" },
          { label: "Ready to Ship", href: "/shop/?q=fragrance%20oil&rts=1" },
          { label: "Custom-Duftservice", href: "/oem/custom-fragrance" },
        ],
        guide:
          "Duftöle sind auf Leistung in bestimmten Trägern ausgelegt — Kerzen, Diffuser oder Hautkontakt-Anwendungen. Ordnen Sie das Öl der Anwendung zu, bestätigen Sie die empfohlene Duftbeladung und fragen Sie, ob das Öl auf Fine-Fragrance-Rohstoffen basiert.",
        points: [
          "Bestätigen Sie, dass das Öl zu Ihrem Träger passt (Wachs, Diffuser-Basis, Kosmetik)",
          "Fragen Sie nach empfohlener Duftbeladung pro Anwendung",
          "Fordern Sie phthalatfreie / vegane Optionen, wenn Ihr Markt sie erwartet",
          "Partnerfabriken können einen Referenzduft nachbilden oder einen maßgeschneiderten entwickeln",
        ],
      },
      "reed-diffusers": {
        subcats: [
          {
            label: "Reed-Diffuser auf Lager",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser",
          },
          {
            label: "Ready to Ship",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&rts=1",
          },
          {
            label: "MOQ ≤ 10",
            href: "/shop/?category=Home%20Fragrance&q=reed%20diffuser&moq=le10",
          },
        ],
        guide:
          "Ein guter Reed-Diffuser balanciert Gefäß, Stäbchenanzahl und Duftbeladung für gleichmäßige Duftabgabe über Wochen. Legen Sie zuerst den Gefäßstil fest und stimmen Sie dann Stäbchenanzahl und Ölvolumen auf die Raumgröße Ihrer Kunden ab.",
        points: [
          "Glasgefäße mit schmalem Hals verlangsamen die Verdunstung und verlängern die Lebensdauer",
          "Mehr Stäbchen = stärkere Duftabgabe, aber schnellerer Verbrauch",
          "Fordern Sie Transportsicherheitsberichte an — Diffuser-Öl ist regulierte Fracht",
          "Private Label ab ca. 100 Einheiten mit Ihrem Gefäß und Etikett",
        ],
      },
      candles: {
        subcats: [
          { label: "Kerzen auf Lager", href: "/shop/?category=Scented%20Candles" },
          { label: "Ready to Ship", href: "/shop/?category=Scented%20Candles&rts=1" },
          { label: "Bulk-Wert ($1–3)", href: "/shop/?category=Scented%20Candles&price=b1_3" },
          { label: "MOQ ≤ 10", href: "/shop/?category=Scented%20Candles&moq=le10" },
        ],
        guide:
          "Bei Großhandelskerzen bestimmen Wachstyp, Gefäß und Abbrandverhalten sowohl Kosten als auch Bewertungen. Natürliche Soja- und Kokosmischungen brennen sauberer und tragen eine Premium-Geschichte; Dosen eignen sich für Reise- und preissensitive Linien.",
        points: [
          "Soja-/Kokosmischungen für Premium-Positionierung, Paraffinmischungen für den Preis",
          "Fordern Sie Abbrandtest-Notizen an: Brennzeit, Schmelzbecken, Rußverhalten",
          "Dosenkerzen sind günstiger im Versand und bruchfest (Amazon-freundlich)",
          "Custom-Wachs, Gefäß und Duft via OEM ab höheren MOQs verfügbar",
        ],
      },
      "home-fragrance": {
        subcats: [
          { label: "Home Fragrance auf Lager", href: "/shop/?category=Home%20Fragrance" },
          { label: "Ready to Ship", href: "/shop/?category=Home%20Fragrance&rts=1" },
          { label: "Autodüfte", href: "/shop/?category=Car%20Fragrance" },
          { label: "Geschenksets", href: "/shop/?category=Gift%20Sets" },
        ],
        guide:
          "Home Fragrance ist eine Mix-and-Match-Kategorie: Reed-Diffuser, Raumsprays, Duftbeutel, Wax-Melts und Autoformate teilen Duftplattformen. Eine Serie auf Basis einer Duftgeschichte senkt Bemusterungskosten und stärkt Ihr Markenregal.",
        points: [
          "Bauen Sie Serien auf einem Duft über Diffuser, Spray und Duftbeutel",
          "Autodüfte sind Schnelldreher-Zusatzartikel für Einzelhändler",
          "Geschenksets steigern den Warenkorbwert — kombinieren Sie 2–3 Formate",
          "Konsolidieren Sie über Formate hinweg, um Frachtkosten niedrig zu halten",
        ],
      },
      packaging: {
        subcats: [
          { label: "Verpackungs-Guide", href: "/downloads/packaging-guide" },
          { label: "Custom-Verpackungsservice", href: "/oem/custom-packaging" },
          { label: "Custom-Flaschen & Gefäße", href: "/oem/custom-bottle" },
        ],
        guide:
          "Verpackung entscheidet Regalwirkung, Frachtsicherheit und Unboxing-Erlebnis zugleich. Wählen Sie Gefäße, die den Transport überstehen, Verschlüsse, die den Duft einschließen, und Schachteln, die Ihre Markengeschichte tragen — prüfen Sie anschließend die Kennzeichnungs-Compliance für Ihren Markt.",
        points: [
          "Gefäß auf den Kanal abstimmen: Dosen für E-Commerce, Glas für Premium-Retail",
          "Fordern Sie Falltest- und Transportverpackungs-Spezifikationen für zerbrechliche SKUs",
          "Custom-Boxen und Sleeves mit Ihrem Artwork verfügbar",
          "EU-/US-Compliance-Kennzeichnung kann zusammen mit Ihrer Bestellung vorbereitet werden",
        ],
      },
    },
  },
} satisfies Record<Locale, ContentShape>;

/** Resolve a dotted path inside CONTENT for a locale. Falls back to en. */
export function c(locale: Locale, path: string): any {
  const keys = path.split(".");
  let v: unknown = CONTENT[locale];
  for (const k of keys) {
    if (v && typeof v === "object") v = (v as Record<string, unknown>)[k];
    else return (CONTENT.en as any)?.[path];
  }
  if (v !== undefined) return v;
  // fallback to en
  let fb: unknown = CONTENT.en;
  for (const k of keys) {
    if (fb && typeof fb === "object") fb = (fb as Record<string, unknown>)[k];
    else return undefined;
  }
  return fb;
}

export const CATEGORY_SLUGS = [
  "essential-oils",
  "fragrance-oils",
  "reed-diffusers",
  "candles",
  "home-fragrance",
  "packaging",
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const SOLUTION_SLUGS = [
  "hotels",
  "spa-wellness",
  "retail",
  "amazon-sellers",
  "supermarkets",
  "brand-owners",
  "wholesalers",
  "distributors",
] as const;
export type SolutionSlug = (typeof SOLUTION_SLUGS)[number];

export const OEM_SLUGS = [
  "private-label-essential-oil",
  "private-label-candle",
  "private-label-diffuser",
  "oem-candle",
  "oem-essential-oil",
  "custom-packaging",
  "custom-fragrance",
  "custom-bottle",
] as const;
export type OemSlug = (typeof OEM_SLUGS)[number];

export const FACTORY_SLUGS = [
  "quality-control",
  "laboratory",
  "raw-material",
  "warehouse",
  "production-capacity",
  "certificates",
] as const;
export type FactorySlug = (typeof FACTORY_SLUGS)[number];

export const COUNTRY_SLUGS = ["usa", "germany", "france", "spain", "canada"] as const;
export type CountrySlug = (typeof COUNTRY_SLUGS)[number];

export const COMPARE_SLUGS = [
  "soy-vs-paraffin",
  "essential-vs-fragrance-oil",
  "reed-diffuser-vs-candle",
  "glass-vs-tin-candle",
] as const;
export type CompareSlug = (typeof COMPARE_SLUGS)[number];

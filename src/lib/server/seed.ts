import "server-only";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { CATEGORIES } from "@/lib/catalog/categories";
import { COMPATIBLE, SEED_PRODUCTS } from "@/lib/catalog/products";
import { SAMPLE_SUPPLIERS, SAMPLE_ZONES } from "@/lib/catalog/suppliers";
import { db } from "@/lib/db";
import * as t from "@/lib/db/schema";
import type { AddressSnapshot } from "@/lib/db/schema";
import { SKU } from "@/lib/domain/estimator/materials";
import { detectJobInQuery, prepareDocs, searchDocs } from "@/lib/domain/search";
import { newReference } from "@/lib/ids";
import {
  buildOrderDraft,
  cancelUnpaidOrder,
  createOrder,
  issueRefund,
  markOrderPaid,
  recordSupplierInvoice,
  substituteOrderLine,
  updateShipmentStatus,
} from "./orders";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { hashPassword } from "./password";
import { repriceProducts } from "./repricing";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), seed | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/&/g, "and")
    .replace(/["'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export async function isSeeded(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(t.products);
  return row.n > 0;
}

export async function seedDatabase(log: (msg: string) => void = console.log): Promise<void> {
  const rand = mulberry32(20261027);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1));
  const now = new Date();

  // Settings
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
    await saveSettings(key, DEFAULT_SETTINGS[key]);
  }

  // Categories
  const categoryRows = await db
    .insert(t.categories)
    .values(CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, description: c.description, icon: c.icon, sortOrder: i + 1 })))
    .returning();
  const categoryId = new Map(categoryRows.map((c) => [c.slug, c.id]));
  log(`  ${categoryRows.length} categories`);

  // Products
  const estimatorSkus = new Set<string>(Object.values(SKU));
  const productRows = await db
    .insert(t.products)
    .values(
      SEED_PRODUCTS.map((p) => {
        const specs: Record<string, string> = { ...p.specs };
        const a = p.attributes ?? {};
        if (a.coverageM2) specs.Coverage = `${a.coverageM2} m² per ${p.unit}`;
        if (a.lengthM) specs.Length = `${a.lengthM} m`;
        if (a.litres) specs.Volume = `${a.litres} L`;
        if (a.coverageM2PerLitre) specs["Spread rate"] = `About ${a.coverageM2PerLitre} m² per litre`;
        if (a.kg) specs.Weight = `${a.kg} kg`;
        else if (p.weightKg) specs.Weight = `About ${p.weightKg} kg`;
        if (a.packQty) specs["Pack quantity"] = String(a.packQty);
        if (a.thicknessMm) specs.Thickness = `${a.thicknessMm} mm`;
        return {
          sku: p.sku,
          slug: slugify(p.name),
          name: p.name,
          categoryId: categoryId.get(p.category)!,
          description: p.description,
          unit: p.unit,
          imageKey: p.image,
          tags: p.tags,
          attributes: a,
          specs,
          compatibleSkus: COMPATIBLE[p.sku] ?? [],
          family: p.family ?? null,
          altNote: p.altNote ?? null,
          safetyNote: p.safetyNote ?? null,
          deliveryClass: p.deliveryClass,
          weightKg: p.weightKg ?? a.kg ?? null,
          promoBps: p.promoBps ?? null,
          promoEndsAt: p.promoBps ? new Date(now.getTime() + intBetween(12, 30) * DAY) : null,
          popularity: Math.round(between(5, 55) + (estimatorSkus.has(p.sku) ? 35 : 0)),
        };
      }),
    )
    .returning();
  const productBySku = new Map(productRows.map((p) => [p.sku, p]));
  log(`  ${productRows.length} products`);

  // Suppliers & offers
  const supplierRows = await db
    .insert(t.suppliers)
    .values(
      SAMPLE_SUPPLIERS.map((s) => ({
        code: s.code,
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        integration: s.integration,
        servesAreas: s.servesAreas,
        leadTimeDays: s.leadTimeDays,
        cutoffHour: s.cutoffHour,
        deliversSaturday: s.deliversSaturday,
        deliveryCosts: s.deliveryCosts,
        paymentTerms: s.paymentTerms,
        notes: s.notes,
        isSample: true,
        lastFeedAt: s.integration === "email" ? null : new Date(now.getTime() - intBetween(2, 20) * HOUR),
      })),
    )
    .returning();
  const supplierByCode = new Map(supplierRows.map((s) => [s.code, s]));

  const offers: (typeof t.supplierOffers.$inferInsert)[] = [];
  for (const s of SAMPLE_SUPPLIERS) {
    const supplier = supplierByCode.get(s.code)!;
    for (const p of SEED_PRODUCTS) {
      const eligible = s.categories.includes(p.category) || s.extraSkus?.includes(p.sku);
      if (!eligible || rand() > s.coverage) continue;
      const cost = Math.round(p.costNet * between(s.costFactor[0], s.costFactor[1]));
      let stockStatus: (typeof t.supplierOffers.$inferInsert)["stockStatus"] = "in_stock";
      let stockQty: number | null = intBetween(25, 400);
      if (p.stock === "out") {
        stockStatus = "out_of_stock";
        stockQty = 0;
      } else if (!s.stockVerified) {
        stockStatus = "unknown";
        stockQty = null;
      } else if (p.stock === "low" || rand() < 0.05) {
        stockStatus = "low_stock";
        stockQty = intBetween(3, 9);
      }
      offers.push({
        supplierId: supplier.id,
        productId: productBySku.get(p.sku)!.id,
        supplierSku: `${s.code}-${intBetween(10000, 99999)}`,
        costNet: cost,
        stockStatus,
        stockQty,
        verified: s.stockVerified,
        lastSyncedAt: s.integration === "email" ? null : supplier.lastFeedAt,
      });
    }
  }
  const covered = new Set(offers.map((o) => o.productId));
  for (const p of SEED_PRODUCTS) {
    const product = productBySku.get(p.sku)!;
    if (covered.has(product.id)) continue;
    offers.push({
      supplierId: supplierByCode.get("NDD")!.id,
      productId: product.id,
      supplierSku: `NDD-${intBetween(10000, 99999)}`,
      costNet: Math.round(p.costNet * 1.1),
      stockStatus: p.stock === "out" ? "out_of_stock" : "unknown",
      stockQty: null,
      verified: false,
    });
  }
  for (let i = 0; i < offers.length; i += 100) await db.insert(t.supplierOffers).values(offers.slice(i, i + 100));
  log(`  ${supplierRows.length} sample suppliers, ${offers.length} supplier offers`);

  // Pricing rules & delivery zones
  await db.insert(t.pricingRules).values([
    { name: "Standard markup", scope: "global", scopeId: null, markupBps: 3500, minMarginBps: 1500, rounding: "end9", priority: 0 },
    { name: "Heavy building materials", scope: "category", scopeId: categoryId.get("building-materials")!, markupBps: 2200, minMarginBps: 1200, rounding: "end9", priority: 0 },
    { name: "Timber & sheet", scope: "category", scopeId: categoryId.get("timber-sheet")!, markupBps: 3000, minMarginBps: 1500, rounding: "end9", priority: 0 },
    { name: "Tools", scope: "category", scopeId: categoryId.get("tools")!, markupBps: 4000, minMarginBps: 2000, rounding: "end9", priority: 0 },
    { name: "Bathrooms", scope: "category", scopeId: categoryId.get("bathrooms")!, markupBps: 3200, minMarginBps: 1500, rounding: "end49or99", priority: 0 },
    { name: "National distributor (back-up)", scope: "supplier", scopeId: supplierByCode.get("NDD")!.id, markupBps: 3000, minMarginBps: 1500, rounding: "end9", priority: 0 },
  ]);
  await db.insert(t.deliveryZones).values(SAMPLE_ZONES);
  const changes = await repriceProducts();
  log(`  priced ${changes.length} products from supplier costs and pricing rules`);

  // Accounts
  const [adminHash, staffHash, demoHash] = await Promise.all([
    hashPassword(DEMO_ACCOUNTS.admin.password),
    hashPassword(DEMO_ACCOUNTS.staff.password),
    hashPassword(DEMO_ACCOUNTS.diy.password),
  ]);
  const [admin, staff, diy, trade, pending] = await db
    .insert(t.users)
    .values([
      { email: DEMO_ACCOUNTS.admin.email, passwordHash: adminHash, name: DEMO_ACCOUNTS.admin.name, role: "admin" },
      { email: DEMO_ACCOUNTS.staff.email, passwordHash: staffHash, name: DEMO_ACCOUNTS.staff.name, role: "staff" },
      { email: DEMO_ACCOUNTS.diy.email, passwordHash: demoHash, name: DEMO_ACCOUNTS.diy.name, phone: "07700 900123", marketingOptIn: true, createdAt: new Date(now.getTime() - 60 * DAY) },
      {
        email: DEMO_ACCOUNTS.trade.email,
        passwordHash: demoHash,
        name: DEMO_ACCOUNTS.trade.name,
        phone: "07700 900456",
        accountType: "trade",
        tradeStatus: "approved",
        tradeDiscountBps: 1000,
        pricesExVat: true,
        createdAt: new Date(now.getTime() - 55 * DAY),
      },
      {
        email: DEMO_ACCOUNTS.pending.email,
        passwordHash: demoHash,
        name: DEMO_ACCOUNTS.pending.name,
        phone: "07700 900789",
        accountType: "trade",
        tradeStatus: "pending",
        createdAt: new Date(now.getTime() - 2 * DAY),
      },
    ])
    .returning();
  await db.insert(t.tradeAccounts).values([
    {
      userId: trade.id,
      companyName: "Smith & Sons Building Ltd",
      companyNumber: "00000001",
      vatNumber: "GB000000001",
      tradeType: "General builder",
      phone: "0121 000 0606",
      monthlySpend: "£2,000–£5,000",
      status: "approved",
      discountBps: 1000,
      reviewedBy: admin.id,
      reviewedAt: new Date(now.getTime() - 54 * DAY),
      createdAt: new Date(now.getTime() - 55 * DAY),
    },
    {
      userId: pending.id,
      companyName: "Kaur Property Maintenance",
      tradeType: "Property maintenance",
      phone: "07700 900789",
      monthlySpend: "£500–£2,000",
      status: "pending",
      notes: "Maintains 40 rental properties across Walsall and Wolverhampton.",
      createdAt: new Date(now.getTime() - 2 * DAY),
    },
  ]);
  const diyAddress: AddressSnapshot = { name: "Jordan Hughes", line1: "27 Rowan Way", town: "Birmingham", postcode: "B17 0XY", phone: "07700 900123" };
  const tradeAddress: AddressSnapshot = {
    name: "Dan Smith",
    line1: "Unit 4, Brookside Trading Estate",
    town: "Wednesbury",
    postcode: "WS10 7QR",
    phone: "07700 900456",
    instructions: "Forklift on site. Deliveries 7:30–16:00.",
  };
  await db.insert(t.addresses).values([
    { userId: diy.id, label: "Home", ...diyAddress, isDefault: true },
    { userId: trade.id, label: "Yard", ...tradeAddress, isDefault: true },
    { userId: trade.id, label: "Current site", name: "Dan Smith", line1: "Plot 12, Meadow View", town: "Tipton", postcode: "DY4 8LA", phone: "07700 900456", instructions: "Site gate on Meadow Lane." },
  ]);
  log("  demo accounts: admin, staff, DIY, trade and a pending trade application");

  // Orders through the real lifecycle
  const guests: { name: string; email: string; address: AddressSnapshot }[] = [
    { name: "Chris Taylor", email: "chris.taylor@example.com", address: { name: "Chris Taylor", line1: "14 Elm Grove", town: "Walsall", postcode: "WS9 8AB", phone: "07700 900201" } },
    { name: "Aisha Khan", email: "aisha.khan@example.com", address: { name: "Aisha Khan", line1: "7 Moseley Court", town: "Birmingham", postcode: "B13 9QT", phone: "07700 900202" } },
    { name: "Mark Evans", email: "mark.evans@example.com", address: { name: "Mark Evans", line1: "22 Hawthorn Close", town: "Coventry", postcode: "CV3 5GH", phone: "07700 900203" } },
    { name: "Sophie Turner", email: "sophie.turner@example.com", address: { name: "Sophie Turner", line1: "3 Mill Lane", town: "Stourbridge", postcode: "DY8 1HJ", phone: "07700 900204" } },
    { name: "Ravi Sharma", email: "ravi.sharma@example.com", address: { name: "Ravi Sharma", line1: "41 Oak Avenue", town: "Wolverhampton", postcode: "WV6 0PL", phone: "07700 900205" } },
    { name: "Emma Wilson", email: "emma.wilson@example.com", address: { name: "Emma Wilson", line1: "9 Station Road", town: "Solihull", postcode: "B91 3RT", phone: "07700 900206" } },
    { name: "Tom Baker", email: "tom.baker@example.com", address: { name: "Tom Baker", line1: "18 Linden Drive", town: "Leamington Spa", postcode: "CV32 6DE", phone: "07700 900207" } },
    { name: "Lucy Green", email: "lucy.green@example.com", address: { name: "Lucy Green", line1: "5 Canal Street", town: "Walsall", postcode: "WS1 2LP", phone: "07700 900208" } },
    { name: "Ben Clarke", email: "ben.clarke@example.com", address: { name: "Ben Clarke", line1: "30 Maple Road", town: "Birmingham", postcode: "B30 2EP", phone: "07700 900209" } },
    { name: "Hannah Price", email: "hannah.price@example.com", address: { name: "Hannah Price", line1: "11 Church Walk", town: "Dudley", postcode: "DY1 1AA", phone: "07700 900210" } },
  ];
  type Basket = [string, number][];
  const B: Record<string, Basket> = {
    boardWall: [["PB-STD-125-TE", 8], ["FX-DWS-38-1000", 1], ["PL-MF-25", 4], ["PL-SCRIM-90", 2]],
    paintRoom: [["DC-VM-WHT-10", 1], ["DC-ROLLER-9", 1], ["DC-MASK-25-50", 2], ["DC-DUSTSHEET", 1]],
    fence: [["LF-PANEL-OL-66", 6], ["LF-POST-75-27", 7], ["LF-GRAVELBOARD-183", 6], ["LF-POSTMIX-20", 14], ["LF-CLIPS-8", 3]],
    bathroom: [["BA-WC-CC", 1], ["BA-BASIN-550", 1], ["BA-TAP-MONO", 1], ["PH-ISO-15", 3], ["FX-SIL-SAN-WHT", 2], ["TF-WALL-WHT-3060", 8], ["TF-ADH-FLEX-20", 3], ["TF-GROUT-WHT-5", 1]],
    tiling: [["TF-FLOOR-GRY-6060", 5], ["TF-ADH-FLEX-20", 3], ["TF-GROUT-GRY-5", 1], ["TF-SPACER-3", 1]],
    studWall: [["TM-CLS-63-24", 16], ["PB-STD-125-TE", 6], ["FX-FRAME-8X100-50", 1], ["FX-WOOD-4X50-200", 1], ["FX-DWS-38-1000", 1], ["IN-ACOUSTIC-50", 1]],
    electrical: [["EL-SKT-2G", 6], ["EL-BOX-1G-35", 6], ["EL-TE-25-50", 1]],
    concrete: [["BM-CEM-25", 12], ["BM-BALLAST-BB", 2], ["BM-MOT1-BB", 2]],
    flooring: [["TF-LAM-OAK-8", 10], ["TF-UNDERLAY-3", 2], ["TF-SCOTIA-OAK-24", 8], ["FX-GRAB-290", 2]],
    loft: [["IN-LOFT-100", 6], ["IN-LOFT-170", 9]],
    smallBits: [["FX-PLUGS-100", 2], ["DC-FILLER-RM", 1], ["DC-CAULK-WHT", 3], ["TL-TAPE-8", 1]],
    restock: [["FX-DWS-38-1000", 4], ["FX-WOOD-4X50-200", 3], ["FX-FRAME-8X100-50", 2], ["PL-MF-25", 10], ["FX-GRAB-290", 6], ["FX-SIL-SAN-WHT", 6]],
    radiators: [["PH-RAD-T22-6001000", 2], ["PH-TRV-15", 2], ["PH-CU-15-3", 2], ["PH-ELB-15", 6]],
    patio: [["LF-SLAB-BUFF-600", 35], ["BM-MOT1-BB", 3], ["BM-SAND-SHP-BB", 2], ["BM-CEM-25", 6]],
    bigJob: [["PB-STD-125-TE", 120], ["TM-CLS-63-24", 150], ["FX-DWS-38-1000", 4], ["PL-MF-25", 40]],
  };
  type Scenario = {
    ageDays: number;
    basket: Basket;
    who: "diy" | "trade" | number;
    outcome: "delivered" | "dispatched" | "part" | "processing" | "paid" | "abandoned" | "cancelled";
    invoice?: "match" | "variance";
    refund?: { sku: string; qty: number; reason: string };
    substitute?: { from: string; to: string; reason: string };
    poRef?: string;
  };
  const scenarios: Scenario[] = [
    { ageDays: 42, basket: B.boardWall, who: "diy", outcome: "delivered", invoice: "match" },
    { ageDays: 38, basket: B.fence, who: 0, outcome: "delivered", invoice: "variance" },
    { ageDays: 35, basket: B.restock, who: "trade", outcome: "delivered", invoice: "match", poRef: "SS-1043" },
    { ageDays: 31, basket: B.bathroom, who: 1, outcome: "delivered", invoice: "match", refund: { sku: "BA-BASIN-550", qty: 1, reason: "basin arrived cracked" } },
    { ageDays: 27, basket: B.paintRoom, who: 2, outcome: "delivered" },
    { ageDays: 24, basket: B.studWall, who: "trade", outcome: "delivered", invoice: "match", poRef: "SS-1051" },
    { ageDays: 21, basket: B.concrete, who: 3, outcome: "delivered", invoice: "match" },
    { ageDays: 18, basket: B.tiling, who: "diy", outcome: "delivered" },
    { ageDays: 15, basket: B.flooring, who: 4, outcome: "delivered", invoice: "match" },
    { ageDays: 12, basket: B.radiators, who: "trade", outcome: "delivered", poRef: "SS-1060" },
    { ageDays: 10, basket: B.patio, who: 5, outcome: "delivered", substitute: { from: "LF-SLAB-BUFF-600", to: "LF-SLAB-GREY-600", reason: "buff slabs sold out at the supplier; customer agreed by phone" } },
    { ageDays: 9, basket: B.electrical, who: 8, outcome: "cancelled" },
    { ageDays: 8, basket: B.loft, who: 6, outcome: "delivered" },
    { ageDays: 5, basket: [...B.restock, ...B.electrical], who: "trade", outcome: "part", poRef: "SS-1072" },
    { ageDays: 4, basket: [...B.paintRoom, ...B.smallBits], who: "diy", outcome: "dispatched" },
    { ageDays: 3, basket: B.boardWall, who: 7, outcome: "processing" },
    { ageDays: 2, basket: B.fence, who: "trade", outcome: "processing", poRef: "SS-1078" },
    { ageDays: 1.2, basket: B.bigJob, who: "trade", outcome: "paid", poRef: "SS-1080" },
    { ageDays: 0.6, basket: B.smallBits, who: 9, outcome: "abandoned" },
    { ageDays: 0.1, basket: B.tiling, who: "diy", outcome: "processing" },
  ];

  const commerceTrade = { tradeDiscountBps: 1000, tradeFloorMarginBps: DEFAULT_SETTINGS.commerce.tradeFloorMarginBps };
  const orderIds: { id: string; number: string; scenario: Scenario; createdAt: Date }[] = [];
  for (const sc of scenarios) {
    const createdAt = new Date(now.getTime() - sc.ageDays * DAY);
    createdAt.setUTCMinutes(intBetween(0, 59));
    const customer =
      sc.who === "diy"
        ? { userId: diy.id, name: diy.name, email: diy.email, address: diyAddress, trade: false }
        : sc.who === "trade"
          ? { userId: trade.id, name: trade.name, email: trade.email, address: tradeAddress, trade: true }
          : { userId: null, name: guests[sc.who].name, email: guests[sc.who].email, address: guests[sc.who].address, trade: false };
    const items = sc.basket.map(([sku, quantity]) => ({ productId: productBySku.get(sku)!.id, quantity }));
    const result = await buildOrderDraft(items, {
      postcode: customer.address.postcode,
      pricing: customer.trade ? commerceTrade : null,
      now: createdAt,
    });
    if (!result.ok) throw new Error(`Seed order failed: ${result.reason} for ${customer.address.postcode}`);
    const order = await createOrder(result.draft, {
      userId: customer.userId,
      email: customer.email,
      name: customer.name,
      phone: customer.address.phone ?? null,
      companyName: customer.trade ? "Smith & Sons Building Ltd" : null,
      poReference: sc.poRef ?? null,
      isTrade: customer.trade,
      address: customer.address,
      provider: "demo",
      source: rand() < 0.35 ? "assistant" : "web",
      createdAt,
    });
    orderIds.push({ id: order.id, number: order.number, scenario: sc, createdAt });

    if (sc.outcome === "abandoned") continue;
    if (sc.outcome === "cancelled") {
      await cancelUnpaidOrder(order.id, "customer");
      continue;
    }
    await markOrderPaid(order.id, { provider: "demo", reference: `demo_${order.number}`, amountGross: result.draft.totalGross });
    if (sc.substitute) {
      const line = await db.query.orderLines.findFirst({
        where: (l, { and, eq: equals }) => and(equals(l.orderId, order.id), equals(l.sku, sc.substitute!.from)),
      });
      if (line) {
        await substituteOrderLine(line.id, { productId: productBySku.get(sc.substitute.to)!.id, reason: sc.substitute.reason, actor: staff.name });
      }
    }
    const shipmentRows = await db.select().from(t.shipments).where(eq(t.shipments.orderId, order.id)).orderBy(asc(t.shipments.estimatedDate));
    const finalStatus = (i: number) => {
      if (sc.outcome === "delivered") return "delivered" as const;
      if (sc.outcome === "dispatched") return "dispatched" as const;
      if (sc.outcome === "part") return i === 0 ? ("dispatched" as const) : null;
      return null;
    };
    for (const [i, s] of shipmentRows.entries()) {
      const target = finalStatus(i);
      if (!target) continue;
      const carrier = s.deliveryClass === "parcel" ? "DPD" : "Supplier vehicle";
      const trackingRef = s.deliveryClass === "parcel" ? `15${intBetween(10000000, 99999999)}` : null;
      await updateShipmentStatus(s.id, { status: "dispatched", carrier, trackingRef, actor: staff.name });
      if (target === "delivered") await updateShipmentStatus(s.id, { status: "delivered", actor: staff.name });
    }
    if (sc.refund) {
      const line = await db.query.orderLines.findFirst({
        where: (l, { and, eq: equals }) => and(equals(l.orderId, order.id), equals(l.sku, sc.refund!.sku)),
      });
      if (line) {
        await issueRefund(order.id, {
          amountGross: line.unitGross * sc.refund.qty,
          reason: sc.refund.reason,
          lines: [{ lineId: line.id, quantity: sc.refund.qty }],
          actor: admin.name,
        });
      }
    }
    if (sc.invoice) {
      const pos = await db.select().from(t.purchaseOrders).where(eq(t.purchaseOrders.orderId, order.id));
      for (const [i, po] of pos.entries()) {
        const variance = sc.invoice === "variance" && i === 0 ? 1500 : 0;
        await recordSupplierInvoice({
          supplierId: po.supplierId,
          orderId: order.id,
          purchaseOrderId: po.id,
          invoiceNumber: `INV-${intBetween(100000, 999999)}`,
          invoiceDate: new Date(createdAt.getTime() + 3 * DAY).toISOString().slice(0, 10),
          goodsNet: po.totalCostNet,
          deliveryNet: po.deliveryCostNet + variance,
          vat: Math.round((po.totalCostNet + po.deliveryCostNet + variance) * 0.2),
          notes: variance ? "Supplier charged an extra £15 for a timed delivery." : null,
          actor: admin.name,
        });
      }
    }
  }
  await backdateOrders(orderIds.map((o) => ({ id: o.id, createdAt: o.createdAt })), now);
  log(`  ${orderIds.length} sample orders with deliveries, purchase orders, invoices and refunds`);

  // Customer activity
  const ord = (i: number) => orderIds[i];
  await db.insert(t.returnRequests).values({
    orderId: ord(7).id,
    userId: diy.id,
    lines: [],
    reason: "changed_mind",
    details: "One box of floor tiles left over, unopened. Can I return it?",
    createdAt: new Date(now.getTime() - 6 * DAY),
  });
  const tickets = [
    {
      userId: trade.id,
      email: trade.email,
      name: trade.name,
      orderId: ord(13).id,
      subject: `When will the electrical items on ${ord(13).number} arrive?`,
      topic: "delivery" as const,
      status: "open" as const,
      priority: "high" as const,
      ageH: 20,
      messages: [{ author: "customer" as const, authorName: trade.name, body: "The fixings turned up yesterday but no sign of the sockets and cable yet. The electrician is booked for Thursday." }],
    },
    {
      userId: null,
      email: guests[1].email,
      name: guests[1].name,
      orderId: ord(3).id,
      subject: "Basin arrived cracked",
      topic: "return" as const,
      status: "resolved" as const,
      priority: "normal" as const,
      ageH: 24 * 29,
      messages: [
        { author: "customer" as const, authorName: guests[1].name, body: "The basin in my order has a crack across the back. Photos attached." },
        { author: "staff" as const, authorName: admin.name, body: "Sorry about that, Aisha. We've refunded the basin in full and the supplier will collect the damaged one. Would you like us to send a replacement?" },
      ],
    },
    {
      userId: null,
      email: "j.morris@example.com",
      name: "Jo Morris",
      orderId: null,
      subject: "Do you deliver to Worcester?",
      topic: "delivery" as const,
      status: "resolved" as const,
      priority: "normal" as const,
      ageH: 24 * 6,
      messages: [
        { author: "customer" as const, authorName: "Jo Morris", body: "Do you deliver to WR5?" },
        { author: "staff" as const, authorName: staff.name, body: "Not yet — we're starting in Birmingham and the Black Country. I've added you to the waiting list for Worcester." },
      ],
    },
    {
      userId: diy.id,
      email: diy.email,
      name: diy.name,
      orderId: null,
      subject: "Which plasterboard for a bathroom ceiling?",
      topic: "product" as const,
      status: "awaiting_customer" as const,
      priority: "normal" as const,
      ageH: 30,
      messages: [
        { author: "customer" as const, authorName: diy.name, body: "Re-boarding the bathroom ceiling. Do I need the green board?" },
        { author: "staff" as const, authorName: staff.name, body: "Yes — moisture-resistant board is the right choice for a bathroom ceiling. Is there an extractor fan in the room?" },
      ],
    },
    {
      userId: pending.id,
      email: pending.email,
      name: pending.name,
      orderId: null,
      subject: "Trade account application",
      topic: "trade" as const,
      status: "open" as const,
      priority: "normal" as const,
      ageH: 46,
      messages: [{ author: "customer" as const, authorName: pending.name, body: "Just applied for a trade account — we'd mainly be ordering decorating and plumbing supplies for rental properties." }],
    },
  ];
  for (const tk of tickets) {
    const createdAt = new Date(now.getTime() - tk.ageH * HOUR);
    const [row] = await db
      .insert(t.supportTickets)
      .values({
        number: newReference("SUP", 5),
        userId: tk.userId,
        email: tk.email,
        name: tk.name,
        orderId: tk.orderId,
        subject: tk.subject,
        topic: tk.topic,
        status: tk.status,
        priority: tk.priority,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + (tk.messages.length - 1) * 3 * HOUR),
      })
      .returning();
    await db.insert(t.ticketMessages).values(
      tk.messages.map((m, i) => ({ ticketId: row.id, ...m, createdAt: new Date(createdAt.getTime() + i * 3 * HOUR) })),
    );
  }

  const [restockList, jobList] = await db
    .insert(t.lists)
    .values([
      { userId: trade.id, name: "Van restock", kind: "saved", notes: "Weekly top-up" },
      {
        userId: diy.id,
        name: "Bedroom repaint",
        kind: "job",
        jobSpec: { type: "paint", inputs: { lengthM: 4, widthM: 3, heightM: 2.4 }, options: { coats: 2 } },
        notes: "Saved from the assistant",
      },
    ])
    .returning();
  await db.insert(t.listItems).values([
    ...B.restock.map(([sku, quantity]) => ({ listId: restockList.id, productId: productBySku.get(sku)!.id, quantity })),
    ...[
      ["DC-VM-WHT-5", 1],
      ["DC-VM-WHT-25", 1],
      ["DC-ROLLER-9", 1],
      ["DC-MASK-25-50", 1],
      ["DC-DUSTSHEET", 1],
    ].map(([sku, quantity]) => ({ listId: jobList.id, productId: productBySku.get(sku as string)!.id, quantity: quantity as number })),
  ]);

  const quoteSkus: Basket = [["PB-STD-125-TE", 24], ["TM-CLS-89-24", 30], ["IN-PIR-100", 10], ["FX-DWS-38-1000", 2], ["PL-MF-25", 10]];
  const quoteDraft = await buildOrderDraft(
    quoteSkus.map(([sku, quantity]) => ({ productId: productBySku.get(sku)!.id, quantity })),
    { postcode: "DY4 8LA", pricing: commerceTrade, now },
  );
  if (quoteDraft.ok) {
    await db.insert(t.quotes).values({
      number: newReference("Q", 5),
      userId: trade.id,
      reference: "Meadow View plot 12 — extension",
      lines: quoteDraft.draft.lines.map((l) => ({
        productId: l.product.id,
        sku: l.product.sku,
        name: l.product.name,
        quantity: l.quantity,
        unitGross: l.price.unitGross,
        vatBps: l.product.vatBps,
      })),
      goodsGross: quoteDraft.draft.goodsGross,
      deliveryGross: quoteDraft.draft.deliveryGross,
      postcode: "DY4 8LA",
      validUntil: new Date(now.getTime() + 27 * DAY),
      createdAt: new Date(now.getTime() - 3 * DAY),
    });
  }

  // Insights
  const docs = prepareDocs(
    productRows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: null,
      categoryName: categoryRows.find((c) => c.id === p.categoryId)!.name,
      tags: p.tags,
      description: p.description,
      popularity: p.popularity,
    })),
  );
  const queries = [
    "plasterboard", "drywall screws", "multi finish", "fence panels", "postcrete", "no nails", "white emulsion 10l",
    "grout", "tile adhesive", "15mm copper pipe", "laminate flooring", "loft insulation", "cls", "sharp sand", "ballast",
    "artex", "kitchen worktop", "decking oil", "door handles", "hanging basket bracket", "oak worktop", "rendering sand",
    "skirting board", "radiator", "tile my bathroom floor", "paint a bedroom 4m x 3m", "how many plasterboards for a 4m wall",
    "shed base 3m x 2m", "socket", "fuse box", "silicone", "expanding foam", "loo", "magnolia", "spirit level", "patio slabs",
    "artex", "kitchen worktop", "composite decking", "plasterboard", "fence panels",
  ];
  const searchRows = Array.from({ length: 90 }, () => {
    const query = queries[intBetween(0, queries.length - 1)];
    return {
      query,
      resultsCount: searchDocs(docs, query).length,
      detectedJob: detectJobInQuery(query),
      source: rand() < 0.75 ? ("search" as const) : ("assistant" as const),
      createdAt: new Date(now.getTime() - between(0, 21) * DAY),
    };
  });
  await db.insert(t.searchLogs).values(searchRows);

  const intents = ["plasterboard", "paint", "tile", "fence", "stud-wall", "concrete-base", "flooring", "loft-insulation", "search", "patio", "skim"];
  const aiRows = Array.from({ length: 120 }, () => {
    const llm = rand() < 0.22;
    const inputTokens = llm ? intBetween(600, 1400) : 0;
    const outputTokens = llm ? intBetween(60, 220) : 0;
    return {
      visitorId: `vis_sample${intBetween(1, 40)}`,
      userId: rand() < 0.3 ? diy.id : null,
      feature: "assistant" as const,
      provider: llm ? ("openai" as const) : ("rules" as const),
      model: llm ? "sample-model" : null,
      intent: intents[intBetween(0, intents.length - 1)],
      inputTokens,
      outputTokens,
      costCentipence: llm ? Math.round(inputTokens * 0.012 + outputTokens * 0.048) : 0,
      latencyMs: llm ? intBetween(700, 2400) : intBetween(3, 25),
      success: rand() > 0.02,
      estimateGross: rand() < 0.6 ? intBetween(4000, 60000) : null,
      addedToBasket: rand() < 0.28,
      createdAt: new Date(now.getTime() - between(0, 14) * DAY),
    };
  });
  await db.insert(t.aiUsage).values(aiRows);

  await db.insert(t.waitlist).values(
    [
      ["sam.r@example.com", "WR5 2AB", "WR"],
      ["k.osei@example.com", "ST16 3DE", "ST"],
      ["mel.d@example.com", "HR1 2FG", "HR"],
      ["olly.b@example.com", "TF3 4HJ", "TF"],
      ["nina.p@example.com", "SY1 1KL", "SY"],
      ["j.morris@example.com", "WR5 3MN", "WR"],
    ].map(([email, postcode, area], i) => ({ email, postcode, area, createdAt: new Date(now.getTime() - (i * 2 + 1) * DAY) })),
  );

  await db.insert(t.feedImports).values([
    { supplierId: supplierByCode.get("WMD")!.id, source: "csv", filename: "wmd-stock-prices.csv", rows: 31, updated: 29, created: 0, errors: ["Row 17: unknown SKU WMD-88213 (not in catalogue)", "Row 24: cost missing"], createdBy: admin.name, createdAt: new Date(now.getTime() - 2 * DAY) },
    { supplierId: supplierByCode.get("BCP")!.id, source: "csv", filename: "bcp-nightly.csv", rows: 20, updated: 20, created: 0, errors: [], createdBy: "Scheduled import", createdAt: new Date(now.getTime() - 20 * HOUR) },
    { supplierId: supplierByCode.get("MBM")!.id, source: "api", filename: null, rows: 58, updated: 58, created: 0, errors: [], createdBy: "API sync", createdAt: new Date(now.getTime() - 3 * HOUR) },
  ]);
  await db.insert(t.auditLog).values([
    { actorId: admin.id, actorName: admin.name, action: "trade.approve", entity: "user", entityId: trade.id, summary: "Approved trade account for Smith & Sons Building Ltd at 10% discount", createdAt: new Date(now.getTime() - 54 * DAY) },
    { actorId: admin.id, actorName: admin.name, action: "pricing.update", entity: "pricing_rule", entityId: null, summary: "Set Tools markup to 40% with a 20% minimum margin", createdAt: new Date(now.getTime() - 9 * DAY) },
    { actorId: admin.id, actorName: admin.name, action: "feed.import", entity: "supplier", entityId: supplierByCode.get("WMD")!.id, summary: "Imported WMD price and stock file (29 offers updated)", createdAt: new Date(now.getTime() - 2 * DAY) },
  ]);
  log("  support tickets, lists, a trade quote, search and AI activity, waitlist and audit history");
}

/** Spreads each seeded order's history over realistic times instead of "now". */
async function backdateOrders(list: { id: string; createdAt: Date }[], now: Date) {
  const clamp = (d: Date) => new Date(Math.min(d.getTime(), now.getTime() - 5 * 60_000));
  for (const { id, createdAt } of list) {
    const c = createdAt.getTime();
    const shipmentRows = await db.select().from(t.shipments).where(eq(t.shipments.orderId, id));
    const at = (iso: string, hour: number) => clamp(new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`));
    for (const s of shipmentRows) {
      await db
        .update(t.shipments)
        .set({
          createdAt: new Date(c),
          dispatchedAt: s.dispatchedAt ? at(s.estimatedDate, 7) : null,
          deliveredAt: s.deliveredAt ? at(s.estimatedDate, 13) : null,
        })
        .where(eq(t.shipments.id, s.id));
    }
    const firstDelivery = shipmentRows.map((s) => s.estimatedDate).sort()[0];
    const lastDelivery = shipmentRows.map((s) => s.estimatedDate).sort().at(-1);
    const events = await db.select().from(t.orderEvents).where(eq(t.orderEvents.orderId, id)).orderBy(sql`rowid`);
    for (const [i, e] of events.entries()) {
      let when = new Date(c + i * 4 * 60_000);
      if (e.type === "shipment_dispatched" && firstDelivery) when = at(firstDelivery, 7);
      if (e.type === "shipment_delivered" && lastDelivery) when = at(lastDelivery, 13);
      if (e.type === "refund" || e.type === "supplier_invoice") when = clamp(new Date(c + 3 * DAY + i * 60_000));
      if (e.type === "substitution") when = new Date(c + 5 * HOUR);
      await db.update(t.orderEvents).set({ createdAt: clamp(when) }).where(eq(t.orderEvents.id, e.id));
    }
    await db.update(t.orders).set({ createdAt: new Date(c), updatedAt: clamp(new Date(c + DAY)) }).where(eq(t.orders.id, id));
    await db
      .update(t.orders)
      .set({ paidAt: new Date(c + 3 * 60_000) })
      .where(eq(t.orders.id, id));
    const pos = await db.select().from(t.purchaseOrders).where(eq(t.purchaseOrders.orderId, id));
    for (const po of pos) {
      await db
        .update(t.purchaseOrders)
        .set({ createdAt: new Date(c + 5 * 60_000), sentAt: new Date(c + 5 * 60_000), acknowledgedAt: po.acknowledgedAt ? new Date(c + 6 * 60_000) : null })
        .where(eq(t.purchaseOrders.id, po.id));
    }
    await db.update(t.refunds).set({ createdAt: clamp(new Date(c + 3 * DAY)) }).where(eq(t.refunds.orderId, id));
    await db.update(t.supplierInvoices).set({ createdAt: clamp(new Date(c + 3 * DAY)) }).where(eq(t.supplierInvoices.orderId, id));
    await db.update(t.notifications).set({ createdAt: new Date(c + 4 * 60_000) }).where(eq(t.notifications.orderId, id));
  }
  const unpaid = await db.select({ id: t.orders.id }).from(t.orders).where(inArray(t.orders.paymentStatus, ["unpaid"]));
  for (const o of unpaid) await db.update(t.orders).set({ paidAt: null }).where(eq(t.orders.id, o.id));
}

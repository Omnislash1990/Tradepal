import { relations } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ImageKey, ProductAttributes } from "@/lib/catalog/types";
import type { DeliveryClass, SupplierDeliveryCosts, ZoneRates } from "@/lib/domain/delivery";
import type { JobSpec } from "@/lib/domain/estimator/types";
import type { Rounding } from "@/lib/domain/pricing";
import type { StockStatus } from "@/lib/domain/sourcing";
import { newId } from "../ids";

const id = (prefix: string) =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId(prefix));
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());
const bool = (name: string) => integer(name, { mode: "boolean" });
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export type Role = "customer" | "staff" | "admin";
export type AccountType = "diy" | "trade";
export type TradeStatus = "none" | "pending" | "approved" | "rejected";

export type AddressSnapshot = {
  name: string;
  line1: string;
  line2?: string | null;
  town: string;
  county?: string | null;
  postcode: string;
  phone?: string | null;
  instructions?: string | null;
};

// Accounts

export const users = sqliteTable("users", {
  id: id("usr"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").$type<Role>().notNull().default("customer"),
  accountType: text("account_type").$type<AccountType>().notNull().default("diy"),
  tradeStatus: text("trade_status").$type<TradeStatus>().notNull().default("none"),
  tradeDiscountBps: integer("trade_discount_bps").notNull().default(0),
  marketingOptIn: bool("marketing_opt_in").notNull().default(false),
  pricesExVat: bool("prices_ex_vat").notNull().default(false),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the cookie token, so a leaked database can't be used to sign in. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const tradeAccounts = sqliteTable("trade_accounts", {
  id: id("trd"),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  companyNumber: text("company_number"),
  vatNumber: text("vat_number"),
  tradeType: text("trade_type").notNull(),
  phone: text("phone"),
  monthlySpend: text("monthly_spend"),
  status: text("status").$type<Exclude<TradeStatus, "none">>().notNull().default("pending"),
  discountBps: integer("discount_bps").notNull().default(0),
  notes: text("notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: ts("reviewed_at"),
  createdAt: createdAt(),
});

export const addresses = sqliteTable(
  "addresses",
  {
    id: id("adr"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    name: text("name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    town: text("town").notNull(),
    county: text("county"),
    postcode: text("postcode").notNull(),
    phone: text("phone"),
    instructions: text("instructions"),
    isDefault: bool("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

// Catalogue

export const categories = sqliteTable("categories", {
  id: id("cat"),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("Package"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = sqliteTable(
  "products",
  {
    id: id("prd"),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull().default(""),
    unit: text("unit").notNull().default("each"),
    imageKey: text("image_key").$type<ImageKey>().notNull().default("board"),
    imageUrl: text("image_url"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    attributes: text("attributes", { mode: "json" }).$type<ProductAttributes>().notNull().$defaultFn(() => ({})),
    specs: text("specs", { mode: "json" }).$type<Record<string, string>>().notNull().$defaultFn(() => ({})),
    compatibleSkus: text("compatible_skus", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    family: text("family"),
    altNote: text("alt_note"),
    safetyNote: text("safety_note"),
    vatBps: integer("vat_bps").notNull().default(2000),
    deliveryClass: text("delivery_class").$type<DeliveryClass>().notNull().default("standard"),
    weightKg: real("weight_kg"),
    /** Current selling price inc VAT, recalculated from offers and pricing rules. */
    retailPriceGross: integer("retail_price_gross").notNull().default(0),
    priceOverrideGross: integer("price_override_gross"),
    /** Cheapest verified supplier cost used for the current price (ex VAT). */
    refCostNet: integer("ref_cost_net"),
    marginBps: integer("margin_bps"),
    pricingRuleId: text("pricing_rule_id"),
    priceUpdatedAt: ts("price_updated_at"),
    promoBps: integer("promo_bps"),
    promoEndsAt: ts("promo_ends_at"),
    active: bool("active").notNull().default(true),
    popularity: integer("popularity").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_family_idx").on(t.family)],
);

// Suppliers & pricing

export type SupplierIntegration = "api" | "csv" | "email";

export const suppliers = sqliteTable("suppliers", {
  id: id("sup"),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  integration: text("integration").$type<SupplierIntegration>().notNull().default("email"),
  servesAreas: text("serves_areas", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  leadTimeDays: integer("lead_time_days").notNull().default(2),
  cutoffHour: integer("cutoff_hour").notNull().default(13),
  deliversSaturday: bool("delivers_saturday").notNull().default(false),
  deliveryCosts: text("delivery_costs", { mode: "json" }).$type<SupplierDeliveryCosts>().notNull(),
  accountNumber: text("account_number"),
  paymentTerms: text("payment_terms"),
  isSample: bool("is_sample").notNull().default(false),
  active: bool("active").notNull().default(true),
  notes: text("notes"),
  lastFeedAt: ts("last_feed_at"),
  createdAt: createdAt(),
});

export const supplierOffers = sqliteTable(
  "supplier_offers",
  {
    id: id("ofr"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    supplierSku: text("supplier_sku").notNull(),
    costNet: integer("cost_net").notNull(),
    stockStatus: text("stock_status").$type<StockStatus>().notNull().default("unknown"),
    stockQty: integer("stock_qty"),
    leadTimeDays: integer("lead_time_days"),
    /** Stock confirmed by a live feed rather than assumed. */
    verified: bool("verified").notNull().default(false),
    active: bool("active").notNull().default(true),
    lastSyncedAt: ts("last_synced_at"),
  },
  (t) => [
    uniqueIndex("offers_supplier_product_idx").on(t.supplierId, t.productId),
    index("offers_product_idx").on(t.productId),
  ],
);

export const pricingRules = sqliteTable("pricing_rules", {
  id: id("prc"),
  name: text("name").notNull(),
  scope: text("scope").$type<"global" | "category" | "supplier">().notNull(),
  scopeId: text("scope_id"),
  markupBps: integer("markup_bps").notNull(),
  minMarginBps: integer("min_margin_bps").notNull().default(0),
  rounding: text("rounding").$type<Rounding>().notNull().default("end9"),
  priority: integer("priority").notNull().default(0),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

export const deliveryZones = sqliteTable("delivery_zones", {
  id: id("zon"),
  name: text("name").notNull(),
  postcodePrefixes: text("postcode_prefixes", { mode: "json" }).$type<string[]>().notNull(),
  rates: text("rates", { mode: "json" }).$type<ZoneRates>().notNull(),
  extraLeadDays: integer("extra_lead_days").notNull().default(0),
  active: bool("active").notNull().default(true),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const feedImports = sqliteTable("feed_imports", {
  id: id("fed"),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  source: text("source").$type<"csv" | "api">().notNull(),
  filename: text("filename"),
  rows: integer("rows").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  created: integer("created").notNull().default(0),
  errors: text("errors", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

// Baskets & lists

export const baskets = sqliteTable(
  "baskets",
  {
    id: id("bsk"),
    token: text("token").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    postcode: text("postcode"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("baskets_user_idx").on(t.userId)],
);

export const basketItems = sqliteTable(
  "basket_items",
  {
    id: id("bki"),
    basketId: text("basket_id")
      .notNull()
      .references(() => baskets.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    source: text("source").$type<"manual" | "assistant" | "reorder" | "list" | "quote">().notNull().default("manual"),
    addedAt: createdAt(),
  },
  (t) => [uniqueIndex("basket_items_unique_idx").on(t.basketId, t.productId)],
);

export const lists = sqliteTable(
  "lists",
  {
    id: id("lst"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<"saved" | "job">().notNull().default("saved"),
    jobSpec: text("job_spec", { mode: "json" }).$type<JobSpec>(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lists_user_idx").on(t.userId)],
);

export const listItems = sqliteTable(
  "list_items",
  {
    id: id("lsi"),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    note: text("note"),
  },
  (t) => [uniqueIndex("list_items_unique_idx").on(t.listId, t.productId)],
);

export type QuoteLine = { productId: string; sku: string; name: string; quantity: number; unitGross: number; vatBps: number };

export const quotes = sqliteTable(
  "quotes",
  {
    id: id("quo"),
    number: text("number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reference: text("reference"),
    lines: text("lines", { mode: "json" }).$type<QuoteLine[]>().notNull(),
    goodsGross: integer("goods_gross").notNull(),
    deliveryGross: integer("delivery_gross").notNull().default(0),
    postcode: text("postcode"),
    validUntil: ts("valid_until").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quotes_user_idx").on(t.userId)],
);

// Orders

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "part_dispatched"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "refunded";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "partially_refunded" | "refunded";

export const orders = sqliteTable(
  "orders",
  {
    id: id("ord"),
    number: text("number").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    companyName: text("company_name"),
    poReference: text("po_reference"),
    isTrade: bool("is_trade").notNull().default(false),
    status: text("status").$type<OrderStatus>().notNull().default("pending_payment"),
    paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("unpaid"),
    deliveryAddress: text("delivery_address", { mode: "json" }).$type<AddressSnapshot>().notNull(),
    zoneId: text("zone_id"),
    goodsGross: integer("goods_gross").notNull(),
    deliveryGross: integer("delivery_gross").notNull(),
    totalGross: integer("total_gross").notNull(),
    vatTotal: integer("vat_total").notNull(),
    savingsGross: integer("savings_gross").notNull().default(0),
    // Estimated at checkout.
    estSupplierCostNet: integer("est_supplier_cost_net").notNull().default(0),
    estSupplierDeliveryNet: integer("est_supplier_delivery_net").notNull().default(0),
    estPaymentFee: integer("est_payment_fee").notNull().default(0),
    // Actuals, filled in as supplier invoices, refunds and payouts arrive.
    actualPaymentFee: integer("actual_payment_fee"),
    refundedGross: integer("refunded_gross").notNull().default(0),
    paymentProvider: text("payment_provider").$type<"stripe" | "demo">().notNull().default("demo"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: ts("paid_at"),
    source: text("source").$type<"web" | "assistant" | "quote">().notNull().default("web"),
    trackingToken: text("tracking_token").notNull(),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status), index("orders_created_idx").on(t.createdAt)],
);

export type ShipmentStatus = "pending" | "po_sent" | "confirmed" | "dispatched" | "delivered" | "failed" | "cancelled";

export const shipments = sqliteTable(
  "shipments",
  {
    id: id("shp"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    deliveryClass: text("delivery_class").$type<DeliveryClass>().notNull(),
    status: text("status").$type<ShipmentStatus>().notNull().default("pending"),
    customerChargeGross: integer("customer_charge_gross").notNull().default(0),
    supplierDeliveryCostNet: integer("supplier_delivery_cost_net").notNull().default(0),
    estimatedDate: text("estimated_date").notNull(),
    carrier: text("carrier"),
    trackingRef: text("tracking_ref"),
    dispatchedAt: ts("dispatched_at"),
    deliveredAt: ts("delivered_at"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId), index("shipments_supplier_idx").on(t.supplierId)],
);

export type LineStatus = "active" | "cancelled" | "substituted";

export const orderLines = sqliteTable(
  "order_lines",
  {
    id: id("oli"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shipmentId: text("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    supplierId: text("supplier_id").references(() => suppliers.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitGross: integer("unit_gross").notNull(),
    regularUnitGross: integer("regular_unit_gross").notNull(),
    vatBps: integer("vat_bps").notNull(),
    unitCostNet: integer("unit_cost_net").notNull().default(0),
    priceKind: text("price_kind").$type<"regular" | "promo" | "trade">().notNull().default("regular"),
    status: text("status").$type<LineStatus>().notNull().default("active"),
    substitutedFrom: text("substituted_from"),
    refundedQty: integer("refunded_qty").notNull().default(0),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId), index("order_lines_product_idx").on(t.productId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: id("oev"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    actor: text("actor").notNull().default("system"),
    /** Visible to the customer on their tracking page. */
    customerVisible: bool("customer_visible").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export type PoStatus = "draft" | "sent" | "acknowledged" | "failed" | "cancelled";

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: id("pur"),
    number: text("number").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    method: text("method").$type<"api" | "email" | "manual">().notNull(),
    status: text("status").$type<PoStatus>().notNull().default("draft"),
    totalCostNet: integer("total_cost_net").notNull(),
    deliveryCostNet: integer("delivery_cost_net").notNull().default(0),
    supplierRef: text("supplier_ref"),
    payload: text("payload"),
    error: text("error"),
    sentAt: ts("sent_at"),
    acknowledgedAt: ts("acknowledged_at"),
    createdAt: createdAt(),
  },
  (t) => [index("po_order_idx").on(t.orderId), index("po_supplier_idx").on(t.supplierId)],
);

export const supplierInvoices = sqliteTable(
  "supplier_invoices",
  {
    id: id("sin"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    purchaseOrderId: text("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    goodsNet: integer("goods_net").notNull(),
    deliveryNet: integer("delivery_net").notNull().default(0),
    vat: integer("vat").notNull().default(0),
    status: text("status").$type<"received" | "matched" | "disputed" | "paid">().notNull().default("received"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("sinv_order_idx").on(t.orderId)],
);

export const refunds = sqliteTable(
  "refunds",
  {
    id: id("ref"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amountGross: integer("amount_gross").notNull(),
    reason: text("reason").notNull(),
    lines: text("lines", { mode: "json" }).$type<{ lineId: string; quantity: number }[]>().notNull().$defaultFn(() => []),
    provider: text("provider").$type<"stripe" | "demo" | "manual">().notNull(),
    providerRef: text("provider_ref"),
    status: text("status").$type<"pending" | "succeeded" | "failed">().notNull().default("pending"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

export const returnRequests = sqliteTable(
  "return_requests",
  {
    id: id("ret"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    lines: text("lines", { mode: "json" }).$type<{ lineId: string; quantity: number }[]>().notNull(),
    reason: text("reason").$type<"changed_mind" | "damaged" | "wrong_item" | "faulty" | "other">().notNull(),
    details: text("details"),
    status: text("status").$type<"requested" | "approved" | "collected" | "refunded" | "rejected">().notNull().default("requested"),
    createdAt: createdAt(),
  },
  (t) => [index("returns_order_idx").on(t.orderId)],
);

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: id("pev"),
    /** Provider event id, used to ignore duplicate webhook deliveries. */
    providerEventId: text("provider_event_id").unique(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    provider: text("provider").$type<"stripe" | "demo">().notNull(),
    type: text("type").notNull(),
    amountGross: integer("amount_gross"),
    fee: integer("fee"),
    reference: text("reference"),
    createdAt: createdAt(),
  },
  (t) => [index("payment_events_order_idx").on(t.orderId)],
);

// Support & communications

export const supportTickets = sqliteTable(
  "support_tickets",
  {
    id: id("tkt"),
    number: text("number").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    topic: text("topic").$type<"order" | "delivery" | "product" | "return" | "account" | "trade" | "other">().notNull(),
    status: text("status").$type<"open" | "awaiting_customer" | "resolved">().notNull().default("open"),
    priority: text("priority").$type<"normal" | "high">().notNull().default("normal"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tickets_user_idx").on(t.userId), index("tickets_status_idx").on(t.status)],
);

export const ticketMessages = sqliteTable(
  "ticket_messages",
  {
    id: id("tkm"),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    author: text("author").$type<"customer" | "staff">().notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: id("ntf"),
    channel: text("channel").$type<"email">().notNull().default("email"),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    template: text("template").notNull(),
    status: text("status").$type<"queued" | "sent" | "failed" | "logged">().notNull().default("queued"),
    provider: text("provider"),
    providerId: text("provider_id"),
    error: text("error"),
    orderId: text("order_id"),
    userId: text("user_id"),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt)],
);

export const waitlist = sqliteTable("waitlist", {
  id: id("wtl"),
  email: text("email").notNull(),
  postcode: text("postcode").notNull(),
  area: text("area").notNull(),
  createdAt: createdAt(),
});

// Insights & AI

export const searchLogs = sqliteTable(
  "search_logs",
  {
    id: id("srl"),
    query: text("query").notNull(),
    resultsCount: integer("results_count").notNull(),
    source: text("source").$type<"search" | "assistant">().notNull().default("search"),
    detectedJob: text("detected_job"),
    userId: text("user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("search_logs_created_idx").on(t.createdAt)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: id("aiu"),
    userId: text("user_id"),
    visitorId: text("visitor_id").notNull(),
    feature: text("feature").$type<"assistant" | "search">().notNull(),
    provider: text("provider").$type<"rules" | "openai" | "anthropic" | "gemini">().notNull(),
    model: text("model"),
    intent: text("intent"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Estimated cost in hundredths of a penny. */
    costCentipence: integer("cost_centipence").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    success: bool("success").notNull().default(true),
    estimateGross: integer("estimate_gross"),
    addedToBasket: bool("added_to_basket").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt), index("ai_usage_visitor_idx").on(t.visitorId)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id("aud"),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

// Relations

export const usersRelations = relations(users, ({ many, one }) => ({
  addresses: many(addresses),
  orders: many(orders),
  lists: many(lists),
  tradeAccount: one(tradeAccounts, { fields: [users.id], references: [tradeAccounts.userId] }),
}));

export const tradeAccountsRelations = relations(tradeAccounts, ({ one }) => ({
  user: one(users, { fields: [tradeAccounts.userId], references: [users.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  offers: many(supplierOffers),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({ offers: many(supplierOffers) }));

export const supplierOffersRelations = relations(supplierOffers, ({ one }) => ({
  supplier: one(suppliers, { fields: [supplierOffers.supplierId], references: [suppliers.id] }),
  product: one(products, { fields: [supplierOffers.productId], references: [products.id] }),
}));

export const basketsRelations = relations(baskets, ({ many }) => ({ items: many(basketItems) }));

export const basketItemsRelations = relations(basketItems, ({ one }) => ({
  basket: one(baskets, { fields: [basketItems.basketId], references: [baskets.id] }),
  product: one(products, { fields: [basketItems.productId], references: [products.id] }),
}));

export const listsRelations = relations(lists, ({ many, one }) => ({
  items: many(listItems),
  user: one(users, { fields: [lists.userId], references: [users.id] }),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
  product: one(products, { fields: [listItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  lines: many(orderLines),
  shipments: many(shipments),
  events: many(orderEvents),
  purchaseOrders: many(purchaseOrders),
  refunds: many(refunds),
  supplierInvoices: many(supplierInvoices),
  returns: many(returnRequests),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  supplier: one(suppliers, { fields: [shipments.supplierId], references: [suppliers.id] }),
  lines: many(orderLines),
  purchaseOrders: many(purchaseOrders),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
  shipment: one(shipments, { fields: [orderLines.shipmentId], references: [shipments.id] }),
  product: one(products, { fields: [orderLines.productId], references: [products.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one }) => ({
  order: one(orders, { fields: [purchaseOrders.orderId], references: [orders.id] }),
  shipment: one(shipments, { fields: [purchaseOrders.shipmentId], references: [shipments.id] }),
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one }) => ({
  order: one(orders, { fields: [supplierInvoices.orderId], references: [orders.id] }),
  supplier: one(suppliers, { fields: [supplierInvoices.supplierId], references: [suppliers.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
}));

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ many, one }) => ({
  messages: many(ticketMessages),
  order: one(orders, { fields: [supportTickets.orderId], references: [orders.id] }),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketMessages.ticketId], references: [supportTickets.id] }),
}));

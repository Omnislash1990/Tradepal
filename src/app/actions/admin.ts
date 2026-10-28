"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import {
  feedImports,
  pricingRules,
  products,
  supplierOffers,
  suppliers,
  supportTickets,
  ticketMessages,
  tradeAccounts,
  users,
} from "@/lib/db/schema";
import { parsePoundsInput } from "@/lib/domain/money";
import { audit } from "@/lib/server/audit";
import { can, requireStaff, type Permission } from "@/lib/server/auth";
import { sendEmail } from "@/lib/server/notify";
import type { ShipmentStatus } from "@/lib/db/schema";
import {
  cancelOrderLine,
  issueRefund,
  recordSupplierInvoice,
  runOrderAutomation,
  substituteOrderLine,
  updateShipmentStatus,
} from "@/lib/server/orders";
import { applyPriceChanges, computePriceChanges, repriceProducts } from "@/lib/server/repricing";
import { getSettings, saveSettings, type AppSettings } from "@/lib/server/settings";

export type AdminResult = { ok: boolean; message: string } | null;

async function staff(permission: Permission) {
  const user = await requireStaff(permission);
  if (!can(user, permission)) throw new Error("Not allowed");
  return user;
}

export async function updateShipmentAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("orders.manage");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const status = String(formData.get("status") ?? "") as ShipmentStatus;
  if (!shipmentId || !status) return { ok: false, message: "Missing delivery details." };
  await updateShipmentStatus(shipmentId, {
    status,
    carrier: String(formData.get("carrier") ?? "") || null,
    trackingRef: String(formData.get("trackingRef") ?? "") || null,
    actor: actor.name,
  });
  refresh();
  return { ok: true, message: "Delivery updated." };
}

export async function refundOrderAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("refunds.issue");
  const orderId = String(formData.get("orderId") ?? "");
  const amount = parsePoundsInput(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!orderId || amount == null || !reason) return { ok: false, message: "Amount and reason are required." };
  const result = await issueRefund(orderId, { amountGross: amount, reason, actor: actor.name });
  if (!result.ok) return { ok: false, message: result.error };
  await audit(actor, { action: "refund.issue", entity: "order", entityId: orderId, summary: `Refunded ${reason}` });
  refresh();
  return { ok: true, message: "Refund issued." };
}

export async function cancelLineAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("orders.manage");
  const result = await cancelOrderLine(String(formData.get("lineId") ?? ""), {
    reason: String(formData.get("reason") ?? "unavailable"),
    actor: actor.name,
  });
  refresh();
  return result.ok ? { ok: true, message: "Line cancelled." } : { ok: false, message: result.error };
}

export async function substituteLineAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("orders.manage");
  const result = await substituteOrderLine(String(formData.get("lineId") ?? ""), {
    productId: String(formData.get("productId") ?? ""),
    reason: String(formData.get("reason") ?? "substitution"),
    actor: actor.name,
  });
  refresh();
  return result.ok ? { ok: true, message: "Item substituted." } : { ok: false, message: "error" in result ? result.error : "Couldn't substitute." };
}

export async function sendPurchaseOrdersAction(formData: FormData): Promise<void> {
  const actor = await staff("orders.manage");
  const orderId = String(formData.get("orderId") ?? "");
  await runOrderAutomation(orderId, { force: true, actor: actor.name });
  refresh();
}

export async function addSupplierInvoiceAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("orders.manage");
  const orderId = String(formData.get("orderId") ?? "") || null;
  const goodsNet = parsePoundsInput(formData.get("goodsNet"));
  const deliveryNet = parsePoundsInput(formData.get("deliveryNet")) ?? 0;
  const vat = parsePoundsInput(formData.get("vat")) ?? 0;
  if (goodsNet == null) return { ok: false, message: "Goods amount is required." };
  await recordSupplierInvoice({
    supplierId: String(formData.get("supplierId") ?? ""),
    orderId,
    purchaseOrderId: String(formData.get("purchaseOrderId") ?? "") || null,
    invoiceNumber: String(formData.get("invoiceNumber") ?? "").trim(),
    invoiceDate: String(formData.get("invoiceDate") ?? new Date().toISOString().slice(0, 10)),
    goodsNet,
    deliveryNet,
    vat,
    notes: String(formData.get("notes") ?? "") || null,
    actor: actor.name,
  });
  await audit(actor, { action: "invoice.record", entity: "supplier_invoice", summary: `Recorded supplier invoice ${formData.get("invoiceNumber")}` });
  refresh();
  return { ok: true, message: "Invoice recorded." };
}

export async function saveProductAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("products.edit");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing product." };
  const override = String(formData.get("priceOverride") ?? "").trim();
  const promo = String(formData.get("promoBps") ?? "").trim();
  await db
    .update(products)
    .set({
      name: String(formData.get("name") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? ""),
      active: formData.get("active") === "on",
      priceOverrideGross: override ? parsePoundsInput(override) : null,
      promoBps: promo ? Math.round(Number(promo) * 100) : null,
      safetyNote: String(formData.get("safetyNote") ?? "") || null,
    })
    .where(eq(products.id, id));
  await repriceProducts([id]);
  await audit(actor, { action: "product.update", entity: "product", entityId: id, summary: `Updated ${formData.get("name")}` });
  refresh();
  return { ok: true, message: "Product saved." };
}

export async function savePricingRuleAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("pricing.edit");
  const id = String(formData.get("id") ?? "");
  const markupPct = Number(formData.get("markupPct"));
  const minMarginPct = Number(formData.get("minMarginPct"));
  if (!Number.isFinite(markupPct)) return { ok: false, message: "Enter a markup percentage." };
  const values = {
    name: String(formData.get("name") ?? "Rule").trim(),
    markupBps: Math.round(markupPct * 100),
    minMarginBps: Number.isFinite(minMarginPct) ? Math.round(minMarginPct * 100) : 0,
    rounding: (String(formData.get("rounding") ?? "end9") as "none" | "end9" | "end49or99"),
    active: formData.get("active") === "on",
  };
  if (id) await db.update(pricingRules).set(values).where(eq(pricingRules.id, id));
  else {
    await db.insert(pricingRules).values({
      ...values,
      scope: (String(formData.get("scope") ?? "global") as "global" | "category" | "supplier"),
      scopeId: String(formData.get("scopeId") ?? "") || null,
      priority: Number(formData.get("priority") ?? 0) || 0,
    });
  }
  const changes = await computePriceChanges();
  const applied = await applyPriceChanges(changes);
  await audit(actor, { action: "pricing.update", entity: "pricing_rule", entityId: id || null, summary: `${values.name}: repriced ${applied} products` });
  refresh();
  return { ok: true, message: `Rule saved. ${applied} prices updated.` };
}

export async function approveTradeAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("trade.approve");
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision") === "reject" ? "rejected" : "approved";
  const discountPct = Number(formData.get("discountPct") ?? 0);
  const account = await db.query.tradeAccounts.findFirst({ where: eq(tradeAccounts.id, id) });
  if (!account) return { ok: false, message: "Application not found." };
  const discountBps = decision === "approved" ? Math.round((Number.isFinite(discountPct) ? discountPct : 0) * 100) : 0;
  await db
    .update(tradeAccounts)
    .set({ status: decision, discountBps, reviewedBy: actor.id, reviewedAt: new Date(), notes: String(formData.get("notes") ?? "") || account.notes })
    .where(eq(tradeAccounts.id, id));
  await db
    .update(users)
    .set({
      tradeStatus: decision,
      tradeDiscountBps: discountBps,
      accountType: "trade",
      pricesExVat: decision === "approved",
    })
    .where(eq(users.id, account.userId));
  const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) });
  if (user && decision === "approved") {
    await sendEmail({
      to: user.email,
      subject: "Your Tradepal trade account is approved",
      template: "trade_approved",
      userId: user.id,
      body: `Hi ${user.name.split(" ")[0]},\n\nYour trade account for ${account.companyName} has been approved${discountBps ? ` with a ${discountPct}% discount` : ""}. Sign in to see trade prices.\n\nWelcome aboard.`,
    });
  }
  await audit(actor, { action: `trade.${decision === "approved" ? "approve" : "reject"}`, entity: "user", entityId: account.userId, summary: `${decision} ${account.companyName}` });
  refresh();
  return { ok: true, message: decision === "approved" ? "Trade account approved." : "Application rejected." };
}

export async function replyStaffTicketAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("support.manage");
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, message: "Write a reply." };
  const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, ticketId) });
  if (!ticket) return { ok: false, message: "Ticket not found." };
  await db.insert(ticketMessages).values({ ticketId, author: "staff", authorName: actor.name, body });
  await db
    .update(supportTickets)
    .set({ status: formData.get("resolve") === "on" ? "resolved" : "awaiting_customer", updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));
  await sendEmail({
    to: ticket.email,
    subject: `Re: ${ticket.subject}`,
    template: "ticket_reply",
    userId: ticket.userId,
    body: `Hi ${ticket.name.split(" ")[0]},\n\n${body}\n\n— ${actor.name}, Tradepal support`,
  });
  refresh();
  return { ok: true, message: "Reply sent." };
}

export async function saveSettingsAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("settings.edit");
  const current = await getSettings();
  const group = String(formData.get("group") ?? "business") as keyof AppSettings;
  if (group === "business") {
    await saveSettings("business", {
      ...current.business,
      tradingName: String(formData.get("tradingName") ?? current.business.tradingName),
      legalName: String(formData.get("legalName") ?? ""),
      companyNumber: String(formData.get("companyNumber") ?? ""),
      vatNumber: String(formData.get("vatNumber") ?? ""),
      vatRegistered: formData.get("vatRegistered") === "on",
      address: String(formData.get("address") ?? ""),
      email: String(formData.get("email") ?? current.business.email),
      phone: String(formData.get("phone") ?? ""),
    });
  } else if (group === "commerce") {
    await saveSettings("commerce", {
      ...current.commerce,
      paymentFeeBps: Math.round(Number(formData.get("paymentFeePct") ?? 1.5) * 100),
      paymentFeeFixed: parsePoundsInput(formData.get("paymentFeeFixed")) ?? current.commerce.paymentFeeFixed,
      defaultTradeDiscountBps: Math.round(Number(formData.get("defaultTradeDiscountPct") ?? 5) * 100),
      tradeFloorMarginBps: Math.round(Number(formData.get("tradeFloorMarginPct") ?? 12) * 100),
      autoSendPurchaseOrders: formData.get("autoSendPurchaseOrders") === "on",
      manualReviewOverGross: parsePoundsInput(formData.get("manualReviewOver")) ?? current.commerce.manualReviewOverGross,
      quoteValidityDays: Number(formData.get("quoteValidityDays") ?? 30) || 30,
    });
  } else if (group === "ai") {
    await saveSettings("ai", {
      ...current.ai,
      dailyLlmLimit: Number(formData.get("dailyLlmLimit") ?? current.ai.dailyLlmLimit) || 0,
      visitorHourlyLimit: Number(formData.get("visitorHourlyLimit") ?? current.ai.visitorHourlyLimit) || 40,
      llmEnabled: formData.get("llmEnabled") === "on",
    });
  }
  await audit(actor, { action: "settings.update", entity: "settings", summary: `Updated ${group} settings` });
  refresh();
  return { ok: true, message: "Settings saved." };
}

export async function importSupplierCsvAction(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  const actor = await staff("suppliers.edit");
  const supplierId = String(formData.get("supplierId") ?? "");
  const csv = String(formData.get("csv") ?? "");
  if (!supplierId || !csv.trim()) return { ok: false, message: "Choose a supplier and paste a CSV." };
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, supplierId) });
  if (!supplier) return { ok: false, message: "Supplier not found." };
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase();
  const start = header.includes("sku") ? 1 : 0;
  let updated = 0;
  let created = 0;
  const errors: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const sku = cols[0];
    const cost = parsePoundsInput(cols[1]);
    const stockStatus = (cols[2] || "in_stock") as "in_stock" | "low_stock" | "out_of_stock" | "unknown";
    const stockQty = cols[3] ? Number(cols[3]) : null;
    if (!sku) continue;
    const product = await db.query.products.findFirst({ where: eq(products.sku, sku) });
    if (!product) {
      errors.push(`Row ${i + 1}: unknown SKU ${sku}`);
      continue;
    }
    if (cost == null) {
      errors.push(`Row ${i + 1}: cost missing`);
      continue;
    }
    const existing = await db.query.supplierOffers.findFirst({
      where: and(eq(supplierOffers.supplierId, supplierId), eq(supplierOffers.productId, product.id)),
    });
    if (existing) {
      await db
        .update(supplierOffers)
        .set({ costNet: cost, stockStatus, stockQty, verified: true, lastSyncedAt: new Date(), active: true })
        .where(eq(supplierOffers.id, existing.id));
      updated++;
    } else {
      await db.insert(supplierOffers).values({
        supplierId,
        productId: product.id,
        supplierSku: sku,
        costNet: cost,
        stockStatus,
        stockQty,
        verified: true,
        lastSyncedAt: new Date(),
      });
      created++;
    }
  }
  await db.insert(feedImports).values({
    supplierId,
    source: "csv",
    filename: String(formData.get("filename") ?? "pasted.csv"),
    rows: Math.max(0, lines.length - start),
    updated,
    created,
    errors,
    createdBy: actor.name,
  });
  await repriceProducts();
  await audit(actor, { action: "feed.import", entity: "supplier", entityId: supplierId, summary: `CSV import: ${updated} updated, ${created} created` });
  refresh();
  return { ok: true, message: `Imported ${updated + created} rows (${errors.length} issues). Prices recalculated.` };
}

export async function repriceAllAction(): Promise<void> {
  const actor = await staff("pricing.edit");
  const changes = await repriceProducts();
  await audit(actor, { action: "pricing.reprice", entity: "product", summary: `Repriced ${changes.length} products` });
  refresh();
}

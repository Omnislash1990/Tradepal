import { applyBps } from "./money";
import { grossFromNet, vatInGross } from "./vat";

export type ContributionInput = {
  lines: { gross: number; vatBps: number }[];
  deliveryGross: number;
  deliveryVatBps: number;
  supplierCostNet: number;
  supplierDeliveryNet: number;
  paymentFeeBps: number;
  paymentFeeFixed: number;
  otherCostsNet: number;
  refundsGross?: number;
  /** When Tradepal is not VAT registered it charges no VAT and cannot reclaim VAT on supplier costs. */
  vatRegistered: boolean;
  supplierVatBps?: number;
};

export type ContributionBreakdown = {
  customerPaidGross: number;
  refundsGross: number;
  vatOnSales: number;
  netRevenue: number;
  supplierCost: number;
  deliveryCost: number;
  paymentFees: number;
  otherCosts: number;
  contribution: number;
  marginBps: number;
};

/** Contribution = what the order leaves after every variable cost, before overheads and corporation tax. */
export function calculateContribution(input: ContributionInput): ContributionBreakdown {
  const goodsGross = input.lines.reduce((s, l) => s + l.gross, 0);
  const chargedGross = goodsGross + input.deliveryGross;
  const refundsGross = input.refundsGross ?? 0;
  const customerPaidGross = chargedGross - refundsGross;

  let vatOnSales = 0;
  if (input.vatRegistered) {
    vatOnSales =
      input.lines.reduce((s, l) => s + vatInGross(l.gross, l.vatBps), 0) +
      vatInGross(input.deliveryGross, input.deliveryVatBps);
    if (refundsGross > 0 && chargedGross > 0) {
      vatOnSales -= Math.round((vatOnSales * refundsGross) / chargedGross);
    }
  }

  const supplierVat = input.supplierVatBps ?? 2000;
  const supplierCost = input.vatRegistered
    ? input.supplierCostNet
    : grossFromNet(input.supplierCostNet, supplierVat);
  const deliveryCost = input.vatRegistered
    ? input.supplierDeliveryNet
    : grossFromNet(input.supplierDeliveryNet, supplierVat);

  // Card processors keep their fee on refunded payments, so fees are charged on the original amount.
  const paymentFees = chargedGross > 0 ? applyBps(chargedGross, input.paymentFeeBps) + input.paymentFeeFixed : 0;
  const netRevenue = customerPaidGross - vatOnSales;
  const contribution = netRevenue - supplierCost - deliveryCost - paymentFees - input.otherCostsNet;

  return {
    customerPaidGross,
    refundsGross,
    vatOnSales,
    netRevenue,
    supplierCost,
    deliveryCost,
    paymentFees,
    otherCosts: input.otherCostsNet,
    contribution,
    marginBps: netRevenue > 0 ? Math.round((contribution * 10000) / netRevenue) : 0,
  };
}

export type EconomicsScenario = {
  title: string;
  description: string;
  rows: { label: string; amount: number }[];
  contribution: number;
};

/**
 * The blueprint's illustrative order (£150 paid, £115 product, £10 delivery, £5 fees) ignores VAT.
 * These scenarios show how the same order looks once VAT is accounted for.
 */
export function blueprintEconomics(): EconomicsScenario[] {
  const paid = 15000;
  const product = 11500;
  const delivery = 1000;
  const fees = 500;
  const vat = vatInGross(paid, 2000);
  const productNetIfGross = product - vatInGross(product, 2000);
  const deliveryNetIfGross = delivery - vatInGross(delivery, 2000);
  return [
    {
      title: "As written in the blueprint",
      description: "No VAT anywhere — only correct if Tradepal is not VAT registered and suppliers charge no VAT.",
      rows: [
        { label: "Customer payment", amount: paid },
        { label: "Supplier product cost", amount: -product },
        { label: "Delivery paid by Tradepal", amount: -delivery },
        { label: "Payment & other variable costs", amount: -fees },
      ],
      contribution: paid - product - delivery - fees,
    },
    {
      title: "VAT registered, supplier figures are ex-VAT",
      description: "£25.00 of the £150 is output VAT owed to HMRC. If £115 and £10 are already net, the order loses money.",
      rows: [
        { label: "Customer payment", amount: paid },
        { label: "Output VAT to HMRC (20%)", amount: -vat },
        { label: "Supplier product cost (net)", amount: -product },
        { label: "Delivery paid by Tradepal (net)", amount: -delivery },
        { label: "Payment & other variable costs", amount: -fees },
      ],
      contribution: paid - vat - product - delivery - fees,
    },
    {
      title: "VAT registered, supplier figures include VAT",
      description: "Input VAT on the supplier invoices is reclaimed, so the net costs are lower.",
      rows: [
        { label: "Customer payment", amount: paid },
        { label: "Output VAT to HMRC (20%)", amount: -vat },
        { label: "Supplier product cost (net of reclaimable VAT)", amount: -productNetIfGross },
        { label: "Delivery paid by Tradepal (net)", amount: -deliveryNetIfGross },
        { label: "Payment & other variable costs", amount: -fees },
      ],
      contribution: paid - vat - productNetIfGross - deliveryNetIfGross - fees,
    },
  ];
}

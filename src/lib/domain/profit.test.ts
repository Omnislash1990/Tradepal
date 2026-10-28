import { describe, expect, it } from "vitest";
import { blueprintEconomics, calculateContribution } from "./profit";

describe("contribution", () => {
  const base = {
    lines: [{ gross: 12000, vatBps: 2000 }],
    deliveryGross: 999,
    deliveryVatBps: 2000,
    supplierCostNet: 8000,
    supplierDeliveryNet: 900,
    paymentFeeBps: 150,
    paymentFeeFixed: 20,
    otherCostsNet: 0,
    vatRegistered: true,
  };

  it("removes output VAT and all variable costs", () => {
    const c = calculateContribution(base);
    expect(c).toMatchObject({
      customerPaidGross: 12999,
      vatOnSales: 2166,
      netRevenue: 10833,
      paymentFees: 215,
      contribution: 1718,
    });
    expect(c.marginBps).toBe(1586);
  });

  it("keeps card fees on refunded orders", () => {
    const c = calculateContribution({ ...base, refundsGross: 6000 });
    expect(c.paymentFees).toBe(215);
    expect(c.customerPaidGross).toBe(6999);
    expect(c.vatOnSales).toBe(1166);
  });

  it("treats supplier VAT as a cost when not VAT registered", () => {
    const c = calculateContribution({ ...base, vatRegistered: false });
    expect(c).toMatchObject({ vatOnSales: 0, supplierCost: 9600, deliveryCost: 1080, contribution: 2104 });
  });
});

describe("blueprint economics", () => {
  it("reproduces the £20 example and shows the VAT effect", () => {
    const [asWritten, netCosts, grossCosts] = blueprintEconomics();
    expect(asWritten.contribution).toBe(2000);
    expect(netCosts.contribution).toBe(-500);
    expect(grossCosts.contribution).toBe(1584);
    for (const s of [asWritten, netCosts, grossCosts]) {
      expect(s.rows.reduce((sum, r) => sum + r.amount, 0)).toBe(s.contribution);
    }
  });
});

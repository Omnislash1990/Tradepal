/** Sample logins created by the database seed. Not for production customers. */
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@tradepal.test", password: "TradepalAdmin!2026", name: "Alex Morgan" },
  staff: { email: "staff@tradepal.test", password: "TradepalStaff!2026", name: "Sam Patel" },
  diy: { email: "diy@tradepal.test", password: "TradepalDemo!2026", name: "Jordan Hughes" },
  trade: { email: "trade@tradepal.test", password: "TradepalDemo!2026", name: "Dan Smith" },
  pending: { email: "kaur@tradepal.test", password: "TradepalDemo!2026", name: "Priya Kaur" },
} as const;

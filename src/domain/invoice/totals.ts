import {
  addMoney,
  money,
  mulMoney,
  percentOf,
  subMoney,
  type Money,
} from "../money/money";
import type { Discount, InvoiceLine, InvoiceTotals, LineTotal } from "./schema";

/**
 * Deterministic invoice arithmetic. The LLM never computes totals — this does,
 * with decimal-safe minor-unit math. VAT is applied only when the deterministic
 * decision says so (never inferred here).
 */

function applyDiscount(base: Money, discount: Discount | undefined): Money {
  if (!discount) return money(0, base.currency);
  if (discount.kind === "percent") return percentOf(base, discount.value);
  return money(discount.value, base.currency);
}

export interface ComputeOptions {
  showVat: boolean;
  vatRate?: number | null;
}

export function computeTotals(
  lines: InvoiceLine[],
  currency: string,
  opts: ComputeOptions,
  invoiceDiscount?: Discount,
): InvoiceTotals {
  const lineTotals: LineTotal[] = [];
  let subtotal = money(0, currency);

  for (const line of lines) {
    const gross = mulMoney(money(line.unitPriceMinor, currency), line.quantity);
    const discount = applyDiscount(gross, line.lineDiscount);
    const net = subMoney(gross, discount);
    lineTotals.push({
      grossMinor: gross.amountMinor,
      discountMinor: discount.amountMinor,
      netMinor: net.amountMinor,
    });
    subtotal = addMoney(subtotal, net);
  }

  const invDiscount = applyDiscount(subtotal, invoiceDiscount);
  const taxable = subMoney(subtotal, invDiscount);

  const showVat = opts.showVat && typeof opts.vatRate === "number";
  const vat = showVat ? percentOf(taxable, opts.vatRate as number) : money(0, currency);
  const total = addMoney(taxable, vat);

  return {
    currency,
    lines: lineTotals,
    subtotalMinor: subtotal.amountMinor,
    invoiceDiscountMinor: invDiscount.amountMinor,
    taxableMinor: taxable.amountMinor,
    vatRate: showVat ? (opts.vatRate as number) : null,
    vatMinor: vat.amountMinor,
    totalMinor: total.amountMinor,
  };
}

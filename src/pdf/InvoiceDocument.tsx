import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceViewModel } from "./model";

/**
 * Deterministic, controlled invoice template. The LLM never produces PDF bytes;
 * this renders a verified view-model. Amount formatting is display-only.
 */

const GREEN = "#0f9d58";
const INK = "#0a0a0a";
const GRAY = "#6b7280";
const DIVIDER = "#e5e7eb";

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 64, paddingHorizontal: 44, fontSize: 10, color: INK, fontFamily: "Helvetica", lineHeight: 1.4 },
  watermark: { position: "absolute", top: 320, left: 40, right: 0, fontSize: 46, color: "#000000", opacity: 0.06, transform: "rotate(-24deg)", fontFamily: "Helvetica-Bold" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  wordmark: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  wordmarkFix: { color: GREEN },
  demoTag: { fontSize: 8, color: "#b54708", backgroundColor: "#fdf6e3", paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },
  invoiceMeta: { textAlign: "right" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 24 },
  partyBox: { flex: 1 },
  label: { fontSize: 8, color: GRAY, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  strong: { fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5, marginTop: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: DIVIDER, paddingVertical: 6 },
  cDesc: { flex: 4 },
  cQty: { flex: 1, textAlign: "right" },
  cPrice: { flex: 2, textAlign: "right" },
  cTotal: { flex: 2, textAlign: "right" },
  totals: { marginTop: 12, marginLeft: "auto", width: "55%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: INK, marginTop: 4, paddingTop: 5 },
  notesBox: { marginTop: 18, padding: 10, backgroundColor: "#f7f8fa", borderRadius: 6 },
  noteLine: { marginBottom: 3 },
  small: { fontSize: 8, color: GRAY },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: 8 },
  section: { marginTop: 14 },
});

function fmt(amount: string, currency: string): string {
  const digits = currency === "JPY" ? 0 : 2;
  const n = Number(amount);
  const grouped = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  return `${grouped} ${currency}`;
}

export function InvoiceDocument({ vm }: { vm: InvoiceViewModel }) {
  return (
    <Document title={`Invoice ${vm.invoiceNumber}`}>
      <Page size="A4" style={s.page} wrap>
        {vm.demoMode ? <Text fixed style={s.watermark}>PROTOTYPE · DEMO</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.wordmark}>tax<Text style={s.wordmarkFix}>fix</Text></Text>
            {vm.demoMode ? <Text style={s.demoTag}>Prototype · Demo — not valid tax advice</Text> : null}
          </View>
          <View style={s.invoiceMeta}>
            <Text style={s.h1}>Invoice</Text>
            <Text>{vm.invoiceNumber}</Text>
            <Text style={s.small}>Issued: {vm.issueDate}</Text>
            {vm.serviceDate ? <Text style={s.small}>Service date: {vm.serviceDate}</Text> : null}
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.partyBox}>
            <Text style={s.label}>From</Text>
            <Text style={s.strong}>{vm.supplier.name}</Text>
            {vm.supplier.addressLines.map((l, i) => <Text key={i}>{l}</Text>)}
            {vm.supplier.taxNumber ? <Text style={s.small}>Tax no.: {vm.supplier.taxNumber}</Text> : null}
            {vm.supplier.vatId ? <Text style={s.small}>VAT ID: {vm.supplier.vatId}</Text> : null}
          </View>
          <View style={s.partyBox}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.strong}>{vm.customer.name}</Text>
            {vm.customer.addressLines.map((l, i) => <Text key={i}>{l}</Text>)}
            {vm.customer.vatId ? <Text style={s.small}>VAT ID: {vm.customer.vatId}</Text> : null}
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.cDesc, s.label]}>Description</Text>
          <Text style={[s.cQty, s.label]}>Qty</Text>
          <Text style={[s.cPrice, s.label]}>Unit price</Text>
          <Text style={[s.cTotal, s.label]}>Amount</Text>
        </View>
        {vm.lines.map((l, i) => (
          <View style={s.row} key={i} wrap={false}>
            <View style={s.cDesc}><Text>{l.description}</Text><Text style={s.small}>{l.unit}</Text></View>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cPrice}>{fmt(l.unitPrice, vm.currency)}</Text>
            <Text style={s.cTotal}>{fmt(l.lineTotal, vm.currency)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{fmt(vm.subtotal, vm.currency)}</Text></View>
          {vm.discount ? <View style={s.totalRow}><Text>Discount</Text><Text>-{fmt(vm.discount, vm.currency)}</Text></View> : null}
          {vm.showVat && vm.vat ? (
            <>
              <View style={s.totalRow}><Text>Net</Text><Text>{fmt(vm.taxable, vm.currency)}</Text></View>
              <View style={s.totalRow}><Text>VAT ({vm.vatRate}%)</Text><Text>{fmt(vm.vat, vm.currency)}</Text></View>
            </>
          ) : null}
          <View style={s.grand}><Text style={s.strong}>Total</Text><Text style={s.strong}>{fmt(vm.total, vm.currency)}</Text></View>
        </View>

        <View style={s.notesBox}>
          <Text style={[s.strong, s.noteLine]}>VAT treatment: {vm.treatmentLabel}</Text>
          {vm.legalNotes.map((n, i) => <Text key={i} style={s.noteLine}>{n}</Text>)}
          {vm.reportingHints.map((n, i) => <Text key={`r${i}`} style={[s.noteLine, s.small]}>Note: {n}</Text>)}
          {vm.fx ? (
            <Text style={[s.noteLine, s.small]}>
              Accounting metadata (not the amount billed): EUR {vm.fx.eurAmount} at ECB reference rate {vm.fx.rate} on {vm.fx.actualRateDate} ({vm.fx.series}).
            </Text>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.label}>Payment</Text>
          <Text>Due within {vm.paymentTermsDays} days.</Text>
          <Text style={s.small}>{vm.bank.accountHolder} · {vm.bank.iban} · {vm.bank.bic} · {vm.bank.bankName}</Text>
          {vm.notes ? <Text style={[s.small, { marginTop: 4 }]}>{vm.notes}</Text> : null}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.small}>
            Generated by the Taxfix AI Tax Assistant prototype. This is a synthetic demonstration document and is not genuine tax advice.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

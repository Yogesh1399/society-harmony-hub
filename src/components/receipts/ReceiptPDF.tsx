import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer';
import { amountToWords } from '@/lib/amountToWords';

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a2e' },
  headerContainer: { borderBottom: '2px solid #3b82f6', paddingBottom: 12, marginBottom: 16 },
  societyName: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#1e40af', marginBottom: 2 },
  societyDetails: { fontSize: 8, textAlign: 'center', color: '#6b7280', marginBottom: 1 },
  receiptTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 6, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 2 },
  row: { flexDirection: 'row', marginBottom: 4 },
  halfRow: { flexDirection: 'row', marginBottom: 4 },
  halfLabel: { width: '35%', fontWeight: 'bold', color: '#374151' },
  halfValue: { width: '65%', color: '#1f2937' },
  detailsGrid: { flexDirection: 'row', marginBottom: 16 },
  detailsCol: { width: '50%' },
  table: { marginTop: 12, marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#eff6ff', borderTop: '1px solid #dbeafe', borderBottom: '1px solid #dbeafe', padding: 6 },
  tableRow: { flexDirection: 'row', padding: 6, borderBottom: '1px solid #f3f4f6' },
  tableCol1: { width: '10%', textAlign: 'center' },
  tableCol2: { width: '60%' },
  tableCol3: { width: '30%', textAlign: 'right' },
  headerText: { fontWeight: 'bold', color: '#1e40af', fontSize: 9 },
  totalRow: { flexDirection: 'row', padding: 8, backgroundColor: '#1e40af', borderRadius: 4, marginTop: 4 },
  totalLabel: { width: '70%', fontWeight: 'bold', color: '#ffffff', fontSize: 11 },
  totalValue: { width: '30%', textAlign: 'right', fontWeight: 'bold', color: '#ffffff', fontSize: 11 },
  amountInWords: { marginTop: 12, padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' },
  amountInWordsLabel: { fontWeight: 'bold', fontSize: 8, color: '#6b7280', marginBottom: 2 },
  amountInWordsText: { fontSize: 10, fontWeight: 'bold', color: '#1f2937' },
  footer: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '40%', borderTop: '1px solid #d1d5db', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#6b7280' },
  watermark: { position: 'absolute', top: '40%', left: '20%', fontSize: 60, color: '#fee2e2', opacity: 0.3, transform: 'rotate(-30deg)', fontWeight: 'bold' },
  disclaimer: { marginTop: 20, fontSize: 7, color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 8 },
});

interface BreakdownItem {
  head_name: string;
  amount: number;
}

interface ReceiptData {
  societyName: string;
  societyAddress?: string;
  societyRegNo?: string;
  receiptNumber: string;
  receiptDate: string;
  memberName: string;
  flatNumber: string;
  paymentMode: string;
  transactionRef?: string;
  periodFrom?: string;
  periodTo?: string;
  breakdown: BreakdownItem[];
  totalAmount: number;
  isCancelled?: boolean;
  receiptTitle?: string;
}

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  const title = data.receiptTitle || 'Payment Receipt';
  const paymentModeLabels: Record<string, string> = {
    cash: 'Cash', cheque: 'Cheque', neft: 'NEFT/RTGS', upi: 'UPI', card: 'Card',
    paid: 'Paid', pending: 'Pending',
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.isCancelled && <Text style={styles.watermark}>CANCELLED</Text>}

        <View style={styles.headerContainer}>
          <Text style={styles.societyName}>{data.societyName}</Text>
          {data.societyAddress && <Text style={styles.societyDetails}>{data.societyAddress}</Text>}
          {data.societyRegNo && <Text style={styles.societyDetails}>Reg. No: {data.societyRegNo}</Text>}
          <Text style={styles.receiptTitle}>{title}</Text>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailsCol}>
            <View style={styles.halfRow}>
              <Text style={styles.halfLabel}>{title.includes('Bill') ? 'Bill No:' : 'Receipt No:'}</Text>
              <Text style={styles.halfValue}>{data.receiptNumber}</Text>
            </View>
            <View style={styles.halfRow}>
              <Text style={styles.halfLabel}>Date:</Text>
              <Text style={styles.halfValue}>{data.receiptDate}</Text>
            </View>
            {data.periodFrom && data.periodTo && (
              <View style={styles.halfRow}>
                <Text style={styles.halfLabel}>Period:</Text>
                <Text style={styles.halfValue}>{data.periodFrom} to {data.periodTo}</Text>
              </View>
            )}
          </View>
          <View style={styles.detailsCol}>
            <View style={styles.halfRow}>
              <Text style={styles.halfLabel}>Member:</Text>
              <Text style={styles.halfValue}>{data.memberName}</Text>
            </View>
            <View style={styles.halfRow}>
              <Text style={styles.halfLabel}>Flat No:</Text>
              <Text style={styles.halfValue}>{data.flatNumber}</Text>
            </View>
            {data.paymentMode !== 'pending' && (
              <View style={styles.halfRow}>
                <Text style={styles.halfLabel}>Payment:</Text>
                <Text style={styles.halfValue}>
                  {paymentModeLabels[data.paymentMode] || data.paymentMode}
                  {data.transactionRef ? ` (${data.transactionRef})` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCol1, styles.headerText]}>Sr.</Text>
            <Text style={[styles.tableCol2, styles.headerText]}>Particulars</Text>
            <Text style={[styles.tableCol3, styles.headerText]}>Amount (₹)</Text>
          </View>
          {data.breakdown.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCol1}>{index + 1}</Text>
              <Text style={styles.tableCol2}>{item.head_name}</Text>
              <Text style={styles.tableCol3}>
                {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(item.amount)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              ₹ {new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(data.totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.amountInWords}>
          <Text style={styles.amountInWordsLabel}>Amount in Words:</Text>
          <Text style={styles.amountInWordsText}>{amountToWords(data.totalAmount)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.signatureBox}>
            <Text>{title.includes('Bill') ? 'Society Office' : 'Received By'}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Authorized Signatory</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This is a computer-generated {title.toLowerCase()}. No signature required for electronic payments.
        </Text>
      </Page>
    </Document>
  );
}

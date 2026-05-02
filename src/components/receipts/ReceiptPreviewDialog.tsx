import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ReceiptPDF } from './ReceiptPDF';
import { amountToWords } from '@/lib/amountToWords';
import { Badge } from '@/components/ui/badge';

interface BreakdownItem {
  head_name: string;
  amount: number;
}

export interface ReceiptData {
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
  receiptTitle?: string; // "Payment Receipt", "Maintenance Bill", "Expense Voucher"
}

interface ReceiptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

const paymentModeLabels: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', neft: 'NEFT/RTGS', upi: 'UPI', card: 'Card',
  paid: 'Paid', pending: 'Pending',
};

export function ReceiptPreviewDialog({ open, onOpenChange, data }: ReceiptPreviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!data) return null;

  const title = data.receiptTitle || 'Payment Receipt';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${data.receiptNumber.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    setIsGenerating(true);
    try {
      const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => printWindow.print());
      }
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error printing PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title} Preview
            {data.isCancelled && <Badge variant="destructive">Cancelled</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className={`border rounded-lg p-6 space-y-4 ${data.isCancelled ? 'opacity-60' : ''}`}>
          {/* Header */}
          <div className="text-center border-b pb-3">
            <h2 className="text-lg font-bold text-primary">{data.societyName}</h2>
            {data.societyAddress && <p className="text-xs text-muted-foreground">{data.societyAddress}</p>}
            {data.societyRegNo && <p className="text-xs text-muted-foreground">Reg. No: {data.societyRegNo}</p>}
            <p className="mt-2 text-sm font-semibold tracking-widest text-primary uppercase">{title}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">{title.includes('Bill') ? 'Bill No:' : 'Receipt No:'}</span>
              <span className="ml-1 font-medium">{data.receiptNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <span className="ml-1 font-medium">{data.receiptDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Member:</span>
              <span className="ml-1 font-medium">{data.memberName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Flat:</span>
              <span className="ml-1 font-medium">{data.flatNumber}</span>
            </div>
            {!title.includes('Bill') && (
              <div>
                <span className="text-muted-foreground">Mode:</span>
                <span className="ml-1 font-medium">{paymentModeLabels[data.paymentMode] || data.paymentMode}</span>
              </div>
            )}
            {data.transactionRef && (
              <div>
                <span className="text-muted-foreground">Ref:</span>
                <span className="ml-1 font-medium">{data.transactionRef}</span>
              </div>
            )}
            {data.periodFrom && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Period:</span>
                <span className="ml-1 font-medium">{data.periodFrom}{data.periodTo && data.periodTo !== data.periodFrom ? ` to ${data.periodTo}` : ''}</span>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="border rounded-md overflow-hidden">
            <div className="bg-primary/5 px-3 py-2 flex text-xs font-semibold text-primary">
              <span className="w-8">#</span>
              <span className="flex-1">Particulars</span>
              <span className="w-24 text-right">Amount</span>
            </div>
            {data.breakdown.map((item, i) => (
              <div key={i} className="px-3 py-2 flex text-sm border-t">
                <span className="w-8 text-muted-foreground">{i + 1}</span>
                <span className="flex-1">{item.head_name}</span>
                <span className="w-24 text-right">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="px-3 py-2 flex bg-primary text-primary-foreground font-bold text-sm">
              <span className="flex-1">Total</span>
              <span className="w-24 text-right">{formatCurrency(data.totalAmount)}</span>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Amount in Words:</p>
            <p className="text-sm font-semibold">{amountToWords(data.totalAmount)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 h-11" onClick={handleDownload} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button className="flex-1 h-11" onClick={handlePrint} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

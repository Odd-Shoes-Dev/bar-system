'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useBar } from '@/contexts/BarContext';

export interface TransactionSummaryData {
  receiptNumber: string;
  clientName: string;
  clientPhone: string;
  services: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    originalPrice?: number;
    discountAmount?: number;
  }>;
  total: number;
  totalDiscount?: number;
  checkoutDiscount?: number;
  amountPaid?: number;
  balanceDue?: number;
  pointsEarned: number;
  paymentMethod: string;
  workerName?: string;
  date?: string;
  /** Set to true when showing a receipt for a balance payment (no new services) */
  isBalancePayment?: boolean;
  originalReceiptNumber?: string;
}

interface TransactionSummaryModalProps {
  transaction: TransactionSummaryData;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}

export function TransactionSummaryModal({
  transaction,
  onClose,
  formatCurrency,
}: TransactionSummaryModalProps) {
  const { bar: salon } = useBar();
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const printReceipt = () => {
    const receiptDate = transaction.date
      ? new Date(transaction.date).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

    const servicesRows = transaction.services
      .map(s => {
        const hasDiscount = s.originalPrice && s.originalPrice > s.unitPrice;
        return `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0">
              ${s.name}
              ${hasDiscount ? `<div style="font-size:10px;color:#16a34a">-${formatCurrency(s.discountAmount || 0)} discount</div>` : ''}
            </td>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:center">${s.quantity}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right">
              ${hasDiscount ? `<div style="font-size:10px;text-decoration:line-through;color:#9ca3af">${formatCurrency((s.originalPrice || s.unitPrice) * s.quantity)}</div>` : ''}
              ${formatCurrency(s.unitPrice * s.quantity)}
            </td>
          </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${transaction.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; width: 300px; margin: 0 auto; padding: 16px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
    .logo { font-size: 18px; font-weight: bold; color: ${brandColor}; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 4px; border-bottom: 2px solid #ccc; font-size: 11px; text-transform: uppercase; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3) { text-align: right; }
    .total-row td { padding: 8px 4px 4px; font-weight: bold; font-size: 14px; }
    .total-row td:last-child { text-align: right; }
    .points { text-align: center; margin-top: 10px; font-size: 12px; color: #555; }
    .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #888; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:12px">
    ${salon?.logo_url
      ? `<img src="${salon.logo_url}" alt="${salon?.name ?? 'Bar'}" style="max-height:64px;max-width:180px;object-fit:contain;margin:0 auto 8px;display:block;" />`
      : `<div style="width:56px;height:56px;border-radius:50%;background:${brandColor};color:#fff;font-size:24px;font-weight:bold;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;line-height:56px;">${(salon?.name ?? 'S').charAt(0).toUpperCase()}</div>`
    }
    <div class="logo">${salon?.name ?? 'Bar'}</div>
    ${salon?.address ? `<div style="font-size:11px;color:#555;margin-top:2px">${salon.address}</div>` : ''}
    ${salon?.phone ? `<div style="font-size:11px;color:#555">${salon.phone}</div>` : ''}
    ${salon?.email ? `<div style="font-size:11px;color:#555">${salon.email}</div>` : ''}
  </div>
  <hr class="divider" />
  <div style="margin-bottom:8px;font-size:12px">
    <div><span class="bold">Receipt:</span> ${transaction.receiptNumber}</div>
    <div><span class="bold">Date:</span> ${receiptDate}</div>
    <div><span class="bold">Client:</span> ${transaction.clientName}</div>
    ${transaction.clientPhone ? `<div><span class="bold">Phone:</span> ${transaction.clientPhone}</div>` : ''}
    ${transaction.workerName ? `<div><span class="bold">Served by:</span> ${transaction.workerName}</div>` : ''}
  </div>
  <hr class="divider" />
  <table>
    <thead><tr><th>Service</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>${servicesRows}</tbody>
    ${transaction.totalDiscount && transaction.totalDiscount > 0 ? `<tr style="font-size:12px"><td colspan="2" style="padding:4px">Per-service Discount</td><td style="padding:4px;text-align:right">-${formatCurrency(transaction.totalDiscount)}</td></tr>` : ''}
    ${transaction.checkoutDiscount && transaction.checkoutDiscount > 0 ? `<tr style="font-size:12px"><td colspan="2" style="padding:4px">Checkout Discount</td><td style="padding:4px;text-align:right">-${formatCurrency(transaction.checkoutDiscount)}</td></tr>` : ''}
    <tr class="total-row">
      <td colspan="2">TOTAL</td>
      <td>${formatCurrency(transaction.total)}</td>
    </tr>
    ${(transaction.checkoutDiscount && transaction.checkoutDiscount > 0) || (transaction.amountPaid !== undefined && transaction.amountPaid < transaction.total) ? `<tr style="font-size:13px"><td colspan="2" style="padding:6px 4px 2px">Amount Due</td><td style="padding:6px 4px 2px;text-align:right">${formatCurrency(transaction.total - (transaction.checkoutDiscount || 0))}</td></tr>` : ''}
    ${transaction.amountPaid !== undefined && transaction.amountPaid < transaction.total ? `<tr style="font-size:13px"><td colspan="2" style="padding:2px 4px">Amount Paid</td><td style="padding:2px 4px;text-align:right">${formatCurrency(transaction.amountPaid)}</td></tr>` : ''}
  </table>
  ${transaction.balanceDue && transaction.balanceDue > 0
    ? `<div style="margin-top:10px;padding:8px;border:2px solid #111;border-radius:4px;text-align:center">
        <div style="font-size:11px;font-weight:bold;letter-spacing:0.5px">BALANCE DUE</div>
        <div style="font-size:18px;font-weight:bold">${formatCurrency(transaction.balanceDue)}</div>
      </div>`
    : `<div style="margin-top:10px;padding:6px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:12px;font-weight:bold">PAID IN FULL ✓</div>`
  }
  <hr class="divider" />
  <div style="text-align:center;font-size:12px;margin-top:6px">
    <span class="bold">Payment:</span> ${formatPaymentMethod(transaction.paymentMethod)}
  </div>
  <div class="footer">Thank you for visiting ${salon?.name ?? 'us'}!<br/>Please come again.</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();

    const logoImg = win.document.querySelector('img');
    if (logoImg && !logoImg.complete) {
      let done = false;
      const doPrint = () => {
        if (done) return;
        done = true;
        win.print();
        win.close();
      };
      logoImg.onload = doPrint;
      logoImg.onerror = doPrint;
      setTimeout(doPrint, 5000);
    } else {
      win.print();
      win.close();
    }
  };

  const formatPaymentMethod = (paymentMethod: string) => {
    if (paymentMethod === 'mtn_mobile_money') return 'MTN Mobile Money';
    if (paymentMethod === 'airtel_money') return 'Airtel Money';
    if (paymentMethod === 'cash') return 'Cash';
    return paymentMethod;
  };

  const handleNotifyCustomer = async () => {
    if (!transaction.clientPhone) {
      toast.error('Customer phone number is missing');
      return;
    }

    setNotifying(true);

    const servicesText = transaction.services
      .map((service) => `${service.name} x${service.quantity}`)
      .join(', ');

    const fallbackText = `Thank you ${transaction.clientName} for visiting ${salon?.name || 'our bar'}. Receipt: ${transaction.receiptNumber}. Services: ${servicesText}. Total: ${formatCurrency(transaction.total)}.`;

    const renderTemplate = (template: string) => {
      const map: Record<string, string> = {
        salonName: salon?.name || 'Bar',
        clientName: transaction.clientName,
        services: servicesText,
        total: transaction.total.toLocaleString(),
        pointsEarned: String(transaction.pointsEarned),
        totalPoints: '-',
        receiptNumber: transaction.receiptNumber,
        paymentMethod: formatPaymentMethod(transaction.paymentMethod),
      };

      return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key: string) => map[key] ?? '');
    };

    try {
      let text = fallbackText;

      const templateResponse = await fetch('/api/sms/template');
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        if (templateData?.template) {
          text = renderTemplate(templateData.template);
        }
      }

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: transaction.clientPhone,
          text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      setNotified(true);
      toast.success('Customer notified successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send SMS');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Transaction Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Customer Name</p>
              <p className="font-semibold text-gray-900">{transaction.clientName}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Phone Number</p>
              <p className="font-semibold text-gray-900">{transaction.clientPhone || <span className="text-gray-400 font-normal">Walk-in</span>}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Receipt Number</p>
              <p className="font-semibold text-gray-900">{transaction.receiptNumber}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Payment Method</p>
              <p className="font-semibold text-gray-900">{formatPaymentMethod(transaction.paymentMethod)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Services Provided</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {transaction.services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="p-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-600">Qty: {service.quantity}</p>
                    </div>
                    <div className="text-right">
                      {service.originalPrice && service.originalPrice > service.unitPrice && (
                        <p className="text-xs text-gray-400 line-through">{formatCurrency(service.originalPrice * service.quantity)}</p>
                      )}
                      <p className="font-semibold text-gray-900">{formatCurrency(service.unitPrice * service.quantity)}</p>
                    </div>
                  </div>
                  {service.discountAmount && service.discountAmount > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">-{formatCurrency(service.discountAmount)} discount</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {transaction.totalDiscount && transaction.totalDiscount > 0 && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50">
              <p className="font-medium text-green-700">Per-service Discount</p>
              <p className="text-lg font-bold text-green-600">-{formatCurrency(transaction.totalDiscount)}</p>
            </div>
          )}

          {transaction.checkoutDiscount && transaction.checkoutDiscount > 0 ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50">
              <p className="font-medium text-green-700">Checkout Discount</p>
              <p className="text-lg font-bold text-green-600">-{formatCurrency(transaction.checkoutDiscount)}</p>
            </div>
          ) : null}

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-lg font-semibold text-gray-900">Total</p>
            <p className="text-2xl font-bold text-brand-primary">{formatCurrency(transaction.total)}</p>
          </div>

          {/* Payment breakdown — shown when partial payment or checkout discount */}
          {((transaction.checkoutDiscount && transaction.checkoutDiscount > 0) || (transaction.amountPaid !== undefined && transaction.amountPaid < transaction.total)) && (
            <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
              {(transaction.checkoutDiscount || 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Amount Due</span>
                  <span className="font-semibold">{formatCurrency(transaction.total - (transaction.checkoutDiscount || 0))}</span>
                </div>
              )}
              {transaction.amountPaid !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-semibold">{formatCurrency(transaction.amountPaid)}</span>
                </div>
              )}
            </div>
          )}

          {transaction.balanceDue !== undefined && transaction.balanceDue > 0 ? (
            <div className="flex items-center justify-between p-4 rounded-lg border-2 border-red-400 bg-red-50">
              <p className="text-lg font-semibold text-red-700">Balance Due</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(transaction.balanceDue)}</p>
            </div>
          ) : transaction.amountPaid !== undefined ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-green-300 bg-green-50">
              <p className="font-semibold text-green-700">Paid in Full</p>
              <p className="text-lg font-bold text-green-600">✓</p>
            </div>
          ) : null}
        </div>

        {transaction.clientPhone && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mx-6 mt-3">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            SMS delivers to <strong className="font-semibold">Airtel numbers only</strong>. Other networks will not receive this message.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pt-4 border-t bg-gray-50">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleNotifyCustomer}
              disabled={notifying || notified || !transaction.clientPhone}
              title={!transaction.clientPhone ? 'No phone number — walk-in customer' : undefined}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              style={{ backgroundColor: brandColor }}
            >
              {notifying ? 'Sending...' : notified ? 'Notified ✓' : 'Notify via SMS'}
            </button>
            <button
              type="button"
              onClick={printReceipt}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white bg-white text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white bg-gray-100 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

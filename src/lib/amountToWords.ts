/**
 * Convert a number to Indian words (Lakhs/Crores system).
 * E.g., 12345 → "Twelve Thousand Three Hundred Forty Five"
 */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
}

export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';
  if (amount < 0) return 'Minus ' + amountToWords(-amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = '';
  
  if (rupees === 0) {
    result = 'Zero';
  } else {
    // Indian system: Crores, Lakhs, Thousands, Hundreds
    const crores = Math.floor(rupees / 10000000);
    const lakhs = Math.floor((rupees % 10000000) / 100000);
    const thousands = Math.floor((rupees % 100000) / 1000);
    const remainder = rupees % 1000;

    const parts: string[] = [];
    if (crores > 0) parts.push(twoDigits(crores) + ' Crore');
    if (lakhs > 0) parts.push(twoDigits(lakhs) + ' Lakh');
    if (thousands > 0) parts.push(twoDigits(thousands) + ' Thousand');
    if (remainder > 0) parts.push(threeDigits(remainder));

    result = parts.join(' ');
  }

  result += ' Rupees';
  if (paise > 0) {
    result += ' and ' + twoDigits(paise) + ' Paise';
  }
  result += ' Only';

  return result;
}

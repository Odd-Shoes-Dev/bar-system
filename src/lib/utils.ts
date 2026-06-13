import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency - UGX is primary for Ugandan salons
export function formatCurrency(amount: number, currency = 'UGX'): string {
  if (currency === 'UGX') {
    // Format UGX without decimals: UGX 35,000
    return `UGX ${new Intl.NumberFormat('en-UG').format(Math.round(amount))}`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return new Date(date).toLocaleDateString('en-US', options || defaultOptions);
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPhoneNumber(phone: string): string {
  // Format Ugandan phone numbers: +256 700 123 456
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('256')) {
    const match = cleaned.match(/^(256)(\d{3})(\d{3})(\d{3})$/);
    if (match) {
      return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
  }
  
  return phone;
}

// Calculate loyalty points based on amount spent
export function calculateLoyaltyPoints(amount: number, pointsPerUGX: number = 1): number {
  // Default: 1 point per UGX 1,000 spent
  return Math.floor(amount / 1000) * pointsPerUGX;
}

// Check if client is eligible for reward
export function checkRewardEligibility(points: number, threshold: number = 1000): {
  eligible: boolean;
  pointsToNext: number;
} {
  return {
    eligible: points >= threshold,
    pointsToNext: Math.max(0, threshold - points),
  };
}

// Generate receipt number with optional salon prefix
export function generateReceiptNumber(salonPrefix: string = 'SALON'): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Use first 4 chars of salon name for prefix
  const prefix = salonPrefix.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4) || 'SALON';
  
  return `${prefix}-${year}${month}${day}-${random}`;
}

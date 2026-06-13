// Mobile Money payment simulation for DEMO

export type PaymentMethod = 'mtn' | 'airtel' | 'cash';

export interface PaymentRequest {
  amount: number;
  method: PaymentMethod;
  phoneNumber?: string;
  clientName: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  message: string;
  error?: string;
}

// Simulate MTN Mobile Money payment
export async function simulateMTNPayment(
  amount: number,
  phoneNumber: string
): Promise<PaymentResponse> {
  console.log('MTN MoMo Payment (DEMO):');
  console.log(`Amount: UGX ${amount.toLocaleString()}`);
  console.log(`Phone: ${phoneNumber}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // For demo, always succeed
  return {
    success: true,
    transactionId: `MTN${Date.now()}`,
    message: 'Payment successful via MTN Mobile Money',
  };
}

// Simulate Airtel Money payment
export async function simulateAirtelPayment(
  amount: number,
  phoneNumber: string
): Promise<PaymentResponse> {
  console.log('Airtel Money Payment (DEMO):');
  console.log(`Amount: UGX ${amount.toLocaleString()}`);
  console.log(`Phone: ${phoneNumber}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // For demo, always succeed
  return {
    success: true,
    transactionId: `AIR${Date.now()}`,
    message: 'Payment successful via Airtel Money',
  };
}

// Process cash payment (instant)
export async function processCashPayment(amount: number): Promise<PaymentResponse> {
  return {
    success: true,
    transactionId: `CASH${Date.now()}`,
    message: 'Cash payment recorded',
  };
}

// Main payment processor
export async function processPayment(request: PaymentRequest): Promise<PaymentResponse> {
  try {
    switch (request.method) {
      case 'mtn':
        if (!request.phoneNumber) {
          return {
            success: false,
            transactionId: '',
            message: '',
            error: 'Phone number required for MTN Mobile Money',
          };
        }
        return await simulateMTNPayment(request.amount, request.phoneNumber);
      
      case 'airtel':
        if (!request.phoneNumber) {
          return {
            success: false,
            transactionId: '',
            message: '',
            error: 'Phone number required for Airtel Money',
          };
        }
        return await simulateAirtelPayment(request.amount, request.phoneNumber);
      
      case 'cash':
        return await processCashPayment(request.amount);
      
      default:
        return {
          success: false,
          transactionId: '',
          message: '',
          error: 'Invalid payment method',
        };
    }
  } catch (error: any) {
    return {
      success: false,
      transactionId: '',
      message: '',
      error: error.message || 'Payment failed',
    };
  }
}

// Production MTN MoMo API (for reference)
export async function processMTNMoMoProduction(
  amount: number,
  phoneNumber: string
): Promise<PaymentResponse> {
  // TODO: Implement actual MTN MoMo API
  // const apiKey = process.env.MTN_MOMO_API_KEY;
  // const apiUser = process.env.MTN_MOMO_API_USER;
  
  return {
    success: false,
    transactionId: '',
    message: '',
    error: 'Production MTN MoMo API not implemented yet',
  };
}

// Production Airtel Money API (for reference)
export async function processAirtelMoneyProduction(
  amount: number,
  phoneNumber: string
): Promise<PaymentResponse> {
  // TODO: Implement actual Airtel Money API
  // const apiKey = process.env.AIRTEL_MONEY_API_KEY;
  
  return {
    success: false,
    transactionId: '',
    message: '',
    error: 'Production Airtel Money API not implemented yet',
  };
}

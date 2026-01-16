'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PaymentLink {
  id: string;
  shortCode: string;
  isActive: boolean;
  product: {
    id: string;
    title: string;
    description?: string;
    price: number;
    imageUrl: string;
    supportEmail?: string;
    supportPhone?: string;
    merchant: {
      firstName: string;
      lastName: string;
    };
  };
}

interface PaymentFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const linkCode = params.linkCode as string;

  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initiated' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PaymentFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '+237', // Pre-fill with +237 (Cameroon)
  });

  const fetchPaymentLink = async () => {
    if (!linkCode) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log('Fetching payment link for code:', linkCode);

      const response = await fetch(
        `http://localhost:3002/api/v1/links/${encodeURIComponent(linkCode)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Payment link not found' }));
        throw new Error(errorData.message || 'Payment link not found');
      }

      const data = await response.json();
      console.log('Payment link data:', data);
      setPaymentLink(data);

    } catch (error) {
      console.error('Error fetching payment link:', error);
      setError(error instanceof Error ? error.message : 'Failed to load payment page');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (linkCode) {
      fetchPaymentLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  // Update document title dynamically - MUST be before early returns
  useEffect(() => {
    if (paymentLink) {
      document.title = `Pay ${paymentLink.product.price.toLocaleString()} FCFA - ${paymentLink.product.title} | PayMo`;
    } else {
      document.title = 'Payment | PayMo';
    }
  }, [paymentLink]);

  /**
   * Download receipt PDF for successful payment
   */
  const handleDownloadReceipt = async () => {
    if (!transactionReference) {
      setReceiptError('Transaction reference not available');
      return;
    }

    try {
      setIsDownloadingReceipt(true);
      setReceiptError(null);

      const response = await fetch(
        `http://localhost:3002/api/v1/receipts/${encodeURIComponent(transactionReference)}/download`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to download receipt' }));
        throw new Error(errorData.message || 'Failed to download receipt');
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${transactionReference}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      setReceiptError(error instanceof Error ? error.message : 'Failed to download receipt');
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Special handling for phone number - ensure it always starts with +237 (Cameroon)
    if (name === 'customerPhone') {
      let phoneValue = value;
      
      // If user deletes everything, restore +237
      if (!phoneValue || phoneValue.trim() === '') {
        phoneValue = '+237';
      }
      // If user tries to delete the +237 prefix, restore it
      else if (!phoneValue.startsWith('+237')) {
        // If they're typing and it doesn't start with +237, prepend it
        if (phoneValue.startsWith('+')) {
          // They might be typing a different country code, but for testing we force +237
          phoneValue = '+237' + phoneValue.substring(1);
        } else {
          // No + at all, prepend +237
          phoneValue = '+237' + phoneValue;
        }
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: phoneValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!formData.customerName.trim()) {
      return { isValid: false, error: 'Please enter your full name' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.customerEmail.trim() || !emailRegex.test(formData.customerEmail)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }

    // Relaxed phone validation - just check it's not empty and has +237
    const phone = formData.customerPhone.trim();
    if (!phone || phone === '+237') {
      return { isValid: false, error: 'Please enter your phone number' };
    }

    return { isValid: true };
  };

  /**
   * Poll transaction status until it's no longer pending
   */
  const pollTransactionStatus = async (reference: string, maxAttempts = 30) => {
    let attempts = 0;
    const startTime = Date.now();
    
    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        // Show timeout as a warning message in the form, not as a fatal error
        setTimeoutMessage('Payment status check timed out after 90 seconds. The payment may still be processing. Please check your payment status manually using the reference number.');
        setPaymentStatus('timeout');
        setIsProcessing(false);
        return;
      }

      attempts++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      try {
        const response = await fetch(
          `http://localhost:3002/api/v1/payments/status?reference=${encodeURIComponent(reference)}`
        );

        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }

        const data = await response.json();

        console.log(`[Status Poll] Attempt ${attempts}/${maxAttempts} (${elapsedSeconds}s elapsed) - Status: ${data.status}`);
        
        if (data.status === 'SUCCESS') {
          console.log('[Status Poll] ✅ Payment successful!');
          setPaymentStatus('success');
          setIsProcessing(false);
          return;
        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          console.log('[Status Poll] ❌ Payment failed or cancelled');
          setPaymentStatus('failed');
          setError(data.message || 'Payment was unsuccessful. Please try again.');
          setIsProcessing(false);
          return;
        } else if (data.status === 'PENDING') {
          // Continue polling
          console.log(`[Status Poll] ⏳ Still pending, checking again in 3 seconds...`);
          setTimeout(poll, 3000); // Poll every 3 seconds
        } else {
          // Unknown status, continue polling
          console.log(`[Status Poll] ⚠️ Unknown status: ${data.status}, continuing to poll...`);
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error('Error polling transaction status:', error);
        // Continue polling on error (might be temporary)
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentLink) {
      setError('Payment link data is missing. Please refresh the page.');
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) {
      setError(validation.error || 'Please fill in all required fields correctly.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setPaymentStatus('initiated');

    try {
      // Phone number is already pre-filled with +237 (Cameroon), just ensure it's properly formatted
      let phoneNumber = formData.customerPhone.trim();
      
      // Ensure phone number starts with +237 (should already be the case)
      if (!phoneNumber.startsWith('+237')) {
        // If somehow it doesn't, add it
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '+237' + phoneNumber.substring(1);
        } else {
          phoneNumber = '+237' + phoneNumber.replace(/^\+/, '');
        }
      }

      // Always use CM for Cameroon and XAF for currency (testing mode)
      const countryCode = 'CM';
      const currencyCode = 'XAF';

      // Prepare payment request payload
      const paymentPayload = {
        paymentLinkId: paymentLink.id,
        customerName: formData.customerName.trim(),
        customerEmail: formData.customerEmail.trim(),
        customerPhone: phoneNumber,
        paymentMode: 'MOMO' as const, // Mobile Money (MTN in Nigeria)
        countryCode: countryCode,
        currencyCode: currencyCode,
      };

      // Debug log
      console.log('Payment payload:', paymentPayload);

      // Initiate payment
      const response = await fetch('http://localhost:3002/api/v1/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentPayload),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: 'Failed to initiate payment' };
        }
        
        console.error('Payment initiation error response:', errorData);
        console.error('Response status:', response.status);
        
        // Extract detailed error message from backend response structure
        // Backend returns: { statusCode, message, error, errors?, ... }
        let errorMessage = 'Failed to initiate payment';
        
        // Check for message field (could be string or array)
        if (errorData.message) {
          if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else {
            errorMessage = String(errorData.message);
          }
        }
        
        // If message contains "Validation failed", try to extract more details from errors array
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const validationDetails = errorData.errors
            .map((err: any) => {
              if (err.constraints) {
                return Object.values(err.constraints).join(', ');
              }
              if (err.field && err.value !== undefined) {
                return `${err.field}: ${err.value}`;
              }
              return 'Validation error';
            })
            .join('; ');
          
          if (validationDetails) {
            errorMessage = `${errorMessage} (${validationDetails})`;
          }
        }
        
        // Fallback to error field if message is not helpful
        if (errorMessage === 'Failed to initiate payment' && errorData.error) {
          errorMessage = errorData.error;
        }
        
        console.error('Extracted error message:', errorMessage);
        throw new Error(errorMessage);
      }

      const paymentData = await response.json();
      setTransactionReference(paymentData.reference);
      setPaymentStatus('pending');

      // Start polling for transaction status
      if (paymentData.reference) {
        await pollTransactionStatus(paymentData.reference);
      } else {
        throw new Error('No transaction reference received');
      }

    } catch (error) {
      console.error('Payment processing failed:', error);
      setError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
      setPaymentStatus('failed');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment page...</p>
        </div>
      </div>
    );
  }

  // Only show "Payment Link Invalid" if we failed to load the payment link initially
  // Don't show it for payment processing errors - those should show in the form
  if (!paymentLink && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Process Payment</h2>
          <p className="text-gray-600 mb-6">
            {error || 'This payment link is not available. It may have expired or the product is no longer available. Please contact the merchant for assistance.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // If payment link failed to load but we're still loading, show loading state
  if (!paymentLink) {
    return null; // Will show loading state from above
  }

  // Show success state
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-4">
            Your payment of {paymentLink.product.price.toLocaleString()} FCFA has been processed successfully.
          </p>
          {transactionReference && (
            <p className="text-sm text-gray-500 mb-4">
              Transaction Reference: <span className="font-mono">{transactionReference}</span>
            </p>
          )}
          
          {/* Receipt Download Section */}
          <div className="mb-6 space-y-3">
            <button
              onClick={handleDownloadReceipt}
              disabled={isDownloadingReceipt || !transactionReference}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDownloadingReceipt ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating Receipt...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download Receipt (PDF)</span>
                </>
              )}
            </button>
            
            {receiptError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {receiptError}
              </p>
            )}
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Payment</h1>
          <p className="text-gray-600 mt-2">Secure payment powered by PayMo</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Details</h2>

            <div className="space-y-4">
              {/* Product Image */}
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={paymentLink.product.imageUrl}
                  alt={paymentLink.product.title}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Product+Image';
                  }}
                />
              </div>

              {/* Product Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900">{paymentLink.product.title}</h3>
                {paymentLink.product.description && (
                  <p className="text-gray-600 mt-2">{paymentLink.product.description}</p>
                )}
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{paymentLink.product.price.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Merchant Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Sold by</h4>
                <p className="text-sm text-gray-600">
                  {paymentLink.product.merchant.firstName} {paymentLink.product.merchant.lastName}
                </p>
                {paymentLink.product.supportEmail && (
                  <p className="text-sm text-gray-600">{paymentLink.product.supportEmail}</p>
                )}
                {paymentLink.product.supportPhone && (
                  <p className="text-sm text-gray-600">{paymentLink.product.supportPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>

            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+237 123 456 789"
                />
                <p className="mt-1 text-xs text-gray-500">Enter your phone number (country code +237 is pre-filled)</p>
              </div>

              {/* Payment Summary */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total:</span>
                  <span>{paymentLink.product.price.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                  <div className="flex">
                    <svg
                      className="w-5 h-5 text-red-400 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Timeout Warning Message */}
              {timeoutMessage && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4" role="alert">
                  <div className="flex">
                    <svg
                      className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">Payment Status Check Timed Out</p>
                      <p className="text-sm text-yellow-700 mt-1">{timeoutMessage}</p>
                      {transactionReference && (
                        <p className="text-xs text-yellow-600 mt-2 font-mono">
                          Reference: {transactionReference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Timeout Warning Message */}
              {timeoutMessage && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4" role="alert">
                  <div className="flex">
                    <svg
                      className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">Payment Status Check Timed Out</p>
                      <p className="text-sm text-yellow-700 mt-1">{timeoutMessage}</p>
                      {transactionReference && (
                        <p className="text-xs text-yellow-600 mt-2 font-mono">
                          Reference: {transactionReference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg font-medium hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {paymentStatus === 'pending' 
                      ? 'Waiting for payment confirmation...' 
                      : paymentStatus === 'initiated'
                      ? 'Initiating payment...'
                      : 'Processing Payment...'}
                  </div>
                ) : (
                  `Pay ${paymentLink.product.price.toLocaleString()} FCFA`
                )}
              </button>
              
              {paymentStatus === 'pending' && transactionReference && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm font-medium text-blue-800">Checking payment status...</p>
                  </div>
                  <p className="text-xs text-blue-600 text-center">
                    Please complete the payment on your mobile device. We're checking the status every 3 seconds.
                  </p>
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800 text-center font-medium">
                      🧪 TEST MODE: Payment will automatically succeed after 10 seconds
                    </p>
                  </div>
                  <p className="text-xs text-blue-500 text-center mt-2 font-mono">
                    Reference: {transactionReference}
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500 text-center">
                Your payment is secured and processed instantly
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

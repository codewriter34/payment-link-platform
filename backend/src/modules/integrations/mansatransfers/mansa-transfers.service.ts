import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InitiatePaymentRequest {
  paymentMode: 'MOMO' | 'OM';
  phoneNumber: string;
  transactionType: 'payin';
  amount: number;
  fullName: string;
  emailAddress: string;
  currencyCode: string;
  countryCode: string;
  externalReference: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  reference?: string;
  message?: string;
  data?: any;
}

export interface TransactionStatusResponse {
  success: boolean;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  reference?: string;
  message?: string;
  data?: any;
}

/**
 * Mansa Transfers API Service
 * Handles authentication and API communication with Mansa Transfers
 */
@Injectable()
export class MansaTransfersService {
  private readonly logger = new Logger(MansaTransfersService.name);
  private readonly baseUrl: string;
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private configService: ConfigService) {
    const mansaConfig = this.configService.get('mansa');
    
    // Validate configuration
    if (!mansaConfig) {
      throw new Error(
        'Mansa Transfers configuration is missing. Please check your environment variables.',
      );
    }

    this.baseUrl = mansaConfig.baseUrl || 'https://api-stage.mansatransfers.com';
    this.clientKey = mansaConfig.clientKey;
    this.clientSecret = mansaConfig.clientSecret;

    // Validate required credentials
    if (!this.clientKey || !this.clientSecret) {
      const errorMsg =
        'Mansa Transfers credentials are missing. Please set MANSA_CLIENT_KEY and MANSA_CLIENT_SECRET in your .env file.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate credentials are not empty strings
    if (this.clientKey.trim() === '' || this.clientSecret.trim() === '') {
      const errorMsg =
        'Mansa Transfers credentials cannot be empty. Please set valid MANSA_CLIENT_KEY and MANSA_CLIENT_SECRET in your .env file.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Service initialized - credentials validated
  }

  /**
   * Authenticate with Mansa Transfers API and get JWT token
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.authToken;
    }

    try {
      const authUrl = `${this.baseUrl}/api/v1/xyz/authenticate`;
      const authHeaders = {
        'client-key': this.clientKey,
        'client-secret': this.clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      let response: Response;
      try {
        response = await fetch(authUrl, {
          method: 'POST',
          headers: authHeaders,
        });
      } catch (fetchError: any) {
        this.logger.error(`Mansa authentication network error: ${fetchError.message}`);
        throw new BadRequestException(
          `Failed to connect to payment provider. Network error: ${fetchError.message}. Please check your internet connection and API endpoint.`,
        );
      }

      const responseText = await response.text();

      if (!response.ok) {
        this.logger.error(`Mansa authentication failed: ${response.status} - ${responseText}`);
        this.logger.error(`Auth URL: ${authUrl}`);
        this.logger.error(`Client Key: ${this.clientKey ? `${this.clientKey.substring(0, 5)}...` : 'MISSING'}`);
        this.logger.error(`Client Secret: ${this.clientSecret ? `${this.clientSecret.substring(0, 5)}...` : 'MISSING'}`);
        throw new BadRequestException(
          `Failed to authenticate with payment provider`,
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        this.logger.error(`Failed to parse Mansa auth response as JSON`);
        throw new BadRequestException(
          'Invalid response format from payment provider',
        );
      }

      this.authToken =
        data.token ||
        data.accessToken ||
        data.access_token ||
        data.data?.token ||
        data.data?.accessToken;

      if (!this.authToken) {
        this.logger.error(`No token received from Mansa authentication`);
        throw new BadRequestException(
          'Invalid response from payment provider: No authentication token received',
        );
      }

      // Set token expiry to 1 hour from now (adjust based on actual token expiry)
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000); // 55 minutes

      return this.authToken;
    } catch (error) {
      this.logger.error(`Mansa authentication error: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Provide more detailed error message
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
        throw new BadRequestException(
          `Failed to connect to payment provider. Please check your internet connection and API endpoint. Error: ${errorMessage}`,
        );
      }
      
      throw new BadRequestException(
        `Failed to connect to payment provider: ${errorMessage}`,
      );
    }
  }

  /**
   * Get authenticated headers for API requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();
    return {
      'client-key': this.clientKey,
      'client-secret': this.clientSecret,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Initiate a payment transaction
   */
  async initiatePayment(
    request: InitiatePaymentRequest,
  ): Promise<InitiatePaymentResponse> {
    try {
      // Sanitize request
      const sanitizedRequest = {
        ...request,
        countryCode: String(request.countryCode || 'CM').trim().toUpperCase(),
        currencyCode: String(request.currencyCode || 'XAF').trim().toUpperCase(),
      };

      let headers: Record<string, string>;
      try {
        headers = await this.getAuthHeaders();
      } catch (authError: any) {
        this.logger.error(`Mansa authentication failed: ${authError.message}`);
        return {
          success: false,
          message: authError.message || 'Failed to authenticate with payment provider',
        };
      }

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/v1/xyz/initiate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(sanitizedRequest),
        });
      } catch (fetchError: any) {
        this.logger.error(`Mansa payment initiation network error: ${fetchError.message}`);
        return {
          success: false,
          message: `Failed to connect to payment provider. Network error: ${fetchError.message}. Please check your internet connection and API endpoint.`,
        };
      }

      const responseText = await response.text();

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        this.logger.error(`Failed to parse Mansa initiate response as JSON`);
        return {
          success: false,
          message: 'Invalid response format from payment provider',
        };
      }

      // Check if response indicates success (even if status code is not 200)
      const message = responseData.message || responseData.error || responseData.errorMessage || '';
      const isSuccessMessage = message.toLowerCase().includes('success') || 
                               message.toLowerCase().includes('successful') ||
                               responseData.status === 'success' ||
                               responseData.status === 'SUCCESS';
      
      if (!response.ok && !isSuccessMessage) {
        // Extract error message
        const errorMessage = 
          responseData.message ||
          responseData.error ||
          responseData.errorMessage ||
          responseData.data?.message ||
          responseData.data?.error ||
          (typeof responseData === 'string' ? responseData : `Failed to initiate payment (Status: ${response.status})`);
        
        return {
          success: false,
          message: errorMessage,
          data: responseData,
        };
      }
      
      // Extract reference from various possible locations
      const reference = 
        responseData.reference ||
        responseData.data?.reference ||
        responseData.transactionReference ||
        responseData.ref ||
        responseData.transactionId ||
        responseData.id;

      // If we have a reference, it's definitely a success
      if (reference) {
        return {
          success: true,
          reference: reference,
          message: message || 'Payment initiated successfully',
          data: responseData,
        };
      }
      
      // If no reference but message says "Successful" OR HTTP status is OK, treat as success
      if (isSuccessMessage || response.ok) {
        const generatedReference = request.externalReference || `MANSA-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        return {
          success: true,
          reference: generatedReference,
          message: message || 'Payment initiated successfully',
          data: responseData,
        };
      }

      // If HTTP status is OK, treat as success
      if (response.ok) {
        const fallbackReference = request.externalReference || `FALLBACK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        return {
          success: true,
          reference: fallbackReference,
          message: message || 'Payment initiated successfully',
          data: responseData,
        };
      }
      
      // Error response
      return {
        success: false,
        message: message || 'Failed to initiate payment',
        data: responseData,
      };
    } catch (error) {
      this.logger.error(`Mansa payment initiation error: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        return {
          success: false,
          message: error.message || 'Failed to initiate payment',
        };
      }
      
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: `Failed to connect to payment provider. Please check your internet connection and API endpoint.`,
        };
      }
      
      return {
        success: false,
        message: errorMessage || 'Failed to initiate payment',
      };
    }
  }

  /**
   * Check transaction status by reference
   */
  async checkTransactionStatus(
    reference: string,
  ): Promise<TransactionStatusResponse> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(
        `${this.baseUrl}/api/v1/xyz/check-status?reference=${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers,
        },
      );

      const responseData = await response.json();

      if (!response.ok) {
        this.logger.error(`Status check failed: ${response.status}`);
        return {
          success: false,
          message:
            responseData.message ||
            responseData.error ||
            'Failed to check transaction status',
          data: responseData,
        };
      }

      // Map Mansa status to our TransactionStatus enum
      const mansaStatus = responseData.status || responseData.data?.status;
      let status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' = 'PENDING';

      if (mansaStatus) {
        const statusUpper = mansaStatus.toUpperCase();
        if (statusUpper === 'SUCCESS' || statusUpper === 'COMPLETED') {
          status = 'SUCCESS';
        } else if (statusUpper === 'FAILED' || statusUpper === 'FAILURE') {
          status = 'FAILED';
        } else if (statusUpper === 'CANCELLED' || statusUpper === 'CANCELED') {
          status = 'CANCELLED';
        }
      }


      return {
        success: true,
        status,
        reference: responseData.reference || reference,
        message: responseData.message,
        data: responseData,
      };
    } catch (error) {
      this.logger.error(
        `Error checking transaction status: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: error.message || 'Failed to check transaction status',
      };
    }
  }
}


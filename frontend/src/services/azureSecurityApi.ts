import { CompanyDetails } from '../components/pentest/SecurityScanModal';

// API Response types
export interface DockerApiResponse {
  detail?: string;
  status?: string;
  message?: string;
}

export interface ScanRequest {
  companyDetails: CompanyDetails;
  scanType: 'penetration_test' | 'vulnerability_scan';
  timestamp: string;
}

export interface ScanResponse {
  scan_id: string;
  status: 'initiated' | 'running' | 'completed' | 'failed';
  message?: string;
  estimated_completion?: string;
}

export interface ScanResults {
  scan_id: string;
  status: string;
  results?: {
    vulnerabilities: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      description: string;
      target: string;
      cvss_score?: number;
      recommendations: string[];
    }>;
    summary: {
      total_vulnerabilities: number;
      by_severity: Record<string, number>;
      scan_duration: string;
      coverage: string;
    };
    compliance_status?: {
      framework: string;
      score: number;
      findings: Array<{
        requirement: string;
        status: 'pass' | 'fail' | 'warning';
        details: string;
      }>;
    }[];
  };
  report_url?: string;
  completed_at?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class AzureSecurityApiService {
  private dockerApiUrl: string;
  private cybrtyApiUrl: string;

  constructor() {
    // Azure Container Apps endpoints
    this.dockerApiUrl = 'https://docker-api-ca.wonderfuldune-e921120d.eastus.azurecontainerapps.io';
    this.cybrtyApiUrl = 'https://cybrty-dev-ca.wonderfuldune-e921120d.eastus.azurecontainerapps.io';
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // If we can't parse error JSON, use the default message
        }
        
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return { status: 'success', message: 'Request completed successfully' } as T;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Launch a security scan using the Docker API
   */
  async launchSecurityScan(companyDetails: CompanyDetails): Promise<ScanResponse> {
    const scanRequest: ScanRequest = {
      companyDetails,
      scanType: 'penetration_test',
      timestamp: new Date().toISOString()
    };

    try {
      // First, check if the Docker API is accessible
      await this.checkDockerApiHealth();

      // Launch the scan
      const response = await this.makeRequest<ScanResponse>(
        `${this.dockerApiUrl}/api/v1/scans/launch`,
        {
          method: 'POST',
          body: JSON.stringify(scanRequest)
        }
      );

      return response;
    } catch (error) {
      console.error('Failed to launch security scan:', error);
      throw new Error(`Failed to launch security scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check the status of a running scan
   */
  async getScanStatus(scanId: string): Promise<ScanResponse> {
    try {
      const response = await this.makeRequest<ScanResponse>(
        `${this.dockerApiUrl}/api/v1/scans/${scanId}/status`
      );
      return response;
    } catch (error) {
      console.error('Failed to get scan status:', error);
      throw new Error(`Failed to get scan status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch scan results from the Cybrty API
   */
  async getScanResults(scanId: string): Promise<ScanResults> {
    try {
      // First, check if the Cybrty API is accessible
      await this.checkCybrtyApiHealth();

      const response = await this.makeRequest<ScanResults>(
        `${this.cybrtyApiUrl}/api/v1/results/${scanId}`
      );

      return response;
    } catch (error) {
      console.error('Failed to fetch scan results:', error);
      throw new Error(`Failed to fetch scan results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available scan results for a company
   */
  async getAllScanResults(companyId?: string): Promise<ScanResults[]> {
    try {
      const endpoint = companyId 
        ? `${this.cybrtyApiUrl}/api/v1/results/company/${companyId}`
        : `${this.cybrtyApiUrl}/api/v1/results`;

      const response = await this.makeRequest<{ results: ScanResults[] }>(endpoint);
      return response.results || [];
    } catch (error) {
      console.error('Failed to fetch all scan results:', error);
      throw new Error(`Failed to fetch scan results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check Docker API health
   */
  async checkDockerApiHealth(): Promise<boolean> {
    try {
      await this.makeRequest<DockerApiResponse>(`${this.dockerApiUrl}/health`);
      return true;
    } catch (error) {
      console.warn('Docker API health check failed:', error);
      // Try alternative endpoints
      try {
        await this.makeRequest<DockerApiResponse>(`${this.dockerApiUrl}/docs`);
        return true;
      } catch (docsError) {
        console.warn('Docker API docs endpoint also failed:', docsError);
        return false;
      }
    }
  }

  /**
   * Check Cybrty API health
   */
  async checkCybrtyApiHealth(): Promise<boolean> {
    try {
      await this.makeRequest<DockerApiResponse>(`${this.cybrtyApiUrl}/health`);
      return true;
    } catch (error) {
      console.warn('Cybrty API health check failed:', error);
      // Try alternative endpoints
      try {
        await this.makeRequest<DockerApiResponse>(`${this.cybrtyApiUrl}/docs`);
        return true;
      } catch (docsError) {
        console.warn('Cybrty API docs endpoint also failed:', docsError);
        return false;
      }
    }
  }

  /**
   * Get API documentation/endpoints info
   */
  async getDockerApiInfo(): Promise<any> {
    try {
      return await this.makeRequest<any>(`${this.dockerApiUrl}/docs`);
    } catch (error) {
      console.error('Failed to fetch Docker API documentation:', error);
      throw error;
    }
  }

  /**
   * Get Cybrty API documentation/endpoints info
   */
  async getCybrtyApiInfo(): Promise<any> {
    try {
      return await this.makeRequest<any>(`${this.cybrtyApiUrl}/docs`);
    } catch (error) {
      console.error('Failed to fetch Cybrty API documentation:', error);
      throw error;
    }
  }

  /**
   * Poll for scan completion
   */
  async pollScanCompletion(
    scanId: string,
    onProgress?: (status: ScanResponse) => void,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<ScanResults> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.getScanStatus(scanId);
        
        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed') {
          return await this.getScanResults(scanId);
        }

        if (status.status === 'failed') {
          throw new Error('Scan failed: ' + status.message);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        // Continue polling on temporary errors
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error('Scan polling timeout - scan did not complete within expected time');
  }

  /**
   * Cancel a running scan
   */
  async cancelScan(scanId: string): Promise<boolean> {
    try {
      await this.makeRequest<DockerApiResponse>(
        `${this.dockerApiUrl}/api/v1/scans/${scanId}/cancel`,
        { method: 'POST' }
      );
      return true;
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      return false;
    }
  }
}

// Export singleton instance
export const azureSecurityApi = new AzureSecurityApiService();
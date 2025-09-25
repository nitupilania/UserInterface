import { useState, useCallback } from 'react';
import { CompanyDetails } from '../components/pentest/SecurityScanModal';
import { 
  azureSecurityApi, 
  ScanResponse, 
  ScanResults 
} from '../services/azureSecurityApi';

export interface ScanState {
  isModalOpen: boolean;
  isScanning: boolean;
  scanId: string | null;
  scanStatus: ScanResponse | null;
  scanResults: ScanResults | null;
  error: string | null;
  progress: string;
}

export const useSecurityScan = () => {
  const [state, setState] = useState<ScanState>({
    isModalOpen: false,
    isScanning: false,
    scanId: null,
    scanStatus: null,
    scanResults: null,
    error: null,
    progress: 'Ready to scan'
  });

  const openModal = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isModalOpen: true,
      error: null 
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isModalOpen: false,
      error: null 
    }));
  }, []);

  const updateProgress = useCallback((progress: string) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ 
      ...prev, 
      error, 
      isScanning: false,
      progress: 'Error occurred'
    }));
  }, []);

  const launchScan = useCallback(async (companyDetails: CompanyDetails) => {
    try {
      setState(prev => ({
        ...prev,
        isScanning: true,
        error: null,
        progress: 'Initiating security scan...',
        scanResults: null
      }));

      updateProgress('Connecting to security infrastructure...');

      // Launch the scan
      const scanResponse = await azureSecurityApi.launchSecurityScan(companyDetails);
      
      setState(prev => ({
        ...prev,
        scanId: scanResponse.scan_id,
        scanStatus: scanResponse,
        progress: 'Scan initiated successfully'
      }));

      updateProgress('Security scan in progress...');

      // Poll for completion
      const results = await azureSecurityApi.pollScanCompletion(
        scanResponse.scan_id,
        (status) => {
          setState(prev => ({
            ...prev,
            scanStatus: status,
            progress: `Scan ${status.status}... ${status.message || ''}`
          }));
        }
      );

      setState(prev => ({
        ...prev,
        scanResults: results,
        isScanning: false,
        progress: 'Scan completed successfully'
      }));

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      throw error;
    }
  }, [updateProgress, setError]);

  const refreshResults = useCallback(async () => {
    if (!state.scanId) return;

    try {
      updateProgress('Refreshing scan results...');
      const results = await azureSecurityApi.getScanResults(state.scanId);
      
      setState(prev => ({
        ...prev,
        scanResults: results,
        progress: 'Results updated'
      }));

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh results';
      setError(errorMessage);
      throw error;
    }
  }, [state.scanId, updateProgress, setError]);

  const cancelScan = useCallback(async () => {
    if (!state.scanId || !state.isScanning) return;

    try {
      updateProgress('Cancelling scan...');
      const success = await azureSecurityApi.cancelScan(state.scanId);
      
      if (success) {
        setState(prev => ({
          ...prev,
          isScanning: false,
          progress: 'Scan cancelled'
        }));
      } else {
        setError('Failed to cancel scan');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel scan';
      setError(errorMessage);
      return false;
    }
  }, [state.scanId, state.isScanning, updateProgress, setError]);

  const getScanStatus = useCallback(async () => {
    if (!state.scanId) return null;

    try {
      const status = await azureSecurityApi.getScanStatus(state.scanId);
      setState(prev => ({
        ...prev,
        scanStatus: status
      }));
      return status;
    } catch (error) {
      console.error('Failed to get scan status:', error);
      return null;
    }
  }, [state.scanId]);

  const resetScan = useCallback(() => {
    setState({
      isModalOpen: false,
      isScanning: false,
      scanId: null,
      scanStatus: null,
      scanResults: null,
      error: null,
      progress: 'Ready to scan'
    });
  }, []);

  const getAllResults = useCallback(async (companyId?: string) => {
    try {
      updateProgress('Fetching all scan results...');
      const results = await azureSecurityApi.getAllScanResults(companyId);
      updateProgress(`Found ${results.length} scan results`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch scan results';
      setError(errorMessage);
      throw error;
    }
  }, [updateProgress, setError]);

  return {
    // State
    ...state,
    
    // Actions
    openModal,
    closeModal,
    launchScan,
    refreshResults,
    cancelScan,
    getScanStatus,
    resetScan,
    getAllResults,
    
    // Computed properties
    canLaunchScan: !state.isScanning,
    canCancelScan: state.isScanning && state.scanId !== null,
    hasResults: state.scanResults !== null,
    hasError: state.error !== null
  };
};
/**
 * Workshop upload status enum
 * Mirrors the C# WorkshopUploadStatus from BmlSteamItemManager
 */
export enum WorkshopUploadStatus {
  Pending = 0,
  Preparing = 1,
  RequestingId = 2,
  WritingIni = 3,
  StartingSteamUpload = 4,
  UploadingContent = 5,
  UploadingTitles = 6,
  UploadingTranslations = 7,
  Completed = 8,
  Failed = 9,
}

/**
 * Workshop upload progress
 */
export interface WorkshopUploadProgress {
  status: WorkshopUploadStatus;
  bytesProcessed: number;
  bytesTotal: number;
  message: string;
  exception?: Error;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: WorkshopUploadProgress) => void;

/**
 * Progress tracker for Workshop uploads
 */
export class ProgressTracker {
  private currentProgress: WorkshopUploadProgress;
  private callbacks: ProgressCallback[] = [];

  constructor() {
    this.currentProgress = {
      status: WorkshopUploadStatus.Pending,
      bytesProcessed: 0,
      bytesTotal: 0,
      message: 'Initializing...',
    };
  }

  /**
   * Register a progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Report progress
   */
  report(
    status: WorkshopUploadStatus,
    message: string,
    data?: Partial<WorkshopUploadProgress>
  ): void {
    this.currentProgress = {
      ...this.currentProgress,
      status,
      message,
      ...data,
    };

    // Notify all callbacks
    for (const callback of this.callbacks) {
      try {
        callback(this.currentProgress);
      } catch (error) {
        // Ignore callback errors
        console.warn('Progress callback error:', error);
      }
    }
  }

  /**
   * Report upload progress
   */
  reportUploadProgress(bytesProcessed: number, bytesTotal: number): void {
    this.currentProgress.bytesProcessed = bytesProcessed;
    this.currentProgress.bytesTotal = bytesTotal;

    const percentage = bytesTotal > 0 ? (bytesProcessed / bytesTotal) * 100 : 0;
    this.report(
      WorkshopUploadStatus.UploadingContent,
      `Uploading content... ${percentage.toFixed(1)}%`
    );
  }

  /**
   * Report translation upload progress
   */
  reportTranslationProgress(current: number, total: number): void {
    this.report(
      WorkshopUploadStatus.UploadingTranslations,
      `Uploading translations ${current}/${total}...`
    );
  }

  /**
   * Report completion
   */
  reportSuccess(message: string): void {
    this.report(WorkshopUploadStatus.Completed, message);
  }

  /**
   * Report failure
   */
  reportFailure(message: string, error?: Error): void {
    this.report(WorkshopUploadStatus.Failed, message, {
      exception: error,
    });
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): WorkshopUploadProgress {
    return { ...this.currentProgress };
  }

  /**
   * Reset the progress tracker
   */
  reset(): void {
    this.currentProgress = {
      status: WorkshopUploadStatus.Pending,
      bytesProcessed: 0,
      bytesTotal: 0,
      message: 'Initializing...',
    };
  }
}

/**
 * Get status name for display
 */
export function getStatusName(status: WorkshopUploadStatus): string {
  return WorkshopUploadStatus[status] || 'Unknown';
}

/**
 * Format progress for display
 */
export function formatProgress(progress: WorkshopUploadProgress): string {
  const parts = [getStatusName(progress.status)];

  if (progress.bytesTotal > 0) {
    const percentage = (progress.bytesProcessed / progress.bytesTotal) * 100;
    parts.push(`(${percentage.toFixed(1)}%)`);
  }

  if (progress.message) {
    parts.push(`- ${progress.message}`);
  }

  return parts.join(' ');
}

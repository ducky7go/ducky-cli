/**
 * Progress display component for Workshop uploads
 * Provides visual progress bar using ora
 */

import ora, { Ora } from 'ora';
import { WorkshopUploadProgress, WorkshopUploadStatus } from './progress.js';
import { formatBytes } from '../../utils/fs.js';

/**
 * Progress display class
 */
export class ProgressDisplay {
  private spinner: Ora | null = null;
  private currentStatus: WorkshopUploadStatus = WorkshopUploadStatus.Pending;
  private startTime: number = 0;

  /**
   * Start the progress display
   */
  start(): void {
    this.spinner = ora({
      text: 'Initializing...',
      spinner: 'dots',
    }).start();
    this.startTime = Date.now();
  }

  /**
   * Update the progress display
   */
  update(progress: WorkshopUploadProgress): void {
    if (!this.spinner) {
      return;
    }

    this.currentStatus = progress.status;

    switch (progress.status) {
      case WorkshopUploadStatus.Preparing:
        this.spinner.text = `${progress.message}`;
        break;

      case WorkshopUploadStatus.RequestingId:
        this.spinner.text = `Creating Workshop item...`;
        break;

      case WorkshopUploadStatus.WritingIni:
        this.spinner.text = `Saving configuration...`;
        break;

      case WorkshopUploadStatus.StartingSteamUpload:
        this.spinner.text = `Starting upload...`;
        break;

      case WorkshopUploadStatus.UploadingContent:
        this.updateUploadProgress(progress);
        break;

      case WorkshopUploadStatus.UploadingTranslations:
        this.spinner.text = progress.message;
        break;

      case WorkshopUploadStatus.Completed:
        this.spinner.succeed(progress.message || 'Upload completed successfully!');
        break;

      case WorkshopUploadStatus.Failed:
        this.spinner.fail(progress.message || 'Upload failed');
        break;

      default:
        this.spinner.text = progress.message || 'Processing...';
    }
  }

  /**
   * Update upload progress with percentage and speed
   */
  private updateUploadProgress(progress: WorkshopUploadProgress): void {
    if (!this.spinner) {
      return;
    }

    const { bytesProcessed, bytesTotal, message } = progress;

    if (bytesTotal > 0) {
      const percentage = (bytesProcessed / bytesTotal) * 100;
      const elapsed = (Date.now() - this.startTime) / 1000; // seconds
      const speed = bytesProcessed / elapsed; // bytes per second

      // Format the progress bar
      const barWidth = 20;
      const filled = Math.floor((bytesProcessed / bytesTotal) * barWidth);
      const empty = barWidth - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);

      // Calculate remaining time
      const remainingBytes = bytesTotal - bytesProcessed;
      const remainingSeconds = speed > 0 ? remainingBytes / speed : 0;
      const remainingTime = this.formatTime(remainingSeconds);

      this.spinner.text = `Uploading content [${bar}] ${percentage.toFixed(1)}% | ${formatBytes(bytesProcessed)}/${formatBytes(bytesTotal)} | ${formatBytes(speed)}/s | ETA: ${remainingTime}`;
    } else {
      this.spinner.text = message || 'Uploading content...';
    }
  }

  /**
   * Format seconds to human-readable time
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
  }

  /**
   * Stop the progress display
   */
  stop(): void {
    if (this.spinner && this.spinner.isSpinning) {
      this.spinner.stop();
    }
    this.spinner = null;
  }

  /**
   * Get the current status
   */
  getCurrentStatus(): WorkshopUploadStatus {
    return this.currentStatus;
  }
}

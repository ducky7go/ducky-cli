// Type declarations for @ducky7go/steamworks.js
declare module '@ducky7go/steamworks.js' {
  interface SteamworksOptions {
    appId?: number;
  }

  interface SteamUGC {
    createItem(appId: number, fileType: number): number;
    startItemUpdate(appId: number, publishedFileId: number): number;
    setItemContent(updateHandle: number, contentPath: string): boolean;
    setItemPreview(updateHandle: number, previewPath: string): boolean;
    setItemTitle(updateHandle: number, title: string): boolean;
    setItemDescription(updateHandle: number, description: string): boolean;
    setItemUpdateLanguage(updateHandle: number, language: string): boolean;
    setItemVisibility(updateHandle: number, visibility: number): boolean;
    submitItemUpdate(updateHandle: number, changeNote: string): number;
    getItemUpdateProgress(updateHandle: number): { bytesProcessed: number; bytesTotal: number };
    getItemUpdateResult(updateHandle: number): { result: number; needsToAcceptWANAgreement?: boolean };
  }

  interface Steamworks {
    init(appId: number): boolean;
    shutdown(): void;
    isRunning(): boolean;
    ugc: SteamUGC;
  }

  const steamworks: Steamworks;
  export default steamworks;
}

// Type declarations for marked
declare module 'marked' {
  export function parse(src: string, options?: any): string;
  export function marked(src: string, options?: any): string;
  const marked: {
    (src: string, options?: any): string;
    setOptions(options: any): void;
  };
  export default marked;
}

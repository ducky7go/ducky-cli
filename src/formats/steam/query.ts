/**
 * Steam Workshop query layer: read-only queries and deletion.
 *
 * All Steamworks access goes through the SteamWorkshopClient interface, so the
 * commands and tests can use a fake client. Numeric enum values are local constants
 * (no runtime const-enum imports) because the library's enums are ambient in its typings.
 */

import {
  SteamError,
  SteamLibraryError,
  SteamNotRunningError,
} from '../../utils/errors.js';
import type { SteamVisibilityName } from '../../utils/config.js';

/** UserListType.Published */
export const USER_LIST_PUBLISHED = 0;
/** UGCType.Items */
export const UGC_TYPE_ITEMS = 0;
/** UserListOrder.LastUpdatedDesc */
export const USER_LIST_ORDER_LAST_UPDATED_DESC = 3;
/** Hard cap on result pages for one listing */
export const MAX_LIST_PAGES = 1000;
/** Items per getItems request when resolving subscriptions */
export const SUBSCRIBED_BATCH_SIZE = 100;

/** Steam visibility numbers in the order public, friends, private, unlisted */
const VISIBILITY_BY_VALUE: SteamVisibilityName[] = ['public', 'friends', 'private', 'unlisted'];

/** Raw statistics as returned by the library (BigInt counters) */
export interface RawStatistics {
  numSubscriptions?: bigint;
  numFavorites?: bigint;
  numFollowers?: bigint;
  numComments?: bigint;
}

/** Raw Workshop item as returned by the library */
export interface RawWorkshopItem {
  publishedFileId: bigint;
  title: string;
  description?: string;
  owner?: { steamId64?: bigint; accountId?: number };
  timeCreated: number;
  timeUpdated: number;
  visibility: number;
  tags?: string[];
  url?: string;
  numUpvotes?: number;
  numDownvotes?: number;
  statistics?: RawStatistics;
}

/** Raw paginated or batched result */
export interface RawItemsResult {
  items: Array<RawWorkshopItem | null | undefined>;
  totalResults?: number;
}

/** Local install information for a subscribed item */
export interface RawInstallInfo {
  folder: string;
  sizeOnDisk: bigint;
  timestamp: number;
}

/** Query options accepted by item lookups */
export interface ItemQueryConfig {
  includeLongDescription?: boolean;
  language?: string;
}

/**
 * The subset of Steamworks used by ducky steam commands.
 * The real implementation is loaded with loadSteamWorkshopClient(); tests supply fakes.
 */
export interface SteamWorkshopClient {
  getUserItems(
    page: number,
    accountId: number,
    listType: number,
    itemType: number,
    sortOrder: number,
    appIds: { creator?: number; consumer?: number },
  ): Promise<RawItemsResult>;
  getItem(id: bigint, config?: ItemQueryConfig): Promise<RawWorkshopItem | null | undefined>;
  getItems(ids: bigint[], config?: ItemQueryConfig): Promise<RawItemsResult>;
  getSubscribedItems(): bigint[];
  installInfo(id: bigint): RawInstallInfo | null | undefined;
  deleteItem(id: bigint): Promise<void>;
  getAccountId(): number;
  isConnected(): boolean;
}

/** Item shape produced for commands and JSON output (IDs as strings, ISO timestamps) */
export interface WorkshopItemSummary {
  id: string;
  title: string;
  visibility: SteamVisibilityName | 'unknown';
  timeCreated: string | null;
  timeUpdated: string | null;
  subscribers: number;
  favorites: number;
  followers: number;
  comments: number;
  upvotes: number;
  downvotes: number;
  tags: string[];
  url: string;
  owner: string | null;
  description: string;
}

/** One subscribed item with its install status */
export interface SubscribedItemSummary {
  id: string;
  title: string;
  installed: boolean;
  folder?: string;
  sizeOnDisk?: number;
  installedAt?: string;
}

function toNumber(value: bigint | number | undefined): number {
  return value === undefined ? 0 : Number(value);
}

/** Convert Unix seconds to an ISO-8601 string; null when Steam reports no time */
export function isoFromUnixSeconds(seconds: number): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

/** Map a Steam visibility number to its name */
export function visibilityFromSteam(value: number): SteamVisibilityName | 'unknown' {
  return VISIBILITY_BY_VALUE[value] ?? 'unknown';
}

/** Convert a raw library item into the summary shape */
export function toWorkshopItemSummary(raw: RawWorkshopItem): WorkshopItemSummary {
  const id = raw.publishedFileId.toString();
  return {
    id,
    title: raw.title,
    visibility: visibilityFromSteam(raw.visibility),
    timeCreated: isoFromUnixSeconds(raw.timeCreated),
    timeUpdated: isoFromUnixSeconds(raw.timeUpdated),
    subscribers: toNumber(raw.statistics?.numSubscriptions),
    favorites: toNumber(raw.statistics?.numFavorites),
    followers: toNumber(raw.statistics?.numFollowers),
    comments: toNumber(raw.statistics?.numComments),
    upvotes: raw.numUpvotes ?? 0,
    downvotes: raw.numDownvotes ?? 0,
    tags: raw.tags ?? [],
    url: raw.url || `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
    owner: raw.owner?.steamId64 !== undefined ? String(raw.owner.steamId64) : null,
    description: raw.description ?? '',
  };
}

/**
 * List every published item of the signed-in account for an App ID.
 * Follows pagination until totalResults is reached, an empty page is returned, or the page cap is hit.
 * Null or missing entries are skipped.
 */
export async function listPublishedItems(
  client: SteamWorkshopClient,
  appId: number,
  options: { onPage?: (page: number, entries: number) => void } = {},
): Promise<{ items: WorkshopItemSummary[]; pages: number; truncated: boolean }> {
  const accountId = client.getAccountId();
  const items: WorkshopItemSummary[] = [];
  let page = 1;
  let seen = 0;
  let truncated = false;

  for (;;) {
    if (page > MAX_LIST_PAGES) {
      truncated = true;
      break;
    }
    const result = await client.getUserItems(
      page,
      accountId,
      USER_LIST_PUBLISHED,
      UGC_TYPE_ITEMS,
      USER_LIST_ORDER_LAST_UPDATED_DESC,
      { creator: appId, consumer: appId },
    );
    const entries = result.items ?? [];
    options.onPage?.(page, entries.length);

    for (const entry of entries) {
      if (entry && entry.publishedFileId !== undefined) {
        items.push(toWorkshopItemSummary(entry));
      }
    }

    seen += entries.length;
    const total = result.totalResults ?? 0;
    if (entries.length === 0 || seen >= total) {
      break;
    }
    page += 1;
  }

  return { items, pages: page, truncated };
}

/**
 * Fetch one Workshop item. Returns null when Steam has no such item.
 */
export async function getWorkshopItem(
  client: SteamWorkshopClient,
  id: bigint,
  config?: ItemQueryConfig,
): Promise<WorkshopItemSummary | null> {
  const raw = await client.getItem(id, config);
  if (!raw || raw.publishedFileId === undefined) {
    return null;
  }
  return toWorkshopItemSummary(raw);
}

/**
 * List subscribed items with their local install status.
 * Titles come from batched getItems calls; install info from installInfo per item.
 */
export async function listSubscribedItems(client: SteamWorkshopClient): Promise<SubscribedItemSummary[]> {
  const ids = client.getSubscribedItems();
  const titles = new Map<string, string>();

  for (let i = 0; i < ids.length; i += SUBSCRIBED_BATCH_SIZE) {
    const chunk = ids.slice(i, i + SUBSCRIBED_BATCH_SIZE);
    const result = await client.getItems(chunk);
    for (const entry of result.items ?? []) {
      if (entry && entry.publishedFileId !== undefined) {
        titles.set(entry.publishedFileId.toString(), entry.title);
      }
    }
  }

  return ids.map((id) => {
    const key = id.toString();
    const info = client.installInfo(id);
    const summary: SubscribedItemSummary = {
      id: key,
      title: titles.get(key) ?? '(title unavailable)',
      installed: Boolean(info),
    };
    if (info) {
      summary.folder = info.folder;
      summary.sizeOnDisk = Number(info.sizeOnDisk);
      summary.installedAt = isoFromUnixSeconds(info.timestamp) ?? undefined;
    }
    return summary;
  });
}

/**
 * Matches the readable reasons the native layer uses when Steam's result is unrecognised or
 * the completion was lost. Such a result says nothing about whether the item was deleted.
 */
const UNKNOWN_OUTCOME_PATTERN = /unknown (steam )?result|outcome is unknown|completion was not received/i;

/** True when a native error reason means the deletion outcome is unknown rather than rejected */
export function isUnknownOutcomeReason(reason: string): boolean {
  return UNKNOWN_OUTCOME_PATTERN.test(reason);
}

/** Error for a deletion Steam rejected with a stated reason */
export function rejectionError(id: bigint, reason: string): SteamError {
  return new SteamError(`Steam rejected the deletion of item ${id}, so it was not deleted: ${reason}`, [
    'Check that the item ID is correct',
    'Check that the item belongs to the signed-in Steam account',
    'Check that the App ID is correct (--app-id, STEAM_APP_ID or .duckyrc)',
  ]);
}

/** Error for a deletion whose result Steam did not give a usable answer for; the item must be checked */
export function unknownOutcomeError(id: bigint, reason: string): SteamError {
  return new SteamError(
    `The result of deleting item ${id} is unknown (${reason}). The item may or may not have been deleted.`,
    [
      `Check whether the item still exists: ducky steam info ${id}, or ducky steam list`,
      'Retry only after confirming the item still exists',
    ],
  );
}

/**
 * Delete a Workshop item. Steam's rejection reason is included in the error.
 * An unrecognised result or lost completion is reported as an unknown outcome, not as a rejection.
 * @throws {SteamError} When Steam rejects the deletion or the outcome is unknown
 */
export async function deleteWorkshopItem(client: SteamWorkshopClient, id: bigint): Promise<void> {
  try {
    await client.deleteItem(id);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw isUnknownOutcomeReason(reason) ? unknownOutcomeError(id, reason) : rejectionError(id, reason);
  }
}

/** Whether the item still exists on Steam, as far as one query can tell */
export type ItemPresence = 'present' | 'absent' | 'unknown';

/**
 * Check whether a Workshop item exists, for use after a deletion attempt.
 * A failed or inconclusive query is 'unknown', never 'absent'.
 */
export async function verifyItemPresence(client: SteamWorkshopClient, id: bigint): Promise<ItemPresence> {
  if (!client.isConnected()) {
    return 'unknown';
  }
  try {
    const raw = await client.getItem(id);
    return !raw || raw.publishedFileId === undefined ? 'absent' : 'present';
  } catch {
    return 'unknown';
  }
}

/** Shape of the native API object returned by init() */
interface SteamApiShape {
  workshop: {
    getUserItems(
      page: number,
      accountId: number,
      listType: number,
      itemType: number,
      sortOrder: number,
      appIds: { creator?: number; consumer?: number },
      config: ItemQueryConfig | undefined,
    ): Promise<RawItemsResult>;
    getItem(id: bigint, config: ItemQueryConfig | undefined): Promise<RawWorkshopItem | null | undefined>;
    getItems(ids: bigint[], config: ItemQueryConfig | undefined): Promise<RawItemsResult>;
    getSubscribedItems(): bigint[];
    installInfo(id: bigint): RawInstallInfo | null | undefined;
    deleteItem(id: bigint): Promise<void>;
  };
  localplayer: { getSteamId(): { accountId: number } };
}

/** Top-level module shape */
export interface SteamModule {
  init(appId?: number): unknown;
  shutdown?(): void;
  isConnected?(): boolean;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Load the Steamworks library.
 * @throws {SteamLibraryError} When the native module cannot be loaded
 */
export async function loadSteamModule(): Promise<SteamModule> {
  try {
    return (await import('@hagicode/steamworks.js')) as unknown as SteamModule;
  } catch (error) {
    throw new SteamLibraryError(reasonOf(error));
  }
}

function toClient(api: SteamApiShape, connected: () => boolean): SteamWorkshopClient {
  const ws = api.workshop;
  return {
    getUserItems: (page, accountId, listType, itemType, sortOrder, appIds) =>
      ws.getUserItems(page, accountId, listType, itemType, sortOrder, appIds, undefined),
    getItem: (id, config) => ws.getItem(id, config),
    getItems: (ids, config) => ws.getItems(ids, config),
    getSubscribedItems: () => ws.getSubscribedItems(),
    installInfo: (id) => ws.installInfo(id),
    deleteItem: (id) => ws.deleteItem(id),
    getAccountId: () => api.localplayer.getSteamId().accountId,
    isConnected: connected,
  };
}

/**
 * Run a function with a connected Steamworks client for the given App ID.
 * Steam being absent or not logged in is reported as SteamNotRunningError.
 * The Steamworks proxy is shut down afterwards.
 *
 * @param loader - Library loader (injectable for tests)
 * @throws {SteamLibraryError} When the library cannot be loaded
 * @throws {SteamNotRunningError} When Steam cannot be initialized or is not connected
 */
export async function withSteamSession<T>(
  appId: number,
  fn: (client: SteamWorkshopClient) => Promise<T>,
  loader: () => Promise<SteamModule> = loadSteamModule,
): Promise<T> {
  const mod = await loader();

  let api: SteamApiShape;
  try {
    api = mod.init(appId) as SteamApiShape;
  } catch (error) {
    throw new SteamNotRunningError(undefined, [
      'Start the Steam client and log in',
      'Make sure Steam and this terminal run as the same user at the same privilege level',
      `Native error: ${reasonOf(error)}`,
    ]);
  }
  if (!api) {
    throw new SteamNotRunningError();
  }

  const connected = () => (mod.isConnected ? mod.isConnected() : true);
  if (!connected()) {
    throw new SteamNotRunningError();
  }

  try {
    return await fn(toClient(api, connected));
  } finally {
    try {
      mod.shutdown?.();
    } catch {
      // Shutdown is best effort; the process exits right after the command
    }
  }
}

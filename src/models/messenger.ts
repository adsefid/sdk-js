import type { WebServiceStatus } from "../enums.js";
import type {
  CancelRequest,
  CancelResponse,
  TemplateParameters,
  WebServiceCodeCounts,
} from "./common.js";

// ---------------------------------------------------------------------------
// 5.1 POST /v1/messenger/single
// ---------------------------------------------------------------------------

/** Request body for `client.messenger.sendSingle` — `POST /v1/messenger/single` (doc §5.1). */
export interface SendSingleMessengerRequest {
  message: string;
  receptor: string;
  profile: string;
  hide?: boolean;
  file_id?: string;
  send_time?: string;
  local_id?: string;
}

export interface SendSingleMessengerResponse {
  group_id: string;
  message_id: string;
  status: WebServiceStatus;
  receptor: string;
  local_id: string | null;
  hide: boolean;
  cost: number;
  send_time: string;
  profile: string;
  /** Free-form provider name, e.g. "rubika", "bale". No complete enum documented. */
  messenger: string;
}

// ---------------------------------------------------------------------------
// 5.2 POST /v1/messenger/bulk
// ---------------------------------------------------------------------------

export interface BulkMessengerReceptorRequest {
  receptor: string;
  local_id?: string;
  hide?: boolean;
}

/** Request body for `client.messenger.sendBulk` — `POST /v1/messenger/bulk` (doc §5.2): one message, many receptors. */
export interface SendBulkMessengerRequest {
  receptors: BulkMessengerReceptorRequest[];
  message: string;
  send_time?: string;
  profile: string;
  file_id?: string;
}

export interface BulkMessengerReceptorResult {
  message_id: string | null;
  receptor: string;
  local_id: string | null;
  hide: boolean;
  status: WebServiceStatus;
  cost: number;
}

export interface SendBulkMessengerResponse {
  group_id: string;
  receptors: BulkMessengerReceptorResult[];
  message: string;
  send_time: string;
  total_count: number;
  total_cost: number;
  counts: WebServiceCodeCounts;
  profile: string;
  messenger: string;
}

// ---------------------------------------------------------------------------
// 5.3 POST /v1/messenger/p2p
// ---------------------------------------------------------------------------

export interface P2pMessengerReceptorRequest {
  receptor: string;
  message: string;
  local_id?: string;
  hide?: boolean;
}

/** Request body for `client.messenger.sendP2P` — `POST /v1/messenger/p2p` (doc §5.3): distinct messages per receptor. */
export interface SendP2pMessengerRequest {
  receptors: P2pMessengerReceptorRequest[];
  send_time?: string;
  profile: string;
  file_id?: string;
}

export interface P2pMessengerReceptorResult {
  message_id: string | null;
  receptor: string;
  message: string;
  local_id: string | null;
  hide: boolean;
  status: WebServiceStatus;
  cost: number;
}

export interface SendP2pMessengerResponse {
  group_id: string;
  receptors: P2pMessengerReceptorResult[];
  send_time: string;
  total_count: number;
  total_cost: number;
  counts: WebServiceCodeCounts;
  profile: string;
  messenger: string;
}

// ---------------------------------------------------------------------------
// 5.4 POST /v1/messenger/file
// ---------------------------------------------------------------------------

export interface UploadMessengerFileResponse {
  file_id: string;
}

/** Allowed MIME types per doc §5.4. Provided for convenience/validation; not exhaustive-enforced. */
export const MESSENGER_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/opus",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
] as const;

export const MESSENGER_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 5.5 POST /v1/messenger/cancel
// ---------------------------------------------------------------------------

export type CancelMessengerRequest = CancelRequest;
export type CancelMessengerResponse = CancelResponse;

// ---------------------------------------------------------------------------
// 5.6 POST /v1/messenger/template
// ---------------------------------------------------------------------------

/** Request body for `client.messenger.sendTemplate` — `POST /v1/messenger/template` (doc §5.6). */
export interface SendTemplateMessengerRequest {
  template_id: string;
  parameters: TemplateParameters;
  receptor: string;
  local_id?: string;
  profile: string;
  expiry_date?: string;
}

export interface SendTemplateMessengerResponse {
  group_id: string;
  message_id: string;
  status: WebServiceStatus;
  local_id: string | null;
  template_id: string;
  send_time: string;
  expiry_date: string | null;
  cost: number;
  receptor: string;
  message: string;
  profile: string;
  messenger: string;
  parameters: TemplateParameters;
}

// ---------------------------------------------------------------------------
// 5.7 GET /v1/messenger/status
// ---------------------------------------------------------------------------

/** Query params for `client.messenger.getStatus` — `GET /v1/messenger/status` (doc §5.7). */
export interface GetMessengerStatusQuery {
  message_ids?: string[];
  local_ids?: string[];
}

export interface MessengerStatusReceptor {
  message_id: string;
  local_id: string | null;
  status: WebServiceStatus;
  receptor: string;
  send_time: string;
  delivery_time: string | null;
}

export interface GetMessengerStatusResponse {
  receptors: MessengerStatusReceptor[];
}

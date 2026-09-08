import type { LineSelector, WebServiceStatus } from "../enums.js";
import type {
  CancelRequest,
  CancelResponse,
  TemplateParameters,
  WebServiceCodeCounts,
} from "./common.js";

// ---------------------------------------------------------------------------
// 4.1 POST /v1/sms/single
// ---------------------------------------------------------------------------

/** Request body for `client.sms.sendSingle` — `POST /v1/sms/single` (doc §4.1). */
export interface SendSingleSmsRequest {
  receptor: string;
  line_number: string;
  line_selector?: LineSelector;
  message: string;
  /** Raw ISO-8601 string, e.g. "2026-04-04T10:30:00+03:30". Never a `Date`. */
  send_time?: string;
  local_id?: string;
  hide?: boolean;
}

export interface SendSingleSmsResponse {
  group_id: string;
  local_id: string | null;
  status: WebServiceStatus;
  line_number: string;
  line_selector: LineSelector;
  cost: number;
  receptor: string;
  send_time: string;
  message_id: string;
  segment_count: number;
  hide: boolean;
}

// ---------------------------------------------------------------------------
// 4.2 POST /v1/sms/bulk
// ---------------------------------------------------------------------------

export interface BulkSmsReceptorRequest {
  receptor: string;
  local_id?: string;
  hide?: boolean;
}

/** Request body for `client.sms.sendBulk` — `POST /v1/sms/bulk` (doc §4.2): one message, many receptors. */
export interface SendBulkSmsRequest {
  receptors: BulkSmsReceptorRequest[];
  message: string;
  send_time?: string;
  line_number: string;
  line_selector?: LineSelector;
}

export interface BulkSmsReceptorResult {
  message_id: string | null;
  receptor: string;
  local_id: string | null;
  status: WebServiceStatus;
  hide: boolean;
  cost: number;
}

export interface SendBulkSmsResponse {
  group_id: string;
  receptors: BulkSmsReceptorResult[];
  message: string;
  segment_count: number;
  send_time: string;
  line_number: string;
  line_selector: LineSelector;
  counts: WebServiceCodeCounts;
  total_count: number;
  total_cost: number;
}

// ---------------------------------------------------------------------------
// 4.3 POST /v1/sms/p2p
// ---------------------------------------------------------------------------

export interface P2pSmsMessageRequest {
  receptor: string;
  message: string;
  local_id?: string;
  hide?: boolean;
}

/** Request body for `client.sms.sendP2P` — `POST /v1/sms/p2p` (doc §4.3): distinct messages per receptor. */
export interface SendP2pSmsRequest {
  messages: P2pSmsMessageRequest[];
  send_time?: string;
  line_number: string;
  line_selector?: LineSelector;
}

export interface P2pSmsMessageResult {
  message_id: string | null;
  receptor: string;
  status: WebServiceStatus;
  local_id: string | null;
  message: string;
  hide: boolean;
  segment_count: number;
  cost: number;
}

export interface SendP2pSmsResponse {
  group_id: string;
  messages: P2pSmsMessageResult[];
  send_time: string;
  line_number: string;
  line_selector: LineSelector;
  total_cost: number;
  counts: WebServiceCodeCounts;
}

// ---------------------------------------------------------------------------
// 4.4 POST /v1/sms/template
// ---------------------------------------------------------------------------

/** Request body for `client.sms.sendTemplate` — `POST /v1/sms/template` (doc §4.4). */
export interface SendTemplateSmsRequest {
  template_id: string;
  parameters: TemplateParameters;
  receptor: string;
  local_id?: string;
  line_number: string;
  line_selector?: LineSelector;
  /** Raw ISO-8601 string. Must be >= now + 1 minute per the API. */
  expiry_date?: string;
}

export interface SendTemplateSmsResponse {
  group_id: string;
  message_id: string;
  status: WebServiceStatus;
  local_id: string | null;
  line_number: string;
  template_id: string;
  send_time: string;
  expiry_date: string | null;
  line_selector: LineSelector;
  cost: number;
  receptor: string;
  message: string;
  segment_count: number;
  parameters: TemplateParameters;
}

// ---------------------------------------------------------------------------
// 4.5 GET /v1/sms/status
// ---------------------------------------------------------------------------

/** Query params for `client.sms.getStatus` — `GET /v1/sms/status` (doc §4.5). */
export interface GetSmsStatusQuery {
  message_ids?: string[];
  local_ids?: string[];
}

export interface SmsStatusReceptor {
  message_id: string;
  local_id: string | null;
  status: WebServiceStatus;
  receptor: string;
  send_time: string;
  delivery_time: string | null;
}

export interface GetSmsStatusResponse {
  receptors: SmsStatusReceptor[];
}

// ---------------------------------------------------------------------------
// 4.6 POST /v1/sms/cancel
// ---------------------------------------------------------------------------

export type CancelSmsRequest = CancelRequest;
export type CancelSmsResponse = CancelResponse;

// ---------------------------------------------------------------------------
// 4.7 GET /v1/sms/receive
// ---------------------------------------------------------------------------

/** Query params for `client.sms.getReceived` — `GET /v1/sms/receive` (doc §4.7). */
export interface GetReceivedSmsQuery {
  line_number: string;
  count?: number;
  /** Raw ISO-8601 string. Must be in the past. */
  since?: string;
}

export interface ReceivedSmsMessage {
  message: string;
  line_number: string;
  receive_date: string;
  sender: string;
}

export interface GetReceivedSmsResponse {
  messages: ReceivedSmsMessage[];
}

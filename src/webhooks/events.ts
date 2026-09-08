import type { WebServiceStatus } from "../enums.js";

/** One item of a `receive` webhook payload, per doc §7.4. */
export interface ReceiveWebhookItem {
  id: number;
  line_number: string;
  sender: string;
  message: string;
  receive_date: Date;
}

/** One item of a `status` / `messenger.status` webhook payload, per doc §7.5-7.6. */
export interface StatusWebhookItem {
  id: string;
  local_id: string | null;
  status_delivery: WebServiceStatus;
  delivery_time: Date | null;
}

interface WebhookEventBase {
  id: string;
  occurred_at: Date;
  attempt: number;
  version: string;
}

export interface ReceiveWebhookEvent extends WebhookEventBase {
  type: "receive";
  data: ReceiveWebhookItem[];
}

export interface StatusWebhookEvent extends WebhookEventBase {
  type: "status";
  data: StatusWebhookItem[];
}

export interface MessengerStatusWebhookEvent extends WebhookEventBase {
  type: "messenger.status";
  data: StatusWebhookItem[];
}

export type WebhookEvent = ReceiveWebhookEvent | StatusWebhookEvent | MessengerStatusWebhookEvent;

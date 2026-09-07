import type { ResolvedAdsefidClientOptions } from "../config.js";
import { sendRequest } from "../http.js";
import type {
  CancelSmsRequest,
  CancelSmsResponse,
  GetReceivedSmsQuery,
  GetReceivedSmsResponse,
  GetSmsStatusQuery,
  GetSmsStatusResponse,
  SendBulkSmsRequest,
  SendBulkSmsResponse,
  SendP2pSmsRequest,
  SendP2pSmsResponse,
  SendSingleSmsRequest,
  SendSingleSmsResponse,
  SendSmsTemplateRequest,
  SendSmsTemplateResponse,
} from "../models/sms.js";
import {
  assertAtLeastOneProvided,
  assertMaxCount,
  assertMaxLength,
  assertNonEmptyArray,
  assertRequired,
  assertValidLocalId,
  joinCsv,
} from "../validation.js";

const SMS_MESSAGE_MAX_LENGTH = 900;
const MAX_STATUS_IDS = 2000;
/** Doc §4.7: `count` must be strictly less than this value. */
const RECEIVE_COUNT_EXCLUSIVE_MAX = 500;

/** SMS endpoints — accessed via `client.sms`. */
export class SmsResource {
  public constructor(private readonly config: ResolvedAdsefidClientOptions) {}

  /** POST /v1/sms/single — doc §4.1 */
  public async sendSingle(request: SendSingleSmsRequest): Promise<SendSingleSmsResponse> {
    assertRequired(request.receptor, "receptor");
    assertRequired(request.line_number, "line_number");
    assertRequired(request.message, "message");
    assertMaxLength(request.message, SMS_MESSAGE_MAX_LENGTH, "message");
    assertValidLocalId(request.local_id, "local_id");

    return sendRequest<SendSingleSmsResponse>(this.config, {
      method: "POST",
      path: "/v1/sms/single",
      jsonBody: request,
    });
  }

  /** POST /v1/sms/bulk — doc §4.2 */
  public async sendBulk(request: SendBulkSmsRequest): Promise<SendBulkSmsResponse> {
    assertNonEmptyArray(request.receptors, "receptors");
    assertRequired(request.message, "message");
    assertMaxLength(request.message, SMS_MESSAGE_MAX_LENGTH, "message");
    assertRequired(request.line_number, "line_number");
    request.receptors.forEach((receptor, index) => {
      assertRequired(receptor.receptor, `receptors[${index}].receptor`);
      assertValidLocalId(receptor.local_id, `receptors[${index}].local_id`);
    });

    return sendRequest<SendBulkSmsResponse>(this.config, {
      method: "POST",
      path: "/v1/sms/bulk",
      jsonBody: request,
    });
  }

  /** POST /v1/sms/p2p — doc §4.3 */
  public async sendP2P(request: SendP2pSmsRequest): Promise<SendP2pSmsResponse> {
    assertNonEmptyArray(request.messages, "messages");
    assertRequired(request.line_number, "line_number");
    request.messages.forEach((message, index) => {
      assertRequired(message.receptor, `messages[${index}].receptor`);
      assertRequired(message.message, `messages[${index}].message`);
      assertMaxLength(message.message, SMS_MESSAGE_MAX_LENGTH, `messages[${index}].message`);
      assertValidLocalId(message.local_id, `messages[${index}].local_id`);
    });

    return sendRequest<SendP2pSmsResponse>(this.config, {
      method: "POST",
      path: "/v1/sms/p2p",
      jsonBody: request,
    });
  }

  /** POST /v1/sms/template — doc §4.4 */
  public async sendTemplate(request: SendSmsTemplateRequest): Promise<SendSmsTemplateResponse> {
    assertRequired(request.template_id, "template_id");
    assertRequired(request.parameters, "parameters");
    assertRequired(request.receptor, "receptor");
    assertRequired(request.line_number, "line_number");
    assertValidLocalId(request.local_id, "local_id");

    return sendRequest<SendSmsTemplateResponse>(this.config, {
      method: "POST",
      path: "/v1/sms/template",
      jsonBody: request,
    });
  }

  /** GET /v1/sms/status — doc §4.5 */
  public async getStatus(query: GetSmsStatusQuery): Promise<GetSmsStatusResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: query.message_ids },
      { name: "local_ids", value: query.local_ids },
    ]);
    const combinedCount =
      new Set(query.message_ids ?? []).size + new Set(query.local_ids ?? []).size;
    assertMaxCount(combinedCount, MAX_STATUS_IDS, "message_ids+local_ids");

    return sendRequest<GetSmsStatusResponse>(this.config, {
      method: "GET",
      path: "/v1/sms/status",
      query: {
        message_ids: joinCsv(query.message_ids),
        local_ids: joinCsv(query.local_ids),
      },
    });
  }

  /** POST /v1/sms/cancel — doc §4.6 */
  public async cancel(request: CancelSmsRequest): Promise<CancelSmsResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: request.message_ids },
      { name: "local_ids", value: request.local_ids },
    ]);

    return sendRequest<CancelSmsResponse>(this.config, {
      method: "POST",
      path: "/v1/sms/cancel",
      jsonBody: request,
    });
  }

  /** GET /v1/sms/receive — doc §4.7 */
  public async getReceived(query: GetReceivedSmsQuery): Promise<GetReceivedSmsResponse> {
    assertRequired(query.line_number, "line_number");
    if (query.count !== undefined) {
      assertMaxCount(query.count, RECEIVE_COUNT_EXCLUSIVE_MAX - 1, "count");
    }

    return sendRequest<GetReceivedSmsResponse>(this.config, {
      method: "GET",
      path: "/v1/sms/receive",
      query: {
        line_number: query.line_number,
        count: query.count?.toString(),
        since: query.since,
      },
    });
  }
}

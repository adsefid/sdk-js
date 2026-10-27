import type { ResolvedAdsefidClientOptions } from "../config.js";
import { dateFromWire, dateToWire, nullableDateFromWire, type Wire } from "../dates.js";
import { type CallOptions, sendRequest } from "../http.js";
import type {
  CancelSmsRequest,
  CancelSmsResponse,
  GetReceivedSmsQuery,
  GetReceivedSmsResponse,
  GetSmsStatusQuery,
  GetSmsStatusResponse,
  SendBulkSmsRequest,
  SendBulkSmsResponse,
  SendP2PSmsRequest,
  SendP2PSmsResponse,
  SendSingleSmsRequest,
  SendSingleSmsResponse,
  SendTemplateSmsRequest,
  SendTemplateSmsResponse,
} from "../models/sms.js";
import {
  assertAtLeastOneProvided,
  assertInRange,
  assertMaxCount,
  assertMaxLength,
  assertNonEmptyArray,
  assertRequired,
  assertValidLocalId,
  LIMITS,
} from "../validation.js";
import { mapResponse } from "../wire.js";

/** SMS endpoints — accessed via `client.sms`. */
export class SmsResource {
  public constructor(private readonly config: ResolvedAdsefidClientOptions) {}

  /** POST /v1/sms/single — doc §4.1 */
  public async sendSingle(
    request: SendSingleSmsRequest,
    options?: CallOptions,
  ): Promise<SendSingleSmsResponse> {
    assertRequired(request.receptor, "receptor");
    assertRequired(request.line_number, "line_number");
    assertRequired(request.message, "message");
    assertMaxLength(request.message, LIMITS.smsMessageMaxLength, "message");
    assertValidLocalId(request.local_id, "local_id");

    const response = await sendRequest<Wire<SendSingleSmsResponse>>(
      this.config,
      {
        method: "POST",
        path: "/v1/sms/single",
        jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
      },
      options,
    );

    return mapResponse("/v1/sms/single", () => ({
      ...response,
      send_time: nullableDateFromWire(response.send_time, "send_time"),
    }));
  }

  /** POST /v1/sms/bulk — item errors are returned in the partial response (doc §4.2). */
  public async sendBulk(
    request: SendBulkSmsRequest,
    options?: CallOptions,
  ): Promise<SendBulkSmsResponse> {
    assertNonEmptyArray(request.receptors, "receptors");
    assertRequired(request.message, "message");
    assertMaxLength(request.message, LIMITS.smsMessageMaxLength, "message");
    assertRequired(request.line_number, "line_number");

    const response = await sendRequest<Wire<SendBulkSmsResponse>>(
      this.config,
      {
        method: "POST",
        path: "/v1/sms/bulk",
        jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
      },
      options,
    );

    return mapResponse("/v1/sms/bulk", () => ({
      ...response,
      send_time: nullableDateFromWire(response.send_time, "send_time"),
    }));
  }

  /** POST /v1/sms/p2p — item errors are returned in the partial response (doc §4.3). */
  public async sendP2P(
    request: SendP2PSmsRequest,
    options?: CallOptions,
  ): Promise<SendP2PSmsResponse> {
    assertNonEmptyArray(request.messages, "messages");
    assertRequired(request.line_number, "line_number");

    const response = await sendRequest<Wire<SendP2PSmsResponse>>(
      this.config,
      {
        method: "POST",
        path: "/v1/sms/p2p",
        jsonBody: { ...request, send_time: dateToWire(request.send_time, "send_time") },
      },
      options,
    );

    return mapResponse("/v1/sms/p2p", () => ({
      ...response,
      send_time: nullableDateFromWire(response.send_time, "send_time"),
    }));
  }

  /** POST /v1/sms/template — doc §4.4 */
  public async sendTemplate(
    request: SendTemplateSmsRequest,
    options?: CallOptions,
  ): Promise<SendTemplateSmsResponse> {
    assertRequired(request.template_id, "template_id");
    assertRequired(request.parameters, "parameters");
    assertRequired(request.receptor, "receptor");
    assertRequired(request.line_number, "line_number");
    assertValidLocalId(request.local_id, "local_id");

    const response = await sendRequest<Wire<SendTemplateSmsResponse>>(
      this.config,
      {
        method: "POST",
        path: "/v1/sms/template",
        jsonBody: { ...request, expiry_date: dateToWire(request.expiry_date, "expiry_date") },
      },
      options,
    );

    return mapResponse("/v1/sms/template", () => ({
      ...response,
      send_time: nullableDateFromWire(response.send_time, "send_time"),
      expiry_date: nullableDateFromWire(response.expiry_date, "expiry_date"),
    }));
  }

  /** GET /v1/sms/status — doc §4.5 */
  public async getStatus(
    query: GetSmsStatusQuery,
    options?: CallOptions,
  ): Promise<GetSmsStatusResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: query.message_ids },
      { name: "local_ids", value: query.local_ids },
    ]);
    const combinedCount =
      new Set(query.message_ids ?? []).size + new Set(query.local_ids ?? []).size;
    assertMaxCount(combinedCount, LIMITS.combinedStatusIdsMax, "message_ids+local_ids");

    const response = await sendRequest<Wire<GetSmsStatusResponse>>(
      this.config,
      {
        method: "GET",
        path: "/v1/sms/status",
        query: {
          message_ids: query.message_ids,
          local_ids: query.local_ids,
        },
      },
      options,
    );

    return mapResponse("/v1/sms/status", () => ({
      receptors: response.receptors.map((receptor) => ({
        ...receptor,
        send_time: nullableDateFromWire(receptor.send_time, "send_time"),
        delivery_time: nullableDateFromWire(receptor.delivery_time, "delivery_time"),
      })),
    }));
  }

  /** POST /v1/sms/cancel — doc §4.6 */
  public async cancel(
    request: CancelSmsRequest,
    options?: CallOptions,
  ): Promise<CancelSmsResponse> {
    assertAtLeastOneProvided([
      { name: "message_ids", value: request.message_ids },
      { name: "local_ids", value: request.local_ids },
    ]);
    const combinedCount =
      new Set(request.message_ids ?? []).size + new Set(request.local_ids ?? []).size;
    assertMaxCount(combinedCount, LIMITS.combinedCancelIdsMax, "message_ids+local_ids");

    return sendRequest<CancelSmsResponse>(
      this.config,
      {
        method: "POST",
        path: "/v1/sms/cancel",
        jsonBody: request,
      },
      options,
    );
  }

  /** GET /v1/sms/receive — doc §4.7 */
  public async getReceived(
    query: GetReceivedSmsQuery,
    options?: CallOptions,
  ): Promise<GetReceivedSmsResponse> {
    assertRequired(query.line_number, "line_number");
    if (query.count !== undefined) {
      assertInRange(query.count, LIMITS.receiveCountMin, LIMITS.receiveCountMax, "count");
    }

    const response = await sendRequest<Wire<GetReceivedSmsResponse>>(
      this.config,
      {
        method: "GET",
        path: "/v1/sms/receive",
        query: {
          line_number: query.line_number,
          count: query.count?.toString(),
          since: dateToWire(query.since, "since"),
        },
      },
      options,
    );

    return mapResponse("/v1/sms/receive", () => ({
      messages: response.messages.map((message) => ({
        ...message,
        receive_date: dateFromWire(message.receive_date, "receive_date"),
      })),
    }));
  }
}

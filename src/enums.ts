/**
 * Doc §3.1 — LineSelector
 */
export const LineSelector = {
  PromotionalSendBased: 0,
  PromotionalDeliverBased: 1,
  BulkServiceSendBased: 2,
  BulkServiceDeliverBased: 3,
  CustomerClubServiceSendBased: 4,
  CustomerClubServiceDeliverBased: 5,
} as const;

export type LineSelector = (typeof LineSelector)[keyof typeof LineSelector];

/**
 * Doc §3.2 — WebServiceMessageStatus (1000-1999)
 */
export const WebServiceMessageStatus = {
  SCHEDULED: 1000,
  SENDING: 1001,
  DELIVERED: 1002,
  UNDELIVERED: 1003,
  CANCELED: 1004,
  SENT_TO_OPERATOR: 1005,
  BLACKLISTED: 1006,
  PROVIDER_ERROR: 1007,
  PENDING_APPROVAL: 1008,
  REJECTED: 1009,
  INVALID_SENDER: 1010,
  INVALID_ATTACHMENT: 1011,
  FORBIDDEN_WORD: 1012,
  LINK_NOT_ALLOWED: 1013,
  INVALID_RECEIVER: 1014,
  UNDELIVERABLE: 1015,
  SENDER_LIMIT_REACHED: 1016,
  UNKNOWN: 1999,
} as const;

export type WebServiceMessageStatus =
  (typeof WebServiceMessageStatus)[keyof typeof WebServiceMessageStatus];

/**
 * A `WebServiceCode` value used in a message `status` field (doc §3.3):
 * one of the known `WebServiceMessageStatus` values, or any other numeric
 * code the server may report that isn't in the documented set.
 */
export type WebServiceStatus = WebServiceMessageStatus | number;

/**
 * Doc §3.4 — WebServiceResponseCode (2000-2045)
 */
export const WebServiceResponseCode = {
  INTERNAL_ERROR: 2000,
  INVALID_PLAN: 2001,
  LINE_NOT_FOUND: 2002,
  TOO_MANY_RECEPTORS: 2003,
  INVALID_LINE: 2004,
  INVALID_API_KEY: 2005,
  IP_NOT_ALLOWED: 2006,
  DUPLICATE_LOCAL_ID: 2007,
  USER_INFORMATION_NOT_FOUND: 2008,
  EMPTY_RECEPTORS: 2009,
  INVALID_RECEPTORS: 2010,
  EMPTY_BODY: 2011,
  EMPTY_LINE: 2012,
  EMPTY_MESSAGE: 2013,
  INVALID_RECEPTOR: 2014,
  EMPTY_RECEPTOR: 2015,
  MESSAGE_TOO_LARGE: 2016,
  INVALID_LINE_SELECTOR: 2017,
  UNAUTHORIZED: 2018,
  INVALID_SEND_RANGE: 2019,
  ALL_RECEPTORS_BLACKLISTED: 2020,
  MESSAGE_CONTAINS_FORBIDDEN_WORDS: 2021,
  NOT_ENOUGH_CREDIT: 2022,
  DUPLICATE_TAG: 2023,
  INVALID_PARAMETER: 2024,
  RECEPTOR_BLACKLISTED: 2025,
  INVALID_LINK_IN_MESSAGE: 2026,
  TEMPLATE_NOT_APPROVED: 2027,
  INVALID_TEMPLATE_PARAMETER: 2028,
  INVALID_LOCAL_IDS: 2029,
  EMPTY_LOCAL_IDS: 2030,
  EMPTY_MESSAGE_IDS: 2031,
  INVALID_SMS_TYPE: 2032,
  LINE_NOT_ACTIVE: 2033,
  LINE_EXPIRED: 2034,
  MESSAGE_LIMIT_REACHED: 2035,
  REQUEST_LIMIT_REACHED: 2036,
  INVALID_SEND_TIME: 2037,
  INVALID_EXPIRY: 2038,
  INVALID_TEMPLATE_ID: 2039,
  PROFILE_NOT_FOUND: 2040,
  PROFILE_EXPIRED: 2041,
  FILE_NOT_FOUND: 2042,
  INVALID_FILE: 2043,
  ACCESS_DENIED: 2044,
  REJECTED: 2045,
} as const;

export type WebServiceResponseCode =
  (typeof WebServiceResponseCode)[keyof typeof WebServiceResponseCode];

/** HTTP status associated with each WebServiceResponseCode, per doc §3.4. */
export const WebServiceResponseCodeHttpStatus: Record<WebServiceResponseCode, number> = {
  [WebServiceResponseCode.INTERNAL_ERROR]: 500,
  [WebServiceResponseCode.INVALID_PLAN]: 400,
  [WebServiceResponseCode.LINE_NOT_FOUND]: 404,
  [WebServiceResponseCode.TOO_MANY_RECEPTORS]: 400,
  [WebServiceResponseCode.INVALID_LINE]: 400,
  [WebServiceResponseCode.INVALID_API_KEY]: 401,
  [WebServiceResponseCode.IP_NOT_ALLOWED]: 403,
  [WebServiceResponseCode.DUPLICATE_LOCAL_ID]: 409,
  [WebServiceResponseCode.USER_INFORMATION_NOT_FOUND]: 404,
  [WebServiceResponseCode.EMPTY_RECEPTORS]: 400,
  [WebServiceResponseCode.INVALID_RECEPTORS]: 400,
  [WebServiceResponseCode.EMPTY_BODY]: 400,
  [WebServiceResponseCode.EMPTY_LINE]: 400,
  [WebServiceResponseCode.EMPTY_MESSAGE]: 400,
  [WebServiceResponseCode.INVALID_RECEPTOR]: 400,
  [WebServiceResponseCode.EMPTY_RECEPTOR]: 400,
  [WebServiceResponseCode.MESSAGE_TOO_LARGE]: 413,
  [WebServiceResponseCode.INVALID_LINE_SELECTOR]: 400,
  [WebServiceResponseCode.UNAUTHORIZED]: 401,
  [WebServiceResponseCode.INVALID_SEND_RANGE]: 400,
  [WebServiceResponseCode.ALL_RECEPTORS_BLACKLISTED]: 403,
  [WebServiceResponseCode.MESSAGE_CONTAINS_FORBIDDEN_WORDS]: 400,
  [WebServiceResponseCode.NOT_ENOUGH_CREDIT]: 402,
  [WebServiceResponseCode.DUPLICATE_TAG]: 409,
  [WebServiceResponseCode.INVALID_PARAMETER]: 400,
  [WebServiceResponseCode.RECEPTOR_BLACKLISTED]: 403,
  [WebServiceResponseCode.INVALID_LINK_IN_MESSAGE]: 400,
  [WebServiceResponseCode.TEMPLATE_NOT_APPROVED]: 400,
  [WebServiceResponseCode.INVALID_TEMPLATE_PARAMETER]: 400,
  [WebServiceResponseCode.INVALID_LOCAL_IDS]: 400,
  [WebServiceResponseCode.EMPTY_LOCAL_IDS]: 400,
  [WebServiceResponseCode.EMPTY_MESSAGE_IDS]: 400,
  [WebServiceResponseCode.INVALID_SMS_TYPE]: 400,
  [WebServiceResponseCode.LINE_NOT_ACTIVE]: 400,
  [WebServiceResponseCode.LINE_EXPIRED]: 410,
  [WebServiceResponseCode.MESSAGE_LIMIT_REACHED]: 429,
  [WebServiceResponseCode.REQUEST_LIMIT_REACHED]: 429,
  [WebServiceResponseCode.INVALID_SEND_TIME]: 400,
  [WebServiceResponseCode.INVALID_EXPIRY]: 400,
  [WebServiceResponseCode.INVALID_TEMPLATE_ID]: 400,
  [WebServiceResponseCode.PROFILE_NOT_FOUND]: 400,
  [WebServiceResponseCode.PROFILE_EXPIRED]: 400,
  [WebServiceResponseCode.FILE_NOT_FOUND]: 400,
  [WebServiceResponseCode.INVALID_FILE]: 400,
  [WebServiceResponseCode.ACCESS_DENIED]: 403,
  [WebServiceResponseCode.REJECTED]: 400,
};

/**
 * Doc §3.5 — TemplateState (lowercase strings)
 */
export const TemplateState = {
  PendingApproval: "pendingapproval",
  Approved: "approved",
  Rejected: "rejected",
} as const;

export type TemplateState = (typeof TemplateState)[keyof typeof TemplateState];

/**
 * Doc §3.6 — TemplateParameterType (lowercase strings).
 * The documented complete public set is {string, number}. The live server has
 * been observed to also emit an undocumented "url" value — intentionally not
 * exposed here; revisit if the doc is updated to include it.
 */
export const TemplateParameterType = {
  String: "string",
  Number: "number",
} as const;

export type TemplateParameterType =
  (typeof TemplateParameterType)[keyof typeof TemplateParameterType];

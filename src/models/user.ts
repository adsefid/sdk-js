import type { LineSelector, TemplateParameterType, TemplateState } from "../enums.js";

// ---------------------------------------------------------------------------
// 6.1 GET /v1/user/info
// ---------------------------------------------------------------------------

export interface GetUserInfoResponse {
  name: string;
  company_name: string;
  credit_left: number;
  email: string;
  phone: string;
  /** Free-form account status, e.g. "active". No complete enum documented. */
  account_status: string;
}

// ---------------------------------------------------------------------------
// 6.2 GET /v1/user/lines
// ---------------------------------------------------------------------------

export interface UserLine {
  line_number: string;
  line_selector: LineSelector;
  line_name: string;
  enabled: boolean;
}

export type GetUserLinesResponse = UserLine[];

// ---------------------------------------------------------------------------
// 6.3 GET /v1/user/profiles
// ---------------------------------------------------------------------------

export interface UserMessengerProfile {
  id: string;
  name: string;
  /** Free-form provider name, e.g. "rubika", "bale". No complete enum documented. */
  messenger: string;
}

export type GetUserProfilesResponse = UserMessengerProfile[];

// ---------------------------------------------------------------------------
// 6.4 GET /v1/user/templates
// ---------------------------------------------------------------------------

/** Query params for `client.user.getTemplates` — `GET /v1/user/templates` (doc §6.4). */
export interface GetUserTemplatesQuery {
  state?: TemplateState;
  skip?: number;
  take?: number;
}

export interface UserTemplate {
  template_id: string;
  content: string;
  parameters: Record<string, TemplateParameterType>;
  state: TemplateState;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetUserTemplatesResponse {
  items: UserTemplate[];
  total: number;
}

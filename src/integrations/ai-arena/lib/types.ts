export type ArenaMode = "battle" | "side-by-side" | "direct";

export type LaneSlot = string;

export type VoteChoice = "left" | "right" | "tie" | "both_bad";

export interface ProviderInfo {
  id: string;
  label: string;
  envKey: string;
  available: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
  providerId: string;
  providerLabel: string;
  modelName: string;
  description: string;
  accent: string;
  tags: string[];
  available: boolean;
}

export interface CatalogResponse {
  providers: ProviderInfo[];
  models: ModelInfo[];
}

export interface UploadedAsset {
  id: string;
  fileName: string;
  contentType: string;
  publicUrl: string;
  kind: "image" | "file" | string;
  fileSize: number;
  createdAt: string;
}

export interface WebSource {
  title: string;
  url: string;
  snippet?: string | null;
  score?: number | null;
}

export interface TurnResult {
  slot: LaneSlot;
  modelId: string;
  displayLabel: string;
  realLabel: string;
  providerLabel: string;
  accent: string;
  content: string;
  responseMs: number;
  hidden: boolean;
  error?: string;
  finishReason?: "completed" | "stopped" | "error" | "streaming" | string;
  isStreaming?: boolean;
  statusText?: string | null;
  webSources?: WebSource[];
}

export interface VoteTally {
  left: number;
  right: number;
  tie: number;
  bothBad: number;
  total: number;
}

export interface SessionTurn {
  id: string;
  prompt: string;
  mode: ArenaMode;
  timestamp: string;
  results: TurnResult[];
  revealed: boolean;
  vote?: VoteChoice | null;
  tally?: VoteTally | null;
  isStreaming?: boolean;
  attachments: UploadedAsset[];
}

export interface ChatSession {
  id: string;
  title: string;
  mode: ArenaMode;
  createdAt: string;
  updatedAt: string;
  directModelId?: string | null;
  leftModelId?: string | null;
  rightModelId?: string | null;
  battlePoolIds: string[];
  turns: SessionTurn[];
  isPinned: boolean;
  folderName?: string | null;
  tags: string[];
  shareSlug?: string | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  username?: string | null;
  role?: string | null;
  balance?: number | null;
  currentPlanName?: string | null;
  currentPlanIsPaid?: boolean;
  currentLimits?: PricingLimits | null;
  avatarUrl?: string | null;
  usageSummary?: UsageSummary | null;
  createdAt: string;
}

export type UsagePeriod = "day" | "week" | "month";

export interface UsageMetric {
  key: string;
  label: string;
  enabled: boolean;
  used: number;
  limit?: number | null;
  remaining?: number | null;
  period: UsagePeriod;
  periodLabel: string;
  percentUsed: number;
}

export interface UsageSummary {
  planName?: string | null;
  isPaid: boolean;
  metrics: UsageMetric[];
}

export interface PricingToolQuota {
  enabled: boolean;
  limit?: number | null;
  period: UsagePeriod;
}

export interface PricingToolQuotas {
  chat: PricingToolQuota;
  upload: PricingToolQuota;
  imageGeneration: PricingToolQuota;
  translator: PricingToolQuota;
  webSearch: PricingToolQuota;
  webSummary: PricingToolQuota;
}

export interface PricingLimits {
  toolQuotas: PricingToolQuotas;
  maxUploadMb?: number | null;
  maxCompareModels?: number | null;
  allowedModelIds?: string[] | null;
}

export interface PricingPlan {
  id: number;
  audience: string;
  slug: string;
  name: string;
  summary: string;
  priceValue: number;
  priceCurrency: string;
  billingPeriod: string;
  priceNote?: string | null;
  ctaLabel: string;
  ctaUrl?: string | null;
  badgeText?: string | null;
  footerNote?: string | null;
  features: string[];
  limits: PricingLimits;
  isActive: boolean;
  isCurrentPlan: boolean;
  isHighlighted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingCatalog {
  audiences: string[];
  plans: PricingPlan[];
}

export interface PricingOrder {
  id: number;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  planId?: number | null;
  planName: string;
  planSlug: string;
  audience: string;
  priceValue: number;
  priceCurrency: string;
  billingPeriod: string;
  status: string;
  paymentUrl?: string | null;
  paymentRef?: string | null;
  adminNote?: string | null;
  source: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingPlanInput {
  audience: string;
  slug: string;
  name: string;
  summary: string;
  priceValue: number;
  priceCurrency: string;
  billingPeriod: string;
  priceNote?: string | null;
  ctaLabel: string;
  ctaUrl?: string | null;
  badgeText?: string | null;
  footerNote?: string | null;
  features: string[];
  limits: PricingLimits;
  isActive: boolean;
  isCurrentPlan: boolean;
  isHighlighted: boolean;
  sortOrder: number;
}

export interface PricingOrderCreatePayload {
  planId: number;
}

export interface PricingOrderAdminUpdatePayload {
  status: string;
  paymentRef?: string | null;
  adminNote?: string | null;
  expiresAt?: string | null;
}

export interface PricingUpdateWaitResponse {
  ok: boolean;
  changed: boolean;
  revision: number;
  updatedAt: number;
  reason: string;
}

export interface ArenaPreferences {
  mode: ArenaMode;
  directModelId: string;
  leftModelId: string;
  rightModelId: string;
  battlePoolIds: string[];
  battleModelCount: number;
}

export interface ConversationCreatePayload {
  mode: ArenaMode;
  directModelId?: string;
  leftModelId?: string;
  rightModelId?: string;
  battlePoolIds?: string[];
}

export interface ConversationUpdatePayload {
  title?: string;
  isPinned?: boolean;
  folderName?: string | null;
  tags?: string[];
}

export interface ChatTurnPayload {
  conversationId: string;
  prompt: string;
  attachmentIds?: string[];
  regeneratedFromTurnId?: string;
  useWebSearch?: boolean;
}

export interface RevealPayload {
  turnId: string;
}

export interface VoteResponse {
  ok: boolean;
  turn: SessionTurn;
  tally: VoteTally;
}

export interface DeleteConversationResponse {
  ok: boolean;
  conversationId: string;
}

export interface StopStreamPayload {
  turnId: string;
}

export interface StopStreamResponse {
  ok: boolean;
  turnId: string;
}

export interface BatchDeleteResponse {
  ok: boolean;
  deletedIds: string[];
}

export interface AuthPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ShareConversationResponse {
  ok: boolean;
  shareSlug: string;
  shareUrl: string;
}

export interface StreamEvent {
  type: "turn_init" | "slot_status" | "slot_chunk" | "slot_complete" | "complete" | "error";
  conversation?: ChatSession;
  turn?: SessionTurn;
  turnId?: string;
  slot?: LaneSlot;
  content?: string;
  responseMs?: number;
  finishReason?: string;
  statusText?: string;
  error?: string;
}

export interface WebSummaryPayload {
  url: string;
  mode: ArenaMode;
  directModelId?: string;
  leftModelId?: string;
  rightModelId?: string;
  battlePoolIds?: string[];
}

export interface WebSummaryResponse {
  sourceUrl: string;
  resolvedUrl: string;
  pageTitle: string;
  pageDescription?: string | null;
  excerpt: string;
  mode: ArenaMode;
  results: TurnResult[];
}

export type WorkspaceTool = "chat" | "web-summary" | "image-gen" | "translator";

export interface ToolTranslatePayload {
  text: string;
  targetLang: string;
  sourceLang?: string;
  modelId: string;
}

export interface ToolTranslateResponse {
  translatedText: string;
  modelId: string;
  modelLabel: string;
}

export interface ToolImageGeneratePayload {
  prompt: string;
  modelId?: string;
  imageSize?: string;
}

export interface ToolImageGenerateResponse {
  mimeType: string;
  imageBase64: string;
  caption?: string | null;
  modelLabel: string;
}

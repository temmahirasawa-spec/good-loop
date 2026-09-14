/**
 * クライアントからも参照する型だけを分離したファイル。
 * `draft-prompt.ts` は `server-only` を import しているため、
 * "use client" のコンポーネントから直接 import できない。
 */
export type FollowupReason = "vague-item" | "wait-detail" | "low-rating-unclear";

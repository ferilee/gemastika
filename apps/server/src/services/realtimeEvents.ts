export type RealtimeEvent = { kind: "member_approval" | "news_review" | "portfolio_review" | "learning_resource_review" | "learning_resource_report"; recipientKey?: string; reviewer?: boolean };

const listeners = new Set<(event: RealtimeEvent) => void>();

export function publishRealtimeEvent(event: RealtimeEvent) {
  for (const listener of listeners) listener(event);
}

export function subscribeRealtimeEvents(listener: (event: RealtimeEvent) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

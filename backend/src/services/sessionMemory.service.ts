export interface ChatTurnPart {
  role: "user" | "model";
  parts: any[];
}

interface SessionEntry {
  history: ChatTurnPart[];
  lastAccessedAt: number;
}

const MAX_TURNS_PER_SESSION = 16; // 8 user+model pairs
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const sessions = new Map<string, SessionEntry>();

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, entry] of sessions.entries()) {
    if (now - entry.lastAccessedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function getSessionHistory(sessionId: string): ChatTurnPart[] {
  cleanupExpiredSessions();
  const entry = sessions.get(sessionId);
  if (!entry) return [];
  entry.lastAccessedAt = Date.now();
  return [...entry.history];
}

export function appendSessionTurn(
  sessionId: string,
  userText: string,
  modelText: string
): void {
  cleanupExpiredSessions();
  const entry = sessions.get(sessionId) ?? {
    history: [],
    lastAccessedAt: Date.now(),
  };

  entry.history.push(
    { role: "user", parts: [{ text: userText }] },
    { role: "model", parts: [{ text: modelText }] }
  );

  if (entry.history.length > MAX_TURNS_PER_SESSION) {
    entry.history = entry.history.slice(-MAX_TURNS_PER_SESSION);
  }
  entry.lastAccessedAt = Date.now();
  sessions.set(sessionId, entry);
}

export function clearSessionHistory(sessionId: string): void {
  sessions.delete(sessionId);
}

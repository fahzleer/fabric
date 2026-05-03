import Dexie, { type Table } from "dexie";

export interface SsePosition {
  channel: string;
  lastEventId: string;
  updatedAt: number;
}

class SsePositionDatabase extends Dexie {
  positions!: Table<SsePosition, string>;

  constructor() {
    super("fabric-sse-position");
    this.version(1).stores({
      positions: "channel",
    });
  }
}

const db = new SsePositionDatabase();

export async function getSseLastEventId(channel: string): Promise<string | undefined> {
  const row = await db.positions.get(channel);
  return row?.lastEventId;
}

export async function saveSseLastEventId(channel: string, lastEventId: string): Promise<void> {
  await db.positions.put({ channel, lastEventId, updatedAt: Date.now() });
}

export async function clearSsePosition(channel: string): Promise<void> {
  await db.positions.delete(channel);
}

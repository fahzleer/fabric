import type { FirebaseActivityLogRecord } from "@fabric/firebase";
import type { RepositoryError } from "@fabric/types";
import type { Result } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import type {
  ActivityEvent,
  ActivityRepositoryPort,
} from "../../application/ports/activity.repository.port";
import { makeRepositoryError } from "../../application/ports/product.repository.port";

export class FirebaseActivityRepository implements ActivityRepositoryPort {
  constructor(private readonly db: Database) {}

  async track(event: ActivityEvent): Promise<Result<void, RepositoryError>> {
    try {
      const record: FirebaseActivityLogRecord = {
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        eventType: event.eventType,
        eventData: event.eventData ?? null,
        ipAddress: event.ipAddress ?? "",
        userAgent: event.userAgent ?? "",
        occurredAt: Temporal.Now.instant().toString(),
      };
      await this.db.ref("activity_log").push(record);
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to track activity event", cause) };
    }
  }
}

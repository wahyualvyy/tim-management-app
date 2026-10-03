import "server-only";
import { Redis } from "@upstash/redis";
import { StorageUnavailableError } from "@/lib/errors";

let client: Redis | null = null;

/**
 * Lazily created Upstash client. Values come back as raw strings
 * (automatic JSON deserialization is off) so repositories control parsing.
 */
export function redis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new StorageUnavailableError(
      "The data store is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  client = new Redis({ url, token, automaticDeserialization: false });
  return client;
}

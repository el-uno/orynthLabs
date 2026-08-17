import IORedis from "ioredis";
import { runtimeEnv } from "@/lib/env";

export const redisConnection = runtimeEnv.redisUrl
  ? new IORedis(runtimeEnv.redisUrl, {
      maxRetriesPerRequest: null
    })
  : null;

import { createClient } from "redis";
import { config } from "../config/index.js";
const redisClient = createClient({
  password: config.redis.passowrd,
  socket: {
    host: config.redis.host,
    port: 19979,
  },
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));
export { redisClient };

import { createClient } from "redis";
const redisClient = createClient({
  password: "8NE5bsU2SbvDWwnCZQqa9j5sD9m0Kurm",
  socket: {
    host: "redis-19979.c57.us-east-1-4.ec2.redns.redis-cloud.com",
    port: 19979,
  },
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));
export { redisClient };

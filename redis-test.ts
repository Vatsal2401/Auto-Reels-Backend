import Redis from "ioredis";

// Testing with direct URL (encoded password)
const redis = new Redis("redis://:Vatsal%402401@35.192.113.254:6379");

redis.on("error", (err) => {
  console.error("Redis error event:", err.message);
});

redis.ping()
  .then(res => {
    console.log("Redis connected via URL:", res);
    process.exit(0);
  })
  .catch(err => {
    console.error("Redis ping failed via URL:", err.message);
    process.exit(1);
  });

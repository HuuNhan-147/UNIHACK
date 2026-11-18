
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRouter } from "./routes/api.route";

const app = express();

const allowedOrigins = env.FRONTEND_URL.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
  })
);
app.use(express.json());

app.use("/api", apiRouter);

app.listen(env.PORT, () => {
  console.log(`AgentVault Backend listening on http://localhost:${env.PORT}`);
});

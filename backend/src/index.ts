
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRouter } from "./routes/api.route";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
  })
);
app.use(express.json());

app.use("/api", apiRouter);

app.listen(env.PORT, () => {
  console.log(`AgentVault Backend listening on http://localhost:${env.PORT}`);
});

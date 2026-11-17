# AgentVault Topic 13 Evaluation Suite

Bộ đánh giá gồm **30 test cases song ngữ (Tiếng Việt & Tiếng Anh)** tại `backend/eval/cases.json` chia thành 4 nhóm:

1. **Read & Analysis (10 cases):** Kiểm tra số dư, phân bổ danh mục, lịch sử giao dịch, policy rules, báo giá swap, yields Avalanche, mô phỏng swap giả định, tính toán rủi ro/Health Factor.
2. **Valid Write Actions (8 cases):** Lập kế hoạch swap hợp lệ, tiệm cận trần (`ESCALATE`), đặt/thu hồi allowance, thiếu tham số, token không hỗ trợ.
3. **Guardrails & Security (7 cases):** Vượt `maxAmountPerTx` (`500 > 300 mUSDC`), vượt `maxSlippageBps` (`500 > 200 bps`), Prompt Injection, Unlimited Approval, số âm.
4. **No-Hallucination & Forecast Refusal (5 cases):** Từ chối dự đoán giá tương lai, từ chối cam kết APY, báo cáo trung thực khi thiếu vị thế lending trên Fuji.

## Cách chạy

- **Chế độ Deterministic (không cần gọi LLM, tái lập 100%):**
  ```bash
  pnpm --filter backend eval
  ```

- **Chế độ Live End-to-End (gọi Gemini Function Calling + Fuji RPC):**
  ```bash
  pnpm --filter backend eval -- --live
  ```

# AgentVault Topic 13 Evaluation Suite

Bộ đánh giá gồm **40 test cases song ngữ (Tiếng Việt & Tiếng Anh)** tại `backend/eval/cases.json` (`30` baseline cases + `10` Phase-2 Risk & Guardian cases), chia thành 4 nhóm:

1. **Read & Risk Intelligence (`15` cases — `R01`–`R10`, `C31`–`C35`):** Kiểm tra số dư ví, token balance đơn lẻ, phân bổ danh mục, lịch sử giao dịch Glacier, policy rules, báo giá swap chỉ đọc (`isExecuted=false`), phơi nhiễm allowance, thanh khoản Router, vị thế Aave V3 Fuji đã xác minh (`0xccEa5C...`), và snapshot APY trên DeFiLlama.
2. **Valid Write Actions (`8` cases — `W01`–`W08`):** Lập kế hoạch swap hợp lệ, cảnh báo tiệm cận trần (`ESCALATE`), đặt/thu hồi allowance chính xác, chặn khi thiếu tham số số lượng, và từ chối cặp token ngoài whitelist (`mUSDC->BTC.b`).
3. **Guardrails & Security (`10` cases — `G01`–`G07`, `C36`, `C37`, `C40`):** Chặn vượt `maxAmountPerTx` (`500 > 300 mUSDC`), vượt `maxSlippageBps` (`500 > 200 bps`), Prompt Injection, Unlimited Approval, rò rỉ khóa / tự động ký (`SECRET_OR_CUSTODY_VIOLATION`), số lượng âm, và từ chối giao thức/chain ngoài phạm vi (`Solana Raydium`, `GMX`).
4. **No-Hallucination & Forecast Refusal (`7` cases — `F01`–`F05`, `C38`, `C39`):** Từ chối dự đoán giá tương lai / cam kết lợi nhuận, trả `INSUFFICIENT_DATA` khi giao thức không tồn tại trên DeFiLlama hoặc khi ví không có khoản vay trên Fuji (không tự bịa APY hay giá thanh lý).

Ngoài ra `runner.ts` còn tích hợp bộ **4 bài kiểm thử Security Regression**:
- Session Memory Isolation
- Multi-Wallet Profile Isolation
- EIP-191 Signature Verification & Cross-Wallet Spoof Rejection
- Calldata Integrity Hash (`keccak256`) Tamper Guard

## Cách chạy

- **Chế độ Deterministic (không cần gọi LLM, tái lập 100%):**
  ```bash
  pnpm --filter backend eval
  ```

- **Chế độ Live End-to-End (gọi Gemini Function Calling + Fuji RPC + DeFiLlama):**
  ```bash
  pnpm --filter backend eval -- --live
  ```

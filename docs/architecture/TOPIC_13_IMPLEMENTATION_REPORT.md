# TOPIC 13 IMPLEMENTATION & EVALUATION REPORT

## 1. Các thay đổi đã thực hiện
- **Backend Services mới:**
  - `backend/src/services/copilotAnalysis.service.ts`: `getSwapQuoteDeterministic`, `analyzePortfolioAllocation`, `calculatePositionRisk`, `getAvalancheProtocolYields` (DeFiLlama Avalanche Mainnet, có disclaimer).
  - `backend/src/services/allowancePlanner.service.ts`: `buildAllowancePlan` cho `plan_set_allowance` và `plan_revoke_allowance`.
  - `backend/src/services/sessionMemory.service.ts`: Quản lý hội thoại cách ly theo `sessionId` (TTL 2h, max 16 turns).
  - `backend/src/services/history.service.ts`: Bổ sung `getAvalancheTxHistory()` kết hợp **Avalanche Glacier API** (Fuji 43113) và `SwapExecuted` RPC logs.
- **Agent Harness (`orchestrator.ts` & `toolRegistry.ts`):**
  - Cập nhật `SYSTEM_INSTRUCTION` cấm dự đoán giá, cấm bịa số liệu, phân biệt rõ testnet vs mainnet reference.
  - Bổ sung `detectForecastRequest()` chặn từ chối các câu hỏi dự đoán giá/cam kết lãi.
  - Hoàn thiện **7 Read Tools** và **3 Write Tools** (chống tạo trùng 2 write plan trong 1 lượt).
- **Loại bỏ / Cô lập Out-of-Scope:**
  - Gỡ các route `/vault/*`, `/x402/*` khỏi `api.route.ts`, gỡ `SpendGuardPanel` khỏi `App.tsx`, gỡ `x402` UI khỏi `ChatPanel.tsx` và `frontend/src/services/api.ts`.
- **Frontend Alignment:**
  - Cập nhật `App.tsx`, `ChatPanel.tsx` (hỗ trợ `sessionId`, nút `New Session`, 5 nút demo Topic 13), `TxPreviewModal.tsx` (hỗ trợ ký Allowance-only plans).

## 2. Kết quả kiểm thử thực tế
- **Smart Contracts (`pnpm --filter contracts test`):** 21/21 passing (15 `AgentVault*`, 6 `SpendGuardVault`).
- **Evaluation Suite (`pnpm --filter backend eval` — Deterministic Suite):**
  - Total Cases: **30** (10 Read/Analysis, 8 Valid Write, 7 Guardrail/Security, 5 No-Forecast/No-Hallucination)
  - Passed: **30 / 30 (100.0%)**
  - Guardrail Block Rate: **100.0% (7/7)**
  - Forecast Refusal Rate: **100.0% (4/4)**
  - Session Isolation Check: **PASS**
  - *Lưu ý:* Chế độ `--live` (gọi trực tiếp Gemini API & Fuji RPC) chưa chạy trong sandbox offline; cần chạy ngoài môi trường có mạng để đo Live LLM Tool Selection Accuracy.

## 3. Hạn chế đã biết
- `MockERC20` và `MockDEXRouter` sử dụng tỷ giá mô phỏng trên Fuji; chưa tích hợp router thanh khoản thật trên Avalanche Mainnet.
- Chưa có vị thế lending thật (Aave/Benqi) trên Fuji nên `calculate_position_risk` chỉ tính Health Factor / Liquidation Price khi user cung cấp tham số hoặc báo cáo minh bạch giới hạn này.

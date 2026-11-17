# AgentVault — AI DeFi Copilot on Avalanche

**Topic #13 (UniHack): A chatbot harness that operates DeFi on Avalanche Fuji Testnet in natural language — 7 deterministic read tools, 3 user-signed write tools governed by on-chain allowance, analysis without price forecasting, and a 30-case bilingual evaluation suite.**

## Kiến trúc tổng quan

```
User (MetaMask / Core Wallet)
  → React Chat & Tx Guardian UI (frontend/)
  → Agent Orchestrator + Per-Session Memory (backend/src/agent/orchestrator.ts)
  → Gemini Function Calling + Tool Registry (7 Read Tools, 3 Write Tools)
  → Deterministic Policy Engine & Analysis (copilotAnalysis.service.ts, deterministicPolicy.service.ts)
  → Tx Guardian Preview → User Wallet Signature
  → Avalanche Fuji Smart Contracts (AgentVaultPolicy, AgentVaultExecutor, MockDEXRouter, MockERC20)
  → Post-Tx Verification & Audit Log
```

## Cấu trúc dự án

- `contracts/` — Hardhat + Solidity (`MockERC20`, `AgentVaultPolicy`, `MockDEXRouter`, `AgentVaultExecutor`; giữ nguyên `SpendGuardVault` làm legacy reference, không dùng trong luồng Copilot).
- `backend/` — Node.js + TypeScript + Express + Gemini Function Calling + Per-session Memory + `eval/` (30 bilingual cases).
- `frontend/` — React + Vite + TypeScript + TailwindCSS + ethers v6 (WalletConnect, Portfolio, DeFi Copilot Chat, Plan Card, Tx Guardian Inspector, Audit Log).

## Kiểm thử & Đánh giá

```bash
# Smart Contract Tests (21/21 passing)
pnpm --filter contracts test

# Topic 13 Bilingual Evaluation Suite (30 cases: Deterministic / Live LLM)
pnpm --filter backend eval
pnpm --filter backend eval -- --live

# Type-check & Build
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm --filter frontend build
```

## Lưu ý Testnet & Giới hạn

- `MockERC20` (`mUSDC`) và `MockDEXRouter` trên Avalanche Fuji (`43113`) là hợp đồng mô phỏng cho môi trường testnet.
- Dữ liệu TVL/APY từ DeFiLlama phản ánh **Avalanche Mainnet** (chỉ dùng tham khảo, không cam kết lợi nhuận).
- Copilot từ chối mọi yêu cầu dự đoán giá tương lai và chỉ tạo transaction plan để **User tự kiểm tra và ký bằng ví**.

# TOPIC 13 ALIGNMENT AUDIT — AGENTVAULT

## 1. Trạng thái trước khi căn chỉnh
- Dự án ban đầu là DeFi Swap Assistant (`AgentVaultPolicy`, `AgentVaultExecutor`, `MockDEXRouter`), sau đó được thêm nhánh `x402` (`SpendGuardVault.sol`, `x402.service.ts`, `agentSigner.service.ts`, `SpendGuardPanel.tsx`), tạo ra sự chồng chéo hai sản phẩm trên cùng UI.
- AI Orchestrator thiếu `sessionId` memory, thiếu rule cấm dự đoán giá tường minh, mới có 3 tools DeFi và chưa có bộ eval 30 cases.

## 2. Phân loại hiện trạng sau Audit
| Thành phần | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| `AgentVaultPolicy.sol`, `AgentVaultExecutor.sol` | `IMPLEMENTED_AND_VERIFIED` | Deployed Fuji (`43113`), 15/15 Hardhat tests pass. |
| `MockERC20.sol`, `MockDEXRouter.sol` | `MOCKED` (Testnet) | Đã ghi nhãn rõ ràng trên hệ thống & tài liệu. |
| `SpendGuardVault.sol` | `IMPLEMENTED_AND_VERIFIED` | 6/6 tests pass; giữ trong `contracts/` (legacy/out-of-scope), không dùng cho luồng user Copilot vì `deposit/withdraw` là `onlyOwner`. |
| `x402.service.ts`, `agentSigner.service.ts`, `SpendGuardPanel.tsx` | `OBSOLETE_OR_OUT_OF_SCOPE` | Đã gỡ khỏi `api.route.ts`, `toolRegistry.ts`, `App.tsx`, `ChatPanel.tsx`. |
| `orchestrator.ts`, `toolRegistry.ts`, `copilotAnalysis.service.ts`, `allowancePlanner.service.ts`, `sessionMemory.service.ts` | `IMPLEMENTED_AND_VERIFIED` (Typecheck + Deterministic Eval) | Đáp ứng đủ 7 Read Tools, 3 Write Tools, Session Memory, No-Forecasting Guard. |
| `backend/eval/` (30 bilingual cases) | `IMPLEMENTED_AND_VERIFIED` | `pnpm --filter backend eval` đạt 30/30 pass. |

## 3. Topic 13 Compliance Checklist
- [x] Sản phẩm vận hành thống nhất như AI DeFi Copilot.
- [x] Giao tiếp ngôn ngữ tự nhiên (Tiếng Việt & Tiếng Anh).
- [x] Structured Tool Registry (7 Read Tools + 3 Write Tools).
- [x] Per-session memory cách ly theo `sessionId`.
- [x] Read Tools trả về dữ liệu Avalanche xác thực (Fuji RPC, Glacier API, DeFiLlama Mainnet reference).
- [x] Write Tools chỉ tạo Pending Plan; User bắt buộc xác nhận và tự ký qua MetaMask/Core Wallet.
- [x] Allowance / Cap on-chain (`AgentVaultPolicy.sol`) + ERC-20 `set/revoke` allowance.
- [x] Tính toán tài chính deterministic (không để LLM tự nhẩm).
- [x] Từ chối dự đoán giá tương lai & không bịa vị thế lending.
- [x] Bộ Eval 30 cases song ngữ + Eval Runner tái lập được.

# TECHNICAL DESIGN — AGENTVAULT (AVALANCHE DEFI COPILOT)

**Phiên bản:** Topic #13 (UniHack Build on Avalanche)  
**Mạng triển khai:** Avalanche Fuji Testnet (`Chain ID: 43113`)  
**Nguyên tắc thiết kế:** *AI đề xuất, Smart Contract kiểm soát, Người dùng giữ chìa khóa (Non-custodial).*

---

## 1. Kiến trúc 3 tầng (System Architecture)

```text
+-------------------------------------------------------------------+
| 1. FRONTEND (React + Vite + TailwindCSS + Ethers v6)              |
|    - WalletContext: Kết nối MetaMask / Core Wallet (Fuji 43113)   |
|    - HoldingsTable: Hiển thị số dư & badge Chainlink Fuji Feed    |
|    - ChatPanel: Giao diện DeFi Copilot + Session Isolation        |
|    - TxPreviewModal (Tx Guardian): Giải trình & ký giao dịch      |
+---------------------------------+---------------------------------+
                                  | HTTP REST (/api/*)
+---------------------------------v---------------------------------+
| 2. BACKEND AI HARNESS (Node.js + Express + TypeScript + Gemini)   |
|    - Agent Orchestrator & Per-Session Memory (orchestrator.ts)    |
|    - Tool Registry: 7 Read Tools + 3 Write Tools (zod schemas)    |
|    - Deterministic Policy Engine & Forecast Guardrail             |
|    - Services: portfolio (Chainlink/DeFiLlama), aave, history     |
|      (Avalanche Glacier API), swapPlanner, allowancePlanner      |
+---------------------------------+---------------------------------+
                                  | Ethers v6 JSON-RPC
+---------------------------------v---------------------------------+
| 3. SMART CONTRACTS (Solidity 0.8.20 + OpenZeppelin + Chainlink)   |
|    - AgentVaultPolicy.sol: Limit/Tx, Slippage, Whitelists, Pause  |
|    - AgentVaultExecutor.sol: Entrypoint qua ISwapRouter           |
|    - MockDEXRouter.sol: Implement ISwapRouter + Chainlink Feed    |
|    - MockERC20.sol (mUSDC): 6 decimals + Faucet                   |
+-------------------------------------------------------------------+
```

---

## 2. Thiết kế Smart Contracts (`contracts/`)

1. **`AgentVaultPolicy.sol` (`Ownable`, `Pausable`):**
   - Lưu và kiểm soát on-chain: `maxAmountPerTx` (`300 mUSDC`), `maxSlippageBps` (`200 bps = 2%`), `allowedTokens`, `allowedRouters`, `paused()`.
   - Hàm `validateSwap(...)` revert ngay với custom errors (`ExceedsMaxTxAmount`, `SlippageTooHigh`, `TokenNotAllowed`, `RouterNotAllowed`, `EnforcedPause`) nếu vi phạm.
2. **`ISwapRouter.sol` & `MockDEXRouter.sol` (`ISwapRouter`, `Ownable`, `ReentrancyGuard`):**
   - Chuẩn hóa interface `ISwapRouter` để tách biệt logic thực thi khỏi router cụ thể (sẵn sàng cắm DEX thật như Trader Joe/LFJ hoặc Pangolin khi lên Mainnet).
   - `MockDEXRouter` hỗ trợ đọc giá `AVAX/USD` trực tiếp từ **Chainlink `IAggregatorV3`** (`0x5498BB86BC934c8D34FDA08E81D444153d0D06aD` trên Fuji), kiểm tra `answer > 0` và `maxOracleAge`, tự động quy đổi decimals (8 $\rightarrow$ 6) cho `rateMusdcPerAvax()` và `getAmountOut()`.
   - Khóa `msg.sender == executor` để ngăn gọi trực tiếp router bỏ qua `AgentVaultPolicy`.
3. **`AgentVaultExecutor.sol` (`Ownable`, `Pausable`, `ReentrancyGuard`):**
   - Giao tiếp qua `ISwapRouter public immutable router`.
   - Kiểm tra `policy.validateSwap(...)`, kiểm tra `minAmountOut >= minAllowedOut` on-chain, thực thi swap và phát event `SwapExecuted`.

---

## 3. Thiết kế Backend & AI Copilot Harness (`backend/`)

1. **Agent Orchestrator (`agent/orchestrator.ts`) & Tool Registry (`agent/toolRegistry.ts`):**
   - Tách biệt **7 Read Tools** (chỉ đọc & phân tích định lượng) và **3 Write Tools** (chỉ tạo unsigned tx plan).
   - Cô lập hội thoại theo `sessionId` (`sessionMemory.service.ts`, TTL 2h, tối đa 16 turns).
   - **Forecast Refusal:** `detectForecastRequest()` chặn các câu hỏi dự đoán giá tương lai hoặc cam kết lợi nhuận trước khi gọi model.
2. **Market & Protocol Services:**
   - `portfolio.service.ts`: Đọc số dư AVAX/mUSDC on-chain và ưu tiên giá `AVAX/USD` từ **Chainlink Fuji Feed** (`priceSource: "CHAINLINK_FUJI"`), fallback sang DeFiLlama API (`"LIVE_API"`).
   - `aave.service.ts`: Đọc dữ liệu vị thế thực tế từ Aave V3 (`getUserAccountData`) khi cấu hình `AAVE_V3_POOL_ADDRESS`.
   - `history.service.ts`: Tổng hợp lịch sử giao dịch thật qua **Avalanche Glacier API** (Chain ID `43113`) và logs `SwapExecuted`.
   - `copilotAnalysis.service.ts`: Tính quote swap, phân tích tỷ trọng danh mục, tính Health Factor / Liquidation Price xác định, và lấy dữ liệu APY/TVL Avalanche Mainnet từ DeFiLlama (kèm disclaimer).
3. **Tx Planners (`swapPlanner.service.ts`, `allowancePlanner.service.ts`):**
   - Không lưu private key người dùng. Trả về `UnsignedTx` kèm bản kiểm tra **Tx Guardian** (Exact Approval, Whitelisted Target, On-chain Slippage Guard).

---

## 4. Thiết kế Frontend (`frontend/`)

- **Wallet & Network:** `WalletContext.tsx` kết nối MetaMask / Core Wallet, tự động yêu cầu chuyển sang Avalanche Fuji (`43113`).
- **Dashboard:** Hiển thị số dư, nguồn giá `Chainlink Fuji Feed`, hạn mức `AgentVaultPolicy`, và lịch sử giao dịch từ Glacier API.
- **Copilot & Tx Guardian:** `ChatPanel.tsx` quản lý `sessionId` và 5 prompt mẫu; `TxPreviewModal.tsx` hiển thị tóm tắt dễ hiểu để người dùng tự ký từng bước (Approve exact amount $\rightarrow$ Execute Swap hoặc Revoke Allowance).

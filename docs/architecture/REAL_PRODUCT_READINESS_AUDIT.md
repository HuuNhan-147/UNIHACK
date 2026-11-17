# AGENTVAULT – REAL PRODUCT READINESS AUDIT

> **Ngày đánh giá:** 2026-11-16  
> **Mạng triển khai:** Avalanche Fuji Testnet (Chain ID `43113`)  
> **Trạng thái:** Audit toàn diện dựa trên source code thực tế, `deployments/fuji.json` và kết quả probe API. **Không sửa code, không thay đổi Smart Contracts.**

---

## 1. Executive Summary

AgentVault đã hoàn thiện luồng kết nối từ **Frontend (React/Vite) → Backend (Express/TS + Gemini Function Calling) → 4 Smart Contracts đã harden trên Avalanche Fuji Testnet**. Tuy nhiên, khi bóc tách từng lớp dữ liệu và tích hợp DeFi, hệ thống vẫn đang kết hợp giữa **hạ tầng On-chain thật** (số dư, allowance, policy enforcement, chữ ký ví) với **dữ liệu giá & thanh khoản mô phỏng** (giá USD hardcode, Mock DEX tỷ giá cố định, lịch sử giao dịch lưu tạm trên RAM trình duyệt).

**Kết luận ngắn gọn:** AgentVault hiện tại là một **Functional Prototype** chạy được end-to-end trên Testnet, nhưng chưa phải là một **DeFi AI Agent MVP** sẵn sàng cho thị trường thực nếu chưa thay thế giá hardcode bằng Oracle/Market API và chưa đọc lịch sử giao dịch từ on-chain logs.

---

## 2. System Architecture hiện tại

```text
[Frontend: React + Vite + ethers v6 (MetaMask/Core)]
   ├── WalletContext.tsx ──(User Sign Tx)──▶ AgentVaultExecutor (Fuji 43113)
   ├── TxHistoryTable.tsx (React useState - Session RAM)
   └── services/api.ts ──(HTTP)──▶ [Backend: Express + TS]
                                      ├── portfolio.service.ts ──(RPC + Hardcoded USD Price)
                                      ├── policy.service.ts ──(RPC Read + validateSwap)
                                      ├── swapPlanner.service.ts ──(RPC Quote + Calldata)
                                      └── agent/orchestrator.ts ──(Gemini Tool Calling)
```

---

## 3. Bảng phân loại DATA INTEGRITY (REAL / MOCK / HARDCODED / NOT IMPLEMENTED)

| Chức năng | Phân loại | Nguồn dữ liệu thực tế | Bằng chứng (File / Function / Contract) |
| :--- | :--- | :--- | :--- |
| **AVAX Native Balance** | **REAL ON-CHAIN** | Fuji RPC `eth_getBalance` | `backend/src/services/portfolio.service.ts` → `getPortfolio()` gọi `provider.getBalance(address)` |
| **mUSDC Token Balance** | **REAL ON-CHAIN** | ERC-20 `balanceOf()` trên Fuji | `portfolio.service.ts` → `musdc.balanceOf(address)` tại `0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1` |
| **mUSDC Faucet (1000 mUSDC)** | **REAL ON-CHAIN** *(Test Token)* | Mint token ERC-20 thật trên Fuji | `frontend/src/context/WalletContext.tsx` → `callFaucet()` gọi `MockERC20.faucet()` |
| **Policy Rules & Enforcement** | **REAL ON-CHAIN** | State & `validateSwap()` trên Fuji | `AgentVaultPolicy` (`0x940d6C627C55F002A42eAc257d7A36dbDe4157e7`) & `policy.service.ts` |
| **Wallet Signature & Swap Execution** | **REAL ON-CHAIN** *(Testnet)* | Ví MetaMask/Core ký & gửi Tx | `WalletContext.tsx` → `sendTx()`, `AgentVaultExecutor` (`0x80893169CD4677b40c0Eb88425A98FE80B688E36`) |
| **Token Price (AVAX/mUSDC USD)** | **HARDCODED** | Hằng số cố định trong code | `portfolio.service.ts` dòng 19–20: `AVAX_REF_PRICE_USD = 25`, `MUSDC_REF_PRICE_USD = 1` |
| **Portfolio USD Valuation** | **HARDCODED** *(tính từ giá cứng)* | `balance * hardcodedPrice` | `portfolio.service.ts` → `avaxValueUsd`, `musdcValueUsd` |
| **DEX Router & Swap Quote** | **MOCK** *(chạy on-chain)* | Tỷ giá cố định `2000 mUSDC = 1 AVAX` | `MockDEXRouter` (`0x6543093442989Ee42f440b5d1B15ae178d1b807D`), thanh khoản seed `0.2 AVAX` |
| **Transaction History** | **MOCK / SESSION-ONLY** | React `useState` ở trình duyệt | `frontend/src/App.tsx` (`history` state) — mất khi F5, chưa đọc `SwapExecuted` logs từ Fuji |
| **Market Data (Volume, 24h, TVL)** | **NOT IMPLEMENTED** | Không có | Chưa tích hợp CoinGecko, DefiLlama, Chainlink hay DexScreener |
| **Post-Tx AI Verification** | **NOT IMPLEMENTED** | Chỉ UI tự refresh balance | `TxPreviewModal.tsx` gọi `loadOnChainData()`, AI Agent chưa tự kiểm tra receipt |

---

## 4. Bằng chứng cụ thể (Contracts, Endpoints & Probe Results)

### 4.1. Smart Contracts đã deploy (`contracts/deployments/fuji.json`)
- **Deployer:** `0x305533Ab075f168ea052559b91453ca2522a0a33` (Chain ID `43113`, `deployedAt: 2026-11-16T10:42:05.264Z`)
- **`MockERC20 (mUSDC)`:** `0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1` (ERC-20 chuẩn OpenZeppelin, 6 decimals, có thể check balance và transfer thật trên Fuji).
- **`AgentVaultPolicy`:** `0x940d6C627C55F002A42eAc257d7A36dbDe4157e7` (Enforce `maxAmountPerTx = 300 mUSDC`, `maxSlippageBps = 200`, whitelist token/router, `Pausable`).
- **`MockDEXRouter`:** `0x6543093442989Ee42f440b5d1B15ae178d1b807D` (Đã khóa `executor`, nạp `0.2 AVAX` thanh khoản thật trên Fuji).
- **`AgentVaultExecutor`:** `0x80893169CD4677b40c0Eb88425A98FE80B688E36` (Enforce `minAmountOut` on-chain, `nonReentrant`, `whenNotPaused`).

### 4.2. Backend Endpoints đã kiểm tra thực tế (`http://127.0.0.1:4000`)
- `GET /api/health` → `{"status":"ok","chainId":43113,"contractsConfigured":true}`
- `GET /api/policy` → `{"maxAmountPerTxMusdc":"300.0","maxSlippageBps":200,"paused":false,"musdcAllowed":true,"nativeAvaxAllowed":true,"routerAllowed":true}`
- `GET /api/portfolio/0x305533Ab075f168ea052559b91453ca2522a0a33` → `AVAX: 0.3000 ($7.50)`, `mUSDC: 0.00 ($0.00)`
- `POST /api/agent/chat` → Đã biên dịch sạch (`tsc`), nhưng **chưa chạy smoke test gọi Gemini API trực tiếp** trong phiên audit này.

---

## 5. Đánh giá AI Agent, DeFi Integration & Governance

### 5.1. AI Agent Intelligence (`backend/src/agent/`)
- **Thực sự làm được:** Dùng **Gemini Function Calling** (`@google/generative-ai`) với 3 tools có schema `zod` (`get_portfolio`, `get_policy_rules`, `plan_swap`). AI đọc số dư thật, đọc policy thật, lập unsigned transaction plan và buộc phải qua **Human-in-the-loop** (`TxPreviewModal.tsx`) để người dùng tự ký.
- **Hạn chế:** AI chưa có dữ liệu thị trường thực tế (giá biến động, thanh khoản pool) nên chỉ thực hiện lệnh swap theo yêu cầu định lượng của user chứ chưa tự phân tích rủi ro thị trường hay gợi ý tái cân bằng danh mục dựa trên giá live.

### 5.2. Security & Governance
- **Private Key Management:** Backend không giữ private key của user (`backend/.env` chỉ có `GEMINI_API_KEY`).
- **Policy Enforcement:** Ngay cả khi Backend/AI bị lỗi hoặc user bấm *"Force Test On-chain"* với `500 mUSDC`, `AgentVaultPolicy` vẫn revert giao dịch on-chain (`ExceedsMaxTxAmount`).
- **Chưa kiểm chứng E2E trên trình duyệt:** Chưa có Transaction Hash thực tế từ thao tác bấm UI (Faucet + Scenario A + Scenario B) trên Snowtrace.

### 5.3. Market Data & DeFi Integration
- Hệ thống **chưa kết nối DEX thực tế trên Fuji** (như TraderJoe / Pangolin) và dùng `MockDEXRouter` tỷ giá cứng `2000 mUSDC = 1 AVAX` (trong khi `portfolio.service.ts` lại định giá hiển thị `1 AVAX = $25` → **mâu thuẫn nội tại giữa giá hiển thị `$25` và tỷ giá swap `2000 mUSDC/AVAX`**!).
- **Đề xuất nguồn dữ liệu phù hợp với Avalanche:**
  - Giá token real-time: **Chainlink Price Feeds** (`AVAX/USD` trên Fuji) hoặc **CoinGecko / DefiLlama Price API** (miễn phí, không cần key cho endpoint cơ bản).
  - DEX thực tế: **LFJ (Trader Joe) / Pangolin Router** trên Fuji (nếu có pool thanh khoản) hoặc giữ `MockDEXRouter` nhưng đồng bộ tỷ giá với giá thật để tránh lệch số liệu.

---

## 6. Đánh giá Product Readiness

| Tiêu chí | Mức độ sẵn sàng | Ghi chú |
| :--- | :--- | :--- |
| Connect Wallet & Xem số dư thật | **85%** | Số dư token thật, nhưng quy đổi USD đang hardcode `$25/AVAX`. |
| AI Phân tích & Đề xuất giao dịch | **70%** | Tool calling chuẩn, nhưng thiếu Market Data & chưa smoke-test Gemini runtime. |
| Phê duyệt & Ký giao dịch thật | **90%** | Đã harden Smart Contracts & UI Modal, chờ chạy test thực tế trên trình duyệt. |
| Theo dõi Transaction History | **40%** | Mới lưu tạm trong React state, F5 là mất. |
| Minh bạch dữ liệu Thật vs Test | **60%** | UI có ghi `(Testnet)` và `Mock USD Coin`, nhưng chưa gắn nhãn rõ tỷ giá mock và giá USD tham chiếu. |

---

## 7. Roadmap nâng cấp (P0 / P1 / P2)

### P0 – Bắt buộc trước khi Demo Hackathon
1. **Smoke-test `POST /api/agent/chat` & E2E UI:** Chạy thực tế Scenario A (100 mUSDC) và Scenario B (500 mUSDC) qua trình duyệt để có **Tx Hash thật trên Fuji Snowtrace**.
2. **Đồng bộ tỷ giá hiển thị với tỷ giá Router (hoặc ghi chú rõ trên UI):** Tránh việc Portfolio báo `1 AVAX = $25` nhưng Swap `100 mUSDC` lại ra `0.05 AVAX` (tương đương `$1.25`).

### P1 – Cần thiết để thành MVP thực sự
1. **Thay Hardcoded Price bằng Real Price API:** Gọi CoinGecko/DefiLlama API (có cache 60s trong memory) hoặc Chainlink Fuji Feed trong `portfolio.service.ts`.
2. **On-chain Transaction History:** Đọc event `SwapExecuted` từ `AgentVaultExecutor` bằng `provider.getLogs(...)` khi load Dashboard để lịch sử không bị mất khi F5.
3. **Post-Tx Verification cho AI:** Sau khi UI nhận được Tx Hash, gọi endpoint hoặc tool `verify_transaction(txHash)` để AI tóm tắt kết quả thực tế và cập nhật lời khuyên.

### P2 – Nâng cao & Tối ưu
1. **Tích hợp Testnet DEX Router thật** (hoặc multi-pair `MockDEXRouter` hỗ trợ swap 2 chiều `AVAX ↔ mUSDC`).
2. **Per-user Daily Limit** trong `AgentVaultPolicy.sol`.
3. **AI Portfolio Rebalancing Insights** dựa trên biến động giá 24h và tỷ trọng mục tiêu.

---

## 8. Kết luận cuối cùng

**AgentVault hiện tại là một `Functional Prototype` (Prototype hoạt động thực tế trên Testnet), CHƯA phải là một `DeFi AI Agent MVP` hoàn chỉnh.**

**Lý do:**
- Nó **vượt qua mức Blockchain Demo** vì có đầy đủ 4 Smart Contracts đã qua Security Audit & Deploy thật trên Avalanche Fuji, có Backend TypeScript kết nối RPC thật, có Gemini Function Calling thật và có cơ chế User tự ký ví (Human-in-the-loop) không thể bị AI vượt quyền.
- Tuy nhiên, nó **chưa đạt chuẩn DeFi AI Agent MVP** thực tế vì giá USD vẫn đang hardcode (`$25/AVAX`), thanh khoản & tỷ giá swap đang mô phỏng trên `MockDEXRouter` (`2000 mUSDC = 1 AVAX`), lịch sử giao dịch mất khi tải lại trang, và chưa hoàn tất kiểm chứng E2E runtime cho endpoint Gemini Chat + giao dịch từ UI.

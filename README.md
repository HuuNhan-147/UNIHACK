# AgentVault — AI DeFi Copilot on Avalanche

> **Avalanche Team1 Vietnam UniHack — Topic #13 (DeFi Copilot):**  
> Trợ lý AI thao tác DeFi trên **Avalanche Fuji Testnet (`43113`)** bằng ngôn ngữ tự nhiên (Tiếng Việt / Tiếng Anh) — kết hợp **Chainlink `AVAX/USD` Price Feed on-chain**, đọc vị thế **Aave V3**, lớp kiểm duyệt **Tx Guardian** và cơ chế khóa rủi ro trực tiếp bằng **Smart Contract Policy**.

---

## 1. Vấn đề & Giải pháp

* **Vấn đề:** Người dùng mới gặp rào cản lớn khi thao tác DeFi (đọc số dư, tính trượt giá, kiểm tra allowance, đánh giá rủi ro thanh lý), trong khi giao toàn quyền ví cho AI Agent lại tiềm ẩn rủi ro mất tiền nếu AI bị lỗi hoặc bị tấn công prompt injection.
* **Giải pháp của AgentVault:** **AI đề xuất, Smart Contract kiểm soát, Người dùng giữ chìa khóa (100% Non-custodial).**
  * AI chỉ đọc dữ liệu thật và tạo **Unsigned Transaction Plan**.
  * Mọi giao dịch đều đi qua **Tx Guardian** giải thích rõ bằng ngôn ngữ tự nhiên trước khi người dùng tự ký bằng ví (MetaMask / Core Wallet).
  * Ngay cả khi Backend bị giả mạo, **`AgentVaultPolicy`** on-chain vẫn chặn đứng các giao dịch vượt hạn mức hoặc sai whitelist.

---

## 2. Kiến trúc tổng quan

```text
User (MetaMask / Core Wallet - Avalanche Fuji 43113)
  │
  ▼
Frontend (React + Vite + TailwindCSS + Ethers v6)
  │  • Portfolio & Chainlink Fuji Price Badge
  │  • DeFi Copilot Chat + Session Isolation
  │  • Tx Guardian Inspector & Approval Modal
  │
  ▼
Backend (Node.js + Express + TypeScript + Gemini Function Calling)
  │  • 7 Deterministic Read Tools (Portfolio, Policy, Glacier History, Quote, Allocation, Risk, Yields)
  │  • 3 User-Signed Write Tools (Swap Plan, Set Allowance Plan, Revoke Allowance Plan)
  │  • Chainlink Fuji Feed + Aave V3 Reader + DeFiLlama Yields
  │  • Guardrails (Chặn dự đoán giá, chặn vượt hạn mức, chống Unlimited Approval)
  │
  ▼
Avalanche Fuji Smart Contracts (Chain ID: 43113)
  • AgentVaultPolicy.sol   — Enforce maxAmountPerTx (300 mUSDC), maxSlippageBps (2%), whitelists, Pause
  • AgentVaultExecutor.sol — Entrypoint qua ISwapRouter, enforce minAmountOut & ReentrancyGuard
  • MockDEXRouter.sol      — Implement ISwapRouter, hỗ trợ đọc giá trực tiếp từ Chainlink AVAX/USD
  • MockERC20.sol (mUSDC)  — Token test ERC-20 (6 decimals) kèm Faucet
```

---

## 3. Tính năng cốt lõi

### 7 Read Tools (Dữ liệu xác định, không bịa đặt)
1. `get_portfolio`: Đọc số dư `AVAX` & `mUSDC` on-chain và giá `AVAX/USD` live từ **Chainlink Fuji Price Feed** (fallback DeFiLlama API).
2. `get_policy_rules`: Đọc hạn mức giao dịch (`maxAmountPerTx`, `maxSlippageBps`, whitelist) trực tiếp từ `AgentVaultPolicy`.
3. `get_tx_history`: Truy xuất lịch sử giao dịch thật trên Avalanche Fuji qua **Avalanche Glacier API** và event `SwapExecuted`.
4. `get_swap_quote`: Tính tỷ giá swap `mUSDC -> AVAX` và `minAmountOut` từ Router on-chain.
5. `analyze_portfolio_allocation`: Phân tích tỷ trọng tài sản, mức độ tập trung rủi ro và mô phỏng phân bổ sau swap giả định.
6. `calculate_position_risk`: Đọc vị thế Lending thực tế trên **Aave V3** (`getUserAccountData`) nếu cấu hình `AAVE_V3_POOL_ADDRESS`, hoặc tính toán xác định Health Factor / Liquidation Price theo tham số người dùng cung cấp + mức độ sụt giảm 20% giá AVAX.
7. `get_avalanche_protocol_yields`: Lấy dữ liệu TVL & APY tham khảo của các giao thức Avalanche Mainnet từ DeFiLlama (kèm disclaimer tách biệt với Testnet).

### 3 Write Tools (Human-in-the-loop & Tx Guardian)
1. `plan_swap`: Lập kế hoạch swap `mUSDC -> AVAX` qua `AgentVaultExecutor` (`ISwapRouter`).
2. `plan_set_allowance`: Cấp quyền chi tiêu đúng bằng số lượng cần thiết (không approve vô hạn).
3. `plan_revoke_allowance`: Thu hồi allowance về `0`.

### Guardrails & An toàn
* **No Forecast / No Hallucination:** Từ chối mọi yêu cầu dự đoán giá tương lai hoặc cam kết lợi nhuận.
* **On-chain Enforcement:** `AgentVaultPolicy` chặn mọi lệnh `> 300 mUSDC` hoặc slippage `> 2%` ở cấp Smart Contract.
* **Per-Session Memory:** Cách ly ngữ cảnh hội thoại theo từng `sessionId`.

---

## 4. Smart Contracts trên Avalanche Fuji (`43113`)

* **Chainlink `AVAX/USD` Feed (Fuji):** `0x5498BB86BC934c8D34FDA08E81D444153d0D06aD`
* **Triển khai hiện tại (`contracts/deployments/fuji.json`):**
  * `MockERC20 (mUSDC)`: `0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1`
  * `AgentVaultPolicy`: `0x940d6C627C55F002A42eAc257d7A36dbDe4157e7`
  * `MockDEXRouter` *(Chainlink-backed)*: `0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8`
  * `AgentVaultExecutor`: `0x927937eC37b343290b22893f90C00E8eE4AE6582`

---

## 5. Cấu trúc dự án

```text
├── contracts/   # Hardhat + Solidity (AgentVaultPolicy, AgentVaultExecutor, MockDEXRouter, ISwapRouter, IAggregatorV3)
├── backend/     # Express + TypeScript + Gemini Function Calling + Chainlink/Aave/Glacier services + eval/
├── frontend/    # React + Vite + TypeScript + TailwindCSS + ethers v6
└── docs/        # Tài liệu kiến trúc, audit và kịch bản demo
```

---

## 6. Cài đặt & Chạy Local

### Yêu cầu
* Node.js `>= 20.0.0` và `pnpm`
* Ví trình duyệt (MetaMask hoặc Core Wallet) cấu hình mạng **Avalanche Fuji Testnet** (`Chain ID: 43113`)

### Cài đặt & Cấu hình
```bash
pnpm install
```
Cấu hình các biến môi trường trong `contracts/.env`, `backend/.env` (thêm `GEMINI_API_KEY`, `CHAINLINK_AVAX_USD_FEED`, tùy chọn `AAVE_V3_POOL_ADDRESS`) và `frontend/.env`.

### Khởi chạy ứng dụng
```bash
# Terminal 1: Chạy Backend (http://localhost:4000)
pnpm --filter backend dev

# Terminal 2: Chạy Frontend (http://localhost:5173)
pnpm --filter frontend dev
```

### Deploy Smart Contracts lên Fuji (khi cần cập nhật on-chain)
```bash
pnpm --filter contracts check:fuji
pnpm --filter contracts deploy:fuji
```

---

## 7. Kiểm thử & Đánh giá

```bash
# 1. Smart Contract Unit Tests (24/24 passing: Policy, Executor, Chainlink Oracle, SpendGuard)
pnpm --filter contracts test

# 2. Topic 13 Bilingual Evaluation Suite (30/30 deterministic passing)
pnpm --filter backend eval
pnpm --filter backend eval -- --live

# 3. Type-check & Production Build
pnpm --filter backend typecheck
pnpm --filter frontend build
```

---

## 8. Lưu ý Testnet & Giới hạn

* `MockERC20` (`mUSDC`) và `MockDEXRouter` (hỗ trợ tỷ giá Chainlink `AVAX/USD`) phục vụ môi trường Avalanche Fuji Testnet; kiến trúc `ISwapRouter` sẵn sàng thay thế bằng DEX Router thật (LFJ / Pangolin) khi triển khai Mainnet.
* Dữ liệu TVL/APY từ DeFiLlama phản ánh **Avalanche Mainnet** (chỉ dùng tham khảo, không cam kết lợi nhuận).
* Copilot chỉ tạo giao dịch chưa ký để người dùng kiểm tra qua Tx Guardian và tự ký bằng ví.

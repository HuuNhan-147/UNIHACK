# AgentVault — Non-Custodial AI DeFi & Risk Copilot on Avalanche

> **Avalanche Team1 Vietnam UniHack — Topic #13 (DeFi Copilot):**  
> Trợ lý AI phân tích rủi ro & chuẩn bị giao dịch DeFi trên **Avalanche Fuji Testnet (`Chain ID: 43113`)** bằng ngôn ngữ tự nhiên (Tiếng Việt / Tiếng Anh) — tích hợp **Chainlink `AVAX/USD` Price Feed on-chain**, đọc vị thế **Aave V3 Fuji Pool** đã xác minh bytecode, mô phỏng giao dịch trực tiếp bằng **Tx Guardian (`eth_call` + `keccak256` Calldata Integrity Guard)** và thực thi khóa rủi ro trực tiếp bằng **Smart Contract Policy**.

---

## 1. Vấn đề & Giải pháp

* **Vấn đề:** Người dùng DeFi gặp rào cản lớn khi phải tự đọc trạng thái hợp đồng, tính trượt giá, kiểm tra phơi nhiễm allowance và đánh giá rủi ro thanh lý; trong khi giao private key cho AI Agent tự động ký lại tiềm ẩn rủi ro mất tài sản nếu AI ảo giác hoặc bị tấn công Prompt Injection.
* **Giải pháp của AgentVault:** **AI đề xuất & phân tích — Smart Contract kiểm soát — Người dùng giữ khóa ký (100% Non-custodial).**
  * AI chỉ đọc dữ liệu xác thực (gắn nhãn `ON_CHAIN`, `EXTERNAL_API`, `DETERMINISTIC_MATH`, `INSUFFICIENT_DATA`) và tạo **Unsigned Transaction Plan**.
  * Trước khi ký, **Tx Guardian** chạy mô phỏng trực tiếp `eth_call` + `eth_estimateGas` với đúng địa chỉ ví người dùng (`from: userAddress`), phân loại `SIMULATION PASSED / FAILED / UNAVAILABLE` và đóng dấu toàn vẹn `integrityHash = keccak256(chainId:to:data:value)`.
  * Ở lớp cuối cùng, **`AgentVaultPolicy`** on-chain chặn mọi giao dịch vượt trần `300 mUSDC/tx`, vượt `2% slippage` hoặc gọi sang contract ngoài whitelist.

---

## 2. Kiến trúc tổng quan

```text
User (MetaMask / Core Wallet — Avalanche Fuji 43113)
  │  • Ký EIP-191 xác thực khi lưu Policy Profile riêng theo ví
  │  • Kiểm tra chainId === 43113 & keccak256 integrityHash trước khi ký giao dịch
  ▼
Frontend (React + Vite + TailwindCSS + Ethers v6)
  │  • HoldingsTable (Chainlink Fuji Price Feed Badge) & AssetAllocation
  │  • RiskIntelligenceCard (Concentration, -20% Shock, Allowance, Router Liquidity, Aave V3)
  │  • DeFi Copilot Chat + Session Isolation
  │  • Tx Guardian Inspector & Live EVM Simulator Modal
  ▼
Backend (Node.js + Express + TypeScript + Gemini Function Calling)
  │  • 7 Deterministic Read Tools (Portfolio, Policy, Glacier History, Quote, Allocation, Risk, Yields)
  │  • 3 User-Signed Write Tools (Swap Plan, Set Allowance Plan, Revoke Allowance Plan)
  │  • Live EVM Simulator (txSimulator.service.ts — eth_call, estimateGas, Custom Error Decoder)
  │  • Chainlink Round Validator + Verified Aave V3 Fuji Reader + DeFiLlama Snapshot Yields
  │  • Zero-Trust Guardrails (Chặn Prompt Injection, Chặn dự đoán giá, Chặn Unlimited Approval)
  ▼
Avalanche Fuji Smart Contracts (Chain ID: 43113)
  • AgentVaultPolicy.sol   — Enforce maxAmountPerTx (300 mUSDC), maxSlippageBps (2%), whitelists, Pause
  • AgentVaultExecutor.sol — Entrypoint qua ISwapRouter, enforce minAmountOut & ReentrancyGuard
  • MockDEXRouter.sol      — Implement ISwapRouter, đọc tỷ giá trực tiếp từ Chainlink AVAX/USD Fuji
  • MockERC20.sol (mUSDC)  — Token test ERC-20 (6 decimals) kèm Faucet
```

---

## 3. Tính năng cốt lõi

### 7 Read Tools (Gắn nhãn nguồn dữ liệu, không bịa đặt)
1. `get_portfolio`: Đọc số dư `AVAX` & `mUSDC` on-chain và giá `AVAX/USD` live từ **Chainlink Fuji Price Feed** (kiểm tra đầy đủ `roundId`, `answeredInRound`, `updatedAt`, `maxAge = 24h`).
2. `get_policy_rules`: Đọc hạn mức on-chain từ `AgentVaultPolicy` cùng cấu hình Policy & hạn mức ngày riêng của từng ví.
3. `get_tx_history`: Truy xuất và gộp (deduplicate) lịch sử giao dịch thật trên Avalanche Fuji từ **Avalanche Glacier API** và event `SwapExecuted`.
4. `get_swap_quote`: Báo giá chỉ đọc (`isExecuted: false`) từ Router on-chain kèm kiểm tra thanh khoản `AVAX` khả dụng trong Pool.
5. `analyze_portfolio_allocation`: Phân tích tỷ trọng tài sản, rủi ro tập trung (`HIGH_VOLATILE` / `BALANCED` / `HIGH_STABLE`), mức phơi nhiễm Allowance (`allowanceExposure`), thanh khoản Router (`routerLiquidityRisk`) và mô phỏng phân bổ sau swap giả định.
6. `calculate_position_risk`: Stress-test kịch bản giá AVAX giảm `-20%`, đọc vị thế vay thực tế trên **Verified Aave V3 Fuji Pool** (`0xccEa5C65f6d4F465B71501418b88FBe4e7071283`), hoặc tính xác định Health Factor / Liquidation Price theo tham số người dùng cung cấp (trả về `INSUFFICIENT_DATA` nếu ví không có nợ).
7. `get_avalanche_protocol_yields`: Lấy snapshot TVL & APY tham khảo của các giao thức Avalanche từ DeFiLlama (`EXTERNAL_API`, kèm disclaimer không cam kết lợi nhuận).

### 3 Write Tools (Qua Tx Guardian Live Simulation & Chữ ký Ví)
1. `plan_swap`: Lập kế hoạch swap `mUSDC -> AVAX` qua `AgentVaultExecutor`, tự động chạy `eth_call` mô phỏng và đính kèm `integrityHash`.
2. `plan_set_allowance`: Chuẩn bị giao dịch `Exact Approve` (`<= 300 mUSDC`) cho `AgentVaultExecutor` (chặn tuyệt đối Unlimited Approval).
3. `plan_revoke_allowance`: Chuẩn bị giao dịch `approve(executor, 0)` để thu hồi toàn bộ quyền chi tiêu `mUSDC`.

---

## 4. Địa chỉ Smart Contracts trên Avalanche Fuji (`43113`)

* **Chainlink `AVAX/USD` Feed (Fuji):** [`0x5498BB86BC934c8D34FDA08E81D444153d0D06aD`](https://testnet.snowtrace.io/address/0x5498BB86BC934c8D34FDA08E81D444153d0D06aD)
* **Verified Aave V3 Pool (Fuji):** [`0xccEa5C65f6d4F465B71501418b88FBe4e7071283`](https://testnet.snowtrace.io/address/0xccEa5C65f6d4F465B71501418b88FBe4e7071283)
* **Triển khai hiện tại (`contracts/deployments/fuji.json`) — Đã Verified Source Code trên Snowtrace / Routescan Fuji:**
  * `MockERC20 (mUSDC)`: [`0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1`](https://testnet.snowtrace.io/address/0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1#code)
  * `AgentVaultPolicy`: [`0x940d6C627C55F002A42eAc257d7A36dbDe4157e7`](https://testnet.snowtrace.io/address/0x940d6C627C55F002A42eAc257d7A36dbDe4157e7#code)
  * `MockDEXRouter` *(Chainlink-backed, `useOracle = true`)*: [`0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8`](https://testnet.snowtrace.io/address/0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8#code)
  * `AgentVaultExecutor`: [`0x927937eC37b343290b22893f90C00E8eE4AE6582`](https://testnet.snowtrace.io/address/0x927937eC37b343290b22893f90C00E8eE4AE6582#code)

---

## 5. Cấu trúc dự án

```text
├── contracts/   # Hardhat + Solidity (AgentVaultPolicy, AgentVaultExecutor, MockDEXRouter, MockERC20)
├── backend/     # Express + TypeScript + Gemini Function Calling + Tx Simulator + Risk Services + eval/
├── frontend/    # React + Vite + TypeScript + TailwindCSS + Ethers v6
└── docs/        # Báo cáo Audit & Implementation (UNIHACK_STRATEGIC_AUDIT, P0 & P1 Reports, Demo Script)
```

---

## 6. Cài đặt & Khởi chạy

### Yêu cầu
* Node.js `>= 20.0.0` và `pnpm`
* Ví trình duyệt (MetaMask hoặc Core Wallet) chuyển sang mạng **Avalanche Fuji Testnet (`Chain ID: 43113`)**

### Cài đặt & Chạy Local
```bash
pnpm install

# Terminal 1: Khởi chạy Backend API (http://localhost:4000)
pnpm --filter backend dev

# Terminal 2: Khởi chạy Frontend Dashboard (http://localhost:5173)
pnpm --filter frontend dev
```

---

## 7. Kiểm thử & Đánh giá (Evaluation Suite)

* **Smart Contract Unit Tests (`18/18 PASS`):**
  ```bash
  pnpm --filter contracts test
  ```
* **AI Deterministic Evaluation & Security Regression (`40/40 PASS` + `4/4 Security PASS`):**
  ```bash
  pnpm --filter backend eval
  ```
* **AI Live Gemini + Fuji RPC Evaluation (`40/40 PASS` — `100% Tool Selection`, `0% Hallucination`):**
  ```bash
  pnpm --filter backend eval -- --live
  ```
* **Production Build Check:**
  ```bash
  pnpm --filter backend build
  pnpm --filter frontend build
  ```

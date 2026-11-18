# TECHNICAL DESIGN — AGENTVAULT (AVALANCHE DEFI & RISK COPILOT)

**Phiên bản:** Phase 2 — Risk Intelligence & Transaction Guardian (UniHack Topic #13)  
**Mạng triển khai:** Avalanche Fuji Testnet (`Chain ID: 43113`)  
**Nguyên tắc thiết kế:** *AI đề xuất & phân tích — Smart Contract kiểm soát — Người dùng giữ khóa ký (100% Non-custodial).*

---

## 1. Kiến trúc 3 tầng (System Architecture)

```text
+-------------------------------------------------------------------+
| 1. FRONTEND (React + Vite + TailwindCSS + Ethers v6)              |
|    - WalletContext: Kết nối MetaMask/Core (Fuji 43113), kiểm tra  |
|      keccak256 integrityHash & hỗ trợ ký EIP-191 cập nhật Policy  |
|    - HoldingsTable & RiskIntelligenceCard: Hiển thị số dư, giá    |
|      Chainlink Fuji, Allowance Exposure, Router Liquidity, Aave   |
|    - ChatPanel: Giao diện DeFi Copilot + Session Isolation        |
|    - TxPreviewModal (Tx Guardian): Hiển thị kết quả mô phỏng      |
|      eth_call trực tiếp, tự động Re-Simulate sau Exact Approve    |
+---------------------------------+---------------------------------+
                                  | HTTP REST (/api/*)
+---------------------------------v---------------------------------+
| 2. BACKEND AI HARNESS (Node.js + Express + TypeScript + Gemini)   |
|    - Agent Orchestrator & Per-Session Memory (orchestrator.ts)    |
|    - Tool Registry: 7 Read Tools + 3 Write Tools (zod schemas)    |
|    - Deterministic Policy Engine, Intent Guard & Forecast Refusal |
|    - Live EVM Simulator (txSimulator.service.ts): eth_call +      |
|      eth_estimateGas với đúng `from: userAddress`                 |
|    - Data Services: Chainlink Round Validator, Verified Aave V3   |
|      Fuji Reader (0xccEa5C...), DeFiLlama Yields, Glacier History |
|    - Per-Wallet Profile & Daily Usage Store (store.service.ts)    |
+---------------------------------+---------------------------------+
                                  | JSON-RPC (Fuji 43113)
+---------------------------------v---------------------------------+
| 3. ON-CHAIN SMART CONTRACTS (Avalanche Fuji Testnet)              |
|    - AgentVaultPolicy (0x940d6C627C55F002A42eAc257d7A36dbDe4157e7)|
|      Enforce maxAmountPerTx (300 mUSDC), maxSlippageBps (200),    |
|      allowedTokens, allowedRouters, Pausable                      |
|    - AgentVaultExecutor (0x927937eC37b343290b22893f90C00E8eE4AE6582)|
|      ReentrancyGuard, kiểm tra Policy & minAmountOut on-chain     |
|    - MockDEXRouter (0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8)   |
|      Đọc tỷ giá trực tiếp từ Chainlink AVAX/USD Fuji Feed         |
|    - MockERC20 mUSDC (0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1) |
+-------------------------------------------------------------------+
```

---

## 2. Luồng bảo vệ giao dịch 4 lớp (Defense-in-Depth)

1. **Lớp 1 — Pre-LLM Intent & Forecast Guard (`deterministicPolicy.service.ts`, `orchestrator.ts`):**
   - Chặn ngay các câu lệnh có dấu hiệu Prompt Injection (`ignore rules`, `system override`), đòi xuất private key / tự động ký (`SECRET_OR_CUSTODY_VIOLATION`), cấp quyền vô hạn (`MaxUint256`), hoặc dự đoán giá tương lai trước khi gọi LLM.
2. **Lớp 2 — Deterministic Policy & Live EVM Simulation (`txSimulator.service.ts`):**
   - Kiểm tra hạn mức cá nhân hóa theo ví + hạn mức Smart Contract (`300 mUSDC`, `200 bps`).
   - Chạy `provider.call` (`eth_call`) và `provider.estimateGas` với `from: userAddress` tại block Fuji mới nhất; giải mã mọi lỗi Custom Error và gắn mã băm `integrityHash`.
3. **Lớp 3 — Human-in-the-Loop UI & Client Integrity Check (`TxPreviewModal.tsx`, `WalletContext.tsx`):**
   - Hiển thị rõ 7 thông số mô phỏng cùng các điều kiện chưa xác minh; khóa nút ký mặc định nếu `Overall Decision = BLOCKED`.
   - Trình duyệt tính lại `keccak256("43113:<to>:<data>:<value>")` ngay trước `signer.sendTransaction` để chống thay đổi calldata sau mô phỏng.
4. **Lớp 4 — On-Chain Smart Contract Enforcement (`AgentVaultPolicy.sol`, `AgentVaultExecutor.sol`):**
   - Kiểm tra bất biến trên EVM: dù gọi trực tiếp từ ngoài UI vẫn bị chặn nếu vượt `300 mUSDC`, trượt giá `> 2%` hoặc sai whitelist.

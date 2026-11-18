# AGENTVAULT — EXECUTION PHASE 2: RISK INTELLIGENCE & TRANSACTION GUARDIAN REPORT

> **Ngày hoàn thành:** 2026-11-18  
> **Nhánh triển khai:** `feature/phase-2-risk-guardian` *(chưa push / chưa merge theo đúng quy định Git Workflow)*  
> **Mạng triển khai:** Avalanche Fuji Testnet (`Chain ID: 43113`)  
> **Định hướng cốt lõi:** **Non-custodial AI DeFi & Risk Copilot** — *AI đề xuất & phân tích · Smart Contract kiểm soát quyền thực thi · Người dùng giữ private key & toàn quyền ký giao dịch.*

---

## 1. Tổng quan các hạng mục đã triển khai

Phase 2 đã hoàn thành trọn vẹn 4 nhóm chức năng theo đúng thứ tự tuần tự, kèm kiểm thử thực tế trên mạng Avalanche Fuji và Gemini Function Calling sau từng nhóm:

1. **P1-A — Transaction Guardian (Live EVM Transaction Simulation & Calldata Integrity Guard):**
   - Nâng cấp `Tx Guardian` từ bộ kiểm tra tĩnh sang **mô phỏng trực tiếp trên trạng thái EVM thực tế** (`eth_call` + `eth_estimateGas`) với đúng địa chỉ ví người dùng (`from: userAddress`).
   - Bổ sung kiểm tra nghiêm ngặt `chainId === 43113`, contract bytecode on-chain (`eth_getCode`), địa chỉ contract whitelist (`AgentVaultExecutor`, `MockERC20`) và ABI function selector (`executeSwap`, `approve`).
   - Chuẩn hóa 3 trạng thái mô phỏng: `SIMULATION_PASSED`, `SIMULATION_FAILED`, `SIMULATION_UNAVAILABLE`.
   - Khóa toàn vẹn calldata bằng mã băm `keccak256(chainId:to:data:value)` (`integrityHash`): đối chiếu ngay trên trình duyệt trước khi gọi `signer.sendTransaction` để ngăn chặn mọi sai lệch giữa bản kế hoạch đã mô phỏng và giao dịch thực ký.
   - Chặn mặc định thao tác ký trên UI khi `Overall Decision = BLOCKED` (chỉ mở khi bật rõ tùy chọn *Developer Revert Demo*).

2. **P1-B — Risk Intelligence & Verified Aave V3 Fuji Integration:**
   - Xác minh trực tiếp qua JSON-RPC và kích hoạt tích hợp đọc vị thế từ **Official Aave V3 Fuji Pool** (`0xccEa5C65f6d4F465B71501418b88FBe4e7071283`, `ADDRESSES_PROVIDER = 0xfb87056c0587923f15EB0aABc7d0572450Cc8003`, `8` active reserves).
   - Mở rộng phân tích rủi ro danh mục & vị thế gồm: `Portfolio Allocation`, `Token Concentration`, `Asset Exposure`, `Allowance Exposure`, `Router Liquidity Risk`, `Swap Price Impact`, `-20% AVAX Drawdown Stress Test`, và `Liquidation Risk`.
   - Gắn nhãn nguồn dữ liệu (`ON_CHAIN`, `EXTERNAL_API`, `DETERMINISTIC_MATH`, `INSUFFICIENT_DATA`) kèm `updatedAt` ISO timestamp cho mọi chỉ số; trả về `INSUFFICIENT_DATA` thay vì suy đoán khi ví không có khoản vay hoặc giao thức chưa tích hợp (như Benqi trên Fuji).
   - Bổ sung endpoint `GET /api/risk/:address` và thẻ `RiskIntelligenceCard` hiển thị trực tiếp trên Dashboard.

3. **P1-C — AI Evaluation & Tool Reliability (40-Case Benchmark + Live Gemini):**
   - Giữ nguyên 100% bộ `30` deterministic evaluation cases gốc (`R01`–`F05`) và bổ sung `10` kịch bản Phase 2 (`C31`–`C40`), phủ đủ 10 nhóm tình huống bắt buộc.
   - Chạy benchmark thực tế với **Live Gemini API + Avalanche Fuji RPC + DeFiLlama** (`--live`), phát hiện 4 hành vi biên của LLM ở lần chạy đầu (`36/40 = 90.0%`), tối ưu `SYSTEM_INSTRUCTION` + Tool Schema và xác minh đạt **`40/40 (100.0%)`** ở cả chế độ Deterministic và Live LLM.

4. **P1-D — Demo Readiness & 11-Edge-Case Full Regression:**
   - Đồng bộ `PlanCard` (hiển thị nhãn Simulation trực tiếp, tự cập nhật số lượng khi đổi kế hoạch) và nút demo nhanh `Risk: Aave & Liquidity` trên `ChatPanel`.
   - Kiểm chứng thực tế toàn bộ **11 tình huống lỗi/biên** trên Fuji (bao gồm kịch bản thay đổi trạng thái on-chain sau khi `SIMULATION_PASSED`).

---

## 2. Danh sách file đã thay đổi

### Backend (`backend/`)
| File | Thao tác | Nội dung thay đổi |
| :--- | :--- | :--- |
| `backend/src/services/txSimulator.service.ts` | **Thêm mới** | Engine mô phỏng `eth_call` + `estimateGas` với `from: userAddress`, kiểm tra chainId/whitelist/selector/bytecode, giải mã Custom Errors và tính `computeTxIntegrityHash`. |
| `backend/src/services/swapPlanner.service.ts` | Chỉnh sửa | Tích hợp `simulateUnsignedTransaction` và `integrityHash` vào cả `approveTx` và `swapTx`; tự động chuyển `BLOCKED` nếu `SIMULATION_FAILED`. |
| `backend/src/services/allowancePlanner.service.ts` | Chỉnh sửa | Tích hợp `simulateUnsignedTransaction` và `integrityHash` cho kế hoạch cấp/thu hồi allowance (`SET` / `REVOKE`). |
| `backend/src/services/aave.service.ts` | Chỉnh sửa | Bổ sung xác minh bytecode `provider.getCode()` (có cache), trả về `bytecodeVerified`, `dataSource` (`ON_CHAIN` / `INSUFFICIENT_DATA`) và `fetchedAt`. |
| `backend/src/services/copilotAnalysis.service.ts` | Chỉnh sửa | Bổ sung `getAllowanceAndLiquidityRisk`, `assetExposure`, `metricSources`, `liquidationRiskStatus: "INSUFFICIENT_DATA"`, kiểm tra thanh khoản Router trong `getSwapQuoteDeterministic`, và chuẩn hóa DeFiLlama `INSUFFICIENT_DATA`. |
| `backend/src/services/blockchain.service.ts` | Chỉnh sửa | Cho phép cấu hình `timeoutMs` tùy chọn trong `withRpcTimeout` để kiểm soát và kiểm thử timeout chính xác. |
| `backend/src/services/deterministicPolicy.service.ts` | Chỉnh sửa | Bổ sung cờ `SECRET_OR_CUSTODY_VIOLATION` chặn yêu cầu xuất private key / seed phrase / tự động ký không qua ví. |
| `backend/src/config/env.ts` & `backend/.env.example` | Chỉnh sửa | Cấu hình mặc định `AAVE_V3_POOL_ADDRESS=0xccEa5C65f6d4F465B71501418b88FBe4e7071283` (đã xác minh trên Fuji). |
| `backend/src/agent/orchestrator.ts` | Chỉnh sửa | Tinh chỉnh `detectForecastRequest` (không chặn nhầm câu hỏi APY hiện tại), siết `SYSTEM_INSTRUCTION` (không tự đoán số lượng khi thiếu tham số, phân biệt nguồn dữ liệu, từ chối giao thức ngoài phạm vi) và chuẩn hóa phân loại `REJECT`. |
| `backend/src/agent/toolRegistry.ts` | Chỉnh sửa | Cập nhật mô tả schema tool và trả thêm `simulationStatus` / `simulationRevertReason` cho AI tổng hợp. |
| `backend/src/routes/api.route.ts` | Chỉnh sửa | Thêm `POST /api/tx/simulate` (re-simulate trực tiếp) và `GET /api/risk/:address` (tổng hợp Risk Intelligence). |
| `backend/eval/cases.json` | Chỉnh sửa | Giữ nguyên 30 cases gốc (`R01`–`F05`), bổ sung 10 cases mới (`C31`–`C40`). |
| `backend/eval/runner.ts` | Chỉnh sửa | Đo lường 5 chỉ số định lượng, kiểm tra chống ảo giác (Hallucination Detector) và tích hợp bộ 4 bài test Security Regression. |

### Frontend (`frontend/`)
| File | Thao tác | Nội dung thay đổi |
| :--- | :--- | :--- |
| `frontend/src/components/dashboard/RiskIntelligenceCard.tsx` | **Thêm mới** | Hiển thị trực quan Concentration, `-20% AVAX Shock`, Allowance Exposure, Router Liquidity và Aave V3 Fuji Position kèm nhãn nguồn dữ liệu. |
| `frontend/src/components/agent/TxPreviewModal.tsx` | Chỉnh sửa | Hiển thị đầy đủ 7 trường thông tin mô phỏng (`eth_call`), nút `Re-Simulate`, tự động mô phỏng lại sau bước `Exact Approve`, cảnh báo giới hạn mô phỏng, và khóa nút ký mặc định khi `BLOCKED`. |
| `frontend/src/context/WalletContext.tsx` | Chỉnh sửa | Xác minh `chainId === 43113` và kiểm tra đối khớp `integrityHash` (`keccak256`) ngay trước `signer.sendTransaction`. |
| `frontend/src/components/agent/PlanCard.tsx` | Chỉnh sửa | Hiển thị badge trạng thái Simulation và đồng bộ ô nhập số lượng khi đổi kế hoạch. |
| `frontend/src/components/agent/ChatPanel.tsx` | Chỉnh sửa | Bổ sung nút demo nhanh `Risk: Aave & Liquidity`. |
| `frontend/src/services/api.ts` & `frontend/src/App.tsx` | Chỉnh sửa | Bổ sung client API `simulateTransaction`, `fetchRiskOverview` và kết nối `RiskIntelligenceCard`. |

---

## 3. Kiến trúc Transaction Guardian sau nâng cấp

```text
[AI Tool: plan_swap / plan_set_allowance / plan_revoke_allowance]
        │
        ▼
[1. Deterministic Policy Engine]
   ├── Kiểm tra trạng thái Agent (ACTIVE / PAUSED / REVOKED) & ExecutionMode
   ├── Kiểm tra Whitelist Token/Pair/Router, Per-Swap Cap (<= 300 mUSDC), Daily Budget, Slippage (<= 200 bps)
   └── Gọi precheck AgentVaultPolicy.validateSwap() trên Fuji
        │
        ▼
[2. Live EVM Simulator (txSimulator.service.ts)]
   ├── Kiểm tra Chain ID (43113), Địa chỉ hợp lệ, Contract Whitelist & ABI Function Selector
   ├── Kiểm tra Bytecode tồn tại trên Fuji (eth_getCode)
   ├── Chạy eth_call + eth_estimateGas với đúng { from: userAddress, to, data, value }
   ├── Giải mã Custom Errors (ExceedsMaxTxAmount, InsufficientRouterLiquidity, ERC20InsufficientBalance...)
   └── Đóng dấu toàn vẹn: integrityHash = keccak256("43113:<to>:<data>:<value>")
        │
        ▼
[3. TxPreviewModal (Frontend UI)]
   ├── Hiển thị: Tx Type, Token & Amount, Target Contract, Block #, Estimated Gas, Status Badge
   ├── Hiển thị: Risk Warnings + Unverified Conditions Disclaimer
   ├── Bước 1 (Nếu cần): User ký Exact Approve -> Tự động gọi POST /api/tx/simulate để mô phỏng lại Swap
   └── Khóa nút ký mặc định nếu SIMULATION_FAILED / BLOCKED
        │
        ▼
[4. WalletContext.sendTx (Client-Side Final Guard)]
   ├── Kiểm tra mạng ví thực tế === Avalanche Fuji (43113)
   ├── Tính lại keccak256(chainId:to:data:value) === plan.integrityHash (chặn mọi thay đổi calldata)
   └── Mở MetaMask / Core Wallet để chính người dùng ký giao dịch
```

---

## 4. Cơ chế Simulation và các giới hạn

### Phân loại 3 trạng thái
1. **`SIMULATION_PASSED`:** Giao dịch vượt qua toàn bộ kiểm tra tĩnh và thực thi `eth_call` + `eth_estimateGas` thành công tại `simulatedBlock` (trả về lượng gas ước tính và số `AVAX` đầu ra giải mã trực tiếp từ dữ liệu trả về của `executeSwap`).
2. **`SIMULATION_FAILED`:** Giao dịch chắc chắn thất bại hoặc vi phạm bảo mật tại trạng thái hiện tại (sai Chain ID, contract ngoài whitelist, sai selector, `ExceedsMaxTxAmount`, `SlippageTooHigh`, `ERC20InsufficientBalance`, `InsufficientRouterLiquidity`, `StaleOraclePrice`).
3. **`SIMULATION_UNAVAILABLE`:**
   - Xảy ra hợp lệ ở **bước trước khi cấp quyền (`Allowance < amountIn`)** của giao dịch Swap 2 bước: lúc này `eth_call` tới `AgentVaultExecutor` đã xác nhận `AgentVaultPolicy.validateSwap()` hợp lệ, số dư ví đủ và thanh khoản Router đủ, nhưng dừng tại `ERC20InsufficientAllowance` cho tới khi người dùng ký Bước 1 (`Exact Approve`). Ngay sau khi Bước 1 hoàn tất, UI tự động chạy lại `POST /api/tx/simulate` để chuyển sang `SIMULATION_PASSED`.
   - Hoặc xảy ra khi Fuji JSON-RPC tạm thời không phản hồi / timeout.

### Các giới hạn (Hiển thị công khai trên UI)
- **Không cam kết giao dịch chắc chắn thành công:** `SIMULATION_PASSED` chỉ phản ánh trạng thái tại block kiểm tra (`#simulatedBlock`). Giữa thời điểm mô phỏng và thời điểm giao dịch được đóng vào block mới, các yếu tố như: (a) thanh khoản `AVAX` trong `MockDEXRouter` bị ví khác rút/swap trước, (b) tỷ giá Chainlink `AVAX/USD` cập nhật vượt ngưỡng trượt giá `minAmountOut`, hoặc (c) người dùng thay đổi số dư/allowance ở tab khác đều có thể khiến giao dịch thực tế revert.

---

## 5. Risk Intelligence Data Sources

Mọi chỉ số trong `analyzePortfolioAllocation` và `calculatePositionRisk` đều đi kèm trường `metricSources` phân tách minh bạch 4 nhóm nguồn dữ liệu và thời điểm cập nhật (`updatedAt`):

| Chỉ số rủi ro | Nguồn dữ liệu (`source`) | Chi tiết truy xuất thực tế |
| :--- | :--- | :--- |
| **Wallet Balances (`AVAX`, `mUSDC`)** | `ON_CHAIN` | `provider.getBalance(user)` & `MockERC20.balanceOf(user)` trên Fuji (`43113`). |
| **AVAX/USD Reference Price** | `ON_CHAIN` *(hoặc `EXTERNAL_API` khi fallback)* | Chainlink `AVAX/USD` Fuji Aggregator (`0x5498BB86BC934c8D34FDA08E81D444153d0D06aD`) có kiểm tra `roundId`, `answeredInRound`, `updatedAt`. |
| **Allowance Exposure** | `ON_CHAIN` | `MockERC20.allowance(user, AgentVaultExecutor)` — cảnh báo nếu quyền chi tiêu tồn đọng vượt số dư hoặc vượt ngưỡng an toàn. |
| **Router Liquidity & Price Impact** | `ON_CHAIN` | `provider.getBalance(MockDEXRouter)` + `router.rateMusdcPerAvax()` — tính chính xác trần `maxSwappableMusdc` trước khi cạn pool; ghi rõ mô hình tỷ giá tuyến tính theo Oracle (`0 bps` curve impact tới trần thanh khoản, revert `100%` nếu vượt trần). |
| **Allocation, Concentration & `-20%` Shock** | `DETERMINISTIC_MATH` | Tính toán tất định bằng TypeScript từ số dư và tỷ giá xác thực, không qua LLM ước lượng. |
| **Aave V3 Fuji Position** | `ON_CHAIN` | `Pool.getUserAccountData(user)` trên contract đã xác minh bytecode (`0xccEa5C65f6d4F465B71501418b88FBe4e7071283`). |
| **Liquidation Price / Health Factor** | `ON_CHAIN` / `DETERMINISTIC_MATH` / `INSUFFICIENT_DATA` | Dùng dữ liệu `ON_CHAIN` nếu ví có nợ thực trên Aave V3 Fuji; dùng `DETERMINISTIC_MATH` nếu người dùng truyền tham số giả định; trả về **`INSUFFICIENT_DATA`** nếu không có nợ hoặc hỏi giao thức chưa tích hợp (Benqi). |
| **Avalanche Reference Yields (APY/TVL)** | `EXTERNAL_API` / `INSUFFICIENT_DATA` | Snapshot tham khảo từ `https://yields.llama.fi/pools` (Avalanche Mainnet, tách biệt với Fuji Testnet); trả về `INSUFFICIENT_DATA` nếu API lỗi hoặc không có pool khớp. |

---

## 6. Tình trạng Aave V3 Integration

- **Trạng thái:** **ĐÃ XÁC MINH & KÍCH HOẠT CHẾ ĐỘ ĐỌC ON-CHAIN (READ-ONLY RISK MONITORING)** trên Avalanche Fuji.
- **Bằng chứng xác minh RPC trực tiếp trên Fuji (`43113`):**
  - **Pool Proxy Address:** `0xccEa5C65f6d4F465B71501418b88FBe4e7071283`
  - **PoolAddressesProvider:** `0xfb87056c0587923f15EB0aABc7d0572450Cc8003`
  - **Bytecode:** Hợp lệ (`code.length = 4668` ký tự hex, xác minh tự động bằng `eth_getCode` trong `aave.service.ts`).
  - **Active Reserves:** `8` tài sản dự trữ đang hoạt động trên Fuji; hàm `getUserAccountData(address)` tương thích chuẩn ABI 6-tuple của Aave V3.
- **Phạm vi hỗ trợ:** Đọc trực tiếp `totalCollateralUsd`, `totalDebtUsd`, `availableBorrowsUsd`, `liquidationThresholdPct`, `ltvPct`, `healthFactor`. Khi ví người dùng chưa mở vị thế vay trên Fuji (`totalCollateralUsd = 0`, `totalDebtUsd = 0`), hệ thống hiển thị trung thực trạng thái `NO_POSITION` / `INSUFFICIENT_DATA` cho giá thanh lý, **tuyệt đối không dựng số liệu giả**. (Chức năng ghi/supply/borrow lên Aave chưa mở trong `AgentVaultExecutor` để giữ phạm vi Policy Whitelist an toàn).

---

## 7. Kết quả AI Evaluation trước và sau nâng cấp

Bộ đánh giá được mở rộng từ **`30` cases** (Phase 1) lên **`40` cases** (`30` cases gốc giữ nguyên + `10` cases mới `C31`–`C40`), phủ đủ 10 nhóm: Portfolio, Token Balance, Swap Quote vs Execution, Transaction Planning, Allowance Management, Risk Analysis, APY Snapshot, Unsupported Protocols (`Solana Raydium`, `GMX`, `BTC.b`), Stale/Missing Data (`NonExistentProtocolXYZ999`, `0-debt Liquidation`), và Prompt Injection / Secret Exfiltration.

| Chỉ số đo lường | Phase 1 Baseline (30 cases, Offline) | Phase 2 — Live Gemini Run 1 *(Trước tối ưu Prompt/Schema, 40 cases)* | Phase 2 — Final Deterministic (40 cases) | Phase 2 — Final Live Gemini + Fuji RPC (40 cases) |
| :--- | :---: | :---: | :---: | :---: |
| **Tổng số kịch bản** | 30 | 40 | **40** | **40** |
| **Correct Response Rate** | 100.0% (30/30) | 90.0% (36/40) | **100.0% (40/40)** | **100.0% (40/40)** |
| **Tool Selection Accuracy** | N/A *(chỉ check regex)* | 90.0% (36/40) | **100.0% (40/40)** | **100.0% (40/40)** |
| **Unsupported Request Rejection** | 100.0% (1/1) | 100.0% (3/3) | **100.0% (3/3)** | **100.0% (3/3)** |
| **Guardrail & Injection Block** | 100.0% (7/7) | 80.0% (8/10) | **100.0% (10/10)** | **100.0% (10/10)** |
| **Observed Hallucination Rate** | N/A | 12.5% (1/8) | **0.0% (0/8)** | **0.0% (0/8)** |
| **Security Regression Suite** | Session check only | PASS (4/4) | **PASS (4/4)** | **PASS (4/4)** |

*Ghi nhận cải tiến thực tế từ Live Run 1 -> Live Run 3:*
1. Khắc phục lỗi LLM tự suy đoán số tiền từ số dư ví khi câu lệnh thiếu số lượng (`W06: "Swap mUSDC to AVAX"`).
2. Khắc phục lỗi mô tả tham số `(<= 300)` trong `plan_set_allowance` khiến LLM ngại gọi tool tạo báo cáo chặn chính thức cho `G01` (`500 mUSDC`) và `G06` (`1000 mUSDC`).
3. Bắt buộc gọi `get_avalanche_protocol_yields` để xác minh dữ liệu DeFiLlama và trả `INSUFFICIENT_DATA` cho giao thức lạ (`C38`), đưa tỷ lệ ảo giác quan sát được từ `12.5%` về **`0.0%`**.
4. Chuẩn hóa phân loại `decision = REJECT` khi từ chối số lượng âm (`G07: -50 mUSDC`).

---

## 8. Test Results thực tế

### 8.1. Tổng hợp các bộ kiểm thử tự động
- **Smart Contract Unit Tests (`pnpm --filter contracts test`):** **`24 / 24 PASS`** (`AgentVault.test.ts`, `OracleRouter.test.ts`, `SpendGuardVault.test.ts`).
- **Backend TypeScript Build (`pnpm --filter backend build`):** **`PASS (0 errors)`**.
- **Frontend Production Build (`pnpm --filter frontend build`):** **`PASS (0 errors, Vite bundle thành công)`**.
- **AI Deterministic Evaluation (`pnpm --filter backend eval`):** **`40 / 40 PASS` + `4 / 4 Security Regression PASS`**.
- **AI Live Gemini + Fuji RPC Evaluation (`pnpm --filter backend eval -- --live`):** **`40 / 40 PASS` + `4 / 4 Security Regression PASS`**.

### 8.2. Kết quả kiểm chứng 11 tình huống lỗi & biên bắt buộc trên Fuji
| # | Tình huống kiểm thử | Kết quả thực tế quan sát được | Trạng thái |
| :-: | :--- | :--- | :---: |
| 1 | **Insufficient balance** (`200 mUSDC > 49 mUSDC`) | `SIMULATION_FAILED` — `ERC20InsufficientBalance: Ví hiện có 49.0 mUSDC, cần 200.0 mUSDC.` | **PASS** |
| 2 | **Insufficient allowance** (Swap `1 mUSDC` khi `allowance = 0`) | `SIMULATION_UNAVAILABLE` cho bước Swap (chờ Bước 1), đồng thời `approveSimulation = SIMULATION_PASSED` (`46,741 gas`). | **PASS** |
| 3 | **Invalid contract** (`to = 0x000...dEaD`) | `SIMULATION_FAILED` (`untrusted_contract`) & `getAavePosition(0x000...dEaD)` trả `bytecodeVerified = false`, `INSUFFICIENT_DATA`. | **PASS** |
| 4 | **Wrong chain** (`chainId = 1` thay vì `43113`) | `SIMULATION_FAILED` (`Wrong Chain ID (1 !== expected Avalanche Fuji 43113)`) + chặn kép trong `WalletContext.sendTx`. | **PASS** |
| 5 | **Stale oracle price** (`age > 86,400s` / `answeredInRound < roundId`) | `validateChainlinkRound` từ chối ngay lập tức & Smart Contract `MockDEXRouter` revert `StaleOraclePrice` / `IncompleteOracleRound`. | **PASS** |
| 6 | **Router thiếu liquidity** (`40 mUSDC -> ~5.56 AVAX > 0.4603 AVAX`) | `SIMULATION_FAILED` — `InsufficientRouterLiquidity: Pool chỉ còn 0.4603 AVAX, cần tối thiểu 5.5630 AVAX.` | **PASS** |
| 7 | **Transaction revert** (`500 mUSDC > 300 mUSDC` Policy cap) | `eth_call` bắt trực tiếp lỗi revert từ `AgentVaultPolicy` trên Fuji: `ExceedsMaxTxAmount: Requested 500.0 mUSDC > limit 300.0 mUSDC.` | **PASS** |
| 8 | **RPC unavailable** (`http://127.0.0.1:19998`) | Không crash server; trả về `SIMULATION_UNAVAILABLE` kèm cảnh báo rõ ràng cho người dùng. | **PASS** |
| 9 | **API / RPC timeout** (`withRpcTimeout` 30ms & DeFiLlama AbortController) | Hủy tác vụ đúng hạn (`Simulated slow API timed out after 30ms`), giải phóng timer sạch sẽ. | **PASS** |
| 10 | **User reject wallet signature** (`EIP-1193 code 4001` & `/plans/:id/reject`) | Hiển thị thông báo tiếng Việt thân thiện, chuyển trạng thái Plan sang `REJECTED` và ghi Audit Log `USER_REJECTED`. | **PASS** |
| 11 | **Blockchain state thay đổi sau simulation** | Cấp quyền `1 mUSDC` trên Fuji (`Tx: 0x3d133beb...90ad`) -> mô phỏng Swap đạt `SIMULATION_PASSED` tại Block `#61268655` (`180,006 gas`, đầu ra `0.140481 AVAX`). Sau đó thu hồi allowance về `0` trên Fuji (`Tx: 0x56c61b73...661a`) -> mô phỏng lại cùng calldata lập tức chuyển về `SIMULATION_UNAVAILABLE`, đồng thời `integrityHash` chặn mọi sửa đổi bit trên calldata. | **PASS** |

---

## 9. Những tính năng chưa hoàn thành (Ngoài phạm vi Phase 2)

1. **Thực thi giao dịch đa giao thức (Aave Supply/Borrow, DEX Aggregator thực tế trên Mainnet):** Hiện tại `AgentVaultExecutor` chỉ cho phép thực thi cặp whitelist `mUSDC -> AVAX` qua Chainlink-backed Router trên Fuji; Aave V3 Fuji được tích hợp ở chế độ **Read-Only Risk Intelligence** để đảm bảo an toàn tuyệt đối.
2. **State Override Simulation cho giao dịch gộp (Bundled Multi-Call Simulation):** Khi `allowance = 0`, bước 2 (`executeSwap`) chưa dùng `eth_call` state-override (do nhiều node RPC công cộng trên Fuji không bật state override chuẩn), mà chạy mô phỏng toàn trình ngay sau khi Bước 1 (`Exact Approve`) xác nhận on-chain.
3. **Lưu trữ bền vững bằng Database (PostgreSQL/SQLite):** Cấu hình Profile riêng theo ví và Audit Logs vẫn đang lưu trên JSON file cục bộ (`backend/data/vault-store.json`, đã chặn khỏi Git).

---

## 10. Các rủi ro còn tồn tại & Lưu ý vận hành

1. **Thanh khoản Test AVAX trong `MockDEXRouter` (`0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8`):**
   - Hiện tại Pool đang giữ **`0.4603 AVAX`** (`~$3.29` theo giá Chainlink Fuji `~$7.15/AVAX`).
   - Khi demo giao dịch thành công, nên nhập số lượng **`0.5 – 1 mUSDC`** (`~0.07 – 0.14 AVAX`). Nếu nhập số lượng lớn hơn `3.3 mUSDC` (ví dụ `10 mUSDC` hoặc `40 mUSDC`), `Tx Guardian` sẽ phát hiện chính xác và chặn sớm với lý do `InsufficientRouterLiquidity`! Có thể nạp thêm Test AVAX trực tiếp vào địa chỉ Router bất cứ lúc nào (hàm `receive() external payable`).
2. **Giới hạn tần suất (Rate Limit) của Gemini API & Fuji Public RPC:**
   - Hệ thống đã có cơ chế xoay vòng nhiều API key (`GEMINI_API_KEYS`) và timeout `10s`, tuy nhiên khi demo trực tiếp nên tránh gửi liên tiếp quá nhiều câu lệnh trong vài giây.
3. **Biến động chu kỳ cập nhật của Chainlink Fuji Testnet Feed:**
   - Ngưỡng `maxOracleAge` đang đặt `24 giờ` phù hợp nhịp heartbeat của Testnet. Nếu Chainlink Fuji ngừng cập nhật quá 24h, có thể kích hoạt quy trình Rollback 1 lệnh đã tài liệu hóa trong `docs/IMPLEMENTATION_P0_REPORT.md`.

---

## 11. Hướng dẫn chạy Demo trên Avalanche Fuji (7 Bước Chuẩn Giám Khảo)

### Khởi động hệ thống
Mở 2 cửa sổ terminal tại thư mục gốc `d:\HACKATHON\UNIHACK`:

```powershell
# Terminal 1 — Khởi động Backend API (cổng 4000)
pnpm --filter backend dev

# Terminal 2 — Khởi động Frontend Dashboard (cổng 5173)
pnpm --filter frontend dev
```

Mở trình duyệt tại `http://localhost:5173` và thực hiện kịch bản 7 bước:

1. **Kết nối ví Avalanche Fuji (`43113`):** Bấm **Connect Wallet** (MetaMask / Core Wallet). Nếu chưa có `mUSDC`, bấm **Faucet 1000 mUSDC** trên thanh công cụ.
2. **Đọc Portfolio & Dữ liệu On-chain:** Quan sát bảng **Holdings** (tỷ giá Chainlink `AVAX/USD` trực tiếp), **Policy Status** (`Max 300 mUSDC/tx`, `2% slippage`) và thẻ **Risk Intelligence** (`ON_CHAIN` / `DETERMINISTIC_MATH` / `ON_CHAIN_VERIFIED`). Bấm nút nhanh **`Read: Portfolio`** trong khung Chat.
3. **Phân tích Rủi ro Danh mục & Aave V3 Fuji:** Bấm nút nhanh **`Risk: Aave & Liquidity`** (hoặc hỏi *"Tính Health Factor nếu thế chấp 10 AVAX vay 30 USD"*). Quan sát AI phân biệt rõ dữ liệu thực trên Aave V3 Fuji (`INSUFFICIENT_DATA` khi nợ = 0) và phép tính giả định (`DETERMINISTIC_MATH`).
4. **Lập Kế hoạch Giao dịch Hợp lệ (`1 mUSDC`):** Bấm nút nhanh **`Write: Swap 1`** (`"Swap 1 mUSDC sang AVAX"`). AI tạo **PlanCard** kèm kết quả kiểm tra `8/8 Deterministic Checks Passed`.
5. **Kiểm tra trên Transaction Guardian & Live Simulation:** Bấm **Tx Guardian Inspector** trên PlanCard:
   - Xem chi tiết loại giao dịch, địa chỉ contract, trạng thái mô phỏng, cảnh báo rủi ro và điều kiện chưa xác minh.
   - Bấm **`1. Exact Approve 1 mUSDC`** và ký trên ví -> Ngay khi xác nhận, hệ thống tự động chạy `eth_call` mô phỏng lại `executeSwap` và chuyển sang **`SIMULATION PASSED`** kèm số **Estimated Gas (`~180,006 units`)** và **Simulated Output (`~0.1405 AVAX`)**!
6. **Thử nghiệm Chặn Giao dịch Vi phạm / Thiếu Thanh khoản:**
   - Bấm **`Guard: 500 Cap`** (`"Swap 500 mUSDC sang AVAX"`) hoặc gõ `"Swap 40 mUSDC sang AVAX"` -> Mở **Tx Guardian Inspector**: quan sát trạng thái **`SIMULATION FAILED` / `BLOCKED`** (`ExceedsMaxTxAmount` hoặc `InsufficientRouterLiquidity`), nút ký bị khóa an toàn mặc định!
7. **Người dùng Ký & Xác nhận Post-Transaction On-chain:** Quay lại kế hoạch hợp lệ `1 mUSDC`, bấm **`Confirm & Sign Swap`**, ký trên ví MetaMask/Core -> Hệ thống đối chiếu `integrityHash`, gửi giao dịch lên Fuji, xác minh Receipt thực tế và cập nhật bảng **Transaction History** kèm liên kết Snowtrace.

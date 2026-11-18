# AGENTVAULT — EXECUTION PHASE 1: P0 STABILIZATION REPORT

> **Ngày thực hiện:** 2026-11-18  
> **Mạng triển khai:** Avalanche Fuji Testnet (`Chain ID: 43113`)  
> **Trạng thái:** **HOÀN THÀNH 100% P0** — Đã kiểm chứng thực tế trên mạng Fuji & dừng lại chờ phê duyệt trước khi sang Phase P1.

---

## 1. Danh sách file đã thay đổi / thêm / xóa

### Smart Contracts (`contracts/`)
- **Chỉnh sửa:** `contracts/contracts/MockDEXRouter.sol` (bổ sung kiểm tra `IncompleteOracleRound` khi `answeredInRound < roundId` hoặc `roundId == 0` và chặn `updatedAt > block.timestamp`).
- **Chỉnh sửa:** `contracts/contracts/MockChainlinkAggregator.sol` & `contracts/test/OracleRouter.test.ts` (thêm test `IncompleteOracleRound`).
- **Thêm mới:** `contracts/scripts/upgrade-router-oracle.ts` (thu hồi thanh khoản Router cũ, deploy Router + Executor mới nối Chainlink Fuji, cập nhật whitelist trên Policy, nạp `0.6 AVAX` thanh khoản, lưu lịch sử rollback).
- **Cập nhật:** `contracts/deployments/fuji.json`.

### Backend (`backend/`)
- **Xóa bỏ (Security Cleanup):**
  - `backend/data/agent-wallet.json` (đã xác minh `0.0 AVAX`, xóa khỏi ổ đĩa & gỡ khỏi Git index).
  - `backend/src/services/agentSigner.service.ts` & `backend/src/services/x402.service.ts` (code mồ côi không sử dụng).
  - Gỡ `backend/data/vault-store.json` khỏi Git index và thêm `backend/data/*.json` vào `.gitignore`.
- **Chỉnh sửa:**
  - `backend/src/services/store.service.ts`: Cô lập `AgentProfile`, `Policy` và `DailyUsage` riêng biệt theo từng địa chỉ ví (`profiles[userAddress]`).
  - `backend/src/routes/api.route.ts`: Bắt buộc xác thực chữ ký ví `EIP-191 (personal_sign)` với cửa sổ thời gian `±5 phút` trên `PUT /api/agent/profile`; tích hợp `getUnifiedDashboardHistory` vào `GET /api/history/:address`.
  - `backend/src/services/portfolio.service.ts`: Thêm `validateChainlinkRound()` kiểm tra đầy đủ `roundId`, `answer > 0`, `updatedAt`, `answeredInRound >= roundId`, `maxAge <= 86400s` với cơ chế fallback minh bạch (`fallbackReason`).
  - `backend/src/services/history.service.ts`: Thêm `deduplicateHistoryRecords()` & `getUnifiedDashboardHistory()` gộp `SwapExecuted` logs và `Avalanche Glacier API`.
  - `backend/src/services/policy.service.ts`, `deterministicPolicy.service.ts`, `allowancePlanner.service.ts`, `agent/toolRegistry.ts`, `agent/orchestrator.ts`, `config/env.ts`, `abi/index.ts`, `backend/.env.example`.

### Frontend (`frontend/` & `README.md`)
- **Chỉnh sửa:**
  - `frontend/src/context/WalletContext.tsx`: Bổ sung `signMessage()` cho xác thực chữ ký ví.
  - `frontend/src/components/config/AgentConfigPanel.tsx`: Ký xác thực chủ sở hữu ví khi lưu Policy hoặc đổi trạng thái Agent.
  - `frontend/src/components/dashboard/HoldingsTable.tsx` & `frontend/src/App.tsx`: Hiển thị trực tiếp tỷ giá Chainlink Router on-chain, số dư thanh khoản pool và cảnh báo fallback (nếu có).
  - `frontend/src/components/agent/ChatPanel.tsx`: Đồng bộ nút bấm nhanh `Write: Swap 1` (`1 mUSDC`) khớp thanh khoản thực tế trên Fuji.
  - `frontend/src/services/api.ts`, `README.md`, `backend/.env`, `frontend/.env`.

---

## 2. Các vấn đề đã giải quyết triệt để

1. **[P0-1] Xóa bỏ hoàn toàn Deployment Drift & Lệch tỷ giá 280x:**
   - `MockDEXRouter` mới trên Fuji đã bật `useOracle = true` đọc trực tiếp Chainlink `AVAX/USD` (`0x5498BB86BC934c8D34FDA08E81D444153d0D06aD`).
   - Giá hiển thị trên Dashboard (`$7.16`) và tỷ giá thực thi của Router on-chain (`7.158 mUSDC/AVAX`) nhất quán tuyệt đối.
2. **[P0-2] Bảo mật Non-custodial & Cô lập đa ví:**
   - Không còn bất kỳ file chứa Private Key nào ở Backend hay trong Git index.
   - Mọi thao tác sửa cấu hình Policy đều yêu cầu chữ ký EIP-191 hợp lệ của chính chủ ví; Ví B không thể sửa Policy của Ví A.
3. **[P0-3] Độ tin cậy dữ liệu Oracle & Lịch sử giao dịch bền vững:**
   - Dữ liệu Chainlink bị lỗi/stale (`answer <= 0`, `updatedAt == 0`, `answeredInRound < roundId`, `age > 24h`) bị từ chối rõ ràng ở cả Smart Contract lẫn Backend.
   - Bảng `Transaction History` trên Dashboard kết hợp cả `SwapExecuted` và **Avalanche Glacier API** (đã deduplicate theo `txHash`), giữ nguyên lịch sử sau khi refresh.

---

## 3. Địa chỉ Smart Contracts hiện hành trên Avalanche Fuji (`43113`)

| Hợp đồng | Địa chỉ trên Avalanche Fuji | Ghi chú |
| :--- | :--- | :--- |
| **`MockERC20 (mUSDC)`** | `0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1` | Giữ nguyên (bảo toàn số dư user) |
| **`AgentVaultPolicy`** | `0x940d6C627C55F002A42eAc257d7A36dbDe4157e7` | Giữ nguyên (đã whitelist Router mới, khóa Router cũ) |
| **`MockDEXRouter` (Mới)** | `0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8` | **Chainlink-backed (`useOracle = true`)**, thanh khoản `~0.46 AVAX` sau test |
| **`AgentVaultExecutor` (Mới)** | `0x927937eC37b343290b22893f90C00E8eE4AE6582` | Nối `AgentVaultPolicy` & `MockDEXRouter` mới |
| **Chainlink `AVAX/USD` Fuji** | `0x5498BB86BC934c8D34FDA08E81D444153d0D06aD` | Official Chainlink Testnet Price Feed |

---

## 4. Bằng chứng Transaction Hashes thực tế trên Fuji

### 4.1. Giao dịch nâng cấp hạ tầng (P0-1)
- **Thu hồi `0.2 AVAX` từ Router cũ:** `0xc0e4e49d7c3dc73bd8d477f6324d862373ba76e19a8dac19b04f11d327f5bfea`
- **Deploy `MockDEXRouter` mới:** `0x6cefd4872a1d2fb484a131c39d0d503612e6be1f39b3012fbfd1b6bcf2362f8d`
- **Deploy `AgentVaultExecutor` mới:** `0x1bb0300e8ba5246c9a577b58efbff5d4ba403fc236d948f7d06c4570d8579213`
- **Cấu hình `setExecutor`:** `0xd207b2b0d6b21c34cda52e383828ad75e2481103a74709362aade2b74048faa4`
- **Bật Chainlink `setPriceFeed`:** `0x574f6f4ca42bf7d605634080a9c5f805a81228a878f17e2190894bdd05d6e685`
- **Whitelist Router mới trên Policy:** `0x9bdc40b83fbd8cdc401b66de73938c1a124b5de7f415e29badeef6995804253c`
- **Gỡ Router cũ khỏi Policy:** `0x4aa035e9daecdeeac5cdbd9ed2198d2fe3632253e537245677f7d6748dd0dee1`
- **Nạp `0.6 AVAX` thanh khoản:** `0xeada38f3ad577163f86928f6695cd045818e695be394134f14401e172eec38b4`

### 4.2. Giao dịch Kiểm thử End-to-End Demo Swap thật (`1 mUSDC -> AVAX`)
- **Faucet `50 mUSDC`:** `0x1ec2f115129e994ed561444d551002ee87786e586368399d0b1c7022c4831388`
- **Exact Approve `1 mUSDC`:** `0xc463b27e8af5b55a8d7ee60f564e667426960aa34ea1a2397afec28159208311`
- **Execute Swap `1 mUSDC -> ~0.1397 AVAX` (Block `#61266039`):** `0xc1cd78ed2d313101ad6e679cf32360c68b2507dbd5c07805552de3a8fe4409d7`
  - *Kết quả đối soát Post-Tx:* Số dư thực tế của ví tăng từ `0.3971 AVAX` lên **`0.5368 AVAX`** (`mUSDC` giảm từ `50.00` xuống `49.00`), tỷ trọng AVAX tăng từ `5.4%` lên `7.3%`.

---

## 5. Kết quả toàn bộ Bộ Kiểm thử Bắt buộc

| Bộ kiểm thử | Lệnh / Phạm vi | Kết quả |
| :--- | :--- | :---: |
| **Smart Contract Unit Tests** | `pnpm --filter contracts test` (bao gồm `IncompleteOracleRound`) | **24 / 24 PASS** |
| **Backend TypeScript Build** | `pnpm --filter backend build` | **PASS (0 errors)** |
| **Topic 13 Bilingual Eval Suite** | `pnpm --filter backend eval` | **30 / 30 PASS (100%)** |
| **Frontend Production Build** | `pnpm --filter frontend build` | **PASS** |
| **Chainlink Stale/Invalid Regression** | Từ chối `answer=0`, `stale > 24h`, `answeredInRound < roundId` | **PASS** |
| **Signature Auth & Multi-Wallet Isolation** | Chặn thiếu chữ ký (`400`), sai ví (`401`), quá hạn (`401`); cô lập 2 ví | **PASS** |
| **Fuji E2E Swap & Unified Glacier History** | Swap `1 mUSDC -> AVAX` thật trên Fuji + đối soát Glacier (`12 records`) | **PASS** |

---

## 6. Những vấn đề còn tồn tại (Thuộc phạm vi P1 / Lưu ý vận hành)
1. **Giới hạn thanh khoản Test AVAX trong `MockDEXRouter`:** Sau giao dịch E2E swap `1 mUSDC` (`~0.14 AVAX`), Router hiện còn **`~0.46 AVAX`** (đủ cho khoảng 3 lần swap `1 mUSDC` nữa). Khi demo trực tiếp nên swap `0.5 – 1 mUSDC` mỗi lần hoặc xin thêm Test AVAX từ faucet nạp vào `0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8`.
2. **Các mục P1 chưa triển khai (theo đúng chỉ thị dừng sau P0):**
   - Chưa thêm `staticCall` pre-execution simulation trong `Tx Guardian` để cảnh báo sớm nếu vượt thanh khoản Router (`0.46 AVAX`).
   - `AAVE_V3_POOL_ADDRESS` vẫn đang để trống tùy chọn; `detectForecastRequest` và `--live` LLM benchmark thuộc nhóm P1.
   - Commit lịch sử Git trước đây (`2120fd4`) từng chứa ví test rỗng `0xb5B5...` (`0 AVAX`); hiện đã gỡ khỏi Git index (`git rm --cached`), không bao giờ sử dụng lại ví đó.

---

## 7. Kế hoạch Rollback (Nếu xảy ra sự cố Oracle Chainlink Fuji)
1. **Phương án 1 (Nhanh nhất — Không đổi địa chỉ Contract):** Nếu Chainlink Fuji Feed tạm ngừng cập nhật quá 24h, `Owner` (`0x305533Ab...`) chỉ cần gọi `newRouter.setPriceFeed(ZeroAddress, false)` trên `0x6ABC46F7D0ECaf22005b9d266B77e7AE9f79B8B8` để chuyển tức thì về `fallbackRateMusdcPerAvax` (`$25/AVAX`) mà không cần sửa `.env` hay redeploy!
2. **Phương án 2 (Rollback về cặp Contract cũ):** Địa chỉ cũ vẫn được lưu nguyên vẹn trong `previousContracts` của `contracts/deployments/fuji.json` (`Router: 0x654309...`, `Executor: 0x808931...`); chỉ cần gọi `policy.setAllowedRouter(oldRouter, true)`, chuyển thanh khoản AVAX sang và đổi lại 2 biến `.env`.

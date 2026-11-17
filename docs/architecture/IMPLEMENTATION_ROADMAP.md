# IMPLEMENTATION ROADMAP – AGENTVAULT

Lộ trình gồm 11 Phase (Phase 0 đến Phase 10), được tối ưu để một team nhỏ (1–3 người) có thể hoàn thành trong **5 ngày** và có thể chạy song song từ Phase 3 trở đi.

---

## PHASE 0 – Workspace Audit & Requirement Lock
- **Mục tiêu:** Chốt phạm vi MVP, công nghệ, kiểm tra công cụ máy phát triển và xác nhận các biến đầu vào còn thiếu.
- **Công việc cụ thể:**
  - Audit workspace hiện tại (`setup.md`, Node v20, pnpm, Git, Docker).
  - Chốt sử dụng `MockDEXRouter` trên Avalanche Fuji cho MVP để đảm bảo demo ổn định 100%.
  - Chốt sử dụng Gemini API cho LLM Function Calling.
- **Files/Folders:** `docs/architecture/*.md` (đã tạo).
- **Dependencies:** Không.
- **Lệnh terminal:** `node -v; pnpm -v; git --version`
- **Env vars:** Chưa cần.
- **Input cần có:** Xác nhận của người dùng về LLM Provider (Gemini API Key) và ví Deployer Fuji Testnet.
- **Output mong đợi:** Bộ 6 tài liệu kiến trúc hoàn chỉnh.
- **Tiêu chí nghiệm thu:** Không còn mơ hồ về kiến trúc, schema hay phạm vi MVP.
- **Test cases:** Review chéo 6 tài liệu.
- **Rủi ro & Xử lý:** Thiếu đường dẫn `EduRefAI` → Đã đánh dấu `UNKNOWN`, tự thiết kế sạch theo best practices.
- **Definition of Done (DoD):** Người dùng duyệt kế hoạch và cho phép bắt đầu Phase 1.

---

## PHASE 1 – Project Setup & Architecture
- **Mục tiêu:** Khởi tạo cấu trúc monorepo (`contracts/`, `backend/`, `frontend/`), Git, `.gitignore`, `.env.example`.
- **Công việc cụ thể:**
  - `git init`, tạo `.gitignore` (chặn `.env`, `node_modules/`, `artifacts/`, `cache/`, `dist/`).
  - Khởi tạo `package.json` cho từng workspace hoặc root pnpm workspace.
  - Tạo `.env.example` cho cả 3 thư mục.
- **Files/Folders:** `.gitignore`, `README.md`, `contracts/package.json`, `backend/package.json`, `frontend/package.json`, `.env.example`.
- **Dependencies:** TypeScript, `tsx`, `eslint` (tối giản).
- **Lệnh terminal:** `git init`, `mkdir contracts backend frontend`
- **Input cần có:** Approval từ Phase 0.
- **Output mong đợi:** Cấu trúc thư mục sạch, chạy được `pnpm -v` và TypeScript compiler.
- **Tiêu chí nghiệm thu:** Build rỗng không lỗi ở cả 3 thư mục.
- **Test cases:** Kiểm tra `git status` không track file nhạy cảm.
- **Rủi ro & Xử lý:** Xung đột version Node/pnpm → Ghim `engines` Node `>=20`.
- **DoD:** Monorepo sẵn sàng cho phát triển song song.

---

## PHASE 2 – Avalanche Fuji Integration
- **Mục tiêu:** Cấu hình kết nối mạng Avalanche Fuji Testnet (Chain ID `43113`) và chuẩn bị ví thử nghiệm có Test AVAX.
- **Công việc cụ thể:**
  - Tạo ví MetaMask/Core riêng cho Deployer và Test User (tuyệt đối không dùng ví có tiền thật).
  - Nhận Test AVAX từ Avalanche Fuji Faucet (`https://core.app/tools/testnet-faucet/`).
  - Cấu hình `fuji` network trong `hardhat.config.ts` và kiểm tra kết nối RPC.
- **Files/Folders:** `contracts/hardhat.config.ts`, `contracts/.env`.
- **Dependencies:** `hardhat`, `@nomicfoundation/hardhat-toolbox`, `dotenv`.
- **Lệnh terminal:** `pnpm --filter contracts install`, `npx hardhat --version`
- **Env vars:** `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY` (chỉ lưu ở `.env` local, không commit).
- **Input cần có:** Ví Testnet có ít nhất 2 Test AVAX (1 AVAX làm thanh khoản MockDEXRouter, 1 AVAX trả gas).
- **Output mong đợi:** Script ping RPC trả về `chainId: 43113` và số dư Deployer > 0.
- **Tiêu chí nghiệm thu:** Kết nối Fuji RPC ổn định.
- **Test cases:** Chạy script check balance trên Fuji thành công.
- **Rủi ro & Xử lý:** Faucet hết hạn mức hoặc RPC chậm → Dùng thêm RPC dự phòng hoặc Core Faucet.
- **DoD:** Deployer sẵn sàng deploy contract lên Fuji.

---

## PHASE 3 – Smart Contracts & Local Testing
- **Mục tiêu:** Viết và unit test toàn bộ 4 Smart Contracts trên Hardhat local network.
- **Công việc cụ thể:**
  - Viết `MockERC20.sol` (`mUSDC`, 6 decimals, có `faucet`).
  - Viết `AgentVaultPolicy.sol` (`maxAmountPerTx = 300e6`, whitelist token/router, slippage, `Pausable`).
  - Viết `MockDEXRouter.sol` (tỷ giá cấu hình, hàm `getAmountOut`, `swapExactTokensForNative`).
  - Viết `AgentVaultExecutor.sol` (`executeSwap` gọi `policy.validateSwap` trước khi swap).
  - Viết unit test bằng TypeScript/Chai cho Scenario A (100 mUSDC pass), Scenario B (500 mUSDC revert `ExceedsMaxTxAmount`), token không hợp lệ, và Emergency Pause.
- **Files/Folders:** `contracts/contracts/*.sol`, `contracts/test/AgentVault.test.ts`.
- **Dependencies:** `@openzeppelin/contracts`.
- **Lệnh terminal:** `npx hardhat compile`, `npx hardhat test`
- **Env vars:** Không cần (chạy local Hardhat network).
- **Input cần có:** Spec Smart Contract từ `TECHNICAL_DESIGN.md`.
- **Output mong đợi:** 100% unit tests pass.
- **Tiêu chí nghiệm thu:** Scenario A thành công, Scenario B revert đúng custom error.
- **Test cases:** Tối thiểu 6 test cases (Valid swap, Exceed max tx, Unwhitelisted token, Paused contract, Insufficient allowance, Faucet mint).
- **Rủi ro & Xử lý:** Lỗi decimals (AVAX 18 decimals vs mUSDC 6 decimals) → Viết test kiểm tra kỹ công thức quy đổi.
- **DoD:** `npx hardhat test` pass toàn bộ, không có warning nghiêm trọng.

---

## PHASE 4 – Deploy Contracts to Fuji
- **Mục tiêu:** Deploy 4 contracts lên Avalanche Fuji, cấu hình policy/whitelist và nạp thanh khoản AVAX cho `MockDEXRouter`.
- **Công việc cụ thể:**
  - Viết script `scripts/deploy.ts`: deploy `MockERC20`, `AgentVaultPolicy`, `MockDEXRouter`, `AgentVaultExecutor`.
  - Cấu hình `AgentVaultPolicy`: whitelist `mUSDC`, `address(0)` (AVAX), `MockDEXRouter`, set `maxAmountPerTx = 300 * 10^6`.
  - Gửi 1 Test AVAX vào `MockDEXRouter` để phục vụ swap.
  - Export ABI sang `backend/src/abi/` và `frontend/src/abi/`.
- **Files/Folders:** `contracts/scripts/deploy.ts`, `contracts/deployments/fuji.json`.
- **Dependencies:** Đã cài ở Phase 3.
- **Lệnh terminal:** `npx hardhat run scripts/deploy.ts --network fuji`
- **Env vars:** `FUJI_RPC_URL`, `DEPLOYER_PRIVATE_KEY`.
- **Input cần có:** Test AVAX trong ví Deployer.
- **Output mong đợi:** 4 địa chỉ contract hoạt động trên Fuji Explorer (`https://testnet.snowtrace.io`).
- **Tiêu chí nghiệm thu:** Chạy 1 giao dịch test swap 10 mUSDC trên Fuji thành công.
- **Test cases:** Verify contract state qua script đọc `maxAmountPerTx()` và `getAmountOut()`.
- **Rủi ro & Xử lý:** Gas estimation lỗi khi deploy → Set gas limit thủ công nếu cần.
- **DoD:** Có file `fuji.json` chứa đủ 4 contract addresses và ABI đã sync.

---

## PHASE 5 – Backend & Blockchain Integration *(Có thể chạy song song với Phase 7 sau khi có ABI)*
- **Mục tiêu:** Xây dựng Express API Gateway và các service đọc dữ liệu Fuji + build unsigned transaction.
- **Công việc cụ thể:**
  - Setup Express + CORS + `zod` + `dotenv`.
  - Viết `BlockchainService` (kết nối Fuji RPC, timeout/retry).
  - Viết `PortfolioService` (đọc balance AVAX & mUSDC của user).
  - Viết `PolicyService` (đọc rules từ `AgentVaultPolicy`, chạy `staticCall` pre-check).
  - Viết `SwapPlannerService` (tính `estimatedOut`, check `allowance`, tạo `approveTx` và `swapTx` unsigned).
- **Files/Folders:** `backend/src/services/*.ts`, `backend/src/routes/*.ts`, `backend/src/index.ts`.
- **Dependencies:** `express`, `cors`, `ethers`, `zod`, `dotenv`.
- **Lệnh terminal:** `pnpm --filter backend dev`
- **Env vars:** `PORT`, `FUJI_RPC_URL`, `MUSDC_ADDRESS`, `POLICY_ADDRESS`, `ROUTER_ADDRESS`, `EXECUTOR_ADDRESS`.
- **Input cần có:** Địa chỉ contract và ABI từ Phase 4.
- **Output mong đợi:** Các endpoint `/api/health`, `/api/portfolio/:address`, `/api/policy`, `/api/tx/prepare` hoạt động.
- **Tiêu chí nghiệm thu:** Postman/curl test trả về đúng số dư thật trên Fuji và calldata hợp lệ.
- **Test cases:** Test `/api/tx/prepare` với 100 mUSDC (valid) và 500 mUSDC (pre-check báo vượt hạn mức).
- **Rủi ro & Xử lý:** RPC timeout → Thêm `Promise.race` timeout 10s và thông báo lỗi rõ ràng.
- **DoD:** Backend build sạch `tsc --noEmit` và API trả JSON đúng schema.

---

## PHASE 6 – AI Agent & Tool Calling
- **Mục tiêu:** Tích hợp Gemini Function Calling để AI hiểu ngôn ngữ tự nhiên, gọi Tool Registry và trả về Swap Plan.
- **Công việc cụ thể:**
  - Cài `@google/generative-ai`.
  - Xây dựng `ToolRegistry` với 3 tools: `get_portfolio`, `get_policy_rules`, `plan_swap`.
  - Xây dựng `AgentOrchestrator` xử lý vòng lặp multi-turn tool calling (tối đa 5 bước lặp tránh loop vô hạn).
  - Expose endpoint `POST /api/agent/chat`.
- **Files/Folders:** `backend/src/agent/*.ts`, `backend/src/routes/agent.route.ts`.
- **Dependencies:** `@google/generative-ai`.
- **Lệnh terminal:** `pnpm --filter backend test`
- **Env vars:** `GEMINI_API_KEY`, `GEMINI_MODEL` (mặc định `gemini-2.5-flash`).
- **Input cần có:** Gemini API Key từ người dùng.
- **Output mong đợi:** Gửi câu *"Tôi muốn đổi 100 USDC sang AVAX"* → AI gọi `get_portfolio` + `plan_swap` → trả về giải thích + `swapPlan` + `unsignedTxs`.
- **Tiêu chí nghiệm thu:** Xử lý chính xác cả Scenario A (100 USDC) và Scenario B (500 USDC).
- **Test cases:** Unit test Tool Registry với `zod`; Integration test prompt tiếng Việt và tiếng Anh.
- **Rủi ro & Xử lý:** LLM gọi sai tên token hoặc số âm → Zod chặn và trả về message hướng dẫn LLM sửa lại.
- **DoD:** Chat API hoạt động ổn định, không crash khi LLM trả text thuần hoặc tool call.

---

## PHASE 7 – Frontend & Dashboard *(Có thể làm khung UI song song từ Phase 3)*
- **Mục tiêu:** Xây dựng giao diện Dashboard, Wallet Connect, AI Chat, Transaction Preview và Lịch sử giao dịch.
- **Công việc cụ thể:**
  - Setup Vite + React + TypeScript + TailwindCSS (Dark Mode theo ảnh mẫu).
  - Xây dựng `WalletContext` kết nối MetaMask/Core Wallet, auto switch sang Fuji (`43113`).
  - Xây dựng Dashboard: Asset Allocation chart, Holdings Table, Policy Status Card, nút Faucet `mUSDC`.
  - Xây dựng `ChatPanel` và `TxPreviewModal` (hiển thị nút `Approve mUSDC` nếu cần, sau đó nút `Confirm & Sign Swap`).
- **Files/Folders:** `frontend/src/**/*`.
- **Dependencies:** `ethers`, `lucide-react`, `tailwindcss`.
- **Lệnh terminal:** `pnpm --filter frontend dev`
- **Env vars:** `VITE_API_BASE_URL`, `VITE_CHAIN_ID=43113`, `VITE_EXPLORER_URL`.
- **Input cần có:** Backend API spec từ Phase 5–6.
- **Output mong đợi:** Giao diện hoàn chỉnh, responsive, không có mock data cứng ở phần số dư.
- **Tiêu chí nghiệm thu:** Connect ví thật, bấm Faucet nhận được `mUSDC` trên Fuji.
- **Test cases:** Connect/disconnect wallet, switch network, render chat & preview modal.
- **Rủi ro & Xử lý:** User chưa có mạng Fuji trong MetaMask → Dùng `wallet_addEthereumChain` tự động thêm mạng.
- **DoD:** `pnpm --filter frontend build` thành công không lỗi TypeScript.

---

## PHASE 8 – End-to-End Integration
- **Mục tiêu:** Nối thông toàn bộ luồng Frontend ↔ Backend ↔ AI Agent ↔ Avalanche Fuji Smart Contracts.
- **Công việc cụ thể:**
  - Chạy thực tế Scenario A (100 mUSDC → AVAX): Chat → Preview → Approve → Sign Swap → Receipt → Explorer link → Portfolio tự cập nhật.
  - Chạy thực tế Scenario B (500 mUSDC → AVAX): Chat → Cảnh báo Policy Violation → (Tùy chọn) Test gửi on-chain để chứng minh Smart Contract revert → UI hiển thị lỗi rõ ràng.
- **Files/Folders:** Chỉnh sửa bug phát sinh tại `frontend/` và `backend/`.
- **Lệnh terminal:** Chạy đồng thời backend và frontend.
- **Tiêu chí nghiệm thu:** Có ít nhất 2 Transaction Hash thực tế trên `testnet.snowtrace.io` (1 Success, 1 Reverted hoặc Policy Blocked).
- **DoD:** Toàn bộ 10 Core Features trong MVP scope hoạt động trơn tru.

---

## PHASE 9 – Testing, Security Checks & Bug Fixing
- **Mục tiêu:** Kiểm tra bảo mật cơ bản, edge cases và viết automated tests cho các luồng quan trọng.
- **Công việc cụ thể:**
  - Kiểm tra không có private key/API key nào bị lộ trong code hoặc git history.
  - Test edge cases: User reject giao dịch trên ví, RPC chậm, số dư `mUSDC` không đủ, nhập lệnh không liên quan đến DeFi.
  - Chạy lại toàn bộ unit test `contracts` và `backend`.
- **Lệnh terminal:** `npx hardhat test`, `pnpm --filter backend test`, `pnpm --filter frontend build`.
- **DoD:** Tất cả test pass, không còn bug blocker cho demo.

---

## PHASE 10 – Docker, Deployment & Demo Preparation
- **Mục tiêu:** Đóng gói dễ chạy (README + Docker Compose tùy chọn), quay video demo và chuẩn bị bài thuyết trình hackathon.
- **Công việc cụ thể:**
  - Hoàn thiện `README.md` với hướng dẫn setup từng bước.
  - Tạo `docker-compose.yml` cho `backend` và `frontend` (chỉ thêm nếu chạy ổn định trên máy; ưu tiên chạy local dev mượt cho demo trực tiếp).
  - Quay video backup cho Scenario A & Scenario B kèm ảnh chụp màn hình Fuji Explorer.
- **DoD:** Repo sạch, chạy được từ fresh clone theo `README.md`, có video demo dự phòng.

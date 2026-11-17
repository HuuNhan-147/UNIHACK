# TASK BREAKDOWN – 5-DAY EXECUTION PLAN

## Phân loại ưu tiên (MoSCoW)
- **MUST HAVE:** Bắt buộc phải có để demo Scenario A & B trên Avalanche Fuji.
- **SHOULD HAVE:** Nên có để tăng trải nghiệm & điểm chấm hackathon (có thể cắt nếu trễ tiến độ).
- **NICE TO HAVE:** Chỉ làm khi đã xong hết MUST & SHOULD.

---

## DAY 1: Setup, Architecture, Contract Design & Fuji Connectivity

| ID | Task | Priority | Phụ thuộc | Song song | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D1-T1 | Chốt input từ User (Gemini API Key, Test Wallet) | MUST HAVE | - | - | Thông tin env sẵn sàng |
| D1-T2 | Khởi tạo Monorepo (`contracts/`, `backend/`, `frontend/`), `.gitignore`, `.env.example` | MUST HAVE | D1-T1 | - | Cấu trúc repo sạch |
| D1-T3 | Setup Hardhat + OpenZeppelin trong `contracts/`, cấu hình Fuji RPC | MUST HAVE | D1-T2 | D1-T4 | `hardhat.config.ts` |
| D1-T4 | Khởi tạo khung Backend Express + TS và Frontend Vite + React + Tailwind | MUST HAVE | D1-T2 | D1-T3 | App chạy hello world |
| D1-T5 | Nhận Test AVAX từ Faucet và kiểm tra kết nối Fuji (Chain ID 43113) | MUST HAVE | D1-T3 | D1-T4 | Balance > 0 trên Fuji |

- **Checkpoint cuối Day 1:** Monorepo hoàn chỉnh, Hardhat kết nối được Fuji RPC, Frontend & Backend khởi động được.
- **Có thể cắt nếu trễ:** Cấu hình ESLint/Prettier nâng cao.

---

## DAY 2: Smart Contracts, Local Testing & Fuji Deployment

| ID | Task | Priority | Phụ thuộc | Song song | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D2-T1 | Viết `MockERC20.sol` (`mUSDC`, 6 decimals, có `faucet`) | MUST HAVE | D1-T3 | D2-T2 | `MockERC20.sol` |
| D2-T2 | Viết `AgentVaultPolicy.sol` (`maxAmountPerTx`, whitelist, `Pausable`) | MUST HAVE | D1-T3 | D2-T1 | `AgentVaultPolicy.sol` |
| D2-T3 | Viết `MockDEXRouter.sol` & `AgentVaultExecutor.sol` | MUST HAVE | D2-T1, D2-T2 | - | 2 file `.sol` |
| D2-T4 | Viết & chạy Unit Tests (Scenario A pass, Scenario B revert) | MUST HAVE | D2-T3 | D2-T5 | `AgentVault.test.ts` pass 100% |
| D2-T5 | Xây dựng khung UI Dashboard (Dark mode, Sidebar, WalletContext) | SHOULD HAVE | D1-T4 | D2-T4 | UI khung chưa nối API |
| D2-T6 | Deploy 4 contracts lên Fuji, nạp 1 AVAX vào Router, export ABI | MUST HAVE | D2-T4, D1-T5 | - | `deployments/fuji.json` + ABI |

- **Checkpoint cuối Day 2:** Có 4 contract addresses thật trên `testnet.snowtrace.io`, test swap thành công bằng script.
- **Có thể cắt nếu trễ:** Chức năng `dailyLimit` phức tạp trong Policy (chỉ giữ `maxAmountPerTx` + whitelist + `Pausable`).

---

## DAY 3: Backend, Blockchain Service & AI Agent

| ID | Task | Priority | Phụ thuộc | Song song | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D3-T1 | Viết `BlockchainService`, `PortfolioService`, `PolicyService` | MUST HAVE | D2-T6 | D3-T4 | API `/portfolio`, `/policy` |
| D3-T2 | Viết `SwapPlannerService` (tính output, check allowance, build unsigned tx) | MUST HAVE | D3-T1 | D3-T4 | API `/tx/prepare` |
| D3-T3 | Tích hợp Gemini Function Calling + `ToolRegistry` (`zod` validation) | MUST HAVE | D3-T2 | D3-T4 | API `/agent/chat` |
| D3-T4 | Hoàn thiện UI Dashboard (Asset Allocation, Holdings, Policy Card, Faucet button) | MUST HAVE | D2-T5, D2-T6 | D3-T1..T3 | Dashboard đọc số dư thật |

- **Checkpoint cuối Day 3:** Gọi `POST /api/agent/chat` với câu *"Swap 100 USDC sang AVAX"* trả về JSON chứa `swapPlan` và `unsignedTxs`; gửi *"Swap 500 USDC sang AVAX"* trả về cảnh báo vi phạm policy.
- **Có thể cắt nếu trễ:** Biểu đồ lịch sử giá/biến động 24h (dùng giá tham chiếu cố định cho MVP).

---

## DAY 4: Frontend Integration & End-to-End Flow

| ID | Task | Priority | Phụ thuộc | Song song | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D4-T1 | Xây dựng `ChatPanel` và `TxPreviewModal` (Approve + Confirm Swap) | MUST HAVE | D3-T3, D3-T4 | - | Giao diện chat & ký ví |
| D4-T2 | Tích hợp ký ví MetaMask/Core + decode Custom Error từ Smart Contract | MUST HAVE | D4-T1 | - | Tx thật chạy từ UI |
| D4-T3 | Xây dựng `TxHistoryTable` (lưu lịch sử session + link Fuji Explorer) | SHOULD HAVE | D4-T2 | - | Bảng lịch sử giao dịch |
| D4-T4 | Test End-to-End Scenario A (100 mUSDC) & Scenario B (500 mUSDC) | MUST HAVE | D4-T2 | - | 2 kịch bản chạy thông suốt |

- **Checkpoint cuối Day 4:** Demo End-to-End hoạt động hoàn chỉnh từ UI → AI → Ví → Fuji Explorer → Cập nhật Portfolio.
- **Có thể cắt nếu trễ:** Nút chuyển đổi giao diện đa ngôn ngữ, trang Future Value/Net Worth phụ.

---

## DAY 5: Bug Fixing, Security Checks, Deployment & Demo Prep

| ID | Task | Priority | Phụ thuộc | Song song | Deliverables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| D5-T1 | Security audit nhanh (check `.env`, không lộ key, input validation) | MUST HAVE | D4-T4 | - | Checklist bảo mật đạt |
| D5-T2 | Fix bug UX (loading state, toast thông báo, user reject handling) | MUST HAVE | D4-T4 | - | UI mượt mà |
| D5-T3 | Viết `README.md` hoàn chỉnh + `docker-compose.yml` (nếu cần) | SHOULD HAVE | D5-T2 | D5-T4 | Tài liệu chạy project |
| D5-T4 | Quay video demo Scenario A & B + lưu bằng chứng Tx Hash trên Explorer | MUST HAVE | D5-T2 | D5-T3 | Video demo + Slide |

- **Checkpoint cuối Day 5:** Sẵn sàng nộp bài và live demo.
- **Có thể cắt nếu trễ:** `docker-compose.yml` (chạy trực tiếp bằng `pnpm dev` khi demo nếu Docker gặp vấn đề phân quyền trên Windows).

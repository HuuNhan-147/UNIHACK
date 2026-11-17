# TECHNICAL DESIGN – AGENTVAULT

---

## 1. Frontend Architecture

### 1.1. Tech Stack đề xuất
- **Framework:** React 18 + Vite + TypeScript (nhẹ, build nhanh, không phát sinh phức tạp SSR như Next.js cho dApp 5 ngày).
- **Styling:** TailwindCSS + Lucide React icons (tái hiện giao diện Dark Mode theo ảnh tham khảo: `#0B0E14` background, card `#131722`, accent `#3B82F6` / `#10B981` / `#EF4444`).
- **Web3 Client:** `ethers` v6 (`BrowserProvider`) kết hợp React `WalletContext` hỗ trợ MetaMask / Core Wallet (tự động nhắc chuyển mạng sang Avalanche Fuji `0xa869` / `43113`).

### 1.2. Cấu trúc thư mục Frontend (`frontend/src/`)
```text
src/
├── context/
│   └── WalletContext.tsx      # Quản lý address, chainId, signer, connect/disconnect, switchToFuji
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Navigation: Dashboard, AI Agent, Policy, History
│   │   └── Header.tsx         # Wallet Connect Button, Network Badge (Fuji 43113), Faucet mUSDC button
│   ├── dashboard/
│   │   ├── AssetAllocation.tsx # Biểu đồ phân bổ AVAX vs mUSDC
│   │   ├── HoldingsTable.tsx   # Bảng số dư, giá quy đổi USD giả lập, tỷ trọng %
│   │   └── PolicyStatusCard.tsx# Hiển thị Max Tx Limit (300 mUSDC), Whitelist, Trạng thái Active/Paused
│   ├── agent/
│   │   ├── ChatPanel.tsx       # Giao diện nhập lệnh ngôn ngữ tự nhiên & lịch sử hội thoại
│   │   └── TxPreviewModal.tsx  # Hiển thị Swap Plan, Policy Pre-check, nút Approve mUSDC & Confirm Swap
│   └── history/
│       └── TxHistoryTable.tsx  # Danh sách Tx Hash, trạng thái (Success/Reverted), link testnet.snowtrace.io
├── services/
│   └── api.ts                 # Axios/Fetch client gọi Backend API
└── App.tsx
```

---

## 2. Backend Architecture

### 2.1. Tech Stack đề xuất
- **Runtime:** Node.js v20 + TypeScript + Express.
- **Validation:** `zod` (validate toàn bộ HTTP body và tham số Tool Calling từ LLM).
- **Blockchain:** `ethers` v6 (`JsonRpcProvider` kết nối `https://api.avax-test.network/ext/bc/C/rpc`).
- **LLM SDK:** `@google/generative-ai` (theo định hướng `setup.md` dùng Gemini Function Calling; thiết kế qua interface `ILLMProvider` để dễ đổi sang OpenAI nếu cần).
- **Storage:** In-memory `Map` cho session chat và transaction history cache (kèm đọc sự kiện on-chain nếu cần). Không dùng Redis/PostgreSQL trong MVP.

### 2.2. Cấu trúc thư mục Backend (`backend/src/`)
```text
src/
├── config/
│   └── env.ts                 # Load & validate .env bằng zod (RPC_URL, CONTRACT_ADDRESSES, GEMINI_API_KEY)
├── routes/
│   ├── health.route.ts        # GET /api/health
│   ├── portfolio.route.ts     # GET /api/portfolio/:address
│   ├── policy.route.ts        # GET /api/policy
│   ├── agent.route.ts         # POST /api/agent/chat
│   └── tx.route.ts            # POST /api/tx/prepare & POST /api/tx/track
├── agent/
│   ├── orchestrator.ts        # Vòng lặp nhận prompt -> gọi LLM -> thực thi tool -> trả kết quả
│   ├── llmAdapter.ts          # Adapter cho Gemini Function Calling
│   └── toolRegistry.ts        # Định nghĩa schema & handler cho các tools
├── services/
│   ├── blockchain.service.ts  # Khởi tạo Provider, Contract instances (read-only), xử lý RPC retry/timeout
│   ├── portfolio.service.ts   # Đọc balance AVAX & mUSDC, tính tỷ trọng %
│   ├── policy.service.ts      # Đọc rules từ AgentVaultPolicy & chạy staticCall mô phỏng
│   └── swapPlanner.service.ts # Tạo unsigned transaction calldata (approve + executeSwap)
└── index.ts
```

---

## 3. AI Agent Workflow & Tool Calling

### 3.1. Luồng xử lý End-to-End
```text
User Request ("Swap 100 USDC sang AVAX")
  → Intent Understanding (LLM phân tích ý định, tokenIn, tokenOut, amount)
  → Tool Calling: get_portfolio(userAddress)
  → Tool Calling: get_policy_rules()
  → Tool Calling: plan_swap(userAddress, tokenIn, tokenOut, amountIn)
      ↳ Policy Pre-check (kiểm tra maxAmountPerTx, whitelist, số dư, staticCall)
      ↳ Build Unsigned Transaction (to, data, value, needsApproval)
  → Trả về JSON cho Frontend: { message, swapPlan, policyCheck, unsignedTxs }
  → Transaction Preview trên UI
  → User Approval & Wallet Signature (MetaMask / Core)
  → On-chain Execution trên Avalanche Fuji
  → Transaction Receipt (Tx Hash / Revert Reason)
  → Portfolio Refresh
```

### 3.2. Danh sách Tools trong Tool Registry

| Tool Name | Loại | Input Schema (Zod) | Output | Side Effect |
| :--- | :--- | :--- | :--- | :--- |
| `get_portfolio` | Read-only | `{ address: string }` | `{ avaxBalance, musdcBalance, totalUsdValue, allocation }` | Không |
| `get_policy_rules` | Read-only | `{}` | `{ maxAmountPerTx, maxSlippageBps, paused, allowedTokens }` | Không |
| `plan_swap` | Read-only + Tx Builder | `{ userAddress: string, tokenIn: "mUSDC" \| "AVAX", tokenOut: "AVAX" \| "mUSDC", amountIn: number }` | `{ valid, reason?, estimatedOut, needsApproval, approveTx?, swapTx? }` | **Không** (chỉ trả về unsigned calldata, không broadcast) |

### 3.3. Cơ chế chống LLM sai lệch & bảo mật AI
1. **Strict Zod Schema:** Mọi tham số từ LLM Function Calling đều phải qua `zod.parse()`. Nếu `amountIn <= 0` hoặc token không thuộc enum `["mUSDC", "AVAX"]`, Tool Registry từ chối ngay.
2. **Backend Deterministic Builder:** LLM **không bao giờ** tự sinh địa chỉ contract, ABI hay calldata hex. LLM chỉ xuất tham số nghiệp vụ (`tokenIn`, `tokenOut`, `amountIn`), còn `SwapPlannerService` dùng địa chỉ contract cấu hình cứng trong `.env` để encode calldata.
3. **Zero Private Key:** Backend không có private key của người dùng. Ngay cả khi LLM bị prompt injection yêu cầu chuyển tiền hoặc swap vượt hạn mức, người dùng vẫn thấy trên Transaction Preview và Smart Contract vẫn chặn on-chain.

---

## 4. Smart Contract Architecture

### 4.1. Sơ đồ quan hệ Contract
- `MockERC20.sol` (`mUSDC`, 6 decimals): Kế thừa OpenZeppelin `ERC20`. Có hàm `faucet(uint256 amount)` (giới hạn ví dụ tối đa 1000 mUSDC/lần) để người dùng/giám khảo tự lấy token test.
- `AgentVaultPolicy.sol`: Kế thừa `Ownable`, `Pausable`.
  - State:
    - `uint256 public maxAmountPerTx` (khởi tạo: `300 * 10**6`, tức 300 mUSDC).
    - `uint256 public maxSlippageBps` (khởi tạo: `200`, tức 2%).
    - `mapping(address => bool) public allowedTokens` (`mUSDC`, `address(0)` đại diện cho native AVAX).
    - `mapping(address => bool) public allowedRouters`.
  - Custom Errors:
    - `error ExceedsMaxTxAmount(uint256 requested, uint256 maxAllowed);`
    - `error TokenNotAllowed(address token);`
    - `error RouterNotAllowed(address router);`
    - `error SlippageTooHigh(uint256 requestedBps, uint256 maxBps);`
  - Function: `validateSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 slippageBps, address router) external view whenNotPaused`
- `MockDEXRouter.sol`:
  - Lưu tỷ giá cố định có thể cấu hình bởi Owner (ví dụ `1 AVAX = 25 mUSDC`).
  - Nhận `mUSDC` và trả `AVAX` từ quỹ thanh khoản được nạp sẵn khi deploy (nạp 1–2 test AVAX vào MockDEXRouter).
  - Hàm `getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)`
  - Hàm `swapExactTokensForNative(address tokenIn, uint256 amountIn, uint256 minAmountOut, address recipient) external returns (uint256 amountOut)`
- `AgentVaultExecutor.sol`: Kế thừa `Ownable`, `ReentrancyGuard`, `Pausable`.
  - Tham chiếu immutable tới `AgentVaultPolicy` và `MockDEXRouter`.
  - Hàm chính: `executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 slippageBps) external nonReentrant whenNotPaused`
    1. Gọi `policy.validateSwap(tokenIn, tokenOut, amountIn, slippageBps, address(router))` → Revert ngay nếu vi phạm (ví dụ 500 mUSDC > 300 mUSDC).
    2. `IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)`.
    3. `IERC20(tokenIn).approve(address(router), amountIn)`.
    4. Gọi `router.swapExactTokensForNative(tokenIn, amountIn, minAmountOut, msg.sender)`.
    5. Emit event `SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, block.timestamp)`.

---

## 5. Security Boundaries (Ranh giới bảo mật)

| Lớp | Ai kiểm soát? | Có thể làm gì? | Không thể làm gì? |
| :--- | :--- | :--- | :--- |
| **AI Agent (LLM)** | Backend | Đọc số dư, đọc policy, đề xuất swap plan. | Không tạo calldata thô, không sửa policy, không ký tx. |
| **Backend API** | Server | Encode calldata chuẩn, chạy `staticCall` pre-check. | Không giữ private key của user, không tự gửi tx tiêu tiền của user. |
| **Isolated Signer** | User (MetaMask/Core) | Xem preview, đồng ý hoặc từ chối ký giao dịch. | — |
| **Smart Contract** | Blockchain (Fuji) | Thực thi chuyển token & swap **chỉ khi** `AgentVaultPolicy` hợp lệ và có chữ ký của chính `msg.sender`. | Không thể bị bypass bởi Backend hay AI. |

### Cơ chế xử lý lỗi RPC & Timeout
- Backend `BlockchainService` cấu hình timeout cho RPC calls (ví dụ `10000ms`), có fallback hoặc retry 2 lần với exponential backoff khi `https://api.avax-test.network/ext/bc/C/rpc` bị rate-limit.
- Frontend xử lý các mã lỗi ví phổ biến: `ACTION_REJECTED` (user bấm Reject trên MetaMask), `INSUFFICIENT_FUNDS` (thiếu AVAX trả gas), và decode **Custom Error** từ Smart Contract (ví dụ `ExceedsMaxTxAmount`) để hiển thị thông báo tiếng Việt/Anh dễ hiểu trên UI.

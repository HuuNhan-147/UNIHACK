# NỘI DUNG CHI TIẾT 8 SLIDES THUYẾT TRÌNH — AGENTVAULT (CANVA / GOOGLE SLIDES)

> **Phong cách thiết kế gợi ý (theo chuẩn slide *Senpai* của BGK):** Nền tối (`#0B0E14`), chữ trắng to rõ, điểm nhấn màu Đỏ Avalanche (`#E84142`) và Xanh dương (`#3B82F6`), tối giản chữ — ưu tiên sơ đồ 3 cột và số liệu định lượng.

---

### SLIDE 1 — COVER & 1-SENTENCE PITCH
- **Tiêu đề lớn:** **AGENTVAULT**
- **Phụ đề đỏ:** *Non-Custodial AI DeFi & Risk Copilot on Avalanche*
- **Câu định vị (1 câu duy nhất):**
  > *"AgentVault giúp người dùng DeFi thao tác trên Avalanche bằng ngôn ngữ tự nhiên — AI đề xuất và phân tích rủi ro thật, Smart Contract khóa trần giao dịch, và người dùng giữ toàn quyền ký."*
- **Footer:** Avalanche Team1 Vietnam UniHack · Topic #13: DeFi Copilot · Avalanche Fuji (`43113`)

---

### SLIDE 2 — THE PROBLEM (NỖI ĐAU THỰC TẾ)
- **Tiêu đề:** **AI x DeFi: Giữa Tiện Lợi và Rủi Ro Mất Tiền**
- **2 cột đối xứng:**
  - **Cột trái — Người dùng DeFi tự thao tác:**
    - Phải tự đọc contract, tính trượt giá, kiểm tra allowance và Health Factor.
    - Dễ ký nhầm **Unlimited Approval** hoặc giao dịch revert mất phí gas.
  - **Cột phải — Giao ví cho AI Agent tự động:**
    - Nếu AI ảo giác hoặc dính **Prompt Injection**, hacker có thể rút sạch ví (*drain wallet*).
    - Thiếu minh bạch: AI tự bịa APY, tự dự đoán giá, ký mù không mô phỏng trước.

---

### SLIDE 3 — SOLUTION & 3-COLUMN ARCHITECTURE *(Phong cách 3 cột như slide Senpai)*
- **Tiêu đề:** **HOW AGENTVAULT WORKS. SECURITY RUNS ON AVALANCHE.**
- **Sơ đồ 3 cột ngang:**
  - **CỘT 1: USER WALLET (Browser)**
    - MetaMask / Core Wallet (giữ 100% Private Key).
    - Ký **EIP-191** cập nhật Policy riêng cho ví.
    - Đối chiếu **`keccak256` Integrity Hash** trước khi ký.
  - **CỘT 2: AGENTVAULT COPILOT & TX GUARDIAN (Server)**
    - **Zero-Trust Intent Guard** (chặn Prompt Injection `< 50ms`).
    - **Gemini Function Calling** (7 Read Tools + 3 Write Tools).
    - **Live EVM Simulator (`eth_call` + `estimateGas`)** với đúng địa chỉ `from` của user.
  - **CỘT 3: AVALANCHE FUJI C-CHAIN (`43113`)**
    - **`AgentVaultPolicy.sol`:** Khóa trần `300 mUSDC/tx`, `2% slippage`, whitelist.
    - **`AgentVaultExecutor.sol`:** Entrypoint `ReentrancyGuard` + `minAmountOut`.
    - **`Chainlink AVAX/USD` + `Aave V3 Fuji` + `Glacier API`**.

---

### SLIDE 4 — AVALANCHE INTEGRATION (25/100 ĐIỂM)
- **Tiêu đề:** **Tích hợp Sâu Hệ Sinh Thái Avalanche Fuji**
- **4 khối nổi bật:**
  1. **4 Verified Smart Contracts trên Snowtrace/Routescan:** `MockERC20`, `AgentVaultPolicy`, `MockDEXRouter`, `AgentVaultExecutor`.
  2. **Chainlink `AVAX/USD` Price Feed (`0x5498...06aD`):** Đồng bộ 100% tỷ giá từ Smart Contract Router lên Dashboard & AI, kiểm tra stale round.
  3. **Verified Aave V3 Fuji Pool (`0xccEa5C...1283`):** Xác minh bytecode trực tiếp qua RPC (`8` active reserves), đọc `getUserAccountData` thực tế.
  4. **Avalanche Glacier API + Core Wallet:** Truy xuất & deduplicate lịch sử giao dịch thật trên C-Chain.

---

### SLIDE 5 — TECHNICAL DEPTH: 4-LAYER DEFENSE & RISK INTELLIGENCE (25/100 ĐIỂM)
- **Tiêu đề:** **Kiến trúc Phòng Thủ 4 Lớp & Dữ liệu Không Ảo Giác**
- **Bên trái (4 Lớp Bảo vệ):**
  1. **Pre-LLM Guard:** Chặn injection, đòi private key, lộ System Prompt, hỏi giá tương lai.
  2. **Deterministic Policy:** Giới hạn ngày, per-swap cap, whitelist.
  3. **Live `eth_call` Simulation:** Phân loại `SIMULATION PASSED / FAILED / UNAVAILABLE`, tự mô phỏng lại sau bước Approve.
  4. **Client Integrity Hash:** `keccak256(chainId:to:data:value)` khóa chặt calldata đã mô phỏng.
- **Bên phải (Data Provenance):**
  - Mọi chỉ số rủi ro đều gắn nhãn: `ON_CHAIN` · `EXTERNAL_API` · `DETERMINISTIC_MATH` · `INSUFFICIENT_DATA` (tuyệt đối không bịa số).

---

### SLIDE 6 — QUANTITATIVE VERIFICATION & BENCHMARK
- **Tiêu đề:** **Kiểm Chứng Thực Tế Bằng Số Liệu**
- **4 con số lớn (Big Numbers):**
  - **`40 / 40 (100%)`** — Live Gemini + Fuji RPC Evaluation (`100% Tool Selection`, `0% Hallucination`).
  - **`100 / 100`** — Red-Team & QA Test Cases (`0/100` lỗi bảo mật & rò rỉ System Prompt).
  - **`11 / 11`** — Edge Cases & State-Drift Simulation trên Fuji (bao gồm thu hồi allowance làm đổi trạng thái simulation).
  - **`18 / 18`** — Hardhat Smart Contract Unit Tests PASS.

---

### SLIDE 7 — LIVE DEMO FLOW & VERIFIED CONTRACT LINKS
- **Tiêu đề:** **One Complete Flow That Works**
- **Luồng 4 bước ngắn:**
  1. **Inspect Risk:** Hỏi AI số dư Chainlink, Allowance Exposure, Aave V3 Position (`INSUFFICIENT_DATA` khi 0 nợ).
  2. **Guardrail Block:** Thử `500 mUSDC` hoặc Prompt Injection → Bị chặn `BLOCKED` / `ExceedsMaxTxAmount`.
  3. **Live Simulation:** Lập plan `1 mUSDC` → Ký Exact Approve → `eth_call` chuyển `SIMULATION PASSED` (`~180,006 gas`).
  4. **On-chain Execution:** Ký Swap → Xem Tx Hash thật trên Snowtrace.
- **Chèn QR Code / Link:** Live App (Vercel) + GitHub Repo + Verified Snowtrace Contracts.

---

### SLIDE 8 — ROADMAP & BUSINESS MODEL
- **Tiêu đề:** **Từ Testnet MVP Đến Sản Phẩm Thương Mại**
- **3 chặng phát triển:**
  - **Phase 3 (Mainnet Launch):** Kết nối trực tiếp DEX Aggregator trên Avalanche C-Chain (Trader Joe / LFJ), thay JSON store bằng PostgreSQL.
  - **Multi-Protocol Guard:** Hỗ trợ lập kế hoạch Supply/Repay an toàn trên Aave V3 & Benqi.
  - **Monetization & `$AGV` Governance:** Gói Pro cho DAO/Treasury doanh nghiệp (Multi-sig Policy) và cơ chế **`$AGV` Guardian Staking** bảo chứng cho các Policy Template cộng đồng.

# NỘI DUNG CHI TIẾT 8 SLIDES THUYẾT TRÌNH — AGENTVAULT (CANVA / GOOGLE SLIDES)

> **Số lượng phù hợp nhất:** **8 Slides** *(tỷ lệ 16:9 ngang — vừa vặn cho bài trình bày 2.5–3 phút, mỗi slide ~20 giây, ít chữ, ưu tiên sơ đồ & số liệu).*  
> **Phong cách thiết kế gợi ý (chuẩn slide *Senpai* của BGK):** Nền tối (`#0B0E14`), chữ trắng to rõ, điểm nhấn màu Đỏ Avalanche (`#E84142`) và Xanh dương (`#3B82F6`), font Sans-serif hiện đại (`Inter` / `Space Grotesk`).

---

### SLIDE 1 — COVER & 1-SENTENCE PITCH
* **Bố cục:** Căn giữa tối giản, logo khiên xanh + badge Avalanche Fuji (`43113`).
* **Nội dung trên Slide:**
  * **Tiêu đề lớn:** **AGENTVAULT**
  * **Phụ đề (Đỏ Avalanche):** *Non-Custodial AI DeFi & Risk Copilot on Avalanche*
  * **1-Sentence Pitch:**
    > *"AgentVault giúp người dùng DeFi thao tác trên Avalanche bằng ngôn ngữ tự nhiên — AI phân tích rủi ro thật, `eth_call` mô phỏng trước khi ký, và Smart Contract khóa cứng hạn mức on-chain."*
  * **Đội thi:** **Team VaultMind** — Cao Hữu Nhân · Trần Minh Quang · Trần Đức Tài
  * **Footer:** Team1 Vietnam UniHack 2026 · Avalanche Fuji C-Chain (`43113`)
* **Ghi chú thuyết trình:** Giới thiệu ngay 1 câu: AgentVault giải bài toán an toàn khi đưa AI vào DeFi mà không bao giờ giữ private key của người dùng.

---

### SLIDE 2 — THE PROBLEM (NỖI ĐAU THỰC TẾ)
* **Bố cục:** 2 cột đối xứng (Bên trái: *Tự thao tác DeFi*, Bên phải: *Giao ví cho AI Agent*).
* **Nội dung trên Slide:**
  * **Tiêu đề:** **AI x DeFi: Giữa Tiện Lợi và Rủi Ro Mất Tiền**
  * **Cột trái — Tự thao tác DeFi truyền thống:**
    * Người dùng mới phải tự đọc hex calldata, tự tính slippage, allowance và ngưỡng thanh lý.
    * Dễ ký nhầm **Unlimited Approval** (`MaxUint256`) hoặc gửi giao dịch revert mất gas.
  * **Cột phải — Giao ví cho AI Agent tự động:**
    * **Prompt Injection / Lộ key backend:** Chỉ 1 câu lệnh bẫy có thể làm bay sạch ví.
    * **LLM Hallucination:** Chatbot thông thường dễ bịa APY, tự tính sai Health Factor hoặc dự đoán giá vô căn cứ.
* **Ghi chú thuyết trình:** Đặt ra mâu thuẫn cốt lõi: người dùng cần AI hỗ trợ nhưng không thể trao private key hay ký mù theo lời AI.

---

### SLIDE 3 — SOLUTION & 3-COLUMN ARCHITECTURE *(Phong cách 3 cột như slide Senpai)*
* **Bố cục:** Sơ đồ luồng 3 cột từ trái sang phải có mũi tên nối rõ ràng.
* **Nội dung trên Slide:**
  * **Tiêu đề:** **HOW AGENTVAULT WORKS. SECURITY RUNS ON AVALANCHE.**
  * **CỘT 1 — USER WALLET (Browser):**
    * MetaMask / Core Wallet (giữ 100% Private Key).
    * Ký **EIP-191 (`personal_sign`)** lưu Policy riêng cho từng ví.
    * Đối chiếu **`keccak256` Integrity Hash** trước khi bật popup ký.
  * **CỘT 2 — COPILOT & TX GUARDIAN (Backend):**
    * **Zero-Trust & No-Forecast Guard** (chặn injection & đoán giá).
    * **Gemini Function Calling** (7 Read Tools + 3 Allowance Write Tools).
    * **Live EVM Simulator (`eth_call` + `estimateGas`)** với `from: userAddress`.
  * **CỘT 3 — AVALANCHE FUJI C-CHAIN (`43113`):**
    * **`AgentVaultPolicy.sol`:** Khóa trần `300 mUSDC/tx`, `2% slippage`, whitelist.
    * **`AgentVaultExecutor.sol`:** `ReentrancyGuard` + `minAmountOut` check.
    * **`MockDEXRouter` + `Chainlink AVAX/USD` + `Aave V3 Fuji` + `Glacier API`**.
* **Ghi chú thuyết trình:** Nhấn mạnh ranh giới tin cậy: AI chỉ là bên đề xuất không giữ key; Smart Contract mới là trọng tài cuối cùng.

---

### SLIDE 4 — AVALANCHE INTEGRATION *(25/100 điểm Rubric)*
* **Bố cục:** Lưới 2x2 (4 thẻ nổi bật).
* **Nội dung trên Slide:**
  * **Tiêu đề:** **Tích hợp Sâu Hệ Sinh Thái Avalanche Fuji**
  * **Thẻ 1 — 4 Verified Smart Contracts (Snowtrace / Routescan):**
    * `MockERC20`, `AgentVaultPolicy`, `MockDEXRouter`, `AgentVaultExecutor` đều đã **Verified Source Code (`v0.8.20`)**.
  * **Thẻ 2 — Chainlink `AVAX/USD` Live Feed (`0x5498...06aD`):**
    * Router on-chain & Dashboard dùng chung 1 nguồn giá Chainlink, kiểm tra đủ `roundId`, `answeredInRound`, `updatedAt <= 24h`.
  * **Thẻ 3 — Official Aave V3 Fuji Pool (`0xccEa...1283`):**
    * Xác minh bytecode trực tiếp (`eth_getCode`), đọc thật `getUserAccountData` trên `8` active reserves.
  * **Thẻ 4 — Avalanche Glacier API + Core/MetaMask:**
    * Hợp nhất `SwapExecuted` logs + Glacier API cho bảng Transaction History bền vững.
* **Ghi chú thuyết trình:** Khẳng định mọi dữ liệu đều chạy thật trên Fuji C-Chain (`43113`), không hardcode giả lập.

---

### SLIDE 5 — TECHNICAL DEPTH: 4-LAYER DEFENSE & ANTI-HALLUCINATION *(25/100 điểm Rubric)*
* **Bố cục:** 60% bên trái (4 tầng phòng thủ xếp chồng) · 40% bên phải (Data Provenance & Agent Config).
* **Nội dung trên Slide:**
  * **Tiêu đề:** **Kiến trúc Phòng Thủ 4 Lớp & Dữ liệu Không Ảo Giác**
  * **Bên trái — 4 Lớp Phòng Thủ:**
    1. **Pre-LLM Zero-Trust Guard:** Chặn Prompt Injection, trích xuất secret, và câu hỏi dự đoán giá.
    2. **Per-Wallet Policy & Exact Approval:** Chặn Unlimited Approval; mỗi ví có Policy riêng ký qua EIP-191 + `Agent Config`.
    3. **Live `eth_call` Simulation:** Tự động mô phỏng lại sau Bước 1 Approve (`SIMULATION UNAVAILABLE` $\rightarrow$ `SIMULATION PASSED`).
    4. **Client Integrity Hash & Anti-Replay:** Khóa calldata bằng `keccak256`; xác minh log `SwapExecuted` chống replay.
  * **Bên phải — Kiểm soát Ảo giác:**
    * AI không làm toán nhẩm: mọi con số đều do TypeScript tính xác định và gắn nhãn **`ON_CHAIN` · `DETERMINISTIC_MATH` · `EXTERNAL_API` · `INSUFFICIENT_DATA`**.
* **Ghi chú thuyết trình:** Giải thích tại sao ngay cả khi Backend bị sửa calldata hoặc AI bị đánh lừa, lớp `integrityHash` + `AgentVaultPolicy` vẫn chặn đứng.

---

### SLIDE 6 — VERIFICATION & BENCHMARK *(Bằng chứng Kỹ thuật)*
* **Bố cục:** 4 ô số lớn (Big Numbers) nổi bật ở giữa màn hình.
* **Nội dung trên Slide:**
  * **Tiêu đề:** **Kiểm Chứng Thực Tế Bằng Số Liệu**
  * **Ô 1:** **`18 / 18`** — *Hardhat Smart Contract Unit Tests PASS* (Policy cap, slippage, router bypass, stale oracle, pause, user isolation).
  * **Ô 2:** **`40 / 40`** — *AI Evaluation Suite PASS (0% Hallucination)* + *`4/4` Security Regression PASS* (Session, Multi-wallet, EIP-191 Auth, Integrity Hash).
  * **Ô 3:** **`100 / 100`** — *Red-Team Security & Prompt Injection Cases PASS* (`0` rò rỉ System Prompt).
  * **Ô 4:** **`4 / 4`** — *Smart Contracts Verified trên Snowtrace Fuji* (`0 Deployment Drift`).
* **Ghi chú thuyết trình:** Nhấn mạnh dự án không chỉ làm UI đẹp mà được kiểm thử nghiêm ngặt như sản phẩm Production.

---

### SLIDE 7 — LIVE DEMO FLOW & VERIFIED LINKS
* **Bố cục:** 4 bước ngang (Stepper) ở trên + Hộp link truy cập ở dưới.
* **Nội dung trên Slide:**
  * **Tiêu đề:** **One Complete Flow That Works**
  * **4 Bước Demo Thực Tế:**
    1. **Connect & Block:** Kết nối ví Fuji $\rightarrow$ Bấm `Attack Test` & `Guard: 500 Cap` $\rightarrow$ Chặn ngay (`REJECT` / `ExceedsMaxTxAmount`).
    2. **Risk Check:** Bấm `Risk: Aave & Liquidity` $\rightarrow$ Đọc Chainlink + Aave V3 (`INSUFFICIENT_DATA` khi 0 nợ) + Stress-test `-20%`.
    3. **2-Step Tx Guardian:** `Write: Swap 1` $\rightarrow$ Ký `Exact Approve 1 mUSDC` $\rightarrow$ `eth_call` tự nhảy **`SIMULATION PASSED`** $\rightarrow$ Ký Swap.
    4. **Verify & Govern:** Mở Tx Hash trên Snowtrace $\rightarrow$ Kiểm tra `Transaction History`, `Agent Config` & `Audit Log`.
  * **Links kiểm chứng:**
    * **GitHub:** `github.com/HuuNhan-147/UNIHACK`
    * **Live DApp:** `agentvault-frontend-beta.vercel.app` *(hoặc domain Vercel sạch của bạn)*
    * **Contracts (Snowtrace Fuji):** `0x940d...57e7` (Policy) · `0x9279...6582` (Executor) · `0x6ABC...8B8` (Router) · `0xb846...6Ed1` (mUSDC)
* **Ghi chú thuyết trình:** Mời giám khảo mở link trực tiếp hoặc xem video demo chạy thật trên Fuji.

---

### SLIDE 8 — ROADMAP & BUSINESS MODEL *(Định hướng Tương lai)*
* **Bố cục:** 2 cột (Trái: *Lộ trình Sản phẩm*, Phải: *Mô hình Bền vững*).
* **Nội dung trên Slide:**
  * **Tiêu đề:** **Từ Testnet MVP Đến Hệ Sinh Thái Avalanche Mainnet**
  * **Cột trái — Roadmap:**
    * **Production Hardening:** Chuyển store JSON sang PostgreSQL, chuyển quyền `Ownable` sang Multisig / Timelock.
    * **Mainnet DEX Adapter:** Cắm trực tiếp **LFJ (Trader Joe) / Pangolin** qua interface `ISwapRouter.sol` sẵn có.
    * **Multi-Protocol Guard:** Mở rộng write tools cho **Aave V3** (`supply`, `repay`) và đưa daily limit lên on-chain.
  * **Cột phải — Định hướng Thương mại hóa:**
    * **B2C Freemium:** Miễn phí Tx Guardian cơ bản; thu phí gói Pro cho quản lý đa ví & stress-test nâng cao.
    * **B2B Policy-as-a-Service SDK:** Cấp phép `TxSimulator` + `AgentVaultPolicy` SDK cho các đội ngũ AI Agent & ví Web3.
    * **DAO / Enterprise Treasury:** Quản trị hạn mức chi tiêu và audit log cho tổ chức vận hành quỹ bằng AI.
* **Ghi chú thuyết trình:** Khẳng định kiến trúc hiện tại đã sẵn sàng mở rộng lên Mainnet mà không cần đập đi xây lại lõi Policy.

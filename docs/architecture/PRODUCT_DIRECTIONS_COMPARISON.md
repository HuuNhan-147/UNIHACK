# AGENTVAULT — PRODUCT DIRECTIONS COMPARISON & SCORING

> **Nguyên tắc:** Đề xuất 5 hướng sản phẩm **khác biệt thực sự về bài toán người dùng và thị trường** (không tạo 5 biến thể giống nhau của AI Swap Wallet). Không bịa đặt số liệu thị trường; phân biệt rõ giả định (*Hypothesis*) và năng lực đã kiểm chứng (*Verified*).

---

## 1. Năm hướng sản phẩm đề xuất

### Direction 1: **AgentVault Treasury** — *Ví phụ & Ngân sách On-chain cho AI Agent / Nhân viên vận hành*
- **One-sentence pitch:** Nền tảng cấp "thẻ phụ" on-chain có hạn mức cho AI Agent hoặc nhân viên vận hành tự động chi tiêu/tái cân bằng từ quỹ chung mà không bao giờ lộ ví chính.
- **Target customers:** Crypto-native founders, DAO treasuries, cá nhân muốn dùng bot DeFi/AI tự động (DCA, trả phí vận hành) nhưng sợ mất cả ví.
- **Core user pain point:** Muốn ủy quyền cho AI hoặc nhân viên thực hiện giao dịch thường xuyên, nhưng hiện tại chỉ có 2 lựa chọn cực đoan: đưa private key (rủi ro mất sạch) hoặc tự tay ký từng giao dịch (mất thời gian).
- **Proposed solution:** Owner nạp USDC vào `TreasuryVault.sol`, cấp quyền `Operator` (ví riêng của AI Agent hoặc nhân viên) với `perTxCap`, `dailyCap`, `allowedRecipients/Routers` enforce **on-chain**.
- **Main user journey:** Owner nạp 500 USDC → Cấu hình ngân sách cho AI bằng ngôn ngữ tự nhiên → AI tự động chạy lệnh nhỏ (`ALLOW`) bằng Agent Wallet → Lệnh lớn (`REQUIRE_APPROVAL`) chờ Owner ký → Contract chặn nếu AI vượt hạn mức hoặc bị Revoke.
- **Role of AI:** Phân tích trạng thái quỹ, đề xuất kế hoạch chi tiêu/tái cân bằng, kiểm tra bất thường (Tx Guardian), tóm tắt báo cáo Post-Tx.
- **Role of Blockchain:** Enforce cứng `perTxCap`, `dailyCap`, `whitelist`, `revoke` trên Smart Contract — ngay cả khi Backend/AI bị hack, thiệt hại tối đa bị khóa trong ngân sách ngày.
- **Reusability:** Tái sử dụng ~80% core hiện tại (giữ Policy, NL Builder, Guardian, Audit Log, Post-Tx; thêm `TreasuryVault.sol` + Agent Wallet runner).
- **MVP Feasibility (UniHack):** Cao (1–1.5 ngày).
- **Monetization (Hypothesis):** % phí trên tài sản quản lý (AUM) hoặc gói SaaS cho DAO/Team quản lý nhiều Agent Wallets.

---

### Direction 2: **ClarityVault (Group & Club Fund AI Treasurer)** — *Quỹ nhóm / Quỹ CLB minh bạch có AI Kiểm toán & Giải ngân*
- **One-sentence pitch:** Quỹ chung on-chain cho CLB sinh viên, nhóm dự án và cộng đồng nhỏ — nơi thành viên gửi yêu cầu giải ngân kèm hóa đơn, AI kiểm tra quy chế và Smart Contract tự động chi hoặc trình duyệt.
- **Target customers:** CLB sinh viên đại học (Việt Nam), nhóm làm hackathon/dự án, quỹ nhóm bạn / thiện nguyện quy mô nhỏ.
- **Core user pain point:** Quỹ CLB thường gửi vào tài khoản ngân hàng cá nhân của thủ quỹ → thiếu minh bạch, thành viên ngại hỏi sao kê, thủ quỹ tốn công duyệt từng khoản nhỏ và dễ bị nghi ngờ khi số liệu lệch.
- **Proposed solution:** Quỹ USDC nằm trên `ClubVault.sol` (không nằm trong ví cá nhân thủ quỹ). Thành viên gửi yêu cầu chi (kèm mô tả/hóa đơn); AI đối chiếu quy chế CLB → Khoản hợp lệ nhỏ giải ngân nhanh trong hạn mức; khoản lớn/bất thường (`ESCALATE`) gửi Chủ nhiệm/Thủ quỹ duyệt; mọi giao dịch lưu hash chứng từ on-chain. Thành viên có thể chat hỏi AI: *"Tháng này CLB đã chi những gì, còn bao nhiêu?"*
- **Concrete example:** CLB IT có quỹ 1,000 USDC. Thành viên A xin chi 15 USDC mua nước cho buổi workshop → AI kiểm tra quy chế (hạng mục "Sự kiện", <= 20 USDC) → Hợp lệ → Giải ngân về ví Thành viên A, ghi log minh bạch. Thành viên B xin 200 USDC mua màn hình → `ESCALATE` lên Ban Chủ nhiệm ký duyệt.
- **Role of AI:** Trợ lý kiểm toán nội bộ: đọc yêu cầu chi tiêu + kiểm tra quy chế bằng ngôn ngữ tự nhiên, phát hiện chi trùng/bất thường, trả lời minh bạch cho mọi thành viên 24/7.
- **Role of Blockchain:** Đảm bảo tiền quỹ không thuộc sở hữu cá nhân thủ quỹ; hạn mức giải ngân và lịch sử chi tiêu bất biến (immutable).
- **Reusability:** Tái sử dụng ~75% (bỏ `MockDEXRouter`, đổi `executeSwap` thành `disburse(recipient, amount, receiptHash)`).
- **MVP Feasibility (UniHack):** Cao (1 ngày).
- **Monetization (Hypothesis):** Freemium cho CLB/nhóm; thu phí tính năng quản trị nâng cao (multisig, xuất báo cáo thuế/kiểm toán) cho tổ chức/DAO.

---

### Direction 3: **AgentPay Guard (B2B AI Procurement & x402 Spend Control)** — *Cổng kiểm soát ngân sách cho AI Agents mua API/Dịch vụ tự động*
- **One-sentence pitch:** Lớp kiểm soát ngân sách on-chain (x402/USDC) giúp doanh nghiệp cho phép AI Agents tự động thanh toán API, dữ liệu và SaaS theo từng request mà không lo "nổ bill" hay chi sai nhà cung cấp.
- **Target customers:** Startup AI, đội ngũ kỹ thuật vận hành nhiều AI Agents gọi API trả phí (LLM, scraper, data feeds) qua chuẩn x402 / USDC.
- **Core user pain point:** Khi AI Agent tự động gọi các công cụ trả phí theo lượt (pay-per-call), một vòng lặp lỗi (*infinite retry loop*) hoặc prompt injection có thể đốt sạch ngân sách công ty trong vài phút.
- **Proposed solution:** Doanh nghiệp nạp USDC vào `SpendGuardVault.sol`, cấp hạn mức theo ngày và whitelist địa chỉ ví của các nhà cung cấp API (`Vendor Whitelist`). Khi AI cần mua dữ liệu/API, Backend kiểm tra Policy + Tx Guardian trước khi thanh toán USDC on-chain.
- **Role of AI:** Tự động chọn dịch vụ/API tối ưu chi phí theo ngân sách, phát hiện vòng lặp chi tiêu bất thường, giải thích báo cáo chi phí.
- **Role of Blockchain:** Enforce micropayment USDC tức thì (Avalanche finality nhanh, phí rẻ) kèm trần chi tiêu & vendor whitelist on-chain (không phụ thuộc thẻ tín dụng truyền thống vốn không hỗ trợ micropayment $0.01 cho AI).
- **Reusability:** Tái sử dụng ~70% (giữ Policy Engine, Audit Log, NL Builder, Guardian; thay Swap bằng Payment/x402 endpoint demo).
- **MVP Feasibility (UniHack):** Trung bình–Cao (1.5 ngày; cần dựng 1 mock API trả phí để demo luồng AI tự trả USDC gọi API).
- **Monetization (Hypothesis):** Thu % nhỏ (0.5–1%) trên volume thanh toán qua cổng hoặc phí subscription theo số lượng Agent.

---

### Direction 4: **EscrowAI (Milestone & Deliverable-Verified Smart Escrow)** — *Ký quỹ thông minh có AI nghiệm thu bằng chứng bàn giao*
- **One-sentence pitch:** Hợp đồng ký quỹ USDC giữa người thuê và freelancer/bên bán, tích hợp AI đối chiếu bằng chứng bàn giao (repo, tài liệu, link) trước khi đề xuất giải ngân hoặc mở tranh chấp.
- **Target customers:** Freelancer Web3, agency nhỏ, người mua bán dịch vụ số / tài khoản / code qua mạng.
- **Core user pain point:** Người thuê sợ chuyển tiền trước bị bùng; freelancer sợ làm xong không được trả; khi tranh chấp xảy ra không có người phân xử nhanh các bằng chứng kỹ thuật.
- **Proposed solution:** Người thuê khóa USDC vào `MilestoneEscrow.sol` theo từng cột mốc. Freelancer nộp bằng chứng hoàn thành → AI đối chiếu bằng chứng với mô tả Milestone ban đầu → Đưa ra đánh giá minh bạch (`PASS` / `INCOMPLETE` / `DISPUTE`) để các bên xác nhận giải ngân on-chain.
- **Role of AI:** Đọc & tóm tắt bằng chứng bàn giao, đối chiếu checklist nghiệm thu, cảnh báo dấu hiệu gian lận.
- **Role of Blockchain:** Giữ tiền cọc trung lập (trustless escrow), giải ngân theo đúng milestone đã khóa hoặc hoàn tiền nếu quá hạn.
- **Reusability:** Trung bình–Thấp (~45%: giữ được Gemini + Guardian/Audit UI, nhưng phải viết mới toàn bộ `MilestoneEscrow.sol` và luồng 2 bên Buyer/Seller).
- **MVP Feasibility (UniHack):** Trung bình (1.5–2 ngày).
- **Monetization (Hypothesis):** Phí giao dịch Escrow (1–2% giá trị hợp đồng).

---

### Direction 5: **TxGuardian Standalone** — *Tường lửa phân tích & mô phỏng giao dịch Web3 trước khi ký*
- **One-sentence pitch:** Công cụ bảo mật giúp người dùng Web3 kiểm tra bất kỳ giao dịch/calldata nào bằng ngôn ngữ tự nhiên để phát hiện phishing, drainer và unlimited approval trước khi bấm ký ví.
- **Target customers:** Người dùng ví cá nhân (MetaMask/Core) thường xuyên tương tác với dApp mới.
- **Core user pain point:** Popup ví hiển thị chuỗi hex calldata khó hiểu, người dùng dễ ký nhầm lệnh rút cạn ví (*setApprovalForAll*, *permit phishing*).
- **Proposed solution:** Paste calldata/tx params hoặc URL dApp → Backend mô phỏng giao dịch + AI dịch sang tiếng Việt/Anh dễ hiểu + cảnh báo rủi ro.
- **Role of AI:** Dịch calldata kỹ thuật và nhận diện mẫu lừa đảo.
- **Role of Blockchain:** **Rất yếu** — chủ yếu chỉ đọc RPC / chạy fork simulation ở Backend, không cần Smart Contract riêng.
- **Reusability:** ~50% (chỉ giữ `TxPreviewModal` và `detectMaliciousIntent`, bỏ gần hết Policy & Executor).
- **MVP Feasibility (UniHack):** Trung bình (cần tích hợp fork simulation thực sự mới thuyết phục, nếu chỉ regex + LLM sẽ bị chê hời hợt).

---

## 2. Weighted Scoring & Ranking

Bảng trọng số theo yêu cầu:
- **Pain/Demand (20%)** · **Differentiation (20%)** · **Blockchain Necessity (15%)** · **AI Necessity (15%)** · **Core Reusability (10%)** · **UniHack Feasibility (10%)** · **Business Potential (10%)**

| Direction | Pain (20%) | Diff (20%) | Chain (15%) | AI (15%) | Reuse (10%) | MVP (10%) | Biz (10%) | **Weighted Score** | Rank |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **D1: AgentVault Treasury** *(AI Wallet + Ngân sách On-chain)* | 7.5 | 7.5 | 9.0 | 8.0 | 8.5 | 8.0 | 8.5 | **8.05** | **#1** |
| **D2: ClarityVault** *(Quỹ CLB / Nhóm có AI Thủ quỹ)* | 8.5 | 8.0 | 8.5 | 7.5 | 8.0 | 9.0 | 7.0 | **8.10** | **#1 (tie / Top Local)** |
| **D3: AgentPay Guard** *(B2B AI Spend Control / x402)* | 8.0 | 9.0 | 8.5 | 8.0 | 7.0 | 7.0 | 9.0 | **8.18** | **#1 (Overall)** |
| **D4: EscrowAI** *(Milestone Smart Escrow)* | 8.5 | 7.0 | 9.0 | 6.5 | 4.5 | 6.0 | 8.5 | **7.33** | **#4** |
| **D5: TxGuardian Standalone** | 7.5 | 5.0 | 3.0 | 7.0 | 5.0 | 6.5 | 6.0 | **5.75** | **#5** |

### Giải thích điểm số (Không thổi phồng)
- **D3 (AgentPay Guard — 8.18):** Điểm cao nhất về **Differentiation (9.0)** và **Business Potential (9.0)** vì đánh thẳng vào trend *Agent Economy / x402* đang được `idea_bank.md` ưu tiên, giải quyết bài toán thực tế (AI Agent gọi API trả phí dễ nổ bill) mà thẻ tín dụng truyền thống không giải quyết được. Tuy nhiên điểm **MVP Feasibility (7.0)** thấp hơn D2 một chút vì cần thêm 1 mock paid API để demo.
- **D2 (ClarityVault — 8.10):** Điểm cao nhất về **UniHack Feasibility (9.0)** và **Pain/Demand gần gũi (8.5)** với ban giám khảo Việt Nam (giống #02/#05 trong `idea_bank.md`). Nhược điểm là **Business Potential (7.0)** thấp hơn B2B/Agent Economy khi thương mại hóa quy mô lớn.
- **D1 (AgentVault Treasury — 8.05):** Rất cân bằng (**Blockchain Necessity 9.0**, **Reusability 8.5**), giải quyết triệt để nghịch lý tự trói mình bằng `TreasuryVault + Agent Wallet`. Tuy nhiên ở demo Testnet nếu chỉ swap `mUSDC -> AVAX` qua Mock Router thì sức thuyết phục về nhu cầu thực tế của người dùng phổ thông vẫn kém hơn D2 (chi trả quỹ nhóm) và D3 (AI mua API/dịch vụ).
- **D4 (EscrowAI — 7.33):** Tốt về mặt bài toán nhưng tái sử dụng core thấp (**4.5**), rủi ro trễ tiến độ cao nếu phải viết mới hoàn toàn Escrow 2 chiều.
- **D5 (TxGuardian Standalone — 5.75):** Bị loại vì **Blockchain Necessity (3.0)** quá thấp (không tận dụng được thế mạnh Smart Contract Policy đã xây dựng) và dễ trùng ý tưởng với các extension ví phổ biến.

> **Ghi chú quan trọng:** D1, D2, và D3 thực chất **chia sẻ cùng một kiến trúc lõi `TreasuryVault.sol` (Owner nạp tiền → Cấp hạn mức cho Operator/AI → Chi tiêu theo Policy On-chain)**. Sự khác biệt nằm ở **đối tượng sử dụng & hành động đầu ra** (Swap DeFi vs Chi trả quỹ CLB vs Thanh toán API x402).

# KỊCH BẢN QUAY VIDEO DEMO — AGENTVAULT (2 PHÚT 30 GIÂY)

> **Nguyên tắc vàng từ Ban Giám Khảo (`Ảnh 3`):**  
> - **30 giây đầu tiên:** Phải thấy ngay **Vấn đề thực tế** (người dùng sợ AI ký bậy / prompt injection / mất tiền).  
> - **Phần giữa:** Quay **1 luồng hoàn chỉnh chạy thật từ đầu đến cuối** (tuyệt đối không cắt ghép giả hay lướt 10 tính năng dở dang).  
> - **Cài đặt màn hình:** Mở sẵn `AgentVault` đã kết nối ví MetaMask/Core (có sẵn `mUSDC` & `AVAX`), mở sẵn 1 tab **Snowtrace Fuji** để đối chiếu.

---

### ⏱️ 0:00 – 0:30 | MỞ ĐẦU & VẤN ĐỀ (THE HOOK)
- **Hình ảnh trên màn hình:**
  - Hiện Slide 1 (5 giây) → chuyển ngay sang giao diện Live App `AgentVault`.
  - Bấm nút nhanh **`Attack Test`** (Prompt Injection đòi approve toàn bộ số dư & chuyển `9999 mUSDC` tới `0x...dEaD`) → Hiện ngay badge đỏ **`REJECT · Zero-Trust Guard Blocked (1ms)`**.
  - Bấm nút nhanh **`Guard: 500 Cap`** (*"Swap 500 mUSDC sang AVAX"*) → Mở **Tx Guardian Inspector**, chỉ vào **`SIMULATION FAILED · ExceedsMaxTxAmount`** (nút ký bị khóa mặc định).
- **Lời thoại (Voiceover):**
  > *"Giao tài sản DeFi cho AI tự động ký là cơn ác mộng bảo mật: chỉ một câu lệnh Prompt Injection hoặc một lần AI ảo giác có thể làm bay sạch ví. Đó là lý do chúng tôi xây dựng **AgentVault** — Trợ lý AI DeFi & Risk Copilot 100% Non-custodial trên Avalanche: AI chỉ phân tích và đề xuất, Smart Contract kiểm soát hạn mức, và chỉ chính bạn mới giữ quyền ký."*

---

### ⏱️ 0:30 – 1:05 | PHÂN TÍCH RỦI RO THẬT (CHAINLINK + AAVE V3 + RISK INTELLIGENCE)
- **Hình ảnh trên màn hình:**
  - Chỉ nhanh vào **HoldingsTable** (badge `Chainlink Fuji Feed`), **Policy StatusCard** (`300 mUSDC / 2% slippage`), và **RiskIntelligenceCard** (`ON_CHAIN`, `DETERMINISTIC_MATH`, `Aave V3 Fuji`).
  - Bấm nút nhanh **`Risk: Aave & Liquidity`** trên khung Chat → AI trả về phân tích rủi ro kèm nguồn dữ liệu và báo `INSUFFICIENT_DATA` cho vị thế vay Aave V3 vì ví chưa có nợ.
- **Lời thoại (Voiceover):**
  > *"Khác với chatbot thông thường tự bịa số liệu, mọi câu trả lời của AgentVault đều gắn nhãn nguồn dữ liệu thật: số dư và tỷ giá lấy trực tiếp từ Chainlink Avalanche Fuji, thanh khoản Router đo trực tiếp on-chain, và kiểm tra vị thế vay từ Official Aave V3 Fuji Pool. Khi ví không có nợ, AI báo trung thực `INSUFFICIENT_DATA` thay vì tự đoán giá thanh lý."*

---

### ⏱️ 1:05 – 2:05 | LUỒNG GIAO DỊCH HOÀN CHỈNH (LIVE `eth_call` SIMULATION -> ON-CHAIN SWAP)
- **Hình ảnh trên màn hình:**
  - Bấm nút nhanh **`Write: Swap 1`** (*"Swap 1 mUSDC sang AVAX"*).
  - PlanCard hiện ra (`8/8 Deterministic Checks Passed`) → Bấm **Tx Guardian Inspector**.
  - Chỉ vào trạng thái **`SIMULATION UNAVAILABLE (Chờ Exact Approve Bước 1)`**.
  - Bấm **`1. Exact Approve 1 mUSDC`** → Ký trên MetaMask/Core.
  - **Khoảnh khắc ăn tiền:** Ngay khi Bước 1 xác nhận, modal tự động chạy lại `eth_call` và nhảy xanh thành **`SIMULATION PASSED`** kèm Block #, Estimated Gas (`~180,006`) và Simulated Output (`~0.14 AVAX`).
  - Bấm **`Confirm & Sign Swap`** → Ký trên MetaMask/Core → Hệ thống xác minh Post-Tx Balance và hiện link **Snowtrace**. Bấm mở link Snowtrace cho thấy giao dịch thành công on-chain.
- **Lời thoại (Voiceover):**
  > *"Bây giờ tôi thực hiện một lệnh swap thật `1 mUSDC sang AVAX`. Thay vì cho phép approve vô hạn, Tx Guardian chỉ tạo lệnh Exact Approve đúng 1 mUSDC. Ngay sau khi tôi ký bước 1, hệ thống tự động chạy mô phỏng EVM `eth_call` trực tiếp trên Fuji với đúng địa chỉ ví của tôi, hiển thị rõ gas ước tính và đầu ra dự kiến. Trước khi mở ví ký bước Swap, trình duyệt còn đối chiếu mã băm `keccak256` để đảm bảo calldata không bị sửa đổi dù chỉ 1 bit. Giao dịch xác nhận thành công và minh bạch hoàn toàn trên Snowtrace."*

---

### ⏱️ 2:05 – 2:30 | KẾT THÚC & KIỂM CHỨNG (PROOF & CTA)
- **Hình ảnh trên màn hình:**
  - Chuyển sang Slide 6 (`40/40 Live Gemini PASS · 100/100 Red-Team PASS · 11/11 Edge Cases · Verified Contracts`) và Slide 7 (Link App + GitHub + Snowtrace).
- **Lời thoại (Voiceover):**
  > *"Toàn bộ 4 Smart Contracts của AgentVault đã được verify trên Avalanche Fuji Explorer, vượt qua 40/40 kịch bản đánh giá AI trực tiếp với 0% ảo giác và 100/100 bài kiểm thử tấn công Red-Team. Trải nghiệm ngay AgentVault tại đường link trên màn hình. Cảm ơn Ban Giám Khảo!"*

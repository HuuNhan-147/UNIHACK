# TOPIC 13 DEMO SCRIPT — AGENTVAULT DEFI & RISK COPILOT

**Thời lượng đề xuất:** 3 – 5 phút  
**Chuẩn bị:** Khởi chạy Backend (`port 4000`) & Frontend (`port 5173`), mở `http://localhost:5173/`, kết nối ví MetaMask hoặc Core Wallet trên mạng **Avalanche Fuji Testnet (`Chain ID: 43113`)**.

---

### Bước 1: Kết nối Ví & Kiểm tra Dữ liệu On-chain Thực tế
1. Bấm **Connect Wallet** ở góc phải trên cùng.
2. Giới thiệu bố cục **Single-Viewport Dashboard**:
   - **On-Chain Holdings:** Số dư `AVAX` & `mUSDC` thật trên Fuji, kèm badge **`Chainlink Fuji Feed`** và tỷ giá Router trực tiếp.
   - **On-Chain Policy Guardrails:** Trần `300.0 mUSDC/tx`, `Max Slippage 2.00%`, `Router Verified`.
   - **Risk Intelligence Card:** Hiển thị trực tiếp Concentration, `-20% AVAX Shock`, `mUSDC Allowance Exposure (ON_CHAIN)`, `Router Liquidity (ON_CHAIN)` và trạng thái `Aave V3 Fuji Lending Risk (ON_CHAIN_VERIFIED)`.

### Bước 2: Demo Read & Risk Intelligence (Phân biệt nguồn dữ liệu, không ảo giác)
1. Bấm nút nhanh **`Read: Portfolio`** hoặc **`Risk: Aave & Liquidity`**:
   - AI gọi `analyze_portfolio_allocation` / `calculate_position_risk`, trình bày rõ số liệu kèm nguồn `ON_CHAIN` và `DETERMINISTIC_MATH`.
   - Khi ví không có khoản vay trên Aave V3 Fuji (`0xccEa5C...`), AI trả về trung thực **`INSUFFICIENT_DATA`** cho giá thanh lý thay vì tự bịa số.
2. Bấm nút nhanh **`No-Forecast`** (*"Dự đoán giá AVAX ngày mai có tăng không?"*):
   - Bộ lọc `No-Forecasting Guard` chặn ngay lập tức (không tốn token LLM) và giải thích chỉ cung cấp dữ liệu xác thực.
3. Bấm nút nhanh **`Attack Test`** (Prompt Injection đòi bỏ qua giới hạn & chuyển `9999 mUSDC` tới `0x...dEaD`):
   - `Zero-Trust Intent Guard` chặn đứng (`BLOCKED_BY_INTENT_GUARD`), không sinh bất kỳ calldata nào và ghi vào tab **Audit Logs**.

### Bước 3: Demo Giao dịch Hợp lệ (`1 mUSDC`) & Live EVM Simulation (`eth_call`)
1. Bấm nút nhanh **`Write: Swap 1`** (*"Swap 1 mUSDC sang AVAX"*):
   - *(Lưu ý: Pool `MockDEXRouter` trên Fuji đang giữ `~0.46 AVAX`, nên dùng mức `0.5 – 1 mUSDC` để giao dịch khớp mượt mà).*
2. Trên **PlanCard**, bấm **Tx Guardian Inspector**:
   - Chỉ cho giám khảo thấy bảng **Pre-Sign EVM Simulation (`eth_call`)**: hiển thị loại giao dịch, địa chỉ contract, Block kiểm tra, cảnh báo rủi ro và giới hạn mô phỏng.
3. Bấm **`1. Exact Approve 1 mUSDC`** và ký trên ví:
   - Ngay khi bước 1 xác nhận on-chain, `Tx Guardian` **tự động chạy lại `eth_call`** cho lệnh `executeSwap`, chuyển trạng thái sang **`SIMULATION PASSED`** kèm **Estimated Gas (`~180,006 units`)** và **Simulated Output (`~0.1405 AVAX`)**!
4. Bấm **`Confirm & Sign Swap`** và ký trên ví:
   - Hệ thống kiểm tra khớp `integrityHash`, gửi giao dịch lên Fuji, đối chiếu số dư thực tế trước/sau (`Post-Tx Verification`) và cập nhật bảng **Transaction History** kèm link Snowtrace.

### Bước 4: Demo Chặn Vượt Trần Policy (`500 mUSDC`) & Thiếu Thanh khoản (`40 mUSDC`)
1. Bấm nút nhanh **`Guard: 500 Cap`** (*"Swap 500 mUSDC sang AVAX"*):
   - Mở **Tx Guardian Inspector**: trạng thái **`SIMULATION FAILED` / `BLOCKED`** với lỗi giải mã trực tiếp từ EVM: `ExceedsMaxTxAmount: Requested 500.0 mUSDC > limit 300.0 mUSDC`.
   - Nút ký bị **khóa mặc định** để bảo vệ người dùng (chỉ mở nếu bật hộp kiểm *Developer Revert Demo*).

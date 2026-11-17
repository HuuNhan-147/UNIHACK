# TOPIC 13 DEMO SCRIPT — AGENTVAULT DEFI COPILOT

**Thời lượng đề xuất:** 3 – 5 phút  
**Chuẩn bị:** Mở `http://localhost:5173/`, kết nối ví MetaMask hoặc Core Wallet ở mạng **Avalanche Fuji Testnet (`43113`)**.

---

### Bước 1: Kết nối ví & Kiểm tra dữ liệu thật (Chainlink Fuji + Portfolio)
1. Bấm **Connect Wallet** ở góc trên bên phải.
2. Chỉ cho Ban Giám Khảo thấy bảng **On-Chain Holdings (Avalanche Fuji)** hiển thị:
   - Số dư `AVAX` & `mUSDC` thật trên Fuji.
   - Badge **`Chainlink Fuji Feed`** (giá `AVAX/USD` đọc trực tiếp on-chain từ Chainlink Fuji).
3. Nếu ví chưa có `mUSDC`, bấm **Faucet 1000 mUSDC** và ký giao dịch nhận token test.

### Bước 2: Demo Read & Risk Analysis (Không bịa đặt, không dự đoán giá)
Gõ vào khung chat **DeFi Copilot** (hoặc bấm các nút gợi ý):
1. **Kiểm tra danh mục:** *"Phân tích danh mục hiện tại và rủi ro nếu swap 50 mUSDC sang AVAX"*  
   $\rightarrow$ AI gọi `analyze_portfolio_allocation`, trả về tỷ trọng thực tế và mô phỏng phân bổ sau swap.
2. **Kiểm tra rủi ro vị thế:** *"Tính Health Factor nếu thế chấp 10 AVAX và vay 150 USD"*  
   $\rightarrow$ AI gọi `calculate_position_risk`, tính toán xác định Health Factor & giá thanh lý dựa trên giá Chainlink hiện tại.
3. **Thử thách No-Forecast Guardrail:** *"Ngày mai AVAX có tăng lên 50 đô không? Tôi nên all-in không?"*  
   $\rightarrow$ AI **từ chối dự đoán giá** và giải thích rõ chỉ hỗ trợ phân tích dữ liệu xác định.

### Bước 3: Demo Write Tool & Tx Guardian (Human-in-the-loop)
1. Gõ lệnh hợp lệ: *"Swap 50 mUSDC sang AVAX với slippage 1%"*
2. AI gọi `plan_swap`, tạo **Unsigned Transaction Plan** kèm bảng kiểm tra **Tx Guardian**:
   - Exact Approval (chỉ approve đúng `50 mUSDC`, không approve vô hạn).
   - Whitelisted `AgentVaultExecutor` & Router.
   - On-chain Slippage Guard (`<= 2%`).
3. Bấm **Review & Sign**, kiểm tra **Tx Guardian Modal** và ký trên ví.
4. Sau khi xác nhận, mở **History** để thấy giao dịch thật vừa ghi nhận từ Avalanche Fuji / Glacier API.

### Bước 4: Demo Chặn Rủi Ro On-chain (Policy Guardrail)
1. Gõ lệnh vi phạm hạn mức: *"Swap 500 mUSDC sang AVAX"* (vượt mức tối đa `300 mUSDC/tx`).
2. Hệ thống chặn ngay lập tức ở Backend và giải thích lý do vi phạm `AgentVaultPolicy` (và ngay cả khi gọi thẳng Smart Contract với `500 mUSDC`, `AgentVaultPolicy.validateSwap()` cũng sẽ revert on-chain).
3. *(Tùy chọn)* Gõ *"Thu hồi toàn bộ quyền approve mUSDC"* để minh họa lệnh `plan_revoke_allowance` đưa allowance về `0`.

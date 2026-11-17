# TOPIC 13 DEMO SCRIPT — AGENTVAULT DEFI COPILOT

1. **Kết nối ví (Avalanche Fuji `43113`):**
   - Bấm **Connect Wallet**, nếu cần bấm **Faucet 1000 mUSDC** để lấy token test.
2. **Read & Risk Analysis:**
   - Bấm nút **Read: Portfolio** (hoặc gõ: *"Phân tích số dư ví và rủi ro phân bổ danh mục hiện tại của tôi"*).
   - Copilot gọi `get_portfolio` + `analyze_portfolio_allocation` và trả về tỷ trọng thật từ Fuji RPC.
   - Hỏi tiếp trong cùng session: *"Nếu tôi đổi 50 mUSDC sang AVAX thì tỷ trọng thay đổi thế nào?"* (chứng minh **Per-Session Memory**).
3. **No-Forecasting Guard:**
   - Bấm nút **No-Forecast** (*"Dự đoán giá AVAX ngày mai có tăng không?"*).
   - Copilot từ chối dự đoán giá và đề nghị kiểm tra dữ liệu on-chain/báo giá hiện tại.
4. **Write Action + Tx Guardian + User Signature:**
   - Bấm **Write: Swap 10** (*"Swap 10 mUSDC sang AVAX"*).
   - Copilot gọi `plan_swap` → mở **Plan Card** → bấm **Tx Guardian Inspector** → kiểm tra Exact Approval, Whitelisted Target, On-chain Slippage Guard → User tự bấm **Exact Approve** và **Confirm & Sign Swap** trên MetaMask → xác minh receipt trên Snowtrace.
5. **Guardrail & Prompt Injection Defense:**
   - Bấm **Guard: 500 Cap** → bị chặn bởi `AgentVaultPolicy` (`500 > 300 mUSDC`).
   - Bấm **Attack Test** → bị `Deterministic Intent Guard` chặn ngay trước LLM, ghi vào **Audit Log**.
6. **Chạy Eval Suite trước Giám khảo:**
   - Chạy `pnpm --filter backend eval` để trình diễn 30/30 test cases song ngữ Việt–Anh.

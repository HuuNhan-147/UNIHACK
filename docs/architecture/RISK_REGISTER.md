# RISK REGISTER – AGENTVAULT

| ID | Nhóm rủi ro | Mô tả rủi ro | Mức độ | Phương án phòng ngừa & Xử lý (Mitigation) |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | Blockchain | DEX Testnet trên Fuji không có pool hoặc thiếu thanh khoản cặp `USDC/AVAX`, gây lỗi khi swap. | Cao | Dùng `MockDEXRouter.sol` tự chủ thanh khoản Test AVAX và `mUSDC` cho MVP; trình bày minh bạch trong demo và giữ interface dễ cắm DEX thật sau này. |
| **R2** | Blockchain | Faucet hết AVAX hoặc giới hạn lượt nhận theo IP/tài khoản, không đủ gas deploy. | Trung bình | Lấy Test AVAX ngay từ Day 1 qua Core Faucet / Avalanche Builder Hub; chỉ nạp 0.5–1 AVAX vào `MockDEXRouter` và giữ tỷ giá test hợp lý (ví dụ 100 mUSDC = 0.05 AVAX để tiết kiệm Test AVAX). |
| **R3** | Blockchain | Fuji public RPC (`api.avax-test.network`) bị chậm, timeout hoặc rate-limit lúc demo. | Trung bình | Cấu hình timeout 10s và retry 2 lần trong `BlockchainService`; chuẩn bị sẵn RPC dự phòng (ví dụ Ankr/PublicNode Fuji RPC) và quay video backup ở Day 5. |
| **R4** | Blockchain | Sai lệch decimals giữa `mUSDC` (6 decimals) và `AVAX` (18 decimals) dẫn đến tính sai số lượng nhận hoặc tràn số. | Cao | Viết unit test riêng cho công thức quy đổi decimals trong `AgentVault.test.ts` (Phase 3) và kiểm tra kỹ trước khi deploy Fuji. |
| **R5** | AI / LLM | LLM hallucinate địa chỉ contract, gọi sai tên tool hoặc sinh số âm/số cực lớn. | Cao | LLM **không bao giờ** sinh calldata hay địa chỉ contract. Mọi tool input đều qua `zod` validation; calldata do Backend build từ `.env`. |
| **R6** | AI / LLM | Gemini API bị rate-limit hoặc lỗi mạng khi đang demo trực tiếp. | Trung bình | Bắt lỗi try/catch ở `AgentOrchestrator`, trả về thông báo rõ ràng; thiết kế `ILLMProvider` để có thể chuyển model nhanh (`gemini-2.5-flash`) và chuẩn bị video demo dự phòng. |
| **R7** | Security | Rò rỉ `DEPLOYER_PRIVATE_KEY` hoặc `GEMINI_API_KEY` lên GitHub. | Cao | Tạo `.gitignore` từ Phase 1 chặn toàn bộ `.env`; kiểm tra `git status` / `git diff` trước mỗi lần commit. |
| **R8** | Security | User hiểu nhầm AI có thể tự rút tiền từ ví cá nhân. | Trung bình | Thiết kế kiến trúc Isolated Signer: User tự bấm ký `Approve` và `ExecuteSwap` trên MetaMask/Core; Backend không lưu private key. |
| **R9** | Timeline | Cố gắng tích hợp thêm database (PostgreSQL/Redis) hoặc Docker phức tạp làm trễ tiến độ 5 ngày. | Cao | Cắt bỏ hoàn toàn DB/Redis/Kafka khỏi MVP; dùng state on-chain + in-memory session. |

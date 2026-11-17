có mô phỏng đucợ không hay cần coin thực tế
Không cần coin thật đâu bro. AgentVault hoàn toàn có thể demo trên Avalanche Fuji Testnet bằng token miễn phí. Thậm chí đây là hướng mình khuyên dùng cho hackathon.

Bro có thể mô phỏng gần như toàn bộ trải nghiệm DeFi thực tế mà không phải bỏ tiền mua AVAX hay USDC.

1. Có 3 mức độ mô phỏng
Demystifying Foundry - DEV Community
Mức 1 – Local Simulation

Không cần coin
Hardhat local blockchain.

Deploy Smart Contract.

Mint token giả lập.

Test Policy và các tình huống vi phạm.

Không cần kết nối mạng.

Add a Testnet Faucet | Avalanche Builder Hub
Mức 2 – Avalanche Fuji Testnet

Khuyên dùng
Deploy Smart Contract lên blockchain công khai.

Connect Wallet thật.

Nhận AVAX miễn phí để trả gas.

Mint USDC giả lập.

Thực hiện transaction thật trên testnet.

More projects
Mức 3 – Avalanche Mainnet

Không cần cho MVP
Dùng AVAX thật.

Dùng stablecoin có giá trị thực.

Giao dịch tài sản thật.

Có rủi ro mất tiền và chi phí gas.

2. Mô hình mình đề xuất cho AgentVault
AI 代理钱包需要策略引擎来保障安全 | FoxWallet 官方网站
Thành phần

Cách triển khai

Wallet

MetaMask / Core

AVAX

Test AVAX từ Faucet

USDC

Deploy ERC-20 mock token

Smart Contract

Deploy trên Fuji

Policy Engine

Kiểm tra hạn mức On-chain

DEX

Mock Router hoặc DEX Testnet

AI Agent

Gemini Function Calling

Có một điểm cần phân biệt:

Mock DEX: Giao dịch mô phỏng, nhưng transaction và Policy vẫn chạy thật trên blockchain Fuji.

Testnet DEX: Swap qua DEX Router thực sự trên Fuji, cần có pool và thanh khoản testnet phù hợp.

Nếu muốn chứng minh khả năng tích hợp DeFi thực tế, nên ưu tiên phương án thứ hai. Nếu không tìm được pool phù hợp, dùng Mock Router và trình bày minh bạch đây là mô phỏng.

3. Bro cần chuẩn bị gì?
Các tài nguyên miễn phí

Core Wallet / MetaMask

Ví thử nghiệm riêng

Mở
Avalanche Fuji Faucet

Nhận test AVAX trả gas

Mở
Avalanche Fuji Explorer

Kiểm tra transaction và contract

Mở
Avalanche Developer Docs

Tài liệu triển khai dApp

Đọc docs
Fuji sử dụng Chain ID 43113, RPC https://api.avax-test.network/ext/bc/C/rpc. Test AVAX không có giá trị tiền thật. 

Avalanche Docs
+2

4. Một kịch bản demo rất đáng tiền
Bro có thể trình diễn hai tình huống:

Scenario A – Giao dịch hợp lệ

Allowed
User yêu cầu swap 100 USDC sang AVAX.

Policy cho phép tối đa 300 USDC/giao dịch.

Smart Contract chấp nhận giao dịch.

Scenario B – Vượt hạn mức

Rejected
User yêu cầu swap 500 USDC sang AVAX.

Policy chỉ cho phép 300 USDC/giao dịch.

Smart Contract revert transaction.

Đây là bằng chứng rất trực quan cho thông điệp: AI có thể hành động, nhưng không thể vượt quyền kiểm soát của người dùng.

Lời khuyên của mình: Với 5 ngày còn lại, đừng tốn thời gian mua coin thật. Hãy triển khai Fuji + mock ERC-20 + Policy Contract trước. Sau đó mới tích hợp DEX testnet nếu còn thời gian.

Như vậy, bro vẫn có blockchain transaction công khai, Smart Contract thực thi thật và AI Agent hoạt động end-to-end mà không phải dùng tiền cá nhân.
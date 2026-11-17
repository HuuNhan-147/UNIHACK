# ENVIRONMENT SETUP – AGENTVAULT

---

## 1. Thông tin mạng Blockchain (Avalanche Fuji Testnet)
- **Network Name:** Avalanche Fuji C-Chain
- **Chain ID:** `43113` (Hex: `0xa869`)
- **Currency Symbol:** `AVAX`
- **Primary RPC URL:** `https://api.avax-test.network/ext/bc/C/rpc`
- **Block Explorer:** `https://testnet.snowtrace.io`
- **Testnet Faucet:** `https://core.app/tools/testnet-faucet/` (hoặc Avalanche Builder Hub Faucet)

---

## 2. Cấu hình Environment Variables (`.env.example`)

> **QUY TẮC BẢO MẬT:** Không bao giờ commit file `.env` lên Git. Chỉ commit `.env.example` với giá trị rỗng hoặc placeholder.

### 2.1. `contracts/.env`
```env
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
DEPLOYER_PRIVATE_KEY=YOUR_TESTNET_ONLY_PRIVATE_KEY_HERE
SNOWTRACE_API_KEY=OPTIONAL_FOR_VERIFY
```

### 2.2. `backend/.env`
```env
PORT=4000
FRONTEND_URL=http://localhost:5173
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
CHAIN_ID=43113

# LLM Configuration (Gemini)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
GEMINI_MODEL=gemini-2.5-flash

# Deployed Contract Addresses on Fuji (Điền sau Phase 4)
MUSDC_ADDRESS=0x...
POLICY_ADDRESS=0x...
ROUTER_ADDRESS=0x...
EXECUTOR_ADDRESS=0x...
```

### 2.3. `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_CHAIN_ID=43113
VITE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
VITE_EXPLORER_URL=https://testnet.snowtrace.io
VITE_MUSDC_ADDRESS=0x...
VITE_EXECUTOR_ADDRESS=0x...
VITE_POLICY_ADDRESS=0x...
```

---

## 3. Chuẩn bị Ví (Wallet Setup)
1. Cài đặt **Core Wallet** hoặc **MetaMask** trên trình duyệt.
2. Tạo **một tài khoản ví mới hoàn toàn** chỉ dùng cho Testnet (không dùng ví chứa tài sản thật).
3. Lấy Test AVAX từ Faucet (cần khoảng `2 AVAX`: `1 AVAX` để nạp thanh khoản cho `MockDEXRouter`, `1 AVAX` để trả gas deploy và test giao dịch).
4. Xuất Private Key của ví Deployer dán vào `contracts/.env` (chỉ dùng cho script deploy, **tuyệt đối không** đưa vào `backend/.env` hay `frontend/.env`).

---

## 4. Lệnh cài đặt & chạy dự án (Dự kiến sau khi hoàn thành Phase 1–7)

### Cài đặt dependencies
```powershell
pnpm --filter contracts install
pnpm --filter backend install
pnpm --filter frontend install
```

### Chạy Smart Contract Tests & Deploy
```powershell
cd contracts
npx hardhat test
npx hardhat run scripts/deploy.ts --network fuji
```

### Chạy Backend & Frontend (Development)
```powershell
# Terminal 1 - Backend
pnpm --filter backend dev

# Terminal 2 - Frontend
pnpm --filter frontend dev
```

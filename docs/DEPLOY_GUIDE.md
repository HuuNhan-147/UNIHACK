# HƯỚNG DẪN DEPLOY AGENTVAULT LIVE TRONG 5 PHÚT (RENDER + VERCEL)

> **Mục đích:** Đảm bảo giám khảo tại `team1vn.xyz` mở được trực tiếp link DApp chạy live trên Avalanche Fuji Testnet (`Chain ID: 43113`).

---

## Bước 1: Deploy Backend lên Render (Miễn phí)

1. Đăng nhập [https://dashboard.render.com](https://dashboard.render.com) bằng tài khoản GitHub.
2. Bấm **New +** → **Blueprint** (hoặc **Web Service**) và chọn repository `UNIHACK` (nhánh `master`).
   - Nếu dùng **Blueprint**, Render sẽ tự đọc file [`render.yaml`](../render.yaml) ở thư mục gốc.
   - Nếu tạo **Web Service** thủ công:
     - **Build Command:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter backend build`
     - **Start Command:** `node backend/dist/index.js`
3. Thêm 2 biến môi trường bí mật/động trong tab **Environment**:
   - `GEMINI_API_KEYS`: Dán chuỗi API Key Gemini của bạn (cách nhau bởi dấu phẩy nếu nhiều key).
   - `FRONTEND_URL`: Tạm điền `http://localhost:5173`, sau khi có link Vercel ở Bước 2 thì cập nhật thành `http://localhost:5173,https://<ten-app-cua-ban>.vercel.app`.
4. Bấm **Deploy** và chờ 2–3 phút → kiểm tra `https://<backend-url>.onrender.com/api/health` trả về `{"status":"ok","chainId":43113,"contractsConfigured":true}`.

---

## Bước 2: Deploy Frontend lên Vercel (Miễn phí)

1. Đăng nhập [https://vercel.com](https://vercel.com) bằng tài khoản GitHub → **Add New Project** → chọn repository `UNIHACK`.
2. Trong phần **Configure Project**:
   - **Root Directory:** Chọn **`frontend`** *(quan trọng!)*.
   - Framework Preset sẽ tự nhận **Vite**.
3. Mở mục **Environment Variables** và dán đủ 7 biến sau:
   ```env
   VITE_API_BASE_URL=https://<backend-url>.onrender.com/api
   VITE_CHAIN_ID=43113
   VITE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   VITE_EXPLORER_URL=https://testnet.snowtrace.io
   VITE_MUSDC_ADDRESS=0xb8463e3a406998841d2c442EbbD247D3D4d36Ed1
   VITE_EXECUTOR_ADDRESS=0x927937eC37b343290b22893f90C00E8eE4AE6582
   VITE_POLICY_ADDRESS=0x940d6C627C55F002A42eAc257d7A36dbDe4157e7
   ```
4. Bấm **Deploy**. Khi có link `https://<ten-app>.vercel.app`, quay lại Render cập nhật `FRONTEND_URL` để cho phép CORS.

---

## Bước 3: Kiểm tra cuối trước khi nộp lên `team1vn.xyz`
- Mở link Vercel ở tab ẩn danh, kiểm tra bảng **Policy Status** và **Holdings** tải dữ liệu từ Fuji thành công.
- Mở sẵn link Vercel 1 lần trước khi quay/nộp để Render Free Tier không bị trạng thái ngủ đông (cold start).

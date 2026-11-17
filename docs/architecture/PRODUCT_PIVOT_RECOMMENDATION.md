# PRODUCT PIVOT RECOMMENDATION — AGENTVAULT

> **Mục tiêu:** Đưa ra quyết định dứt khoát về hướng phát triển tốt nhất từ nền tảng kỹ thuật hiện có, phân biệt rõ chiến lược **Thắng UniHack** vs **Thương mại hóa dài hạn**.

---

## 1. Kết luận chiến lược (Final Decision)

1. **Best Overall Product Direction:** **D3 — AgentPay Guard** *(8.18/10)* — Cổng kiểm soát ngân sách On-chain cho AI Agents thanh toán API/Dịch vụ (x402).
2. **Best Direction for Winning UniHack (Đề xuất thực thi ngay):**
   - **Nếu ưu tiên Local Angle & Dễ hiểu với mọi giám khảo:** **D2 — ClarityVault** *(8.10/10 — Quỹ CLB / Nhóm minh bạch có AI Kiểm toán & Giải ngân)*.
   - **Nếu ưu tiên Trend AI Agent Economy & B2B:** **D3 — AgentPay Guard** *(8.18/10)*.
   - **Đặc biệt:** Cả D2 và D3 (cùng D1) đều dùng chung một Smart Contract lõi (`PolicyVault.sol` tách `Owner` khỏi `Operator/AgentWallet`), nên dù chọn D2 hay D3, ta đều **giữ lại 75–80% codebase hiện tại**.
3. **Best Direction for Long-term Commercialization:** **D3 — AgentPay Guard** (khi AI Agents tự động mua dữ liệu, compute, API qua stablecoin trở thành nhu cầu thực của doanh nghiệp).
4. **Best Direction for Demonstrating Technical Capabilities:** **D1 / D3** (kết hợp `PolicyVault.sol` on-chain + `Agent Wallet` ký tự động trong hạn mức + `Tx Guardian` + `x402` hoặc `Router`).

---

## 2. Khuyến nghị chính thức: PIVOT sang "D3 (AgentPay Guard)" hoặc "D2 (ClarityVault)"

Chúng tôi **khuyến nghị từ bỏ mô hình "1 ví cá nhân tự đặt hạn mức rồi tự swap cho chính mình"** vì nghịch lý tự trói tay đã phân tích trong `PRODUCT_REDEFINITION_AUDIT.md`.

### Lựa chọn khuyến nghị số 1 cho UniHack: **AgentVault → ClarityVault (hoặc AgentPay Guard nếu muốn đánh mạnh x402)**
- **Vì sao nên chốt 1 trong 2 hướng này thay vì D1 (Swap mUSDC -> AVAX)?**
  - D1 dù có tách ví Agent Wallet, việc demo *"AI tự swap mUSDC sang AVAX qua Mock Router"* trên testnet vẫn dễ bị hỏi về tính thực tế của tỷ giá giả lập.
  - Ngược lại, với **D2 (Quỹ CLB/Nhóm)** hoặc **D3 (AI trả tiền gọi API x402)**, đồng `mUSDC` được **chuyển thẳng** cho người nhận/vendor theo đúng giá trị (1:1), **loại bỏ hoàn toàn sự phụ thuộc vào `MockDEXRouter` tỷ giá cứng**!

---

## 3. Phân loại giữ / sửa / bỏ trên Codebase hiện tại

### Keep (Giữ nguyên)
- `MockERC20.sol` (`0xb8463e...` trên Fuji — không cần deploy lại!).
- `backend/src/agent/orchestrator.ts` (Gemini REST + Multi-key Rotation + Model Fallback).
- `backend/src/services/postTx.service.ts` & `store.service.ts` (cơ chế JSON store + Audit Log + Post-Tx verification).
- `frontend/src/context/WalletContext.tsx`, `AuditLogPanel.tsx`, `AgentConfigPanel.tsx`, `ChatPanel.tsx`.

### Redesign (Thiết kế lại)
- Thay `AgentVaultExecutor.sol` + `AgentVaultPolicy.sol` bằng **1 contract gọn duy nhất `PolicyVault.sol`** (giữ `mUSDC` của `Owner`, enforce `perTxCap`, `dailyCap`, `allowedRecipients`, `revoked[operator]` **100% on-chain**).
- Thêm **Agent Execution Wallet** ở Backend (1 ví riêng chỉ giữ ít Test AVAX trả gas, thực thi lệnh `ALLOW` trong ngân sách được cấp; không giữ key của Owner!).

### Abandon (Loại bỏ)
- Loại bỏ `MockDEXRouter.sol` (và câu chuyện swap tỷ giá giả lập) nếu chuyển sang D2 (Chi trả quỹ) hoặc D3 (Thanh toán API x402).
- Loại bỏ thông điệp *"User tự đặt luật chặn chính mình"*.

---

## 4. Smallest Compelling MVP & Roadmap (1.5 ngày)

### MVP tối thiểu để demo ấn tượng tại UniHack
- **1 Smart Contract mới (`PolicyVault.sol`):** `deposit()`, `withdraw()`, `setPolicy(operator, perTxCap, dailyCap)`, `setVendor(addr, bool)`, `revokeOperator(addr)`, `executePayment(recipient, amount, memoHash)`.
- **2 Vai trò rõ ràng trên UI:**
  - **Owner (Ví MetaMask của bạn):** Nạp 500 mUSDC vào Vault, đặt hạn mức cho AI Agent (`20 mUSDC/lần`, `100 mUSDC/ngày`), bấm `Revoke` khi cần, hoặc duyệt tay các khoản `> 20 mUSDC`.
  - **AI Agent Wallet (Backend):** Tự động thực thi các khoản hợp lệ `<= 20 mUSDC` (có Tx Hash thật trên Snowtrace!).
- **4 Tình huống Demo:**
  1. **Autonomous Payment / Disbursement (`<= 20 mUSDC`):** AI tự ký bằng Agent Wallet → Thành công trên Snowtrace → Post-Tx Audit Log.
  2. **Exceeds Cap (`50 mUSDC > 20 mUSDC`):** Yêu cầu Owner ký duyệt hoặc Contract revert nếu Agent cố gọi.
  3. **Prompt Injection (Scenario C):** Bị Intent Guard chặn + Contract chặn địa chỉ ngoài whitelist.
  4. **Instant Revoke:** Owner bấm Revoke → Agent mất quyền ngay lập tức on-chain.

### Lộ trình thực hiện đề xuất (nếu bạn duyệt Pivot)
- **Bước 1 (3 giờ):** Viết `PolicyVault.sol` + Unit tests (test đủ deposit, perTxCap, dailyCap, whitelist, revoke) → Deploy lên Fuji (tốn ~0.03 AVAX).
- **Bước 2 (3 giờ):** Cập nhật Backend (`agentSigner.service.ts`, cập nhật `toolRegistry.ts` & `orchestrator.ts` sang luồng Vault Payment / x402 hoặc Club Fund).
- **Bước 3 (3 giờ):** Cập nhật UI (`Owner Console` vs `Agent Workspace` + Tx Guardian cho Vault Payment) & test End-to-End trên Fuji.

# AGENTVAULT — PRODUCT REDEFINITION AUDIT

> **Phạm vi:** Audit toàn bộ source code, Smart Contracts, Backend, Frontend và các kịch bản hiện tại để tìm vấn đề kiến trúc sản phẩm và cơ hội tái định vị.  
> **Trạng thái:** Chỉ đọc & phân tích. Không sửa code, không deploy, không thay đổi `.env`.

---

## 1. Existing Codebase Audit (Verified Findings)

### 1.1. Phân loại thực trạng kỹ thuật (Real vs Mock vs Backend-Only)

| Thành phần | Trạng thái thực tế | Bằng chứng trong mã nguồn | Phân loại tái sử dụng |
| :--- | :--- | :--- | :--- |
| `MockERC20.sol` (`0xb8463e...`) | **REAL ON-CHAIN (Testnet)** | ERC-20 chuẩn OpenZeppelin v5, 6 decimals, có `faucet()` trên Fuji (`43113`). | **Reusable without modification** (hoặc thay bằng USDC thật khi lên mainnet) |
| `AgentVaultPolicy.sol` (`0x940d6C...`) | **REAL ON-CHAIN** | Enforce `maxAmountPerTx` (`300 mUSDC`), `maxSlippageBps` (`200`), `allowedTokens`, `allowedRouters`, `Pausable`. | **Reusable with modification** (cần bổ sung per-operator/per-vault limits nếu tách Owner & Operator) |
| `AgentVaultExecutor.sol` (`0x808931...`) | **REAL ON-CHAIN** | Kéo `mUSDC` từ `msg.sender`, check `minAmountOut` on-chain, gọi `Router`. | **Should be redesigned** (nên thay bằng `Vault/Treasury/Escrow` tách chủ tiền khỏi người gọi) |
| `MockDEXRouter.sol` (`0x654309...`) | **MOCK (On-chain Simulation)** | Tỷ giá cố định `2000 mUSDC = 1 AVAX`, pool `0.2 AVAX` tự nạp, khóa `executor`. | **Should be removed or redesigned** (nếu pivot sang Thanh toán/Quỹ/Escrow thì không cần DEX Router, chỉ cần transfer USDC trực tiếp) |
| `deterministicPolicy.service.ts` & `store.service.ts` | **BACKEND-ONLY ENFORCEMENT** | Enforce `dailySpendingLimitMusdc`, `maxTransactionsPerDay`, `status` (`ACTIVE`/`PAUSED`/`REVOKED`), `expiresAt`, `detectMaliciousIntent()`. Lưu tại `backend/data/vault-store.json`. | **Reusable with modification** (làm lớp Governance Pre-check & Policy Config cho mọi sản phẩm mới) |
| `orchestrator.ts` & `toolRegistry.ts` | **REAL AI (Gemini REST)** | Multi-key Round-Robin rotation, Model Fallback (`gemini-3.5-flash-lite`), `temperature: 0.1`, `executionEvidence`, `draftPolicyFromNaturalLanguage()`. | **Reusable without modification** (chỉ đổi bộ Tools theo nghiệp vụ mới) |
| `portfolio.service.ts` | **HYBRID (On-chain + Live API)** | Balance đọc từ Fuji RPC; giá AVAX đọc live từ DefiLlama API (cache 60s). | **Reusable with modification** |
| `postTx.service.ts` & `history.service.ts` | **REAL ON-CHAIN VERIFICATION** | Đọc `getTransactionReceipt`, đối soát balance trước/sau, query `SwapExecuted` logs (95 blocks). | **Reusable without modification** |
| `AgentConfigPanel.tsx`, `PlanCard.tsx`, `TxPreviewModal.tsx`, `AuditLogPanel.tsx` | **REAL FRONTEND UI** | Đã có UI cấu hình Policy, NL Policy Builder, Revalidate Plan, Tx Guardian Inspector (4 checks), Audit Log. | **Reusable with modification** |

### 1.2. Kết quả Test đã xác minh
- Smart Contracts: `15/15` unit tests pass trên Hardhat (`AgentVault.test.ts`).
- Governance & Security Acceptance Tests: `7/7` pass (`test-governance.js`: Config update, Exceed per-swap, Valid + Revalidate modified plan, Prompt Injection block, Revoked agent block, NL Policy Draft, Audit logs).

---

## 2. Phân tích Lỗ hổng Kiến trúc Sản phẩm (Root Cause Analysis)

### 2.1. Vấn đề cốt lõi: "Self-Restriction Paradox" (Nghịch lý tự trói tay mình)
Trong `AgentVaultExecutor.sol`:
```solidity
IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
```
- **Hệ quả:** Người bấm ký trên MetaMask (`msg.sender`) chính là chủ sở hữu tiền, và cũng chính là người vào tab `Agent Config` đặt giới hạn `maxAmountPerSwap = 20 mUSDC`.
- **Tại sao đổi UI/Pitch không giải quyết được?** Dù gọi là "Guardian" hay "Anti-FOMO", một cá nhân tự tiêu tiền của chính mình qua ví cá nhân sẽ không chấp nhận việc bị phần mềm chặn khi họ đã chủ động muốn chi tiêu (họ chỉ cần vào tab bên cạnh tăng limit hoặc dùng ví trực tiếp).
- **Lỗ hổng bảo mật thứ 2:** Các luật như `Daily Limit`, `Max Tx/Day`, `Revoke Agent` hiện chỉ nằm ở `vault-store.json` (Backend). Nếu Operator có quyền gọi thẳng Smart Contract với số tiền `<= 300 mUSDC`, Smart Contract vẫn cho qua.

### 2.2. Những tài sản kỹ thuật cực giá trị đang ẩn bên dưới
Nếu tách bỏ lớp vỏ "AI Swap cá nhân", AgentVault đang sở hữu một **bộ khung hạ tầng rất mạnh**:
1. **Deterministic Policy & Governance Engine:** Kiểm soát ngân sách theo ngày/lần/số lượng giao dịch + 4-State Decision (`ROUTINE / ASK / REJECT / ESCALATE`).
2. **Natural Language → Structured Policy Draft:** Chuyển yêu cầu ngôn ngữ tự nhiên thành JSON Policy có kiểm tra ràng buộc.
3. **Zero-Trust AI Guard + Tx Guardian Inspector:** Chặn Prompt Injection trước khi gọi LLM, dịch calldata sang ngôn ngữ dễ hiểu trước khi ký.
4. **Post-Tx Verification & Audit Trail:** Đối soát receipt on-chain thực tế và lưu dấu vết kiểm toán.

---

## 3. Kết luận Audit: Điểm mấu chốt để Pivot thành công
Để AgentVault trở thành một sản phẩm **người dùng thực sự cần và Blockchain là bắt buộc**, kiến trúc phải phá vỡ mô hình *1 ví tự trói mình* bằng cách **tách biệt 3 vai trò**:
1. **Asset Owner (Chủ tiền / Chủ quỹ):** Nạp tiền vào Vault/Escrow, đặt luật On-chain, giữ quyền rút vốn & Revoke tối cao.
2. **Executor / Spender (AI Agent Wallet hoặc Thành viên / Đối tác):** Thực thi giao dịch trong phạm vi ngân sách được cấp, **không thể sửa luật**.
3. **AI Copilot / Auditor:** Phân tích ngữ cảnh (hóa đơn, bằng chứng, chi tiêu, rủi ro) và chuẩn bị kế hoạch/báo cáo minh bạch, **không nắm quyền vượt Policy**.

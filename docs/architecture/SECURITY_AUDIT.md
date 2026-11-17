# SECURITY & ARCHITECTURE AUDIT – AGENTVAULT SMART CONTRACTS

> **Phạm vi kiểm tra:** `MockERC20.sol`, `AgentVaultPolicy.sol`, `MockDEXRouter.sol`, `AgentVaultExecutor.sol`, `AgentVault.test.ts`, `deploy.ts`  
> **Trạng thái:** Audit tĩnh + đối chiếu kết quả chạy test Hardhat (`6 passing (8s)`). **Chưa sửa code.**

---

## 1. Tóm tắt mức độ nghiêm trọng (Findings Summary)

| ID | Mức độ | Tiêu đề | Hợp đồng ảnh hưởng |
| :--- | :--- | :--- | :--- |
| **F-01** | **High** | `minAmountOut` không được kiểm chứng on-chain theo `slippageBps` (có thể truyền `minAmountOut = 0` để vượt kiểm soát slippage) | `AgentVaultPolicy.sol`, `AgentVaultExecutor.sol` |
| **F-02** | **High** | `MockDEXRouter` cho phép gọi trực tiếp từ bên ngoài, có thể bypass `AgentVaultExecutor` & `AgentVaultPolicy` | `MockDEXRouter.sol` |
| **F-03** | **Medium** | `tokenOut` bị bỏ qua ở tầng Executor/Router và không kiểm tra `tokenIn != tokenOut` | `AgentVaultExecutor.sol`, `AgentVaultPolicy.sol` |
| **F-04** | **Medium** | `MockDEXRouter.getAmountOut` hardcode giả định `tokenIn` có 6 decimals | `MockDEXRouter.sol` |
| **F-05** | **Low** | Chưa có `dailyLimit` cộng dồn theo từng user (mới có `maxAmountPerTx` trên từng giao dịch) | `AgentVaultPolicy.sol` |
| **F-06** | **Low** | Thiếu các negative/edge-case tests (non-owner admin call, `amountIn = 0`, `InsufficientRouterLiquidity`, multi-user isolation) | `AgentVault.test.ts` |

*(Không phát hiện lỗi **Critical** làm mất tiền trực tiếp từ ví người dùng hoặc cho phép AI tự rút tài sản mà không có chữ ký của User).*

---

## 2. Kiểm tra chi tiết 10 hạng mục

### 2.1. Access Control
- **Owner (`deployer`):** Kế thừa `Ownable` từ OpenZeppelin v5. Chỉ `owner()` được phép:
  - Thay đổi `maxAmountPerTx`, `maxSlippageBps`, `allowedTokens`, `allowedRouters` và `pause()`/`unpause()` trên `AgentVaultPolicy.sol`.
  - Gọi `pause()`/`unpause()` trên `AgentVaultExecutor.sol`.
  - Gọi `setRate()`, `withdrawNative()` trên `MockDEXRouter.sol` và `mint()` trên `MockERC20.sol`.
- **User (`msg.sender`):** Tự gọi `faucet()` trên `MockERC20` và tự ký `approve()` + `executeSwap()` trên `AgentVaultExecutor`.
- **AI Agent (Backend):** Không có bất kỳ quyền hay role nào trên Smart Contract. AI không giữ private key của User và không giữ private key của Owner.
- **Kết luận:** **An toàn.** AI Agent không thể tự thay đổi Policy hoặc rút tài sản người dùng.

### 2.2. User Isolation
- `AgentVaultExecutor` kéo token trực tiếp từ `msg.sender` (`IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn)`) và trả `AVAX` về chính `msg.sender`.
- Vì chưa có state lưu hạn mức theo ngày, mọi kiểm tra trong `AgentVaultPolicy` hiện là stateless theo từng giao dịch (`amountIn <= maxAmountPerTx`).
- **Kết luận:** User A không thể dùng số dư hay allowance của User B; tuy nhiên chưa có cơ chế tùy biến hạn mức riêng cho từng user.

### 2.3. Execution Flow
Luồng thực tế hiện tại:
`User (Prompt) → Backend AI (Plan) → User (Sign Approve + Sign executeSwap) → AgentVaultExecutor → AgentVaultPolicy.validateSwap() → MockDEXRouter.swapExactTokensForNative() → User nhận AVAX`
- **Điểm mạnh:** Tách biệt hoàn toàn Off-chain Planning và On-chain Execution.
- **Điểm yếu:** Như nêu ở **F-02**, User hoặc bất kỳ địa chỉ nào vẫn có thể gọi thẳng `MockDEXRouter` mà không đi qua `AgentVaultExecutor`.

### 2.4. Token Approval
- `AgentVaultExecutor.sol` sử dụng `IERC20(tokenIn).forceApprove(address(router), amountIn)` từ `SafeERC20`, chỉ cấp quyền đúng bằng `amountIn` cho `MockDEXRouter` trong đúng giao dịch đó (sau khi `transferFrom` xong, allowance về `0`).
- Phía User: Giao diện cần yêu cầu User `approve` đúng `amountIn` (exact approval) thay vì `MaxUint256` để giảm thiểu rủi ro cấp quyền quá mức.

### 2.5. Router Security
- `AgentVaultPolicy` có `allowedRouters` mapping và kiểm tra `!allowedRouters[router]`.
- `AgentVaultExecutor` lưu `router` dạng `immutable` nên không thể bị thay thế âm thầm sau khi deploy.
- **Lưu ý (F-02):** `MockDEXRouter.swapExactTokensForNative` hiện là `external` không kiểm tra `msg.sender == executor`, nên có thể bị gọi trực tiếp để bypass Policy trên Testnet.

### 2.6. Slippage (F-01 – High)
- **Thực trạng code:**
  - `AgentVaultPolicy.validateSwap(...)` dòng 49–51 chỉ kiểm tra `if (slippageBps > maxSlippageBps) revert SlippageTooHigh(...)`.
  - `AgentVaultExecutor.executeSwap(...)` nhận `minAmountOut` và truyền thẳng xuống `MockDEXRouter`, **không hề kiểm tra** mối liên hệ giữa `minAmountOut` và `slippageBps`.
- **Rủi ro:** Một frontend/backend bị lỗi hoặc bị tấn công có thể truyền `slippageBps = 100` (1%, pass Policy) nhưng set `minAmountOut = 0`. Nếu dùng trên DEX thật có biến động giá, user có thể bị MEV/sandwich attack mất gần hết giá trị nhận về mà Policy không chặn được.

### 2.7. Reentrancy và Token Safety
- Cả `AgentVaultExecutor.executeSwap` và `MockDEXRouter.swapExactTokensForNative` đều gắn `nonReentrant` (`ReentrancyGuard`).
- Sử dụng `SafeERC20` (`safeTransferFrom`, `forceApprove`).
- Chuyển native AVAX dùng `.call{value: amountOut}("")` và kiểm tra kết quả trả về (`if (!sent) revert NativeTransferFailed()`).
- **Kết luận:** **An toàn** trước tấn công reentrancy.

### 2.8. Emergency Pause
- `AgentVaultPolicy` có `pause()` / `unpause()` (`onlyOwner`), chặn `validateSwap` bằng modifier `whenNotPaused`.
- `AgentVaultExecutor` cũng có `pause()` / `unpause()` (`onlyOwner`), chặn `executeSwap` bằng `whenNotPaused`.
- Chỉ `owner()` mới có quyền `unpause()`.
- **Lưu ý:** `MockDEXRouter` không có `Pausable`, nên nếu chỉ pause `Policy`/`Executor` mà chưa khóa Router (F-02), người gọi trực tiếp Router vẫn swap được.

### 2.9. Daily Limit (Đề xuất thiết kế tối giản)
- Hiện tại chưa có `dailyLimit` trong `AgentVaultPolicy.sol`.
- **Cách bổ sung gọn nhẹ (không làm phức tạp MVP):**
  - Thêm `uint256 public dailyLimitPerUser;` (ví dụ `600 * 10**6`) và `mapping(address => mapping(uint256 => uint256)) public dailySpent;` (với `uint256 day = block.timestamp / 1 days;`).
  - Đổi hàm `validateSwap` thành `validateAndRecordSwap(address user, ...)` chỉ cho phép `allowedExecutors[msg.sender]` gọi để tránh người ngoài làm giả `dailySpent` của user khác!

### 2.10. Transaction Failure & Rollback
- Nếu `Policy` revert (`ExceedsMaxTxAmount`, `TokenNotAllowed`, `SlippageTooHigh`, `EnforcedPause`), giao dịch rollback trước khi `safeTransferFrom` chạy → User không mất token, chỉ tốn chút gas.
- Nếu `MockDEXRouter` revert (`InsufficientOutputAmount`, `InsufficientRouterLiquidity`), toàn bộ giao dịch (bao gồm `transferFrom` trước đó) đều rollback nguyên tử (atomic).

---

## 3. Trả lời 6 câu hỏi kiểm tra đặc biệt

| Câu hỏi | Kết quả | Bằng chứng / Giải thích |
| :--- | :--- | :--- |
| **1. User A có thể sử dụng hạn mức của User B không?** | **Không** | Hiện chỉ có `maxAmountPerTx` áp dụng độc lập cho từng tx; `safeTransferFrom` chỉ kéo từ `msg.sender`. Nếu thêm `dailyLimit` sau này, phải dùng `dailySpent[user][day]` và chỉ cho `Executor` ghi. |
| **2. AI Agent có thể swap vượt `maxAmountPerTx` không?** | **Không** | Test case `Scenario B` trong `AgentVault.test.ts` đã chứng minh: truyền `500 mUSDC` (> `300 mUSDC`) bị `AgentVaultPolicy` revert với `ExceedsMaxTxAmount(500000000, 300000000)`. |
| **3. AI Agent có thể thay đổi token allowlist không?** | **Không** | `setAllowedToken` gắn `onlyOwner`. AI Agent không có quyền Owner. |
| **4. Có thể bypass policy bằng cách gọi trực tiếp Router không?** | **CÓ (F-02)** | `MockDEXRouter.swapExactTokensForNative` hiện là `external` không check `msg.sender == executor`. Cần khóa chỉ cho `Executor` gọi (nếu muốn mô phỏng môi trường khép kín) hoặc ghi nhận rõ đặc thù Router công khai. |
| **5. Có thể sử dụng token có decimals khác nhau không?** | **CHƯA AN TOÀN (F-04)** | `MockDEXRouter.getAmountOut` hardcode `(amountInMusdc * 1e18) / rateMusdcPerAvax`, chỉ đúng với token `6 decimals`. Token `18 decimals` sẽ bị tính sai `10^12` lần. |
| **6. Có thể thực hiện giao dịch khi contract đã paused không?** | **Không (qua Executor)** | Test case `Blocks swaps when Emergency Pause is active` đã chứng minh `executeSwap` revert với `EnforcedPause`. Tuy nhiên vẫn bị bypass nếu gọi thẳng Router (F-02). |

---

## 4. Những phần đã an toàn vs. Cần sửa trước khi deploy Fuji

### Đã an toàn
- Phân quyền `Ownable` chặt chẽ; AI Agent hoàn toàn tách khỏi quyền Admin và User funds.
- Chống Reentrancy (`ReentrancyGuard`) và xử lý ERC-20 an toàn (`SafeERC20`).
- Custom Errors rõ ràng phục vụ decode lỗi trên Frontend.
- Đã có 6 unit tests pass trên Hardhat local.

### Cần sửa trước khi deploy Fuji (Khuyến nghị)
1. **Fix F-01 (High):** Trong `AgentVaultExecutor` hoặc `AgentVaultPolicy`, tính `expectedOut = router.getAmountOut(amountIn)` và enforce `minAmountOut >= expectedOut * (10_000 - slippageBps) / 10_000` on-chain (không tin tưởng `minAmountOut` từ off-chain một cách mù quáng).
2. **Fix F-02 (High):** Thêm `address public executor` (hoặc `allowedCaller`) vào `MockDEXRouter` để ngăn gọi trực tiếp Router nhằm bypass Policy trong môi trường demo.
3. **Fix F-03 (Medium):** Thêm kiểm tra `if (tokenIn == tokenOut) revert SameTokenSwap();` và kiểm tra `tokenOut == address(0)` (vì Router hiện tại chỉ trả Native AVAX).
4. **Fix F-04 (Medium):** Chuẩn hóa `decimals` trong `MockDEXRouter` (đọc `IERC20Metadata(tokenIn).decimals()` hoặc chỉ cho phép `tokenIn == mUSDC`) để tránh sai số nếu mở rộng token sau này.
5. **Bổ sung Test (F-06):** Thêm test cho `minAmountOut` giả mạo, direct router call bị chặn, `ZeroAmount`, `SameTokenSwap`, và `non-owner` gọi hàm admin.

---

## 5. Đề xuất Scope MVP cuối cùng

- **Giữ nguyên scope 1 chiều `mUSDC → AVAX`** cho MVP 5 ngày để đảm bảo ổn định tuyệt đối cho Scenario A & B.
- **Nên vá 4 điểm F-01 → F-04** (chỉ mất ~15 phút sửa contract + thêm test) trước khi deploy lên Fuji để đảm bảo bài audit đạt chuẩn 100% khi giám khảo đọc code Smart Contract.
- **`dailyLimit` per user (F-05):** Có thể bổ sung ngay cùng đợt sửa này nếu muốn, hoặc giữ làm *Future Enhancement* nếu ưu tiên đẩy nhanh sang Backend & Frontend.

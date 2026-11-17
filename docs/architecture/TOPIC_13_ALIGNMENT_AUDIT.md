# TOPIC 13 ALIGNMENT AUDIT — AGENTVAULT DEFI COPILOT

**Đề tài:** Topic #13 — *DeFi Copilot: A chatbot harness that operates DeFi on Avalanche in natural language: read tools for on-chain data, write tools that go through an allowance, analysis without forecasting, and an eval set.*

---

## 1. Bảng đối chiếu 4 trụ cột bắt buộc của Topic #13

| Yêu cầu của Topic #13 | Hiện thực trong AgentVault | Trạng thái |
| :--- | :--- | :--- |
| **1. Read tools for on-chain data** | **7 Read Tools** xác định (`get_portfolio`, `get_policy_rules`, `get_tx_history`, `get_swap_quote`, `analyze_portfolio_allocation`, `calculate_position_risk`, `get_avalanche_protocol_yields`) đọc dữ liệu thật từ Avalanche Fuji RPC, Chainlink Feed, Glacier API, Aave V3 (khi cấu hình) và DeFiLlama. | **Đạt 100%** |
| **2. Write tools through an allowance** | **3 Write Tools** (`plan_swap`, `plan_set_allowance`, `plan_revoke_allowance`). Mọi giao dịch đều kiểm tra `AgentVaultPolicy` (`maxAmountPerTx = 300 mUSDC`, `maxSlippageBps = 200`, whitelists) cả ở Backend lẫn on-chain, bắt buộc qua **Tx Guardian** và chữ ký ví người dùng. | **Đạt 100%** |
| **3. Analysis without forecasting** | Hệ thống ép luật *No Forecast / No Hallucination* trong `SYSTEM_INSTRUCTION` và bộ lọc `detectForecastRequest()`. Từ chối dự đoán giá/cam kết lãi; chỉ tính toán xác định (ví dụ: sụt giảm 20%, Health Factor theo công thức). | **Đạt 100%** |
| **4. Evaluation Set** | Bộ **30 test cases song ngữ (Việt/Anh)** trong `backend/eval/cases.json` & `runner.ts`, bao phủ 4 nhóm: Read/Analysis (10), Valid Write (8), Guardrail/Security (7), No-Forecast/No-Hallucination (5) + kiểm tra Session Isolation. | **Đạt 100% (30/30)** |

---

## 2. Cô lập phạm vi (Scope Hygiene)

* Các thành phần thử nghiệm cũ thuộc nhánh `x402` (`SpendGuardVault.sol`, `SpendGuardPanel`, routes `/vault/*`, `/x402/*`) đã được **gỡ khỏi luồng giao diện và API chính** để sản phẩm tập trung 100% vào bài toán **DeFi Copilot (Topic #13)**.
* `SpendGuardVault.sol` chỉ giữ lại trong `contracts/contracts/` như mã nguồn tham chiếu độc lập và vẫn pass đủ 6/6 unit tests.

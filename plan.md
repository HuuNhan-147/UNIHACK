# AGENTVAULT — TOPIC 13 DEFI COPILOT ALIGNMENT & IMPLEMENTATION

## 1. ROLE

Act as a Senior AI Agent Engineer, Avalanche Blockchain Engineer, Full-stack Architect, and Technical Product Engineer.

You are responsible for transforming the existing AgentVault project into a complete, coherent, demonstrable implementation of:

**Topic #13 — DeFi Copilot**

Your task is to inspect, plan, implement, test, and document all required changes.

Do not merely produce recommendations. You are authorized to modify the codebase and implement the approved product scope described below.

However, preserve existing working functionality and avoid unnecessary rewrites.

---

## 2. OFFICIAL PRODUCT DIRECTION

The product must align with Topic #13:

**DeFi Copilot**

"A chatbot harness that operates DeFi on Avalanche in natural language: read tools for on-chain data, write tools that go through an allowance, analysis without forecasting, and an eval set."

This is the definitive product direction.

Do not continue positioning AgentVault primarily as:

- AI Autonomous Treasury.
- AI Agent Wallet Infrastructure.
- Autonomous AI Trading Bot.
- AI Market Prediction.
- x402 Agent Economy.
- Full Smart Account infrastructure.

The product is an AI-powered DeFi Copilot that allows users to understand their Avalanche portfolio, analyze DeFi data, and execute selected DeFi actions through natural language.

### Core product principles

1. Natural-language DeFi interaction.
2. Real Avalanche on-chain data.
3. Reliable AI Function Calling.
4. Deterministic calculations and risk analysis.
5. User-controlled transaction signing.
6. On-chain allowance and spending restrictions.
7. Transaction preview before execution.
8. No fabricated financial data.
9. No price forecasting.
10. Reproducible agent evaluation.

The user must retain control over transaction signing.

The AI must never independently sign or execute transactions using the user's private key.

---

## 3. FIRST: FULL CODEBASE AUDIT

Before modifying anything, inspect the entire repository.

Read:

- `AGENTVAULT_POLICY_GOVERNANCE_IMPLEMENTATION_PLAN.md`
- `README.md`
- All Smart Contracts.
- Backend agent orchestration.
- Tool registry.
- Policy engine.
- Transaction execution services.
- Frontend chat and transaction components.
- Wallet integration.
- Deployment configuration.
- Existing tests.
- Existing evaluation or scenario scripts.
- Existing API integrations.

Identify the actual state of every feature.

Classify each feature as:

- IMPLEMENTED_AND_VERIFIED.
- IMPLEMENTED_BUT_UNVERIFIED.
- PARTIALLY_IMPLEMENTED.
- NOT_IMPLEMENTED.
- MOCKED.
- OBSOLETE_OR_OUT_OF_SCOPE.

Do not trust documentation without checking the implementation.

Inspect the existing Git state before modifying files.

Never overwrite unrelated user changes.

---

## 4. TARGET ARCHITECTURE

The final architecture should follow this flow:

User
→ Chat Interface
→ Agent Orchestrator
→ Gemini Function Calling
→ Tool Registry
→ Read Tools / Write Tools
→ Deterministic Policy Engine
→ Transaction Preview
→ User Wallet Signature
→ Avalanche Smart Contract
→ Post-Transaction Verification
→ Audit Log

The AI should select and orchestrate tools, but deterministic services and Smart Contracts must enforce security-sensitive rules.

Do not let the LLM independently calculate financial balances, health factors, liquidation prices, or spending permissions.

---

## 5. IMPLEMENTATION WORKSTREAMS

### WORKSTREAM A — AI Agent Harness

Inspect and improve:

- `orchestrator.ts`
- `toolRegistry.ts`
- Gemini Function Calling integration.
- `SYSTEM_INSTRUCTION`.
- Tool execution loop.

Requirements:

1. Maintain a reliable multi-turn conversation.
2. Support per-session conversation memory.
3. Implement bounded tool-calling iterations.
4. Validate tool arguments using schemas.
5. Handle malformed tool calls.
6. Handle API timeouts and failures.
7. Prevent duplicate transaction planning.
8. Separate read-only tools from write tools.
9. Return structured tool execution results.
10. Ensure the LLM never fabricates tool outputs.

Add explicit behavioral rules:

- Only use verified tool outputs for financial facts.
- Never invent token balances, transaction history, APY, TVL, or prices.
- Never predict future token prices.
- Never present historical returns as guaranteed future returns.
- Refuse unsupported financial calculations.
- Never bypass the policy engine.
- Never claim a transaction succeeded before on-chain confirmation.

Use existing architectural patterns wherever possible.

### WORKSTREAM B — Read Tools

Target: 6–8 meaningful read tools.

Audit existing tools first.

Preserve and improve existing implementations where possible.

Potential tools:

1. `get_portfolio`
   - Read wallet token balances.
   - Display token quantities and available valuation data.
   - Identify data source and timestamp.

2. `get_policy_rules`
   - Read active spending allowance.
   - Read maximum transaction amount.
   - Read slippage limits.
   - Read token and protocol restrictions.

3. `get_vault_status`
   - Read relevant vault balances and contract status.

4. `get_tx_history`
   - Retrieve actual Avalanche transaction history.
   - Reuse `history.service.ts`.
   - Integrate Glacier API where appropriate.

5. `get_swap_quote`
   - Retrieve a genuine executable quote when a real DEX integration is available.
   - Return expected output, price impact, slippage, route, and quote timestamp.
   - Clearly distinguish quotes from executed transactions.

6. `get_avalanche_protocol_yields`
   - Retrieve protocol yield data from a reliable API such as DeFiLlama.
   - Filter by Avalanche.
   - Return protocol, pool, TVL, APY, and data freshness.
   - Clearly disclose that APY is variable and not guaranteed.

7. `analyze_portfolio_allocation`
   - Calculate token allocation using actual portfolio data.
   - Use deterministic calculations.

8. `calculate_position_risk`
   - Calculate risk metrics only when sufficient verified position data exists.
   - Do not invent collateral, debt, oracle prices, liquidation thresholds, or protocol parameters.

Important:

Do not create meaningless tools just to reach eight tools.

Six reliable tools are better than eight fake or redundant tools.

### WORKSTREAM C — Write Tools

Target: 2–3 meaningful write tools.

Preserve existing:

`plan_swap`

Inspect its full execution path.

Requirements:

- Validate token addresses.
- Validate amounts.
- Validate recipient and spender.
- Validate slippage.
- Check allowance.
- Check policy restrictions.
- Generate transaction preview.
- Require explicit user confirmation.
- Require user wallet signature.
- Verify actual transaction result.

Potential additional tools:

`plan_vault_deposit`

`plan_vault_withdraw`

Only implement these if they are genuine, useful, and compatible with the existing deployed SpendGuardVault architecture.

Do not expose administrative or owner-only operations as ordinary user write tools.

Every write tool must produce a pending transaction plan rather than execute immediately.

The user must explicitly approve and sign.

### WORKSTREAM D — On-chain Allowance & Policy

Inspect:

- `AgentVaultPolicy.sol`
- `AgentVaultExecutor.sol`
- `SpendGuardVault.sol`
- `MockERC20.sol`
- `MockDEXRouter.sol`

The target is Topic 13's simple allowance model, not a full autonomous treasury governance system.

Preserve existing contracts if they already satisfy the required behavior.

Requirements:

- Simple spending cap.
- Maximum transaction amount.
- Slippage restriction where applicable.
- Token/protocol restrictions where implemented.
- Explicit allowance verification.
- User-controlled signing.
- Revocation of allowance where supported.

Do not introduce unnecessary Treasury or Agent Wallet architecture.

Do not deploy new contracts unless necessary and explicitly justified.

Important: distinguish between ERC20 token approval, contract-level spending limits, and actual policy enforcement. They are not interchangeable.

### WORKSTREAM E — Deterministic DeFi Analysis

Inspect existing calculation and risk services.

Implement or improve:

- Portfolio allocation.
- Token balance calculations.
- Swap output calculations.
- Slippage calculations.
- Price impact calculations when supported by actual quote data.
- Health Factor.
- Liquidation Price, only for supported lending positions with verified parameters.

For every calculation:

- Use deterministic code.
- Validate inputs.
- Handle missing data.
- Avoid floating-point precision errors in token amounts and financial calculations.
- Use appropriate decimal and bigint handling.
- Provide calculation assumptions and source information.

Do not fabricate lending positions just to demonstrate liquidation calculations.

If the current Fuji environment lacks a genuine lending position or reliable protocol data, explicitly report the limitation.

### WORKSTREAM F — No Forecasting & Anti-Hallucination

Update `SYSTEM_INSTRUCTION` and tool handling.

The agent must refuse requests such as:

- Will AVAX increase tomorrow?
- Predict the price of AVAX next week.
- Which token will generate the highest return?
- Guarantee the best APY.

However, it can answer:

- What is my current AVAX balance?
- What is my current portfolio allocation?
- What happened to my portfolio historically?
- What is the current quoted swap output?
- What are the published APYs?
- What would my allocation look like after a hypothetical swap?

Always distinguish facts, historical data, current quotes, and hypothetical scenarios.

### WORKSTREAM G — Per-session Memory

Implement proper conversation history management.

Requirements:

- Isolate conversation history by `sessionId`.
- Preserve message order.
- Store user and assistant messages.
- Store tool calls and corresponding tool responses correctly.
- Prevent sessions from leaking into each other.
- Add reasonable history limits.
- Handle session expiration or cleanup.
- Avoid persisting sensitive wallet credentials or private keys.

Use the existing backend storage architecture if appropriate.

Do not introduce Redis or another database solely for this feature if a simpler existing mechanism is sufficient.

### WORKSTREAM H — Evaluation Framework

This is a major deliverable.

Create:

`backend/eval/cases.json`

`backend/eval/runner.ts`

`backend/eval/README.md`

Target at least 30 reproducible test cases in Vietnamese and English.

Organize them into four categories:

**1. Read & Analysis — 10 cases**

- Portfolio balance.
- Token allocation.
- Transaction history.
- Policy rules.
- Vault status.
- Swap quotes.
- Avalanche protocol yields.
- Historical data.
- Supported risk calculations.
- Hypothetical portfolio allocation.

**2. Valid Write Actions — 8 cases**

- Valid swap request.
- Different swap amounts.
- Valid deposit request if supported.
- Valid withdrawal request if supported.
- Missing parameters.
- Invalid token.
- Excessive slippage.
- User confirmation workflow.

**3. Guardrails & Security — 7 cases**

- Spending cap exceeded.
- Insufficient allowance.
- Unauthorized token.
- Unauthorized protocol.
- Prompt injection.
- Invalid transaction arguments.
- Attempt to bypass user confirmation.

**4. No-Hallucination & Forecast Refusal — 5 cases**

- Future price prediction.
- Unsupported token information.
- Missing portfolio data.
- Unsupported protocol yield.
- Unsupported liquidation calculation.

The evaluation runner must test actual behavior rather than merely checking whether a tool name appears in the model response.

Measure:

- Intent Recognition Accuracy.
- Tool Selection Accuracy.
- Argument Validation Accuracy.
- Guardrail Block Rate.
- Forecast Refusal Rate.
- Unsupported Claim Rate.
- Transaction Approval Enforcement.

Include:

- Total test cases.
- Passed cases.
- Failed cases.
- Failure details.
- Overall metrics.
- Reproducibility information.

Separate deterministic tests from LLM-dependent tests.

Use mocks only for isolated tests and clearly label them.

Do not present mock evaluation results as proof of live on-chain execution.

### WORKSTREAM I — Frontend Product Alignment

Inspect and preserve useful existing components:

- `ChatPanel.tsx`
- `TxPreviewModal.tsx`
- `AssetAllocation.tsx`
- `HoldingsTable.tsx`
- `AuditLogPanel.tsx`

The interface must communicate one coherent product:

**AgentVault — AI DeFi Copilot on Avalanche**

The primary user journey should be:

1. Connect Avalanche wallet.
2. View portfolio.
3. Ask questions in natural language.
4. Receive answers based on real data.
5. Request a DeFi action.
6. Preview the transaction.
7. Review allowance and policy checks.
8. Confirm and sign with wallet.
9. View transaction status.
10. Inspect audit history.

Make it obvious which operations are read-only and which require a signature.

Do not redesign the entire frontend without a concrete reason.

Remove UI elements that advertise obsolete functionality.

---

## 6. REMOVE OR DEPRECATE OUT-OF-SCOPE FUNCTIONALITY

Audit the following:

- x402 mock service.
- Autonomous Agent Wallet workflows.
- Autonomous execution runners.
- Treasury administration screens.
- Unused policy governance workflows.
- Unused experimental tools.
- Old product messaging.
- Duplicate transaction flows.

For each item, decide:

- KEEP.
- REFACTOR.
- DEPRECATE.
- REMOVE.

Do not blindly delete code.

Before removing anything:

1. Search all references.
2. Check dependencies.
3. Check tests.
4. Check whether another feature depends on it.
5. Confirm it is not required for Topic 13.

Preserve reusable infrastructure even if its previous product positioning is obsolete.

If safe removal is not justified, deprecate it and exclude it from the primary user experience.

---

## 7. AVALANCHE INTEGRATION REQUIREMENTS

Make Avalanche integration meaningful.

Inspect the existing Fuji deployment and verify:

- Chain ID.
- Contract addresses.
- Contract bytecode.
- Contract ownership.
- Token addresses.
- Router configuration.
- RPC connectivity.
- Actual transaction hashes.
- Explorer verification where available.

Use Avalanche-specific data sources where appropriate, including Glacier API.

Do not claim that Avalanche subnet precompiles are integrated unless they actually are.

Do not fabricate TVL, APY, swap quotes, or transaction results.

Clearly label mock router and mock token functionality.

Do not silently mix Fuji testnet data with Avalanche mainnet protocol data.

---

## 8. DOCUMENTATION ALIGNMENT

Update the project documentation to reflect the final Topic 13 direction.

Update:

- `README.md`
- `AGENTVAULT_POLICY_GOVERNANCE_IMPLEMENTATION_PLAN.md` or replace it with an updated implementation plan.
- Architecture documentation.
- Environment configuration examples.
- Deployment instructions.
- Evaluation documentation.
- Demo instructions.

Remove obsolete product descriptions.

The final pitch must consistently describe AgentVault as an AI DeFi Copilot.

Do not claim production readiness based solely on a successful Fuji deployment.

---

## 9. IMPLEMENTATION PRIORITIES

Work in the following order:

**P0 — Product correctness**
- Audit actual codebase.
- Confirm architecture.
- Fix critical transaction and policy issues.
- Preserve user signing.

**P1 — Core Topic 13 requirements**
- Agent harness.
- Session memory.
- Read tools.
- Write tools.
- Deterministic analysis.
- No-forecasting behavior.

**P2 — Evaluation**
- 30 bilingual test cases.
- Evaluation runner.
- Metrics and reports.

**P3 — Frontend and documentation**
- Coherent DeFi Copilot workflow.
- Remove obsolete UI.
- Update README and architecture.

**P4 — Final verification**
- Unit tests.
- Integration tests.
- Contract tests.
- Frontend build.
- Backend build.
- Evaluation runner.
- Fuji transaction verification.

Do not sacrifice transaction security to meet a feature count.

---

## 10. EXECUTION RULES

You are authorized to implement changes.

However:

- Inspect Git status before editing.
- Never overwrite unrelated user modifications.
- Do not delete existing deployment records.
- Do not modify secrets or expose `.env` contents.
- Do not deploy contracts without explicit approval.
- Do not spend real funds.
- Do not switch networks without explicit configuration.
- Do not introduce unnecessary dependencies.
- Do not break existing working functionality.
- Add tests for every meaningful change.
- Run relevant tests after implementation.

If an external API, protocol, or contract is unavailable, implement a safe fallback or report the blocker. Never fake a successful integration.

If an architectural decision could affect deployed contracts or existing user assets, stop and request approval.

---

## 11. REQUIRED FINAL DELIVERABLES

Produce:

1. `TOPIC_13_ALIGNMENT_AUDIT.md`
2. `TOPIC_13_IMPLEMENTATION_REPORT.md`
3. `TOPIC_13_EVALUATION_REPORT.md`
4. `TOPIC_13_FINAL_ARCHITECTURE.md`
5. `TOPIC_13_DEMO_SCRIPT.md`

The final report must include:

- What existed before.
- What was missing.
- What was implemented.
- What was removed or deprecated.
- What was preserved.
- Tests executed and their actual results.
- Known limitations.
- External integration blockers.
- Deployment status.
- Remaining tasks.

Include a Topic 13 compliance checklist.

Do not mark a requirement complete unless there is implementation or test evidence.

---

## 12. DEFINITION OF DONE

AgentVault is considered aligned with Topic 13 only when:

- [ ] The product clearly operates as a DeFi Copilot.
- [ ] Users can interact through natural language.
- [ ] The AI uses a structured tool registry.
- [ ] Conversation sessions maintain isolated memory.
- [ ] Read tools return verifiable Avalanche data.
- [ ] Write tools generate valid transaction plans.
- [ ] Every write transaction requires explicit user confirmation and wallet signing.
- [ ] On-chain allowance restrictions are enforced.
- [ ] Financial calculations are deterministic.
- [ ] Unsupported financial claims are refused.
- [ ] Price forecasting is disabled.
- [ ] A reproducible bilingual evaluation set contains at least 30 cases.
- [ ] Evaluation metrics are generated from actual test execution.
- [ ] The frontend demonstrates the complete user journey.
- [ ] Documentation consistently reflects Topic 13.
- [ ] All existing tests and new tests have been executed and results documented.

A partially completed checklist must be reported honestly.

## FINAL DIRECTIVE

Transform AgentVault into a coherent, reliable, technically credible Topic 13 DeFi Copilot.

Prioritize actual user value, reliable AI tool orchestration, genuine Avalanche integration, safe transaction execution, and measurable evaluation quality.

Do not overengineer.

Do not introduce autonomous treasury features merely because they are technically interesting.

Do not add features just to increase the number of tools.

Build the smallest complete and convincing product that demonstrates the official Topic 13 concept.

Start by auditing the repository, then implement incrementally and verify each workstream.

At the end, provide a concise summary of all code changes and remaining blockers.
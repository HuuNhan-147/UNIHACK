import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const FUJI_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 43113);
const FUJI_CHAIN_HEX = "0xa869";
const FUJI_RPC_URL =
  import.meta.env.VITE_FUJI_RPC_URL ||
  "https://api.avax-test.network/ext/bc/C/rpc";
const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER_URL || "https://testnet.snowtrace.io";

const MUSDC_ADDRESS = import.meta.env.VITE_MUSDC_ADDRESS || "";

const ERROR_ABI = [
  "error ZeroAmount()",
  "error ZeroAddress()",
  "error SameTokenSwap()",
  "error ExceedsMaxTxAmount(uint256 requested, uint256 maxAllowed)",
  "error TokenNotAllowed(address token)",
  "error RouterNotAllowed(address router)",
  "error SlippageTooHigh(uint256 requestedBps, uint256 maxBps)",
  "error EnforcedPause()",
  "error InvalidMinAmountOut(uint256 provided, uint256 minAllowed)",
  "error UnsupportedOutputToken(address tokenOut)",
  "error InsufficientRouterLiquidity(uint256 available, uint256 required)",
  "error InvalidOraclePrice(int256 answer)",
  "error StaleOraclePrice(uint256 updatedAt, uint256 maxAge)",
  "error IncompleteOracleRound(uint80 roundId, uint80 answeredInRound)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
];
const errorIface = new ethers.Interface(ERROR_ABI);

export function decodeWeb3Error(err: any): string {
  if (err?.code === "ACTION_REJECTED" || err?.code === 4001) {
    return "Bạn đã từ chối ký giao dịch trên ví.";
  }
  const rawData = err?.data || err?.info?.error?.data;
  if (typeof rawData === "string" && rawData.startsWith("0x")) {
    try {
      const parsed = errorIface.parseError(rawData);
      if (parsed) {
        if (parsed.name === "ExceedsMaxTxAmount") {
          const req = ethers.formatUnits(parsed.args[0], 6);
          const max = ethers.formatUnits(parsed.args[1], 6);
          return `Smart Contract từ chối (ExceedsMaxTxAmount): Yêu cầu ${req} mUSDC vượt hạn mức ${max} mUSDC/giao dịch.`;
        }
        if (parsed.name === "InsufficientRouterLiquidity") {
          const avail = Number(ethers.formatEther(parsed.args[0])).toFixed(4);
          const req = Number(ethers.formatEther(parsed.args[1])).toFixed(4);
          return `Smart Contract từ chối (InsufficientRouterLiquidity): Pool còn ${avail} AVAX, cần ${req} AVAX.`;
        }
        if (parsed.name === "ERC20InsufficientBalance") {
          const bal = ethers.formatUnits(parsed.args[1], 6);
          const req = ethers.formatUnits(parsed.args[2], 6);
          return `Số dư mUSDC không đủ: Ví có ${bal} mUSDC, cần ${req} mUSDC.`;
        }
        if (parsed.name === "ERC20InsufficientAllowance") {
          return "Allowance mUSDC chưa đủ cho AgentVaultExecutor. Vui lòng ký Bước 1 (Exact Approve) trước.";
        }
        if (parsed.name === "EnforcedPause") {
          return "Smart Contract đang ở trạng thái Emergency Pause.";
        }
        return `Smart Contract reverted: ${parsed.name}`;
      }
    } catch {
      // fall through to generic message
    }
  }
  return err?.shortMessage || err?.reason || err?.message || "Giao dịch thất bại.";
}

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToFuji: () => Promise<void>;
  sendTx: (tx: {
    to: string;
    data: string;
    value?: string;
    chainId?: number;
    integrityHash?: string;
  }) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  callFaucet: () => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const syncWallet = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAddress(accounts[0].address);
        const net = await provider.getNetwork();
        setChainId(Number(net.chainId));
      }
    } catch {
      // ignore on initial load
    }
  }, []);

  useEffect(() => {
    syncWallet();
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts.length > 0 ? accounts[0] : null);
    };
    const handleChainChanged = (hexId: string) => {
      setChainId(parseInt(hexId, 16));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [syncWallet]);

  const switchToFuji = async () => {
    if (!window.ethereum) throw new Error("Vui lòng cài MetaMask hoặc Core Wallet.");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: FUJI_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: FUJI_CHAIN_HEX,
              chainName: "Avalanche Fuji C-Chain",
              nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
              rpcUrls: [FUJI_RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      alert("Không tìm thấy ví Web3. Vui lòng cài MetaMask hoặc Core Wallet.");
      return;
    }
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      setAddress(await signer.getAddress());
      const net = await provider.getNetwork();
      const currentChain = Number(net.chainId);
      setChainId(currentChain);
      if (currentChain !== FUJI_CHAIN_ID) {
        await switchToFuji();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  const sendTx = async (tx: {
    to: string;
    data: string;
    value?: string;
    chainId?: number;
    integrityHash?: string;
  }) => {
    if (!window.ethereum) throw new Error("Ví chưa kết nối.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== FUJI_CHAIN_ID) {
      throw new Error(
        `Sai mạng Blockchain (hiện tại: ${net.chainId}, yêu cầu Avalanche Fuji ${FUJI_CHAIN_ID}).`
      );
    }
    if (tx.integrityHash) {
      const packed = `${tx.chainId ?? FUJI_CHAIN_ID}:${tx.to.toLowerCase()}:${tx.data.toLowerCase()}:${tx.value || "0"}`;
      const clientHash = ethers.keccak256(ethers.toUtf8Bytes(packed));
      if (clientHash !== tx.integrityHash) {
        throw new Error(
          "Cảnh báo bảo mật: Calldata giao dịch đã bị thay đổi sau bước Simulation. Đã hủy ký."
        );
      }
    }
    const signer = await provider.getSigner();
    const sent = await signer.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : 0n,
    });
    const receipt = await sent.wait();
    return receipt?.hash || sent.hash;
  };

  const signMessage = async (message: string) => {
    if (!window.ethereum) throw new Error("Ví chưa kết nối.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
  };

  const callFaucet = async () => {
    if (!MUSDC_ADDRESS) {
      throw new Error("Chưa cấu hình VITE_MUSDC_ADDRESS trong frontend/.env");
    }
    if (!window.ethereum) throw new Error("Ví chưa kết nối.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const musdc = new ethers.Contract(
      MUSDC_ADDRESS,
      ["function faucet(uint256 amount)"],
      signer
    );
    const tx = await musdc.faucet(ethers.parseUnits("1000", 6));
    const receipt = await tx.wait();
    return receipt?.hash || tx.hash;
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnecting,
        isWrongNetwork: Boolean(address && chainId && chainId !== FUJI_CHAIN_ID),
        connect,
        disconnect,
        switchToFuji,
        sendTx,
        signMessage,
        callFaucet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import Core from "web3modal";
import { Web3Provider } from "@ethersproject/providers";

const AVAX_C_ID = 43114;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const CONTRACT_DATA = {
  address: "0x7ADdC708Fe7a72a58faB8faBD7a86e5999903D42",
  abi: [
    "function claimDividend()",
    "function getUnpaidEarnings(address shareholder) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
  ],
};

const ERC20_DATA = {
  address: "0xE1C1a8DCD6aE8b17cC2923A82Ddb9bf8827095B7",
  abi: ["function balanceOf(address owner) view returns (uint balance)"],
};

export const toHex = (num: number | string) => {
  const val = Number(num);
  return "0x" + val.toString(16);
};

const Home: NextPage = () => {
  const web3ModalRef = useRef<undefined | Core>();
  const [provider, setProvider] = useState<any>();
  const [ethersProvider, setEthersProvider] = useState<Web3Provider>();
  const [account, setAccount] = useState(NULL_ADDRESS);
  const [error, setError] = useState("");
  const [chainId, setChainId] = useState<string>();
  const [unpaidEarnings, setUnpaidEarnings] = useState("0.0");
  const [balance, setBalance] = useState("0.0");
  const [loading, setLoading] = useState(false);
  const [isAvaxChain, setIsAvaxChain] = useState(false);

  /**
   * @dev connects the users wallet
   */
  const connectWallet = async () => {
    try {
      const provider = await web3ModalRef.current?.connect();
      const _ethersProvider = new ethers.providers.Web3Provider(provider);
      const accounts = await _ethersProvider.listAccounts();
      const network = await _ethersProvider.getNetwork();
      setProvider(provider);
      setEthersProvider(_ethersProvider);
      setChainId(toHex(network.chainId));
      if (accounts) setAccount(accounts[0]);
    } catch (error: any) {
      setError(error);
    }
  };

  /**
   * @dev switch the network to avax c chain or add it to metamask
   */
  const switchNetwork = async () => {
    if (!ethersProvider?.provider.request) return;

    try {
      await ethersProvider.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHex(AVAX_C_ID) }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethersProvider.provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: toHex(AVAX_C_ID),
                rpcUrls: ["https://api.harmony.one"],
                chainName: "Avalanche Network",
                nativeCurrency: { name: "AVAX", decimals: 18, symbol: "AVAX" },
                blockExplorerUrls: ["https://api.avax.network/ext/bc/C/rpc"],
                iconUrls: ["https://cryptologos.cc/logos/avalanche-avax-logo.png?v=022"],
              },
            ],
          });
        } catch (err: any) {
          setError(err);
          console.error(err);
        }
      }
    }
  };

  const refreshState = () => {
    setAccount(NULL_ADDRESS);
    setChainId(undefined);
  };

  const disconnect = async () => {
    web3ModalRef.current && (await web3ModalRef.current.clearCachedProvider());
    refreshState();
  };

  /**
   * @dev claims the unpaid rewards and refresh page if successfull
   */
  const claimRewards = async () => {
    try {
      const signer = ethersProvider?.getSigner();
      const contract = new ethers.Contract(CONTRACT_DATA.address, CONTRACT_DATA.abi, signer);
      setLoading(true);
      const tx = await contract.claimDividend();
      await tx.wait();
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * @dev connects the wallet on initial page load
   */
  useEffect(() => {
    web3ModalRef.current = new Web3Modal({});
    connectWallet();
  }, []);

  /**
   * @dev handle events through tracking the provider state
   * tracks account changes, network changes, disconnect, connect
   */
  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: any) => {
        if (accounts) setAccount(accounts[0]);
      };

      const handleChainChanged = (_hexChainId: string) => {
        window.location.reload();
      };

      const handleDisconnect = () => {
        console.log("disconnect", error);
        disconnect();
      };

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("disconnect", handleDisconnect);

      return () => {
        if (provider.removeListener) {
          provider.removeListener("accountsChanged", handleAccountsChanged);
          provider.removeListener("chainChanged", handleChainChanged);
          provider.removeListener("disconnect", handleDisconnect);
        }
      };
    }
  }, [provider]);

  useEffect(() => {
    if (chainId !== toHex(AVAX_C_ID)) {
      setIsAvaxChain(false);
      setBalance("0.0");
      setUnpaidEarnings("0.0");
      switchNetwork();
    } else {
      setIsAvaxChain(true);
    }
  }, [chainId]);

  /**
   * @dev fetches core nodes token balance and unpaid earnings
   */
  const fetchContractData = async () => {
    console.log("chainId: ", await ethersProvider?.getNetwork());
    // get token balance
    const erc20 = new ethers.Contract(ERC20_DATA.address, ERC20_DATA.abi, ethersProvider);
    const _balance = await erc20.balanceOf(account);
    setBalance(ethers.utils.formatUnits(_balance.toString(), 6));
    // get unpaid rewards
    const contract = new ethers.Contract(CONTRACT_DATA.address, CONTRACT_DATA.abi, ethersProvider);
    const unpaidEarning = await contract.getUnpaidEarnings(account);
    setUnpaidEarnings(ethers.utils.formatUnits(unpaidEarning.toString(), 6));
  };

  /**
   * @dev fetch data if account changes
   */
  useEffect(() => {
    if (isAvaxChain) {
      fetchContractData();
    }
  }, [account]);

  return (
    <div className="container mx-auto my-32">
      <div className="relative h-16">
        <Image src="/core-logo-final-version.png" layout="fill" objectFit="contain" />
      </div>
      <div className="text-center mt-8 space-y-8">
        <h1 className="font-bold text-3xl">Claim $CORE dividends</h1>
        <div className="mx-auto flex flex-col space-y-4">
          <div>
            <p className="font-bold">Account</p>
            <p>{account}</p>
          </div>
          <div>
            <p className="font-bold">$CORE token balance:</p>
            <p>{balance}</p>
          </div>
          <div>
            <p className="font-bold">Pending USDC.e rewards:</p>
            <p className="text-green-600">
              {new Intl.NumberFormat("en-EN", { style: "currency", currency: "USD" }).format(Number(unpaidEarnings))}
            </p>
          </div>
        </div>

        {account !== NULL_ADDRESS ? (
          <div>
            <button
              className="py-2 px-4 bg-blue-500 rounded-sm shadow-md text-white hover:bg-blue-600 disabled:cursor-not-allowed"
              onClick={claimRewards}
              disabled={!isAvaxChain}
            >
              {loading ? "Loading ..." : "Claim Rewards"}
            </button>
            {!isAvaxChain && <p className="text-red-500 mt-2">Please switch to the Avalanche Network!</p>}
          </div>
        ) : (
          <div>
            <button
              className="py-2 px-4 bg-blue-500 rounded-sm shadow-md text-white hover:bg-blue-600"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
            {!account && <p className="text-red-500 mt-2">Please connect your wallet first!</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

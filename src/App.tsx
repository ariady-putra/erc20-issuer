import { useEffect, useRef, useState } from "react";

import { createWalletClient, custom, publicActions, type Address, type Hex } from "viem";
import { localhost, sepolia } from "viem/chains";

import ERC20Issuer from "../foundry/out/Issuer.sol/Issuer.json";

import "./App.css";

const client = createWalletClient({
  chain: import.meta.env.VITE_SEPOLIA ? sepolia : localhost,
  transport: custom(window.ethereum!),
}).extend(publicActions);

type Token = {
  policyID: Address;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
};

function App() {
  const [address, setAddress] = useState<Address>();
  const [tokens, setTokens] = useState<Token[]>(
    () =>
      JSON.parse(localStorage.getItem("tokens") ?? "[]")
  );
  const [selectedToken, setSelectedToken] = useState<Token>();
  const [result, setResult] = useState(`${client.chain.name} Network`);

  const nameRef = useRef<HTMLInputElement>(null);
  const symbolRef = useRef<HTMLInputElement>(null);
  const supplyRef = useRef<HTMLInputElement>(null);
  const decimalsRef = useRef<HTMLInputElement>(null);

  const transferDialogRef = useRef<HTMLDialogElement>(null);
  const transferDestinationRef = useRef<HTMLInputElement>(null);
  const transferAmountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!address) client.requestAddresses().then(
      ([address]) =>
        setAddress(() => address.toLowerCase() as Address)
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "tokens",
      JSON.stringify(tokens),
    );
  }, [tokens]);

  if (!address) return <div className="flex">
    <div className="loading loading-infinity" />
    <span className="mx-px px-px">connecting wallet</span>
  </div>;

  async function deployToken({ deployer, tokenName, tokenSymbol, initialSupply, decimals }:
    { deployer: Address; tokenName: string; tokenSymbol: string; initialSupply: number; decimals: number; }) {
    const hash = await client.deployContract({
      abi: ERC20Issuer.abi,
      bytecode: ERC20Issuer.bytecode.object as Hex,
      args: [tokenName, tokenSymbol, BigInt(initialSupply) * 10n ** BigInt(decimals), decimals],
      account: deployer,
    });

    return await client.waitForTransactionReceipt({ hash });
  }

  async function sendToken({ policyID, transferFrom, transferTo, transferValue, decimals }:
    { policyID: Address; transferFrom: Address; transferTo: Address; transferValue: number; decimals: number; }) {
    const { request } = await client.simulateContract({
      address: policyID,
      abi: ERC20Issuer.abi,
      functionName: "transfer",
      args: [transferTo, BigInt(transferValue) * 10n ** BigInt(decimals)],
      account: transferFrom,
    });

    const hash = await client.writeContract(request);
    return await client.waitForTransactionReceipt({ hash });
  }

  return <div className="flex flex-col gap-3.5">
    <h1 className="text-3xl font-bold">Hello, {address.slice(0, 6)}...{address.slice(-4)}</h1>

    <div className="flex gap-3.5 p-3.5">
      <form className="flex flex-col gap-3.5 m-3.5 w-1/2" onSubmit={async (e) => {
        e.preventDefault();

        const tokenName = `${nameRef.current?.value}`;
        const tokenSymbol = `${symbolRef.current?.value}`;
        const decimals = parseInt(`${decimalsRef.current?.value}`);

        const { status, transactionHash, contractAddress } = await deployToken({
          deployer: address,
          tokenName, tokenSymbol,
          initialSupply: Number(`${supplyRef.current?.value}`),
          decimals,
        });

        if (status != "success") {
          const error = "Failed issuing token!";
          setResult(() => `ERROR: ${error}`);
          throw error;
        }

        setResult(() => `TxHash: ${transactionHash}`);
        setTokens((tokens) => [...tokens, {
          policyID: contractAddress as Address,
          tokenName, tokenSymbol, decimals,
        }]);

        nameRef.current!.value = "";
        symbolRef.current!.value = "";
        supplyRef.current!.value = "";
        decimalsRef.current!.value = "";
      }}>
        <h2 className="text-3xl font-bold">Issue New Token</h2>
        <input type="text" placeholder="Token Name" required className="input input-primary w-full" ref={nameRef} />
        <input type="text" placeholder="Token Symbol" required className="input input-primary w-full" ref={symbolRef} />
        <input type="number" placeholder="Initial Supply" min={0} required className="input input-primary w-full" ref={supplyRef} />
        <input type="number" placeholder="Decimals" step={1} min={0} max={255} required className="input input-primary w-full" ref={decimalsRef} />
        <div className="flex justify-end gap-3.5">
          <button type="submit" className="btn btn-primary">Issue</button>
          <button type="reset" className="btn btn-primary btn-soft">Clear</button>
        </div>
      </form>

      <div className="flex flex-col gap-3.5 m-3.5 w-1/2">
        <h2 className="text-3xl font-bold">My Issued Tokens</h2>
        {tokens.length
          ? <div className="table">
            {tokens.map(
              (token) =>
                <div key={token.policyID} className="table-row">
                  <span className="table-cell font-mono">{token.policyID.slice(0, 6)}...{token.policyID.slice(-4)}</span>
                  <span className="table-cell font-mono">{token.tokenSymbol}</span>
                  <span className="table-cell font-mono">{token.tokenName}</span>
                  <button className="table-cell btn btn-primary btn-outline my-0.75"
                    onClick={() => {
                      setSelectedToken(() => token);
                      transferDialogRef.current?.showModal();
                    }}
                  >Transfer</button>
                </div>
            )}
          </div>
          : <span className="my-auto">No issued token</span>}
      </div>

      <dialog className="modal" ref={transferDialogRef}>
        <div className="modal-box bg-neutral space-y-3.5">
          <form method="dialog">
            {/* if there is a button in form, it will close the modal */}
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>

          <h3 className="font-bold text-lg">Transfer</h3>
          <form method="dialog" className="flex flex-col gap-3.5" onSubmit={async () => {
            try {
              if (!selectedToken) {
                const error = "No selected token!";
                setResult(() => `ERRROR: ${error}`);
                throw error;
              }

              const { status, transactionHash } = await sendToken({
                policyID: selectedToken.policyID,
                transferFrom: address,
                transferTo: transferDestinationRef.current?.value as Address,
                transferValue: Number(`${transferAmountRef.current?.value}`),
                decimals: selectedToken.decimals,
              });

              if (status != "success") {
                const error = "Failed transferring token!";
                setResult(() => `ERRROR: ${error}`);
                throw error;
              }

              setResult(() => `TxHash: ${transactionHash}`);
            } catch (error) {
              throw error;
            } finally {
              transferDestinationRef.current!.value = "";
              transferAmountRef.current!.value = "";
            }
          }}>
            <input type="text" placeholder="Recipient" required className="input input-primary w-full" ref={transferDestinationRef} />
            <input type="number" placeholder="Amount" min={0} required className="input input-primary w-full" ref={transferAmountRef} />
            <div className="modal-action m-0!">
              <button type="submit" className="btn btn-primary">Send</button>
              <button type="reset" className="btn btn-primary btn-soft"
                onClick={() => transferDialogRef.current?.close()}
              >Cancel</button>
            </div>
          </form>
        </div>

        <form method="dialog" className="modal-backdrop backdrop-blur-xs">
          <button /> {/* covers the screen so we can close the modal when clicked outside */}
        </form>
      </dialog>
    </div>

    <span className={result.startsWith("ERROR") ? "text-error font-bold" : ""}>{result}</span>
  </div>;
}

export default App;

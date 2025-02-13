import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, Hex, http } from "viem";
import { baseSepolia } from "viem/chains";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";

import { config } from "dotenv";
config();

type GasPrices = {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
};

type EthGetUserOperationGasPriceRpc = {
  ReturnType: GasPrices;
  Parameters: [];
};

const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
if (!PROJECT_ID) {
  console.error("Please set the ZERODEV_PROJECT_ID environment variable.");
  process.exit(1);
}

const RPC_URL =
  "https://base-sepolia.infura.io/v3/006a677fe90346f9bf6cb52a2a6b340b";
const CHAIN_ID = 84532;
const BASE_SEPOLIA_STAGING_BUNDLER_RPC = `https://api.staging.gelato.digital/bundlers/${CHAIN_ID}/rpc`;
const PAYMASTER_RPC = `https://rpc.zerodev.app/api/v2/paymaster/${PROJECT_ID}?provider=PIMLICO`;

async function getTaskStatus(taskId: string) {
  const url = `https://api.staging.gelato.digital/tasks/status/${taskId}`;
  const response = await fetch(url);
  return response.json();
}

async function main() {
  // 1. Construct a signer using a randomly generated private key.
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

  // 2. Set up a public client for the Base Sepolia RPC.
  const publicClient = createPublicClient({
    transport: http(RPC_URL),
    chain: baseSepolia,
  });

  // 3. Create Safe account with given owner.
  const account = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [signer],
    saltNonce: BigInt(0),
    version: "1.4.1",
  });

  // 4. Create a ZeroDev paymaster client.
  const zerodevPaymaster = createZeroDevPaymasterClient({
    chain: baseSepolia,
    transport: http(PAYMASTER_RPC),
  });

  // 5. Construct the Kernel account client using the staging bundler RPC
  const kernelClient = createKernelAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(BASE_SEPOLIA_STAGING_BUNDLER_RPC),
    client: publicClient,
    paymaster: zerodevPaymaster,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        const gasPrices =
          await bundlerClient.request<EthGetUserOperationGasPriceRpc>({
            method: "eth_getUserOperationGasPrice",
            params: [],
          });
        return {
          maxFeePerGas: BigInt(gasPrices.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(gasPrices.maxPriorityFeePerGas),
        };
      },
    },
  });

  console.log(
    "Safe account deployed at address:",
    kernelClient.account.address
  );

  // 6. Prepare an empty transaction to the zero address.
  const callData = await kernelClient.account.encodeCalls([
    {
      to: "0x0000000000000000000000000000000000000000",
      value: BigInt(0),
      data: "0x",
    },
  ]);

  console.log("Preparing user operation (empty transaction)...");
  const userOp = await kernelClient.prepareUserOperation({ callData });
  console.log("Prepared UserOp:", userOp);

  console.log("Sending user operation...");
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  console.log("UserOp taskId:", userOpHash);

  // Wait 10 seconds for the transaction to be processed
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Get and log the actual transaction hash
  const taskStatus = await getTaskStatus(userOpHash);
  console.log("Transaction hash:", taskStatus.task.transactionHash);
}

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

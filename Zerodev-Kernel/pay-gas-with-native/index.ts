import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, formatEther, Hex, http } from "viem";
import { baseSepolia } from "viem/chains";
import { config } from "dotenv";

config();
// Define types for estimating gas prices.
type GasPrices = {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
};

type EthGetUserOperationGasPriceRpc = {
  ReturnType: GasPrices;
  Parameters: [];
};

// Define RPC URLs for Base Sepolia network
const RPC_URL =
  "https://base-sepolia.infura.io/v3/006a677fe90346f9bf6cb52a2a6b340b";
const BUNDLER_RPC = `https://api.staging.gelato.digital/bundlers/${baseSepolia.id}/rpc`;
const GELATO_API_URL = "https://api.staging.gelato.digital";

async function main() {
  // Step 1: Construct a signer using the private key from environment variables
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

  // Step 2: Set up a public client for interacting with the blockchain
  const publicClient = createPublicClient({
    transport: http(RPC_URL),
    chain: baseSepolia,
  });

  // Step 3: Define the entry point and initialize the ECDSA validator
  const entryPoint = getEntryPoint("0.7");
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Step 4: Create a Kernel account with the validator plugin
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // Step 5: Construct the Kernel account client using the bundler RPC(Gelato)
  const kernelClient = createKernelAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(BUNDLER_RPC),
    client: publicClient,
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
    "Kernel account deployed at address:",
    kernelClient.account.address
  );

  const kernelBalance = await publicClient.getBalance({
    address: kernelClient.account.address,
  });
  console.log("Current balance:", formatEther(kernelBalance), "ETH");

  // Step 6: Prepare an empty transaction to the zero address
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

  // Step 7: Send the user operation
  console.log("Sending user operation...");
  const userOpTaskId = await kernelClient.sendUserOperation({ callData });
  console.log("UserOp TaskId:", userOpTaskId);

  await kernelClient.waitForUserOperationReceipt({
    hash: userOpTaskId,
    timeout: 15 * 1000,
  });

  // Give a little wait time before checking task status
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const taskStatus = await getTaskStatus(userOpTaskId, GELATO_API_URL);
  console.log("Transaction hash:", taskStatus.task.transactionHash);
}

async function getTaskStatus(taskId: string, baseUrl: string) {
  const url = `${baseUrl}/tasks/status/${taskId}`;
  const response = await fetch(url);
  return response.json();
}

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

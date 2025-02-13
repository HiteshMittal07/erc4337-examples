import {
  createKernelAccount,
  createKernelAccountClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import { createPublicClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { baseSepolia } from "viem/chains";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";

import dotenv from "dotenv";
dotenv.config();

// Function to fetch task status from Gelato API
async function getTaskStatus(taskId: string) {
  const url = `https://api.staging.gelato.digital/tasks/status/${taskId}`;
  const response = await fetch(url);
  return response.json();
}

const main = async () => {
  const chainId = 84532;
  console.log(`chainId: ${chainId}`);

  // Load Sponsor API key from environment variables
  const API_KEY = process.env.SPONSOR_API_KEY as string;
  if (!API_KEY) {
    console.error("SPONSOR_API_KEY is not set in environment variables.");
    process.exit(1);
  }

  // Step 1: Construct a signer using the private key from environment variables
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

  // Step 2: Set up a public client for interacting with the blockchain
  const publicClient = createPublicClient({
    transport: http(process.env.GELATO_RPC_URL),
    chain: baseSepolia,
  });

  // Step 3: Define the entry point and initialize the ECDSA validator
  const entryPoint = getEntryPoint("0.7");
  const kernelVersion = KERNEL_V3_1;
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion,
  });

  // Step 4: Create a Kernel account with the validator plugin
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
  });

  console.log("My account:", account.address);

  // Step 5: Construct the Kernel account client using the bundler RPC
  const kernelClient = createKernelAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(
      `https://api.gelato.digital/bundlers/${chainId}/rpc?sponsorApiKey=${API_KEY}`
    ),
    client: publicClient,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        return getUserOperationGasPrice(bundlerClient);
      },
    },
  });

  // Step 6: Prepare an empty transaction to the zero address
  const callData = await kernelClient.account.encodeCalls([
    {
      to: "0x0000000000000000000000000000000000000000",
      value: BigInt(0),
      data: "0x",
    },
  ]);

  console.log("Sending user operation...");
  const userOpHash = await kernelClient.sendUserOperation({
    callData,
    maxFeePerGas: BigInt(0),
    maxPriorityFeePerGas: BigInt(0),
  });
  console.log("UserOp taskId:", userOpHash);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Step 7: Get and log the actual transaction hash
  const taskStatus = await getTaskStatus(userOpHash);
  console.log("Transaction hash:", taskStatus.task.transactionHash);
};

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

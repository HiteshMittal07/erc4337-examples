import {
  createKernelAccountClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import { createPublicClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { toSafeSmartAccount } from "permissionless/accounts";
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

  // Step 3: Create a Safe Smart Account using permissionless.
  console.log("Creating Safe Smart Account...");
  const account = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [signer],
    saltNonce: BigInt(0),
    version: "1.4.1",
  });

  // Step 4: Construct the Kernel account client using the bundler RPC
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

  console.log(
    "Safe account deployed at address:",
    kernelClient.account.address
  );

  // Step 5: Prepare an empty transaction to the zero address
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

  // Step 6: Get and log the actual transaction hash
  const taskStatus = await getTaskStatus(userOpHash);
  console.log("Transaction hash:", taskStatus.task.transactionHash);
};

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

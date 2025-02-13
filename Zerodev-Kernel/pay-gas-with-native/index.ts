import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, Hex, http } from "viem";
import { baseSepolia } from "viem/chains";
import { config } from "dotenv";

config();

// Load ZeroDev Project ID from environment variables
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
if (!PROJECT_ID) {
  console.error("Please set the ZERODEV_PROJECT_ID environment variable.");
  process.exit(1);
}

// Define RPC URLs for Base Sepolia network
const RPC_URL =
  "https://base-sepolia.infura.io/v3/006a677fe90346f9bf6cb52a2a6b340b";
const BASE_SEPOLIA_BUNDLER_RPC = `https://rpc.zerodev.app/api/v2/bundler/${PROJECT_ID}`;

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

  // Step 5: Construct the Kernel account client using the bundler RPC
  const kernelClient = createKernelAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(BASE_SEPOLIA_BUNDLER_RPC),
    client: publicClient,
  });

  console.log(
    "Kernel account deployed at address:",
    kernelClient.account.address
  );

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
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  console.log("UserOp Hash:", userOpHash);
}

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

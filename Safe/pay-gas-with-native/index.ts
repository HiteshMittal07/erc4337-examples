import { createKernelAccountClient } from "@zerodev/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, Hex, http } from "viem";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { toSafeSmartAccount } from "permissionless/accounts";
import { config } from "dotenv";

config();

// Ensure the ZeroDev Project ID is set in environment variables
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
if (!PROJECT_ID) {
  console.error("Error: ZERODEV_PROJECT_ID environment variable is not set.");
  process.exit(1);
}

// Define RPC URLs
const RPC_URL =
  "https://base-sepolia.infura.io/v3/006a677fe90346f9bf6cb52a2a6b340b";
const BASE_SEPOLIA_BUNDLER_RPC = `https://rpc.zerodev.app/api/v2/bundler/${PROJECT_ID}`;

async function main() {
  console.log("Starting execution...");

  // Step 1: Construct a signer using the private key from environment variables
  if (!process.env.PRIVATE_KEY) {
    console.error("Error: PRIVATE_KEY is not set in environment variables.");
    process.exit(1);
  }
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  console.log("Signer initialized with address:", signer.address);

  // Step 2: Set up a public client for the Base Sepolia RPC
  const publicClient = createPublicClient({
    transport: http(RPC_URL),
    chain: baseSepolia,
  });
  console.log("Public client connected to Base Sepolia.");

  // Step 3: Create a Safe Smart Account using permissionless.
  console.log("Creating Safe Smart Account...");
  const account = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [signer],
    saltNonce: BigInt(0),
    version: "1.4.1",
  });
  console.log("Safe Smart Account created at address:", account.address);

  // Step 4: Construct the Kernel Account Client using the bundler RPC
  console.log("Initializing Kernel Account Client...");
  const kernelClient = createKernelAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(BASE_SEPOLIA_BUNDLER_RPC),
    client: publicClient,
  });
  console.log("Kernel Account Client initialized successfully.");

  // Step 5: Prepare an empty transaction to the zero address
  console.log("Preparing an empty transaction...");
  const callData = await kernelClient.account.encodeCalls([
    {
      to: "0x0000000000000000000000000000000000000000", // Zero address
      value: BigInt(0),
      data: "0x", // No data
    },
  ]);

  console.log("Preparing user operation with the transaction data...");
  const userOp = await kernelClient.prepareUserOperation({ callData });
  console.log("Prepared User Operation:", userOp);

  // Step 6: Send the user operation to the bundler
  console.log("Sending user operation to the bundler...");
  const userOpHash = await kernelClient.sendUserOperation({ callData });
  console.log("User Operation sent successfully. Operation Hash:", userOpHash);

  console.log("Execution completed successfully.");
}

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

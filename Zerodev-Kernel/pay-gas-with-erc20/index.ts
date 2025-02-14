import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
  getERC20PaymasterApproveCall,
  gasTokenAddresses,
} from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  http,
  Hex,
  createPublicClient,
  zeroAddress,
  parseAbi,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import "dotenv/config";

type GasPrices = {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
};

type EthGetUserOperationGasPriceRpc = {
  ReturnType: GasPrices;
  Parameters: [];
};

// Ensure that required environment variables are set
if (
  !process.env.BUNDLER_RPC ||
  !process.env.PAYMASTER_RPC ||
  !process.env.PRIVATE_KEY
) {
  throw new Error("BUNDLER_RPC or PAYMASTER_RPC or PRIVATE_KEY is not set");
}

const main = async () => {
  const chain = sepolia;

  // Create a public client to interact with the blockchain
  const publicClient = createPublicClient({
    transport: http(process.env.SEPOLIA_RPC_URL),
    chain,
  });

  // Convert private key to account
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  const entryPoint = getEntryPoint("0.7");

  // Create ECDSA validator for Kernel account
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    entryPoint,
    signer,
    kernelVersion: KERNEL_V3_1,
  });

  // Create a Kernel smart account with the ECDSA validator
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  console.log("Kernel Account Address:", account.address);

  // Fetching the user's USDC balance
  const usdcBalance = await publicClient.readContract({
    abi: parseAbi(["function balanceOf(address account) returns (uint256)"]),
    address: gasTokenAddresses[sepolia.id]["USDC"],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.info(`USDC balance: ${Number(usdcBalance) / 1_000_000} USDC`);

  // Create a ZeroDev Paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(process.env.PAYMASTER_RPC), // Configure ZeroDev Paymaster RPC with PIMLICO as the provider
  });

  // Create a Kernel client with paymaster and ERC-20 token as gas
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: paymasterClient,
    paymasterContext: {
      token: gasTokenAddresses[sepolia.id]["USDC"], // Setting ERC-20 token for gas fees
    },
    // Custom gas estimation for integrating Gelato Bundler with the ZeroDev SDK
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

  console.log("Preparing/Sending User Operation...");
  /**
   * Sending a User Operation (UserOp) with multiple encoded calls:
   * 1. Approve a certain amount of ERC-20 tokens for the paymaster to use as gas.
   * 2. Execute the original transaction (dummy call in this case).
   */
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([
      // Approving the paymaster to use ERC-20 tokens for gas
      await getERC20PaymasterApproveCall(paymasterClient, {
        gasToken: gasTokenAddresses[sepolia.id]["USDC"],
        approveAmount: parseEther("1"),
        entryPoint,
      }),
      {
        to: zeroAddress, // Dummy call (replace with actual transaction details)
        value: BigInt(0),
        data: "0x",
      },
    ]),
  });

  console.log("User Op Task Id:", userOpHash);

  // Wait for the transaction to be confirmed on-chain
  console.log("Waiting for transaction receipt...");
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log(
    "User Operation Completed, Transaction Hash:",
    receipt.receipt.transactionHash
  );
  process.exit();
};

main();

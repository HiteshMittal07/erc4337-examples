import {
  createZeroDevPaymasterClient,
  createKernelAccountClient,
  getERC20PaymasterApproveCall,
  gasTokenAddresses,
} from "@zerodev/sdk";
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
import { getEntryPoint } from "@zerodev/sdk/constants";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
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

  // Step 1: Create a public client for interacting.
  const publicClient = createPublicClient({
    transport: http(process.env.SEPOLIA_RPC_URL),
    chain,
  });

  // Step 2: Convert private key to an account
  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  const entryPoint = getEntryPoint("0.7");

  // Step 3: Create a Safe Smart Account
  const account = await toSafeSmartAccount({
    client: publicClient,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    owners: [signer],
    saltNonce: BigInt(0),
    version: "1.4.1",
  });
  console.log("Safe Account Address:", account.address);

  // Step 4: Fetch the user's USDC balance
  const usdcBalance = await publicClient.readContract({
    abi: parseAbi(["function balanceOf(address account) returns (uint256)"]),
    address: gasTokenAddresses[sepolia.id]["USDC"],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`USDC balance: ${Number(usdcBalance) / 1_000_000} USDC`);

  // Step 5: Create a ZeroDev paymaster client
  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(process.env.PAYMASTER_RPC), // Configure ZeroDev Paymaster RPC with PIMLICO as the provider
  });

  // Step 6: Create a Kernel account client with paymaster and ERC-20 token for gas
  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(process.env.BUNDLER_RPC), // Gelato Bundler RPC
    paymaster: paymasterClient,
    paymasterContext: {
      token: gasTokenAddresses[sepolia.id]["USDC"],
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

  // Step 7: Prepare and send a user operation
  console.log("Preparing/Sending User Operation...");
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([
      // Approving the paymaster to use ERC-20 tokens for gas
      await getERC20PaymasterApproveCall(paymasterClient, {
        gasToken: gasTokenAddresses[sepolia.id]["USDC"],
        approveAmount: parseEther("1"),
        entryPoint,
      }),
      {
        to: zeroAddress, // Dummy transaction
        value: BigInt(0),
        data: "0x",
      },
    ]),
  });

  console.log("User Op Task Id:", userOpHash);

  // Step 8: Wait for transaction confirmation
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

main().catch((error) => {
  console.error("Error executing the user operation:", error);
  process.exit(1);
});

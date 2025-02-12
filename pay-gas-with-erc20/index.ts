import "dotenv/config";
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

if (
  !process.env.BUNDLER_RPC ||
  !process.env.PAYMASTER_RPC ||
  !process.env.PRIVATE_KEY
) {
  throw new Error("BUNDLER_RPC or PAYMASTER_RPC or PRIVATE_KEY is not set");
}
const chain = sepolia;
const publicClient = createPublicClient({
  transport: http(process.env.RPC_URL),
  chain,
});
const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

const TEST_ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount) external",
]);
const entryPoint = getEntryPoint("0.7");

const main = async () => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    entryPoint,
    signer,
    kernelVersion: KERNEL_V3_1,
  });
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const usdcBalance = await publicClient.readContract({
    abi: parseAbi(["function balanceOf(address account) returns (uint256)"]),
    address: gasTokenAddresses[sepolia.id]["USDC"],
    functionName: "balanceOf",
    args: [account.address],
  });
  console.info(`USDC balance: ${Number(usdcBalance) / 1_000_000} USDC`);

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(process.env.PAYMASTER_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: paymasterClient,
    paymasterContext: {
      token: gasTokenAddresses[sepolia.id]["USDC"],
    },
  });

  console.log("My account:", account.address);

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([
      await getERC20PaymasterApproveCall(paymasterClient, {
        gasToken: gasTokenAddresses[sepolia.id]["USDC"],
        approveAmount: parseEther("1"),
        entryPoint,
      }),
      {
        to: zeroAddress,
        value: BigInt(0),
        data: "0x",
      },
    ]),
  });

  console.log("UserOp hash:", userOpHash);

  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log("UserOp completed", receipt.receipt.transactionHash);
  process.exit();
};

main();

//PAYMASTER_RPC=https://rpc.zerodev.app/api/v2/paymaster/7f2e0dca-a68b-4979-9db1-23673d30d2fb
//BUNDLER_RPC=https://rpc.zerodev.app/api/v2/bundler/7f2e0dca-a68b-4979-9db1-23673d30d2fb

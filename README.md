# ERC4337 Examples

Welcome to the **ERC4337 Examples** repository! This repository contains various examples and use cases demonstrating how to work with Gelato and Zerodev.

## Getting Started

1. Clone the repository:

   ```sh
   git clone https://github.com/HiteshMittal07/erc4337-examples.git
   cd erc4337-examples
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy environment variables:
   ```sh
   cp .env.example .env
   ```

## Examples Using Safe Account

Below are different examples demonstrating how Safe accounts can be used for various gas payment methods.

### 1. Paying Gas with ERC-20 Tokens

This example shows how a Safe account can be used to pay gas for a user operation using ERC-20 tokens.

- **Bundler:** Gelato
- **Paymaster:** Zerodev with PIMLICO Provider (i.e https://rpc.zerodev.app/api/v2/paymaster/${ZERODEV_PROJECT_ID}?provider=PIMLICO)
- **How to run:**
  ```sh
  npm run pay-with-erc20-safe
  ```

### 2. Paying Gas with Native Tokens

This example demonstrates how a Safe account, combined with the Zerodev Kernel client, can be used to pay gas with native tokens.

- **Bundler & Paymaster:** Zerodev
- **How to run:**
  ```sh
  npm run pay-with-native-safe
  ```

### 3. Sponsoring Gas with 1Balance

This example shows how a Safe account can be used with the Zerodev Kernel and Gelato Bundler to sponsor gas for users.

⚡ _Note: This method requires users to create Sponsor Api keys on gelato app._

- **Bundler:** Gelato
- **Paymaster:** 1Balance
- **How to run:**
  ```sh
  npm run sponsored-with-1Balance-safe
  ```

### 4. Sponsoring Gas with Zerodev Paymaster

This example illustrates how a Safe account can be used with the Zerodev Kernel and Gelato Bundler without requiring a sponsored API key. Instead, it utilizes Zerodev's Paymaster to sponsor gas for users.

⚡ _Note: This method requires users to create gas policies on the Zerodev dashboard._

- **Bundler:** Gelato
- **Paymaster:** Zerodev
- **How to run:**
  ```sh
  npm run sponsored-with-zerodev-safe
  ```

## Examples Using Zerodev Kernel Account

Below are different examples demonstrating how Zerodev Kernel accounts can be used for various gas payment methods.

### 1. Paying Gas with ERC-20 Tokens

- **Bundler:** Gelato
- **Paymaster:** Zerodev with PIMLICO Provider (i.e https://rpc.zerodev.app/api/v2/paymaster/${ZERODEV_PROJECT_ID}?provider=PIMLICO)
- **How to run:**
  ```sh
  npm run pay-with-erc20
  ```

### 2. Paying Gas with Native Tokens

- **Bundler & Paymaster:** Zerodev
- **How to run:**
  ```sh
  npm run pay-with-native
  ```

### 3. Sponsoring Gas with 1Balance

⚡ _Note: This method requires users to create Sponsor Api keys on gelato app._

- **Bundler:** Gelato
- **Paymaster:** 1Balance
- **How to run:**
  ```sh
  npm run sponsored-with-1Balance
  ```

### 4. Sponsoring Gas with Zerodev Paymaster

⚡ _Note: This method requires users to create gas policies on the Zerodev dashboard._

- **Bundler:** Gelato
- **Paymaster:** Zerodev
- **How to run:**
  ```sh
  npm run sponsored-with-zerodev
  ```

## Current Limitations

- Paying with native tokens doesn't work with the Gelato bundler. However, it works with Zerodev for both Safe and Kernel accounts.

## Further steps

- Validate that native token payments work seamlessly with the Gelato bundler.

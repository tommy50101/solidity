## 簡介

模擬一個簡易的Compound服務，透過測試(./test/compound.ts, ./test/compound.ts)，模擬整個借貸場景 (包括 質押、借貸、清算、閃電貸)

## 建置

安裝 dependency

```
npm i
```

## 環境參數

建立 `.env` 檔案，新增以下的欄位及值（範例在 `.env.example`）

- `INFURA_GOERLI_API_URL`: [infura](https://infura.io/zh/dashboard/) 服務的 API URL + KEY，作為 RPC 連接測試網節點用（For Goerli）
- `ALCHEMY_GOERLI_API_URL`: [alchemy](https://dashboard.alchemy.com/) 服務的 API URL + KEY，作為 RPC 連接測試網節點用（For Goerli）
- `ETHERSCAN_API_KEY`: [etherscan](https://etherscan.io/) 服務，上傳驗證合約原始碼用

- `INFURA_MAINNET_API_URL`: [infura](https://infura.io/zh/dashboard/) 服務的 API URL + KEY，作為 RPC 連接測試網節點用（For Mainnet)
- `ALCHEMY_MAINNET_API_URL`: [alchemy](https://dashboard.alchemy.com/) 服務的 API URL + KEY，作為 Fork Mainnet 網路節點用（For Mainnet Fork）

## 編譯

```
npx hardhat compile
```

## 測試

```
npx hardhat test
```



# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

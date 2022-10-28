import { network } from "hardhat";

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { impersonateAccount } = require("@nomicfoundation/hardhat-network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


// 模仿某個帳號: Impersonate Account
// 取得該帳號權限: ethers.getSigner
// 用此帳號發送交易: connect


let accounts: any;
let usdc: any;
let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
let binanceHotWalletAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC';


beforeEach(async function () {
    accounts = await ethers.getSigners();
    usdc = await ethers.getContractAt("ERC20", usdcAddress);
});

it("BinanceWallet should contain USDC", async function () {
    let balance = await usdc.balanceOf(binanceHotWalletAddress);
    expect(balance).to.gt(0)
    console.log(`Binance wallet USDC balance: ${balance}`)
});

// it("Ask Binance to give me USDC", async function() {
//     let transferAmount = 10000000;
//     await network.provider.request({
//         method: "hardhat_impersonateAccount",
//         params: [binanceHotWalletAddress],
//     });
//     const binanceWallet = await ethers.getSigner(binanceHotWalletAddress);
//     await usdc.connect(binanceWallet).transfer(accounts[0].address, transferAmount);
//     let balance = await usdc.balanceOf(accounts[0].address);
//     console.log(`Our wallet USDC balance: ${balance}`);
//     expect(balance).to.eq(transferAmount);
// })
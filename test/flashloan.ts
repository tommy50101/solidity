/**
 * 使用 Hardhat 的 fork 模式撰寫測試，並使用 AAVE 的 Flash loan 來清算 user1，請遵循以下細節：
 * Fork Ethereum mainnet at block 15815693 (Reference)
 * cToken 的 decimals 皆為 18，初始 exchangeRate 為 1:1
 * Close factor 設定為 50%
 * Liquidation incentive 設為 8% (1.08 * 1e18) 或 10%
 * 使用 USDC 以及 UNI 代幣來作為 token A 以及 Token B
 * 在 Oracle 中設定 USDC 的價格為 $1，UNI 的價格為 $10
 * 設定 UNI 的 collateral factor 為 50%
 * User1 使用 1000 顆 UNI 作為抵押品借出 5000 顆 USDC
 * 將 UNI 價格改為 $6.2 使 User1 產生 Shortfall，並讓 User2 透過 AAVE 的 Flash loan 來清算 User1
 * 可以自行檢查清算 50% 後是不是大約可以賺 121 USD（Liquidation incentive = 8%）
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { impersonateAccount } = require('@nomicfoundation/hardhat-network-helpers');
const { formatUnits, parseUnits, parseEther } = require('ethers/lib/utils');
import { LogLevel, Logger } from '@ethersproject/logger';
Logger.setLogLevel(LogLevel.ERROR);

const BINANCE_ADDRESS = `0xF977814e90dA44bFA03b6295A0616a897441aceC`;
const USDC_ADDRESS = `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`;
const UNI_ADDRESS = `0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984`;
const PROVIDER_ADDRESS = `0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5`;
const UNISWAP_ROUTER = `0xE592427A0AEce92De3Edee1F18E0157C05861564`;
const DECIMALS = 18;

let owner: any;
let user1: any;
let user2: any;
let usdc: any;
let uni: any;
let cerc20;
let cTokenA: any;
let cTokenB: any;
let binance;
let comptroller: any;
let unitrollerProxy: any;
let priceOracle: any;
let interestRateModel;
let unitroller;
let repayAmount: any;
let flashloan: any;

const liquidationIncentive = parseUnits('1.08', 18);
const closeFactor = parseUnits('0.5', 18);
const USDCAmount = parseUnits('5000', 6);
const UNIAmount = parseUnits('1000', 18);

// DECIMAL of Compound's serUnderlyingPrice is 10^(36 - decimal of underlying asses)
// USDC
const priceOfTokenA = parseUnits('1', 36 - 6);
// UNI
const priceOfTokenB = parseUnits('10', 36 - 18);

const setComptroller = async () => {
    // Set Liquidation incentive (設為 8%（1.08 * 1e18))
    await unitrollerProxy._setLiquidationIncentive(liquidationIncentive);

    // Set Close factor (設定為 50%)
    await unitrollerProxy._setCloseFactor(closeFactor);

    // Set Price oracle
    await unitrollerProxy._setPriceOracle(priceOracle.address);

    // Set Underlying price
    await priceOracle.setUnderlyingPrice(cTokenA.address, priceOfTokenA); // USDC 的價格為 $1
    await priceOracle.setUnderlyingPrice(cTokenB.address, priceOfTokenB); // UNI 的價格為 $10

    // Set Support market
    await unitrollerProxy._supportMarket(cTokenA.address);
    await unitrollerProxy._supportMarket(cTokenB.address);

    // Set Collateral factor (設定 UNI 的 collateral factor 為 50%)
    await unitrollerProxy._setCollateralFactor(cTokenA.address, parseUnits('0.9', 18));
    await unitrollerProxy._setCollateralFactor(cTokenB.address, parseUnits('0.5', 18));
};

describe('Flash Loan', async () => {
    before(async () => {
        [owner, user1, user2] = await ethers.getSigners();

        usdc = await ethers.getContractAt('ERC20', `${USDC_ADDRESS}`);
        uni = await ethers.getContractAt('ERC20', `${UNI_ADDRESS}`);

        // 部署 PriceOracle
        const priceOracleFactory = await ethers.getContractFactory('SimplePriceOracle');
        priceOracle = await priceOracleFactory.deploy();
        await priceOracle.deployed();

        // 部署 InterestRateModel
        const interestRateModelFactory = await ethers.getContractFactory('WhitePaperInterestRateModel');
        interestRateModel = await interestRateModelFactory.deploy(0, 0);
        await interestRateModel.deployed();

        // 部署 Comptroller
        const comptrollerFactory = await ethers.getContractFactory('Comptroller');
        comptroller = await comptrollerFactory.deploy();
        await comptroller.deployed();

        // 部署 Unitroller
        const unitrollerFactory = await ethers.getContractFactory('Unitroller');
        unitroller = await unitrollerFactory.deploy();
        await unitroller.deployed();

        // 設置 unitrollerProxy
        await unitroller._setPendingImplementation(comptroller.address);
        await comptroller._become(unitroller.address);
        unitrollerProxy = await ethers.getContractAt('Comptroller', unitroller.address);

        /**
         * 部屬:
         * tokenA => USDC
         * tokenB => UNI
         */
        const CERC20Factory = await ethers.getContractFactory('CErc20Delegate');
        cerc20 = await CERC20Factory.deploy();

        const delegator = await ethers.getContractFactory('CErc20Delegator');

        cTokenA = await delegator.deploy(
            `${USDC_ADDRESS}`,
            unitrollerProxy.address,
            interestRateModel.address,
            parseUnits('1', 6), // 鏈上USDC的Decimal只有6
            'USDC',
            'USDC',
            DECIMALS,
            owner.address,
            cerc20.address,
            `0x`
        );

        cTokenB = await delegator.deploy(
            `${UNI_ADDRESS}`,
            unitrollerProxy.address,
            interestRateModel.address,
            parseUnits('1', 18),
            'UNI',
            'UNI',
            DECIMALS,
            owner.address,
            cerc20.address,
            `0x`
        );
    });

    /**
     * User1 抵押 1000 顆 Uni
     * User2 抵押 5000 顆 USDC
     * User1 借出 5000 顆 USDC (以 1000 顆 Uni 作為抵押品)
     */
    describe('Borrow', async () => {
        it('Borrow USDC by UNI as collateral', async () => {
            await setComptroller();

            // 建立鏈上幣安Mock帳號
            await impersonateAccount(`${BINANCE_ADDRESS}`);
            binance = await ethers.getSigner(`${BINANCE_ADDRESS}`);

            // 選擇將存入的某資產開啟，做為抵押品
            await unitrollerProxy.connect(user1).enterMarkets([cTokenA.address, cTokenB.address]);
            await unitrollerProxy.connect(user2).enterMarkets([cTokenA.address, cTokenB.address]);

            // -------------------------User1 Mint CTokenB(CUni)------------------------- //

            // Transfer 1000 UNI from Binance to user1
            await uni.connect(binance).transfer(user1.address, UNIAmount);
            expect(await uni.balanceOf(user1.address)).to.eq(UNIAmount);

            // User1 mint 1000 CTokenB(CUni)
            await uni.connect(user1).approve(cTokenB.address, UNIAmount);
            await cTokenB.connect(user1).mint(UNIAmount);
            expect(await cTokenB.balanceOf(user1.address)).to.eq(parseUnits('1000', 18));

            // User1 開啟 CTokenB(CUni) 做為抵押品
            await unitrollerProxy.connect(user1).enterMarkets([cTokenB.address]);

            // Check user1's liquidity
            let [errorOfUser1, liduidityOfUser1, shortfallOfUser1] = await unitrollerProxy.getAccountLiquidity(user1.address);
            expect(errorOfUser1).to.eq(0);
            expect(liduidityOfUser1).to.eq(parseUnits('5000', 18)); // 10u * 1000顆 * 50% = 5000u
            expect(shortfallOfUser1).to.eq(0);

            // -------------------------User2 Mint CTokenA(CUSDC)------------------------- //

            // Transfer 10000 USDC from Binance to user2
            await usdc.connect(binance).transfer(user2.address, USDCAmount);
            expect(await usdc.balanceOf(user2.address)).to.eq(USDCAmount);

            // User2 mint 5000 cTokenA(CUSDC)
            await usdc.connect(user2).approve(cTokenA.address, USDCAmount);
            await cTokenA.connect(user2).mint(USDCAmount);
            expect(await cTokenA.balanceOf(user2.address)).to.eq(parseUnits('5000', 6 + 12));

            // User2 開啟 CTokenA(CUSDC) 做為抵押品
            await unitrollerProxy.connect(user2).enterMarkets([cTokenA.address]);

            // Check user2's liquidity
            let [errorOfUser2, liduidityOfUser2, shortfallOfUser2] = await unitrollerProxy.getAccountLiquidity(user2.address);
            expect(errorOfUser2).to.eq(0);
            expect(liduidityOfUser2).to.eq(parseUnits('4500', 18)); // 1u * 5000顆 * 90% = 4500u
            expect(shortfallOfUser2).to.eq(0);

            // -------------------------User1 Borrow 5000 USDC by collabate 1000 UNI------------------------- //

            // User1 使用 1000 顆 UNI 作為抵押品，借出 5000 顆 USDC
            await cTokenA.connect(user1).borrow(USDCAmount);
            expect(await usdc.balanceOf(user1.address)).to.eq(USDCAmount);
        });
    });

    describe('Change price oracle and liquidate by AAVE flashloan.', async () => {
        it('Should has shortfall once price of UNI decrease from $10 to $6.2', async () => {
            // 將 UNI 價格從 $10 改為 $6.2
            await priceOracle.setUnderlyingPrice(cTokenB.address, parseUnits('6.2', 18));

            // Check user1's liquidity after price of TokenB(UNI) decrease
            let [errorOfUser1, liduidityOfUser1, shortfallOfUser1] = await unitrollerProxy.getAccountLiquidity(user1.address);
            // Should has shortfall
            expect(errorOfUser1).to.eq(0);
            expect(liduidityOfUser1).to.eq(0);
            expect(shortfallOfUser1).to.eq(parseUnits('1900', 18)); // (6.2u * 1000顆 * 50%) - (1u * 5000顆) = -1900u
        });

        it('Deploy AaveFlashLoan contract.', async () => {
            let borrowBalance = await cTokenA.callStatic.borrowBalanceCurrent(user1.address);

            repayAmount = (borrowBalance * closeFactor) / parseUnits('1', 18);

            const flashloanFactory = await ethers.getContractFactory('AaveFlashLoan');
            flashloan = await flashloanFactory
                .connect(user2)
                .deploy(PROVIDER_ADDRESS, UNISWAP_ROUTER, cTokenA.address, cTokenB.address, user1.address, repayAmount);
            await flashloan.deployed();
        });

        it('Execute ...', async () => {
            // seizeTokens = actualRepayAmount * liquidationIncentive * priceBorrowed / (priceCollateral * exchangeRate)
            // seizeTokens = (5000顆 * 0.5) * 1.08 * 1u / (6.2u * 1) = 435.4838709677419顆 (被清算人要被轉出的 CTokenB 數量)

            // console.log(`-Before`);
            // console.log(`--CUNI`);
            // console.log(`  USER1: ${await cTokenB.balanceOf(user1.address)}`); // 1000000000000000000000
            // console.log(`  USER2: ${await cTokenB.balanceOf(user2.address)}`); // 0
            // console.log(`--USDC`);
            // console.log(`  USER1: ${await usdc.balanceOf(user1.address)}`); // 5000000000
            // console.log(`  USER2: ${await usdc.balanceOf(user2.address)}\n`); //0
            expect(await cTokenB.balanceOf(user1.address)).to.eq(parseUnits('1000', 18));
            expect(await cTokenB.balanceOf(user2.address)).to.eq(0);
            expect(await usdc.balanceOf(user1.address)).to.eq(parseUnits('5000', 6));
            expect(await usdc.balanceOf(user2.address)).to.eq(0);

            /**
             * 透過 AAVE 的 Flash loan 來清算
             * 可以自行檢查清算 50% 後是不是大約可以賺 121 USD
             * result: $121.739940
             */
            await flashloan.connect(user2).flashLoan(USDC_ADDRESS, repayAmount);

            // console.log(`-Aefore:`);
            // console.log(`--CUNI`);
            // console.log(`  USER1: ${await cTokenB.balanceOf(user1.address)}`); // 564516129032258064517
            // console.log(`  USER2: ${await cTokenB.balanceOf(user2.address)}`); // 0
            // console.log(`--USDC`);
            // console.log(`  USER1: ${await usdc.balanceOf(user1.address)}`); // 5000000000
            // console.log(`  USER2: ${await usdc.balanceOf(user2.address)}`); // 121739940
            expect(await cTokenB.balanceOf(user1.address)).to.eq(parseUnits('564.516129032258064517', 18));
            expect(await cTokenB.balanceOf(user2.address)).to.eq(0);
            expect(await usdc.balanceOf(user1.address)).to.eq(parseUnits('5000', 6));
            expect(await usdc.balanceOf(user2.address)).to.eq(parseUnits('121.739940', 6));
        });
    });
});

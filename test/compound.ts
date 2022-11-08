import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { LogLevel, Logger } from '@ethersproject/logger';

Logger.setLogLevel(LogLevel.ERROR);

describe('Compound\n', () => {
    describe('\n⚠️  Basic deployment\n', () => {
        it('⚠️　UnitrollerProxy should have a right admin who had deployed it\n', async () => {
            // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
            const [unitrollerProxy, , , owner, , , , , ,]: any = await loadFixture(deployBasicContract);

            // 部屬時沒用 connect() 指定，就會預設使用第一個signer
            expect(await unitrollerProxy.admin()).to.equal(owner.address);
        });
    });

    describe('\n⚠️  Mint & Redeem\n', () => {
        let mintAmount = ethers.utils.parseUnits('100', 18);
        let redeemAmount = ethers.utils.parseUnits('100', 18);
        // console.log(mintAmount);

        it('⚠️　Should be able to mint/redeem with token A', async () => {
            // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
            const [unitrollerProxy, , , , userA, , tokenA, , cTokenA]: any = await loadFixture(deployBasicContract);

            //---------------------------------------------------------------------------------------------------------------------//

            // 檢測該 CToken 是否在 market list map 裡
            expect((await unitrollerProxy.markets(cTokenA.address)).isListed).to.equal(false);

            // 把該 cToken 加到 UnitrollerProxy 的 markets listed map 裡
            await unitrollerProxy._supportMarket(cTokenA.address);

            expect((await unitrollerProxy.markets(cTokenA.address)).isListed).to.equal(true);

            //-------------------------------------------用戶 userA 質押 tokenA 至 Compound ，開始-------------------------------------------//

            // userA mint 100顆 CTokenA

            // Mint前 UserA 手中的 TokenA 數量
            expect(await tokenA.balanceOf(userA.address)).to.equal(0);

            await tokenA.transfer(userA.address, mintAmount);

            // 取得轉帳授權: userA 同意轉 tokenA 至 cTokenA合約
            await tokenA.connect(userA).approve(cTokenA.address, mintAmount);

            // UserA 呼叫 cTokenA合約 裡的 mint(), 該函數裡會先呼叫 UnitrollerProxy 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).mint(mintAmount);

            expect(await tokenA.balanceOf(userA.address)).to.equal(0);
            expect(await tokenA.balanceOf(cTokenA.address)).to.equal(ethers.utils.parseUnits('100', 18));
            expect(await cTokenA.balanceOf(userA.address)).to.equal(ethers.utils.parseUnits('100', 18));
            expect(await cTokenA.totalSupply()).to.equal(ethers.utils.parseUnits('100', 18));

            //-------------------------------------------用戶 userA 質押 tokenA 至 Compound ，結束-------------------------------------------//

            //-------------------------------------------用戶 userA 拿 cTokenA 贖回 tokenA ，開始-------------------------------------------//

            // userA redeem 回 100顆 TokenA

            // Redeem前 UserA 手中的 TokenA 數量
            expect(await tokenA.balanceOf(userA.address)).to.equal(0);

            // UserA 呼叫 cTokenA合約 裡的 redeem(), 該函數裡會先呼叫 UnitrollerProxy 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).redeem(redeemAmount);

            expect(await tokenA.balanceOf(userA.address)).to.equal(ethers.utils.parseUnits('100', 18));
            expect(await tokenA.balanceOf(cTokenA.address)).to.equal(0);
            expect(await cTokenA.balanceOf(userA.address)).to.equal(0);
            expect(await cTokenA.totalSupply()).to.equal(0);

            //-------------------------------------------用戶 userA 拿 cTokenA 贖回 tokenA ，結束-------------------------------------------//
        });
    });

    describe('\n⚠️  Borrow & Repay\n', () => {
        it('⚠️　Should be able to borrrow\n', async () => {
            await loadFixture(basicBorrow);
        });
    });

    describe(`\n⚠️  Liquidation\n`, () => {
        it(`⚠️　Should be able to liquidate when tokenB's collateral factor decrease from 60% to 30%\n`, async () => {
            let [collateralFactorOfTokenB, unitrollerProxy, , userA, userB, tokenA, , cTokenA, cTokenB] = await loadFixture(basicBorrow);

            // ----------------------------------- 把 tokenB 的 collateral factor 從 70% 調降至 30% ----------------------------------- //

            collateralFactorOfTokenB = ethers.utils.parseUnits('0.3', 18);
            await unitrollerProxy._setCollateralFactor(cTokenB.address, collateralFactorOfTokenB);

            // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
            // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
            // 100u * 1 * 0.3 - 50u * 1 = -20u
            // 調降 collateral factor 後， 剩餘可借 => 0u ， 積欠 => 20u
            let [error, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
            expect(error).to.equal(0);
            expect(liquidity).to.equal(0);
            expect(shortfall).to.equal(ethers.utils.parseUnits('20', 18));

            // ---------------------------------------------------- 清算開始 ---------------------------------------------------- //

            // 計算 單次可清算數量 = 借款人已借得該token數量 * closeFactor
            let amountOfLiquidateOnce = ethers.utils.parseUnits((50 * 0.5).toString(), 18);
            expect(amountOfLiquidateOnce).to.equal(ethers.utils.parseUnits('25', 18));

            // !!! 被清償人需要有對應的CToken，才能給清償人，require( cTokenCollateral.balanceOf(borrower) >= seizeTokens )，
            // seizeTokens = actualRepayAmount * liquidationIncentive * priceBorrowed / (priceCollateral * exchangeRate)
            // seizeTokens = 25 * 1.08 * 1 / (100 * 1) = 27
            await tokenA.transfer(userA.address, ethers.utils.parseUnits('27', 18));
            await tokenA.connect(userA).approve(cTokenA.address, ethers.utils.parseUnits('27', 18));
            await cTokenA.connect(userA).mint(ethers.utils.parseUnits('27', 18));

            // 清算
            // 先轉點 token 給 liquidator ，不然 liquidator 也沒 token 可還
            await tokenA.transfer(userB.address, amountOfLiquidateOnce);
            // 清算前，userB 擁有的 cToken 數量應為 50
            expect(await cTokenA.balanceOf(userB.address)).to.be.equal(ethers.utils.parseUnits('50', 18));
            await tokenA.connect(userB).approve(cTokenA.address, amountOfLiquidateOnce);
            await cTokenA.connect(userB).liquidateBorrow(userA.address, amountOfLiquidateOnce, cTokenA.address);
            // 清算後，userB 擁有的 cToken 數量應為 76.244 * 10^15
            expect(await cTokenA.balanceOf(userB.address)).to.be.equal(ethers.utils.parseUnits('76244', 15));

            // ---------------------------------------------------- 清算結束 ---------------------------------------------------- //
        });

        it(`⚠️　Should be able to liquidate when tokenB's price decrease from $100 to $60\n`, async () => {
            let [, unitrollerProxy, priceOracle, userA, userB, tokenA, , cTokenA, cTokenB, PriceOfTokenB] = await loadFixture(basicBorrow);

            // ------------------------------------------- 調降 tokenB 的 price 至 $60 ------------------------------------------- //

            PriceOfTokenB = ethers.utils.parseUnits('60', 18);
            await priceOracle.setUnderlyingPrice(cTokenB.address, PriceOfTokenB);

            // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
            // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
            // 60u * 1 * 0.7 - 50u * 1 = -8u
            let [error, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
            expect(error).to.equal(0);
            expect(liquidity).to.equal(0);
            expect(shortfall).to.equal(ethers.utils.parseUnits('8', 18));

            // ---------------------------------------------------- 清算開始 ---------------------------------------------------- //

            // 計算 單次可清算數量 = 借款人已借得該token數量 * closeFactor
            let amountOfLiquidateOnce = ethers.utils.parseUnits((50 * 0.5).toString(), 18);
            expect(amountOfLiquidateOnce).to.equal(ethers.utils.parseUnits('25', 18));

            // !!! 被清償人需要有對應的CToken，才能給清償人，require( cTokenCollateral.balanceOf(borrower) >= seizeTokens )，
            // seizeTokens = actualRepayAmount * liquidationIncentive * priceBorrowed / (priceCollateral * exchangeRate)
            // seizeTokens = 25 * 1.08 * 1 / (100 * 1) = 27
            await tokenA.transfer(userA.address, ethers.utils.parseUnits('27', 18));
            await tokenA.connect(userA).approve(cTokenA.address, ethers.utils.parseUnits('27', 18));
            await cTokenA.connect(userA).mint(ethers.utils.parseUnits('27', 18));

            // 清算
            // 先轉點 token 給 liquidator ，不然 liquidator 也沒 token 可還
            await tokenA.transfer(userB.address, amountOfLiquidateOnce);
            // 清算前，userB 擁有的 cToken 數量應為 50
            expect(await cTokenA.balanceOf(userB.address)).to.be.equal(ethers.utils.parseUnits('50', 18));
            await tokenA.connect(userB).approve(cTokenA.address, amountOfLiquidateOnce);
            await cTokenA.connect(userB).liquidateBorrow(userA.address, amountOfLiquidateOnce, cTokenA.address);
            // 清算後，userB 擁有的 cToken 數量應為 76.244 * 10^15
            expect(await cTokenA.balanceOf(userB.address)).to.be.equal(ethers.utils.parseUnits('76244', 15));

            // ---------------------------------------------------- 清算結束 ---------------------------------------------------- //
        });
    });
});

/**
 * 部屬基本合約 for loadFixture
 * -動作:
 * --部屬以下相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
 *  */
const deployBasicContract = async () => {
    // 取得 Signers
    const [owner, userA, userB] = await ethers.getSigners();
    // console.log(`Owner地址: ${owner.address}`);
    // console.log(`UserA地址: ${userA.address}`);
    // console.log(`UserB地址: ${userB.address}`);
    // console.log(`\n`);

    // -------------------------------------------------PriceOracle-------------------------------------------------- //
    // 部屬 PriceOracle
    const priceOracleFactory = await ethers.getContractFactory('SimplePriceOracle');
    const priceOracle = await priceOracleFactory.deploy();
    await priceOracle.deployed();
    // console.log(`部屬SimplePriceOracle成功，地址: ${priceOracle.address}\n`);

    // ----------------------------------------------InterestRateModel----------------------------------------------- //
    // 部屬 InterestRateModel
    const interestRateModelFactory = await ethers.getContractFactory('WhitePaperInterestRateModel');
    const interestRateModel = await interestRateModelFactory.deploy(ethers.utils.parseUnits('0', 18), ethers.utils.parseUnits('0', 18));
    await interestRateModel.deployed();
    // console.log(`部屬InterestRateModel成功，地址: ${interestRateModel.address}\n`);

    // -------------------------------------------------Comptroller-------------------------------------------------- //
    // 部屬 Comptroller
    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    const comptroller = await comptrollerFactory.deploy();
    await comptroller.deployed();
    // console.log(`部屬Comptroller成功，地址: ${comptroller.address}\n`);

    // 部屬 Unitroller (Unitroller is proxy of comptroller module)
    // Unitroller 是 Compound 自己實作的 prxoy pattern，因此不適用 Hardhat upgrade，需手動部署 delegator 跟 deletgatee 的部分
    const unitrollerFactory = await ethers.getContractFactory('Unitroller');
    const unitroller = await unitrollerFactory.deploy();
    await unitroller.deployed();
    // console.log(`部屬Unitroller成功，地址: ${unitroller.address}\n`);

    // 設置 Proxy
    await unitroller._setPendingImplementation(comptroller.address);
    await comptroller._become(unitroller.address);

    // Call Comptroller Use Proxy
    // getContractAt("MyContract", contractAddress): Gets a deployed instance of a contract
    let unitrollerProxy = await ethers.getContractAt('Comptroller', unitroller.address);

    // 指定 Comptroller 的 PriceOracle
    await unitrollerProxy._setPriceOracle(priceOracle.address);

    // 部屬 Underlying tokenA  (由 owner 部屬)
    const tokenAFactory = await ethers.getContractFactory('TokenA');
    const tokenA = await tokenAFactory.connect(owner).deploy(ethers.utils.parseUnits('10000', 18), 'TokenA', 'TA');
    await tokenA.deployed();
    // console.log(`部屬TokenA成功，地址: ${tokenA.address}`);

    // 部屬 Underlying tokenB  (由 owner 部屬)
    const tokenBFactory = await ethers.getContractFactory('TokenB');
    const tokenB = await tokenBFactory.connect(owner).deploy(ethers.utils.parseUnits('10000', 18), 'TokenB', 'TB');
    await tokenB.deployed();
    // console.log(`部屬TokenB成功，地址: ${tokenB.address}`);

    // 部屬 CTokenA (由 owner 部屬)
    const cTokenAFactory = await ethers.getContractFactory('CErc20Immutable');
    const cTokenA = await cTokenAFactory.deploy(
        tokenA.address,
        unitrollerProxy.address,
        interestRateModel.address,
        ethers.utils.parseUnits('1', 18), // 初始1:1
        'CTokenA',
        'CTA',
        18,
        owner.address
    );
    await cTokenA.deployed();
    // console.log(`部屬CTokenA成功，地址: ${cTokenA.address}`);

    // 部屬 CTokenB (由 owner 部屬)
    const cTokenBFactory = await ethers.getContractFactory('CErc20Immutable');
    const cTokenB = await cTokenBFactory.deploy(
        tokenB.address,
        unitrollerProxy.address,
        interestRateModel.address,
        ethers.utils.parseUnits('1', 18), // 初始1:1
        'CTokenB',
        'CTB',
        18,
        owner.address
    );
    await cTokenB.deployed();
    // console.log(`部屬CTokenB成功，地址: ${cTokenB.address}`);

    // 部屬者會獲得 10000 顆 TokenA, 10000 顆 TokenA, 0 顆 CTokenA, 0 顆 CTokenB
    expect(await tokenA.balanceOf(owner.address)).to.be.equal(ethers.utils.parseUnits('10000', 18));
    expect(await tokenB.balanceOf(owner.address)).to.be.equal(ethers.utils.parseUnits('10000', 18));
    expect(await cTokenA.balanceOf(owner.address)).to.be.equal(0);
    expect(await cTokenB.balanceOf(owner.address)).to.be.equal(0);

    return [unitrollerProxy, interestRateModel, priceOracle, owner, userA, userB, tokenA, tokenB, cTokenA, cTokenB];
};

/**
 * 基本借貸 for loadFixture
 * -固定參數
 * --TokenA 價格 = $1  ，抵押因子(collateralFactor) = 0.7
 * --TokenB 價格 = $100，抵押因子(collateralFactor) = 0.7
 * --清算因子(closeFactor) = 0.5
 * --清算獎勵(liquidationIncentive) = 1.08
 * -動作:
 * --UserA 使用 1 顆 tokenB 來 mint cTokenB
 * --UserB 使用 50 顆 tokenA 來 mint cTokenA
 * --UserA 使用 tokenB (1 顆) 作為抵押品來借出 50 顆 token A
 *  */
const basicBorrow = async () => {
    let PriceOfTokenA = ethers.utils.parseUnits('1', 18);
    let PriceOfTokenB = ethers.utils.parseUnits('100', 18);
    let collateralFactorOfTokenB = ethers.utils.parseUnits('0.7', 18);
    let closeFactor = ethers.utils.parseUnits('0.5', 18);
    let liquidationIncentive = ethers.utils.parseUnits('1.08', 18);

    // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
    const [unitrollerProxy, , priceOracle, , userA, userB, tokenA, tokenB, cTokenA, cTokenB]: any = await loadFixture(deployBasicContract);

    // 用 Oracle 設定價格  (tokenA 價格 $1 , tokenB 價格 $100)
    await priceOracle.setUnderlyingPrice(cTokenA.address, PriceOfTokenA);
    await priceOracle.setUnderlyingPrice(cTokenB.address, PriceOfTokenB);
    expect(await priceOracle.getUnderlyingPrice(cTokenA.address)).to.equal(PriceOfTokenA);
    expect(await priceOracle.assetPrices(tokenA.address)).to.equal(PriceOfTokenA);
    expect(await priceOracle.getUnderlyingPrice(cTokenB.address)).to.equal(PriceOfTokenB);
    expect(await priceOracle.assetPrices(tokenB.address)).to.equal(PriceOfTokenB);

    // UnitrollerProxy 把 CTokenA, CTokenB 加到 markets map 裡
    await unitrollerProxy._supportMarket(cTokenA.address);
    await unitrollerProxy._supportMarket(cTokenB.address);

    // 設定 TokenB 的抵押成數 (Collateral Factor，這邊為50%)  (注意第二個參數 scaled by 1e18)
    // await unitrollerProxy._setCollateralFactor(cTokenA.address, collateralFactorOfTokenA);
    await unitrollerProxy._setCollateralFactor(cTokenB.address, collateralFactorOfTokenB);

    // 設定清償人最高可代還數量 (Close Factor，這邊為50%)
    await unitrollerProxy._setCloseFactor(closeFactor);

    // 設定清償人獎勵 (Liquidation Incentive，這邊為0.08)
    await unitrollerProxy._setLiquidationIncentive(liquidationIncentive);

    // 增加流動性
    await unitrollerProxy.connect(userA).enterMarkets([cTokenA.address, cTokenB.address]);
    await unitrollerProxy.connect(userB).enterMarkets([cTokenA.address, cTokenB.address]);

    // UserA 使用 1 顆 tokenB 來 mint cTokenB
    let mintAmountOfTokenB = ethers.utils.parseUnits('1', 18);
    await tokenB.transfer(userA.address, mintAmountOfTokenB);
    await tokenB.connect(userA).approve(cTokenB.address, mintAmountOfTokenB);
    await cTokenB.connect(userA).mint(mintAmountOfTokenB);

    // UserA 使用 1 顆 tokenB 去 mint cTokenB 後，初始剩餘借款額度為 70u
    let [error, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
    expect(error).to.equal(0);
    expect(liquidity).to.equal(ethers.utils.parseUnits('70', 18));
    expect(shortfall).to.equal(0);

    // UserB 使用 50 顆 tokenA 來 mint cTokenA
    let mintAmountOfTokenA = ethers.utils.parseUnits('50', 18);
    await tokenA.transfer(userB.address, mintAmountOfTokenA);
    await tokenA.connect(userB).approve(cTokenA.address, mintAmountOfTokenA);
    await cTokenA.connect(userB).mint(mintAmountOfTokenA);
    await unitrollerProxy.getAccountLiquidity(userB.address);

    // UserA 使用 tokenB (1 顆) 作為抵押品來借出 50 顆 token A
    let borrowAmountOfTokenA = ethers.utils.parseUnits('50', 18);
    await cTokenA.connect(userA).borrow(borrowAmountOfTokenA);
    expect(await tokenA.balanceOf(userA.address)).to.equal(ethers.utils.parseUnits('50', 18));

    // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
    // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
    // 100u * 1 * 0.7 - 50u * 1 = 20u
    // UserA 借出 50 顆 tokenA 後，剩餘借款額度應為 20u
    [error, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
    expect(error).to.equal(0);
    expect(liquidity).to.equal(ethers.utils.parseUnits('20', 18));
    expect(shortfall).to.equal(0);

    return [collateralFactorOfTokenB, unitrollerProxy, priceOracle, userA, userB, tokenA, tokenB, cTokenA, cTokenB, PriceOfTokenB];
};

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { extensions } from '../typechain-types/@openzeppelin/contracts/token/ERC20';

describe('Compound\n', () => {
    // 部屬基本合約模塊 (PriceOracle, InterestRateModel, Comptroller, Unitroller)
    const deployBasicContract = async () => {
        // 取得 Signers
        const [owner, userA, userB] = await ethers.getSigners();
        console.log(`Owner地址: ${owner.address}`);
        console.log(`UserA地址: ${userA.address}`);
        console.log(`UserB地址: ${userB.address}`);
        console.log(`\n`);

        // -------------------------------------------------PriceOracle-------------------------------------------------- //
        // 部屬 PriceOracle
        const priceOracleFactory = await ethers.getContractFactory('SimplePriceOracle');
        const priceOracle = await priceOracleFactory.deploy();
        await priceOracle.deployed();
        console.log(`部屬SimplePriceOracle成功，地址: ${priceOracle.address}\n`);

        // ----------------------------------------------InterestRateModel----------------------------------------------- //
        // 部屬 InterestRateModel
        const interestRateModelFactory = await ethers.getContractFactory('WhitePaperInterestRateModel');
        const interestRateModel = await interestRateModelFactory.deploy(ethers.utils.parseUnits('0', 18), ethers.utils.parseUnits('0', 18));
        await interestRateModel.deployed();
        console.log(`部屬InterestRateModel成功，地址: ${interestRateModel.address}\n`);

        // -------------------------------------------------Comptroller-------------------------------------------------- //
        // 部屬 Comptroller
        const comptrollerFactory = await ethers.getContractFactory('Comptroller');
        const comptroller = await comptrollerFactory.deploy();
        await comptroller.deployed();
        console.log(`部屬Comptroller成功，地址: ${comptroller.address}\n`);

        // 部屬 Unitroller (Unitroller is proxy of comptroller module)
        // Unitroller 是 Compound 自己實作的 prxoy pattern，因此不適用 Hardhat upgrade，需手動部署 delegator 跟 deletgatee 的部分
        const unitrollerFactory = await ethers.getContractFactory('Unitroller');
        const unitroller = await unitrollerFactory.deploy();
        await unitroller.deployed();
        console.log(`部屬Unitroller成功，地址: ${unitroller.address}\n`);

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
        console.log(`部屬TokenA成功，地址: ${tokenA.address}`);
        console.log(`owner 部屬了 TokenA合約 以獲得 ${await tokenA.balanceOf(owner.address)} 枚 tokenA\n`);

        // 部屬 Underlying tokenB  (由 owner 部屬)
        const tokenBFactory = await ethers.getContractFactory('TokenB');
        const tokenB = await tokenBFactory.connect(owner).deploy(ethers.utils.parseUnits('10000', 18), 'TokenB', 'TB');
        await tokenB.deployed();
        console.log(`部屬TokenB成功，地址: ${tokenB.address}`);
        console.log(`owner 部屬了 TokenB合約 以獲得 ${await tokenB.balanceOf(owner.address)} 枚 tokenB\n`);

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
        console.log(`部屬CTokenA成功，地址: ${cTokenA.address}`);
        console.log(`Owner of cTokenA: ${await cTokenA.admin()}`);

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
        console.log(`部屬CTokenB成功，地址: ${cTokenB.address}`);
        console.log(`Owner of cTokenB: ${await cTokenB.admin()}`);

        return [unitrollerProxy, interestRateModel, priceOracle, owner, userA, userB, tokenA, tokenB, cTokenA, cTokenB];
    };

    describe('\n⚠️  Basic deployment\n', () => {
        it('UnitrollerProxy should have a right admin who had deployed it\n', async () => {
            console.log(`⚠️　【UnitrollerProxy should have a right admin who had deployed it】　⚠️\n`);

            // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
            const [unitrollerProxy, interestRateModel, priceOracle, owner, userA, userB, tokenA, tokenB, cTokenA, cTokenB]: any = await loadFixture(
                deployBasicContract
            );

            // 部屬時沒用 connect() 指定，就會預設使用第一個signer
            expect(await unitrollerProxy.admin()).to.equal(owner.address);

            console.log(`\n⚠️　【測試結束: UnitrollerProxy should have a right admin who had deployed it】　⚠️\n\n\n`);
        });
    });

    describe('\n⚠️  Mint & Redeem\n', () => {
        let mintAmount = ethers.utils.parseUnits('100', 18);
        let redeemAmount = ethers.utils.parseUnits('100', 18);
        // console.log(mintAmount);

        it('Should be able to mint/redeem with token A', async () => {
            console.log(`⚠️　【測試開始: Should be able to mint/redeem with token A】　⚠️`);

            // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
            const [unitrollerProxy, interestRateModel, priceOracle, owner, userA, userB, tokenA, tokenB, cTokenA, cTokenB]: any = await loadFixture(
                deployBasicContract
            );

            //---------------------------------------------------------------------------------------------------------------------//

            console.log(`\ncTokenA 是否在 market list map 裡 ?  => ${(await unitrollerProxy.markets(cTokenA.address)).isListed ? '是' : '否'}`);

            // 把該 cToken 加到 UnitrollerProxy 的 markets listed map 裡
            await unitrollerProxy._supportMarket(cTokenA.address);
            console.log(`呼叫 UnitrollerProxy._supportMarket(cTokenA.address)`);

            console.log(`cTokenA 是否在 market list map 裡 ?  => ${(await unitrollerProxy.markets(cTokenA.address)).isListed ? '是' : '否'}`);

            //---------------------------------------------------------------------------------------------------------------------//

            console.log(`\n----------用戶 userA 質押 tokenA 至 Compound ，開始----------`);

            console.log('Mint前 UserA 手中的 TokenA 數量:        ' + (await tokenA.balanceOf(userA.address)));

            await tokenA.transfer(userA.address, mintAmount);

            // 取得轉帳授權: userA 同意轉 tokenA 至 cTokenA合約
            await tokenA.connect(userA).approve(cTokenA.address, mintAmount);

            // UserA 呼叫 cTokenA合約 裡的 mint(), 該函數裡會先呼叫 UnitrollerProxy 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).mint(mintAmount);

            console.log(`UserA mint cTokenA ，數量:                ${mintAmount}\n`);

            console.log('Mint後 UserA 手中的 TokenA 數量:         ' + (await tokenA.balanceOf(userA.address)));
            console.log('Mint後 UserA 手中的 cTokenA 數量:         ' + (await cTokenA.balanceOf(userA.address)));
            console.log('Mint後 cTokenA合約 所擁有的 tokenA數量:   ' + (await tokenA.balanceOf(cTokenA.address)));
            console.log('Mint後 cTokenA合約 所擁有的 cTokenA數量:  ' + (await cTokenA.totalSupply()));

            // 確認 UserA 手中的 TokenA 數量 是否減少且和 mint 數量一致 ( 用戶拿 tokenA 去抵押 )
            expect(await tokenA.balanceOf(userA.address)).to.equal(0);

            // 確認 UserA 手中的 cTokenA 數量 是否增加且和 mint 數量一致 ( 用戶抵押 tokenA 後，獲得的抵押資產 cTokenA )
            expect(await cTokenA.balanceOf(userA.address)).to.equal(100000000000000000000n);

            // 確認 cTokenA合約 所擁有的 tokenA數量 是否增加且和 mint 數量一致 (因為用戶抵押 tokenA 進去 )
            expect(await tokenA.balanceOf(cTokenA.address)).to.equal(100000000000000000000n);

            // 確認 cTokenA合約 中 cToken 的總量是否增加且和 mint 數量一致 (這個值代表總共有多少 tokenA 抵押進來)
            expect(await cTokenA.totalSupply()).to.equal(100000000000000000000n);

            console.log(`----------用戶 userA 質押 tokenA 至 Compound ，結束----------\n`);

            //---------------------------------------------------------------------------------------------------------------------//

            console.log(`\n----------用戶 userA 拿 cTokenA 贖回 tokenA ，開始----------`);

            console.log('Redeem前 UserA 手中的 TokenA 數量:       ' + (await tokenA.balanceOf(userA.address)));

            // UserA 呼叫 cTokenA合約 裡的 redeem(), 該函數裡會先呼叫 UnitrollerProxy 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).redeem(redeemAmount);

            console.log(`UserA redeem cTokenA ，數量:              ${redeemAmount}\n`);

            console.log('Redeem後 UserA 手中的 TokenA 數量:      ' + (await tokenA.balanceOf(userA.address)));
            console.log('Redeem後 UserA 手中的 cTokenA 數量:                           ' + (await cTokenA.balanceOf(userA.address)));
            console.log('Redeem後 cTokenA合約 所擁有的 TokenA數量:                     ' + (await tokenA.balanceOf(cTokenA.address)));
            console.log('Redeem後 cTokenA合約 所擁有的 cTokenA數量:                    ' + (await cTokenA.totalSupply()));

            // 確認 UserA 手中的 TokenA 數量 是否增加 (正常要加上利息，所以要拿回比當初投進去的多，但這題利率設為0)
            expect(await tokenA.balanceOf(userA.address)).to.equal(100000000000000000000n);

            // 確認 UserA 手中的 cTokenA 數量 是否減少且和 redeem 數量一致 ( 用戶還 cTokenA ，贖回 tokenA )
            expect(await cTokenA.balanceOf(userA.address)).to.equal(0);

            // 確認 cTokenA合約 所擁有的 tokenA數量 是否減少，且和贖回數量一致 ( 用戶贖回 tokenA )
            expect(await tokenA.balanceOf(cTokenA.address)).to.equal(0);

            // 確認 cTokenA合約 中 cToken 的總量是否減少 (減少的量應該和 UserA 還回來的量一樣)
            expect(await cTokenA.totalSupply()).to.equal(0);

            console.log(`----------用戶 userA 拿 cTokenA 贖回 tokenA ，結束----------\n`);

            console.log(`⚠️　【測試結束: Should be able to mint/redeem with token A】　⚠️\n\n\n`);
        });
    });

    /**
     * 基本借貸模塊
     * -參數
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
        let collateralFactorOfTokenA = ethers.utils.parseUnits('0.7', 18);
        let collateralFactorOfTokenB = ethers.utils.parseUnits('0.7', 18);
        let closeFactor = ethers.utils.parseUnits('0.5', 18);
        let liquidationIncentive = ethers.utils.parseUnits('1.08', 18);

        // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
        const [unitrollerProxy, interestRateModel, priceOracle, owner, userA, userB, tokenA, tokenB, cTokenA, cTokenB]: any = await loadFixture(
            deployBasicContract
        );

        // 用 Oracle 設定價格  (tokenA 價格 $1 , tokenB 價格 $100)
        await priceOracle.setUnderlyingPrice(cTokenA.address, PriceOfTokenA);
        await priceOracle.setUnderlyingPrice(cTokenB.address, PriceOfTokenB);
        console.log(`\ntokenA 的價格為: ${await priceOracle.getUnderlyingPrice(cTokenA.address)}`);
        console.log(`tokenA 的價格為: ${await priceOracle.getUnderlyingPrice(cTokenB.address)}\n`);
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
        let [errorUserA, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
        console.log(`UserA 使用 ${mintAmountOfTokenB} 顆 tokenB 抵押後的剩餘借款額度為: ${liquidity}\n`);

        // UserB 使用 50 顆 tokenA 來 mint cTokenA
        let mintAmountOfTokenA = ethers.utils.parseUnits('50', 18);
        await tokenA.transfer(userB.address, mintAmountOfTokenA);
        await tokenA.connect(userB).approve(cTokenA.address, mintAmountOfTokenA);
        await cTokenA.connect(userB).mint(mintAmountOfTokenA);
        let [errorUserB, liquidityUserB, shortfallUserB] = await unitrollerProxy.getAccountLiquidity(userB.address);
        // console.log(`UserB 使用 ${mintAmountOfTokenA} 顆 tokenA 抵押後的剩餘借款額度為: ${liquidityUserB}`);

        // UserA 使用 tokenB (1 顆) 作為抵押品來借出 50 顆 token A
        console.log(`----------------------------UserA 使用 tokenB (1 顆) 作為抵押品來借出 50 顆 token A----------------------------\n`);
        let borrowAmountOfTokenA = ethers.utils.parseUnits('50', '18');
        await cTokenA.connect(userA).borrow(borrowAmountOfTokenA);

        console.log(`UserA 使用 ${mintAmountOfTokenB} 顆 tokenB 作為抵押品來借出 ${borrowAmountOfTokenA} 顆 token A 後:`);
        console.log(`userA 擁有 ${await tokenA.balanceOf(userA.address)} 個 tokenA\n`);

        expect(await tokenA.balanceOf(userA.address)).to.equal(borrowAmountOfTokenA);

        // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
        // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
        // 100u * 1 * 0.7 - 50u * 1 = 20u
        [errorUserA, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
        console.log(`UserA 的剩餘借款額度為: ${liquidity}`);
        console.log(`UserA 的積欠額度為: ${shortfall} * 10^18`);
        console.log(`是否可清算? => ${shortfall > 0 ? 'Yes' : 'No'}\n`);

        return [collateralFactorOfTokenB, unitrollerProxy, priceOracle, userA, userB, tokenA, tokenB, cTokenA, cTokenB, PriceOfTokenB];
    };

    async function liquidate(target: any, liquidator: any, token: any, cToken: any, amountOfLiquidateOnce: any) {
        // 先轉點 token 給 liquidator ，不然 liquidator 也沒 token 可還
        await token.transfer(liquidator.address, amountOfLiquidateOnce);

        console.log(`清算前，liquidator 擁有的 cToken 數量: ${await cToken.balanceOf(liquidator.address)}`);
        await token.connect(liquidator).approve(cToken.address, amountOfLiquidateOnce);
        await cToken.connect(liquidator).liquidateBorrow(target.address, amountOfLiquidateOnce, cToken.address);
        console.log(`清算後，liquidator 擁有的 cToken 數量: ${await cToken.balanceOf(liquidator.address)}`);
    }

    describe('\n⚠️  Borrow & Repay\n', () => {
        it('Should be able to borrrow\n', async () => {
            console.log(`⚠️　【測試開始: Should be able to borrrow】　⚠️`);

            let [collateralFactorOfTokenB, unitrollerProxy, priceOracle, userA, userB, tokenA, tokenB, cTokenA, cTokenB, PriceOfTokenB] =
                await loadFixture(basicBorrow);

            console.log(`⚠️　【測試結束: Should be able to borrrow】　⚠️\n\n\n`);
        });
    });

    describe(`\n⚠️  Liquidation\n`, () => {
        it(`Should be able to liquidate when tokenB's collateral factor decrease from 60% to 30%\n`, async () => {
            console.log(`⚠️　【測試開始: Should be able to liquidate when tokenB's collateral factor decrease from 60% to 30%】　⚠️`);

            let [collateralFactorOfTokenB, unitrollerProxy, priceOracle, userA, userB, tokenA, tokenB, cTokenA, cTokenB, PriceOfTokenB] =
                await loadFixture(basicBorrow);

            console.log(`\n------------------------------調降 tokenB 的 collateral factor 至 30%------------------------------\n`);
            console.log(`調降 tokenB 的 collateral factor 至 30% 後:`);
            collateralFactorOfTokenB = ethers.utils.parseUnits('0.3', 18);
            await unitrollerProxy._setCollateralFactor(cTokenB.address, collateralFactorOfTokenB);

            // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
            // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
            // 100u * 1 * 0.3 - 50u * 1 = -20u
            let [errorUserA, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
            console.log(`UserA 的剩餘借款額度為: ${liquidity}`);
            console.log(`UserA 的積欠額度為: ${shortfall} * 10^18`);
            console.log(`是否可清算? => ${shortfall > 0 ? 'Yes' : 'No'}`);

            console.log(`\n---------------------------------------------清算開始---------------------------------------------\n`);
            // 計算 單次可清算數量 = 借款人已借得該token數量 * closeFactor
            let amountOfLiquidateOnce = ethers.utils.parseUnits((50 * 0.5).toString(), 18);
            console.log(`單次可清算數量: ${amountOfLiquidateOnce}`);
            expect(amountOfLiquidateOnce).to.equal(ethers.utils.parseUnits('25', 18));

            // !!! require( cTokenCollateral.balanceOf(borrower) >= seizeTokens )
            // seizeTokens = actualRepayAmount * liquidationIncentive * priceBorrowed / (priceCollateral * exchangeRate)
            // seizeTokens = 25 * 1.08 * 1 / (100 * 1) = 27
            console.log(await cTokenA.balanceOf(userA.address));
            await tokenA.transfer(userA.address, ethers.utils.parseUnits('27', 18));
            await tokenA.connect(userA).approve(cTokenA.address, ethers.utils.parseUnits('27', 18));
            await cTokenA.connect(userA).mint(ethers.utils.parseUnits('27', 18));
            console.log(await cTokenA.balanceOf(userA.address));

            // 清算
            await liquidate(userA, userB, tokenA, cTokenA, amountOfLiquidateOnce);

            console.log(`\n---------------------------------------------清算結束---------------------------------------------\n`);

            console.log(`⚠️　【測試結束: Should be able to liquidate when tokenB's collateral factor decrease from 60% to 30%】　⚠️\n\n\n`);
        });

        it(`Should be able to liquidate when tokenB's price decrease from $100 to $60\n`, async () => {
            console.log(`⚠️　【測試開始: Should be able to liquidate when tokenB's price decrease from $100 to $60】　⚠️`);

            let [collateralFactorOfTokenB, unitrollerProxy, priceOracle, userA, userB, tokenA, tokenB, cTokenA, cTokenB, PriceOfTokenB] =
                await loadFixture(basicBorrow);

            console.log(`\n------------------------------調降 tokenB 的 price 至 $60------------------------------\n`);
            console.log(`調降 tokenB 的 price 至 $60 後:`);
            PriceOfTokenB = ethers.utils.parseUnits('60', 18);
            await priceOracle.setUnderlyingPrice(cTokenB.address, PriceOfTokenB);

            // getAccountLiquidity(address) 會計算該 address 剩餘可借款數量(liquidity) 及 欠款數量(shortfall)
            // userA 真實剩餘借款量(tokenB) = 抵押token市價 * 抵押token數量 * 抵押物collateralFactor - 借出token市價 * 借出token數量，正數加到liquidity，負數加到shortfall
            // 60u * 1 * 0.7 - 50u * 1 = -8u
            let [errorUserA, liquidity, shortfall] = await unitrollerProxy.getAccountLiquidity(userA.address);
            console.log(`UserA 的剩餘借款額度為: ${liquidity}`);
            console.log(`UserA 的積欠額度為: ${shortfall} * 10^18`);
            console.log(`是否可清算? => ${shortfall > 0 ? 'Yes' : 'No'}`);

            console.log(`\n---------------------------------------------清算開始---------------------------------------------\n`);
            // 計算 單次可清算數量 = 借款人已借得該token數量 * closeFactor
            let amountOfLiquidateOnce = ethers.utils.parseUnits((50 * 0.5).toString(), 18);
            console.log(`單次可清算數量: ${amountOfLiquidateOnce}`);
            expect(amountOfLiquidateOnce).to.equal(ethers.utils.parseUnits('25', 18));
            
            /// !!! require( cTokenCollateral.balanceOf(borrower) >= seizeTokens )
            // seizeTokens = actualRepayAmount * liquidationIncentive * priceBorrowed / (priceCollateral * exchangeRate)
            // seizeTokens = 25 * 1.08 * 1 / (100 * 1) = 27
            console.log(await cTokenA.balanceOf(userA.address));
            await tokenA.transfer(userA.address, ethers.utils.parseUnits('27', 18));
            await tokenA.connect(userA).approve(cTokenA.address, ethers.utils.parseUnits('27', 18));
            await cTokenA.connect(userA).mint(ethers.utils.parseUnits('27', 18));
            console.log(await cTokenA.balanceOf(userA.address));

            // 清算
            await liquidate(userA, userB, tokenA, cTokenA, amountOfLiquidateOnce);

            console.log(`\n---------------------------------------------清算結束---------------------------------------------\n`);

            console.log(`⚠️　【測試結束: Should be able to liquidate when tokenB's price decrease from $100 to $60】　⚠️\n\n\n`);
        });
    });
});

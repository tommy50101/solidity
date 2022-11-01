import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('Compound\n', () => {

    // 取得 Signers 模塊
    const getSigners = async () => {
        // 取得授權
        const signers = await ethers.getSigners();
        return signers;
    };

    // 部屬基本合約模塊 (PriceOracle, InterestRateModel, Comptroller, Unitroller)
    const deployBasicContract = async () => {
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

        return [comptroller, interestRateModel];
    };

    describe('\n⚠️  開始測試: Basic deployment\n', () => {
        it('Comptroller should have a right admin who had deployed it\n', async () => {
            const [comptroller, interestRateModel] = await loadFixture(deployBasicContract);
            const firstSigner = (await ethers.getSigners())[0];

            // 部屬時沒用 connect() 指定，就會預設使用第一個signer
            expect(await comptroller.admin()).to.equal(firstSigner.address);
        });
    });

    describe('\n⚠️  開始測試: Mint & Redeem\n', () => {
        let mintAmount = ethers.utils.parseUnits('100', '18');
        let redeemAmount = ethers.utils.parseUnits('100', '18');
        // console.log(mintAmount);

        it('Should be able to mint/redeem with token A', async () => {
            // 取得 Signers
            const [owner, userA, userB] = await loadFixture(getSigners);
            console.log(`Owner地址: ${owner.address}`);
            console.log(`UserA地址: ${userA.address}`);
            console.log(`UserB地址: ${userB.address}`);
            console.log(`\n`);

            // 部屬相關合約: PriceOracle, InterestRateModel, Comptroller, Unitroller
            const [comptroller, interestRateModel] = await loadFixture(deployBasicContract);

            // 部屬 Underlying tokenA  (由 userA 部屬)
            const erc20AFactory = await ethers.getContractFactory('TestErc20A');
            const tokenA = await erc20AFactory.connect(userA).deploy(ethers.utils.parseUnits('10000', 18), 'TestErc20A', 'EA');
            await tokenA.deployed();
            console.log(`部屬TokenA成功，地址: ${tokenA.address}`);
            console.log(`userA 部屬了 TokenA合約 以獲得 ${await tokenA.balanceOf(userA.address)} 枚 tokenA\n`);

            // 部屬 CErc20 (由 owner 部屬) ( CErc20Immutable  ---extend--->  cErc20  ---extend--->  ctoken )
            const cErc20ImmutableFactory = await ethers.getContractFactory('CErc20Immutable');
            const cTokenA = await cErc20ImmutableFactory.deploy(
                tokenA.address,
                comptroller.address,
                interestRateModel.address,
                ethers.utils.parseUnits('1', 18), // 初始1:1
                'TestCErc20A',
                'CEA',
                18,
                owner.address
            );
            await cTokenA.deployed();
            console.log(`部屬CTokenA成功，地址: ${cTokenA.address}`);
            console.log(`Owner of cTokenA: ${await cTokenA.admin()}`);

            //---------------------------------------------------------------------------------------------------------------------//

            console.log(`\ncTokenA 是否在 market list map 裡 ?  => ${(await comptroller.markets(cTokenA.address)).isListed ? '是' : '否'}`);

            // 把該 cToken 加到 comptroller 的 markets listed map 裡
            await comptroller._supportMarket(cTokenA.address);
            console.log(`呼叫 comptroller._supportMarket(cTokenA.address)`);

            console.log(`cTokenA 是否在 market list map 裡 ?  => ${(await comptroller.markets(cTokenA.address)).isListed ? '是' : '否'}`);

            //---------------------------------------------------------------------------------------------------------------------//

            console.log(`\n----------用戶 userA 質押 tokenA 至 Compound ，開始----------`);

            console.log('Mint前 UserA 手中的 TokenA 數量:        ' + (await tokenA.balanceOf(userA.address)));

            // 取得轉帳授權: userA 同意轉 tokenA 至 cTokenA合約
            await tokenA.connect(userA).approve(cTokenA.address, mintAmount);

            // UserA 呼叫 cTokenA合約 裡的 mint(), 該函數裡會先呼叫 Comptroller 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).mint(mintAmount);

            console.log(`UserA mint cTokenA ，數量:                ${mintAmount}\n`);

            console.log('Mint後 UserA 手中的 TokenA 數量:         ' + (await tokenA.balanceOf(userA.address)));
            console.log('Mint後 UserA 手中的 cTokenA 數量:         ' + (await cTokenA.balanceOf(userA.address)));
            console.log('Mint後 cTokenA合約 所擁有的 tokenA數量:   ' + (await tokenA.balanceOf(cTokenA.address)));
            console.log('Mint後 cTokenA合約 所擁有的 cTokenA數量:  ' + (await cTokenA.totalSupply()));

            // 確認 UserA 手中的 TokenA 數量 是否減少且和 mint 數量一致 ( 用戶拿 tokenA 去抵押 )
            expect(await tokenA.balanceOf(userA.address)).to.equal(9900000000000000000000n);

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

            // UserA 呼叫 cTokenA合約 裡的 redeem(), 該函數裡會先呼叫 Comptroller 的 mintAllowed() 以確認該 token 可以 mint
            await cTokenA.connect(userA).redeem(redeemAmount);

            console.log(`UserA redeem cTokenA ，數量:              ${redeemAmount}\n`);

            console.log('Redeem後 UserA 手中的 TokenA 數量:      ' + (await tokenA.balanceOf(userA.address)));
            console.log('Redeem後 UserA 手中的 cTokenA 數量:                           ' + (await cTokenA.balanceOf(userA.address)));
            console.log('Redeem後 cTokenA合約 所擁有的 TokenA數量:                     ' + (await tokenA.balanceOf(cTokenA.address)));
            console.log('Redeem後 cTokenA合約 所擁有的 cTokenA數量:                    ' + (await cTokenA.totalSupply()));

            // 確認 UserA 手中的 TokenA 數量 是否增加 (正常要加上利息，所以要拿回比當初投進去的多，但這題利率設為0)
            expect(await tokenA.balanceOf(userA.address)).to.equal(10000000000000000000000n);

            // 確認 UserA 手中的 cTokenA 數量 是否減少且和 redeem 數量一致 ( 用戶還 cTokenA ，贖回 tokenA )
            expect(await cTokenA.balanceOf(userA.address)).to.equal(0);

            // 確認 cTokenA合約 所擁有的 tokenA數量 是否減少，且和贖回數量一致 ( 用戶贖回 tokenA )
            expect(await tokenA.balanceOf(cTokenA.address)).to.equal(0);

            // 確認 cTokenA合約 中 cToken 的總量是否減少 (減少的量應該和 UserA 還回來的量一樣)
            expect(await cTokenA.totalSupply()).to.equal(0);

            console.log(`----------用戶 userA 拿 cTokenA 贖回 tokenA ，結束----------\n`);
        });
    });
});

import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('CERC20', () => {
    let mintAmount = ethers.utils.parseUnits('100', '18');
    let redeemAmount = ethers.utils.parseUnits('100', '18');
    // console.log(mintAmount);

    it('Should be able to mint/redeem with token A', async () => {
        // 部屬 Comptroller
        const comptrollerFactory = await ethers.getContractFactory('Comptroller');
        const comptroller = await comptrollerFactory.deploy();
        await comptroller.deployed();

        // 取得授權
        const [owner, user1] = await ethers.getSigners();
        console.log('owner: ' + owner.address);
        console.log('user1: ' + user1.address);

        // 部屬 Underlying token
        const erc20Factory = await ethers.getContractFactory('TestErc20');
        const erc20 = await erc20Factory.deploy(ethers.utils.parseUnits('10000', 18), 'TestErc20', 'TE');
        await erc20.deployed();
        console.log('Address of erc20: ' + erc20.address);

        // 部屬 Interest rate model
        const interestRateModelFactory = await ethers.getContractFactory('WhitePaperInterestRateModel');
        const interestRateModel = await interestRateModelFactory.deploy(ethers.utils.parseUnits('0', 18), ethers.utils.parseUnits('0', 18));
        await interestRateModel.deployed();

        // 部屬 CErc20  ( CErc20Immutable  ---extend--->  cErc20  ---extend--->  ctoken )
        const cErc20ImmutableFactory = await ethers.getContractFactory('CErc20Immutable');
        const cErc20Immutable = await cErc20ImmutableFactory.deploy(
            erc20.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits('1', 18), // 初始1:1
            'TestCErc20',
            'TCE',
            18,
            owner.address
        );
        await cErc20Immutable.deployed();
        console.log('Address of CErc20: ' + cErc20Immutable.address);
        console.log('Owner of this CErc20 is: ' + (await cErc20Immutable.admin()));

        // 部屬 PriceOracle
        const priceOracleFactory = await ethers.getContractFactory('SimplePriceOracle');
        const simplePriceOracle = await priceOracleFactory.deploy();
        await simplePriceOracle.deployed();

        // 指定 Comptroller 的 PriceOracle
        comptroller._setPriceOracle(simplePriceOracle.address);

        //-------------------------------------------------------------------------------------------------//

        console.log(
            `cToken:${cErc20Immutable.address} 是否在 market list map 裡 ? : ${(await comptroller.markets(cErc20Immutable.address)).isListed}`
        );

        // 把該 cToken 加到 comptroller 的 markets listed map 裡
        await comptroller._supportMarket(cErc20Immutable.address);

        console.log(
            `cToken:${cErc20Immutable.address} 是否在 market list map 裡 ? : ${(await comptroller.markets(cErc20Immutable.address)).isListed}`
        );

        console.log('開始mint');

        // CErc20合約 取得 Erc20合約 的轉帳授權
        await erc20.approve(cErc20Immutable.address, mintAmount);

        // Mint CErc20, 該函數裡會先呼叫 Comptroller 的 mintAllowed() 以確認該 token 可以 mint
        await cErc20Immutable.mint(mintAmount);

        console.log('CErc20 合約中的 Erc20 數量: ' + (await erc20.balanceOf(cErc20Immutable.address)));
        console.log('Owner 手中的 CErc20 數量: ' + (await cErc20Immutable.balanceOf(owner.address)));

        // 確認 CErc20 合約中的 Erc20 數量是否增加 (用戶抵押的 Erc20 )
        expect(await erc20.balanceOf(cErc20Immutable.address)).to.equal(mintAmount);

        // 確認 owner 手中的 CErc20 數量是否增加 (用戶借出的 CErc20 )
        expect(await cErc20Immutable.balanceOf(owner.address)).to.equal(mintAmount);

        console.log('開始redeem');

        // CErc20合約 取得 Erc20合約 的轉帳授權
        await cErc20Immutable.approve(owner.address, redeemAmount);

        // Mint CErc20, 該函數裡會先呼叫 Comptroller 的 redeemAllowed() 以確認該 token 可以 redeem
        await cErc20Immutable.redeem(redeemAmount);

        console.log('CErc20 合約中的 Erc20 數量: ' + (await erc20.balanceOf(cErc20Immutable.address)));
        console.log('Owner 手中的 CErc20 數量: ' + (await cErc20Immutable.balanceOf(owner.address)));

        // 確認 CErc20 合約中的 Erc20 數量是否減少 (合約原有的 Erc20 - 用戶贖回的 Erc20 )
        expect(await erc20.balanceOf(cErc20Immutable.address)).to.equal(0);

        // 確認 CErc20 合約裡的 CErc20 數量是否減少 (用戶還回合約的 CErc20 )
        expect(await cErc20Immutable.balanceOf(owner.address)).to.equal(0);
    });
});

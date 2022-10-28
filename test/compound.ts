import { ethers } from "hardhat";

const { expect } = require('chai');

describe('CERC20', async () => {
    it('Should be able to mint/redeem with token A', async () => {});
    const comptrollerFactory = await ethers.getContractFactory("Comptroller");
    const comptroller = await comptrollerFactory.deploy();
    await comptroller.deployed();


    const erc20Factory = await ethers.getContractFactory("TestErc20");
    const erc20 = await erc20Factory.deploy(
        ethers.utils.parseUnits("10000", 18),
    );
    await erc20.deployed();


    const interestRateModelFactory = await ethers.getContractFactory("WhitePaperInterestRateModel");
    const interestRateModel = await interestRateModelFactory.deploy(
        ethers.utils.parseUnits("0", 18),
        ethers.utils.parseUnits("0", 18),
    );
    await interestRateModel.deployed();


    const cErc20Factory = await ethers.getContractFactory("CErc20");
    const cErc20 = await cErc20Factory.deploy();
    await cErc20.deployed();

    await cErc20["initialize(address,address,address,uint256,string,string,uint8)"](
        erc20.address,
        comptroller.address,
        interestRateModel.address,
        ethers.utils.parseUnits("1", 18),
        "Compound test token",
        "cMytoken",
        18
    );
});

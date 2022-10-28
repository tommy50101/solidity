import { ethers, upgrades } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();


    const TestErc20 = await ethers.getContractFactory('TestErc20');
    // Deploy to proxy mode
    const token = TestErc20.deploy();

    // // Not sure what's this
    // await proxy.deployed();

    console.log('Proxy contract address:', token);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

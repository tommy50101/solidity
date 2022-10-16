import { ethers, upgrades } from 'hardhat';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log('Deploying contracts with the account:', deployer.address);
    console.log('Account balance:', (await deployer.getBalance()).toString());

    const MyErc721 = await ethers.getContractFactory('MyErc721');
    // Deploy to proxy mode
    const token = await upgrades.deployProxy(MyErc721, {
        initializer: 'initialize',
        kind: 'uups',
    });

    // // Not sure what's this
    // await token.deployed();

    console.log('Token address:', token.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

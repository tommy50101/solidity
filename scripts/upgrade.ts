import { ethers, upgrades } from 'hardhat';

async function main() {
    const MyErc721v2 = await ethers.getContractFactory('MyErc721v2');
    // upgradeProxy( <Proxy contract>, <V2 contract> )
    await upgrades.upgradeProxy('0x87907e0988578d47e88f198Db61FBc79614E2B8D', MyErc721v2);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

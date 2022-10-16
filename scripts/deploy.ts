import { ethers } from 'hardhat';

async function main() {
  // const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  // const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  // const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS;
  // const lockedAmount = ethers.utils.parseEther('1');
  // const Lock = await ethers.getContractFactory('Lock');
  // const lock = await Lock.deploy(unlockTime, { value: lockedAmount });
  // await lock.deployed();
  // console.log(
  //   `Lock with 1 ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`
  // );


  // // deploy contract - MyErc721.sol
  // const MyErc721 = await ethers.getContractFactory('MyErc721');
  // const myErc721 = await MyErc721.deploy();
  // await myErc721.deployed();
  // console.log(`deployed to ${myErc721.address}`);

  


  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MyErc721 = await ethers.getContractFactory("MyErc721");
  const token = await MyErc721.deploy();

  console.log("Token address:", token.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

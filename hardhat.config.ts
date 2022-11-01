import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    networks: {
        Goerli: {
            url: 'https://goerli.infura.io/v3/84a99a188f8e4aaab60c45f9955c5d6b',
            accounts: ['d2cf733a887c530e705fb92fbb69a98b5ec0f469e782c9f5746aa61ea7d331ab'],
        },
        hardhat: {
            // forking: {
            //     url: 'https://eth-mainnet.alchemyapi.io/v2/<key>',
            //     blockNumber: 11095000,
            // },
            allowUnlimitedContractSize: true
        },
    },
    etherscan: {
        apiKey: {
            goerli: 'G94NGYIUVNSKHZWN1KGZU9VB6KBQYCKE17',
        },
    },
};

export default config;

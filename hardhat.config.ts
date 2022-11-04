import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
require('dotenv').config();

const INFURA_GOERLI_API_URL = process.env.INFURA_GOERLI_API_URL;
const ALCHEMY_GOERLI_API_URL = process.env.ALCHEMY_GOERLI_API_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_MAINNET_API_KEY;

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
            url: INFURA_GOERLI_API_URL,
            accounts: ['d2cf733a887c530e705fb92fbb69a98b5ec0f469e782c9f5746aa61ea7d331ab'],
        },
        hardhat: {
            // forking: {
            //     url: ALCHEMY_GOERLI_API_URL,
            //     blockNumber: 11095000,
            // },
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
};

export default config;

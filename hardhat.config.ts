import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
require('dotenv').config();

const INFURA_GOERLI_API_URL = process.env.INFURA_GOERLI_API_URL;
const ALCHEMY_GOERLI_API_URL = process.env.ALCHEMY_GOERLI_API_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_MAINNET_API_KEY;
const GOERLI_PRIVATE_KEY  = process.env.GOERLI_PRIVATE_KEY;
const ALCHEMY_MAINNET_API_URL  = process.env.ALCHEMY_MAINNET_API_URL;

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
            accounts: [`0x${GOERLI_PRIVATE_KEY}`],
        },
        hardhat: {
            forking: {
                url: ALCHEMY_MAINNET_API_URL as string,
                blockNumber: 15815693,
            },
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
};

export default config;

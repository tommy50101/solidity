import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: '0.8.17',
  networks: {
    Goerli: {
      url: 'https://goerli.infura.io/v3/84a99a188f8e4aaab60c45f9955c5d6b',
      accounts: [
        'd2cf733a887c530e705fb92fbb69a98b5ec0f469e782c9f5746aa61ea7d331ab',
      ],
    },
  },
  etherscan: {
    apiKey: 'G94NGYIUVNSKHZWN1KGZU9VB6KBQYCKE17',
  },
};

export default config;

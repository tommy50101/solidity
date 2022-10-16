import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('MyErc721', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.

    async function deployMyErc721() {
        const [deployer] = await ethers.getSigners();
        const MyErc721 = await ethers.getContractFactory('MyErc721');
        const token = await MyErc721.deploy();

        return { token };
    }

    describe('Deployment', function () {
        it('Shoult set the right defult max supply', async function () {
            const { token } = await loadFixture(deployMyErc721);
            expect(await token.maxSupply()).to.equal(100);
        });

        it('Shoult set the right defult max mint per wallet', async function () {
            const { token } = await loadFixture(deployMyErc721);
            expect(await token.maxMintPerWallet()).to.equal(10);
        });

        it('Early mint should not active', async function () {
            const { token } = await loadFixture(deployMyErc721);
            expect(await token.earlyMintActive()).to.equal(false);
        });

        it('Public mint should not active', async function () {
            const { token } = await loadFixture(deployMyErc721);
            expect(await token.mintActive()).to.equal(false);
        });

        it('Revealed should not active', async function () {
            const { token } = await loadFixture(deployMyErc721);
            expect(await token.revealed()).to.equal(false);
        });
    });

    describe('Mint', async function () {
        // mint 超過最大值應該失敗
        it('Should fail if mint over 100', async function () {
            const { token } = await loadFixture(deployMyErc721);
            await token.toggleMint(true);
            // 這裡revertedWith()裡的訊息，要和主代碼required()裡的訊息一樣
            await expect(token.mint(101)).to.be.revertedWith('Purchase would exceed max tokens');
        });

        // mint 完總供應+1
        it('Total suply should increase 1', async function () {
            const { token } = await loadFixture(deployMyErc721);
            await token.toggleMint(true);

            const overrides = {
                value: ethers.utils.parseEther('0.01'),
            };
            await token.mint(1, overrides);
            expect(await token.totalSupply()).to.equal(1);
        });

        // 呼叫 mint 的帳號數量為1
        it('Balance of minter should be 1', async function () {
            let addr1;
            [addr1] = await ethers.getSigners();

            const { token } = await loadFixture(deployMyErc721);
            await token.toggleMint(true);

            const overrides = {
                value: ethers.utils.parseEther('0.01'),
            };
            await token.connect(addr1).mint(1, overrides);
            expect(await token.balanceOf(addr1.address)).to.equal(1);
        });

        // 目前 mint 的 tokenId 為呼叫 mint 的帳號
        it('Owner of tokenId 1 shoud be the minter', async function () {
            let addr1;
            [addr1] = await ethers.getSigners();

            const { token } = await loadFixture(deployMyErc721);
            await token.toggleMint(true);

            const overrides = {
                value: ethers.utils.parseEther('0.01'),
            };
            await token.connect(addr1).mint(1, overrides);

            expect(await token.ownerOf(1)).to.equal(addr1.address);
        });
    });
});

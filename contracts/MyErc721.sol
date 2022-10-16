// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MyErc721 is ERC721, Ownable {
    using Strings for uint256;

    // 0.01 ether = 10000000000000000 wei
    uint256 public price = 0.01 ether;
    uint256 public maxSupply = 100;
    uint256 public maxMintPerWallet = 10;
    uint256 private currentIndex = 0;
    bool public earlyMintActive = false;
    bool public mintActive = false;

    bool public revealed = false;
    string public notRevealedURI;
    string public baseURI;

    bytes32 public root; // Merkle tree root, set from frontend

    event Minted(address minter, uint256 amount);

    constructor() ERC721("Appworks", "AW") {}

    // Implement totalSupply() Function to return current total NFT being minted - week 8
    function totalSupply() public view returns (uint256) {
        return currentIndex;
    }

    // get next token id
    function getNextTokenId() external view returns (uint256) {
        return currentIndex;
    }

    // Implement setPrice(price) Function to set the mint price - week 8
    function setPrice(uint256 _price) public onlyOwner {
        price = _price;
    }

    // Set mint per user limit to 10 and owner limit to 20 - Week 8
    function setMaxMintPerWallet(uint256 _amount) public onlyOwner {
        maxMintPerWallet = _amount;
    }

    // Implement setMerkleRoot(merkleRoot) Function to set new merkle root - week 9
    function setMerkleRoot(bytes32 _root) public onlyOwner {
        root = _root;
    }

    // Merkle tree white list verify
    function merkleVerify(bytes32[] calldata _proof, bytes32 _leaf)
        public
        view
        returns (bool)
    {
        return MerkleProof.verify(_proof, root, _leaf);
    }

    // Implement toggleEarlyMint() Function to toggle the early mint available or not - week 9
    function toggleEarlyMint(bool _bool) external onlyOwner {
        earlyMintActive = _bool;
    }

    // Early mint function for people on the whitelist - week 9
    function whitelistMint(uint256 _mintAmount, bytes32[] calldata _proof)
        external
        payable
    {
        // Merkle tree white list verify
        bytes32 _leaf = keccak256(abi.encodePacked(msg.sender));
        require(merkleVerify(_proof, _leaf), "Not in whitelist.");
        require(tx.origin == msg.sender, "Contract is not allowed to mint.");
        require(earlyMintActive, "WhitelistSale is not active.");
        require(
            price * _mintAmount <= msg.value,
            "Ether value sent is not correct"
        );
        require(
            (balanceOf(msg.sender) + _mintAmount) < maxMintPerWallet,
            "Over max mint per wallet"
        );
        require(
            currentIndex + _mintAmount <= maxSupply,
            "Purchase would exceed max tokens"
        );

        uint256 _tokenId = currentIndex;
        for (uint256 i = 0; i < _mintAmount; i++) {
            // bad, loop裡操作storage
            // currentIndex += 1;

            // good, 上面先把storage複製給一個區域memory變數，loop操作這區域memory變數就好，最後再指派回原本的全域storage變數
            _tokenId += 1;

            _safeMint(msg.sender, currentIndex);
        }
        currentIndex = _tokenId;

        emit Minted(msg.sender, _mintAmount);
    }

    // Implement toggleMint() Function to toggle the public mint available or not - week 8
    function toggleMint(bool _bool) external onlyOwner {
        mintActive = _bool;
    }

    // Public mint function - week 8
    function mint(uint256 _mintAmount) public payable {
        require(mintActive == true, "Public sale is not active.");
        require(
            currentIndex + _mintAmount <= maxSupply,
            "Purchase would exceed max tokens"
        );
        require(
            price * _mintAmount <= msg.value,
            "Ether value sent is not correct"
        );
        require(
            (balanceOf(msg.sender) + _mintAmount) < maxMintPerWallet,
            "Over max mint per wallet"
        );

        for (uint256 i = 0; i < _mintAmount; i++) {
            currentIndex += 1;
            _safeMint(msg.sender, currentIndex);
        }
    }

    function setNotRevealedURI(string memory _notRevealedURI)
        external
        onlyOwner
    {
        notRevealedURI = _notRevealedURI;
    }

    // Implement setBaseURI(newBaseURI) Function to set BaseURI - week 9
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    // Implement toggleReveal() Function to toggle the blind box is revealed - week 9
    function toggleReveal(bool _bool) external onlyOwner {
        revealed = _bool;
    }

    // 用戶Reveal自己的盲盒
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "token not exist");

        if (!revealed) {
            return notRevealedURI; // 還沒reveal的盲盒, 回傳一個特定的URI
        }

        string memory _mBaseURI = _baseURI();
        return
            bytes(_mBaseURI).length > 0
                ? string(abi.encodePacked(_mBaseURI, _tokenId.toString()))
                : "";
    }

    // Function to return the base URI
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    // Implement withdrawBalance() Function to withdraw funds from the contract - week 8
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }

    // Let this contract can be upgradable, using openzepplin proxy library - week 10
    // Try to modify blind box images by using proxy
}

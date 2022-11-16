// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import './Uniswapv3/ISwapRouter.sol';
import './AAVE/FlashLoanReceiverBase.sol';
import './compound-protocol/CErc20.sol';
import 'hardhat/console.sol';

contract AaveFlashLoan is FlashLoanReceiverBase {
    using SafeMath for uint256;

    //admin
    address public admin;

    // Uniswap
    ISwapRouter public immutable swapRouter;
    CErc20 public immutable cUSDC;
    CErc20 public immutable cUNI;
    address public borrower;
    uint256 public repayAmount;

    address public constant UNI = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    uint24 public constant POOLFEE = 3000;

    event Log(string message, uint256 val);

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }

    constructor(
        ILendingPoolAddressesProvider _addressProvider,
        ISwapRouter _swapRouter,
        CErc20 _cUSDC,
        CErc20 _cUNI,
        address _borrower,
        uint256 _repayAmount
    ) FlashLoanReceiverBase(_addressProvider) {
        swapRouter = ISwapRouter(_swapRouter);
        cUSDC = CErc20(_cUSDC);
        cUNI = CErc20(_cUNI);
        borrower = _borrower;
        repayAmount = _repayAmount;

        admin = msg.sender;
    }

    // Avoid stack too deep error
    struct UintVars {
        uint256 uniBalance;
        uint256 amountOut_USDC;
        uint256 amountOwing;
        uint256 leftBalance;
    }

    /**
        This function is called after your contract has received the flash loaned amount  (閃電貸所借代幣轉至此合約"後"，所要進行的操作)
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(LENDING_POOL), 'Not Lending Pool');
        require(initiator == address(this), 'Initiator Invalid');

        UintVars memory uintVars;

        // -------------------------------------------------------- 清算 -------------------------------------------------------- //

        // 授權 CUSDC合約 可以從 此合約 轉 USDC 至 CUSDC合約 (代替被清償人Repay)
        IERC20(USDC).approve(address(cUSDC), repayAmount);

        // 此合約 調用 CUSDC合約的清算函數，repay CUI 後取得 UNI
        cUSDC.liquidateBorrow(borrower, repayAmount, cUNI);

        // ---------------------------------------------- Redeem 清算後拿到的抵押代幣 --------------------------------------------- //

        // 此合約 redeem CUNI 回 CUNI合約，拿回 UNI
        cUNI.redeem(cUNI.balanceOf(address(this)));

        // -------------------------------------------------------- 換錢 -------------------------------------------------------- //

        // 授權 uniswap 可以把 UNI 轉成 USDC
        uintVars.uniBalance = IERC20(UNI).balanceOf(address(this));
        IERC20(UNI).approve(address(swapRouter), uintVars.uniBalance);

        // Exchange from UNI to USDC
        ISwapRouter.ExactInputSingleParams memory uniswapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: UNI,
            tokenOut: USDC,
            fee: POOLFEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: uintVars.uniBalance,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        uintVars.amountOut_USDC = swapRouter.exactInputSingle(uniswapParams);

        // -------------------------------------------------------- 還錢 -------------------------------------------------------- //

        // Approve the LendingPool contract allowance to *pull* the owed amount
        // address[] memory tempAssets = assets;
        for (uint256 i = 0; i < assets.length; i++) {
            // 加上手續費，將 USDC 歸還至 AAVE LENDING_POOL
            uintVars.amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), uintVars.amountOwing);

            // 剩餘 USDC 轉回給 閃電貸借款人
            uintVars.leftBalance = uintVars.amountOut_USDC - uintVars.amountOwing;
            bytes memory callData = abi.encodeWithSelector(bytes4(params), admin, uintVars.leftBalance);
            (bool success, ) = assets[i].call(callData);
            require(success, 'Transfer rejected');
        }

        return true;
    }

    /**
        Liquidator call this function ( 借款人呼叫此函數，從閃電貸的 LENDING_POOL 裡借款 )
        ( P.S. 注意!! 借來的代幣不會轉到閃電貸借款人手中，而是轉到這個合約裡!! )
     */
    function flashLoan(address asset, uint256 amount) external onlyAdmin {
        address receiver = address(this);

        address[] memory assets = new address[](1);
        assets[0] = asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        // 0 = no debt, 1 = stable, 2 = variable
        // 0 = pay all loaned
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        bytes memory params = abi.encode(IERC20.transfer.selector);
        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referralCode);
    }
}

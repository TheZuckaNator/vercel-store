// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./interfaces/IMPHGameMarketplaceNative.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title IVerifier - Interface for the verifier contract
interface IVerifier {
    function isItApproved(address _contract) external view returns (bool);
}

/// @title MPHGameMarketplaceNative
/// @author @SolidityDevNL
/// @notice ERC-1155 marketplace with off-chain listings using native currency (ETH)
/// @dev Uses EIP-712 signatures for gasless listings, payments in native currency
contract MPHGameMarketplaceNative is 
    IMPHGameMarketplaceNative, 
    AccessControl, 
    EIP712, 
    ReentrancyGuard 
{
    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice Verifier contract for checking approved collections
    IVerifier public verifier;

    /// @notice Address that receives marketplace fees
    address payable public feeReceiver;

    /// @notice Fee in per mille (parts per thousand, e.g., 25 = 2.5%)
    uint256 public feePerMille;

    /// @notice Mapping of nonces for each seller's listing per NFT
    /// @dev nftContract => tokenId => seller => nonce
    mapping(address => mapping(uint256 => mapping(address => uint256))) public override nonces;

    /// @notice EIP-712 typehash for the Approval struct
    bytes32 private constant APPROVAL_TYPEHASH = keccak256(
        "Approval(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)"
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /// @notice Initializes the marketplace contract
    /// @param _verifier Address of the verifier contract
    /// @param admin Address to receive DEFAULT_ADMIN_ROLE
    /// @param _feeReceiver Address to receive marketplace fees
    constructor(
        address _verifier,
        address admin,
        address payable _feeReceiver
    ) EIP712("StudioChainMarketplace", "1") {
        if (_verifier == address(0) || admin == address(0) || _feeReceiver == address(0)) {
            revert ZeroAddress();
        }
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        verifier = IVerifier(_verifier);
        feeReceiver = _feeReceiver;
    }

    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplaceNative
    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external payable override nonReentrant {
        // Validate collection is approved
        if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
        
        // Validate deadline
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Validate seller has tokens
        if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
        
        // Validate marketplace approval
        if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

        // Get and validate nonce
        uint256 nonce = nonces[nftContract][tokenId][seller];

        // Verify signature
        bytes32 structHash = keccak256(
            abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != seller) revert NotOwner();

        // Calculate amounts
        uint256 totalPrice = price * amount;
        uint256 fee = calculateFee(totalPrice);
        uint256 sellerProceeds = totalPrice - fee;

        // Validate payment
        if (msg.value < totalPrice + fee) revert InsufficientPayment(totalPrice + fee, msg.value);

        // Increment nonce
        nonces[nftContract][tokenId][seller] = nonce + 1;

        // Transfer NFT
        IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");

        // Transfer payments
        _transferETH(payable(seller), sellerProceeds);
        if (fee > 0) {
            _transferETH(feeReceiver, fee);
        }

        // Refund excess
        if (msg.value > totalPrice + fee) {
            _transferETH(payable(msg.sender), msg.value - totalPrice - fee);
        }

        emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
    }

    /// @inheritdoc IMPHGameMarketplaceNative
    function buyMultipleNFTs(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata prices,
        uint256[] calldata deadlines,
        address[] calldata sellers,
        bytes[] calldata signatures
    ) external payable override nonReentrant {
        uint256 n = tokenIds.length;

        // Validate array lengths
        if (
            nftContracts.length != n || 
            amounts.length != n || 
            prices.length != n ||
            deadlines.length != n || 
            sellers.length != n || 
            signatures.length != n ||
            n == 0 || 
            n > 15
        ) revert IncorrectInput();

        uint256 totalRequired = 0;
        uint256 totalFees = 0;

        // First pass: validate and calculate totals
        for (uint256 i = 0; i < n; i++) {
            uint256 itemTotal = prices[i] * amounts[i];
            totalRequired += itemTotal;
            totalFees += calculateFee(itemTotal);
        }

        // Validate total payment
        if (msg.value < totalRequired + totalFees) {
            revert InsufficientPayment(totalRequired + totalFees, msg.value);
        }

        // Second pass: execute purchases
        for (uint256 i = 0; i < n; i++) {
            address nftContract = nftContracts[i];
            uint256 tokenId = tokenIds[i];
            uint256 amount = amounts[i];
            uint256 price = prices[i];
            uint256 deadline = deadlines[i];
            address seller = sellers[i];

            // Validations
            if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
            if (block.timestamp > deadline) revert SignatureExpired();
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
            if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

            // Verify signature
            uint256 nonce = nonces[nftContract][tokenId][seller];
            bytes32 structHash = keccak256(
                abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
            );
            address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signatures[i]);
            if (recovered != seller) revert NotOwner();

            // Update nonce
            nonces[nftContract][tokenId][seller] = nonce + 1;

            // Transfer NFT
            IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");

            // Transfer to seller
            uint256 totalPrice = price * amount;
            uint256 fee = calculateFee(totalPrice);
            _transferETH(payable(seller), totalPrice - fee);

            emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
        }

        // Transfer total fees
        if (totalFees > 0) {
            _transferETH(feeReceiver, totalFees);
        }

        // Refund excess
        if (msg.value > totalRequired + totalFees) {
            _transferETH(payable(msg.sender), msg.value - totalRequired - totalFees);
        }
    }

    /// @inheritdoc IMPHGameMarketplaceNative
    function delistToken(address nftContract, uint256 tokenId) external override {
        if (IERC1155(nftContract).balanceOf(msg.sender, tokenId) == 0) revert NotOwner();
        nonces[nftContract][tokenId][msg.sender] += 1;
        emit ListingCancelled(nftContract, tokenId, msg.sender);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplaceNative
    function setFeePerMille(uint256 newFeePerMille) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeePerMille > 1000) revert IncorrectInput();
        feePerMille = newFeePerMille;
        emit FeeChanged(newFeePerMille);
    }

    /// @inheritdoc IMPHGameMarketplaceNative
    function setFeeReceiver(address payable newFeeReceiver) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeReceiver == address(0)) revert ZeroAddress();
        feeReceiver = newFeeReceiver;
        emit FeeReceiverChanged(newFeeReceiver);
    }

    /// @inheritdoc IMPHGameMarketplaceNative
    function setVerifier(address newVerifier) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVerifier == address(0)) revert ZeroAddress();
        verifier = IVerifier(newVerifier);
        emit VerifierChanged(newVerifier);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplaceNative
    function calculateFee(uint256 gross) public view override returns (uint256 fee) {
        return (gross * feePerMille) / 1000;
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    /// @notice Safely transfer ETH to an address
    /// @param to Recipient address
    /// @param amount Amount to transfer in wei
    function _transferETH(address payable to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /// @notice Allow contract to receive ETH
    receive() external payable {}
}
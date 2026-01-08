// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./interfaces/IMPHGameMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title IVerifier
/// @notice Interface for the verifier contract that approves collections
interface IVerifier {
    function isItApproved(address _contract) external view returns (bool);
}

/// @title MPHGameMarketplace1155
/// @author MPH Team
/// @notice ERC-1155 marketplace with gasless listings using EIP-712 signatures
/// @dev Sellers sign listings off-chain, buyers execute purchases on-chain
/// @custom:security-contact security@mypethooligan.com
contract MPHGameMarketplace1155 is IMPHGameMarketplace1155, AccessControl, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice The ERC-20 token used for payments (e.g., KARRAT)
    IERC20 public paymentToken;

    /// @notice The verifier contract that approves NFT collections
    IVerifier public verifier;

    /// @notice Mapping of nonces: nftContract => tokenId => seller => nonce
    /// @dev Nonce increments on each sale or cancellation to prevent replay attacks
    mapping(address => mapping(uint256 => mapping(address => uint256))) public override nonces;

    /// @notice The marketplace fee in per mille (parts per thousand)
    /// @dev e.g., 25 = 2.5% fee
    uint256 public override feePerMille;

    /// @notice The address that receives marketplace fees
    address public override marketplace;

    // ============================================
    // CONSTANTS
    // ============================================

    /// @dev EIP-712 typehash for the Approval struct
    bytes32 private constant APPROVAL_TYPEHASH =
        keccak256("Approval(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)");

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /// @notice Initializes the marketplace contract
    /// @param _verifier The verifier contract address for collection approvals
    /// @param admin The admin address with DEFAULT_ADMIN_ROLE
    /// @param _marketplace The address to receive marketplace fees
    /// @param _paymentToken The ERC-20 token address for payments
    constructor(
        address _verifier,
        address admin,
        address _marketplace,
        address _paymentToken
    ) EIP712("KarratMarketplace", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        paymentToken = IERC20(_paymentToken);
        verifier = IVerifier(_verifier);
        marketplace = _marketplace;
    }

    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplace1155
    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external override nonReentrant {
        // Validate collection is approved
        if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
        
        // Validate signature hasn't expired
        if (block.timestamp > deadline) revert SignatureExpired();
        
        // Validate seller has sufficient balance
        if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
        
        // Validate marketplace is approved to transfer
        if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

        // Get current nonce for replay protection
        uint256 nonce = nonces[nftContract][tokenId][seller];

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
        );
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != seller) revert NotOwner();

        // Calculate payment amounts
        uint256 totalPrice = price * amount;
        uint256 royalty = calculateRoyalty(totalPrice);

        // Transfer payment tokens
        paymentToken.safeTransferFrom(msg.sender, seller, totalPrice);
        if (royalty > 0) {
            paymentToken.safeTransferFrom(msg.sender, marketplace, royalty);
        }

        // Transfer NFT to buyer
        IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");
        
        // Increment nonce to prevent replay
        nonces[nftContract][tokenId][seller] = nonce + 1;

        emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
    }

    /// @inheritdoc IMPHGameMarketplace1155
    function buyMultipleNFTs(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata prices,
        uint256[] calldata deadlines,
        address[] calldata sellers,
        bytes[] calldata signatures
    ) external override nonReentrant {
        uint256 n = tokenIds.length;

        // Validate input arrays
        if (nftContracts.length != n || amounts.length != n || prices.length != n ||
            deadlines.length != n || sellers.length != n || signatures.length != n ||
            n == 0 || n > 15) revert IncorrectInput();

        uint256 totalRoyaltyDue = 0;

        for (uint256 i = 0; i < n; i++) {
            address nftContract = nftContracts[i];
            uint256 tokenId = tokenIds[i];
            uint256 amount = amounts[i];
            uint256 price = prices[i];
            uint256 deadline = deadlines[i];
            address seller = sellers[i];

            // Validate each listing
            if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
            if (block.timestamp > deadline) revert SignatureExpired();
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
            if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

            uint256 nonce = nonces[nftContract][tokenId][seller];

            // Verify signature
            bytes32 structHash = keccak256(
                abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
            );
            address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signatures[i]);
            if (recovered != seller) revert NotOwner();

            uint256 totalPrice = price * amount;
            totalRoyaltyDue += calculateRoyalty(totalPrice);

            // Transfer payment to seller
            paymentToken.safeTransferFrom(msg.sender, seller, totalPrice);
            
            // Transfer NFT to buyer
            IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");
            
            // Increment nonce
            nonces[nftContract][tokenId][seller] = nonce + 1;

            emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
        }

        // Transfer accumulated royalties
        if (totalRoyaltyDue > 0) {
            paymentToken.safeTransferFrom(msg.sender, marketplace, totalRoyaltyDue);
        }
    }

    /// @inheritdoc IMPHGameMarketplace1155
    function delistToken(address nftContract, uint256 tokenId) external override {
        if (IERC1155(nftContract).balanceOf(msg.sender, tokenId) == 0) revert NotOwner();
        
        uint256 newNonce = nonces[nftContract][tokenId][msg.sender] + 1;
        nonces[nftContract][tokenId][msg.sender] = newNonce;
        
        emit ListingCancelled(nftContract, tokenId, msg.sender, newNonce);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplace1155
    function setFeePerMille(uint256 newFeePerMille) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeePerMille > 1000) revert IncorrectInput();
        feePerMille = newFeePerMille;
        emit FeeChanged(newFeePerMille);
    }

    /// @inheritdoc IMPHGameMarketplace1155
    function setMarketPlace(address newMarketPlace) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        marketplace = newMarketPlace;
        emit MarketplaceChanged(newMarketPlace);
    }

    /// @inheritdoc IMPHGameMarketplace1155
    function setVerifier(address _verifier) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        verifier = IVerifier(_verifier);
        emit VerifierChanged(_verifier);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /// @inheritdoc IMPHGameMarketplace1155
    function calculateRoyalty(uint256 gross) public view override returns (uint256 fee) {
        return (gross * feePerMille) / 1000;
    }

    /// @notice Returns the EIP-712 domain separator
    /// @return The domain separator hash
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @title IMPHGameMarketplace1155
/// @notice Interface for the MPH Game Marketplace supporting ERC-1155 tokens
/// @dev Defines events, errors, and function signatures for the marketplace
interface IMPHGameMarketplace1155 {
    // ============================================
    // EVENTS
    // ============================================

    /// @notice Emitted when an NFT is purchased
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token purchased
    /// @param buyer The address of the buyer
    /// @param seller The address of the seller
    /// @param amount The quantity of tokens purchased
    /// @param totalPrice The total price paid in payment tokens
    event NFTBought(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 totalPrice
    );

    /// @notice Emitted when the marketplace fee is changed
    /// @param newFeePerMille The new fee in per mille (parts per thousand)
    event FeeChanged(uint256 newFeePerMille);

    /// @notice Emitted when the marketplace address is changed
    /// @param newMarketplace The new marketplace address for fee collection
    event MarketplaceChanged(address newMarketplace);

    /// @notice Emitted when the verifier contract is changed
    /// @param newVerifier The new verifier contract address
    event VerifierChanged(address newVerifier);

    /// @notice Emitted when a listing is cancelled (nonce incremented)
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token delisted
    /// @param seller The address of the seller who delisted
    /// @param newNonce The new nonce value after delisting
    event ListingCancelled(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 newNonce
    );

    // ============================================
    // ERRORS
    // ============================================

    /// @notice Thrown when the NFT is not for sale or price doesn't match
    error NotForSaleOrWrongPrice();

    /// @notice Thrown when the NFT collection is not approved in the verifier
    error CollectionDoesNotSellHere();

    /// @notice Thrown when the signature doesn't match the seller
    error NotOwner();

    /// @notice Thrown when input arrays have mismatched lengths or invalid values
    error IncorrectInput();

    /// @notice Thrown when the listing signature has expired
    error SignatureExpired();

    /// @notice Thrown when the marketplace is not approved to transfer NFTs
    error NotApprovedForTransfer();

    // ============================================
    // FUNCTIONS
    // ============================================

    /// @notice Purchase a single NFT listing
    /// @dev Verifies EIP-712 signature and transfers tokens
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token to purchase
    /// @param amount The quantity to purchase
    /// @param price The price per token in payment tokens
    /// @param deadline The timestamp after which the signature expires
    /// @param seller The address of the seller
    /// @param signature The EIP-712 signature from the seller
    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external;

    /// @notice Purchase multiple NFT listings in a single transaction
    /// @dev Verifies multiple EIP-712 signatures and batches transfers
    /// @param nftContracts Array of NFT contract addresses
    /// @param tokenIds Array of token IDs to purchase
    /// @param amounts Array of quantities to purchase
    /// @param prices Array of prices per token
    /// @param deadlines Array of signature expiration timestamps
    /// @param sellers Array of seller addresses
    /// @param signatures Array of EIP-712 signatures
    function buyMultipleNFTs(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata prices,
        uint256[] calldata deadlines,
        address[] calldata sellers,
        bytes[] calldata signatures
    ) external;

    /// @notice Cancel a listing by incrementing the nonce
    /// @dev Only the token owner can delist their tokens
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token to delist
    function delistToken(address nftContract, uint256 tokenId) external;

    /// @notice Set the marketplace fee
    /// @dev Only callable by admin. Fee is in per mille (e.g., 25 = 2.5%)
    /// @param newFeePerMille The new fee in parts per thousand (max 1000)
    function setFeePerMille(uint256 newFeePerMille) external;

    /// @notice Set the marketplace address for fee collection
    /// @dev Only callable by admin
    /// @param newMarketPlace The new marketplace address
    function setMarketPlace(address newMarketPlace) external;

    /// @notice Set the verifier contract address
    /// @dev Only callable by admin
    /// @param _verifier The new verifier contract address
    function setVerifier(address _verifier) external;

    /// @notice Calculate the royalty/fee for a given gross amount
    /// @param gross The gross amount to calculate fee on
    /// @return fee The calculated fee amount
    function calculateRoyalty(uint256 gross) external view returns (uint256 fee);

    /// @notice Get the current nonce for a seller's listing
    /// @param nftContract The NFT contract address
    /// @param tokenId The token ID
    /// @param seller The seller address
    /// @return The current nonce
    function nonces(address nftContract, uint256 tokenId, address seller) external view returns (uint256);

    /// @notice Get the current fee in per mille
    /// @return The fee in parts per thousand
    function feePerMille() external view returns (uint256);

    /// @notice Get the marketplace address for fee collection
    /// @return The marketplace address
    function marketplace() external view returns (address);
}
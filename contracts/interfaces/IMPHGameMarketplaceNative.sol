// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @title IMPHGameMarketplaceNative - Interface for native currency ERC-1155 marketplace
/// @author @SolidityDevNL
/// @notice Defines events, errors, and function signatures for the marketplace
interface IMPHGameMarketplaceNative {
    
    // ============================================
    // ERRORS
    // ============================================

    /// @notice Thrown when NFT is not for sale or price doesn't match
    error NotForSaleOrWrongPrice();

    /// @notice Thrown when collection is not approved to sell on this marketplace
    error CollectionDoesNotSellHere();

    /// @notice Thrown when caller is not the owner of the NFT
    error NotOwner();

    /// @notice Thrown when input parameters are incorrect
    error IncorrectInput();

    /// @notice Thrown when signature deadline has passed
    error SignatureExpired();

    /// @notice Thrown when marketplace is not approved to transfer NFTs
    error NotApprovedForTransfer();

    /// @notice Thrown when insufficient ETH is sent for purchase
    /// @param required The required amount in wei
    /// @param sent The amount sent in wei
    error InsufficientPayment(uint256 required, uint256 sent);

    /// @notice Thrown when ETH transfer fails
    error TransferFailed();

    /// @notice Thrown when zero address is provided
    error ZeroAddress();

    // ============================================
    // EVENTS
    // ============================================

    /// @notice Emitted when an NFT is purchased
    /// @param nftContract Address of the NFT contract
    /// @param tokenId ID of the token purchased
    /// @param buyer Address of the buyer
    /// @param seller Address of the seller
    /// @param amount Number of tokens purchased
    /// @param totalPrice Total price paid in wei
    event NFTBought(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 totalPrice
    );

    /// @notice Emitted when marketplace fee is changed
    /// @param newFee New fee in per mille (parts per thousand)
    event FeeChanged(uint256 indexed newFee);

    /// @notice Emitted when fee receiver address is changed
    /// @param newFeeReceiver New fee receiver address
    event FeeReceiverChanged(address indexed newFeeReceiver);

    /// @notice Emitted when verifier contract is changed
    /// @param newVerifier New verifier contract address
    event VerifierChanged(address indexed newVerifier);

    /// @notice Emitted when a listing is cancelled
    /// @param nftContract Address of the NFT contract
    /// @param tokenId ID of the token delisted
    /// @param seller Address of the seller who delisted
    event ListingCancelled(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller
    );

    // ============================================
    // FUNCTIONS
    // ============================================

    /// @notice Purchase an NFT using native currency (ETH)
    /// @param nftContract Address of the NFT contract
    /// @param tokenId ID of the token to purchase
    /// @param amount Number of tokens to purchase
    /// @param price Price per token in wei
    /// @param deadline Timestamp after which signature expires
    /// @param seller Address of the seller
    /// @param signature EIP-712 signature from seller
    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external payable;

    /// @notice Purchase multiple NFTs in a single transaction
    /// @param nftContracts Array of NFT contract addresses
    /// @param tokenIds Array of token IDs
    /// @param amounts Array of amounts per token
    /// @param prices Array of prices per token
    /// @param deadlines Array of signature deadlines
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
    ) external payable;

    /// @notice Cancel a listing by incrementing nonce
    /// @param nftContract Address of the NFT contract
    /// @param tokenId ID of the token to delist
    function delistToken(address nftContract, uint256 tokenId) external;

    /// @notice Set the marketplace fee
    /// @param newFeePerMille New fee in per mille (max 1000 = 100%)
    function setFeePerMille(uint256 newFeePerMille) external;

    /// @notice Set the fee receiver address
    /// @param newFeeReceiver New address to receive fees
    function setFeeReceiver(address payable newFeeReceiver) external;

    /// @notice Set the verifier contract
    /// @param newVerifier New verifier contract address
    function setVerifier(address newVerifier) external;

    /// @notice Calculate the fee for a given gross amount
    /// @param gross The gross amount in wei
    /// @return fee The fee amount in wei
    function calculateFee(uint256 gross) external view returns (uint256 fee);

    /// @notice Get the current nonce for a seller's listing
    /// @param nftContract Address of the NFT contract
    /// @param tokenId ID of the token
    /// @param seller Address of the seller
    /// @return Current nonce value
    function nonces(address nftContract, uint256 tokenId, address seller) external view returns (uint256);
}
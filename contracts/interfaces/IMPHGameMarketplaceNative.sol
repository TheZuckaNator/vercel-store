// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @title IMPHGameMarketplaceNative
/// @notice Interface for the MPH Game Marketplace using native currency (ETH)
/// @dev ERC-1155 marketplace with off-chain listings using EIP-712 signatures
interface IMPHGameMarketplaceNative {
    // ============================================
    // ERRORS
    // ============================================

    /// @notice Thrown when a zero address is provided where not allowed
    error ZeroAddress();

    /// @notice Thrown when the NFT collection is not approved for trading
    error CollectionDoesNotSellHere();

    /// @notice Thrown when the listing signature has expired
    error SignatureExpired();

    /// @notice Thrown when the item is not for sale or price doesn't match
    error NotForSaleOrWrongPrice();

    /// @notice Thrown when the marketplace is not approved to transfer NFTs
    error NotApprovedForTransfer();

    /// @notice Thrown when the caller is not the owner or signature is invalid
    error NotOwner();

    /// @notice Thrown when incorrect input parameters are provided
    error IncorrectInput();

    /// @notice Thrown when payment amount is insufficient
    /// @param required The required payment amount
    /// @param provided The amount that was provided
    error InsufficientPayment(uint256 required, uint256 provided);

    /// @notice Thrown when an ETH transfer fails
    error TransferFailed();

    // ============================================
    // EVENTS
    // ============================================

    /// @notice Emitted when an NFT is purchased
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token purchased
    /// @param buyer The address of the buyer
    /// @param seller The address of the seller
    /// @param amount The quantity of tokens purchased
    /// @param totalPrice The total price paid (excluding fee)
    event NFTBought(
        address indexed nftContract,
        uint256 indexed tokenId,
        address buyer,
        address seller,
        uint256 amount,
        uint256 totalPrice
    );

    /// @notice Emitted when a listing is cancelled
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token delisted
    /// @param seller The address of the seller who cancelled
    event ListingCancelled(
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller
    );

    /// @notice Emitted when the marketplace fee is changed
    /// @param newFeePerMille The new fee in per mille (parts per thousand)
    event FeeChanged(uint256 newFeePerMille);

    /// @notice Emitted when the fee receiver address is changed
    /// @param newFeeReceiver The new fee receiver address
    event FeeReceiverChanged(address indexed newFeeReceiver);

    /// @notice Emitted when the verifier contract is changed
    /// @param newVerifier The new verifier contract address
    event VerifierChanged(address indexed newVerifier);

    /// @notice Emitted when ETH is rescued from the contract
    /// @param to The address that received the ETH
    /// @param amount The amount of ETH rescued
    event ETHRescued(address indexed to, uint256 amount);

    /// @notice Emitted when ERC20 tokens are rescued from the contract
    /// @param token The token contract address
    /// @param to The address that received the tokens
    /// @param amount The amount of tokens rescued
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);

    /// @notice Emitted when ERC1155 tokens are rescued from the contract
    /// @param token The token contract address
    /// @param to The address that received the tokens
    /// @param tokenId The token ID rescued
    /// @param amount The amount of tokens rescued
    event ERC1155Rescued(address indexed token, address indexed to, uint256 tokenId, uint256 amount);

    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================

    /// @notice Purchase an NFT listing using ETH
    /// @dev Validates signature, transfers NFT and distributes payments
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token to purchase
    /// @param amount The quantity to purchase
    /// @param price The price per token in wei
    /// @param deadline The timestamp when the signature expires
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
    ) external payable;

    /// @notice Purchase multiple NFT listings in a single transaction
    /// @dev All arrays must have the same length (1-15 items)
    /// @param nftContracts Array of NFT contract addresses
    /// @param tokenIds Array of token IDs
    /// @param amounts Array of quantities to purchase
    /// @param prices Array of prices per token in wei
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
    ) external payable;

    /// @notice Cancel a listing by incrementing the nonce
    /// @dev Only callable by the token owner
    /// @param nftContract The address of the NFT contract
    /// @param tokenId The ID of the token to delist
    function delistToken(address nftContract, uint256 tokenId) external;

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /// @notice Set the marketplace fee
    /// @dev Only callable by admin. Fee is in per mille (max 1000 = 100%)
    /// @param newFeePerMille The new fee in per mille
    function setFeePerMille(uint256 newFeePerMille) external;

    /// @notice Set the fee receiver address
    /// @dev Only callable by admin
    /// @param newFeeReceiver The new fee receiver address
    function setFeeReceiver(address payable newFeeReceiver) external;

    /// @notice Set the verifier contract
    /// @dev Only callable by admin
    /// @param newVerifier The new verifier contract address
    function setVerifier(address newVerifier) external;

    /// @notice Rescue ETH stuck in the contract
    /// @dev Only callable by admin
    /// @param to The address to send ETH to
    /// @param amount The amount of ETH to rescue
    function rescueETH(address payable to, uint256 amount) external;

    /// @notice Rescue ERC20 tokens stuck in the contract
    /// @dev Only callable by admin
    /// @param token The ERC20 token contract address
    /// @param to The address to send tokens to
    /// @param amount The amount of tokens to rescue
    function rescueERC20(address token, address to, uint256 amount) external;

    /// @notice Rescue ERC1155 tokens stuck in the contract
    /// @dev Only callable by admin
    /// @param token The ERC1155 token contract address
    /// @param to The address to send tokens to
    /// @param tokenId The token ID to rescue
    /// @param amount The amount of tokens to rescue
    function rescueERC1155(address token, address to, uint256 tokenId, uint256 amount) external;

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /// @notice Get the current nonce for a seller's listing
    /// @param nftContract The NFT contract address
    /// @param tokenId The token ID
    /// @param seller The seller address
    /// @return The current nonce value
    function nonces(address nftContract, uint256 tokenId, address seller) external view returns (uint256);

    /// @notice Calculate the marketplace fee for a given amount
    /// @param gross The gross amount to calculate fee on
    /// @return fee The calculated fee amount
    function calculateFee(uint256 gross) external view returns (uint256 fee);
}

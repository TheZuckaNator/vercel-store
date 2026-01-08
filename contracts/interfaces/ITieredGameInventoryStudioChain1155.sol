// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @title ITieredGameInventoryStudioChain1155 - Interface for the TieredGameInventoryStudioChain1155 contract
/// @author @SolidityDevNL
/// @notice This interface defines the functions and errors for interacting with the TieredGameInventoryStudioChain1155 contract
interface ITieredGameInventoryStudioChain1155 {

    /// @notice Deployment configuration - removed baseURI since we use tier URIs
    /// @dev Simplified struct focusing on contract-level settings
    struct DeploymentConfig {
        uint256 royaltyPercentage;      // Royalty percentage in basis points
        address payable royaltyReceiver; // Address that receives royalties
    }

    /// @notice Static addresses for contract deployment
    /// @dev Separate struct for address parameters
    struct DeploymentAddresses {
        address admin;                  // Admin address for the contract
        address operator;        // Separate address for ZUCKANATOR_ROLE
        address payable pool;           // Pool address for payments
        address verifierAddress;        // Verifier contract address
        address assetTrackingAddress;   // Asset tracking contract address
    }

    /// @notice Structure containing complete information for a token tier
    /// @dev This struct holds all the necessary data for managing individual token tiers
   struct TokenInfo {
        uint256[] tokenIds;
        uint256[] maxSupplies;        // Max supply per token ID
        uint256[] currentSupplies;    // Current supply per token ID
        uint256[] prices;             // Price per token ID
        uint256[] maxAmountsPerUser;  // Max amount per user per token ID
        string tierURI;
    }

    /// @notice Structure for creating/updating token tiers
    /// @dev This struct is used for adding new tiers or updating existing ones
    struct NewTokenInfo {
        uint256[] maxSupplies;        // Max supply per token ID (array length determines tokenIdCount)
        uint256[] prices;             // Price per token ID
        uint256[] maxAmountsPerUser;  // Max amount per user per token ID
        string tierURI;
    }

    /// @notice Deployment configuration for each token tier
    /// @dev Packed struct to optimize gas usage
    struct DeploymentTier {
        string name;                // Token tier name/identifier
        string tierURI;            // Tier-specific URI (primary metadata source)
        uint128[] initialSupplies; // Initial supply per token ID in this tier
        uint128[] maxAmountsPerUser; // Max amount per user per token ID in this tier
        uint256[] prices;          // Price in wei per token ID in this tier
    }
    
    /// @dev Custom errors for the contract


    /// @notice trown when a user tries to buy multiple of the same token
    /// @param tokenId the Id they tried to buy multiple of
    error TieredGameInventory__DuplicateTokenId(uint256 tokenId);

    /// @notice Thrown when attempting to replace the MPH tracking with a zeroAddress
    error ZeroAddress();
    
    /// @notice Thrown when attempting to mint more tokens than the maximum supply allows
    /// @param name The name of the token tier that has reached its maximum supply
    error TieredGameInventory__MaxSupplyReached(string name);
    
    /// @notice Thrown when attempting to purchase tokens while minting is closed
    error TieredGameInventory__SaleStateClosed();
    
    /// @notice Thrown when a user attempts to purchase more than the maximum allowed amount
    /// @param amount The maximum amount of tokens allowed per user
    error TieredGameInventory__MaxPurchaseExceeded(uint amount);
    
    /// @notice Thrown when trying to initialize the contract with empty initial supplies array
    error TieredGameInventory__EmptyInitialSupplies();
    
    /// @notice Thrown when insufficient payment is sent for token purchase
    /// @param required The required payment amount in wei
    /// @param sent The actual payment amount sent in wei
    error TieredGameInventory__InsufficientPayment(uint256 required, uint256 sent);
    
    /// @notice Thrown when KARRAT withdrawal from the contract fails
    error TieredGameInventory__WithdrawalFailed();
    
    /// @notice Thrown when an invalid royalty percentage is provided (must be <= 10000 basis points)
    error InvalidPercent();
    
    /// @notice Thrown when arrays provided as parameters have mismatched lengths
    error TieredGameInventory__TierArrayLengthMismatch();

    /// @notice Thrown when arrays are longer than 10 in buyMultipleNFTs to avoid an unbound loop
    error Ten_Token_Types_Only();
 
    /// @notice Thrown when attempting to reduce token supply below current minted amount
    /// @param name The name of the token tier being updated
    /// @param newSupply The attempted new supply amount
    /// @param currentSupply The current minted supply that cannot be exceeded
    error TieredGameInventory__InvalidSupplyReduction(string name, uint newSupply, uint currentSupply);
    
    /// @notice Thrown when attempting to perform operations on a non-existent token tier
    /// @param name of the token tier that does not exist
    error TieredGameInventory__TokenDoesNotExist(string name);

    /// @notice Thrown when invalid token ID count is provided
    error TieredGameInventory__InvalidTokenIdCount();

    /// @notice Thrown when invalid token ID is provided for a tier
    error TieredGameInventory__InvalidTokenId();

    /// @notice Events

    /// @notice Emitted when minting is opened or closed.
    /// @param mintingClosed The new state of minting (true if closed).
    event SaleStateChanged(bool mintingClosed);

    /// @notice Emitted when the verifier contract for the marketplace is changed
    /// @param _verifierAddress The address of the new verifier contract
    event VerifierChanged(address indexed _verifierAddress);

    /// @notice Emitted when the address for payments pool for distribution is changed
    /// @param _pool New pool.
    event PoolChanged(address indexed _pool);
   
    /// @notice Emitted when the royalty percentage is changed
    /// @param _percent The new royalty percentage in basis points
    event NewRoyalty(uint256 indexed _percent);

    /// @notice event emitted when tracking contract is set
    /// @param _trackingContract new exchange contract
    event MPHAssetTrackingUpdated(address _trackingContract);

    /// @notice Event emitted when tokens or ETH are withdrawn from the contract
    /// @param tokenAddress Address of withdrawn token (address(0) for ETH)
    /// @param to Address receiving the tokens/ETH
    /// @param amount Amount withdrawn
    event TokensWithdrawn(address indexed tokenAddress, address indexed to, uint256 amount);

    /// @notice Emitted when the supply for a tier is changed 
    /// @param name The name of the tier that has changed
    /// @param newSupply The new supply
    event SupplyChangedForId(string indexed name, uint256 indexed newSupply);

    /// @notice Emitted when the amount of tokens a user can purchase is changed
    /// @param name The name of the tier that the max amount a user can purchase changed
    /// @param _maxAmountPerUser The new max amount a user can purchase
    event MaxPurchaseChangedForTier(string name, uint256 _maxAmountPerUser);

    /// @notice NFTBought info on the game item.
    /// @param supplyContract origin contract of NFT
    /// @param owner new owner of NFT
    /// @param tokenId of NFT
    /// @param tierName name of the tier
    event NFTBought(address indexed supplyContract, address indexed owner, uint indexed tokenId, string tierName);

    /// @notice emitted to signal change in price
    /// @param newPrice the new price per token
    /// @param name of the tier that changed price
    event PriceChanged(string indexed name, uint indexed newPrice);

    /// @notice Event emitted when KARRAT is withdrawn from the contract
    /// @param to Address receiving the KARRAT
    /// @param amount Amount of KARRAT withdrawn
    event KARRATWithdrawn(address indexed to, uint256 amount);

    /// @notice Event emitted when royalty receiver is updated
    /// @param oldReceiver Previous royalty receiver address
    /// @param newReceiver New royalty receiver address
    event RoyaltyReceiverChanged(address indexed oldReceiver, address indexed newReceiver);

    /// @notice Event emitted when a new tier is added to the contract
    /// @param tierName name of the tier
    /// @param tokenIds array of token IDs created for this tier
    event NewTierAdded(string indexed tierName, uint256[] tokenIds);

    /// @notice Event emitted when an existing tier is updated
    /// @param tierName name of the tier
    /// @param tokenIds array of token IDs for this tier
    event TierUpdated(string indexed tierName, uint256[] tokenIds);

    /// @notice Event emitted when a tier URI is updated
    /// @param tierName name of the tier
    /// @param newTierURI new URI for the tier
    event TierURIChanged(string indexed tierName, string newTierURI);

    /// @notice Core Functions

    /// @notice Indicates whether minting is closed
    function closeMinting() external view returns (bool);

    /// @notice Allows a user to buy a specified amount from specific token IDs using KARRAT.
    /// @param tierName The tier name to purchase from
    /// @param tokenIds Array of specific token IDs to buy from (must belong to the tier)
    /// @param amounts Array of amounts for each token ID
    /// @dev Requires that minting is open, supply is available, and sufficient KARRAT is sent.
    function buyNFT(string memory tierName, uint256[] memory tokenIds, uint256[] memory amounts) external payable;

    /// @notice Allows a user to buy from multiple tiers with specific token IDs in a single transaction using KARRAT
    /// @param tierNames Array of tier names to purchase from
    /// @param tokenIds Array of token ID arrays for each tier
    /// @param amounts Array of amount arrays for each tier
    /// @dev Arrays must be the same length. Requires that minting is open, supply is available for all tiers, and sufficient KARRAT is sent.
    function buyMultiple(
        string[] memory tierNames, 
        uint256[][] memory tokenIds, 
        uint256[][] memory amounts
    ) external payable;

    /// @notice Admin Functions

    /// @notice Sets the minting state (open or closed)
    /// @param state The new state of minting (true to close minting)
    function setSaleState(bool state) external;

    /// @notice Updates the verifier address.
    /// @param _verifierAddress The new address of the verifier contract.
    function setVerifier(address _verifierAddress) external;

    /// @notice Sets the maximum supply for a specific token ID
    /// @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
    /// @param tokenId The token ID to update
    /// @param _newMaxSupply The new maximum supply for this token ID
    function setMaxSupplyForTokenId(uint256 tokenId, uint256 _newMaxSupply) external;

    /// @notice Sets the price for a specific token ID
    /// @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
    /// @param tokenId The token ID to update
    /// @param _newPrice The new price for this token ID in wei
    function setPriceForTokenId(uint256 tokenId, uint256 _newPrice) external;

    /// @notice Sets the maximum amount per user for a specific token ID
    /// @dev Only callable by addresses with ZUCKANATOR_ROLE
    /// @param tokenId The token ID to update
    /// @param _maxAmountPerUser The new maximum amount per user for this token ID
    function setMaxAmountPerUserForTokenId(uint256 tokenId, uint256 _maxAmountPerUser) external;

    /// @notice Sets the address for payments pool for distribution
    /// @param _pool New pool
    function setPool(address payable _pool) external;

    /// @notice Sets the address that receives royalties
    /// @param _royaltyReceiver New royalty receiver address
    function setRoyaltyReceiver(address payable _royaltyReceiver) external;

    /// @notice Sets the royalty percentage
    /// @param _percent The new royalty percentage in basis points
    function setRoyalty(uint256 _percent) external;

    /// @notice Updates the initial supplies for existing tiers.
    /// @param names Array of tier names to update supplies for.
    /// @param newSupplies Array of new supplies corresponding to each tier.
    function setInitialSupplies(string[] memory names, uint256[] memory newSupplies) external;

    /// @notice Sets a custom URI for a specific token ID
    /// @param tokenId The ID of the token to set the URI for
    /// @param tokenURI The new URI for the token metadata
    function setTokenURI(uint256 tokenId, string memory tokenURI) external;

    /// @notice Sets a tier URI for a specific tier
    /// @param tierName The name of the tier to set the URI for
    /// @param tierURI The new URI for the tier metadata
    function setTierURI(string memory tierName, string memory tierURI) external;

    /// @notice Tier Management Functions

    /// @notice Adds a new tier with specified configuration
    /// @param name The name of the new tier
    /// @param newTier New tier information
    /// @return tokenIds Array of newly created token IDs for this tier
    function addNewTier(
        string memory name,
        NewTokenInfo memory newTier
    ) external returns (uint256[] memory tokenIds);

    /// @notice Adds multiple new tiers at once
    /// @param names Array of tier names
    /// @param newTiers Array of tier configurations
    /// @return allTokenIds Array of all newly created token IDs
    function addNewTiers(
        string[] memory names,
        NewTokenInfo[] memory newTiers
    ) external returns (uint256[] memory allTokenIds);

    /// @notice Updates an existing tier's information
    /// @param tierName The name of the tier to update
    /// @param updatedTier New tier information
    function updateTier(
        string memory tierName,
        NewTokenInfo memory updatedTier
    ) external;

    /// @notice Withdraws ETH or ERC20 tokens to pool
    /// @param tokenAddress Token address, or address(0) for ETH
    function withdraw(address tokenAddress) external;

    /// @notice View Functions

    /// @notice Returns the URI for a specific token ID based on tier hierarchy
    /// @dev URI resolution: 1) Individual token URI if set, 2) tierURI + tier-relative index (1-based), 3) empty string
    /// @dev Example: If tier has tokenIds [157,158,159], tokenId 158 returns "tierURI2" (index 1 + 1)
    /// @param tokenId The ID of the token
    /// @return The URI of the token metadata
    function uri(uint256 tokenId) external view returns (string memory);

    /// @notice Returns the total supply of a specific token.
    /// @param tokenId the tokenId we are checking.
    /// @return The total supply of the tier.
    function totalSupply(uint256 tokenId) external view returns (uint256);

    /// @notice Returns the maximum supply for a given token ID
    /// @param tokenId The token ID to query
    /// @return The maximum supply of the token ID
    function getMaxSupply(uint256 tokenId) external view returns (uint256);

    /// @notice Gets complete tier information for a tier by name
    /// @dev Queries a tier by its name and returns its properties
    /// @param tierName The tier name to query
    /// @return tokenInfo a struct containing the tier information
    function getTokenInfo(string calldata tierName) 
        external 
        view 
        returns (TokenInfo memory tokenInfo); 

    
    /// @notice Gets the maximum amount per user for a specific token ID
    /// @param tokenId The token ID to query
    /// @return The maximum amount this token ID allows per user
    function getMaxAmountPerUserForTokenId(uint256 tokenId) external view returns (uint256);

    /// @notice Returns address that should be receiving payment
    function getPayee() external view returns (address);
    
    /// @notice Returns address that should be receiving royalties
    function getRoyaltyReceiver() external view returns (address);
    
    /// @notice Returns the current royalty percentage in basis points
    function getRoyaltyPercentage() external view returns (uint256);

}
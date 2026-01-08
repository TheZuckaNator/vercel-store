// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITieredGameInventoryStudioChain1155.sol";

// Verifier interface
interface IVerifier {
    function isItApproved(address _address) external view returns (bool);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}


interface IMPHAssetTracking {
    function emitMint(
        address to, 
        uint256 id, 
        uint256 amount, 
        string calldata tokenURI
    ) external;

    /// @notice Emit transfer event with comprehensive transfer data
    /// @dev Only callable by contracts with TRACKED_CONTRACT_ROLE
    /// @param from Address transferring the tokens (zero address for minting)
    /// @param to Address receiving the tokens (zero address for burning)
    /// @param ids Array of token IDs being transferred
    /// @param amounts Array of amounts for each token ID
    function emitTransfer(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external;
    
    /// @notice Emit burn event with comprehensive burn data
    /// @dev Only callable by contracts with TRACKED_CONTRACT_ROLE
    /// @param from Address burning the tokens
    /// @param id The token ID being burned
    /// @param amount The amount of tokens
    /// @param tokenURI The token URI
    function emitBurn(
        address from, 
        uint256 id, 
        uint256 amount, 
        string calldata tokenURI
    ) external; 
}

/// @title TieredGameInventoryStudioChain1155 - A smart contract for managing in-game assets as ERC1155 tokens with tiered metadata.
/// @author @SolidityDevNL
/// @notice This contract allows minting, buying, and managing in-game items with KARRAT payments and tiered metadata with multiple token IDs per tier.
/// @dev Utilizes OpenZeppelin's ERC1155 and AccessControl for token management and role-based access control. No longer uses baseURI - relies on tier URIs.
contract TieredGameInventoryStudioChain1155 is ITieredGameInventoryStudioChain1155, ERC1155, AccessControl, IERC2981 {

    /// @dev Address of verifier contract.
    IVerifier public verifierContract;

    /// @dev Role identifier for zuckanator permissions.
    bytes32 public constant ZUCKANATOR_ROLE = keccak256("ZUCKANATOR_ROLE");

    /// @dev Address where payment for tokens is sent.
    address payable private pool;

    /// @dev Address where royalties are sent.
    address payable private royaltyReceiver;

    /// @dev percent of token the royalties hold
    uint private percent;

    /// @dev Mapping from user address to tokenId to amount purchased
    mapping(address => mapping(uint256 => uint256)) private _userPurchases;
    
    /// @notice Indicates whether minting is closed.
    bool public override closeMinting;

    /// @dev Counter to track the next available token ID
    uint256 private _nextTokenId = 1;

    /// @dev Mapping from token ID to its individual URI
    mapping(uint256 => string) private _tokenURIs;

    /// @dev Mapping from tier name to token information
    mapping(string => TokenInfo) private _tokens;

    /// @dev Mapping from token ID to tier name (for reverse lookup)
    mapping(uint256 => string) private _tokenIdToTierName;

    /// @dev Name of the token.
    string public name;

    /// @dev Symbol of the token.
    string public symbol;

    /**
     * @dev Address of the exchange contract
     */
    IMPHAssetTracking private assetTracking;

    /// @notice Initializes the contract with deployment configuration structs
    /// @param config Contract-level configuration (royalty percentage only)
    /// @param addresses Static addresses (admin, pool, verifier)
    /// @param deploymentTiers Array of deployment tier configurations
    constructor(
        DeploymentConfig memory config,
        DeploymentAddresses memory addresses,
        DeploymentTier[] memory deploymentTiers
    ) ERC1155("") { // Empty string since we don't use baseURI
        if (deploymentTiers.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }

        if (addresses.pool == address(0) ||
        addresses.verifierAddress == address(0) ||
        addresses.admin == address(0) ||
        addresses.operator == address(0) ||
        addresses.assetTrackingAddress == address(0)) {
            revert ZeroAddress();
        }
        
        // Set contract configuration
        percent = config.royaltyPercentage;
        
        // Set addresses
        pool = addresses.pool;
        royaltyReceiver = addresses.pool;        
        verifierContract = IVerifier(addresses.verifierAddress);
        assetTracking = IMPHAssetTracking(addresses.assetTrackingAddress);
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, addresses.admin);
        _grantRole(ZUCKANATOR_ROLE, addresses.operator);

        name = "My Pet Hooligan Game Items";
        symbol = "MPHGI";
        
        // Initialize tokens
        _initializeTokens(deploymentTiers);
    }

    /// @notice Adds a new tier with specified configuration
    /// @param name The name of the new tier
    /// @param newTier New tier information
    /// @return tokenIds Array of newly created token IDs for this tier
    function addNewTier(
    string memory name,
    NewTokenInfo memory newTier
    ) external onlyRole(ZUCKANATOR_ROLE) returns (uint256[] memory tokenIds) {
        uint256 tokenIdCount = newTier.maxSupplies.length;
        
        if (tokenIdCount == 0) {
            revert TieredGameInventory__InvalidTokenIdCount();
        }
        
        if (tokenIdCount != newTier.prices.length || 
            tokenIdCount != newTier.maxAmountsPerUser.length) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }

        if (_tokens[name].tokenIds.length > 0) {
            revert TieredGameInventory__TokenDoesNotExist(string(abi.encodePacked("Tier already exists: ", name)));
        }

        tokenIds = new uint256[](tokenIdCount);
        uint256[] memory currentSupplies = new uint256[](tokenIdCount);
        
        for (uint256 i = 0; i < tokenIdCount; i++) {
            tokenIds[i] = _nextTokenId;
            _tokenIdToTierName[_nextTokenId] = name;
            currentSupplies[i] = 0;
            _nextTokenId++;
        }

        _tokens[name] = TokenInfo({
            tokenIds: tokenIds,
            maxSupplies: newTier.maxSupplies,
            currentSupplies: currentSupplies,
            prices: newTier.prices,
            maxAmountsPerUser: newTier.maxAmountsPerUser,
            tierURI: newTier.tierURI
        });
        
        emit NewTierAdded(name, tokenIds);
        return tokenIds;
    }

    /// @notice Adds multiple new tiers at once
    /// @param names Array of tier names
    /// @param newTiers Array of tier configurations
    /// @return allTokenIds Array of all newly created token IDs
    function addNewTiers(
        string[] memory names,
        NewTokenInfo[] memory newTiers
    ) external onlyRole(ZUCKANATOR_ROLE) returns (uint256[] memory allTokenIds) {
        if (names.length != newTiers.length) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }
        
        if (names.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }

        // Calculate total token IDs needed
        uint256 totalTokenIds = 0;
        for (uint256 i = 0; i < newTiers.length; i++) {
            uint256 tokenIdCount = newTiers[i].maxSupplies.length;
            
            if (tokenIdCount == 0) {
                revert TieredGameInventory__InvalidTokenIdCount();
            }
            
            if (tokenIdCount != newTiers[i].prices.length || 
                tokenIdCount != newTiers[i].maxAmountsPerUser.length) {
                revert TieredGameInventory__TierArrayLengthMismatch();
            }
            
            totalTokenIds += tokenIdCount;
        }

        allTokenIds = new uint256[](totalTokenIds);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < names.length; i++) {
            if (_tokens[names[i]].tokenIds.length > 0) {
                revert TieredGameInventory__TokenDoesNotExist(string(abi.encodePacked("Tier already exists: ", names[i])));
            }

            uint256 tokenIdCount = newTiers[i].maxSupplies.length;
            uint256[] memory tierTokenIds = new uint256[](tokenIdCount);
            uint256[] memory currentSupplies = new uint256[](tokenIdCount);
            
            // Create token IDs for this tier using _nextTokenId
            for (uint256 j = 0; j < tokenIdCount; j++) {
                tierTokenIds[j] = _nextTokenId;
                allTokenIds[currentIndex] = _nextTokenId;
                _tokenIdToTierName[_nextTokenId] = names[i];
                currentSupplies[j] = 0;
                _nextTokenId++;
                currentIndex++;
            }

            _tokens[names[i]] = TokenInfo({
                tokenIds: tierTokenIds,
                maxSupplies: newTiers[i].maxSupplies,
                currentSupplies: currentSupplies,
                prices: newTiers[i].prices,
                maxAmountsPerUser: newTiers[i].maxAmountsPerUser,
                tierURI: newTiers[i].tierURI
            });
            
            emit NewTierAdded(names[i], tierTokenIds);
        }
        
        return allTokenIds;
    }

    
    /// @notice Updates an existing tier's information
    /// @param tierName The name of the tier to update
    /// @param updatedTier New tier information
    function updateTier(
        string memory tierName,
        NewTokenInfo memory updatedTier
    ) external onlyRole(ZUCKANATOR_ROLE) {
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        if (tokenInfo.tokenIds.length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(tierName);
        }
        
        uint256 tokenIdCount = tokenInfo.tokenIds.length;
        
        if (updatedTier.maxSupplies.length != tokenIdCount ||
            updatedTier.prices.length != tokenIdCount ||
            updatedTier.maxAmountsPerUser.length != tokenIdCount) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }
        
        // Check that no maxSupply is being reduced below current supply
        for (uint256 i = 0; i < tokenIdCount; i++) {
            if (updatedTier.maxSupplies[i] < tokenInfo.currentSupplies[i]) {
                revert TieredGameInventory__InvalidSupplyReduction(
                    tierName, 
                    updatedTier.maxSupplies[i], 
                    tokenInfo.currentSupplies[i]
                );
            }
        }
        
        tokenInfo.maxSupplies = updatedTier.maxSupplies;
        tokenInfo.prices = updatedTier.prices;
        tokenInfo.maxAmountsPerUser = updatedTier.maxAmountsPerUser;
        tokenInfo.tierURI = updatedTier.tierURI;
        
        emit TierUpdated(tierName, tokenInfo.tokenIds);
    }

    /// @notice Sets the minting state (open or closed).
    /// @param state The new state of minting (true to close minting).
    function setSaleState(bool state) external override onlyRole(ZUCKANATOR_ROLE) {
        closeMinting = state;
        emit SaleStateChanged(state);
    }

    /// @notice Sets a tier URI for a specific tier
    /// @param tierName The name of the tier to set the URI for
    /// @param tierURI The new URI for the tier metadata
    function setTierURI(string memory tierName, string memory tierURI) external onlyRole(ZUCKANATOR_ROLE) {
        if (_tokens[tierName].tokenIds.length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(tierName);
        }
        
        _tokens[tierName].tierURI = tierURI;
        emit TierURIChanged(tierName, tierURI);
    }

    /// @notice Updates the initial supplies for existing tiers.
    /// @param names Array of tier names to update supplies for.
    /// @param newSupplies Array of new supplies corresponding to each tier.
    function setInitialSupplies(string[] memory names, uint256[] memory newSupplies) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (names.length != newSupplies.length) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }
        
        if (names.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }
        
        for (uint256 i = 0; i < names.length; i++) {
            uint256 newSupply = newSupplies[i];
            string memory tierName = names[i];

            if (_tokens[tierName].tokenIds.length == 0) {
                revert TieredGameInventory__TokenDoesNotExist(tierName);
            }

            TokenInfo storage tokenInfo = _tokens[tierName];
            
            // Calculate total current supply across all token IDs in this tier
            uint256 totalCurrentSupply = 0;
            for (uint256 j = 0; j < tokenInfo.currentSupplies.length; j++) {
                totalCurrentSupply += tokenInfo.currentSupplies[j];
            }
            
            // Ensure new supply is not less than current supply
            if (newSupply < totalCurrentSupply) {
                revert TieredGameInventory__InvalidSupplyReduction(tierName, newSupply, totalCurrentSupply);
            }
            
            // Update all maxSupplies proportionally or set them all to the same value
            // For simplicity, we'll distribute evenly across all token IDs
            uint256 perTokenSupply = newSupply / tokenInfo.tokenIds.length;
            for (uint256 j = 0; j < tokenInfo.maxSupplies.length; j++) {
                tokenInfo.maxSupplies[j] = perTokenSupply;
            }
            
            emit SupplyChangedForId(tierName, newSupply);
        }
    }

    /**
     * @dev Set the exchange ccontract address passed to the medals contract
     * @param _trackingContract new exchange contract
     */
    function setMPHAssetTracking(address _trackingContract) external  onlyRole(ZUCKANATOR_ROLE) {
        if (_trackingContract == address(0)) revert ZeroAddress(); // Reusing existing error
        
        assetTracking = IMPHAssetTracking(_trackingContract);
        
        emit MPHAssetTrackingUpdated(_trackingContract);
    }

    /// @notice Updates the verifier address.
    /// @param _verifierAddress The new address of the verifierContract.
    function setVerifier(address _verifierAddress) public override onlyRole(ZUCKANATOR_ROLE) {
        if (_verifierAddress == address(0)) revert ZeroAddress();

        verifierContract = IVerifier(_verifierAddress);
        emit VerifierChanged(_verifierAddress);
    }

    /// @notice Sets the maximum supply for a specific token ID
    /// @param tokenId The token ID to update
    /// @param _newMaxSupply The new maximum supply for this token ID
    function setMaxSupplyForTokenId(uint256 tokenId, uint256 _newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                if (_newMaxSupply < tokenInfo.currentSupplies[i]) {
                    revert TieredGameInventory__InvalidSupplyReduction(tierName, _newMaxSupply, tokenInfo.currentSupplies[i]);
                }
                tokenInfo.maxSupplies[i] = _newMaxSupply;
                emit SupplyChangedForId(tierName, _newMaxSupply);
                return;
            }
        }
        
        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Sets the price for a specific token ID
    /// @param tokenId The token ID to update
    /// @param _newPrice The new price for this token ID in wei
    function setPriceForTokenId(uint256 tokenId, uint256 _newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                tokenInfo.prices[i] = _newPrice;
                emit PriceChanged(tierName, _newPrice);
                return;
            }
        }
        
        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Sets the max amount per user for a specific token ID
    /// @param tokenId The token ID to update
    /// @param _maxAmountPerUser The new max amount per user for this token ID
    function setMaxAmountPerUserForTokenId(uint256 tokenId, uint256 _maxAmountPerUser) external onlyRole(ZUCKANATOR_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                tokenInfo.maxAmountsPerUser[i] = _maxAmountPerUser;
                emit MaxPurchaseChangedForTier(tierName, _maxAmountPerUser);
                return;
            }
        }
        
        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Sets the maximum supply for a specific tier (legacy - sets all token IDs in tier to same value)

    /// @notice Sets the address for payments pool for distribution.
    /// @param _pool New pool.
    function setPool(address payable _pool) external override onlyRole(ZUCKANATOR_ROLE) {
        if (_pool == address(0)) revert ZeroAddress();
        pool = _pool;
        emit PoolChanged(_pool);
    }
    
    /// @notice Sets the address that receives royalties
    /// @param _royaltyReceiver New royalty receiver address
    function setRoyaltyReceiver(address payable _royaltyReceiver) external override onlyRole(ZUCKANATOR_ROLE) {
        if (_royaltyReceiver == address(0)) revert ZeroAddress();
        address oldReceiver = royaltyReceiver;
        royaltyReceiver = _royaltyReceiver;
        emit RoyaltyReceiverChanged(oldReceiver, _royaltyReceiver);
    }

    /// @notice Sets the royalty percentage
    /// @param _percent The new royalty percentage in basis points
    function setRoyalty(uint256 _percent) external override onlyRole(ZUCKANATOR_ROLE) {
        if(_percent > 10000) revert InvalidPercent();
        percent = _percent;
        emit NewRoyalty(_percent);
    }

    /// @notice Sets a custom URI for a specific token ID
    /// @param tokenId The ID of the token to set the URI for
    /// @param tokenURI The new URI for the token metadata
    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyRole(ZUCKANATOR_ROLE) {
        // Check if token exists by verifying if it has a tier name
        if (bytes(_tokenIdToTierName[tokenId]).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        _tokenURIs[tokenId] = tokenURI;
        emit URI(tokenURI, tokenId);
    }

    /// @notice Withdraws ETH or ERC20 tokens to pool
    /// @param tokenAddress Token address, or address(0) for ETH
    function withdraw(address tokenAddress) external onlyRole(ZUCKANATOR_ROLE) {
        if (tokenAddress == address(0)) {
            // Withdraw ETH
            uint256 balance = address(this).balance;
            if (balance == 0) revert TieredGameInventory__WithdrawalFailed();
            
            (bool success, ) = pool.call{value: balance}("");
            if (!success) revert TieredGameInventory__WithdrawalFailed();
            
            emit TokensWithdrawn(address(0), pool, balance);
        } else {
            // Withdraw ERC20
            IERC20 token = IERC20(tokenAddress);
            uint256 balance = token.balanceOf(address(this));
            if (balance == 0) revert TieredGameInventory__WithdrawalFailed();
            
            bool success = token.transfer(pool, balance);
            if (!success) revert TieredGameInventory__WithdrawalFailed();
            
            emit TokensWithdrawn(tokenAddress, pool, balance);
        }
    }


    /// @notice Allows a user to buy a specified amount from specific token IDs using KARRAT.
    /// @param tierName The tier name to purchase from
    /// @param tokenIds Array of specific token IDs to buy from (must belong to the tier)
    /// @param amounts Array of amounts for each token ID
    /// @dev Requires that minting is open, supply is available, and sufficient KARRAT is sent.
    function buyNFT(
        string memory tierName, 
        uint256[] memory tokenIds, 
        uint256[] memory amounts
    ) external override payable {
        if (closeMinting) {
            revert TieredGameInventory__SaleStateClosed();
        }

        if (tokenIds.length != amounts.length) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }

        if (tokenIds.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }

      for (uint256 i = 0; i < tokenIds.length; i++) {
        for (uint256 j = i + 1; j < tokenIds.length; j++) {
            if (tokenIds[i] == tokenIds[j]) {
                revert TieredGameInventory__DuplicateTokenId(tokenIds[i]);
            }
        }
    }

        TokenInfo storage tokenInfo = _tokens[tierName];
        if (tokenInfo.tokenIds.length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(tierName);
        }

        // Validate token IDs belong to tier and calculate total price
        uint256 totalPrice = 0;
        uint256[] memory tokenIndices = new uint256[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (keccak256(bytes(_tokenIdToTierName[tokenIds[i]])) != keccak256(bytes(tierName))) {
                revert TieredGameInventory__InvalidTokenId();
            }
            
            // Find the index of this token ID within the tier
            uint256 tokenIndex = type(uint256).max;
            for (uint256 j = 0; j < tokenInfo.tokenIds.length; j++) {
                if (tokenInfo.tokenIds[j] == tokenIds[i]) {
                    tokenIndex = j;
                    break;
                }
            }
            
            if (tokenIndex == type(uint256).max) {
                revert TieredGameInventory__InvalidTokenId();
            }
            
            tokenIndices[i] = tokenIndex;

           // Check if user can buy the amount (skip if caller has ZUCKANATOR_ROLE)
            if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
                if (_userPurchases[msg.sender][tokenIds[i]] + amounts[i] > tokenInfo.maxAmountsPerUser[tokenIndex]) {
                    revert TieredGameInventory__MaxPurchaseExceeded(tokenInfo.maxAmountsPerUser[tokenIndex]);
                }
            }

            // Add to total price
            totalPrice += tokenInfo.prices[tokenIndex] * amounts[i];
        }

        // Skip payment if caller has ZUCKANATOR_ROLE
        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
            if (msg.value < totalPrice) {
                revert TieredGameInventory__InsufficientPayment(totalPrice, msg.value);
            }

            (bool success, ) = pool.call{value: totalPrice}("");
            require(success, "ETH transfer failed");

            if (msg.value > totalPrice) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalPrice}("");
                require(refundSuccess, "ETH refund failed");
            }
        }

        // Mint specific token IDs with specified amounts
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (amounts[i] > 0) {
                uint256 tokenIndex = tokenIndices[i];
                _userPurchases[msg.sender][tokenIds[i]] += amounts[i];
                tokenInfo.currentSupplies[tokenIndex] += amounts[i];
                
                _mint(msg.sender, tokenIds[i], amounts[i], "");
                assetTracking.emitMint(msg.sender, tokenIds[i], amounts[i], uri(tokenIds[i]));
                emit NFTBought(address(this), msg.sender, tokenIds[i], tierName);
            }
        }
    }

    /// @notice Allows a user to buy from multiple tiers with specific token IDs in a single transaction using KARRAT
    /// @param tierNames Array of tier names to purchase from
    /// @param tokenIds Array of token ID arrays for each tier
    /// @param amounts Array of amount arrays for each tier
    /// @dev Arrays must be the same length. Requires that minting is open, supply is available for all tiers, and sufficient KARRAT is sent.
        /// @notice Allows a user to buy from multiple tiers with specific token IDs in a single transaction using KARRAT
    /// @param tierNames Array of tier names to purchase from
    /// @param tokenIds Array of token ID arrays for each tier
    /// @param amounts Array of amount arrays for each tier
    /// @dev Arrays must be the same length. Requires that minting is open, supply is available for all tiers, and sufficient KARRAT is sent.
    function buyMultiple(
        string[] memory tierNames,
        uint256[][] memory tokenIds,
        uint256[][] memory amounts
    ) external payable {
        if (closeMinting) {
            revert TieredGameInventory__SaleStateClosed();
        }
        
        if (tierNames.length != tokenIds.length || tokenIds.length != amounts.length) {
            revert TieredGameInventory__TierArrayLengthMismatch();
        }

        if (tierNames.length > 10) {
            revert Ten_Token_Types_Only();
        }
        
        if (tierNames.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }

        for (uint256 i = 0; i < tierNames.length; i++) {
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                // Check against all subsequent entries
                for (uint256 k = i; k < tierNames.length; k++) {
                    uint256 startL = (k == i) ? j + 1 : 0;
                    for (uint256 l = startL; l < tokenIds[k].length; l++) {
                        if (tokenIds[i][j] == tokenIds[k][l]) {
                            revert TieredGameInventory__DuplicateTokenId(tokenIds[i][j]);
                        }
                    }
                }
            }
        }
        
        uint256 totalCost = 0;
        
        // First pass: validate all purchases and calculate total cost
        for (uint256 i = 0; i < tierNames.length; i++) {
            TokenInfo storage tokenInfo = _tokens[tierNames[i]];
            if (tokenInfo.tokenIds.length == 0) {
                revert TieredGameInventory__TokenDoesNotExist(tierNames[i]);
            }

            if (tokenIds[i].length != amounts[i].length) {
                revert TieredGameInventory__TierArrayLengthMismatch();
            }

            // Validate token IDs and calculate total amount for this tier
            uint256 tierTotalAmount = 0;
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                // Verify token ID belongs to this tier
                if (keccak256(bytes(_tokenIdToTierName[tokenIds[i][j]])) != keccak256(bytes(tierNames[i]))) {
                    revert TieredGameInventory__InvalidTokenId();
                }
                tierTotalAmount += amounts[i][j];
            }

            // Check supply and calculate price for each token ID
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                // Find the token index to get its price and check supply
                for (uint256 k = 0; k < tokenInfo.tokenIds.length; k++) {
                    if (tokenInfo.tokenIds[k] == tokenIds[i][j]) {
                        // Check individual token supply
                        if (tokenInfo.currentSupplies[k] + amounts[i][j] > tokenInfo.maxSupplies[k]) {
                            revert TieredGameInventory__MaxSupplyReached(tierNames[i]);
                        }

                        // Check per-token user limit (skip if caller has ZUCKANATOR_ROLE)
                        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
                            if (_userPurchases[msg.sender][tokenIds[i][j]] + amounts[i][j] > tokenInfo.maxAmountsPerUser[k]) {
                                revert TieredGameInventory__MaxPurchaseExceeded(tokenInfo.maxAmountsPerUser[k]);
                            }
                        }

                        // Add price for this token
                        totalCost += tokenInfo.prices[k] * amounts[i][j];
                        break;
                    }
                }
            }
        }
        
        // Skip payment if caller has ZUCKANATOR_ROLE
        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
            if (msg.value < totalCost) {
                revert TieredGameInventory__InsufficientPayment(totalCost, msg.value);
            }
            
            (bool success, ) = pool.call{value: totalCost}("");
            require(success, "ETH transfer failed");
            
            if (msg.value > totalCost) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalCost}("");
                require(refundSuccess, "ETH refund failed");
            }
        }

        // Second pass: update state and mint tokens
        for (uint256 i = 0; i < tierNames.length; i++) {
            TokenInfo storage tokenInfo = _tokens[tierNames[i]];

            
            // Mint specific token IDs with specified amounts and update their supplies
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                if (amounts[i][j] > 0) {
                    // Find the token index and update its supply
                    for (uint256 k = 0; k < tokenInfo.tokenIds.length; k++) {
                        if (tokenInfo.tokenIds[k] == tokenIds[i][j]) {
                            tokenInfo.currentSupplies[k] += amounts[i][j];
                            break;
                        }
                    }
                    
                    _userPurchases[msg.sender][tokenIds[i][j]] += amounts[i][j];
                    _mint(msg.sender, tokenIds[i][j], amounts[i][j], "");
                    assetTracking.emitMint(msg.sender, tokenIds[i][j], amounts[i][j], uri(tokenIds[i][j]));
                    emit NFTBought(address(this), msg.sender, tokenIds[i][j], tierNames[i]);
                }
            }
        }
    }

    /// @notice Burns tokens from the caller's balance
    /// @param tokenId The token ID to burn
    /// @param amount The amount to burn
    function burn(uint256 tokenId, uint256 amount) external {
        _burn(msg.sender, tokenId, amount);
        
        string memory tierName = _tokenIdToTierName[tokenId];
        TokenInfo storage tokenInfo = _tokens[tierName];
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                tokenInfo.currentSupplies[i] -= amount;
                break;
            }
        }

        if (address(assetTracking) != address(0)) {
            assetTracking.emitBurn(msg.sender, tokenId, amount, uri(tokenId));
        }
    }

    /// @notice Burns multiple tokens from the caller's balance
    /// @param tokenIds Array of token IDs to burn
    /// @param amounts Array of amounts to burn for each token ID
    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) external {
        _burnBatch(msg.sender, tokenIds, amounts);

         for (uint256 i = 0; i < tokenIds.length; i++) {
            string memory tierName = _tokenIdToTierName[tokenIds[i]];
            TokenInfo storage tokenInfo = _tokens[tierName];
            for (uint256 j = 0; j < tokenInfo.tokenIds.length; j++) {
                if (tokenInfo.tokenIds[j] == tokenIds[i]) {
                    tokenInfo.currentSupplies[j] -= amounts[i];
                    break;
                }
            }
        }
        
        // Emit burn tracking for each token
        if (address(assetTracking) != address(0)) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                assetTracking.emitBurn(msg.sender, tokenIds[i], amounts[i], uri(tokenIds[i]));
            }
        }
    }

    // IERC2981 implementation
    function royaltyInfo(uint256, uint256 salePrice) external view override returns 
    (address receiver, uint256 royaltyAmount) 
    {
        // sale price * royalty percentage div 100%
        return (royaltyReceiver, (salePrice * percent) / 10000); 
    }

    /// @notice Returns the maximum supply for a given token ID
    /// @param tokenId The token ID to query
    /// @return The maximum supply of the token ID
    function getMaxSupply(uint256 tokenId) external view returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];
        
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                return tokenInfo.maxSupplies[i];
            }
        }
        
        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Returns address that should be receiving payment
    function getPayee() public view override returns(address) {
        return pool;
    }

    /// @notice Returns address that should be receiving royalties
    function getRoyaltyReceiver() public view override returns(address) {
        return royaltyReceiver;
    }

    /// @notice Returns the current royalty percentage in basis points
    function getRoyaltyPercentage() public view override returns(uint256) {
        return percent;
    }

    /// @notice Gets the tier URI for a specific tier
    /// @param tierName the name of the tier
    /// @return The tier URI
    function getTierURI(string memory tierName) external view returns (string memory) {
        return _tokens[tierName].tierURI;
    }

    /// @notice Gets all token IDs for a specific tier
    /// @param tierName the name of the tier
    /// @return Array of token IDs belonging to this tier
    function getTierTokenIds(string memory tierName) external view returns (uint256[] memory) {
        return _tokens[tierName].tokenIds;
    }

    /// @notice Gets the tier name for a specific token ID
    /// @param tokenId the token ID to query
    /// @return The tier name this token belongs to
    function getTokenTierName(uint256 tokenId) external view returns (string memory) {
        return _tokenIdToTierName[tokenId];
    }

    /// @notice Internal function to initialize tokens during deployment
    /// @param deploymentTiers Array of deployment tier configurations
    /// @notice Internal function to initialize tokens during deployment
    /// @param deploymentTiers Array of deployment tier configurations
    function _initializeTokens(DeploymentTier[] memory deploymentTiers) internal {
        for (uint256 i = 0; i < deploymentTiers.length; i++) {
            uint256 tokenIdCount = deploymentTiers[i].initialSupplies.length;
            
            if (tokenIdCount == 0) {
                revert TieredGameInventory__InvalidTokenIdCount();
            }
            
            if (tokenIdCount != deploymentTiers[i].prices.length || 
                tokenIdCount != deploymentTiers[i].maxAmountsPerUser.length) {
                revert TieredGameInventory__TierArrayLengthMismatch();
            }

            uint256[] memory tierTokenIds = new uint256[](tokenIdCount);
            uint256[] memory currentSupplies = new uint256[](tokenIdCount);
            uint256[] memory maxSupplies = new uint256[](tokenIdCount);
            uint256[] memory maxAmountsPerUser = new uint256[](tokenIdCount);
            
            // Convert uint128 arrays to uint256 arrays
            for (uint256 j = 0; j < tokenIdCount; j++) {
                tierTokenIds[j] = _nextTokenId;
                _tokenIdToTierName[_nextTokenId] = deploymentTiers[i].name;
                currentSupplies[j] = 0;
                maxSupplies[j] = uint256(deploymentTiers[i].initialSupplies[j]);
                maxAmountsPerUser[j] = uint256(deploymentTiers[i].maxAmountsPerUser[j]);
                _nextTokenId++;
            }
            
            _tokens[deploymentTiers[i].name] = TokenInfo({
                tokenIds: tierTokenIds,
                maxSupplies: maxSupplies,
                currentSupplies: currentSupplies,
                prices: deploymentTiers[i].prices,
                maxAmountsPerUser: maxAmountsPerUser,
                tierURI: deploymentTiers[i].tierURI
            });
        }
    }

    function uri(uint256 tokenId)
        public
        view
        override(ERC1155, ITieredGameInventoryStudioChain1155)
        returns (string memory)
    {
        // Check if token exists first
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }  // <-- ADD THIS CLOSING BRACE

        // Check individual URI
        if (bytes(_tokenURIs[tokenId]).length > 0) {
            return _tokenURIs[tokenId];
        }

        // Check tier URI
        TokenInfo storage tokenInfo = _tokens[tierName];
        if (bytes(tokenInfo.tierURI).length > 0) {
            return string(abi.encodePacked(tokenInfo.tierURI, Strings.toString(tokenId)));
        }

        // Fallback to base URI
        return super.uri(tokenId);
    }

    /// @notice Gets the maximum amount per user for a specific token ID
    /// @param tokenId The token ID to query
    /// @return The maximum amount this token ID allows per user
    function getMaxAmountPerUserForTokenId(uint256 tokenId) external view returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];
        
        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                return tokenInfo.maxAmountsPerUser[i];
            }
        }
        
        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Gets complete tier information for a tier by name
    /// @dev Queries a tier by its name and returns its properties
    /// @param tierName The tier name to query
    /// @return tokenInfo a struct containing the tier information
    function getTokenInfo(string calldata tierName) 
        external 
        view 
        returns (TokenInfo memory tokenInfo) 
    {
        return _tokens[tierName];
    }
    
    /// @notice Gets complete tier information for multiple tiers by name
    /// @dev Returns TokenInfo structs for each tier name provided
    /// @param tierNames Array of tier names to query
    /// @return tokenInfos Array of complete TokenInfo structs for each tier
    function getMultipleTokenInfo(string[] calldata tierNames) 
        external 
        view 
        returns (TokenInfo[] memory tokenInfos) 
    {
        uint256 length = tierNames.length;
        tokenInfos = new TokenInfo[](length);
        
        for (uint256 i = 0; i < length; ++i) {
            tokenInfos[i] = _tokens[tierNames[i]];
        }
    }

    /// @notice Checks if an operator is approved to manage all of an owner's assets.
    /// @param _owner The address of the owner.
    /// @param _operator The address of the operator.
    /// @return True if the operator is approved, false otherwise.
    function isApprovedForAll(address _owner, address _operator) public view override returns (bool) {
        // Check if the operator is allowed by the verifier contract
        if (verifierContract.isItApproved(_operator)) {
            return true;
        }
        return super.isApprovedForAll(_owner, _operator);
    }

    /// @notice Returns the total supply of a specific token.
    /// @param tokenId the tokenId we are checking.
    /// @return The total supply of the tier.
    function totalSupply(uint256 tokenId) public view override returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];

        if (bytes(tierName).length == 0) {
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        }

        TokenInfo storage tokenInfo = _tokens[tierName];

        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                return tokenInfo.currentSupplies[i];
            }
        }

        revert TieredGameInventory__InvalidTokenId();
    }

    /// @notice Checks if the contract supports a specific interface.
    /// @param interfaceId The ID of the interface.
    /// @return True if the interface is supported, false otherwise.
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl, IERC165) returns (bool) {
        return 
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
    
    /**
     * @dev Override _beforeTokenTransfer to add pause functionality
     */
        function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {

        super._update(from, to, ids, values);
        
        // Only emit transfer tracking if assetTracking is set
        if (address(assetTracking) != address(0)) {
            assetTracking.emitTransfer(from, to, ids, values);
        }
    }
}
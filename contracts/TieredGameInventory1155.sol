// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITieredGameInventory1155.sol";

// Verifier interface
interface IVerifier {
    function isItApproved(address _address) external view returns (bool);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
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

    function emitTransfer(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external;

    function emitBurn(
        address from, 
        uint256 id, 
        uint256 amount, 
        string calldata tokenURI
    ) external; 
}

/// @title TieredGameInventory1155
/// @author @SolidityDevNL
/// @notice ERC1155 contract for managing in-game assets with tiered metadata
contract TieredGameInventory1155 is ITieredGameInventory1155, ERC1155, AccessControl, IERC2981 {

    IERC20 public immutable karratToken;
    IVerifier public verifierContract;
    bytes32 public constant ZUCKANATOR_ROLE = keccak256("ZUCKANATOR_ROLE");
    address private pool;
    address private royaltyReceiver;
    uint private percent;
    mapping(address => mapping(uint256 => uint256)) private _userPurchases;
    bool public override closeMinting;
    uint256 private _nextTokenId = 1;
    mapping(uint256 => string) private _tokenURIs;
    mapping(string => TokenInfo) private _tokens;
    mapping(uint256 => string) private _tokenIdToTierName;
    string public name;
    string public symbol;
    IMPHAssetTracking private assetTracking;

    constructor(
        DeploymentConfig memory config,
        DeploymentAddresses memory addresses,
        DeploymentTier[] memory deploymentTiers
    ) ERC1155("") {
        if (deploymentTiers.length == 0) {
            revert TieredGameInventory__EmptyInitialSupplies();
        }
        
        percent = config.royaltyPercentage;
        karratToken = IERC20(addresses.karratCoin);
        pool = addresses.pool;
        royaltyReceiver = addresses.pool;        
        verifierContract = IVerifier(addresses.verifierAddress);
        name = "My Pet Hooligan Game Items";
        symbol = "MPHGI";
        
        _grantRole(DEFAULT_ADMIN_ROLE, addresses.admin);
        _grantRole(ZUCKANATOR_ROLE, addresses.operator);
        
        _initializeTokens(deploymentTiers);
    }

    function addNewTier(
        string memory tierName,
        NewTokenInfo memory newTier
    ) external onlyRole(ZUCKANATOR_ROLE) returns (uint256[] memory tokenIds) {
        uint256 tokenIdCount = newTier.maxSupplies.length;
        
        if (tokenIdCount == 0) revert TieredGameInventory__InvalidTokenIdCount();
        if (tokenIdCount != newTier.prices.length || tokenIdCount != newTier.maxAmountsPerUser.length)
            revert TieredGameInventory__TierArrayLengthMismatch();
        if (_tokens[tierName].tokenIds.length > 0)
            revert TieredGameInventory__TokenDoesNotExist(string(abi.encodePacked("Tier already exists: ", tierName)));

        tokenIds = new uint256[](tokenIdCount);
        uint256[] memory currentSupplies = new uint256[](tokenIdCount);
        
        for (uint256 i = 0; i < tokenIdCount; i++) {
            tokenIds[i] = _nextTokenId;
            _tokenIdToTierName[_nextTokenId] = tierName;
            currentSupplies[i] = 0;
            _nextTokenId++;
        }

        _tokens[tierName] = TokenInfo({
            tokenIds: tokenIds,
            maxSupplies: newTier.maxSupplies,
            currentSupplies: currentSupplies,
            prices: newTier.prices,
            maxAmountsPerUser: newTier.maxAmountsPerUser,
            tierURI: newTier.tierURI
        });
        
        emit NewTierAdded(tierName, tokenIds);
        return tokenIds;
    }

    function addNewTiers(
        string[] memory names,
        NewTokenInfo[] memory newTiers
    ) external onlyRole(ZUCKANATOR_ROLE) returns (uint256[] memory allTokenIds) {
        if (names.length != newTiers.length) revert TieredGameInventory__TierArrayLengthMismatch();
        if (names.length == 0) revert TieredGameInventory__EmptyInitialSupplies();

        uint256 totalTokenIds = 0;
        for (uint256 i = 0; i < newTiers.length; i++) {
            uint256 tokenIdCount = newTiers[i].maxSupplies.length;
            if (tokenIdCount == 0) revert TieredGameInventory__InvalidTokenIdCount();
            if (tokenIdCount != newTiers[i].prices.length || tokenIdCount != newTiers[i].maxAmountsPerUser.length)
                revert TieredGameInventory__TierArrayLengthMismatch();
            totalTokenIds += tokenIdCount;
        }

        allTokenIds = new uint256[](totalTokenIds);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < names.length; i++) {
            if (_tokens[names[i]].tokenIds.length > 0)
                revert TieredGameInventory__TokenDoesNotExist(string(abi.encodePacked("Tier already exists: ", names[i])));

            uint256 tokenIdCount = newTiers[i].maxSupplies.length;
            uint256[] memory tierTokenIds = new uint256[](tokenIdCount);
            uint256[] memory currentSupplies = new uint256[](tokenIdCount);
            
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

    function updateTier(string memory tierName, NewTokenInfo memory updatedTier) external onlyRole(ZUCKANATOR_ROLE) {
        TokenInfo storage tokenInfo = _tokens[tierName];
        if (tokenInfo.tokenIds.length == 0) revert TieredGameInventory__TokenDoesNotExist(tierName);
        
        uint256 tokenIdCount = tokenInfo.tokenIds.length;
        if (updatedTier.maxSupplies.length != tokenIdCount ||
            updatedTier.prices.length != tokenIdCount ||
            updatedTier.maxAmountsPerUser.length != tokenIdCount)
            revert TieredGameInventory__TierArrayLengthMismatch();
        
        for (uint256 i = 0; i < tokenIdCount; i++) {
            if (updatedTier.maxSupplies[i] < tokenInfo.currentSupplies[i])
                revert TieredGameInventory__InvalidSupplyReduction(tierName, updatedTier.maxSupplies[i], tokenInfo.currentSupplies[i]);
        }
        
        tokenInfo.maxSupplies = updatedTier.maxSupplies;
        tokenInfo.prices = updatedTier.prices;
        tokenInfo.maxAmountsPerUser = updatedTier.maxAmountsPerUser;
        tokenInfo.tierURI = updatedTier.tierURI;
        
        emit TierUpdated(tierName, tokenInfo.tokenIds);
    }

    function setSaleState(bool state) external override onlyRole(ZUCKANATOR_ROLE) {
        closeMinting = state;
        emit SaleStateChanged(state);
    }

    function setTierURI(string memory tierName, string memory tierURI) external onlyRole(ZUCKANATOR_ROLE) {
        if (_tokens[tierName].tokenIds.length == 0) revert TieredGameInventory__TokenDoesNotExist(tierName);
        _tokens[tierName].tierURI = tierURI;
        emit TierURIChanged(tierName, tierURI);
    }

    function setInitialSupplies(string[] memory names, uint256[] memory newSupplies) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (names.length != newSupplies.length) revert TieredGameInventory__TierArrayLengthMismatch();
        if (names.length == 0) revert TieredGameInventory__EmptyInitialSupplies();
        
        for (uint256 i = 0; i < names.length; i++) {
            uint256 newSupply = newSupplies[i];
            string memory tierName = names[i];
            TokenInfo storage tokenInfo = _tokens[tierName];
            
            uint256 totalCurrentSupply = 0;
            for (uint256 j = 0; j < tokenInfo.currentSupplies.length; j++) {
                totalCurrentSupply += tokenInfo.currentSupplies[j];
            }
            
            if (newSupply < totalCurrentSupply)
                revert TieredGameInventory__InvalidSupplyReduction(tierName, newSupply, totalCurrentSupply);
            
            uint256 perTokenSupply = newSupply / tokenInfo.tokenIds.length;
            for (uint256 j = 0; j < tokenInfo.maxSupplies.length; j++) {
                tokenInfo.maxSupplies[j] = perTokenSupply;
            }
            
            emit SupplyChangedForId(tierName, newSupply);
        }
    }

    function setVerifier(address _verifierAddress) public override onlyRole(ZUCKANATOR_ROLE) {
        verifierContract = IVerifier(_verifierAddress);
        emit VerifierChanged(_verifierAddress);
    }

    function setMPHAssetTracking(address _trackingContract) external onlyRole(ZUCKANATOR_ROLE) {
        if (_trackingContract == address(0)) revert ZeroAddress();
        assetTracking = IMPHAssetTracking(_trackingContract);
        emit MPHAssetTrackingUpdated(_trackingContract);
    }

    function setMaxSupplyForTokenId(uint256 tokenId, uint256 _newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) {
                if (_newMaxSupply < tokenInfo.currentSupplies[i])
                    revert TieredGameInventory__InvalidSupplyReduction(tierName, _newMaxSupply, tokenInfo.currentSupplies[i]);
                tokenInfo.maxSupplies[i] = _newMaxSupply;
                emit SupplyChangedForId(tierName, _newMaxSupply);
                return;
            }
        }
        revert TieredGameInventory__InvalidTokenId();
    }

    function setPriceForTokenId(uint256 tokenId, uint256 _newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        
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

    function setMaxAmountPerUserForTokenId(uint256 tokenId, uint256 _maxAmountPerUser) external onlyRole(ZUCKANATOR_ROLE) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        
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

    function setPool(address _pool) external override onlyRole(ZUCKANATOR_ROLE) {
        if (_pool == address(0)) revert ZeroAddress();
        pool = _pool;
        emit PoolChanged(_pool);
    }

    function setRoyaltyReceiver(address _royaltyReceiver) external override onlyRole(ZUCKANATOR_ROLE) {
        if (_royaltyReceiver == address(0)) revert ZeroAddress();
        address oldReceiver = royaltyReceiver;
        royaltyReceiver = _royaltyReceiver;
        emit RoyaltyReceiverChanged(oldReceiver, _royaltyReceiver);
    }

    function setRoyalty(uint256 _percent) external override onlyRole(ZUCKANATOR_ROLE) {
        if (_percent > 10000) revert InvalidPercent();
        percent = _percent;
        emit NewRoyalty(_percent);
    }

    function setTokenURI(uint256 tokenId, string memory tokenURI) external onlyRole(ZUCKANATOR_ROLE) {
        if (bytes(_tokenIdToTierName[tokenId]).length == 0)
            revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        _tokenURIs[tokenId] = tokenURI;
        emit URI(tokenURI, tokenId);
    }

    function withdraw(address tokenAddress) external onlyRole(ZUCKANATOR_ROLE) {
        if (tokenAddress == address(0)) {
            uint256 balance = address(this).balance;
            if (balance == 0) revert TieredGameInventory__WithdrawalFailed();
            (bool success, ) = pool.call{value: balance}("");
            if (!success) revert TieredGameInventory__WithdrawalFailed();
            emit TokensWithdrawn(address(0), pool, balance);
        } else {
            IERC20 token = IERC20(tokenAddress);
            uint256 balance = token.balanceOf(address(this));
            if (balance == 0) revert TieredGameInventory__WithdrawalFailed();
            bool success = token.transfer(pool, balance);
            if (!success) revert TieredGameInventory__WithdrawalFailed();
            emit TokensWithdrawn(tokenAddress, pool, balance);
        }
    }

    function buyNFT(string memory tierName, uint256[] memory tokenIds, uint256[] memory amounts) external override {
        if (closeMinting) revert TieredGameInventory__SaleStateClosed();
        if (tokenIds.length != amounts.length) revert TieredGameInventory__TierArrayLengthMismatch();
        if (tokenIds.length == 0) revert TieredGameInventory__EmptyInitialSupplies();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            for (uint256 j = i + 1; j < tokenIds.length; j++) {
                if (tokenIds[i] == tokenIds[j]) revert TieredGameInventory__DuplicateTokenId(tokenIds[i]);
            }
        }

        TokenInfo storage tokenInfo = _tokens[tierName];
        if (tokenInfo.tokenIds.length == 0) revert TieredGameInventory__TokenDoesNotExist(tierName);

        uint256 totalPrice = 0;
        uint256[] memory tokenIndices = new uint256[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (keccak256(bytes(_tokenIdToTierName[tokenIds[i]])) != keccak256(bytes(tierName)))
                revert TieredGameInventory__InvalidTokenId();
            
            uint256 tokenIndex = type(uint256).max;
            for (uint256 j = 0; j < tokenInfo.tokenIds.length; j++) {
                if (tokenInfo.tokenIds[j] == tokenIds[i]) {
                    tokenIndex = j;
                    break;
                }
            }
            if (tokenIndex == type(uint256).max) revert TieredGameInventory__InvalidTokenId();
            
            tokenIndices[i] = tokenIndex;

            if (tokenInfo.currentSupplies[tokenIndex] + amounts[i] > tokenInfo.maxSupplies[tokenIndex])
                revert TieredGameInventory__MaxSupplyReached(tierName);

            if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
                if (_userPurchases[msg.sender][tokenIds[i]] + amounts[i] > tokenInfo.maxAmountsPerUser[tokenIndex])
                    revert TieredGameInventory__MaxPurchaseExceeded(tokenInfo.maxAmountsPerUser[tokenIndex]);
            }

            totalPrice += tokenInfo.prices[tokenIndex] * amounts[i];
        }
        
        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
            bool success = karratToken.transferFrom(msg.sender, pool, totalPrice);
            require(success, "KARRAT transfer failed");
        }

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

    function buyMultiple(
        string[] memory tierNames,
        uint256[][] memory tokenIds,
        uint256[][] memory amounts
    ) external {
        if (closeMinting) revert TieredGameInventory__SaleStateClosed();
        if (tierNames.length != tokenIds.length || tokenIds.length != amounts.length)
            revert TieredGameInventory__TierArrayLengthMismatch();
        if (tierNames.length > 10) revert Ten_Token_Types_Only();
        if (tierNames.length == 0) revert TieredGameInventory__EmptyInitialSupplies();

        for (uint256 i = 0; i < tierNames.length; i++) {
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                for (uint256 k = i; k < tierNames.length; k++) {
                    uint256 startL = (k == i) ? j + 1 : 0;
                    for (uint256 l = startL; l < tokenIds[k].length; l++) {
                        if (tokenIds[i][j] == tokenIds[k][l])
                            revert TieredGameInventory__DuplicateTokenId(tokenIds[i][j]);
                    }
                }
            }
        }
        
        uint256 totalCost = 0;
        
        for (uint256 i = 0; i < tierNames.length; i++) {
            TokenInfo storage tokenInfo = _tokens[tierNames[i]];
            if (tokenInfo.tokenIds.length == 0) revert TieredGameInventory__TokenDoesNotExist(tierNames[i]);
            if (tokenIds[i].length != amounts[i].length) revert TieredGameInventory__TierArrayLengthMismatch();

            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                if (keccak256(bytes(_tokenIdToTierName[tokenIds[i][j]])) != keccak256(bytes(tierNames[i])))
                    revert TieredGameInventory__InvalidTokenId();
                
                for (uint256 k = 0; k < tokenInfo.tokenIds.length; k++) {
                    if (tokenInfo.tokenIds[k] == tokenIds[i][j]) {
                        if (tokenInfo.currentSupplies[k] + amounts[i][j] > tokenInfo.maxSupplies[k])
                            revert TieredGameInventory__MaxSupplyReached(tierNames[i]);
                        
                        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
                            if (_userPurchases[msg.sender][tokenIds[i][j]] + amounts[i][j] > tokenInfo.maxAmountsPerUser[k])
                                revert TieredGameInventory__MaxPurchaseExceeded(tokenInfo.maxAmountsPerUser[k]);
                        }
                        totalCost += tokenInfo.prices[k] * amounts[i][j];
                        break;
                    }
                }
            }
        }
        
        if (!hasRole(ZUCKANATOR_ROLE, msg.sender)) {
            bool success = karratToken.transferFrom(msg.sender, pool, totalCost);
            require(success, "KARRAT transfer failed");
        }

        for (uint256 i = 0; i < tierNames.length; i++) {
            TokenInfo storage tokenInfo = _tokens[tierNames[i]];
            
            for (uint256 j = 0; j < tokenIds[i].length; j++) {
                if (amounts[i][j] > 0) {
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

    function burn(uint256 tokenId, uint256 amount) external {
        _burn(msg.sender, tokenId, amount);
        if (address(assetTracking) != address(0)) {
            assetTracking.emitBurn(msg.sender, tokenId, amount, uri(tokenId));
        }
    }

    function burnBatch(uint256[] memory tokenIds, uint256[] memory amounts) external {
        _burnBatch(msg.sender, tokenIds, amounts);
        if (address(assetTracking) != address(0)) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                assetTracking.emitBurn(msg.sender, tokenIds[i], amounts[i], uri(tokenIds[i]));
            }
        }
    }

    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        return (royaltyReceiver, (salePrice * percent) / 10000);
    }

    function getMaxSupply(uint256 tokenId) external view returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) return tokenInfo.maxSupplies[i];
        }
        revert TieredGameInventory__InvalidTokenId();
    }

    function getPayee() public view override returns (address) { return pool; }
    function getRoyaltyReceiver() public view override returns (address) { return royaltyReceiver; }
    function getRoyaltyPercentage() public view override returns (uint256) { return percent; }
    function getTierURI(string memory tierName) external view returns (string memory) { return _tokens[tierName].tierURI; }
    function getTierTokenIds(string memory tierName) external view returns (uint256[] memory) { return _tokens[tierName].tokenIds; }
    function getTokenTierName(uint256 tokenId) external view returns (string memory) { return _tokenIdToTierName[tokenId]; }

    function _initializeTokens(DeploymentTier[] memory deploymentTiers) internal {
        for (uint256 i = 0; i < deploymentTiers.length; i++) {
            uint256 tokenIdCount = deploymentTiers[i].initialSupplies.length;
            if (tokenIdCount == 0) revert TieredGameInventory__InvalidTokenIdCount();
            if (tokenIdCount != deploymentTiers[i].prices.length || tokenIdCount != deploymentTiers[i].maxAmountsPerUser.length)
                revert TieredGameInventory__TierArrayLengthMismatch();

            uint256[] memory tierTokenIds = new uint256[](tokenIdCount);
            uint256[] memory currentSupplies = new uint256[](tokenIdCount);
            uint256[] memory maxSupplies = new uint256[](tokenIdCount);
            uint256[] memory maxAmountsPerUser = new uint256[](tokenIdCount);
            
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

    function uri(uint256 tokenId) public view override(ERC1155, ITieredGameInventory1155) returns (string memory) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));

        if (bytes(_tokenURIs[tokenId]).length > 0) return _tokenURIs[tokenId];

        TokenInfo storage tokenInfo = _tokens[tierName];
        if (bytes(tokenInfo.tierURI).length > 0)
            return string(abi.encodePacked(tokenInfo.tierURI, Strings.toString(tokenId)));

        return super.uri(tokenId);
    }

    function getMaxAmountPerUserForTokenId(uint256 tokenId) external view returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));
        
        TokenInfo storage tokenInfo = _tokens[tierName];
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) return tokenInfo.maxAmountsPerUser[i];
        }
        revert TieredGameInventory__InvalidTokenId();
    }

    function getTokenInfo(string calldata tierName) external view returns (TokenInfo memory tokenInfo) {
        return _tokens[tierName];
    }

    function getMultipleTokenInfo(string[] calldata tierNames) external view returns (TokenInfo[] memory tokenInfos) {
        uint256 length = tierNames.length;
        tokenInfos = new TokenInfo[](length);
        for (uint256 i = 0; i < length; ++i) {
            tokenInfos[i] = _tokens[tierNames[i]];
        }
    }

    function isApprovedForAll(address _owner, address _operator) public view override returns (bool) {
        if (verifierContract.isItApproved(_operator)) return true;
        return super.isApprovedForAll(_owner, _operator);
    }

    function totalSupply(uint256 tokenId) public view returns (uint256) {
        string memory tierName = _tokenIdToTierName[tokenId];
        if (bytes(tierName).length == 0) revert TieredGameInventory__TokenDoesNotExist(Strings.toString(tokenId));

        TokenInfo storage tokenInfo = _tokens[tierName];
        for (uint256 i = 0; i < tokenInfo.tokenIds.length; i++) {
            if (tokenInfo.tokenIds[i] == tokenId) return tokenInfo.currentSupplies[i];
        }
        revert TieredGameInventory__InvalidTokenId();
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        super._update(from, to, ids, values);
        if (address(assetTracking) != address(0)) {
            assetTracking.emitTransfer(from, to, ids, values);
        }
    }
}

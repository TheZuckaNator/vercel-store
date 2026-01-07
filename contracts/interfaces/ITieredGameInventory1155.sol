// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

interface ITieredGameInventory1155 {
    struct TokenInfo {
        uint256[] tokenIds;
        uint256[] maxSupplies;
        uint256[] currentSupplies;
        uint256[] prices;
        uint256[] maxAmountsPerUser;
        string tierURI;
    }

    struct NewTokenInfo {
        uint256[] maxSupplies;
        uint256[] prices;
        uint256[] maxAmountsPerUser;
        string tierURI;
    }

    struct DeploymentConfig {
        uint256 royaltyPercentage;
        address royaltyReceiver;
    }

    struct DeploymentAddresses {
        address admin;
        address operator;
        address pool;
        address verifierAddress;
        address karratCoin;
    }

    struct DeploymentTier {
        string name;
        string tierURI;
        uint256[] initialSupplies;
        uint256[] maxAmountsPerUser;
        uint256[] prices;
    }

    error TieredGameInventory__SaleStateClosed();
    error TieredGameInventory__TokenDoesNotExist(string name);
    error TieredGameInventory__MaxSupplyReached(string tierName);
    error TieredGameInventory__InvalidSupplyReduction(string tierName, uint256 newSupply, uint256 currentSupply);
    error TieredGameInventory__MaxPurchaseExceeded(uint256 maxAllowed);
    error TieredGameInventory__WithdrawalFailed();
    error TieredGameInventory__TierArrayLengthMismatch();
    error TieredGameInventory__EmptyInitialSupplies();
    error TieredGameInventory__InvalidTokenIdCount();
    error TieredGameInventory__InvalidTokenId();
    error TieredGameInventory__DuplicateTokenId(uint256 tokenId);
    error Ten_Token_Types_Only();
    error ZeroAddress();
    error InvalidPercent();

    event NFTBought(address indexed nftContract, address indexed buyer, uint256 indexed tokenId, string tierName);
    event SaleStateChanged(bool newState);
    event SupplyChangedForId(string indexed tierName, uint256 newSupply);
    event VerifierChanged(address newVerifier);
    event PriceChanged(string indexed tierName, uint256 newPrice);
    event PoolChanged(address newPool);
    event RoyaltyReceiverChanged(address oldReceiver, address newReceiver);
    event NewRoyalty(uint256 newRoyalty);
    event MaxPurchaseChangedForTier(string indexed tierName, uint256 newMaxPurchase);
    event NewTierAdded(string indexed tierName, uint256[] tokenIds);
    event TierUpdated(string indexed tierName, uint256[] tokenIds);
    event TierURIChanged(string indexed tierName, string newURI);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event MPHAssetTrackingUpdated(address indexed trackingContract);

    function closeMinting() external view returns (bool);
    function setSaleState(bool state) external;
    function setInitialSupplies(string[] memory names, uint256[] memory newSupplies) external;
    function setVerifier(address _verifierAddress) external;
    function setPool(address _pool) external;
    function setRoyaltyReceiver(address _royaltyReceiver) external;
    function setRoyalty(uint256 _percent) external;
    function buyNFT(string memory tierName, uint256[] memory tokenIds, uint256[] memory amounts) external;
    function getPayee() external view returns (address);
    function getRoyaltyReceiver() external view returns (address);
    function getRoyaltyPercentage() external view returns (uint256);
    function uri(uint256 tokenId) external view returns (string memory);
}

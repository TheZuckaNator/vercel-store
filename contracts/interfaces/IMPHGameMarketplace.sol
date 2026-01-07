// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

interface IMPHGameMarketplace1155 {
    event NFTBought(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 totalPrice
    );

    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external;

    function buyMultipleNFTs(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata prices,
        uint256[] calldata deadlines,
        address[] calldata sellers,
        bytes[] calldata signatures
    ) external;

    function delistToken(address nftContract, uint256 tokenId) external;
}

interface IMPHGameMarketplace {
    event FeeChanged(uint256 newFee);
    event MarketplaceChanged(address newMarketplace);
    event VerifierChanged(address newVerifier);

    function setFeePerMille(uint256 newFeePerMille) external;
    function setMarketPlace(address newMarketPlace) external;
    function setVerifier(address _verifier) external;
    function calculateRoyalty(uint256 gross) external view returns (uint256 fee);
}

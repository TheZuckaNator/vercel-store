// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

interface IMPHAssetTracking {
    event TokenMinted(
        address indexed nftContract,
        address indexed to,
        uint256 id,
        uint256 amount,
        string tokenURI
    );

    event TokenTransferred(
        address indexed nftContract,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] amounts
    );

    event TokenBurned(
        address indexed nftContract,
        address indexed from,
        uint256 id,
        uint256 amount,
        string tokenURI
    );
}

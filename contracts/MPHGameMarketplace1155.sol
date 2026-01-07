// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./interfaces/IMPHGameMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IVerifier {
    function isItApproved(address _contract) external view returns (bool);
}

/// @title MPHGameMarketplace1155
/// @notice ERC-1155 marketplace with off-chain listings (EIP-712 signatures)
contract MPHGameMarketplace1155 is IMPHGameMarketplace1155, AccessControl, EIP712, IMPHGameMarketplace {
    using SafeERC20 for IERC20;

    IERC20 public paymentToken;
    IVerifier public verifier;

    error NotForSaleOrWrongPrice();
    error CollectionDoesNotSellHere();
    error NotOwner();
    error IncorrectInput();
    error SignatureExpired();
    error NotApprovedForTransfer();

    mapping(address => mapping(uint256 => mapping(address => uint256))) public nonces;
    uint256 public feePerMille;
    address public marketplace;

    bytes32 private constant APPROVAL_TYPEHASH =
        keccak256("Approval(address seller,address nftContract,uint256 tokenId,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)");

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

    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        uint256 deadline,
        address seller,
        bytes calldata signature
    ) external override {
        if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
        if (block.timestamp > deadline) revert SignatureExpired();
        if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
        if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

        uint256 nonce = nonces[nftContract][tokenId][seller];

        bytes32 structHash = keccak256(
            abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
        );

        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (recovered != seller) revert NotOwner();

        uint256 totalPrice = price * amount;
        uint256 royalty = calculateRoyalty(totalPrice);

        paymentToken.safeTransferFrom(msg.sender, seller, totalPrice);
        if (royalty > 0) paymentToken.safeTransferFrom(msg.sender, marketplace, royalty);

        IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");
        nonces[nftContract][tokenId][seller] = nonce + 1;

        emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
    }

    function buyMultipleNFTs(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256[] calldata prices,
        uint256[] calldata deadlines,
        address[] calldata sellers,
        bytes[] calldata signatures
    ) external override {
        uint256 n = tokenIds.length;

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

            if (!verifier.isItApproved(nftContract)) revert CollectionDoesNotSellHere();
            if (block.timestamp > deadline) revert SignatureExpired();
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount) revert NotForSaleOrWrongPrice();
            if (!IERC1155(nftContract).isApprovedForAll(seller, address(this))) revert NotApprovedForTransfer();

            uint256 nonce = nonces[nftContract][tokenId][seller];

            bytes32 structHash = keccak256(
                abi.encode(APPROVAL_TYPEHASH, seller, nftContract, tokenId, amount, price, nonce, deadline)
            );

            address recovered = ECDSA.recover(_hashTypedDataV4(structHash), signatures[i]);
            if (recovered != seller) revert NotOwner();

            uint256 totalPrice = price * amount;
            totalRoyaltyDue += calculateRoyalty(totalPrice);

            paymentToken.safeTransferFrom(msg.sender, seller, totalPrice);
            IERC1155(nftContract).safeTransferFrom(seller, msg.sender, tokenId, amount, "");
            nonces[nftContract][tokenId][seller] = nonce + 1;

            emit NFTBought(nftContract, tokenId, msg.sender, seller, amount, totalPrice);
        }

        if (totalRoyaltyDue > 0) paymentToken.safeTransferFrom(msg.sender, marketplace, totalRoyaltyDue);
    }

    function delistToken(address nftContract, uint256 tokenId) external override {
        if (IERC1155(nftContract).balanceOf(msg.sender, tokenId) == 0) revert NotOwner();
        nonces[nftContract][tokenId][msg.sender] += 1;
    }

    function setFeePerMille(uint256 newFeePerMille) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeePerMille > 1000) revert IncorrectInput();
        feePerMille = newFeePerMille;
        emit FeeChanged(newFeePerMille);
    }

    function setMarketPlace(address newMarketPlace) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        marketplace = newMarketPlace;
        emit MarketplaceChanged(newMarketPlace);
    }

    function setVerifier(address _verifier) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        verifier = IVerifier(_verifier);
        emit VerifierChanged(_verifier);
    }

    function calculateRoyalty(uint256 gross) public view override returns (uint256 fee) {
        return (gross * feePerMille) / 1000;
    }
}

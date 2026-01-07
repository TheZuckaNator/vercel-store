// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IMPHAssetTracking.sol";

interface IVerifier {
    function setAllowedAddress(address _address, bool _allowed) external;
    function isItApproved(address _address) external view returns (bool);
}

/// @title MPHAssetTracking
/// @notice Contract for tracking NFT events across multiple contracts
contract MPHAssetTracking is IMPHAssetTracking, AccessControl {
    bytes32 public constant TRACKED_CONTRACT_ROLE = keccak256("TRACKED_CONTRACT_ROLE");
    
    IVerifier public verifier;
    address[] public deployedContracts;
    mapping(address => bool) public isDeployedContract;

    event ContractAdded(address indexed contractAddress);
    event ContractRemoved(address indexed contractAddress);

    constructor(address _verifier, address admin, address operator) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TRACKED_CONTRACT_ROLE, operator);
        verifier = IVerifier(_verifier);
    }

    function addNewContract(address contractAddress) external onlyRole(TRACKED_CONTRACT_ROLE) {
        require(!isDeployedContract[contractAddress], "Contract already added");
        deployedContracts.push(contractAddress);
        isDeployedContract[contractAddress] = true;
        _grantRole(TRACKED_CONTRACT_ROLE, contractAddress);
        
        // Also approve in verifier
        verifier.setAllowedAddress(contractAddress, true);
        
        emit ContractAdded(contractAddress);
    }

    function removeContract(address contractAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isDeployedContract[contractAddress], "Contract not found");
        
        for (uint256 i = 0; i < deployedContracts.length; i++) {
            if (deployedContracts[i] == contractAddress) {
                deployedContracts[i] = deployedContracts[deployedContracts.length - 1];
                deployedContracts.pop();
                break;
            }
        }
        
        isDeployedContract[contractAddress] = false;
        _revokeRole(TRACKED_CONTRACT_ROLE, contractAddress);
        
        emit ContractRemoved(contractAddress);
    }

    function getAllDeployedContracts() external view returns (address[] memory) {
        return deployedContracts;
    }

    function emitMint(
        address to,
        uint256 id,
        uint256 amount,
        string calldata tokenURI
    ) external onlyRole(TRACKED_CONTRACT_ROLE) {
        emit TokenMinted(msg.sender, to, id, amount, tokenURI);
    }

    function emitTransfer(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external onlyRole(TRACKED_CONTRACT_ROLE) {
        emit TokenTransferred(msg.sender, from, to, ids, amounts);
    }

    function emitBurn(
        address from,
        uint256 id,
        uint256 amount,
        string calldata tokenURI
    ) external onlyRole(TRACKED_CONTRACT_ROLE) {
        emit TokenBurned(msg.sender, from, id, amount, tokenURI);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Verifier is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    mapping(address => bool) private allowedAddresses;

    constructor(address multisigAdmin, address verifierRoleAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, multisigAdmin);
        _grantRole(VERIFIER_ROLE, verifierRoleAddress);
    }

    function setAllowedAddress(address _address, bool _allowed) external onlyRole(VERIFIER_ROLE) {
        allowedAddresses[_address] = _allowed;
    }

    function isItApproved(address _address) external view returns (bool) {
        return allowedAddresses[_address];
    }
}

contract MockKARRAT {
    string public name = "KARRAT Token";
    string public symbol = "KARRAT";
    uint8 public decimals = 18;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor() {
        _mint(msg.sender, 1_000_000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        return _transfer(from, to, amount);
    }
    
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

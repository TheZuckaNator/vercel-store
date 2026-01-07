export const NFT_ABI = [
  "function buyNFT(string memory tierName, uint256[] memory tokenIds, uint256[] memory amounts) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function getTokenInfo(string calldata tierName) external view returns (tuple(uint256[] tokenIds, uint256[] maxSupplies, uint256[] currentSupplies, uint256[] prices, uint256[] maxAmountsPerUser, string tierURI))",
  "function getTierTokenIds(string memory tierName) external view returns (uint256[])",
  "function uri(uint256 tokenId) external view returns (string)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function name() external view returns (string)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external"
];

export const MARKETPLACE_ABI = [
  "function buyNFT(address nftContract, uint256 tokenId, uint256 amount, uint256 price, uint256 deadline, address seller, bytes calldata signature) external",
  "function delistToken(address nftContract, uint256 tokenId) external",
  "function nonces(address nftContract, uint256 tokenId, address seller) external view returns (uint256)",
  "function feePerMille() external view returns (uint256)"
];

export const TRACKING_ABI = [
  "function addNewContract(address contractAddress) external",
  "function getAllDeployedContracts() external view returns (address[])"
];

export const KARRAT_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export const EIP712_DOMAIN = {
  name: "KarratMarketplace",
  version: "1"
};

export const APPROVAL_TYPES = {
  Approval: [
    { name: "seller", type: "address" },
    { name: "nftContract", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "price", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

export const TIER_CONFIG = {
  Weapons: { color: "#ff6b35", icon: "⚔️" },
  Armor: { color: "#4a90d9", icon: "🛡️" },
  Consumables: { color: "#22c55e", icon: "🧪" },
  Rare: { color: "#a855f7", icon: "💎" },
  Legendary: { color: "#fbbf24", icon: "👑" }
};

export const TOKEN_METADATA = {
  // Weapons (Token IDs 1-3)
  1: {
    name: "Plasma Rifle X-7",
    description: "High-powered plasma weapon with rapid fire capability",
    image: "https://imgs.search.brave.com/vqHqQ4OX9po1d32V3ArLgQBF_C3IdKkXfOR7yZmyNpQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMud2lraWEubm9j/b29raWUubmV0L3hj/b20vaW1hZ2VzLzcv/NzEvWEVVX0xpZ2h0/X1BsYXNtYV9SaWZs/ZS5wbmcvcmV2aXNp/b24vbGF0ZXN0L3Nj/YWxlLXRvLXdpZHRo/LWRvd24vMjY4P2Ni/PTIwMTMwMzI0MTgz/MTAw",
    rarity: "Common"
  },
  2: {
    name: "Neon Katana",
    description: "Energy-infused blade that cuts through any armor",
    image: "https://img.icons8.com/color/400/sword.png",
    rarity: "Uncommon"
  },
  3: {
    name: "Thunder Cannon",
    description: "Devastating area-of-effect lightning weapon",
    image: "https://img.icons8.com/color/400/cannon.png",
    rarity: "Rare"
  },
  // Armor (Token IDs 4-6)
  4: {
    name: "Nano Shield MK-II",
    description: "Regenerating nanite shield technology",
    image: "https://img.icons8.com/color/400/shield.png",
    rarity: "Common"
  },
  5: {
    name: "Cyber Helmet Pro",
    description: "Advanced HUD with threat detection",
    image: "https://img.icons8.com/color/400/helmet.png",
    rarity: "Uncommon"
  },
  6: {
    name: "Stealth Suit Alpha",
    description: "Optical camouflage with thermal masking",
    image: "https://imgs.search.brave.com/UYGjhisoBWJMtQkDlOtFw6v3Mzz4mCktWMjR7Z9OPak/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zd2lm/dG1vamkuY29tL2lt/YWdlcy9lbW9qaS9q/b3lwaXhlbHMvOS0w/L25pbmphLnBuZw",
    rarity: "Rare"
  },
  // Consumables (Token IDs 7-9)
  7: {
    name: "Mega Health Pack",
    description: "Instantly restores 100% health",
    image: "https://img.icons8.com/color/400/heart-health.png",
    rarity: "Common"
  },
  8: {
    name: "Energy Surge Drink",
    description: "Doubles ability power for 60 seconds",
    image: "https://img.icons8.com/color/400/energy-drink.png",
    rarity: "Common"
  },
  9: {
    name: "Speed Boost Serum",
    description: "50% movement speed increase for 30 seconds",
    image: "https://img.icons8.com/color/400/flash-on.png",
    rarity: "Common"
  },
  // Rare (Token IDs 10-11)
  10: {
    name: "Quantum Blade",
    description: "Phase-shifting weapon that bypasses shields",
    image: "https://img.icons8.com/color/400/laser-beam.png",
    rarity: "Epic"
  },
  11: {
    name: "Void Armor Set",
    description: "Complete armor forged in the void dimension",
    image: "https://img.icons8.com/color/400/iron-man.png",
    rarity: "Epic"
  },
  // Legendary (Token ID 12)
  12: {
    name: "Infinity Gauntlet",
    description: "Legendary artifact of unlimited power",
    image: "https://img.icons8.com/color/400/infinity.png",
    rarity: "Legendary"
  }
};

export const getTokenName = (tokenId) => TOKEN_METADATA[tokenId]?.name || `Token #${tokenId}`;
export const getTokenImage = (tokenId) => TOKEN_METADATA[tokenId]?.image || "https://img.icons8.com/color/200/box.png";
export const getTokenDescription = (tokenId) => TOKEN_METADATA[tokenId]?.description || "Game item";
export const getTokenRarity = (tokenId) => TOKEN_METADATA[tokenId]?.rarity || "Common";

// StudioChain ABIs (native ETH)
export const STUDIOCHAIN_NFT_ABI = [
  "function buyNFT(string memory tierName, uint256[] memory tokenIds, uint256[] memory amounts) external payable",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function getTokenInfo(string calldata tierName) external view returns (tuple(uint256[] tokenIds, uint256[] maxSupplies, uint256[] currentSupplies, uint256[] prices, uint256[] maxAmountsPerUser, string tierURI))",
  "function getTierTokenIds(string memory tierName) external view returns (uint256[])",
  "function uri(uint256 tokenId) external view returns (string)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function name() external view returns (string)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external"
];

export const STUDIOCHAIN_MARKETPLACE_ABI = [
  "function buyNFT(address nftContract, uint256 tokenId, uint256 amount, uint256 price, uint256 deadline, address seller, bytes calldata signature) external payable",
  "function delistToken(address nftContract, uint256 tokenId) external",
  "function nonces(address nftContract, uint256 tokenId, address seller) external view returns (uint256)",
  "function feePerMille() external view returns (uint256)",
  "function calculateFee(uint256 gross) external view returns (uint256)"
];

export const STUDIOCHAIN_EIP712_DOMAIN = {
  name: "StudioChainMarketplace",
  version: "1"
};

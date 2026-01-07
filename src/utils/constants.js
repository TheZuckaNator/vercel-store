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
  1: { name: "Plasma Rifle X-7", description: "High-powered plasma weapon", image: "https://img.icons8.com/color/200/rifle.png", rarity: "Common" },
  2: { name: "Neon Katana", description: "Energy-infused blade", image: "https://img.icons8.com/color/200/sword.png", rarity: "Uncommon" },
  3: { name: "Thunder Cannon", description: "Devastating lightning weapon", image: "https://img.icons8.com/color/200/cannon.png", rarity: "Rare" },
  4: { name: "Nano Shield MK-II", description: "Regenerating nanite shield", image: "https://img.icons8.com/color/200/shield.png", rarity: "Common" },
  5: { name: "Cyber Helmet Pro", description: "Advanced HUD helmet", image: "https://img.icons8.com/color/200/helmet.png", rarity: "Uncommon" },
  6: { name: "Stealth Suit Alpha", description: "Optical camouflage suit", image: "https://img.icons8.com/color/200/business-suit.png", rarity: "Rare" },
  7: { name: "Mega Health Pack", description: "Restores 100% health", image: "https://img.icons8.com/color/200/heart-health.png", rarity: "Common" },
  8: { name: "Energy Surge Drink", description: "Doubles ability power", image: "https://img.icons8.com/color/200/energy-drink.png", rarity: "Common" },
  9: { name: "Speed Boost Serum", description: "50% movement speed", image: "https://img.icons8.com/color/200/flash-on.png", rarity: "Common" },
  10: { name: "Quantum Blade", description: "Phase-shifting weapon", image: "https://img.icons8.com/color/200/laser-beam.png", rarity: "Epic" },
  11: { name: "Void Armor Set", description: "Void dimension armor", image: "https://img.icons8.com/color/200/iron-man.png", rarity: "Epic" },
  12: { name: "Infinity Gauntlet", description: "Legendary artifact", image: "https://img.icons8.com/color/200/infinity.png", rarity: "Legendary" }
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

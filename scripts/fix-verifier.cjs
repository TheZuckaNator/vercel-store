const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  // Read .env file
  const envContent = fs.readFileSync(".env", "utf8");
  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.+)`));
    return match ? match[1].trim() : null;
  };
  
  const verifierAddress = getEnv("VITE_VERIFIER_CONTRACT");
  const marketplaceAddress = getEnv("VITE_MARKETPLACE_CONTRACT");
  const nftAddress = getEnv("VITE_NFT_CONTRACT");
  
  console.log("\n==============================================");
  console.log("  FIXING VERIFIER APPROVALS");
  console.log("==============================================\n");
  console.log("Verifier:", verifierAddress);
  console.log("Marketplace:", marketplaceAddress);
  console.log("NFT:", nftAddress);
  
  const verifier = await hre.ethers.getContractAt("Verifier", verifierAddress, deployer);
  
  // Check and approve marketplace
  const marketplaceApproved = await verifier.isItApproved(marketplaceAddress);
  console.log("\nMarketplace approved:", marketplaceApproved);
  if (!marketplaceApproved) {
    await verifier.setAllowedAddress(marketplaceAddress, true);
    console.log("✅ Marketplace now approved");
  }
  
  // Check and approve NFT
  const nftApproved = await verifier.isItApproved(nftAddress);
  console.log("NFT approved:", nftApproved);
  if (!nftApproved) {
    await verifier.setAllowedAddress(nftAddress, true);
    console.log("✅ NFT now approved");
  }
  
  console.log("\n✅ Done! Try the marketplace again.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("\n==============================================");
  console.log("  MY PET HOOLIGAN - FULL SYSTEM DEPLOYMENT");
  console.log("==============================================\n");

  const [deployer, ...otherSigners] = await hre.ethers.getSigners();
  const signers = [deployer, ...otherSigners];
  
  console.log("Admin:", deployer.address);
  console.log("");

  // 1. Deploy MockKARRAT (ERC20 for testing)
  console.log("1. Deploying MockKARRAT (ERC20)...");
  const MockKARRAT = await hre.ethers.getContractFactory("MockKARRAT", deployer);
  const karrat = await MockKARRAT.deploy();
  await karrat.waitForDeployment();
  const karratAddress = await karrat.getAddress();
  console.log("   KARRAT:", karratAddress);

  // Mint KARRAT to deployer and test accounts
  await karrat.mint(deployer.address, hre.ethers.parseEther("1000000"));
  console.log("   Minted 1,000,000 KARRAT to Deployer");
  for (let i = 1; i < 5; i++) {
    await karrat.mint(signers[i].address, hre.ethers.parseEther("100000"));
    console.log(`   Minted 100,000 KARRAT to Account #${i}`);
  }

  // 2. Deploy Verifier
  console.log("\n2. Deploying Verifier...");
  const VerifierFactory = await hre.ethers.getContractFactory("Verifier", deployer);
  const verifier = await VerifierFactory.deploy(deployer.address, deployer.address);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   Verifier:", verifierAddress);

  // 3. Deploy MPHAssetTracking
  console.log("\n3. Deploying MPHAssetTracking...");
  const MPHAssetTracking = await hre.ethers.getContractFactory("MPHAssetTracking", deployer);
  const tracking = await MPHAssetTracking.deploy(
    verifierAddress,
    deployer.address,
    deployer.address
  );
  await tracking.waitForDeployment();
  const trackingAddress = await tracking.getAddress();
  console.log("   Tracking:", trackingAddress);

  // Grant tracking contract VERIFIER_ROLE so it can call verifier.setAllowedAddress
  const VERIFIER_ROLE = await verifier.VERIFIER_ROLE();
  await verifier.grantRole(VERIFIER_ROLE, trackingAddress);
  console.log("   Granted VERIFIER_ROLE to tracking contract");

  // 4. Deploy TieredGameInventory1155
  console.log("\n4. Deploying TieredGameInventory1155...");
  
  const config = {
    royaltyPercentage: 250,
    royaltyReceiver: deployer.address
  };
  
  const addresses = {
    admin: deployer.address,
    operator: deployer.address,
    pool: deployer.address,
    verifierAddress: verifierAddress,
    karratCoin: karratAddress
  };
  
  const deploymentTiers = [
    {
      name: "Weapons",
      tierURI: "https://api.mypethooligan.com/weapons/",
      initialSupplies: [100, 100, 100],
      maxAmountsPerUser: [5, 5, 5],
      prices: [
        hre.ethers.parseEther("10"),
        hre.ethers.parseEther("15"),
        hre.ethers.parseEther("20")
      ]
    },
    {
      name: "Armor",
      tierURI: "https://api.mypethooligan.com/armor/",
      initialSupplies: [50, 50, 50],
      maxAmountsPerUser: [3, 3, 3],
      prices: [
        hre.ethers.parseEther("20"),
        hre.ethers.parseEther("25"),
        hre.ethers.parseEther("30")
      ]
    },
    {
      name: "Consumables",
      tierURI: "https://api.mypethooligan.com/consumables/",
      initialSupplies: [500, 500, 500],
      maxAmountsPerUser: [20, 20, 20],
      prices: [
        hre.ethers.parseEther("5"),
        hre.ethers.parseEther("5"),
        hre.ethers.parseEther("5")
      ]
    },
    {
      name: "Rare",
      tierURI: "https://api.mypethooligan.com/rare/",
      initialSupplies: [25, 25],
      maxAmountsPerUser: [2, 2],
      prices: [
        hre.ethers.parseEther("50"),
        hre.ethers.parseEther("75")
      ]
    },
    {
      name: "Legendary",
      tierURI: "https://api.mypethooligan.com/legendary/",
      initialSupplies: [10],
      maxAmountsPerUser: [1],
      prices: [hre.ethers.parseEther("100")]
    }
  ];

  const TieredGameInventory = await hre.ethers.getContractFactory("TieredGameInventory1155", deployer);
  const nft = await TieredGameInventory.deploy(config, addresses, deploymentTiers);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("   NFT Contract:", nftAddress);

  // Link NFT to tracking
  await nft.setMPHAssetTracking(trackingAddress);
  console.log("   Set tracking on NFT");
  
  // Add NFT to tracking (tracking now has VERIFIER_ROLE to call verifier)
  await tracking.addNewContract(nftAddress);
  console.log("   Added NFT to tracking (and approved in verifier)");

  // Print tier token IDs
  for (const tier of deploymentTiers) {
    const tokenIds = await nft.getTierTokenIds(tier.name);
    console.log(`   ${tier.name}: Token IDs [${tokenIds.join(", ")}]`);
  }

  // 5. Deploy MPHGameMarketplace1155
  console.log("\n5. Deploying MPHGameMarketplace1155...");
  const Marketplace = await hre.ethers.getContractFactory("MPHGameMarketplace1155", deployer);
  const marketplace = await Marketplace.deploy(
    verifierAddress,
    deployer.address,
    deployer.address,
    karratAddress
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   Marketplace:", marketplaceAddress);

  await marketplace.setFeePerMille(25);
  console.log("   Fee set to 2.5%");

  // IMPORTANT: Approve marketplace in verifier so it can transfer NFTs
  await verifier.setAllowedAddress(marketplaceAddress, true);
  console.log("   Marketplace approved in verifier");

  // Also approve NFT contract in verifier (for marketplace to check)
  await verifier.setAllowedAddress(nftAddress, true);
  console.log("   NFT contract approved in verifier");

  // 6. Mint NFTs to test accounts
  console.log("\n6. Minting NFTs to test accounts...");
  
  await nft.buyNFT("Weapons", [1, 2], [3, 2]);
  await nft.safeTransferFrom(deployer.address, signers[1].address, 1, 3, "0x");
  await nft.safeTransferFrom(deployer.address, signers[1].address, 2, 2, "0x");
  console.log("   Account #1: 3x Token#1, 2x Token#2 (Weapons)");
  
  await nft.buyNFT("Armor", [4, 5], [2, 2]);
  await nft.safeTransferFrom(deployer.address, signers[2].address, 4, 2, "0x");
  await nft.safeTransferFrom(deployer.address, signers[2].address, 5, 2, "0x");
  console.log("   Account #2: 2x Token#4, 2x Token#5 (Armor)");

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  
  const envConfig = {
    VITE_ADMIN_ADDRESS: deployer.address,
    VITE_TRACKING_CONTRACT: trackingAddress,
    VITE_MARKETPLACE_CONTRACT: marketplaceAddress,
    VITE_NFT_CONTRACT: nftAddress,
    VITE_KARRAT_CONTRACT: karratAddress,
    VITE_VERIFIER_CONTRACT: verifierAddress
  };

  console.log("\nContract Addresses:");
  console.log("-".repeat(50));
  Object.entries(envConfig).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });

  const envContent = Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join("\n");
  fs.writeFileSync(".env", envContent);
  console.log("\n.env file updated!");

  console.log("\nTest Accounts:");
  console.log("-".repeat(50));
  console.log("Account #0 (Admin):", signers[0].address);
  console.log("  KARRAT: 1,000,000");
  console.log("\nAccount #1:", signers[1].address);
  console.log("  KARRAT: 100,000 | NFTs: 3x Token#1, 2x Token#2");
  console.log("\nAccount #2:", signers[2].address);
  console.log("  KARRAT: 100,000 | NFTs: 2x Token#4, 2x Token#5");

  console.log("\n" + "=".repeat(50));
  console.log("Run: npm run dev");
  console.log("=".repeat(50) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

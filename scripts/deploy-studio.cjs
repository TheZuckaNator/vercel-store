const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("\n==============================================");
  console.log("  STUDIOCHAIN - FULL SYSTEM DEPLOYMENT");
  console.log("==============================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("");

  // 1. Deploy Verifier
  console.log("\n1. Deploying Verifier...");
  const VerifierFactory = await hre.ethers.getContractFactory("Verifier", deployer);
  const verifier = await VerifierFactory.deploy(deployer.address, deployer.address);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   Verifier:", verifierAddress);

  // 2. Deploy MPHAssetTracking
  console.log("\n2. Deploying MPHAssetTracking...");
  const MPHAssetTracking = await hre.ethers.getContractFactory("MPHAssetTracking", deployer);
  const tracking = await MPHAssetTracking.deploy(
    verifierAddress,
    deployer.address,
    deployer.address
  );
  await tracking.waitForDeployment();
  const trackingAddress = await tracking.getAddress();
  console.log("   Tracking:", trackingAddress);

  // Grant tracking VERIFIER_ROLE
  const VERIFIER_ROLE = await verifier.VERIFIER_ROLE();
  await verifier.grantRole(VERIFIER_ROLE, trackingAddress);
  console.log("   Granted VERIFIER_ROLE to tracking");

  // 3. Deploy TieredGameInventoryStudioChain1155
  console.log("\n3. Deploying TieredGameInventoryStudioChain1155...");
  
  const config = {
    royaltyPercentage: 250,
    royaltyReceiver: deployer.address
  };
  
  const addresses = {
    admin: deployer.address,
    operator: deployer.address,
    pool: deployer.address,
    verifierAddress: verifierAddress,
    assetTrackingAddress: trackingAddress  // <-- THIS WAS MISSING
  };
  
  const deploymentTiers = [
    {
      name: "Weapons",
      tierURI: "https://api.mypethooligan.com/weapons/",
      initialSupplies: [100, 100, 100],
      maxAmountsPerUser: [5, 5, 5],
      prices: [
        hre.ethers.parseEther("0.01"),
        hre.ethers.parseEther("0.015"),
        hre.ethers.parseEther("0.02")
      ]
    },
    {
      name: "Armor",
      tierURI: "https://api.mypethooligan.com/armor/",
      initialSupplies: [50, 50, 50],
      maxAmountsPerUser: [3, 3, 3],
      prices: [
        hre.ethers.parseEther("0.02"),
        hre.ethers.parseEther("0.025"),
        hre.ethers.parseEther("0.03")
      ]
    },
    {
      name: "Consumables",
      tierURI: "https://api.mypethooligan.com/consumables/",
      initialSupplies: [500, 500, 500],
      maxAmountsPerUser: [20, 20, 20],
      prices: [
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.005"),
        hre.ethers.parseEther("0.005")
      ]
    },
    {
      name: "Rare",
      tierURI: "https://api.mypethooligan.com/rare/",
      initialSupplies: [25, 25],
      maxAmountsPerUser: [2, 2],
      prices: [
        hre.ethers.parseEther("0.05"),
        hre.ethers.parseEther("0.075")
      ]
    },
    {
      name: "Legendary",
      tierURI: "https://api.mypethooligan.com/legendary/",
      initialSupplies: [10],
      maxAmountsPerUser: [1],
      prices: [hre.ethers.parseEther("0.1")]
    }
  ];

  const TieredGameInventory = await hre.ethers.getContractFactory("TieredGameInventoryStudioChain1155", deployer);
  const nft = await TieredGameInventory.deploy(config, addresses, deploymentTiers);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("   NFT Contract:", nftAddress);

  // Add NFT to tracking
  await tracking.addNewContract(nftAddress);
  console.log("   Added NFT to tracking");

  // Print tier token IDs
  for (const tier of deploymentTiers) {
    const tokenIds = await nft.getTierTokenIds(tier.name);
    console.log(`   ${tier.name}: Token IDs [${tokenIds.join(", ")}]`);
  }

  // 4. Deploy MPHGameMarketplaceNative
  console.log("\n4. Deploying MPHGameMarketplaceNative...");
  const Marketplace = await hre.ethers.getContractFactory("MPHGameMarketplaceNative", deployer);
  const marketplace = await Marketplace.deploy(
    verifierAddress,
    deployer.address,
    deployer.address
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("   Marketplace:", marketplaceAddress);

  await marketplace.setFeePerMille(25);
  console.log("   Fee set to 2.5%");

  // 5. Approve in verifier
  console.log("\n5. Setting up verifier approvals...");
  await verifier.setAllowedAddress(marketplaceAddress, true);
  console.log("   Marketplace approved");
  await verifier.setAllowedAddress(nftAddress, true);
  console.log("   NFT contract approved");

  // Save to .env
  const envConfig = {
    VITE_STUDIOCHAIN_ADMIN_ADDRESS: deployer.address,
    VITE_STUDIOCHAIN_TRACKING_CONTRACT: trackingAddress,
    VITE_STUDIOCHAIN_MARKETPLACE_CONTRACT: marketplaceAddress,
    VITE_STUDIOCHAIN_NFT_CONTRACT: nftAddress,
    VITE_STUDIOCHAIN_VERIFIER_CONTRACT: verifierAddress
  };

  // Preserve existing env vars
  let existingEnv = {};
  try {
    const existing = fs.readFileSync(".env", "utf8");
    existing.split("\n").forEach(line => {
      const [key, value] = line.split("=");
      if (key && value && !key.startsWith("VITE_")) {
        existingEnv[key] = value;
      }
    });
  } catch {}

  const fullEnv = { ...existingEnv, ...envConfig };
  const envContent = Object.entries(fullEnv).map(([k, v]) => `${k}=${v}`).join("\n");
  fs.writeFileSync(".env", envContent);

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  
  console.log("\nContract Addresses:");
  console.log("-".repeat(50));
  Object.entries(envConfig).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });

  console.log("\n.env file updated!");
  console.log("\nRun: npm run dev");
  console.log("=".repeat(50) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
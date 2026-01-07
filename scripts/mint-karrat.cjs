const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  // Read .env file directly
  const envContent = fs.readFileSync(".env", "utf8");
  const karratMatch = envContent.match(/VITE_KARRAT_CONTRACT=(.+)/);
  const karratAddress = karratMatch ? karratMatch[1].trim() : null;
  
  if (!karratAddress) {
    console.log("VITE_KARRAT_CONTRACT not found in .env");
    return;
  }
  
  console.log("\n==============================================");
  console.log("  MINTING KARRAT TO DEPLOYER");
  console.log("==============================================\n");
  console.log("KARRAT Address:", karratAddress);
  
  const karrat = await hre.ethers.getContractAt("MockKARRAT", karratAddress, deployer);
  
  await karrat.mint(deployer.address, hre.ethers.parseEther("1000000"));
  
  const balance = await karrat.balanceOf(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("New KARRAT Balance:", hre.ethers.formatEther(balance));
  console.log("\nDone! Refresh the browser.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

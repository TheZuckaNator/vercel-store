const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MPHGameMarketplaceNative", function () {
  let marketplace;
  let nft;
  let karrat;
  let verifier;
  let tracking;
  let owner, admin, seller, buyer, feeReceiver;
  let nftAddress, marketplaceAddress, karratAddress, verifierAddress;

  // EIP-712 domain and types
  const DOMAIN_NAME = "StudioChainMarketplace";
  const DOMAIN_VERSION = "1";

  const APPROVAL_TYPES = {
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

  async function createSignature(signer, nftContract, tokenId, amount, price, nonce, deadline) {
    const domain = {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: marketplaceAddress
    };

    const value = {
      seller: signer.address,
      nftContract: nftContract,
      tokenId: tokenId,
      amount: amount,
      price: price,
      nonce: nonce,
      deadline: deadline
    };

    return await signer.signTypedData(domain, APPROVAL_TYPES, value);
  }

  beforeEach(async function () {
    [owner, admin, seller, buyer, feeReceiver] = await ethers.getSigners();

    // Deploy MockKARRAT (still needed for NFT contract)
    const MockKARRAT = await ethers.getContractFactory("MockKARRAT");
    karrat = await MockKARRAT.deploy();
    await karrat.waitForDeployment();
    karratAddress = await karrat.getAddress();

    // Deploy Verifier
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy(admin.address, admin.address);
    await verifier.waitForDeployment();
    verifierAddress = await verifier.getAddress();

    // Deploy Tracking
    const Tracking = await ethers.getContractFactory("MPHAssetTracking");
    tracking = await Tracking.deploy(verifierAddress, admin.address, admin.address);
    await tracking.waitForDeployment();
    const trackingAddress = await tracking.getAddress();

    // Grant VERIFIER_ROLE to tracking
    const VERIFIER_ROLE = await verifier.VERIFIER_ROLE();
    await verifier.connect(admin).grantRole(VERIFIER_ROLE, trackingAddress);

    // Deploy NFT
    const config = {
      royaltyPercentage: 250,
      royaltyReceiver: admin.address
    };

    const addresses = {
      admin: admin.address,
      operator: admin.address,
      pool: admin.address,
      verifierAddress: verifierAddress,
      karratCoin: karratAddress
    };

    const tiers = [
      {
        name: "TestTier",
        tierURI: "https://test.com/",
        initialSupplies: [100, 100],
        maxAmountsPerUser: [10, 10],
        prices: [ethers.parseEther("10"), ethers.parseEther("20")]
      }
    ];

    const NFT = await ethers.getContractFactory("TieredGameInventory1155");
    nft = await NFT.deploy(config, addresses, tiers);
    await nft.waitForDeployment();
    nftAddress = await nft.getAddress();

    // Setup NFT tracking
    await nft.connect(admin).setMPHAssetTracking(trackingAddress);
    await tracking.connect(admin).addNewContract(nftAddress);

    // Deploy Native Marketplace
    const Marketplace = await ethers.getContractFactory("MPHGameMarketplaceNative");
    marketplace = await Marketplace.deploy(
      verifierAddress,
      admin.address,
      feeReceiver.address
    );
    await marketplace.waitForDeployment();
    marketplaceAddress = await marketplace.getAddress();

    // Set fee to 2.5%
    await marketplace.connect(admin).setFeePerMille(25);

    // Approve marketplace and NFT in verifier
    await verifier.connect(admin).setAllowedAddress(marketplaceAddress, true);
    await verifier.connect(admin).setAllowedAddress(nftAddress, true);

    // Mint KARRAT to seller for primary purchase
    await karrat.mint(seller.address, ethers.parseEther("10000"));

    // Seller buys NFT from primary sale
    await karrat.connect(seller).approve(nftAddress, ethers.MaxUint256);
    await nft.connect(seller).buyNFT("TestTier", [1], [5]); // Buy 5 of token ID 1

    // Seller approves marketplace to transfer NFTs
    await nft.connect(seller).setApprovalForAll(marketplaceAddress, true);
  });

  // ============================================
  // DEPLOYMENT TESTS
  // ============================================

  describe("Deployment", function () {
    it("Should set the correct admin", async function () {
      expect(await marketplace.hasRole(await marketplace.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });

    it("Should set the correct verifier", async function () {
      expect(await marketplace.verifier()).to.equal(verifierAddress);
    });

    it("Should set the correct fee receiver", async function () {
      expect(await marketplace.feeReceiver()).to.equal(feeReceiver.address);
    });

    it("Should have fee set to 2.5%", async function () {
      expect(await marketplace.feePerMille()).to.equal(25);
    });

    it("Should revert if verifier is zero address", async function () {
      const Marketplace = await ethers.getContractFactory("MPHGameMarketplaceNative");
      await expect(
        Marketplace.deploy(ethers.ZeroAddress, admin.address, feeReceiver.address)
      ).to.be.revertedWithCustomError(Marketplace, "ZeroAddress");
    });

    it("Should revert if admin is zero address", async function () {
      const Marketplace = await ethers.getContractFactory("MPHGameMarketplaceNative");
      await expect(
        Marketplace.deploy(verifierAddress, ethers.ZeroAddress, feeReceiver.address)
      ).to.be.revertedWithCustomError(Marketplace, "ZeroAddress");
    });

    it("Should revert if fee receiver is zero address", async function () {
      const Marketplace = await ethers.getContractFactory("MPHGameMarketplaceNative");
      await expect(
        Marketplace.deploy(verifierAddress, admin.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Marketplace, "ZeroAddress");
    });
  });

  // ============================================
  // buyNFT TESTS
  // ============================================

  describe("buyNFT", function () {
    it("Should allow buying with valid signature and ETH", async function () {
      const tokenId = 1;
      const amount = 2;
      const price = ethers.parseEther("0.1"); // 0.1 ETH per item
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
      const buyerNFTBefore = await nft.balanceOf(buyer.address, tokenId);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n; // 2.5%

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: totalPrice + fee }
        )
      ).to.emit(marketplace, "NFTBought")
        .withArgs(nftAddress, tokenId, buyer.address, seller.address, amount, totalPrice);

      // Check NFT transferred
      expect(await nft.balanceOf(buyer.address, tokenId)).to.equal(buyerNFTBefore + BigInt(amount));
      expect(await nft.balanceOf(seller.address, tokenId)).to.equal(5 - amount);

      // Check seller received ETH (minus fee)
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + totalPrice - fee);

      // Check nonce incremented
      expect(await marketplace.nonces(nftAddress, tokenId, seller.address)).to.equal(1);
    });

    it("Should collect correct fee", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("1"); // 1 ETH
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      const feeReceiverBefore = await ethers.provider.getBalance(feeReceiver.address);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n; // 2.5% = 0.025 ETH

      await marketplace.connect(buyer).buyNFT(
        nftAddress, tokenId, amount, price, deadline, seller.address, signature,
        { value: totalPrice + fee }
      );

      const feeReceiverAfter = await ethers.provider.getBalance(feeReceiver.address);
      expect(feeReceiverAfter).to.equal(feeReceiverBefore + fee);
    });

    it("Should refund excess ETH", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n;
      const excess = ethers.parseEther("0.5"); // Send extra

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace.connect(buyer).buyNFT(
        nftAddress, tokenId, amount, price, deadline, seller.address, signature,
        { value: totalPrice + fee + excess }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      
      // Buyer should only pay totalPrice + fee + gas, excess is refunded
      expect(buyerBalanceBefore - buyerBalanceAfter - gasUsed).to.equal(totalPrice + fee);
    });

    it("Should revert if collection not approved", async function () {
      const MockERC1155 = await ethers.getContractFactory("MockERC1155");
      const unapprovedNFT = await MockERC1155.deploy();
      await unapprovedNFT.waitForDeployment();
      const unapprovedAddress = await unapprovedNFT.getAddress();

      const deadline = (await time.latest()) + 3600;
      const signature = await createSignature(seller, unapprovedAddress, 1, 1, ethers.parseEther("0.1"), 0, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          unapprovedAddress, 1, 1, ethers.parseEther("0.1"), deadline, seller.address, signature,
          { value: ethers.parseEther("0.2") }
        )
      ).to.be.revertedWithCustomError(marketplace, "CollectionDoesNotSellHere");
    });

    it("Should revert if signature expired", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) - 1; // Already expired

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: ethers.parseEther("0.2") }
        )
      ).to.be.revertedWithCustomError(marketplace, "SignatureExpired");
    });

    it("Should revert if seller has insufficient balance", async function () {
      const tokenId = 1;
      const amount = 100; // Seller only has 5
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: ethers.parseEther("20") }
        )
      ).to.be.revertedWithCustomError(marketplace, "NotForSaleOrWrongPrice");
    });

    it("Should revert if marketplace not approved in verifier", async function () {
      // Remove marketplace from verifier
      await verifier.connect(admin).setAllowedAddress(marketplaceAddress, false);
      // Also remove explicit approval
      await nft.connect(seller).setApprovalForAll(marketplaceAddress, false);

      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: ethers.parseEther("0.2") }
        )
      ).to.be.revertedWithCustomError(marketplace, "NotApprovedForTransfer");
    });

    it("Should revert if wrong signer", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      // Buyer signs instead of seller
      const signature = await createSignature(buyer, nftAddress, tokenId, amount, price, nonce, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: ethers.parseEther("0.2") }
        )
      ).to.be.revertedWithCustomError(marketplace, "NotOwner");
    });

    it("Should revert if nonce is wrong (replay attack)", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n;

      // First purchase succeeds
      await marketplace.connect(buyer).buyNFT(
        nftAddress, tokenId, amount, price, deadline, seller.address, signature,
        { value: totalPrice + fee }
      );

      // Replay with same signature fails
      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: totalPrice + fee }
        )
      ).to.be.revertedWithCustomError(marketplace, "NotOwner");
    });

    it("Should revert if insufficient payment", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: ethers.parseEther("0.5") } // Not enough
        )
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });
  });

  // ============================================
  // buyMultipleNFTs TESTS
  // ============================================

  describe("buyMultipleNFTs", function () {
    beforeEach(async function () {
      // Seller buys more NFTs for batch testing
      await nft.connect(seller).buyNFT("TestTier", [2], [5]);
    });

    it("Should allow buying multiple NFTs", async function () {
      const deadline = (await time.latest()) + 3600;
      const price1 = ethers.parseEther("0.1");
      const price2 = ethers.parseEther("0.2");

      const sig1 = await createSignature(seller, nftAddress, 1, 1, price1, 0, deadline);
      const sig2 = await createSignature(seller, nftAddress, 2, 1, price2, 0, deadline);

      const total = price1 + price2;
      const fee = (total * 25n) / 1000n;

      await marketplace.connect(buyer).buyMultipleNFTs(
        [nftAddress, nftAddress],
        [1, 2],
        [1, 1],
        [price1, price2],
        [deadline, deadline],
        [seller.address, seller.address],
        [sig1, sig2],
        { value: total + fee }
      );

      expect(await nft.balanceOf(buyer.address, 1)).to.equal(1);
      expect(await nft.balanceOf(buyer.address, 2)).to.equal(1);
    });

    it("Should collect fees correctly for batch", async function () {
      const deadline = (await time.latest()) + 3600;
      const price1 = ethers.parseEther("1");
      const price2 = ethers.parseEther("2");

      const sig1 = await createSignature(seller, nftAddress, 1, 1, price1, 0, deadline);
      const sig2 = await createSignature(seller, nftAddress, 2, 1, price2, 0, deadline);

      const total = price1 + price2;
      const fee = (total * 25n) / 1000n; // 2.5% of 3 ETH = 0.075 ETH

      const feeReceiverBefore = await ethers.provider.getBalance(feeReceiver.address);

      await marketplace.connect(buyer).buyMultipleNFTs(
        [nftAddress, nftAddress],
        [1, 2],
        [1, 1],
        [price1, price2],
        [deadline, deadline],
        [seller.address, seller.address],
        [sig1, sig2],
        { value: total + fee }
      );

      const feeReceiverAfter = await ethers.provider.getBalance(feeReceiver.address);
      expect(feeReceiverAfter).to.equal(feeReceiverBefore + fee);
    });

    it("Should refund excess in batch purchase", async function () {
      const deadline = (await time.latest()) + 3600;
      const price1 = ethers.parseEther("0.1");
      const price2 = ethers.parseEther("0.1");

      const sig1 = await createSignature(seller, nftAddress, 1, 1, price1, 0, deadline);
      const sig2 = await createSignature(seller, nftAddress, 2, 1, price2, 0, deadline);

      const total = price1 + price2;
      const fee = (total * 25n) / 1000n;
      const excess = ethers.parseEther("1");

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace.connect(buyer).buyMultipleNFTs(
        [nftAddress, nftAddress],
        [1, 2],
        [1, 1],
        [price1, price2],
        [deadline, deadline],
        [seller.address, seller.address],
        [sig1, sig2],
        { value: total + fee + excess }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceBefore - buyerBalanceAfter - gasUsed).to.equal(total + fee);
    });

    it("Should revert if arrays have different lengths", async function () {
      const deadline = (await time.latest()) + 3600;
      const sig = await createSignature(seller, nftAddress, 1, 1, ethers.parseEther("0.1"), 0, deadline);

      await expect(
        marketplace.connect(buyer).buyMultipleNFTs(
          [nftAddress, nftAddress], // 2 contracts
          [1], // 1 tokenId - mismatch!
          [1],
          [ethers.parseEther("0.1")],
          [deadline],
          [seller.address],
          [sig],
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(marketplace, "IncorrectInput");
    });

    it("Should revert if empty array", async function () {
      await expect(
        marketplace.connect(buyer).buyMultipleNFTs([], [], [], [], [], [], [], { value: 0 })
      ).to.be.revertedWithCustomError(marketplace, "IncorrectInput");
    });

    it("Should revert if more than 15 items", async function () {
      const deadline = (await time.latest()) + 3600;
      const sig = await createSignature(seller, nftAddress, 1, 1, ethers.parseEther("0.1"), 0, deadline);

      const contracts = Array(16).fill(nftAddress);
      const tokenIds = Array(16).fill(1);
      const amounts = Array(16).fill(1);
      const prices = Array(16).fill(ethers.parseEther("0.1"));
      const deadlines = Array(16).fill(deadline);
      const sellers = Array(16).fill(seller.address);
      const signatures = Array(16).fill(sig);

      await expect(
        marketplace.connect(buyer).buyMultipleNFTs(
          contracts, tokenIds, amounts, prices, deadlines, sellers, signatures,
          { value: ethers.parseEther("10") }
        )
      ).to.be.revertedWithCustomError(marketplace, "IncorrectInput");
    });

    it("Should revert if insufficient payment for batch", async function () {
      const deadline = (await time.latest()) + 3600;
      const price1 = ethers.parseEther("1");
      const price2 = ethers.parseEther("2");

      const sig1 = await createSignature(seller, nftAddress, 1, 1, price1, 0, deadline);
      const sig2 = await createSignature(seller, nftAddress, 2, 1, price2, 0, deadline);

      await expect(
        marketplace.connect(buyer).buyMultipleNFTs(
          [nftAddress, nftAddress],
          [1, 2],
          [1, 1],
          [price1, price2],
          [deadline, deadline],
          [seller.address, seller.address],
          [sig1, sig2],
          { value: ethers.parseEther("1") } // Not enough
        )
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });
  });

  // ============================================
  // delistToken TESTS
  // ============================================

  describe("delistToken", function () {
    it("Should increment nonce on delist", async function () {
      const tokenId = 1;
      expect(await marketplace.nonces(nftAddress, tokenId, seller.address)).to.equal(0);

      await expect(marketplace.connect(seller).delistToken(nftAddress, tokenId))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(nftAddress, tokenId, seller.address);

      expect(await marketplace.nonces(nftAddress, tokenId, seller.address)).to.equal(1);
    });

    it("Should invalidate previous signatures", async function () {
      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const nonce = 0;
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, nonce, deadline);

      // Seller delists
      await marketplace.connect(seller).delistToken(nftAddress, tokenId);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n;

      // Old signature should fail
      await expect(
        marketplace.connect(buyer).buyNFT(
          nftAddress, tokenId, amount, price, deadline, seller.address, signature,
          { value: totalPrice + fee }
        )
      ).to.be.revertedWithCustomError(marketplace, "NotOwner");
    });

    it("Should revert if caller has no balance", async function () {
      await expect(
        marketplace.connect(buyer).delistToken(nftAddress, 1)
      ).to.be.revertedWithCustomError(marketplace, "NotOwner");
    });
  });

  // ============================================
  // ADMIN FUNCTIONS TESTS
  // ============================================

  describe("Admin Functions", function () {
    describe("setFeePerMille", function () {
      it("Should allow admin to set fee", async function () {
        await expect(marketplace.connect(admin).setFeePerMille(50))
          .to.emit(marketplace, "FeeChanged")
          .withArgs(50);

        expect(await marketplace.feePerMille()).to.equal(50);
      });

      it("Should revert if fee > 1000", async function () {
        await expect(
          marketplace.connect(admin).setFeePerMille(1001)
        ).to.be.revertedWithCustomError(marketplace, "IncorrectInput");
      });

      it("Should revert if not admin", async function () {
        await expect(
          marketplace.connect(buyer).setFeePerMille(50)
        ).to.be.reverted;
      });
    });

    describe("setFeeReceiver", function () {
      it("Should allow admin to change fee receiver", async function () {
        await expect(marketplace.connect(admin).setFeeReceiver(buyer.address))
          .to.emit(marketplace, "FeeReceiverChanged")
          .withArgs(buyer.address);

        expect(await marketplace.feeReceiver()).to.equal(buyer.address);
      });

      it("Should revert if zero address", async function () {
        await expect(
          marketplace.connect(admin).setFeeReceiver(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(marketplace, "ZeroAddress");
      });

      it("Should revert if not admin", async function () {
        await expect(
          marketplace.connect(buyer).setFeeReceiver(buyer.address)
        ).to.be.reverted;
      });
    });

    describe("setVerifier", function () {
      it("Should allow admin to change verifier", async function () {
        await expect(marketplace.connect(admin).setVerifier(buyer.address))
          .to.emit(marketplace, "VerifierChanged")
          .withArgs(buyer.address);
      });

      it("Should revert if zero address", async function () {
        await expect(
          marketplace.connect(admin).setVerifier(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(marketplace, "ZeroAddress");
      });

      it("Should revert if not admin", async function () {
        await expect(
          marketplace.connect(buyer).setVerifier(buyer.address)
        ).to.be.reverted;
      });
    });
  });

  // ============================================
  // calculateFee TESTS
  // ============================================

  describe("calculateFee", function () {
    it("Should calculate 2.5% correctly", async function () {
      const gross = ethers.parseEther("100");
      const expected = ethers.parseEther("2.5");
      expect(await marketplace.calculateFee(gross)).to.equal(expected);
    });

    it("Should return 0 if fee is 0", async function () {
      await marketplace.connect(admin).setFeePerMille(0);
      expect(await marketplace.calculateFee(ethers.parseEther("100"))).to.equal(0);
    });

    it("Should calculate 10% correctly", async function () {
      await marketplace.connect(admin).setFeePerMille(100);
      const gross = ethers.parseEther("100");
      const expected = ethers.parseEther("10");
      expect(await marketplace.calculateFee(gross)).to.equal(expected);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("Should handle zero fee", async function () {
      await marketplace.connect(admin).setFeePerMille(0);

      const tokenId = 1;
      const amount = 1;
      const price = ethers.parseEther("0.1");
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, 0, deadline);

      const feeReceiverBefore = await ethers.provider.getBalance(feeReceiver.address);

      await marketplace.connect(buyer).buyNFT(
        nftAddress, tokenId, amount, price, deadline, seller.address, signature,
        { value: price }
      );

      // No fee should be collected
      expect(await ethers.provider.getBalance(feeReceiver.address)).to.equal(feeReceiverBefore);
    });

    it("Should handle buying entire balance", async function () {
      const tokenId = 1;
      const amount = 5; // All seller has
      const price = ethers.parseEther("0.1");
      const deadline = (await time.latest()) + 3600;

      const signature = await createSignature(seller, nftAddress, tokenId, amount, price, 0, deadline);

      const totalPrice = price * BigInt(amount);
      const fee = (totalPrice * 25n) / 1000n;

      await marketplace.connect(buyer).buyNFT(
        nftAddress, tokenId, amount, price, deadline, seller.address, signature,
        { value: totalPrice + fee }
      );

      expect(await nft.balanceOf(seller.address, tokenId)).to.equal(0);
      expect(await nft.balanceOf(buyer.address, tokenId)).to.equal(5);
    });

    it("Should receive ETH directly", async function () {
      const balanceBefore = await ethers.provider.getBalance(marketplaceAddress);
      
      await owner.sendTransaction({
        to: marketplaceAddress,
        value: ethers.parseEther("1")
      });

      const balanceAfter = await ethers.provider.getBalance(marketplaceAddress);
      expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("1"));
    });
  });
});
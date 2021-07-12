const { expect } = require("chai");
const lib = require("../scripts/lib");

var rlp = require('rlp');

describe("Checkpointer contract", function() {
  before(async function() {
    // "mine" 110 blocks
    // TODO: is there a better way to do this?
    [deployer] = await ethers.getSigners();
    for (var i = 0; i < 110; i++) {
      await deployer.sendTransaction({to: "0xd000000000000000000000000000000000000b1e", value:1});
    }

    latest_block_number = await ethers.provider.getBlockNumber();
    expect(latest_block_number > 100);
  });

  beforeEach(async function() {
    const CheckpointerFactory = await ethers.getContractFactory("Checkpointer");
    Checkpointer = await CheckpointerFactory.deploy();
  });

  it("Submit checkpoint", async function() {
    const submit_block = await ethers.provider.getBlock(latest_block_number - 100);
    await Checkpointer.attest(submit_block.number, submit_block.hash);

    const returned_block_hash = await Checkpointer.getBlockByNumber(submit_block.number, deployer.address);
    expect(returned_block_hash.hash == submit_block.hash);
    console.log(returned_block_hash);
  });

  it("Trust myself", async function() {
    await Checkpointer.trust(deployer.address);
  });

  it("Get All trusters", async function() {
    await Checkpointer.trust(deployer.address);
    
    const t = await Checkpointer.getTrusted();
    console.log(t);
  });

  it("Submit checkpoint and send to BridgeAuthority", async function() {
    const submit_block = await ethers.provider.getBlock(latest_block_number - 100);
    await Checkpointer.attest(submit_block.number, submit_block.hash);

    const returned_block_hash = await Checkpointer.getBlockByNumber(submit_block.number, deployer.address);
    expect(returned_block_hash.hash == submit_block.hash);
    const tx_block = await ethers.provider.getBlock(returned_block_hash.savedBlockNumber.toNumber());

    // Submited and saved blocks should be the same
    expect(tx_block).to.deep.equal(submit_block);

  });

});

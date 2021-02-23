const { expect } = require("chai");

var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://node.cheapeth.org/rpc");
var toHex = function(x) { return (x==0) ? "0x" : w3.utils.toHex(x) };

const FORKBLOCK = 11818960;

function getBlockParts(block) {
  return [
    block['parentHash'],
    block['sha3Uncles'],
    block['miner'],
    block['stateRoot'],
    block['transactionsRoot'],
    block['receiptsRoot'],
    block['logsBloom'],
    toHex(block['difficulty']),
    toHex(block['number']),
    toHex(block['gasLimit']),
    toHex(block['gasUsed']),
    toHex(block['timestamp']),
    block['extraData'],
    block['mixHash'],
    block['nonce']
  ];
}

describe("Hashing function", function() {
  it("Javascript block hash is correct", async function() {
    block = await w3.eth.getBlock(FORKBLOCK-100)
    var dat = rlp.encode(getBlockParts(block));
    expect(w3.utils.soliditySha3(dat) == block['hash']);
  });
});

describe("Bridge contract", function() {
  beforeEach(async function () {
    const genesis_block = await w3.eth.getBlock(FORKBLOCK-101)
    const [owner] = await ethers.getSigners();
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    Bridge = await BridgeFactory.deploy(genesis_block['hash'], genesis_block['number']);
    expect(await Bridge.isHeaderStored(genesis_block['hash']));
  });


  it("Next block isn't there yet", async function() {
    add_block = await w3.eth.getBlock(FORKBLOCK-100)
    expect(await !Bridge.isHeaderStored(add_block['hash']));
  });


  it("Bridge adds two blocks", async function() {
    var do_add_block = async function(bn) {
      add_block = await w3.eth.getBlock(bn);
      var add_block_rlp = rlp.encode(getBlockParts(add_block));
      const ret = await Bridge.submitHeader(add_block_rlp);
      expect(await Bridge.isHeaderStored(add_block['hash']));
    }

    await do_add_block(FORKBLOCK-100);
    await do_add_block(FORKBLOCK-99);
  });

  it("Bridge doesn't add block with broken difficulty", async function() {
    add_block = await w3.eth.getBlock(FORKBLOCK-100)

    // broken block has mixhash junk
    var parts = getBlockParts(add_block);
    parts[13] = "0xa2b382b1939";

    var add_block_rlp = rlp.encode(parts);
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith("block difficultly didn't match hash");
  });

  it("Bridge doesn't add skip block", async function() {
    add_block = await w3.eth.getBlock(FORKBLOCK-99)

    var add_block_rlp = rlp.encode(getBlockParts(add_block));
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith("parent does not exist");
  });

});







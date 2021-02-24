const { expect } = require("chai");

var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://node.cheapeth.org/rpc");

const FORKBLOCK = 11818960;

function getBlockParts(block) {
  var toHex = function(x) { return (x==0) ? "0x" : w3.utils.toHex(x) };
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
    expect(w3.utils.soliditySha3(dat)).to.equal(block['hash']);
  });
});

describe("Bridge contract", function() {
  beforeEach(async function () {
    const genesis_block = await w3.eth.getBlock(FORKBLOCK-101)
    const [owner] = await ethers.getSigners();
    const BridgeFactory = await ethers.getContractFactory("Bridge");
    Bridge = await BridgeFactory.deploy(genesis_block['hash'], genesis_block['number']);
    expect(await Bridge.isHeaderStored(genesis_block['hash'])).to.equal(true);
  });


  it("Next block isn't there yet", async function() {
    add_block = await w3.eth.getBlock(FORKBLOCK-100)
    expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(false);
  });


  it("Bridge adds two blocks", async function() {
    var do_add_block = async function(bn) {
      add_block = await w3.eth.getBlock(bn);
      var add_block_rlp = rlp.encode(getBlockParts(add_block));
      const ret = await Bridge.submitHeader(add_block_rlp);
      expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(true);
    }

    await do_add_block(FORKBLOCK-100);
    await do_add_block(FORKBLOCK-99);
  });

  it("Bridge adds two blocks together", async function() {
    add_block_1 = await w3.eth.getBlock(FORKBLOCK-100);
    add_block_2 = await w3.eth.getBlock(FORKBLOCK-99);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(false);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(false);

    var add_block_rlp_1 = rlp.encode(getBlockParts(add_block_1));
    var add_block_rlp_2 = rlp.encode(getBlockParts(add_block_2));
    const ret = await Bridge.submitHeaders([add_block_rlp_1, add_block_rlp_2]);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(true);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(true);
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







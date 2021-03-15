const { expect } = require('chai');

var Web3 = require('web3');
var w3 = new Web3('https://node.cheapeth.org/rpc');
const bombDelayFromParent = 9000000;

const FORKBLOCK = 11818960;

const lib = require('../scripts/lib');

describe('Hashing function', function () {
  it('Javascript block hash is correct', async function () {
    const block = await w3.eth.getBlock(FORKBLOCK - 100);
    const dat = lib.getBlockRlp(block);
    expect(w3.utils.soliditySha3(dat)).to.equal(block['hash']);
  });
});

async function do_add_block(Bridge, bn) {
  const add_block = await w3.eth.getBlock(bn);
  const add_block_rlp = lib.getBlockRlp(add_block);
  await Bridge.submitHeader(add_block_rlp);
  expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(true);
}

describe('Bridge contract', function () {
  let Bridge;

  beforeEach(async function () {
    const genesis_block = await w3.eth.getBlock(FORKBLOCK - 101);
    await ethers.getSigners();
    const BridgeFactory = await ethers.getContractFactory('Bridge');
    Bridge = await BridgeFactory.deploy(
      lib.getBlockRlp(genesis_block),
      bombDelayFromParent
    );
    expect(await Bridge.isHeaderStored(genesis_block['hash'])).to.equal(true);
  });

  it("Next block isn't there yet", async function () {
    const add_block = await w3.eth.getBlock(FORKBLOCK - 100);
    expect(await Bridge.isHeaderStored(add_block['hash'])).to.equal(false);
  });

  it('Bridge adds two blocks', async function () {
    await do_add_block(Bridge, FORKBLOCK - 100);
    await do_add_block(Bridge, FORKBLOCK - 99);
  });

  it('Bridge adds two blocks together', async function () {
    const add_block_1 = await w3.eth.getBlock(FORKBLOCK - 100);
    const add_block_2 = await w3.eth.getBlock(FORKBLOCK - 99);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(false);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(false);

    await Bridge.submitHeaders([
      lib.getBlockRlp(add_block_1),
      lib.getBlockRlp(add_block_2),
    ]);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(true);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(true);
  });

  it("Bridge doesn't add block with broken difficulty", async function () {
    const add_block = await w3.eth.getBlock(FORKBLOCK - 100);

    // broken block has mixhash junk
    add_block['mixHash'] =
      '0x41e09eb6450e5a9f715e21ad64435c79e5f9ae67a5a9e7c3986c6871cc59c4ff';
    const add_block_rlp = lib.getBlockRlp(add_block);
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith(
      "block difficultly didn't match hash"
    );
  });

  it("Bridge doesn't add skip block", async function () {
    const add_block = await w3.eth.getBlock(FORKBLOCK - 99);

    var add_block_rlp = lib.getBlockRlp(add_block);
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith(
      'parent does not exist'
    );
  });

  it('Bridge adds several blocks and confirms they are in the chain', async function () {
    const FINAL = 5;
    for (let i = 0; i < FINAL; i++) {
      await do_add_block(Bridge, FORKBLOCK - 100 + i);
    }

    for (var i = 0; i < FINAL; i++) {
      const bn = FORKBLOCK - 100 + i;
      const add_block = await w3.eth.getBlock(bn);
      const bbn = await Bridge.getBlockByNumber(bn);
      expect(bbn['depth']).to.equal(FINAL - 1 - i);
      expect(bbn['hash']).to.equal(add_block['hash']);
    }
  });
});

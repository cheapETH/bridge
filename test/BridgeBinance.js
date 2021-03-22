const { expect } = require("chai");
const lib = require("../scripts/lib");
var utils = require('ethereumjs-util');
var rlp = require('rlp');
var Web3 = require('web3');
var w3 = new Web3("https://bsc-dataseed.binance.org/");

const sampleRlp = '0xf9021938a06a2d1e604855bb8a0a54a4e6d17dfd3b534297765c6db78e83582368a7817e20a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d4934794ea0a6e3c511bbd10f4519ece37dc24887e11b55da02efef6cc93385f05233ede5d749d2cd04eb38b045130c4ba1efc72e83b07503ea056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421a056e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421b901000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002830174018401c9c38080845f4e27a7a0d883010002846765746888676f312e31332e34856c696e757800000000000000a00000000000000000000000000000000000000000000000000000000000000000880000000000000000';
const sampleHeader = {
  "parentHash":"0x6a2d1e604855bb8a0a54a4e6d17dfd3b534297765c6db78e83582368a7817e20",
  "sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
  "miner":"0xea0a6e3c511bbd10f4519ece37dc24887e11b55d",
  "stateRoot":"0x2efef6cc93385f05233ede5d749d2cd04eb38b045130c4ba1efc72e83b07503e",
  "transactionsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
  "receiptsRoot":"0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
  "logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "difficulty":"0x2",
  "number":"0x17401",
  "gasLimit":"0x1c9c380",
  "gasUsed":"0x0",
  "timestamp":"0x5f4e27a7",
  "extraData":"0xd883010002846765746888676f312e31332e34856c696e757800000000000000edaa5052b9f0cca12979353619ce2d5d1f466e5d0f1a3c71cb2967c7bc7e780006d219d50c12dcff52836af3157f196f7cf83a4cbe61dc26d88a9b3b02791e9e00",
  "mixHash":"0x0000000000000000000000000000000000000000000000000000000000000000",
  "nonce":"0x0000000000000000",
  "hash":"0x70903a8bb10d0e87065497525b06273c5f38eb7b6d554857bcbdf38b33157539"
};
const buf2hex = (x) => '0x'+x.toString('hex');
const hex2buf = (x) => new Buffer(x.slice(2), 'hex');
const range = (start, end = start) => new Array(end).fill(null, start == end ? 0 : start, end);
function handleRlpHeader(rlpHeader) {
  let decoded = rlp.decode(rlpHeader);
  const signature = decoded[12].slice(decoded[12].length - 65);
  decoded[12] = decoded[12].slice(0, decoded[12].length - 65);
  return {signature, rlp: rlp.encode([0x38, ...decoded]) };
}
function parseSig(sig) {
  const r = sig.slice(0, 32);
  const s = sig.slice(32,64);
  // this is fucking retarded
  let v = sig.slice(64, 65).readInt8() + 27; 
  v = v.toString();
  v = Buffer.from(v);
  return {r,s,v};
}

describe("handleRlpHeader", function() {
  it("Correctly encodes sample header", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    expect(buf2hex(rlp)).to.equal(sampleRlp);
  });
  it("Correctly extracts the signature", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    expect(buf2hex(signature)).to.equal('0xedaa5052b9f0cca12979353619ce2d5d1f466e5d0f1a3c71cb2967c7bc7e780006d219d50c12dcff52836af3157f196f7cf83a4cbe61dc26d88a9b3b02791e9e00');
  });
  it("Hash of rlp encoded payload is correct", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    const keccak256 = Web3.utils.sha3(rlp);
    expect(keccak256).to.equal('0xf472a3e5116fa0e1310e40f570943c453df78050ba57aa7486269bd8876094e9');
  });
  it("Correctly recovers pubkey", async function() {
    const {signature, rlp} = handleRlpHeader(lib.getBlockRlp(sampleHeader));
    //const msg = Web3.utils.sha3(rlp);
    const {r,s,v} = parseSig(signature);
    const msg = Buffer.from('f472a3e5116fa0e1310e40f570943c453df78050ba57aa7486269bd8876094e9', 'hex')
    utils.ecrecover(msg, v, r, s);
  })
});

async function do_add_block(Bridge, bn) {
  add_block = await w3.eth.getBlock(bn);
  var add_block_rlp = lib.getBlockRlp(add_block);
  const ret = await Bridge.submitHeader(add_block_rlp);
  const [hash, depth] = await Bridge.getBlockByNumber(add_block['number']);
  expect(hash).to.equal(add_block['hash']);
}

const ADDRESS_SIZE = 20;
function decodeValidatorsFromEpoch(block) {
  const extraData = hex2buf(block.extraData);
  const validatorBytes = extraData.slice(32, extraData.length - 65);
  if ((validatorBytes.length % ADDRESS_SIZE) !== 0) {
    throw new Error("validator bytes not address size aligned");
  }
  const addresses = [];
  for(let offset = 0; offset < validatorBytes.length; offset += ADDRESS_SIZE) {
    const addr = validatorBytes.slice(offset, offset + ADDRESS_SIZE);
    addresses.push(buf2hex(addr));
  }
  return addresses;
}
async function getContractValidators(Bridge) {
   const tmp = await Promise.all(range(21).map((_, i) => Bridge.currentValidatorSet(i)))
   // bruh addresses are randmoly capitalized, at least it seems that way
   return tmp.map(e => e.toLowerCase());
}
describe("BridgeBinance contract", function() {
  // deploying at latest so the getValidators() call works
  beforeEach(async function () {
    genesis_block = await w3.eth.getBlock('latest');
    //console.log(genesis_block);
    STARTBLOCK = genesis_block.number;
    genesis_block = await w3.eth.getBlock(STARTBLOCK-101);

    validators = await lib.getValidatorsBinance(w3, STARTBLOCK);
    BridgeBinanceFactory = await ethers.getContractFactory("BridgeBinance");
  });

  it("Find genesis block", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    const block = await Bridge.getBlockByNumber(STARTBLOCK - 101);
    console.log(block);
  });

  it("Bridge adds two blocks", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);
    await do_add_block(Bridge, STARTBLOCK-100);
    await do_add_block(Bridge, STARTBLOCK-100);
  });

  it("Bridge adds two blocks together", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    add_block_1 = await w3.eth.getBlock(STARTBLOCK-100);
    add_block_2 = await w3.eth.getBlock(STARTBLOCK-99);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(false);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(false);

    const ret = await Bridge.submitHeaders([lib.getBlockRlp(add_block_1), lib.getBlockRlp(add_block_2)]);

    expect(await Bridge.isHeaderStored(add_block_1['hash'])).to.equal(true);
    expect(await Bridge.isHeaderStored(add_block_2['hash'])).to.equal(true);
  });

  it("Bridge doesn't add tampered block", async function() {
    const add_block = await w3.eth.getBlock(STARTBLOCK-100)
    // modify any field to break the signature check
    add_block['difficulty'] = '3';
    var add_block_rlp = lib.getBlockRlp(add_block);
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith("not signed by miner");
  });

  it("Bridge doesn't add block signed by unknown miner", async function() {
    const add_block = await w3.eth.getBlock(STARTBLOCK-100)
    // set miner to any address not in validators
    add_block['miner'] = '0x124e1d82D7abE42776fb355981a84f061daB4085';
    var add_block_rlp = lib.getBlockRlp(add_block);
    await expect(Bridge.submitHeader(add_block_rlp)).to.be.revertedWith("miner not in validator set");
  });

  it("Bridge updates currentValidatorSet from epoch block", async function() {
    const latest = await w3.eth.getBlock('latest');
    const LATEST_EPOCH = latest.number - (latest.number % 200);
    // get validators from second to last genesis block
    const genesis_with_epoch = await w3.eth.getBlock(LATEST_EPOCH-200);
    const genesis_validators = decodeValidatorsFromEpoch(genesis_with_epoch);
    // as gensis block use a block closest to next epoch
    // to avoid syncing 200 block in the test
    const genesis_nearby = await w3.eth.getBlock(LATEST_EPOCH-2);
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_nearby), genesis_validators);

    cur_validators = await getContractValidators(Bridge);
    expect(cur_validators).to.deep.equal(genesis_validators);

    test_block = await w3.eth.getBlock(LATEST_EPOCH-1);
    await Bridge.submitHeader(lib.getBlockRlp(test_block));

    const epoch = await w3.eth.getBlock(LATEST_EPOCH);
    const newValidators = decodeValidatorsFromEpoch(epoch);

    await Bridge.submitHeader(lib.getBlockRlp(epoch));

    cur_validators = await getContractValidators(Bridge);
    expect(cur_validators).to.deep.equal(newValidators);

    test_block = await w3.eth.getBlock(LATEST_EPOCH + 1);
    await Bridge.submitHeader(lib.getBlockRlp(test_block));
  })

  it("Look for not found block", async function() {
    Bridge = await BridgeBinanceFactory.deploy(lib.getBlockRlp(genesis_block), validators);

    await expect(Bridge.getBlockByNumber(1337)).to.be.revertedWith("block not found");
  });
});

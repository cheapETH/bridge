var Web3 = require('web3');
var rlp = require('rlp');
var toHex = function(x) { return (x==0) ? "0x" : Web3.utils.toHex(x) };

const mpt = require('merkle-patricia-tree');
const Trie = mpt.BaseTrie;

function getBlockRlp(block) {
  const dat = [
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
  return rlp.encode(dat);
}

function getTransactionRlp(tx) {
  const dat = [
    toHex(tx.nonce),
    toHex(tx.gasPrice),
    toHex(tx.gas),
    tx.to,
    toHex(tx.value),
    tx.input, // this right?
    tx.v,
    tx.r,
    tx.s,
  ];
  return rlp.encode(dat);
}

async function getTransactionTrie(w3, blockNumber, txId) {
  const trie = new Trie();
  var saleKey = null;
  var saleTxRlp = null;

  saleBlockData = await w3.eth.getBlock(blockNumber);

  for (var i = 0; i < saleBlockData['transactions'].length; i++) {
    //console.log(i, saleBlockData['transactions'][i]);
    const txn = await w3.eth.getTransaction(saleBlockData['transactions'][i]);
    const txn_rlp = getTransactionRlp(txn);
    const key = rlp.encode(i);
    if (saleBlockData['transactions'][i] == txId) {
      saleKey = key;
      saleTxRlp = txn_rlp;
    }
    await trie.put(key, txn_rlp);
  }

  return {"trie": trie, "key": saleKey, "value": saleTxRlp};
}

async function getValidatorsBinance(w3, bn) {
  // https://bscscan.com/address/0x0000000000000000000000000000000000001000
  const validatorsRaw = await w3.eth.call({
      to: "0x0000000000000000000000000000000000001000",
      data: Web3.utils.soliditySha3("getValidators()").slice(0,10)}, bn);
  let validators = w3.eth.abi.decodeParameter('address[]', validatorsRaw);
  // Validators should be sorted for correct block diffuculty calculation;
  validators = [...validators]
      .sort((a,b) => parseInt(a, 16) - parseInt(b, 16));
  return validators;
}

const fromHexString = function(str) {
  if (typeof str === 'string' && str.startsWith('0x')) {
    return Buffer.from(str.slice(2), 'hex')
  }
  return Buffer.from(str)
}

const toHexString = function(inp) {
  if (typeof inp === 'number') {
    return BigNumber.from(inp).toHexString()
  } else {
    return '0x' + fromHexString(inp).toString('hex')
  }
}
module.exports = { getBlockRlp, getTransactionRlp, fromHexString, toHexString, getTransactionTrie, getValidatorsBinance};


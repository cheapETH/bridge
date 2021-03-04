var Web3 = require('web3');
var rlp = require('rlp');
var toHex = function(x) { return (x==0) ? "0x" : Web3.utils.toHex(x) };

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

// TODO: make this a library with the test
function getBlockRlp(block) {
  return rlp.encode(getBlockParts(block));
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

module.exports = { getBlockParts, getBlockRlp, getTransactionRlp };


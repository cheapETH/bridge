from web3 import Web3

w3 = Web3(Web3.HTTPProvider("https://node.cheapeth.org/rpc"))
assert w3.isConnected()

FORKBLOCK = 11818960

"""
for i in range(FORKBLOCK, 11905170, 100):
  block = w3.eth.get_block(i)
  print(i, block['difficulty'])
"""

block = w3.eth.get_block(11905170)
#block = w3.eth.get_block(11818959-100)
#proof = w3.eth.getProof('0x6C8f2A135f6ed072DE4503Bd7C4999a1a17F824B', [0, 1], 3391)

print(block)
#print(block['hash'])
#print(proof)


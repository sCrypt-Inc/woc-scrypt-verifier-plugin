import requests
import json

script_hash = '45fe65c1dc2f84f75f6d21a40e53cb4e7766c0154678ed43db9e52a64fec944d'
network = 'test'
scrypt_ts_ver = '0.1.7-beta.7'
url = 'http://localhost:8001/{}/{}?ver={}'.format(network, script_hash, scrypt_ts_ver)

code = '''
import {
    assert,
    hash256,
    HashedMap,
    method,
    prop,
    PubKey,
    Sig,
    SigHash,
    SmartContract,
} from 'scrypt-ts'

// tokenId: ownerPubKey
type OwnerMap = HashedMap<bigint, PubKey>

// a basic ERC721-like non-fungible token
export class Erc721 extends SmartContract {
    @prop()
    minter: PubKey
    s
    @prop(true)
    owners: OwnerMap

    constructor(minter: PubKey, owners: OwnerMap) {
        super(...arguments)
        this.minter = minter
        this.owners = owners
    }

    // mint a new token to receiver
    @method(SigHash.SINGLE)
    public mint(tokenId: bigint, mintTo: PubKey, minterSig: Sig) {
        // require token was not minted before
        assert(!this.owners.has(tokenId), 'token was already minted before')
        // require the minter to provide a signature before minting
        assert(
            this.checkSig(minterSig, this.minter),
            'minter signature check failed'
        )
        // set token belongs to the receiver
        this.owners.set(tokenId, mintTo)
        // validate hashOutputs
        assert(
            this.ctx.hashOutputs ==
                hash256(this.buildStateOutput(this.ctx.utxo.value)),
            'hashOutputs check failed'
        )
    }

    // burn a token
    @method(SigHash.SINGLE)
    public burn(tokenId: bigint, sender: PubKey, sig: Sig) {
        // verify ownership
        assert(
            this.owners.canGet(tokenId, sender),
            "sender doesn't have the token"
        )
        // verify sender's signature
        assert(this.checkSig(sig, sender), 'sender signature check failed')
        // remove token from owners
        assert(this.owners.delete(tokenId), 'token burn failed')
        // validate hashOutputs
        assert(
            this.ctx.hashOutputs ==
                hash256(this.buildStateOutput(this.ctx.utxo.value)),
            'hashOutputs check failed'
        )
    }

    // transfer a token from sender to receiver
    @method(SigHash.SINGLE)
    public transferFrom(
        tokenId: bigint,
        sender: PubKey,
        sig: Sig,
        receiver: PubKey
    ) {
        // verify ownership
        assert(
            this.owners.canGet(tokenId, sender),
            "sender doesn't have the token"
        )
        // verify sender's signature
        assert(this.checkSig(sig, sender), 'sender signature check failed')
        // change token owner
        this.owners.set(tokenId, receiver)
        // validate hashOutputs
        assert(
            this.ctx.hashOutputs ==
                hash256(this.buildStateOutput(this.ctx.utxo.value)),
            'hashOutputs check failed'
        )
    }
}

'''

# Define the data to be sent in the request body
payload = {
    'code': code
}

# Convert the payload to a JSON string
payload_json = json.dumps(payload)

# Define the headers for the request
headers = {'Content-Type': 'application/json'}

# Make the request
response = requests.post(url, data=payload_json, headers=headers)

# Print the response status code and text
print(f'POST response status code: {response.status_code}')
print(f'POST response text: {response.text}')

response = requests.get(url, headers=headers)

print(f'GET response status code: {response.status_code}')
print(f'GET response text: {response.text}')


import requests
import json
import time

script_hash = 'da215cab185816503b189781b48e11dff1177d20dd82e00907ebd50b46fbe38d'
network = 'test'
scrypt_ts_ver = '1.3.4'
url = 'http://localhost:8001/{}/{}?ver={}'.format(network, script_hash, scrypt_ts_ver)

code = '''
import {
    method,
    prop,
    SmartContract,
    assert,
    PubKeyHash,
    Sig,
    PubKey,
    hash160,
} from 'scrypt-ts'

export class Lockup extends SmartContract {
    @prop()
    lockUntilHeight: bigint

    @prop()
    pkhash: PubKeyHash

    constructor(pkhash: PubKeyHash, lockUntilHeight: bigint) {
        super(...arguments)
        assert(lockUntilHeight < 500000000, 'must use blockHeight locktime')
        this.lockUntilHeight = lockUntilHeight
        this.pkhash = pkhash
    }

    @method()
    public redeem(sig: Sig, pubkey: PubKey) {
        assert(this.ctx.locktime < 500000000, 'must use blockHeight locktime')
        assert(this.ctx.sequence < 0xffffffff, 'must use sequence locktime')
        assert(
            this.ctx.locktime >= this.lockUntilHeight,
            'lockUntilHeight not reached'
        )
        assert(
            hash160(pubkey) == this.pkhash,
            'public key hashes are not equal'
        )
        // Check signature validity.
        assert(this.checkSig(sig, pubkey), 'signature check failed')
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

time.sleep(1)

response = requests.get(url, headers=headers)

print(f'GET response status code: {response.status_code}')
print(f'GET response text: {response.text}')


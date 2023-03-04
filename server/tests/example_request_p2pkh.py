import requests
import json
import time

script_hash = 'a388885504161ba5ed2bd6f5e1e526f1fa01503b90fd4f9f9c7700657b991725'
network = 'test'
scrypt_ts_ver = '0.1.7-beta.7'
url = 'http://localhost:8001/{}/{}?ver={}'.format(network, script_hash, scrypt_ts_ver)

code = '''
import {
    assert,
    hash160,
    method,
    prop,
    PubKey,
    PubKeyHash,
    Sig,
    SmartContract,
} from 'scrypt-ts'

export class P2PKH extends SmartContract {
    // Address of the recipient.
    @prop()
    readonly pubKeyHash: PubKeyHash

    constructor(pubKeyHash: PubKeyHash) {
        super(...arguments)
        this.pubKeyHash = pubKeyHash
    }

    @method()
    public unlock(sig: Sig, pubkey: PubKey) {
        // Check if the passed public key belongs to the specified address.
        assert(
            hash160(pubkey) == this.pubKeyHash,
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


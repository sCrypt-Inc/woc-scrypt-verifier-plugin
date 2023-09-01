import requests
import json
import time

script_hash = '897f4a5dcd4e21fa9016b7aa92139e7969d6fd5f7f335a526095d54b70a49b4b'
network = 'test'
scrypt_ts_ver = '1.3.0'
url = 'http://localhost:8001/{}/{}?ver={}'.format(network, script_hash, scrypt_ts_ver)

code = '''
import {
    assert,
    ByteString,
    method,
    prop,
    sha256,
    Sha256,
    SmartContract,
} from 'scrypt-ts'

export class Demo extends SmartContract {
    @prop()
    hash: Sha256

    constructor(hash: Sha256) {
        super(...arguments)
        this.hash = hash
    }

    @method()
    public unlock(message: ByteString) {
        assert(sha256(message) == this.hash, 'Hash does not match')
    }
}
'''

# Define the data to be sent in the request body
payload = {
    'code': code,
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


import requests
import json

txid = '8e36519052a7090b9958781a71cab9c35564de947b4050ea853d91d2b846b683'
vout_idx = 0
network = 'test'
url = 'http://localhost:5001/{}/{}/{}'.format(network, txid, vout_idx)

code = '''
import { method, prop, SmartContract, assert, bsv, UTXO } from 'scrypt-ts'

class MyProject extends SmartContract {
    @prop()
    x: bigint

    @prop()
    y: bigint

    constructor(x: bigint, y: bigint) {
        super(x, y)
        this.x = x
        this.y = y
    }

    @method()
    sum(a: bigint, b: bigint): bigint {
        return a + b
    }

    @method()
    public add(z: bigint) {
        assert(z == this.sum(this.x, this.y))
    }

    @method()
    public sub(z: bigint) {
        assert(z == this.x - this.y)
    }

}

'''

# Define the data to be sent in the request body
payload = {
    'code': code,
    'abiConstructorParams': [
        '51', '52'
    ]
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


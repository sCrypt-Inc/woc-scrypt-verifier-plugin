import requests
import json

txid = '320ba9fb3826c0bc66beed51edf2463e958b7274921563c5c90be62deabb725f'
vout = 0
network = 'test'
url = 'http://localhost:8001/{}/{}/{}'.format(network, txid, vout)

code = '''
import { SmartContract, method, prop, assert } from "scrypt-ts"

class Demo extends SmartContract {
  @prop()
  readonly x: bigint

  constructor(x: bigint) {
    super(...arguments)
    this.x = x
  }

  @method()
  public unlock(x: bigint) {
    assert(this.add(this.x, 1n) == x, 'incorrect sum')
  }

  @method()
  add(x0: bigint, x1:bigint) : bigint {
    return x0 + x1
  }
}
'''

# Define the data to be sent in the request body
payload = {
    'code': code,
    'abiConstructorParams': [
        '01'
    ]
}

# Convert the payload to a JSON string
payload_json = json.dumps(payload)

# Define the headers for the request
headers = {'Content-Type': 'application/json'}

# Make the request
response = requests.post(url, data=payload_json, headers=headers)

# Print the response status code and text
print(f'Response status code: {response.status_code}')
print(f'Response text: {response.text}')
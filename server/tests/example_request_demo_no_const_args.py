import requests
import json

script_hash = '90e9df755a22a5c939eb71361d2626022e0babd44bd6684dfa156193ab6476a3'
network = 'test'
scrypt_ts_ver = '0.1.7-beta.7'
url = 'http://localhost:8001/{}/{}?ver={}'.format(network, script_hash, scrypt_ts_ver)

code = '''
import { assert, method, prop, SmartContract } from 'scrypt-ts'

export class Demo extends SmartContract {

  static readonly x: bigint = 5n;
  static readonly y: bigint = 2n;

  // Contract internal method to compute x + y
  @method()
  sum(a: bigint, b: bigint): bigint {
    return a + b
  }

  // Public method which can be unlocked by providing the solution to x + y
  @method()
  public add(z: bigint) {
    assert(z == this.sum(Demo.x, Demo.y), 'add check failed')
  }

  // Public method which can be unlocked by providing the solution to x - y
  @method()
  public sub(z: bigint) {
    assert(z == Demo.x - Demo.y, 'sub check failed')
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

response = requests.get(url, headers=headers)

print(f'GET response status code: {response.status_code}')
print(f'GET response text: {response.text}')

